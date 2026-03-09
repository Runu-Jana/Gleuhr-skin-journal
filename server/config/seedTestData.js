const Patient = require('../models/Patient');

const seedTestData = async () => {
  try {
    const testPhone = '+919999999999';
    const existing = await Patient.findOne({
      $or: [{ phoneNumber: testPhone }, { phone: testPhone }]
    });

    if (existing) {
      console.log('Test patient already exists:', testPhone);
      return;
    }

    await Patient.create({
      name: 'Test User',
      phoneNumber: testPhone,
      phone: testPhone,
      email: 'test@gleuhr.com',
      skinConcern: 'Acne',
      planType: 'Basic',
      startDate: new Date(),
      coachName: 'Dr. Gleuhr',
      coachWhatsApp: '+919876543210',
      hasCommitted: false,
      isActive: true
    });

    console.log('Test patient seeded successfully.');
    console.log('Login with phone: 9999999999 (country code +91)');
    console.log('Verification code: 123456');
  } catch (error) {
    console.error('Error seeding test data:', error.message);
  }
};

module.exports = seedTestData;
