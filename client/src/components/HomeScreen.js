import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOffline } from '../contexts/OfflineContext';
import { useGamification } from '../contexts/GamificationContext';
import { useNotifications } from '../contexts/NotificationContext';
import { saveCheckIn, getTodayCheckIn, getCheckIns, getLatestSkinScore, getWeeklyPhotos, getPatient } from '../utils/db';
import { calculateDay, calculateStreak, calculateShields, isMilestoneDay, isWeeklyPhotoDay, generateId, calculateConsistency } from '../utils/helpers';
import { getTimeOfDay, getTodayCheckInStatus } from '../utils/timeUtils';
import { Flame, Shield, Sun, Moon, Droplets, Utensils, Frown, Meh, Smile, Home, Map, User, Camera, Edit3 } from 'lucide-react';
import ReorderBanner from './ReorderBanner';
import GamificationPanel from './GamificationPanel';
import AchievementPopup from './AchievementPopup';

export default function HomeScreen() {
  const { patient, streak: streakData, refreshStreak } = useAuth();
  const { isOnline, queueForSync } = useOffline();
  const { awardPoints, checkAchievements } = useGamification();
  const { showStreakWarning } = useNotifications();
  const navigate = useNavigate();
  
  const day = calculateDay(patient?.startDate);
  const progress = (day / 90) * 100;
  const shields = calculateShields(streakData?.streak || 0);
  const availableShields = streakData?.restorationShields?.available || shields || 0;
  
  // Determine shield color based on remaining count
  const getShieldColor = (count) => {
    if (count >= 3) return 'text-green-500 fill-green-500';
    if (count === 2) return 'text-yellow-500 fill-yellow-500';
    if (count === 1) return 'text-red-500 fill-red-500';
    return 'text-gray-300 fill-gray-300';
  };
  const timeOfDay = getTimeOfDay();
  const isMorning = timeOfDay === 'AM';

  // Calculate streak values from local check-in records (source of truth for the calendar)
  const calculateStreakFromCheckIns = (checkIns) => {
    if (!checkIns || checkIns.length === 0) return { currentStreak: 0, longestStreak: 0 };

    // Count both real logs and shield-restored days
    const activeDates = new Set(
      checkIns.filter(c => c.amRoutine || c.pmRoutine || c.shieldRestored).map(c => c.date)
    );
    if (activeDates.size === 0) return { currentStreak: 0, longestStreak: 0 };

    const sorted = [...activeDates].sort();

    // Longest consecutive run
    let longestStreak = 1;
    let run = 1;
    for (let i = 1; i < sorted.length; i++) {
      const diff = Math.round((new Date(sorted[i]) - new Date(sorted[i - 1])) / 86400000);
      if (diff === 1) { run++; if (run > longestStreak) longestStreak = run; }
      else run = 1;
    }

    // Current streak: consecutive days ending at today or yesterday
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const yest = new Date(today); yest.setDate(today.getDate() - 1);
    const yesterdayStr = yest.toISOString().split('T')[0];

    let currentStreak = 0;
    const startOffset = activeDates.has(todayStr) ? 0 : activeDates.has(yesterdayStr) ? 1 : -1;
    if (startOffset >= 0) {
      for (let i = startOffset; i <= sorted.length; i++) {
        const d = new Date(today); d.setDate(today.getDate() - i);
        if (activeDates.has(d.toISOString().split('T')[0])) currentStreak++;
        else break;
      }
    }

    return { currentStreak, longestStreak: Math.max(longestStreak, currentStreak) };
  };

  // Calculate calendar data from real check-ins, respecting the patient's programme start date.
  // Days before startDate are marked 'before-start' — not missed — because the programme
  // hadn't begun yet. Only days from startDate onwards can be missed or completed.
  const getCalendarData = (checkIns, startDate) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    // Get first day of month and adjust for Monday-first calendar (0 = Monday, 6 = Sunday)
    let firstDay = new Date(year, month, 1).getDay();
    firstDay = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Normalise startDate to a midnight local Date for day-level comparison
    let startMidnight = null;
    if (startDate) {
      startMidnight = new Date(startDate);
      startMidnight.setHours(0, 0, 0, 0);
    }

    const calendar = [];
    for (let i = 0; i < firstDay; i++) {
      calendar.push(null);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = new Date(Date.UTC(year, month, i)).toISOString().split('T')[0];
      const isToday = i === now.getDate();
      const isPast = i < now.getDate();
      const isFuture = i > now.getDate();

      // Is this calendar date before the customer's programme started?
      const dayMidnight = new Date(year, month, i);
      const isBeforeStart = startMidnight && dayMidnight < startMidnight;

      let status = 'missed';

      if (isBeforeStart) {
        // Programme hadn't started — this is not a missed day
        status = 'before-start';
      } else if (checkIns && checkIns.length > 0) {
        const dayCheckIn = checkIns.find(c => c.date === dateStr);
        if (dayCheckIn) {
          const hasAM = dayCheckIn.amRoutine || false;
          const hasPM = dayCheckIn.pmRoutine || false;
          if (dayCheckIn.shieldRestored) status = 'shield-restored';
          else if (hasAM && hasPM) status = 'done';
          else if (hasAM || hasPM) status = 'partial';
        }
      }

      // Today in the morning: show as 'current' (pulsing indicator) if not already done/partial
      if (isToday && isMorning && !isBeforeStart && status !== 'done' && status !== 'partial') {
        status = 'current';
      }

      calendar.push({ day: i, status, isToday, isPast, isFuture, isBeforeStart });
    }

    return calendar;
  };

  const [showGamification, setShowGamification] = useState(false);
  const [newAchievement, setNewAchievement] = useState(null);
  const [currentSkinScore, setCurrentSkinScore] = useState(0); // Default fallback
  const [consistency, setConsistency] = useState(0); // Default fallback
  const [checkIns, setCheckIns] = useState([]); // Store check-ins for calendar
  const [localStreak, setLocalStreak] = useState({ currentStreak: 0, longestStreak: 0 });
  const [missedYesterday, setMissedYesterday] = useState(false);
  const [photosCount, setPhotosCount] = useState(0); // Store photos count

  // Fetch latest skin score and calculate consistency
  useEffect(() => {
    const fetchData = async () => {
      // Try both phone field names
      const phoneNumber = patient?.phoneNumber || patient?.phone;
      
      if (phoneNumber && patient?.startDate) {
        try {
          // Get patient record to get patientId
          const patientRecord = await getPatient(phoneNumber);
          
          if (!patientRecord) {
            return;
          }
          
          const patientId = patientRecord.id;
          
          // Fetch latest skin score
          const latestScore = await getLatestSkinScore(patientId);
          console.log('🏠 HomeScreen - Latest skin score fetched:', latestScore);
          if (latestScore && latestScore.totalScore) {
            setCurrentSkinScore(latestScore.totalScore);
            console.log('✅ HomeScreen - Skin score updated to:', latestScore.totalScore);
          } else {
            console.log('❌ HomeScreen - No skin score found');
          }

          // Fetch check-ins and calculate consistency
          const checkIns = await getCheckIns(patientId);
          const calculatedConsistency = calculateConsistency(checkIns, patient.startDate);
          setConsistency(calculatedConsistency);
          setCheckIns(checkIns);
          const computed = calculateStreakFromCheckIns(checkIns);
          setLocalStreak(computed);

          // Detect missed yesterday: no active check-in for yesterday but user has prior history.
          // Shield-restored days count as active (streak was not broken for that day).
          const today = new Date();
          const yest = new Date(today); yest.setDate(today.getDate() - 1);
          const yesterdayStr = yest.toISOString().split('T')[0];
          const activeDates = new Set(
            checkIns.filter(c => c.amRoutine || c.pmRoutine || c.shieldRestored).map(c => c.date)
          );
          const brokeStreak = !activeDates.has(yesterdayStr) && activeDates.size > 0 && computed.longestStreak > 0;
          setMissedYesterday(brokeStreak);
          // Persist for BottomNavigation (which has no access to checkIns)
          localStorage.setItem('gleuhrMissedYesterday', brokeStreak ? '1' : '0');
          localStorage.setItem('gleuhrPrevStreak', String(computed.longestStreak));

          // Fetch weekly photos count
          const photos = await getWeeklyPhotos(patientId);
          setPhotosCount(photos.length);
          
          // Refresh streak data from server
          await refreshStreak();
        } catch (error) {
          console.error('Error fetching data:', error);
        }
      }
    };
    
    fetchData();
    
    // Listen for skin score updates from other components
    const handleSkinScoreUpdate = (event) => {
      console.log('🏠 HomeScreen received skin score update event:', event.detail);
      if (event.detail && event.detail.latestScore) {
        setCurrentSkinScore(event.detail.latestScore.totalScore);
        console.log('✅ HomeScreen updated skin score from event:', event.detail.latestScore.totalScore);
      }
    };
    
    window.addEventListener('skinScoreUpdated', handleSkinScoreUpdate);
    
    // Refresh streak when page gets focus (user returns from other pages)
    const handlePageFocus = () => {
      refreshStreak();
    };
    
    window.addEventListener('focus', handlePageFocus);
    
    return () => {
      window.removeEventListener('skinScoreUpdated', handleSkinScoreUpdate);
      window.removeEventListener('focus', handlePageFocus);
    };
  }, [patient]);

  const calendarData = getCalendarData(checkIns, patient?.startDate);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const currentMonth = monthNames[new Date().getMonth()];

  // Calculate journey milestones from actual check-in data
  const calculateJourneyMilestones = (checkIns, currentDay) => {
    const milestones = [
      { week: 'Start', label: 'Start', day: 0, completed: true, current: false },
      { week: 'W2', label: 'W2', day: 14, completed: false, current: false },
      { week: 'W4', label: 'W4', day: 28, completed: false, current: false },
      { week: 'W6', label: 'W6', day: 42, completed: false, current: false },
      { week: 'W8', label: 'W8', day: 56, completed: false, current: false },
      { week: 'W12', label: 'W12', day: 84, completed: false, current: false },
    ];

    // Calculate completed milestones based on check-ins
    if (checkIns && checkIns.length > 0) {
      milestones.forEach(milestone => {
        if (milestone.day === 0) {
          milestone.completed = true; // Start is always completed
        } else if (milestone.day <= currentDay) {
          // Check if user has check-ins for this milestone period
          const milestoneCheckIns = checkIns.filter(checkIn => 
            checkIn.day && checkIn.day >= milestone.day - 7 && checkIn.day <= milestone.day
          );
          
          if (milestoneCheckIns.length >= 5) { // At least 5 check-ins in the week
            milestone.completed = true;
          }
        }
        
        // Set current milestone
        if (milestone.day <= currentDay && !milestone.completed) {
          milestone.current = true;
        } else if (milestone.day > currentDay && !milestone.completed) {
          milestone.current = false;
        }
      });
    } else {
      // No check-ins yet, only start is completed
      milestones.forEach(milestone => {
        if (milestone.day === 0) {
          milestone.completed = true;
        }
        if (milestone.day <= currentDay && !milestone.completed) {
          milestone.current = true;
        }
      });
    }

    return milestones;
  };

  const journeyMilestones = calculateJourneyMilestones(checkIns, day);

  const handleRoutineClick = () => {
    const path = isMorning ? '/amPage' : '/pmPage';
    if (missedYesterday && window.__gleuhrStreakPopup) {
      window.__gleuhrStreakPopup(path, localStreak.longestStreak);
    } else {
      navigate(path);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="px-5 py-4 flex justify-between items-start">
        <div>
          <p className="text-xs text-[#a39e95] font-outfit font-medium uppercase tracking-[0.5px]">
            Good {isMorning ? 'morning' : 'evening'}
          </p>
          <h2 className="text-2xl font-bold text-[#191716] font-crimson leading-tight tracking-[-0.5px]">
            {patient?.firstName || 'Priya'}
          </h2>
        </div>
        <div className="flex items-center gap-2.5">
          {currentSkinScore > 0 && (
            <div className="px-3 py-1.5 rounded-[10px] bg-[rgba(196,64,51,0.03)] border border-[rgba(196,64,51,0.08)] cursor-pointer flex items-center gap-1.5">
              <span className="text-xs font-semibold text-[#7a756d] font-outfit">Score</span>
              <span className="text-base font-bold text-[#c44033] font-crimson">{currentSkinScore}</span>
              <span className="text-xs text-[#a39e95] font-outfit">/20</span>
            </div>
          )}
          <div
            onClick={() => navigate('/profile')}
            className="w-10 h-10 rounded-[20px] bg-[rgba(196,64,51,0.06)] flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
          >
            <span className="text-base font-semibold text-[#c44033] font-crimson">
              {(patient?.name || patient?.firstName || 'P').charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Streak Card */}
      <div className="mx-5 my-3.5 p-3.5 rounded-[16px] bg-gradient-to-br from-[rgba(196,64,51,0.04)] to-[rgba(196,64,51,0.01)] border border-[rgba(196,64,51,0.08)] flex justify-between items-center">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-[12px] bg-gradient-to-br from-[rgba(220,38,38,0.125)] to-[rgba(220,38,38,0.03)] flex items-center justify-center">
            <Flame className="w-5.5 h-5.5 text-[#dc2626]" />
          </div>
          <div>
            <div className="text-sm font-semibold text-[#191716] font-crimson tracking-[-0.2px]">
              Current streak <span className="text-[#c44033] font-crimson text-xl font-bold ml-1">{localStreak.currentStreak || streakData?.streak || 0}</span> <span className="text-xs text-[#7a756d] font-crimson">days</span>
            </div>
            {(localStreak.currentStreak || streakData?.streak || 0) === 0 && (localStreak.longestStreak || streakData?.longestStreak || 0) > 0 && (
              <div className="text-xs text-[#a39e95] font-crimson mt-0.5 mb-0.5">
                Best: <span className="font-semibold text-[#191716]">{localStreak.longestStreak || streakData?.longestStreak || 0}</span> days
              </div>
            )}
            <div className="text-xs text-[#a39e95] font-outfit mt-0.5 flex items-center gap-1.5">
              <span>Red Hot flame</span>
              <span className="w-0.5 h-0.5 rounded-[2px] bg-[#ccc8c0]"></span>
              <span>{consistency}% consistent</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] bg-[rgba(196,64,51,0.05)]">
          <Shield className={`w-3.5 h-3.5 ${getShieldColor(availableShields)}`} strokeWidth={1.3} />
          <span className="text-sm font-bold text-[#c44033] font-outfit">{availableShields}</span>
        </div>
      </div>

      {/* Main CTA Button */}
      <div 
        onClick={handleRoutineClick}
        className="mx-5 my-3 p-5 rounded-[18px] bg-[#c44033] cursor-pointer relative overflow-hidden shadow-[rgba(196,64,51,0.208)_0px_8px_24px]"
      >
        <div className="absolute -top-0.15 -right-5 w-20 h-20 rounded-[40px] bg-[rgba(255,255,255,0.08)]"></div>
        <div className="flex items-center justify-between relative">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-[14px] bg-[rgba(255,255,255,0.15)] flex items-center justify-center">
              <span className="text-xl">{isMorning ? '☀️' : '🌙'}</span>
            </div>
            <div>
              <p className="text-base font-semibold text-white font-crimson">
                Log {isMorning ? 'AM' : 'PM'} routine
              </p>
              <p className="text-xs text-[rgba(255,255,255,0.65)] font-outfit mt-0.5">
                {isMorning ? 'Tap after your sunscreen absorbs' : 'Complete your evening routine'}
              </p>
            </div>
          </div>
          <div className="w-5 h-5 text-white opacity-60">
            <svg viewBox="0 0 20 20" fill="none" strokeWidth={2} strokeLinecap="round">
              <path d="M7 4l6 6-6 6" />
            </svg>
          </div>
        </div>
      </div>

      {/* Progress Section */}
      <div className="px-5 py-5 flex gap-5 items-center">
        <div className="relative w-19 h-19 flex-shrink-0">
          <svg width="76" height="76" viewBox="0 0 76 76">
            <circle cx="38" cy="38" r="32" fill="none" stroke="#f4f2ef" strokeWidth="5" />
            <circle
              cx="38"
              cy="38"
              r="32"
              fill="none"
              stroke="#c44033"
              strokeWidth="5"
              strokeDasharray={`${62.53 * (progress / 100)} 201`}
              strokeLinecap="round"
              transform="rotate(-90 38 38)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-[#191716] font-playfair leading-none">{day}</span>
            <span className="text-xs text-[#a39e95] font-outfit tracking-[0.5px]">of 90</span>
          </div>
        </div>
        <div className="flex-1">
          <p className="text-xs text-[#c44033] font-semibold font-outfit mb-1 uppercase tracking-[0.8px]">Day {day}</p>
          <p className="text-sm text-[#3d3935] font-crimson leading-[1.55]">
            {day === 28 ? (
              <>One full skin cycle complete. Your Glutathione is at peak efficacy now — most women see visible tone changes right around this point.</>
            ) : (
              <>Keep going! You're making great progress on your skin journey.</>
            )}
          </p>
        </div>
      </div>

      {/* Reorder Banner */}
      <div className="mx-5 my-4 px-5 py-4 bg-gradient-to-br from-[rgba(196,64,51,0.03)] to-[rgba(196,64,51,0.016)] rounded-[16px] border border-[rgba(196,64,51,0.094)] flex justify-between items-center">
        <div className="flex-1 mr-3">
          <p className="text-sm font-semibold text-[#c44033] font-outfit">Products running low</p>
          <p className="text-xs text-[#5c574f] font-outfit mt-0.5 leading-[1.4]">A gap resets your melanin suppression.</p>
        </div>
        <button className="px-5 py-2.5 bg-[#c44033] text-white border-0 rounded-[12px] text-sm font-semibold cursor-pointer font-outfit shadow-[rgba(196,64,51,0.25)_0px_4px_12px]">
          Reorder →
        </button>
      </div>

      {/* Calendar Section */}
      <div className="px-5 py-4.5">
        <div className="flex justify-between items-center mb-2.5">
          <p className="text-sm font-semibold text-[#191716] font-outfit">{currentMonth}</p>
          <div className="flex gap-3">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-[3px] bg-[#1a8a4a]"></div>
              <span className="text-xs text-[#a39e95] font-outfit">Done</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-[3px] bg-[#d4a017]"></div>
              <span className="text-xs text-[#a39e95] font-outfit">Partial</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-[3px] bg-[#1a9688]"></div>
              <span className="text-xs text-[#a39e95] font-outfit">Shield</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-[3px] bg-[#dc2626]"></div>
              <span className="text-xs text-[#a39e95] font-outfit">Missed</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((dayName) => (
            <div key={dayName} className="text-center text-xs text-[#a39e95] font-outfit pb-0.5 font-medium">
              {dayName}
            </div>
          ))}
          {calendarData.map((dayData, index) => (
            <div
              key={index}
              className={`aspect-square rounded-[8px] flex items-center justify-center relative ${
                !dayData ? '' :
                dayData.status === 'before-start'    ? 'bg-transparent' :
                dayData.status === 'done'             ? 'bg-[#1a8a4a] opacity-80' :
                dayData.status === 'shield-restored'  ? 'bg-[#1a9688] opacity-85' :
                dayData.status === 'partial'          ? 'bg-[#d4a017] opacity-60' :
                dayData.status === 'current'          ? 'bg-[#c44033] opacity-90' :
                dayData.isFuture                      ? 'bg-[#ede9e5] opacity-30' :
                'bg-[#dc2626] opacity-40'
              }`}
            >
              <span className={`text-xs font-medium ${
                !dayData ? '' :
                dayData.status === 'before-start'   ? 'text-[#d4cfc9]' :
                dayData.status === 'done'            ? 'text-white' :
                dayData.status === 'shield-restored' ? 'text-white' :
                dayData.status === 'partial'         ? 'text-white' :
                dayData.status === 'current'         ? 'text-white' :
                dayData.isFuture                     ? 'text-[#a39e95]' :
                'text-white'
              }`}>
                {dayData?.status === 'current' ? '' : dayData?.day}
              </span>
              {dayData?.status === 'current' && (
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-xs font-bold text-white leading-none">{dayData.day}</span>
                  <div className="w-1 h-1 rounded-full bg-white opacity-80"></div>
                </div>
              )}
              {dayData?.status === 'shield-restored' && (
                <span className="absolute -top-0.5 -right-0.5 text-[8px] leading-none">🛡️</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Journey + Promise — merged dark card */}
      <div className="mx-5 my-8 rounded-[20px] overflow-hidden bg-[#191716] relative">
        <div className="absolute -top-7.5 -right-5 w-25 h-25 rounded-[50px] bg-[rgba(196,64,51,0.08)]"></div>
        <div className="absolute -bottom-5 -left-5 w-17.5 h-17.5 rounded-[35px] bg-[rgba(196,64,51,0.05)]"></div>
        <div className="px-6 py-5 relative">

          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-[8px] bg-[rgba(196,64,51,0.15)] flex items-center justify-center">
                <span className="text-xs">🤝</span>
              </div>
              <span className="text-xs font-bold text-[rgba(255,255,255,0.45)] font-outfit uppercase tracking-[1.2px]">Your Journey · Day {day}</span>
            </div>
            <span className="text-xs text-[rgba(255,255,255,0.3)] font-outfit">of 90</span>
          </div>

          {/* Quote */}
          <p className="text-base text-[rgba(255,255,255,0.85)] font-playfair leading-[1.55] italic font-normal mb-5">
            "I commit to giving my skin 90 days of consistent care."
          </p>

          {/* Milestone timeline — dark themed */}
          <div className="relative px-1 mb-5">
            <div className="absolute top-4 left-5 right-5 h-0.5 bg-[rgba(255,255,255,0.08)] rounded-[2px]"></div>
            <div
              className="absolute top-4 left-5 h-0.5 rounded-[2px]"
              style={{
                width: `${Math.min(Math.round((day / 90) * 100), 100)}%`,
                background: 'linear-gradient(to right, #1a8a4a, #c44033)'
              }}
            ></div>
            <div className="flex justify-between relative">
              {journeyMilestones.map((milestone) => (
                <div key={milestone.week} className="flex flex-col items-center gap-1.5 w-10">
                  <div
                    className={`w-8 h-8 rounded-[16px] flex items-center justify-center transition-all ${
                      milestone.current
                        ? 'bg-[rgba(255,255,255,0.12)] border-2 border-[#c44033] shadow-[rgba(196,64,51,0.3)_0px_0px_0px_3px]'
                        : milestone.completed
                        ? 'bg-[#1a8a4a]'
                        : 'bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.12)]'
                    }`}
                  >
                    {milestone.current ? (
                      <span className="text-xs">✨</span>
                    ) : milestone.completed ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M3 7l3 3 5-6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <rect x="2" y="5.5" width="8" height="5" rx="1" stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
                        <path d="M4 5.5V4a2 2 0 114 0v1.5" stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
                      </svg>
                    )}
                  </div>
                  <span className={`text-xs text-center leading-[1.2] font-outfit ${
                    milestone.current ? 'text-[#c44033] font-semibold' :
                    milestone.completed ? 'text-[#1a8a4a] font-semibold' :
                    'text-[rgba(255,255,255,0.3)] font-normal'
                  }`}>
                    {milestone.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="px-3 py-3 rounded-[10px] bg-[rgba(255,255,255,0.06)] text-center">
              <span className="text-base font-bold text-white font-playfair block">{day}</span>
              <span className="text-xs text-[rgba(255,255,255,0.4)] font-outfit block">days logged</span>
            </div>
            <div className="px-3 py-3 rounded-[10px] bg-[rgba(255,255,255,0.06)] text-center">
              <span className="text-base font-bold text-white font-playfair block">{photosCount}</span>
              <span className="text-xs text-[rgba(255,255,255,0.4)] font-outfit block">photos taken</span>
            </div>
          </div>

        </div>
      </div>

      {/* Reorder Banner for Day 25+ */}
      {day >= 25 && <ReorderBanner coachName={patient?.coachName} coachWhatsApp={patient?.coachWhatsApp} day={day} />}

      {/* Gamification Button */}
      <button
        onClick={() => setShowGamification(true)}
        className="fixed bottom-24 right-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white p-3 rounded-full shadow-lg z-40"
        aria-label="View progress and achievements"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0" />
        </svg>
      </button>

      {/* Gamification Panel */}
      {showGamification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <GamificationPanel onClose={() => setShowGamification(false)} />
          </div>
        </div>
      )}

      {/* Achievement Popup */}
      {newAchievement && (
        <AchievementPopup 
          achievement={newAchievement}
          onClose={() => setNewAchievement(null)}
          onShare={(achievement) => {
            // Share achievement logic (can be implemented later)
            console.log('Sharing achievement:', achievement);
          }}
        />
      )}
    </div>
  );
}
