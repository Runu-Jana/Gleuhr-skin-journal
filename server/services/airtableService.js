const Airtable = require('airtable');
const axios = require('axios');

// Configure Airtable (only if credentials are provided)
let base = null;
const DIET_PLAN_TABLE = process.env.AIRTABLE_DIET_PLAN_TABLE || 'Diet Plan';

console.log('Airtable Configuration Check:');
console.log('AIRTABLE_PAT exists:', !!process.env.AIRTABLE_PAT);
console.log('AIRTABLE_BASE_ID exists:', !!process.env.AIRTABLE_BASE_ID);

if (process.env.AIRTABLE_PAT && process.env.AIRTABLE_BASE_ID) {
  console.log('✅ Airtable credentials found, initializing...');
  base = new Airtable({
    apiKey: process.env.AIRTABLE_PAT
  }).base(process.env.AIRTABLE_BASE_ID);
  console.log('✅ Airtable base initialized successfully');
} else {
  console.warn('❌ Airtable credentials not configured. Diet plan features will be unavailable.');
}

/**
 * Airtable "Diet Plan" table field mapping:
 *
 *   Field Name             | Type           | API Returns
 *   -----------------------|----------------|----------------------------------
 *   ID                     | Auto-number    | number
 *   Treatment Plan         | Text           | string ("TP-2368")
 *   Customer               | Linked Record  | array of record IDs (to Contact table)
 *   Dial Code              | Single Select  | string ("91")
 *   Name                   | Lookup         | array of strings (from Contact table)
 *   Phone Number           | Text/Number    | string ("8872218317")
 *   Booked By              | Lookup/Linked  | array of strings (from Team table)
 *   Dietician              | Lookup         | array of strings (from Team table)
 *   Dietician Call Status  | Single Select  | string ("Call Pending")
 *   Diet Plan Status       | Single Select  | string ("Diet Plan Shared")
 *   Diet Plan Date         | Date           | string ("2026-03-14")
 *   Products               | Lookup/Multi   | array of strings (product names)
 *
 * NOTE: Lookup fields return ARRAYS even for single values.
 *       Use extractLookup() to safely get the first value.
 *       No need to configure linked table IDs — Airtable resolves lookups automatically.
 */

/**
 * Safely convert any Airtable field value to a plain string.
 * Handles strings, numbers, arrays, and Collaborator/People objects {id, email, name}.
 */
function extractString(value) {
  if (!value && value !== 0) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return extractString(value[0]);
  // Collaborator / People field returns { id, email, name }
  if (typeof value === 'object') return value.name || value.email || '';
  return '';
}

/**
 * Safely extract first value from a lookup/linked field (returns array from API).
 * Also handles Collaborator objects that return {id, email, name} instead of strings.
 */
function extractLookup(value) {
  if (Array.isArray(value)) return extractString(value[0]);
  return extractString(value);
}

/**
 * Extract ALL values from a multi-value Airtable field (Linked Records, Multi-select, Lookup).
 * Returns an array of plain strings — empty strings are filtered out.
 */
function extractArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(v => extractString(v)).filter(Boolean);
  const s = extractString(value);
  return s ? [s] : [];
}

/**
 * Normalize phone number for comparison.
 * Strips +91, dial codes, and non-digit characters.
 */
function normalizePhone(phone) {
  if (!phone) return '';
  return String(phone).replace(/^\+?91/, '').replace(/[^\d]/g, '');
}

/**
 * Get phone number from record — combines Dial Code + Phone Number if needed
 */
function getPhoneFromRecord(record) {
  const phoneNumber = record.get('Phone Number');
  if (phoneNumber) return String(phoneNumber);

  // Fallback: try combining Dial Code + Customer (linked record may have phone as primary)
  const dialCode = record.get('Dial Code');
  const customer = extractLookup(record.get('Customer'));
  if (dialCode && customer) return `${dialCode}${customer}`;

  return '';
}

/**
 * Map a raw Airtable record to our standard shape.
 */
