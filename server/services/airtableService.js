const Airtable = require('airtable');

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
 *
 * NOTE: Lookup fields return ARRAYS even for single values.
 *       Use extractLookup() to safely get the first value.
 *       No need to configure linked table IDs — Airtable resolves lookups automatically.
 */

/**
 * Safely extract first value from a lookup/linked field (returns array from API)
 */
function extractLookup(value) {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
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
  const dialCode = record.get('Dial Code') || '';
  const phoneNumber = record.get('Phone Number') ? String(record.get('Phone Number')) : '';
  return {
    id: record.id,
    airtableId: record.get('ID'),
    treatmentPlan: record.get('Treatment Plan') || '',
    customerName: extractLookup(record.get('Name')),
    customerPhone: phoneNumber,
    dialCode,
    fullPhone: dialCode && phoneNumber ? `${dialCode}${phoneNumber}` : phoneNumber,
    dieticianName: extractLookup(record.get('Dietician')) || extractLookup(record.get('Booked By')),
    dieticianCallStatus: record.get('Dietician Call Status') || '',
    dietPlanStatus: record.get('Diet Plan Status') || '',
    dietPlanDate: record.get('Diet Plan Date') || null,
  };
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
        treatmentPlan: record.get('Treatment Plan') || '',
        customerName: extractLookup(record.get('Name')),
        customerPhone: record.get('Phone Number') ? String(record.get('Phone Number')) : '',
        dialCode: record.get('Dial Code') || '',
        dieticianName: extractLookup(record.get('Dietician')) || extractLookup(record.get('Booked By')),
        dieticianCallStatus: record.get('Dietician Call Status') || '',
        dietPlanStatus: record.get('Diet Plan Status') || '',
        dietPlanDate: record.get('Diet Plan Date') || null,
      });
    });
  });
}

module.exports = {
  fetchDietPlans,
  fetchDietPlanById,
  fetchAllDietPlans
};
