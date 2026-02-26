import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const OfflineContext = createContext();

export function OfflineProvider({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncData();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load pending count from IndexedDB on mount
  useEffect(() => {
    updatePendingCount();
  }, []);

  const updatePendingCount = async () => {
    try {
      const { getSyncQueue } = await import('../utils/db');
      const queue = await getSyncQueue();
      setPendingCount(queue.length);
    } catch (error) {
      console.error('Error updating pending count:', error);
    }
  };

  const queueForSync = useCallback(async (type, data) => {
    try {
      const { addToSyncQueue } = await import('../utils/db');
      await addToSyncQueue({
        id: data.id || Date.now().toString(),
        type,
        data,
        retries: 0,
        createdAt: new Date().toISOString()
      });
      await updatePendingCount();
    } catch (error) {
      console.error('Error queueing for sync:', error);
    }
  }, []);

  const syncData = useCallback(async () => {
    if (!navigator.onLine) return;
    
    setIsSyncing(true);
    try {
      const { getSyncQueue, removeFromSyncQueue, updateSyncRetry } = await import('../utils/db');
      const queue = await getSyncQueue();

      for (const item of queue) {
        try {
          let success = false;
          
          if (item.type === 'checkin') {
            await axios.post('/api/checkin', item.data);
            success = true;
          } else if (item.type === 'skinScore') {
            await axios.post('/api/skinscore', item.data);
            success = true;
          } else if (item.type === 'weeklyPhoto') {
            await axios.post('/api/photo', item.data);
            success = true;
          }

          if (success) {
            await removeFromSyncQueue(item.id);
          } else if (item.retries < 3) {
            await updateSyncRetry(item.id, item.retries + 1);
          } else {
            await removeFromSyncQueue(item.id);
          }
        } catch (error) {
          console.error('Sync error for item:', item.id, error);
          if (item.retries < 3) {
            await updateSyncRetry(item.id, item.retries + 1);
          } else {
            await removeFromSyncQueue(item.id);
          }
        }
      }

      await updatePendingCount();
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const trackReorderClick = async (day) => {
    try {
      await axios.post('/api/reorder/click', {
        day,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Track reorder click error:', error);
    }
  };

  const value = {
    isOnline,
    isSyncing,
    pendingCount,
    queueForSync,
    forceSync: syncData,
    trackReorderClick,
  };

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) throw new Error('useOffline must be used within OfflineProvider');
  return context;
};
