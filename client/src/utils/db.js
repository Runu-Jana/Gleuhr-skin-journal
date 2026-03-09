import { openDB } from 'idb';

const DB_NAME = 'gleuhr-db';
const DB_VERSION = 3; // Increment to force schema upgrade

let db = null;

export async function initDB() {
  if (db) return db;
  
  db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      console.log(`Upgrading database from version ${oldVersion} to ${newVersion}`);
      
      // Main Patients collection
      if (!db.objectStoreNames.contains('patients')) {
        const patientStore = db.createObjectStore('patients', { keyPath: 'id' });
        patientStore.createIndex('by-phone', 'phone');
      }
      
      // Checkins store (linked to patient)
      if (!db.objectStoreNames.contains('checkins')) {
        const checkinStore = db.createObjectStore('checkins', { keyPath: 'id' });
        checkinStore.createIndex('by-date', 'date');
        checkinStore.createIndex('by-patient', 'patientId');
      } else {
        // Update existing checkins store to add new index
        const checkinStore = transaction.objectStore('checkins');
        if (!checkinStore.indexNames.contains('by-patient')) {
          checkinStore.createIndex('by-patient', 'patientId');
        }
      }
      
      // Diet Plans store (linked to patient)
      if (!db.objectStoreNames.contains('dietPlans')) {
        const dietStore = db.createObjectStore('dietPlans', { keyPath: 'id' });
        dietStore.createIndex('by-patient', 'patientId');
        dietStore.createIndex('by-date', 'createdAt');
      }
      
      // Products store (linked to patient)
      if (!db.objectStoreNames.contains('products')) {
        const productStore = db.createObjectStore('products', { keyPath: 'id' });
        productStore.createIndex('by-patient', 'patientId');
      }
      
      // Skin Scores store (linked to patient)
      if (!db.objectStoreNames.contains('skinScores')) {
        const scoreStore = db.createObjectStore('skinScores', { keyPath: 'id' });
        scoreStore.createIndex('by-patient', 'patientId');
        scoreStore.createIndex('by-date', 'date');
      } else {
        // Update existing skinScores store to add new index
        const scoreStore = transaction.objectStore('skinScores');
        if (!scoreStore.indexNames.contains('by-patient')) {
          scoreStore.createIndex('by-patient', 'patientId');
        }
      }
      
      // Streaks store (linked to patient)
      if (!db.objectStoreNames.contains('streaks')) {
        const streakStore = db.createObjectStore('streaks', { keyPath: 'id' });
        streakStore.createIndex('by-patient', 'patientId');
        streakStore.createIndex('by-date', 'date');
      }
      
      // Weekly Photos store (linked to patient)
      if (!db.objectStoreNames.contains('weeklyPhotos')) {
        const photoStore = db.createObjectStore('weeklyPhotos', { keyPath: 'id' });
        photoStore.createIndex('by-patient', 'patientId');
        photoStore.createIndex('by-date', 'date');
      } else {
        // Update existing weeklyPhotos store to add new index
        const photoStore = transaction.objectStore('weeklyPhotos');
        if (!photoStore.indexNames.contains('by-patient')) {
          photoStore.createIndex('by-patient', 'patientId');
        }
      }
      
      // Dieticians store (for admin dashboard)
      if (!db.objectStoreNames.contains('dieticians')) {
        const dieticianStore = db.createObjectStore('dieticians', { keyPath: 'id' });
        dieticianStore.createIndex('by-phone', 'phone');
        dieticianStore.createIndex('by-email', 'email');
      }
      
      // Sync Queue store (for offline operations)
      if (!db.objectStoreNames.contains('syncQueue')) {
        const syncQueueStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
        syncQueueStore.createIndex('by-created', 'createdAt');
      }
    }
  });

  return db;
}

// Function to completely clear and reset the database
export async function clearDatabase() {
  console.log('🧹 Clearing entire database...');
  if (db) {
    db.close();
    db = null;
  }
  
  // Delete the entire database
  await indexedDB.deleteDatabase(DB_NAME);
  console.log('✅ Database cleared successfully');
  
  // Reinitialize with new structure
  await initDB();
  console.log('🆕 Database reinitialized with new structure');
}

