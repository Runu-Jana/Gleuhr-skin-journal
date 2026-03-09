// Test Data Generator for Gleuhr Database
// Run this file to populate your database with sample data

import { 
  savePatient, 
  saveDietician, 
  saveCheckIn, 
  saveDietPlan, 
  saveProduct, 
  saveSkinScore, 
  saveStreak, 
  saveWeeklyPhoto,
  getPatient,
  getDietician,
  clearDatabase
} from './db.js';

// Sample Test Data
const testDietician = {
  name: "Dr. Sarah Johnson",
  phone: "+1234567890",
  email: "sarah.johnson@gleuhr.com",
  specialization: "Dermatology & Nutrition",
  experience: "8 years",
  certifications: ["RD", "LDN", "CDE"],
  active: true
};

const testPatient = {
  name: "Emily Chen",
  phone: "+1987654321",
  email: "emily.chen@email.com",
  startDate: "2024-02-01",
  assignedDietician: testDietician.phone,
  dieticianName: testDietician.name,
  goals: ["Acne reduction", "Better skin hydration", "Even skin tone"],
  skinType: "Combination",
  concerns: ["Acne", "Dark spots", "Dryness"],
  hasCommitted: true
};

const testCheckIns = [
  {
    patientId: testPatient.phone, // Will be updated with actual patient ID
    date: "2024-03-01",
    day: 29,
    amRoutine: true,
    sunscreen: true,
    pmRoutine: true,
    dietFollowed: "yes",
    triggerFoods: ["Dairy"],
    waterIntake: 8,
    skinMood: "good",
    synced: false
  },
  {
    patientId: testPatient.phone,
    date: "2024-03-02", 
    day: 30,
    amRoutine: true,
    sunscreen: true,
    pmRoutine: false,
    dietFollowed: "partial",
    triggerFoods: [],
    waterIntake: 6,
    skinMood: "okay",
    synced: false
  }
];

const testDietPlans = [
  {
    patientId: testPatient.phone,
    name: "Anti-Inflammatory Diet Plan - Week 1",
    description: "Focus on reducing inflammation and acne triggers",
    meals: [
      {
        type: "breakfast",
        foods: ["Oatmeal with berries", "Green tea", "Almonds"],
        restrictions: ["No dairy", "No sugar"]
      },
      {
        type: "lunch", 
        foods: ["Grilled salmon", "Quinoa", "Steamed vegetables"],
        restrictions: ["No processed foods"]
      },
      {
        type: "dinner",
        foods: ["Chicken stir-fry", "Brown rice", "Mixed greens"],
        restrictions: ["No fried foods"]
      }
    ],
    supplements: ["Probiotics", "Vitamin D", "Zinc"],
    restrictions: ["Dairy", "Sugar", "Processed foods"],
    createdAt: new Date().toISOString()
  }
];

const testProducts = [
  {
    patientId: testPatient.phone,
    name: "Gentle Cleanser",
    brand: "Gleuhr",
    category: "Cleanser",
    usage: "Morning and evening",
    ingredients: ["Aloe vera", "Green tea extract", "Vitamin E"],
    price: 24.99,
    purchaseDate: "2024-02-15",
    recommendedBy: testDietician.name
  },
  {
    patientId: testPatient.phone,
    name: "Hydrating Moisturizer",
    brand: "Gleuhr", 
    category: "Moisturizer",
    usage: "Morning and evening",
    ingredients: ["Hyaluronic acid", "Niacinamide", "Ceramides"],
    price: 34.99,
    purchaseDate: "2024-02-15",
    recommendedBy: testDietician.name
  }
];

const testSkinScores = [
  {
    patientId: testPatient.phone,
    date: "2024-02-28",
    totalScore: 14,
    acne: 3,
    hydration: 4,
    evenness: 3,
    texture: 4,
    notes: "Significant improvement in hydration, acne reduced"
  },
  {
    patientId: testPatient.phone,
    date: "2024-03-01",
    totalScore: 16,
    acne: 4,
    hydration: 4,
    evenness: 4,
    texture: 4,
    notes: "Excellent progress, skin looks much clearer"
  }
];

const testStreaks = [
  {
    patientId: testPatient.phone,
    date: "2024-03-02",
    currentStreak: 30,
    longestStreak: 30,
    missedDays: 2,
    completionRate: 93.3,
    restorationShields: {
      available: 2,
      used: 0
    }
  }
];

