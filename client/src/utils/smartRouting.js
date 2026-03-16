import { getTodayCheckIn, getWeeklyPhotos } from './db';
import { isWeeklyPhotoDay, getWeekNumber } from './helpers';

// Smart routing logic for QR codes and home screen icon
export async function getSmartRoute(patient, currentTime = new Date(), weeklyPhotos = null) {
  if (!patient) return '/login';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get today's check-in status
  const todayCheckIn = await getTodayCheckIn(patient.phoneNumber);
  const amDone = todayCheckIn?.amRoutine || false;
  const pmDone = todayCheckIn?.pmRoutine || false;

  // Get PM reminder time (default to 9:30 PM if not set)
  const pmReminderTime = patient.pmReminderTime || '21:30';
  const [pmHour, pmMinute] = pmReminderTime.split(':').map(Number);

  // Check if current time is before or after PM reminder time
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;
  const pmReminderInMinutes = pmHour * 60 + pmMinute;
  const isBeforePMReminder = currentTimeInMinutes < pmReminderInMinutes;

  // Check if it's a photo day and both routines are done
  const isPhotoDay = isWeeklyPhotoDay(patient.startDate);
  const bothDone = amDone && pmDone;

  // Only redirect to weekly-photo if no photo has been uploaded for this week yet
  if (isPhotoDay && bothDone) {
    const currentWeek = getWeekNumber(patient.startDate);
    // Prefer the already-loaded list (from AuthContext); fall back to IndexedDB
    let photos = weeklyPhotos;
    if (!Array.isArray(photos)) {
      const phone = patient.phone || patient.phoneNumber;
      photos = await getWeeklyPhotos(phone).catch(() => []);
    }
    const alreadyUploaded = photos.some(p => p.week === currentWeek);
    if (!alreadyUploaded) {
      return '/weekly-photo';
    }
  }
  
  if (isBeforePMReminder) {
    // Before PM reminder time
    if (!amDone) {
      // AM not done → AM check-in screen
      return '/amPage';
    } else {
      // AM done → Home dashboard
      return '/';
    }
  } else {
    // After PM reminder time
    if (!pmDone) {
      // PM not done → PM check-in screen (with AM catch-up if needed)
      return '/pmPage';
    } else {
      // PM done → Home dashboard
      return '/';
    }
  }
}

// Deep link routing for WhatsApp reminders
export function getWhatsAppRoute(screenType) {
  switch (screenType) {
    case 'am':
      return '/amPage';  // Direct to AM screen
    case 'pm':
      return '/pmPage';  // Direct to PM screen
    default:
      return '/';        // Default to home (smart routing)
  }
}

// Handle WhatsApp deep link navigation
export function handleWhatsAppDeepLink(screenType) {
  const route = getWhatsAppRoute(screenType);
  return route;
}

// Parse URL parameters for deep links
export function parseDeepLinkParams(url) {
  const params = new URLSearchParams(url.split('?')[1] || '');
  return {
    screen: params.get('screen') || null,
    source: params.get('source') || null,
    patientId: params.get('patientId') || null
  };
}

// Check if current time is in AM window
export function isInAMWindow(patient, currentTime = new Date()) {
  const pmReminderTime = patient?.pmReminderTime || '21:30';
  const [pmHour, pmMinute] = pmReminderTime.split(':').map(Number);
  
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;
  const pmReminderInMinutes = pmHour * 60 + pmMinute;
  
  return currentTimeInMinutes < pmReminderInMinutes;
}

// Check if current time is in PM window
export function isInPMWindow(patient, currentTime = new Date()) {
  return !isInAMWindow(patient, currentTime);
}

// Get routing status for debugging
export async function getRoutingStatus(patient, currentTime = new Date()) {
  if (!patient) return { status: 'no_patient', route: '/login' };
  
  const todayCheckIn = await getTodayCheckIn(patient.phoneNumber);
  const amDone = todayCheckIn?.amRoutine || false;
  const pmDone = todayCheckIn?.pmRoutine || false;
  
  const pmReminderTime = patient.pmReminderTime || '21:30';
  const [pmHour, pmMinute] = pmReminderTime.split(':').map(Number);
  
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;
  const pmReminderInMinutes = pmHour * 60 + pmMinute;
  const isBeforePMReminder = currentTimeInMinutes < pmReminderInMinutes;
  
  const isPhotoDay = isWeeklyPhotoDay(patient.startDate);
  const bothDone = amDone && pmDone;
  
  return {
    currentTime: currentTime.toLocaleTimeString(),
    pmReminderTime,
    isBeforePMReminder,
    amDone,
    pmDone,
    bothDone,
    isPhotoDay,
    window: isBeforePMReminder ? 'AM' : 'PM',
    route: await getSmartRoute(patient, currentTime)
  };
}
