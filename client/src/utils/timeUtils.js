// Time-based routing utilities
export const getTimeOfDay = () => {
  const hour = new Date().getHours();
  
  // AM: 6:00 - 17:59 (6 AM to 6 PM)
  // PM: 18:00 - 5:59 (6 PM to 5:59 AM next day)
  if (hour >= 6 && hour < 18) {
    return 'AM';
  } else {
    return 'PM';
  }
};

export const shouldShowAMPage = () => {
  return getTimeOfDay() === 'AM';
};

export const shouldShowPMPage = () => {
  return getTimeOfDay() === 'PM';
};

// Check if both AM and PM routines are completed for today
export const isCompleteDay = (todayCheckIn) => {
  return todayCheckIn && todayCheckIn.amRoutine && todayCheckIn.pmRoutine;
};

// Get today's check-in status
export const getTodayCheckInStatus = (todayCheckIn) => {
  if (!todayCheckIn) {
    return { amCompleted: false, pmCompleted: false, bothCompleted: false };
  }
  
  return {
    amCompleted: !!todayCheckIn.amRoutine,
    pmCompleted: !!todayCheckIn.pmRoutine,
    bothCompleted: todayCheckIn.amRoutine && todayCheckIn.pmRoutine
  };
};
