import { openDB } from 'idb';

const DB_NAME = 'gleuhr-db';
const DB_VERSION = 1;

let db = null;

export async function initDB() {
  if (db) return db;
  
  db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // Checkins store
      if (!db.objectStoreNames.contains('checkins')) {
        const checkinStore = db.createObjectStore('checkins', { keyPath: 'id' });
        checkinStore.createIndex('by-date', 'date');
        checkinStore.createIndex('by-email', 'patientEmail');
        checkinStore.createIndex('by-synced', 'synced');
      }
      
      // Skin scores store
      if (!db.objectStoreNames.contains('skinScores')) {
        const scoreStore = db.createObjectStore('skinScores', { keyPath: 'id' });
        scoreStore.createIndex('by-day', 'day');
        scoreStore.createIndex('by-email', 'patientEmail');
      }
      
      // Weekly photos store
      if (!db.objectStoreNames.contains('weeklyPhotos')) {
        const photoStore = db.createObjectStore('weeklyPhotos', { keyPath: 'id' });
        photoStore.createIndex('by-week', 'week');
        photoStore.createIndex('by-email', 'patientEmail');
      }
      
      // Sync queue store
      if (!db.objectStoreNames.contains('syncQueue')) {
        const queueStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
        queueStore.createIndex('by-created', 'createdAt');
      }
    },
  });
  
  return db;
}

// CheckIn operations
export async function saveCheckIn(checkIn) {
  const database = await initDB();
  await database.put('checkins', checkIn);
}

export async function getCheckIns(email) {
  const database = await initDB();
  if (email) {
    return database.getAllFromIndex('checkins', 'by-email', email);
  }
  return database.getAll('checkins');
}

export async function getTodayCheckIn(email) {
  const database = await initDB();
  const today = new Date().toISOString().split('T')[0];
  const checkins = await database.getAllFromIndex('checkins', 'by-email', email);
  return checkins.find(c => c.date === today);
}

export async function getUnsyncedCheckIns() {
  const database = await initDB();
  return database.getAllFromIndex('checkins', 'by-synced', false);
}

// Skin Score operations
export async function saveSkinScore(score) {
  const database = await initDB();
  await database.put('skinScores', score);
}

export async function getSkinScores(email) {
  const database = await initDB();
  if (email) {
    return database.getAllFromIndex('skinScores', 'by-email', email);
  }
  return database.getAll('skinScores');
}

// Weekly Photo operations
export async function saveWeeklyPhoto(photo) {
  const database = await initDB();
  await database.put('weeklyPhotos', photo);
}

export async function getWeeklyPhotos(email) {
  const database = await initDB();
  if (email) {
    return database.getAllFromIndex('weeklyPhotos', 'by-email', email);
  }
  return database.getAll('weeklyPhotos');
}

// Sync Queue operations
export async function addToSyncQueue(item) {
  const database = await initDB();
  await database.put('syncQueue', item);
}

export async function getSyncQueue() {
  const database = await initDB();
  return database.getAllFromIndex('syncQueue', 'by-created');
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
