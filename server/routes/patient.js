const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const Product = require('../models/Product');
const DietPlan = require('../models/DietPlan');

// GET /api/patient/:phone - Get patient details by phone number
router.get('/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    
    // Find patient by phone number (support both field names for migration)
    const patient = await Patient.findOne({
      $or: [
        { phoneNumber: phone },
        { phone: phone }
      ]
    })
    .populate('dietPlan')
    .populate('products');

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Get products for this patient
    const products = await Product.find({ patient: patient._id });

    // Return patient data
    res.json({
      id: patient._id,
      name: patient.name || patient.fullName,
      email: patient.email || '',
      phone: patient.phone || patient.phoneNumber,
      concern: patient.skinConcern || '',
      planType: patient.planType || 'Basic',
      startDate: patient.startDate,
      coachName: patient.coachName || '',
      coachWhatsApp: patient.coachWhatsApp || '',
      hasCommitted: patient.hasCommitted || false,
      totalPoints: patient.totalPoints || 0,
      level: patient.level || 1,
      achievements: patient.achievements || [],
      currentDay: patient.currentDay || 1,
      completionPercentage: patient.completionPercentage || 0,
      profile: patient.profile || {},
      preferences: patient.preferences || {},
      // Diet plan details
      dietPlan: patient.dietPlan || null,
      // Products array
      products: products.map(product => ({
        id: product._id,
        name: product.name,
        category: product.category,
        instructions: product.instructions
      }))
    });
  } catch (error) {
    console.error('Fetch patient error:', error);
    res.status(500).json({ error: 'Failed to fetch patient data' });
  }
});

// PUT /api/patient/:phone - Update patient details
router.put('/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const updates = req.body;

    // Find patient by phone number
    const patient = await Patient.findOne({
      $or: [
        { phoneNumber: phone },
        { phone: phone }
      ]
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Update patient fields
    const allowedUpdates = [
      'fullName', 'name', 'email', 'phoneNumber', 'phone',
      'skinConcern', 'planType', 'startDate', 'coachName', 'coachWhatsApp',
      'hasCommitted', 'commitment', 'isActive', 'profile', 'preferences'
    ];

    const updateData = {};
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updateData[key] = updates[key];
      }
    });

    // Handle both phone field names
    if (updates.phoneNumber) {
      updateData.phoneNumber = updates.phoneNumber;
      updateData.phone = updates.phoneNumber;
    }

    const updatedPatient = await Patient.findByIdAndUpdate(
      patient._id,
      { ...updateData, updatedAt: new Date() },
      { new: true }
    ).populate('dietPlan').populate('products');

    res.json({
      success: true,
      patient: {
        id: updatedPatient._id,
        name: updatedPatient.name || updatedPatient.fullName,
        email: updatedPatient.email || '',
        phone: updatedPatient.phone || updatedPatient.phoneNumber,
        concern: updatedPatient.skinConcern || '',
        planType: updatedPatient.planType || 'Basic',
        startDate: updatedPatient.startDate,
        coachName: updatedPatient.coachName || '',
        coachWhatsApp: updatedPatient.coachWhatsApp || '',
        hasCommitted: updatedPatient.hasCommitted || false,
        totalPoints: updatedPatient.totalPoints || 0,
        level: updatedPatient.level || 1,
        achievements: updatedPatient.achievements || [],
        currentDay: updatedPatient.currentDay || 1,
        completionPercentage: updatedPatient.completionPercentage || 0,
        profile: updatedPatient.profile || {},
        preferences: updatedPatient.preferences || {},
        dietPlan: updatedPatient.dietPlan || null
      }
    });
  } catch (error) {
    console.error('Update patient error:', error);
    res.status(500).json({ error: 'Failed to update patient data' });
  }
});

// POST /api/patient/:phone/products - Add product for patient
router.post('/:phone/products', async (req, res) => {
  try {
    const { phone } = req.params;
    const { name, category, instructions } = req.body;

    // Find patient by phone number
    const patient = await Patient.findOne({
      $or: [
        { phoneNumber: phone },
        { phone: phone }
      ]
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Create new product
    const product = new Product({
      name: name || 'Product',
      category: category || 'Both',
      instructions: instructions || 'Use as directed',
      patient: patient._id
    });

    await product.save();

    // Update patient's products array
    await Patient.findByIdAndUpdate(
      patient._id,
      { $push: { products: product._id } }
    );

    res.json({
      success: true,
      product: {
        id: product._id,
        name: product.name,
        category: product.category,
        instructions: product.instructions
      }
    });
  } catch (error) {
    console.error('Add product error:', error);
    res.status(500).json({ error: 'Failed to add product' });
  }
});

// DELETE /api/patient/:phone/products/:productId - Remove product
router.delete('/:phone/products/:productId', async (req, res) => {
  try {
    const { phone, productId } = req.params;

    // Find patient by phone number
    const patient = await Patient.findOne({
      $or: [
        { phoneNumber: phone },
        { phone: phone }
      ]
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Remove product
    await Product.findByIdAndDelete(productId);

    // Update patient's products array
    await Patient.findByIdAndUpdate(
      patient._id,
      { $pull: { products: productId } }
    );

    res.json({
      success: true,
      message: 'Product removed successfully'
    });
  } catch (error) {
    console.error('Remove product error:', error);
    res.status(500).json({ error: 'Failed to remove product' });
  }
});

// POST /api/patient/:phone/diet-plan - Set diet plan for patient
router.post('/:phone/diet-plan', async (req, res) => {
  try {
    const { phone } = req.params;
    const { version, category, restrictions, recommendations, notes } = req.body;

    // Find patient by phone number
    const patient = await Patient.findOne({
      $or: [
        { phoneNumber: phone },
        { phone: phone }
      ]
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Create or update diet plan
    let dietPlan;
    if (patient.dietPlan) {
      // Update existing diet plan
      dietPlan = await DietPlan.findByIdAndUpdate(
        patient.dietPlan,
        {
          version: version || 'Standard',
          category: category || 'General',
          restrictions: restrictions || [],
          recommendations: recommendations || [],
          notes: notes || '',
          updatedAt: new Date()
        },
        { new: true }
      );
    } else {
      // Create new diet plan
      dietPlan = new DietPlan({
        version: version || 'Standard',
        category: category || 'General',
        restrictions: restrictions || [],
        recommendations: recommendations || [],
        notes: notes || ''
      });
      await dietPlan.save();

      // Update patient with diet plan reference
      await Patient.findByIdAndUpdate(
        patient._id,
        { dietPlan: dietPlan._id }
      );
    }

    res.json({
      success: true,
      dietPlan: {
        id: dietPlan._id,
        version: dietPlan.version,
        category: dietPlan.category,
        restrictions: dietPlan.restrictions,
        recommendations: dietPlan.recommendations,
        notes: dietPlan.notes
      }
    });
  } catch (error) {
    console.error('Set diet plan error:', error);
    res.status(500).json({ error: 'Failed to set diet plan' });
  }
});

module.exports = router;
