const Airtable = require('airtable');

// Initialize Airtable with Personal Access Token (PAT)
const base = new Airtable({ 
  apiKey: process.env.AIRTABLE_PAT 
}).base(process.env.AIRTABLE_BASE_ID);

// Table names
const TABLES = {
  PATIENTS: 'Contacts',
  PRODUCTS: 'Products',
  DIET_PLANS: 'Diet Plan',
  TEAM: 'Team'
};

module.exports = { base, TABLES };
