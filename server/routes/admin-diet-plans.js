const express = require('express');
const router = express.Router();
const { fetchDietPlans, fetchDietPlanById } = require('../services/airtableService');

// GET /api/admin/diet-plans - List all diet plans from Airtable
router.get('/', async (req, res) => {
  try {
    const { status, phone } = req.query;
    const plans = await fetchDietPlans({
      filterByStatus: status || undefined,
      customerPhone: phone || undefined
    });
    res.json({ success: true, count: plans.length, data: plans });
  } catch (error) {
    console.error('Admin diet plans fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch diet plans from Airtable',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/admin/diet-plans/:id - Get a single diet plan by Airtable record ID
router.get('/:id', async (req, res) => {
  try {
    const plan = await fetchDietPlanById(req.params.id);
    res.json({ success: true, data: plan });
  } catch (error) {
    console.error('Admin diet plan fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch diet plan from Airtable',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
