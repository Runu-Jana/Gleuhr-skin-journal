import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const [permission, setPermission] = useState('default');
  const [notifications, setNotifications] = useState([]);
  const { patient, isAuthenticated } = useAuth();

  // Request notification permission
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    return result === 'granted';
  }, []);

  // Check permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Schedule daily check-in reminder
  const scheduleCheckInReminder = useCallback(() => {
    if (!isAuthenticated || !patient) return;

    const now = new Date();
    const reminderTime = new Date();
    reminderTime.setHours(20, 0, 0, 0); // 8 PM reminder

    // If reminder time has passed today, schedule for tomorrow
    if (reminderTime <= now) {
      reminderTime.setDate(reminderTime.getDate() + 1);
    }

    const timeUntilReminder = reminderTime - now;

    setTimeout(() => {
      if (permission === 'granted') {
        new Notification('Gleuhr - Daily Check-in Reminder', {
          body: 'Don\'t forget to complete your daily skincare journal! 🌟',
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          tag: 'daily-checkin',
          requireInteraction: true,
          actions: [
            {
              action: 'checkin',
              title: 'Check In Now'
            },
            {
              action: 'dismiss',
              title: 'Later'
            }
          ]
        });
      }
    }, timeUntilReminder);
  }, [isAuthenticated, patient, permission]);

  // Schedule weekly photo reminder
  const scheduleWeeklyPhotoReminder = useCallback(() => {
    if (!isAuthenticated || !patient) return;

    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    const daysUntilSunday = (7 - dayOfWeek) % 7 || 7;
    
    const nextSunday = new Date(now);
    nextSunday.setDate(now.getDate() + daysUntilSunday);
    nextSunday.setHours(10, 0, 0, 0); // 10 AM Sunday

    const timeUntilReminder = nextSunday - now;

    setTimeout(() => {
      if (permission === 'granted') {
        new Notification('Gleuhr - Weekly Photo Time! 📸', {
          body: 'Time for your weekly progress photo. Track your transformation journey!',
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          tag: 'weekly-photo',
          requireInteraction: true,
          actions: [
            {
              action: 'photo',
              title: 'Take Photo'
            },
            {
              action: 'dismiss',
              title: 'Later'
            }
          ]
        });
      }
    }, timeUntilReminder);
  }, [isAuthenticated, patient, permission]);

  // Show milestone achievement notification
  const showMilestoneNotification = useCallback((milestone) => {
    if (permission !== 'granted') return;

    const messages = {
      '7-day': '🎉 One week complete! Your skin is thanking you!',
      '14-day': '🌟 Two weeks down! You\'re building amazing habits!',
      '30-day': '🏆 One month complete! Incredible dedication!',
      '60-day': '💫 Two months! Your transformation is showing!',
      '90-day': '👑 90 days! You\'re a skincare champion!'
    };

    new Notification('Gleuhr - Milestone Achieved! 🎯', {
      body: messages[milestone] || 'Keep up the amazing work!',
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      tag: `milestone-${milestone}`,
      requireInteraction: true
    });
  }, [permission]);

  // Show streak warning notification
  const showStreakWarning = useCallback(() => {
    if (permission !== 'granted') return;

    new Notification('Gleuhr - Don\'t Lose Your Streak! 🔥', {
      body: 'You haven\'t checked in today. Keep your streak alive!',
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      tag: 'streak-warning',
      requireInteraction: true,
      actions: [
        {
          action: 'checkin',
          title: 'Check In Now'
        }
      ]
    });
  }, [permission]);

  // Show achievement notification
  const showAchievementNotification = useCallback((achievement) => {
    if (permission !== 'granted') return;

    new Notification('Gleuhr - Achievement Unlocked! 🏅', {
      body: achievement.description,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      tag: `achievement-${achievement.id}`,
      requireInteraction: true
    });
  }, [permission]);

  // Schedule reminders when user logs in
  useEffect(() => {
    if (isAuthenticated && patient) {
      scheduleCheckInReminder();
      scheduleWeeklyPhotoReminder();
    }
  }, [isAuthenticated, patient, scheduleCheckInReminder, scheduleWeeklyPhotoReminder]);

  // Register service worker for background sync
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PeriodicSyncManager' in window) {
      navigator.serviceWorker.ready.then(registration => {
        return registration.periodicSync.register('daily-checkin', {
          minInterval: 24 * 60 * 60 * 1000 // 24 hours
        });
      }).catch(err => {
        console.log('Periodic sync registration failed:', err);
      });
    }
  }, []);

  const value = {
    permission,
    requestPermission,
    showMilestoneNotification,
    showStreakWarning,
    showAchievementNotification,
    scheduleCheckInReminder,
    scheduleWeeklyPhotoReminder
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
};
