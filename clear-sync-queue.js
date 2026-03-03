// Clear sync queue script
const { openDB } = require('idb');

const DB_NAME = 'gleuhr-db';
const DB_VERSION = 1;

async function clearSyncQueue() {
  try {
    const db = await openDB(DB_NAME, DB_VERSION);
    const tx = db.transaction('syncQueue', 'readwrite');
    const store = tx.objectStore('syncQueue');
    await store.clear();
    console.log('Sync queue cleared successfully!');
    db.close();
  } catch (error) {
    console.error('Error clearing sync queue:', error);
  }
}

clearSyncQueue();