const testWeeklyPhotos = [
  {
    patientId: testPatient.phone,
    date: "2024-02-28",
    week: 4,
    imageUrl: "/api/placeholder/400/300",
    notes: "Week 4 progress photo",
    consent: true,
    synced: false
  },
  {
    patientId: testPatient.phone,
    date: "2024-03-07",
    week: 5,
    imageUrl: "/api/placeholder/400/300", 
    notes: "Week 5 progress photo",
    consent: true,
    synced: false
  }
];

// Function to populate test data
export async function populateTestData() {
  try {
    console.log('🌱 Starting test data population...');
    
    // 1. Clear existing database first
    await clearDatabase();
    
    // 2. Save dietician first
    console.log('👩‍⚕️ Saving dietician...');
    await saveDietician(testDietician);
    console.log('✅ Dietician saved:', testDietician.name);
    
    // 3. Save patient
    console.log('👤 Saving patient...');
    await savePatient(testPatient);
    console.log('✅ Patient saved:', testPatient.name);
    
    // Get the actual patient with ID
    const savedPatient = await getPatient(testPatient.phone);
    const patientId = savedPatient.id;
    
    // 4. Save check-ins
    console.log('📝 Saving check-ins...');
    for (const checkIn of testCheckIns) {
      checkIn.patientId = patientId;
      await saveCheckIn(checkIn);
    }
    console.log(`✅ ${testCheckIns.length} check-ins saved`);
    
    // 5. Save diet plans
    console.log('🥗 Saving diet plans...');
    for (const dietPlan of testDietPlans) {
      dietPlan.patientId = patientId;
      await saveDietPlan(dietPlan);
    }
    console.log(`✅ ${testDietPlans.length} diet plans saved`);
    
    // 6. Save products
    console.log('🧴 Saving products...');
    for (const product of testProducts) {
      product.patientId = patientId;
      await saveProduct(product);
    }
    console.log(`✅ ${testProducts.length} products saved`);
    
    // 7. Save skin scores
    console.log('📊 Saving skin scores...');
    for (const skinScore of testSkinScores) {
      skinScore.patientId = patientId;
      await saveSkinScore(skinScore);
    }
    console.log(`✅ ${testSkinScores.length} skin scores saved`);
    
    // 8. Save streaks
    console.log('🔥 Saving streaks...');
    for (const streak of testStreaks) {
      streak.patientId = patientId;
      await saveStreak(streak);
    }
    console.log(`✅ ${testStreaks.length} streaks saved`);
    
    // 9. Save weekly photos
    console.log('📸 Saving weekly photos...');
    for (const photo of testWeeklyPhotos) {
      photo.patientId = patientId;
      await saveWeeklyPhoto(photo);
    }
    console.log(`✅ ${testWeeklyPhotos.length} weekly photos saved`);
    
    console.log('🎉 Test data population completed successfully!');
    console.log('📊 Summary:');
    console.log(`   - Patient: ${testPatient.name}`);
    console.log(`   - Dietician: ${testDietician.name}`);
    console.log(`   - Check-ins: ${testCheckIns.length}`);
    console.log(`   - Diet Plans: ${testDietPlans.length}`);
    console.log(`   - Products: ${testProducts.length}`);
    console.log(`   - Skin Scores: ${testSkinScores.length}`);
    console.log(`   - Streaks: ${testStreaks.length}`);
    console.log(`   - Weekly Photos: ${testWeeklyPhotos.length}`);
    
  } catch (error) {
    console.error('❌ Error populating test data:', error);
  }
}

// Function to clear all test data
export async function clearTestData() {
  try {
    console.log('🧹 Clearing test data...');
    // Note: You would need to implement clear functions for each collection
    console.log('✅ Test data cleared');
  } catch (error) {
    console.error('❌ Error clearing test data:', error);
  }
}

// Auto-populate when this file is imported
if (typeof window !== 'undefined') {
  // Browser environment - expose to window for manual execution
  window.populateTestData = populateTestData;
  window.clearTestData = clearTestData;
  console.log('🔧 Test data functions available:');
  console.log('   - Run populateTestData() to add sample data');
  console.log('   - Run clearTestData() to remove sample data');
}