// ============ PATIENT OPERATIONS ============
export async function savePatient(patient) {
  const database = await initDB();
  
  const existingPatient = await database.getFromIndex('patients', 'by-phone', patient.phone);
  
  if (existingPatient) {
    // Update existing patient
    await database.put('patients', { ...existingPatient, ...patient });
  } else {
    // Create new patient
    await database.add('patients', {
      id: patient.id || `patient_${Date.now()}`,
      ...patient,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
}

export async function getPatient(phone) {
  if (!phone) {
    return null;
  }
  
  const database = await initDB();
  try {
    return await database.getFromIndex('patients', 'by-phone', phone);
  } catch (error) {
    console.error('Error getting patient:', error);
    return null;
  }
}

// ============ CHECKIN OPERATIONS ============
export async function saveCheckIn(checkIn) {
  const database = await initDB();
  await database.put('checkins', {
    id: checkIn.id || `checkin_${Date.now()}`,
    ...checkIn,
    createdAt: new Date().toISOString()
  });
}

export async function getCheckIns(patientId) {
  const database = await initDB();
  return database.getAllFromIndex('checkins', 'by-patient', patientId);
}

export async function getTodayCheckIn(patientId) {
  const database = await initDB();
  const today = new Date().toISOString().split('T')[0];
  const allCheckIns = await database.getAllFromIndex('checkins', 'by-patient', patientId);
  return allCheckIns.find(checkIn => checkIn.date === today);
}

// ============ DIET PLAN OPERATIONS ============
export async function saveDietPlan(dietPlan) {
  const database = await initDB();
  await database.add('dietPlans', {
    id: dietPlan.id || `diet_${Date.now()}`,
    ...dietPlan,
    createdAt: new Date().toISOString()
  });
}

export async function getDietPlans(patientId) {
  const database = await initDB();
  return database.getAllFromIndex('dietPlans', 'by-patient', patientId);
}

// ============ PRODUCT OPERATIONS ============
export async function saveProduct(product) {
  const database = await initDB();
  await database.add('products', {
    id: product.id || `product_${Date.now()}`,
    ...product,
    createdAt: new Date().toISOString()
  });
}

export async function getProducts(patientId) {
  const database = await initDB();
  return database.getAllFromIndex('products', 'by-patient', patientId);
}

// ============ SKIN SCORE OPERATIONS ============
export async function saveSkinScore(score) {
  const database = await initDB();
  await database.put('skinScores', {
    id: score.id || `score_${Date.now()}`,
    ...score,
    createdAt: new Date().toISOString()
  });
}

export async function getSkinScores(patientId) {
  const database = await initDB();
  return database.getAllFromIndex('skinScores', 'by-patient', patientId);
}

export async function getLatestSkinScore(patientId) {
  const database = await initDB();
  const scores = await database.getAllFromIndex('skinScores', 'by-patient', patientId);
  if (scores.length === 0) return null;
  
  // Sort by date descending and get the latest
  return scores.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
}

// ============ STREAK OPERATIONS ============
export async function saveStreak(streak) {
  const database = await initDB();
  await database.add('streaks', {
    id: streak.id || `streak_${Date.now()}`,
    ...streak,
    createdAt: new Date().toISOString()
  });
}

export async function getStreaks(patientId) {
  const database = await initDB();
  return database.getAllFromIndex('streaks', 'by-patient', patientId);
}

export async function getCurrentStreak(patientId) {
  const database = await initDB();
  const streaks = await database.getAllFromIndex('streaks', 'by-patient', patientId);
  if (streaks.length === 0) return null;
  
  // Sort by date descending and get the latest
  return streaks.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
}

// ============ WEEKLY PHOTO OPERATIONS ============
export async function saveWeeklyPhoto(photo) {
  const database = await initDB();
  await database.add('weeklyPhotos', {
    id: photo.id || `photo_${Date.now()}`,
    ...photo,
    createdAt: new Date().toISOString()
  });
}

export async function getWeeklyPhotos(patientId) {
  const database = await initDB();
  return database.getAllFromIndex('weeklyPhotos', 'by-patient', patientId);
}

// ============ DIETICIAN OPERATIONS ============
export async function saveDietician(dietician) {
  const database = await initDB();
  const existingDietician = await database.getFromIndex('dieticians', 'by-phone', dietician.phone);
  
  if (existingDietician) {
    // Update existing dietician
    await database.put('dieticians', { ...existingDietician, ...dietician });
  } else {
    // Create new dietician
    await database.add('dieticians', {
      id: dietician.id || `dietician_${Date.now()}`,
      ...dietician,
      createdAt: new Date().toISOString()
    });
  }
}

export async function getDietician(phone) {
  const database = await initDB();
  return database.getFromIndex('dieticians', 'by-phone', phone);
}

export async function getAllDieticians() {
  const database = await initDB();
  return database.getAll('dieticians');
}

// ============ BACKWARD COMPATIBILITY ============
// Keep old functions for now, but update them to use new structure
export async function getTodayCheckInLegacy(phone) {
  // For backward compatibility, try to get patient first
  const patient = await getPatient(phone);
  if (patient) {
    return getTodayCheckIn(patient.id);
  }
  return null;
}



// Fetch photos from MongoDB API
export async function fetchWeeklyPhotosFromServer(patientPhone) {
  try {
    const response = await fetch(`/api/photo/${patientPhone}`);
    if (!response.ok) {
      throw new Error('Failed to fetch photos from server');
    }
    const photos = await response.json();
    return photos;
  } catch (error) {
    console.error('Error fetching photos from server:', error);
    return [];
  }
}

// Sync Queue operations
export async function addToSyncQueue(item) {
  const database = await initDB();
  await database.put('syncQueue', item);
}

export async function getSyncQueue() {
  const database = await initDB();
  try {
    return database.getAllFromIndex('syncQueue', 'by-created');
  } catch (error) {
    // Fallback: try getting all items if index doesn't exist
    console.warn('SyncQueue index not found, trying fallback method:', error);
    return database.getAll('syncQueue');
  }
}

export async function removeFromSyncQueue(id) {
  const database = await initDB();
  await database.delete('syncQueue', id);
}

export async function updateSyncRetry(id, retries) {
  const database = await initDB();
  const item = await database.get('syncQueue', id);
  if (item) {
    item.retries = retries;
    await database.put('syncQueue', item);
  }
}

export async function clearSyncQueue() {
  const database = await initDB();
  const items = await database.getAll('syncQueue');
  for (const item of items) {
    await database.delete('syncQueue', item.id);
  }
}
