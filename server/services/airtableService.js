const Airtable = require('airtable');

// Configure Airtable (only if credentials are provided)
let base = null;
const DIET_PLAN_TABLE = process.env.AIRTABLE_DIET_PLAN_TABLE || 'Diet Plan';

console.log('Airtable Configuration Check:');
console.log('AIRTABLE_PAT exists:', !!process.env.AIRTABLE_PAT);
console.log('AIRTABLE_BASE_ID exists:', !!process.env.AIRTABLE_BASE_ID);
console.log('AIRTABLE_PAT value:', process.env.AIRTABLE_PAT ? 'configured' : 'missing');
console.log('AIRTABLE_BASE_ID value:', process.env.AIRTABLE_BASE_ID || 'missing');

if (process.env.AIRTABLE_PAT && process.env.AIRTABLE_BASE_ID) {
  console.log('✅ Airtable credentials found, initializing...');
  base = new Airtable({
    apiKey: process.env.AIRTABLE_PAT
  }).base(process.env.AIRTABLE_BASE_ID);
  console.log('✅ Airtable base initialized successfully');
} else {
  console.warn('❌ Airtable credentials not configured. Diet plan features will be unavailable.');
  console.log('Please check .env file for AIRTABLE_PAT and AIRTABLE_BASE_ID');
}

/**
 * Fetch all diet plan records from Airtable.
 * Expected Airtable columns:
 *   - Customer Name
 *   - Customer Phone
 *   - Plan Category (e.g., Vegan, Vegetarian, Keto)
 *   - Restrictions (comma-separated or multi-select)
 *   - Recommendations (long text)
 *   - Dietician Name
 *   - Dietician Phone
 *   - Status (Active / Inactive)
 *   - Start Date
 *   - Notes
 */
/**
 * Normalize phone number by removing +91 and other formatting
 * Matches MongoDB format (+917973944144) with Airtable data
 */
function normalizePhone(phone) {
  if (!phone) return '';
  // Remove +91 prefix if present, then normalize
  const cleanPhone = phone.replace(/^\+91/, '');
  return cleanPhone.replace(/[^\d]/g, '').replace(/^(\d{2})(\d{8})(\d{0,})$/, '$1$2$3');
}

/**
 * Try multiple phone field variations to find matching records
 */
function getPhoneFromRecord(record) {
  const directPhone = record.get('Customer Phone');
  if (directPhone) return directPhone;
  
  // Try combining separate dial code and phone fields
  const dialCode = record.get('Dial Code');
  const phoneNumber = record.get('Phone Number');
  if (dialCode && phoneNumber) {
    return `${dialCode}${phoneNumber}`;
  }
  
  // Try other common field names
  return record.get('Phone') || 
         record.get('Contact') || 
         record.get('Mobile') || 
         directPhone || '';
}

/**
 * Get customer name from record (handle lookup fields)
 */
function getCustomerNameFromRecord(record) {
  // Try direct field first
  const directName = record.get('Customer Name');
  if (directName) return directName;
  
  // Try lookup field (may contain linked record name)
  const lookupName = record.get('Customer');
  if (lookupName) {
    console.log(`🔗 Found Customer lookup field: ${lookupName}`);
    return lookupName;
  }
  
  console.log('⚠️ No customer name found in record fields');
  return '';
}

async function fetchDietPlans({ filterByStatus, customerPhone } = {}) {
  if (!base) {
    console.warn('Airtable not configured. Returning empty diet plans.');
    return [];
  }

  const normalizedSearchPhone = normalizePhone(customerPhone);
  console.log(`🔍 Fetching diet plans for customerPhone: ${customerPhone} (normalized: ${normalizedSearchPhone})`);
  
  const records = [];
  
  // First, let's try to get ALL records to see what's in the table
  console.log('🔍 Fetching ALL records from Airtable to debug...');
  
  return new Promise((resolve, reject) => {
    base(DIET_PLAN_TABLE)
      .select({
        pageSize: 100,
        sort: [{ field: 'Customer Name', direction: 'asc' }]
      })
      .eachPage(
        (pageRecords, fetchNextPage) => {
          console.log(`📄 Found ${pageRecords.length} records in this page`);
          pageRecords.forEach((record, index) => {
            const recordPhone = getPhoneFromRecord(record);
            const normalizedRecordPhone = normalizePhone(recordPhone);
            
            console.log(`📋 Record ${index + 1}:`, {
              id: record.id,
              customerName: record.get('Customer Name'),
              customerPhone: recordPhone,
              normalizedPhone: normalizedRecordPhone,
              planCategory: record.get('Plan Category'),
              allFields: Object.keys(record.fields)
            });
            
            // Match using normalized phone numbers
            if (!customerPhone || normalizedRecordPhone === normalizedSearchPhone) {
              records.push({
                id: record.id,
                customerName: record.get('Customer Name') || '',
                customerPhone: recordPhone || '',
                planCategory: record.get('Plan Category') || '',
                restrictions: record.get('Restrictions') || [],
                recommendations: record.get('Recommendations') || '',
                dieticianName: record.get('Dietician Name') || '',
                dieticianPhone: record.get('Dietician Phone') || '',
                status: record.get('Status') || 'Active',
                startDate: record.get('Start Date') || null,
                notes: record.get('Notes') || ''
              });
            } else if (customerPhone) {
              console.log(`⏭️ Skipping record - phone mismatch: expected ${normalizedSearchPhone}, got ${normalizedRecordPhone} (original: ${recordPhone})`);
            }
          });
          fetchNextPage();
        },
        (err) => {
          if (err) {
            console.error('❌ Airtable fetch error:', err);
            reject(err);
          } else {
            console.log(`✅ Airtable fetch complete. Total matching records: ${records.length}`);
            if (records.length > 0) {
              console.log('📋 First matching record:', records[0]);
            }
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
        customerName: record.get('Customer Name') || '',
        customerPhone: record.get('Customer Phone') || '',
        planCategory: record.get('Plan Category') || '',
        restrictions: record.get('Restrictions') || [],
        recommendations: record.get('Recommendations') || '',
        dieticianName: record.get('Dietician Name') || '',
        dieticianPhone: record.get('Dietician Phone') || '',
        status: record.get('Status') || 'Active',
        startDate: record.get('Start Date') || null,
        notes: record.get('Notes') || ''
      });
    });
  });
}

module.exports = {
  fetchDietPlans,
  fetchDietPlanById
};
