import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Shield, Frown, Meh, Smile } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useOffline } from '../contexts/OfflineContext';
import { useGamification } from '../contexts/GamificationContext';
import { saveCheckIn, getTodayCheckIn, getCheckIns, getWeeklyPhotos, getPatient } from '../utils/db';
import { calculateDay, calculateShields, isMilestoneDay, isWeeklyPhotoDay, generateId, calculateConsistency } from '../utils/helpers';
import ShieldSuccessAnimation from './ShieldSuccessAnimation';
import BottomNavigation from './BottomNavigation';

export default function PMPage() {
  const { patient, streak: streakData, refreshStreak } = useAuth();
  const { isOnline, queueForSync } = useOffline();
  const { awardPoints } = useGamification();
  const navigate = useNavigate();
  
  const day = calculateDay(patient?.startDate);
  const progress = (day / 90) * 100;
  const shields = calculateShields(streakData?.streak || 0);
  const availableShields = streakData?.restorationShields?.available || shields || 0;
  
  // Determine shield color based on remaining count
  const getShieldColor = (count) => {
    if (count >= 3) return 'text-green-600 fill-green-600';
    if (count === 2) return 'text-yellow-600 fill-yellow-600';
    if (count === 1) return 'text-red-600 fill-red-600';
    return 'text-gray-300 fill-gray-300';
  };

  const [amRoutine, setAmRoutine] = useState(false);
  const [sunscreen, setSunscreen] = useState(false);
  const [pmRoutine, setPmRoutine] = useState(false);
  const [hasAMRoutineToday, setHasAMRoutineToday] = useState(false);
  const [dietFollowed, setDietFollowed] = useState('');
  const [triggerFoods, setTriggerFoods] = useState([]);
  const [waterIntake, setWaterIntake] = useState(0);
  const [skinMood, setSkinMood] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [showShieldRestore, setShowShieldRestore] = useState(false);
  const [showShieldSuccess, setShowShieldSuccess] = useState(false);
  const [shieldRestoreData, setShieldRestoreData] = useState(null);
  const [showCheckinSuccess, setShowCheckinSuccess] = useState(false);
  const [showQuickLogDrawer, setShowQuickLogDrawer] = useState(false);
  const [isQuickLogMode, setIsQuickLogMode] = useState(false);
  const [quickLogType, setQuickLogType] = useState(null);
  const [consistency, setConsistency] = useState(0);

  useEffect(() => {
    const fetchConsistency = async () => {
      if (!patient?.id || !patient?.startDate) return;
      const checkIns = await getCheckIns(patient.id);
      setConsistency(calculateConsistency(checkIns, patient.startDate));
    };
    fetchConsistency();
  }, [patient?.id, patient?.startDate]);

  // Check if AM routine is already logged today.
  // Uses patient.id (MongoDB ObjectId) as the IndexedDB patientId key,
  // then falls back to the server if IndexedDB is empty (new device / cleared storage).
  const checkTodayAMRoutine = async () => {
    try {
      const phone = patient?.phone || patient?.phoneNumber;
      const today = new Date().toISOString().split('T')[0];

      // 1. IndexedDB lookup (patientId is the MongoDB ObjectId stored in patient.id)
      let todayCheckIn = await getTodayCheckIn(patient?.id);

      // 2. Server fallback — covers new device or cleared IndexedDB
      if (!todayCheckIn && phone) {
        try {
          const res = await fetch(`/api/checkin/${phone}`);
          if (res.ok) {
            const checkins = await res.json();
            todayCheckIn = checkins.find(c => c.date === today);
          }
        } catch { /* non-fatal — stay with no data */ }
      }

      if (todayCheckIn?.amRoutine) {
        setHasAMRoutineToday(true);
        setAmRoutine(todayCheckIn.amRoutine);
        setSunscreen(todayCheckIn.sunscreen || false);
      }
    } catch (error) {
      console.error('Error checking today AM routine:', error);
    }
  };

  useEffect(() => {
    checkTodayAMRoutine();
  }, [patient?.phoneNumber]);

  const restoreStreakWithShield = async () => {
    if (!patient?.phone) return;
    
    try {
      const response = await fetch('/api/streak/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: patient.phone
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('Streak restored with shield:', result);
        await refreshStreak();
        setShowShieldRestore(false);
        
        // Show success animation instead of alert
        setShieldRestoreData({
          streakRestored: true,
          shieldsRemaining: result.shieldsRemaining,
          previousStreak: result.previousStreak,
          newStreak: result.restoredStreak
        });
        setShowShieldSuccess(true);
      } else {
        alert(result.error || 'Failed to restore streak');
      }
    } catch (error) {
      console.error('Error restoring streak:', error);
      alert('Failed to restore streak');
    }
  };

  // Skin-score redirect is intentionally removed from pmPage to prevent
  // hijacking direct navigation. SmartRouter handles milestone routing.

  useEffect(() => {
    // Load today's PM check-in if already submitted
    const loadToday = async () => {
      const phone = patient?.phone || patient?.phoneNumber;
      const todayDate = new Date().toISOString().split('T')[0];

      // 1. IndexedDB lookup using correct patientId key
      let today = await getTodayCheckIn(patient?.id);

      // 2. Server fallback
      if (!today && phone) {
        try {
          const res = await fetch(`/api/checkin/${phone}`);
          if (res.ok) {
            const checkins = await res.json();
            today = checkins.find(c => c.date === todayDate);
          }
        } catch { /* non-fatal */ }
      }

      if (today?.pmRoutine) {
        setPmRoutine(today.pmRoutine);
        setDietFollowed(today.dietFollowed);
        setTriggerFoods(today.triggerFoods || []);
        setWaterIntake(today.waterIntake);
        setSkinMood(today.skinMood);
        setHasSubmitted(true);
      }

      // Auto-trigger shield popup if yesterday was missed and user has prior history
      const allCheckIns = await getCheckIns(patient?.id);
      const yest = new Date(); yest.setDate(yest.getDate() - 1);
      const yesterdayStr = yest.toISOString().split('T')[0];
      const shieldRestoredDate = localStorage.getItem('gleuhrShieldRestoredDate');
      const hadHistory = allCheckIns && allCheckIns.some(
        c => c.amRoutine || c.pmRoutine || c.shieldRestored
      );
      const yesterdayActive = allCheckIns && allCheckIns.some(
        c => c.date === yesterdayStr && (c.amRoutine || c.pmRoutine || c.shieldRestored)
      );
      if (hadHistory && !yesterdayActive && shieldRestoredDate !== yesterdayStr) {
        setShowShieldRestore(true);
      }
    };
    loadToday();
  }, [patient]);

  const handleSubmit = async () => {
    // All PM fields are required regardless of quick log mode
    if (waterIntake === 0) {
      alert('Please select your water intake for today');
      return;
    }
    if (!dietFollowed) {
      alert('Please select if you followed your diet plan');
      return;
    }
    if (!skinMood) {
      alert('Please select how your skin is feeling today');
      return;
    }
    
    setIsSubmitting(true);
    
    // Get patient record to get patientId
    const phoneNumber = patient?.phoneNumber || patient?.phone;
    
    if (!phoneNumber) {
      alert('No phone number found. Please check your patient data.');
      return;
    }
    
    const patientRecord = await getPatient(phoneNumber);
    if (!patientRecord) {
      alert('Patient record not found. Please contact support.');
      return;
    }
    
    const patientId = patientRecord.id;
    
    // Get today's existing check-in data
    const existingCheckIn = await getTodayCheckIn(patientId);
    
    // Map UI diet labels to model enum values
    const dietFollowedMap = { 'Yes ✓': 'Yes', 'Mostly': 'Partial', 'Not today': 'No' };
    const dietFollowedValue = dietFollowedMap[dietFollowed] || dietFollowed || 'No';

    const checkInData = {
      id: existingCheckIn?.id || generateId(),
      patientId: patientId,
      patientPhone: phoneNumber,
      date: new Date().toISOString().split('T')[0],
      day,
      // Use AM data: prefer checkbox state (user just logged it), fall back to existing DB value
      amRoutine: amRoutine || existingCheckIn?.amRoutine || false,
      sunscreen: sunscreen || existingCheckIn?.sunscreen || false,
      // Add PM data — use actual toggle state; in normal (non-quick-log) mode default to true
      pmRoutine: isQuickLogMode ? pmRoutine : true,
      dietFollowed: dietFollowedValue,
      triggerFoods,
      waterIntake,
      skinMood,
      quickLogType: quickLogType || null,
      synced: false
    };

    console.log('Submitting PM check-in data:', checkInData);

    // Save to IndexedDB
    await saveCheckIn(checkInData);

    // Try to save to MongoDB directly
    try {
      const response = await fetch('/api/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(checkInData)
      });
      
      const result = await response.json();
      console.log('MongoDB PM check-in save response:', result);
      
      if (result.success) {
        // Update local record as synced
        checkInData.synced = true;
        checkInData.id = result.id;
        await saveCheckIn(checkInData);
        console.log('PM check-in saved to MongoDB successfully!');
      }
    } catch (apiError) {
      console.error('Failed to save PM check-in to MongoDB, queuing for sync:', apiError);
      
      // Queue for sync if API fails
      if (isOnline) {
        queueForSync('checkin', checkInData);
      }
    }

    // Award points for PM routine
    awardPoints('pm_routine');
    
    // Check if both routines are completed and award bonus points
    if (existingCheckIn?.amRoutine && pmRoutine) {
      awardPoints('complete_day');
    }
    
    // Refresh streak with small delay to ensure server update is complete
    try {
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms for server to update
      await refreshStreak();
    } catch (streakError) {
      console.error('Error refreshing streak:', streakError);
      // Don't fail the entire submission if streak refresh fails
    }

    // Check if current day is a milestone and show celebration
    if (isMilestoneDay(day)) {
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 5000);
    }

    setHasSubmitted(true);
    setIsSubmitting(false);
    
    console.log('PM check-in submission completed!');
    
    // Navigate to success page
    navigate('/checkin-success', { 
      state: { 
        streak: day, 
        message: "Your consistency puts you in the top 15% of all Gleuhr users this month." 
      } 
    });
  };

  const toggleTriggerFood = (food) => {
    setTriggerFoods(prev => 
      prev.includes(food) ? prev.filter(f => f !== food) : [...prev, food]
    );
  };

  const milestones = [
    { day: 1, label: 'Day 1', active: day >= 1 },
    { day: 28, label: 'Day 28', active: day >= 28 },
    { day: 56, label: 'Day 56', active: day >= 56 },
    { day: 84, label: 'Day 84', active: day >= 84 },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex flex-col h-screen">
        {/* Header */}
        <div className="flex-shrink-0">
          <div className="px-4 py-3 sm:px-5 sm:py-4">
            <p className="text-xs text-red-600 font-bold uppercase tracking-wider m-0">Evening Check-in</p>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900" style={{ fontFamily: 'Playfair Display, serif', margin: '4px 0 0' }}>Day {day}</h2>
          </div>

          {/* Streak Card */}
          <div className="mx-4 mb-3 sm:mx-5 sm:mb-4 px-3 py-2.5 sm:px-4 sm:py-3.5 rounded-2xl border border-red-100" style={{ background: 'linear-gradient(135deg, rgba(196, 64, 51, 0.04) 0%, rgba(196, 64, 51, 0.01) 100%)' }}>
            <div className="flex justify-between items-start sm:items-center">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.125) 0%, rgba(220, 38, 38, 0.03) 100%)' }}>
                  <svg width="18" height="18" className="sm:w-5 sm:h-5" viewBox="0 0 20 20" fill="none">
                    <path d="M10 18c-3.87 0-6.5-2.42-6.5-5.6 0-2 1.2-4 2.4-5.2.4-.4 1.2-.4 1.2.4 0 1.2.4 2.4 1.6 3.2.4.4.8.4 1.2 0 .4-.4.4-1.2 0-2.4-.4-1.2-.4-2.8.8-4.4.8-1.2 1.6-2 2.4-2.8.4-.4 1.2-.4 1.2.4 0 1.6.8 2.8 2 4 .8.8 1.6 2 1.6 3.6 0 3.2-2.42 5.6-6.5 5.6z" fill="#dc2626"></path>
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  {(streakData?.longestStreak || 0) === 0 ? (
                    <>
                      <div className="text-sm font-semibold text-gray-900 tracking-tight">
                        Your streak starts tonight!
                      </div>
                      <div className="text-xs text-red-500 mt-1 font-medium">
                        Log today & ignite your first flame 🔥
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-semibold text-gray-900 tracking-tight">
                        Your best streak <span className="text-red-600" style={{ fontFamily: 'Playfair Display, serif', fontSize: '16px sm:20px', fontWeight: '700', marginLeft: '2px' }}>{streakData?.longestStreak}</span> <span className="text-xs text-gray-600 font-normal">days</span>
                      </div>
                      <div className="text-xs text-gray-600 mt-1 flex items-center gap-1.5">
                        <span className="xs:inline">Red Hot flame</span>
                        <span className="xs:inline">⚆</span>
                        <span className="w-1 h-1 rounded-full bg-gray-300 hidden xs:inline"></span>
                        <span>{consistency}% consistent</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 px-5 py-2.5 sm:px-2 sm:py-1 rounded-lg flex-shrink-0 mb-3 sm:mb-0 border border-red-100" style={{ background: 'rgba(196, 64, 51, 0.05)' }}>
                <Shield className={`w-3 h-3 sm:w-4 sm:h-4 ${getShieldColor(availableShields)}`} />
                <span className={`text-xs sm:text-sm font-bold ${availableShields >= 3 ? 'text-green-700' : availableShields === 2 ? 'text-yellow-700' : availableShields === 1 ? 'text-red-700' : 'text-gray-700'}`}>{streakData?.restorationShields?.available}</span>
                <span className={`text-xs ${availableShields >= 3 ? 'text-green-600' : availableShields === 2 ? 'text-yellow-600' : availableShields === 1 ? 'text-red-600' : 'text-gray-600'} hidden sm:inline`}>shields</span>
               
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          <div className="px-4 sm:px-5 flex flex-col gap-3 sm:gap-3.5">
            {/* Quick Log button + AM checkbox — only when AM wasn't already logged */}
            {!hasAMRoutineToday && (
              <>
                {/* Tough day? Quick log row */}
                <button
                  onClick={() => setShowQuickLogDrawer(true)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '14px 16px', background: 'rgb(255,255,255)',
                    border: '1.5px solid rgb(224,221,215)', borderRadius: '14px',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: '14px', color: 'rgb(100,92,84)', fontFamily: 'Outfit, sans-serif' }}>
                    Tough day? <strong style={{ color: 'rgb(25,23,22)' }}>Quick log</strong>
                  </span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgb(180,174,168)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>

                {/* AM checkbox */}
                <div style={{ padding: '10px 12px', background: 'rgba(212,160,23,0.08)', borderRadius: '12px', border: '1px solid rgba(212,160,23,0.15)' }}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div
                      onClick={() => {
                        setAmRoutine(!amRoutine);
                        if (amRoutine) setSunscreen(false);
                      }}
                      style={{ width: '20px', height: '20px', borderRadius: '5px', border: '1.5px solid rgb(204,200,192)', background: 'rgb(255,255,255)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0' }}
                    >
                      {amRoutine && (
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                          <path d="M13.5 4.5L6 12l-3.5-3.5" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span style={{ fontSize: '12px', color: 'rgb(61,57,53)', fontFamily: 'Outfit, sans-serif', lineHeight: '1.4' }}>Completed AM routine this morning?</span>
                  </label>
                </div>

              </>
            )}

            {/* PM Routine Toggle */}
            <button
              onClick={() => !hasSubmitted && setPmRoutine(!pmRoutine)}
              disabled={hasSubmitted}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '14px 16px', background: 'rgb(255, 255, 255)', border: '1.5px solid rgb(224, 221, 215)', borderRadius: '14px', cursor: hasSubmitted ? 'default' : 'pointer', transition: '0.25s' }}
            >
              <span style={{ fontSize: '14px', fontWeight: '600', color: 'rgb(25, 23, 22)', fontFamily: 'crimson, sans-serif', letterSpacing: '-0.2px' }}>PM Routine Completed</span>
              <div style={{ width: '44px', height: '26px', borderRadius: '13px', padding: '2px', background: pmRoutine ? '#10b981' : 'rgb(204, 200, 192)', transition: 'background 0.25s', display: 'flex', alignItems: 'center' }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '11px', background: 'rgb(255, 255, 255)', boxShadow: 'rgba(0, 0, 0, 0.18) 0px 1px 4px', transform: pmRoutine ? 'translateX(18px)' : 'translateX(0px)', transition: 'transform 0.25s' }}></div>
              </div>
            </button>

            {/* Diet Plan */}
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-2">Followed diet plan?</p>
              <div className="flex gap-1.5 sm:gap-2 mb-3">
                {['Yes ✓', 'Mostly', 'Not today'].map((option) => (
                  <button
                    key={option}
                    onClick={() => !hasSubmitted && setDietFollowed(option)}
                    disabled={hasSubmitted}
                    className={`flex-1 px-2 py-2.5 sm:px-3 sm:py-3.5 rounded-xl border text-xs sm:text-sm transition-all ${hasSubmitted ? 'cursor-default' : 'cursor-pointer'} ${
                      dietFollowed === option
                        ? 'bg-green-50 border-green-300 text-green-700 font-medium'
                        : 'bg-white border-gray-300 text-gray-500'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {/* Water Intake */}
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-2">Water intake</p>
              <div className="flex gap-2 mb-3">
                {[
                  { value: 1, label: '< 1L', height: '25%' },
                  { value: 2, label: '1-2L', height: '50%' },
                  { value: 3, label: '2-3L', height: '75%' },
                  { value: 4, label: '3L+', height: '100%' }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => !hasSubmitted && setWaterIntake(option.value)}
                    disabled={hasSubmitted}
                    className={`flex-1 px-1 py-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${hasSubmitted ? 'cursor-default' : 'cursor-pointer'} ${
                      waterIntake === option.value
                        ? 'bg-blue-50 border-blue-300'
                        : 'bg-white border-gray-300'
                    }`}
                  >
                    <div className="w-5 h-6 rounded border border-gray-300 relative overflow-hidden">
                      <div
                        className="absolute bottom-0 left-0 right-0 transition-all"
                        style={{
                          height: waterIntake === option.value ? option.height : '0%',
                          background: waterIntake === option.value ? '#3b82f6' : '#e5e7eb'
                        }}
                      ></div>
                    </div>
                    <span className="text-xs font-normal text-gray-500">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Skin Feeling */}
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-2">Skin feeling</p>
              <div className="flex gap-2 mb-3">
                {[
                  { emoji: '😊', label: 'Good', value: 'good' },
                  { emoji: '😐', label: 'Okay', value: 'okay' },
                  { emoji: '😟', label: 'Off', value: 'off' }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => !hasSubmitted && setSkinMood(option.value)}
                    disabled={hasSubmitted}
                    className={`flex-1 px-2 py-3.5 rounded-xl border flex flex-col items-center gap-1.25 transition-all ${hasSubmitted ? 'cursor-default' : 'cursor-pointer'} ${
                      skinMood === option.value
                        ? 'bg-green-50 border-green-300'
                        : 'bg-white border-gray-300'
                    }`}
                  >
                    <span className="text-2xl">{option.emoji}</span>
                    <span className="text-xs font-normal text-gray-500">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || hasSubmitted}
              className={`w-full px-4.5 py-5 rounded-xl text-white border-none text-base font-semibold font-sans mt-1 mb-4 transition-all ${isSubmitting || hasSubmitted ? 'cursor-default' : 'cursor-pointer'}`}
              style={{
                background: isSubmitting || hasSubmitted ? '#9ca3af' : '#c44033',
                boxShadow: isSubmitting || hasSubmitted ? 'none' : 'rgba(196, 64, 51, 0.208) 0px 6px 20px'
              }}
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving...</span>
                </div>
              ) : hasSubmitted ? (
                'Completed ✓'
              ) : isQuickLogMode ? (
                'Save Quick Log ✓'
              ) : (
                'Log PM ✓'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Celebration */}
      {showCelebration && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="bg-white rounded-2xl p-8 text-center max-w-sm mx-4">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">{streakData?.streak || 0} Day Streak!</h3>
            <p className="text-gray-600">You're building great habits. Keep it up!</p>
          </motion.div>
        </motion.div>
      )}

      {/* Shield Restore Reminder — bottom sheet */}
      <AnimatePresence>
        {showShieldRestore && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowShieldRestore(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 40 }}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              style={{
                position: 'fixed', bottom: 0, left: 0, right: 0,
                background: '#fff', borderRadius: '24px 24px 0 0',
                padding: '12px 24px 48px', zIndex: 50,
                boxShadow: '0 -8px 40px rgba(0,0,0,0.14)',
              }}
            >
              {/* drag handle */}
              <div style={{ width: 40, height: 4, background: '#e0ddd8', borderRadius: 99, margin: '0 auto 24px' }} />

              {/* Shield icon */}
              <div style={{ width: 64, height: 64, borderRadius: 18, background: 'rgba(196,64,51,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <span style={{ fontSize: 32 }}>🛡️</span>
              </div>

              <h3 style={{ fontSize: 22, fontWeight: 700, textAlign: 'center', color: '#191716', fontFamily: 'Crimson Pro, serif', marginBottom: 8 }}>
                Don't lose your streak!
              </h3>

              <p style={{ fontSize: 14, color: '#7a756d', fontFamily: 'Outfit, sans-serif', textAlign: 'center', lineHeight: 1.6, marginBottom: 10 }}>
                You missed today's routine. Activate a shield to keep your streak alive.
              </p>

              {/* Shield count pill */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(196,64,51,0.07)', borderRadius: 99, padding: '6px 16px' }}>
                  <Shield size={14} style={{ color: '#c44033' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#c44033', fontFamily: 'Outfit, sans-serif' }}>
                    {availableShields} shield{availableShields !== 1 ? 's' : ''} available
                  </span>
                </div>
              </div>

              {availableShields > 0 ? (
                <button
                  onClick={restoreStreakWithShield}
                  style={{
                    width: '100%', padding: '16px', borderRadius: 14, border: 'none',
                    background: '#c44033', color: '#fff',
                    fontSize: 15, fontWeight: 700, fontFamily: 'Outfit, sans-serif',
                    cursor: 'pointer', marginBottom: 12,
                    boxShadow: 'rgba(196,64,51,0.25) 0px 6px 20px',
                  }}
                >
                  🛡️ Restore Streak
                </button>
              ) : (
                <div style={{ textAlign: 'center', marginBottom: 12, padding: '14px', background: '#fef2f2', borderRadius: 14 }}>
                  <p style={{ fontSize: 13, color: '#c44033', fontFamily: 'Outfit, sans-serif', margin: 0, fontWeight: 600 }}>
                    No shields available this month
                  </p>
                  <p style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'Outfit, sans-serif', margin: '4px 0 0' }}>
                    Your streak will reset. New shields arrive next month.
                  </p>
                </div>
              )}

              <button
                onClick={() => setShowShieldRestore(false)}
                style={{ display: 'block', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#9ca3af', padding: '8px 0', fontFamily: 'Outfit, sans-serif' }}
              >
                Maybe later
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      {/* Shield Success Animation */}
      <AnimatePresence>
        {showShieldSuccess && shieldRestoreData && (
          <ShieldSuccessAnimation
            streakRestored={shieldRestoreData.streakRestored}
            shieldsRemaining={shieldRestoreData.shieldsRemaining}
            previousStreak={shieldRestoreData.previousStreak}
            newStreak={shieldRestoreData.newStreak}
          />
        )}
      </AnimatePresence>

      {/* Quick Log Drawer */}
      <AnimatePresence>
        {showQuickLogDrawer && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowQuickLogDrawer(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40 }}
            />
            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              style={{
                position: 'fixed', bottom: 0, left: 0, right: 0,
                background: '#fff', borderRadius: '20px 20px 0 0',
                padding: '12px 20px 40px', zIndex: 50,
                boxShadow: '0 -8px 40px rgba(0,0,0,0.12)',
              }}
            >
              {/* Drag handle */}
              <div style={{ width: 40, height: 4, background: '#e0ddd8', borderRadius: 99, margin: '0 auto 20px' }} />

              <h3 style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 20, color: '#191716', fontFamily: 'Outfit, sans-serif' }}>
                Quick Log
              </h3>

              {/* Option: Did some routine */}
              <button
                onClick={() => {
                  setQuickLogType('some_routine');
                  setAmRoutine(true);
                  setIsQuickLogMode(true);
                  setShowQuickLogDrawer(false);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                  padding: '16px', borderRadius: 14, marginBottom: 12,
                  background: '#f0fdf4', border: '1.5px solid #86efac', cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fff', border: '1.5px solid #d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <rect x="1" y="1" width="16" height="16" rx="4" stroke="#10b981" strokeWidth="1.5" />
                    <path d="M5 9l3 3 5-5" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#191716', fontFamily: 'Outfit, sans-serif' }}>Did some routine</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Streak preserved</div>
                </div>
              </button>

              {/* Option: Just sunscreen */}
              <button
                onClick={() => {
                  setQuickLogType('just_sunscreen');
                  setAmRoutine(true);
                  setSunscreen(true);
                  setIsQuickLogMode(true);
                  setShowQuickLogDrawer(false);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                  padding: '16px', borderRadius: 14, marginBottom: 12,
                  background: '#eff6ff', border: '1.5px solid #93c5fd', cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fff', border: '1.5px solid #dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="4" fill="#3b82f6" />
                    <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#191716', fontFamily: 'Outfit, sans-serif' }}>Just sunscreen</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Streak preserved</div>
                </div>
              </button>

              {/* Option: Couldn't today */}
              <button
                onClick={() => {
                  setShowQuickLogDrawer(false);
                  setShowShieldRestore(true);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                  padding: '16px', borderRadius: 14, marginBottom: 24,
                  background: '#f9fafb', border: '1.5px solid #e5e7eb', cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fff', border: '1.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <rect x="1" y="1" width="16" height="16" rx="4" stroke="#9ca3af" strokeWidth="1.5" />
                    <path d="M5 9h8" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#191716', fontFamily: 'Outfit, sans-serif' }}>Couldn't today</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Shield used ({availableShields} left)</div>
                </div>
              </button>

              <button
                onClick={() => setShowQuickLogDrawer(false)}
                style={{ display: 'block', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#9ca3af', padding: '8px 0', fontFamily: 'Outfit, sans-serif' }}
              >
                Cancel
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}
