const express = require('express');
const router = express.Router();
const { base, TABLES } = require('../config/airtable');

// GET /api/patient/profile/:phone - Get patient profile by phone number
router.get('/profile/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    
    // Fetch patient from Diet Plan table using phone number
    const records = await base(TABLES.DIET_PLANS)
      .select({
        filterByFormula: `{Phone Number} = '${phone}'`,
        maxRecords: 1
      })
      .firstPage();

    if (records.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const patient = records[0];
    const fields = patient.fields;

    // Get products (if patient ID is available)
    let products = [];
    if (patient.id) {
      products = await getPatientProducts(patient.id);
    }

    res.json({
      id: patient.id,
      name: fields['Full Name'] || fields['Name'] || '',
      email: fields['Email'] || '',
      phone: fields['Phone Number'] || phone,
      concern: fields['Skin Concern'] || '',
      planType: fields['Plan Type'] || '',
      startDate: fields['Start Date'] || '',
      coachName: fields['Coach Name'] || '',
      coachWhatsApp: fields['Coach WhatsApp'] || '',
      hasCommitted: fields['Has Committed'] || false,
      products,
      // Diet plan details are already in this record
      dietPlan: {
        id: patient.id,
        version: fields['Version'] || '',
        category: fields['Category'] || '',
        restrictions: fields['Restrictions'] ? fields['Restrictions'].split(',').map(r => r.trim()) : [],
        recommendations: fields['Recommendations'] ? fields['Recommendations'].split(',').map(r => r.trim()) : [],
        notes: fields['Notes'] || '',
        mealPlan: fields['Meal Plan'] || ''
      },
      weeklyPhotos: fields['Weekly Photos'] || []
    });
  } catch (error) {
    console.error('Fetch profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PATCH /api/patient/commitment/:phone - Update commitment status by phone
router.patch('/commitment/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const { hasCommitted } = req.body;

    // Find patient in Diet Plan table
    const records = await base(TABLES.DIET_PLANS)
      .select({
        filterByFormula: `{Phone Number} = '${phone}'`,
        maxRecords: 1
      })
      .firstPage();

    if (records.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Update commitment status
    await base(TABLES.DIET_PLANS).update([
      {
        id: records[0].id,
        fields: {
          'Has Committed': hasCommitted
        }
      }
    ]);

    res.json({
      success: true,
      message: 'Commitment status updated'
    });
  } catch (error) {
    console.error('Update commitment error:', error);
    res.status(500).json({ error: 'Failed to update commitment' });
  }
});

// Helper to get patient products
async function getPatientProducts(patientId) {
  try {
    const records = await base(TABLES.PRODUCTS)
      .select({
        filterByFormula: `{Patient} = '${patientId}'`,
        fields: ['Product Name', 'Category', 'Instructions']
      })
      .all();

    return records.map(record => ({
      id: record.id,
      name: record.fields['Product Name'] || '',
      category: record.fields['Category'] || 'Both',
      instructions: record.fields['Instructions'] || ''
    }));
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
}

// Helper to get diet plan
async function getDietPlan(dietPlanIds) {
  if (!dietPlanIds || dietPlanIds.length === 0) {
    return null;
  }

  try {
    const record = await base(TABLES.DIET_PLANS).find(dietPlanIds[0]);
    
    // Get dietician details from Team table
    let dieticianDetails = {
      dieticianName: '',
      dieticianPhone: '',
      dieticianEmail: '',
      dieticianWhatsApp: ''
    };
    
    try {
      const teamRecords = await base(TABLES.TEAM)
        .select({
          filterByFormula: `{Department} = 'Dietician'`,
          maxRecords: 1
        })
        .firstPage();
      
      if (teamRecords.length > 0) {
        const dietician = teamRecords[0].fields;
        dieticianDetails = {
          dieticianName: dietician['Name'] || '',
          dieticianPhone: dietician['Phone Number'] || '',
          dieticianEmail: dietician['Email'] || '',
          dieticianWhatsApp: dietician['WhatsApp'] || ''
        };
      }
    } catch (teamError) {
      console.error('Error fetching dietician from Team table:', teamError);
    }
    
    return {
      id: record.id,
      version: record.fields['Version'] || '',
      category: record.fields['Category'] || '',
      restrictions: record.fields['Restrictions'] ? record.fields['Restrictions'].split(',').map(r => r.trim()) : [],
      recommendations: record.fields['Recommendations'] ? record.fields['Recommendations'].split(',').map(r => r.trim()) : [],
      // Dietician details from Team table
      ...dieticianDetails,
      notes: record.fields['Notes'] || '',
      mealPlan: record.fields['Meal Plan'] || ''
    };
  } catch (error) {
    console.error('Error fetching diet plan:', error);
    return null;
  }
}

module.exports = router;
