import { format, parseISO, differenceInDays, isValid, startOfDay, endOfDay } from 'date-fns';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';

// Default timezone (can be changed based on user preference)
const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/**
 * Safely calculates the day number from start date with timezone support
 * @param {string|Date} startDate - The start date
 * @param {string|Date} currentDate - Current date (defaults to now)
 * @param {string} timezone - Timezone to use for calculations
 * @returns {number} Day number (1-based)
 */
export const calculateDayFromDate = (startDate, currentDate = new Date(), timezone = DEFAULT_TIMEZONE) => {
  try {
    // Ensure we have valid dates
    const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
    const current = typeof currentDate === 'string' ? parseISO(currentDate) : currentDate;
    
    if (!isValid(start) || !isValid(current)) {
      console.error('Invalid dates provided:', { startDate, currentDate });
      return 1;
    }

    // Convert to timezone to handle day boundaries correctly
    const startZoned = utcToZonedTime(start, timezone);
    const currentZoned = utcToZonedTime(current, timezone);
    
    // Normalize to start of day to avoid partial day issues
    const startDay = startOfDay(startZoned);
    const currentDay = startOfDay(currentZoned);
    
    // Calculate difference in days (0-based) and add 1 to make it 1-based
    const dayDifference = differenceInDays(currentDay, startDay);
    return Math.max(1, dayDifference + 1);
  } catch (error) {
    console.error('Error calculating day from date:', error);
    return 1;
  }
};

/**
 * Checks if a given day is a weekly photo day (every 7 days)
 * @param {string|Date} startDate - The start date
 * @param {string|Date} currentDate - Current date (defaults to now)
 * @param {string} timezone - Timezone to use for calculations
 * @returns {boolean} True if it's a weekly photo day
 */
export const isWeeklyPhotoDay = (startDate, currentDate = new Date(), timezone = DEFAULT_TIMEZONE) => {
  const currentDay = calculateDayFromDate(startDate, currentDate, timezone);
  return currentDay % 7 === 0;
};

/**
 * Formats a date for display with timezone
 * @param {string|Date} date - Date to format
 * @param {string} formatString - Format string (date-fns format)
 * @param {string} timezone - Timezone to use
 * @returns {string} Formatted date string
 */
export const formatDateWithTimezone = (date, formatString = 'PPP', timezone = DEFAULT_TIMEZONE) => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) {
      return 'Invalid date';
    }
    
    const zonedDate = utcToZonedTime(dateObj, timezone);
    return format(zonedDate, formatString);
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
};

/**
 * Gets the current date in the specified timezone
 * @param {string} timezone - Timezone to use
 * @returns {Date} Current date in timezone
 */
export const getCurrentDateInTimezone = (timezone = DEFAULT_TIMEZONE) => {
  return utcToZonedTime(new Date(), timezone);
};

/**
 * Converts a date to ISO string with timezone consideration
 * @param {string|Date} date - Date to convert
 * @param {string} timezone - Timezone to use
 * @returns {string} ISO string
 */
export const toISOStringWithTimezone = (date, timezone = DEFAULT_TIMEZONE) => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) {
      return new Date().toISOString();
    }
    
    const zonedDate = utcToZonedTime(dateObj, timezone);
    return zonedDate.toISOString();
  } catch (error) {
    console.error('Error converting to ISO string:', error);
    return new Date().toISOString();
  }
};

/**
 * Validates if a date is within a valid range for the application
 * @param {string|Date} date - Date to validate
 * @param {string|Date} referenceDate - Reference date (defaults to now)
 * @param {number} maxDaysFuture - Maximum days in future allowed
 * @param {number} maxDaysPast - Maximum days in past allowed
 * @returns {boolean} True if date is valid
 */
export const isValidDateRange = (
  date, 
  referenceDate = new Date(), 
  maxDaysFuture = 1, 
  maxDaysPast = 90
) => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    const refDate = typeof referenceDate === 'string' ? parseISO(referenceDate) : referenceDate;
    
    if (!isValid(dateObj) || !isValid(refDate)) {
      return false;
    }
    
    const daysDiff = differenceInDays(dateObj, refDate);
    return daysDiff >= -maxDaysPast && daysDiff <= maxDaysFuture;
  } catch (error) {
    console.error('Error validating date range:', error);
    return false;
  }
};

/**
 * Gets the start and end of day in the specified timezone
 * @param {string|Date} date - Date to get boundaries for
 * @param {string} timezone - Timezone to use
 * @returns {object} { startOfDay, endOfDay }
 */
export const getDayBoundaries = (date, timezone = DEFAULT_TIMEZONE) => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    const zonedDate = utcToZonedTime(dateObj, timezone);
    
    return {
      startOfDay: startOfDay(zonedDate),
      endOfDay: endOfDay(zonedDate)
    };
  } catch (error) {
    console.error('Error getting day boundaries:', error);
    const now = new Date();
    return {
      startOfDay: startOfDay(now),
      endOfDay: endOfDay(now)
    };
  }
};