function mapRecord(record) {
  const dialCode = extractString(record.get('Dial Code'));
  const phoneNumber = record.get('Phone Number') ? String(record.get('Phone Number')) : '';
  return {
    id: record.id,
    airtableId: record.get('ID'),
    treatmentPlan: extractString(record.get('Treatment Plan')),
    customerName: extractLookup(record.get('Name')),
    customerPhone: phoneNumber,
    dialCode,
    fullPhone: dialCode && phoneNumber ? `${dialCode}${phoneNumber}` : phoneNumber,
    dieticianName: extractLookup(record.get('Dietician')) || extractLookup(record.get('Booked By')),
    dieticianCallStatus: extractString(record.get('Dietician Call Status')),
    dietPlanStatus: extractString(record.get('Diet Plan Status')),
    dietPlanDate: record.get('Diet Plan Date') || null,
    products: extractArray(record.get('Products')),
  };
}

const TEAM_TABLE = process.env.AIRTABLE_TEAM_TABLE || 'Team';

/**
 * Fetch all team members from the Team table filtered by Department = 'Dieticians'.
 * Returns array of {id, name, email, phone}.
 */
async function fetchTeamMembers() {
  if (!base) return [];
  const records = [];
  return new Promise((resolve, reject) => {
    base(TEAM_TABLE)
      .select({
        pageSize: 100,
        filterByFormula: "{Department} = 'Dieticians'",
      })
      .eachPage(
        (pageRecords, fetchNextPage) => {
          pageRecords.forEach(r => {
            records.push({
              id: r.id,
              name: extractString(r.get('Name')) || '',
              email: extractString(r.get('Email ID')) || '',
              phone: extractString(r.get('Phone Number')) || '',
            });
          });
          fetchNextPage();
        },
        (err) => err ? reject(err) : resolve(records)
      );
  });
}

/**
 * Fetch all records from the Diet Plan table (paginated).
 * Optionally filter in JS by customerPhone or dieticianName.
 */
async function fetchAllDietPlans() {
  if (!base) return [];
  const records = [];
  return new Promise((resolve, reject) => {
    base(DIET_PLAN_TABLE)
      .select({ pageSize: 100, sort: [{ field: 'ID', direction: 'desc' }] })
      .eachPage(
        (pageRecords, fetchNextPage) => {
          pageRecords.forEach(r => records.push(mapRecord(r)));
          fetchNextPage();
        },
        (err) => err ? reject(err) : resolve(records)
      );
  });
}

async function fetchDietPlans({ filterByStatus, customerPhone } = {}) {
  if (!base) {
    console.warn('Airtable not configured. Returning empty diet plans.');
    return [];
  }

  const normalizedSearchPhone = normalizePhone(customerPhone);
  console.log(`🔍 Fetching diet plans for phone: ${customerPhone} (normalized: ${normalizedSearchPhone})`);

  const records = [];

  return new Promise((resolve, reject) => {
    base(DIET_PLAN_TABLE)
      .select({
        pageSize: 100,
        sort: [{ field: 'ID', direction: 'desc' }]
      })
      .eachPage(
        (pageRecords, fetchNextPage) => {
          pageRecords.forEach((record) => {
            const recordPhone = getPhoneFromRecord(record);
            const normalizedRecordPhone = normalizePhone(recordPhone);

            if (!customerPhone || normalizedRecordPhone === normalizedSearchPhone) {
              records.push(mapRecord(record));
            }
          });
          fetchNextPage();
        },
        (err) => {
          if (err) {
            console.error('❌ Airtable fetch error:', err);
            reject(err);
          } else {
            console.log(`✅ Fetch complete. ${records.length} matching records.`);
            resolve(records);
          }
        }
      );
  });
}

/**
 * Fetch a single diet plan by Airtable record ID.
 */
async function fetchDietPlanById(recordId) {
  if (!base) {
    console.warn('Airtable not configured. Cannot fetch diet plan.');
    return null;
  }
  return new Promise((resolve, reject) => {
    base(DIET_PLAN_TABLE).find(recordId, (err, record) => {
      if (err) {
        console.error('Airtable find error:', err);
        reject(err);
        return;
      }
      resolve({
        id: record.id,
        airtableId: record.get('ID'),
        treatmentPlan: extractString(record.get('Treatment Plan')),
        customerName: extractLookup(record.get('Name')),
        customerPhone: record.get('Phone Number') ? String(record.get('Phone Number')) : '',
        dialCode: extractString(record.get('Dial Code')),
        dieticianName: extractLookup(record.get('Dietician')) || extractLookup(record.get('Booked By')),
        dieticianCallStatus: extractString(record.get('Dietician Call Status')),
        dietPlanStatus: extractString(record.get('Diet Plan Status')),
        dietPlanDate: record.get('Diet Plan Date') || null,
      });
    });
  });
}

