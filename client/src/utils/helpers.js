// Date and calculation helpers
export function calculateDay(startDate) {
  if (!startDate) return 1;
  const start = new Date(startDate);
  const today = new Date();
  const diffTime = today - start;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, Math.min(diffDays, 90));
}

export function calculateStreak(checkIns) {
  if (!checkIns || checkIns.length === 0) return 0;
  
  const sortedDates = checkIns
    .map(c => new Date(c.date).getTime())
    .sort((a, b) => b - a);
  
  let streak = 1;
  const today = new Date().setHours(0, 0, 0, 0);
  const yesterday = today - 24 * 60 * 60 * 1000;
  
  if (sortedDates[0] !== today && sortedDates[0] !== yesterday) {
    return 0;
  }
  
  for (let i = 0; i < sortedDates.length - 1; i++) {
    const current = sortedDates[i];
    const next = sortedDates[i + 1];
    const diff = (current - next) / (24 * 60 * 60 * 1000);
    
    if (diff === 1) {
      streak++;
    } else {
      break;
    }
  }
  
  return streak;
}

export function calculateShields(streak) {
  return Math.min(3, Math.floor(streak / 7));
}

export function isMilestoneDay(day) {
  return day === 1 || day === 28 || day === 56 || day === 84;
}

export function isWeeklyPhotoDay(startDate) {
  if (!startDate) return false;
  const start = new Date(startDate);
  const today = new Date();
  const days = Math.floor((today - start) / (1000 * 60 * 60 * 24)) + 1;
  return days % 7 === 0;
}

export function getWeekNumber(startDate) {
  if (!startDate) return 1;
  const start = new Date(startDate);
  const today = new Date();
  const days = Math.floor((today - start) / (1000 * 60 * 60 * 24)) + 1;
  return Math.ceil(days / 7);
}

export function getMilestoneLabel(day) {
  switch (day) {
    case 1: return 'Start';
    case 28: return 'Month 1';
    case 56: return 'Month 2';
    case 84: return 'Month 3';
    default: return `Day ${day}`;
  }
}

export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function calculateConsistency(checkIns, startDate) {
  if (!checkIns || !startDate) return 0;
  const totalDays = calculateDay(startDate);
  if (totalDays === 0) return 0;
  
  const uniqueDays = new Set(checkIns.map(c => c.date)).size;
  return Math.round((uniqueDays / totalDays) * 100);
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
