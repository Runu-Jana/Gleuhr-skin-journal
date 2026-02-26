const mongoose = require('mongoose');
const { base, TABLES } = require('../config/airtable');
const Patient = require('../models/Patient');

async function migrateFromAirtable() {
  try {
    console.log('Starting migration from Airtable to MongoDB...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Fetch all patients from Airtable
    const airtablePatients = await base(TABLES.PATIENTS)
      .select()
      .all();
    
    console.log(`Found ${airtablePatients.length} patients in Airtable`);
    
    let migrated = 0;
    let skipped = 0;
    
    for (const airtablePatient of airtablePatients) {
      const fields = airtablePatient.fields;
      
      try {
        // Check if patient already exists (by phone or email)
        const existingPatient = await Patient.findOne({
          $or: [
            { phoneNumber: fields['Phone Number'] },
            { email: fields['Email'] }
          ]
        });
        
        if (existingPatient) {
          console.log(`Patient already exists: ${fields['Phone Number'] || fields['Email']}`);
          skipped++;
          continue;
        }
        
        // Create new patient document
        const patient = new Patient({
          // Legacy Airtable reference
          airtableId: airtablePatient.id,
          
          // Basic Information
          fullName: fields['Full Name'] || '',
          name: fields['Full Name'] || '', // Legacy field
          email: fields['Email'] || '',
          phoneNumber: fields['Phone Number'] || '',
          phone: fields['Phone Number'] || '', // Legacy field
          skinConcern: fields['Skin Concern'] || '',
          planType: fields['Plan Type'] || 'Basic',
          startDate: fields['Start Date'] ? new Date(fields['Start Date']) : new Date(),
          
          // Coach Information
          coachName: fields['Coach Name'] || '',
          coachWhatsApp: fields['Coach WhatsApp'] || '',
          
          // Authentication
          journalToken: fields['Journal Token'] || '',
          
          // Program Status
          hasCommitted: fields['Has Committed'] || false,
          commitment: fields['Has Committed'] ? 'basic' : 'none',
          
          // Progress
          currentDay: 1,
          completionPercentage: 0,
          
          // Gamification
          totalPoints: 0,
          level: 1,
          achievements: [],
          
          // Profile
          profile: {
            age: fields['Age'] || null,
            gender: fields['Gender'] || '',
            skinType: fields['Skin Type'] || '',
            concerns: fields['Concerns'] ? fields['Concerns'].split(', ') : [],
            goals: fields['Goals'] ? fields['Goals'].split(', ') : []
          },
          
          // Preferences
          preferences: {
            notifications: true,
            weeklyReminders: true,
            dailyReminders: true
          }
        });
        
        await patient.save();
        migrated++;
        console.log(`Migrated: ${fields['Full Name']} (${fields['Phone Number']})`);
        
      } catch (error) {
        console.error(`Error migrating patient ${fields['Full Name']}:`, error);
      }
    }
    
    console.log(`Migration completed:`);
    console.log(`- Migrated: ${migrated} patients`);
    console.log(`- Skipped: ${skipped} patients`);
    console.log(`- Total processed: ${airtablePatients.length} patients`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateFromAirtable();
}

module.exports = migrateFromAirtable;
