const Airtable = require('airtable');

// Configure Airtable (only if credentials are provided)
let base = null;
const DIET_PLAN_TABLE = process.env.AIRTABLE_DIET_PLAN_TABLE || 'Diet Plan';

if (process.env.AIRTABLE_PAT && process.env.AIRTABLE_BASE_ID) {
  base = new Airtable({
    apiKey: process.env.AIRTABLE_PAT
  }).base(process.env.AIRTABLE_BASE_ID);
} else {
  console.warn('Airtable credentials not configured. Diet plan features will be unavailable.');
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
async function fetchDietPlans({ filterByStatus, customerPhone } = {}) {
  if (!base) {
    console.warn('Airtable not configured. Returning empty diet plans.');
    return [];
  }
  const records = [];
  const queryOptions = {
    pageSize: 100,
    sort: [{ field: 'Customer Name', direction: 'asc' }]
  };

  // Build optional filter formula
  const filters = [];
  if (filterByStatus) {
    filters.push(`{Status} = '${filterByStatus}'`);
  }
  if (customerPhone) {
    filters.push(`{Customer Phone} = '${customerPhone}'`);
  }
  if (filters.length === 1) {
    queryOptions.filterByFormula = filters[0];
  } else if (filters.length > 1) {
    queryOptions.filterByFormula = `AND(${filters.join(', ')})`;
  }

  return new Promise((resolve, reject) => {
    base(DIET_PLAN_TABLE)
      .select(queryOptions)
      .eachPage(
        (pageRecords, fetchNextPage) => {
          pageRecords.forEach((record) => {
            records.push({
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
          fetchNextPage();
        },
        (err) => {
          if (err) {
            console.error('Airtable fetch error:', err);
            reject(err);
          } else {
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