/**
 * Upload a weekly progress photo to the "Patient Photos" attachment field
 * in the Airtable "Diet Plan" table, matched by the patient's phone number.
 *
 * Uses Airtable's direct-upload Content API so no public hosting URL is needed.
 * Errors are caught and logged — a failure here never blocks the MongoDB save.
 *
 * @param {string} phone       - Patient phone number (used to find the Airtable record)
 * @param {string} photoBase64 - Base-64 data URI (e.g. "data:image/jpeg;base64,...")
 * @param {number} weekNumber  - Week number for the filename label
 */
async function uploadPhotoToAirtable(phone, photoBase64, weekNumber) {
  if (!base) {
    console.warn('Airtable not configured — skipping photo upload');
    return null;
  }
  if (!phone || !photoBase64) return null;

  try {
    const normalizedPhone = normalizePhone(phone);
    console.log(`uploadPhotoToAirtable: looking up phone ${phone} (normalized: ${normalizedPhone})`);

    // 1. Find the Diet Plan record matching this phone number.
    //    Phone Number may be stored as a number in Airtable, so we fetch
    //    all records and do a normalized JS-side comparison (same as fetchDietPlans).
    let matchedRecordId = null;
    await new Promise((resolve, reject) => {
      base(DIET_PLAN_TABLE)
        .select({ pageSize: 100 })
        .eachPage(
          (pageRecords, fetchNextPage) => {
            for (const r of pageRecords) {
              const rPhone = normalizePhone(String(r.get('Phone Number') || ''));
              if (rPhone === normalizedPhone) {
                matchedRecordId = r.id;
                break;
              }
            }
            if (matchedRecordId) {
              resolve();
            } else {
              fetchNextPage();
            }
          },
          (err) => (err ? reject(err) : resolve())
        );
    });

    if (!matchedRecordId) {
      console.warn(`uploadPhotoToAirtable: no Diet Plan record found for phone ${phone}`);
      return null;
    }

    console.log(`uploadPhotoToAirtable: found record ${matchedRecordId}`);

    // 2. Convert base64 data-URI to a binary Buffer
    const mimeMatch = photoBase64.match(/^data:(image\/[\w+]+);base64,/);
    const contentType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const ext = contentType.split('/')[1]?.split('+')[0] || 'jpg';
    const rawBase64 = photoBase64.replace(/^data:image\/[\w+]+;base64,/, '');
    const imageBuffer = Buffer.from(rawBase64, 'base64');
    const filename = `week-${weekNumber}.${ext}`;

    // 3. Upload directly to Airtable using the Content API
    //    POST https://content.airtable.com/v0/{baseId}/{tableIdOrName}/{recordId}/{fieldIdOrName}/uploadAttachment
    const tableEncoded = encodeURIComponent(DIET_PLAN_TABLE);
    const fieldEncoded = encodeURIComponent('Patient Photos');
    const uploadUrl = `https://content.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${tableEncoded}/${matchedRecordId}/${fieldEncoded}/uploadAttachment`;

    console.log(`uploadPhotoToAirtable: uploading to ${uploadUrl}`);

    const response = await axios.post(uploadUrl, imageBuffer, {
      headers: {
        Authorization: `Bearer ${process.env.AIRTABLE_PAT}`,
        'Content-Type': contentType,
        'x-airtable-filename': filename,
      },
      params: { filename },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    console.log(`✅ Photo uploaded to Airtable record ${matchedRecordId} (week ${weekNumber})`);
    return response.data;
  } catch (err) {
    const detail = err?.response?.data || err.message;
    console.error('uploadPhotoToAirtable error:', detail);
    return null; // Non-fatal — MongoDB save already succeeded
  }
}

module.exports = {
  fetchDietPlans,
  fetchDietPlanById,
  fetchAllDietPlans,
  fetchTeamMembers,
  extractArray,
  uploadPhotoToAirtable,
};
