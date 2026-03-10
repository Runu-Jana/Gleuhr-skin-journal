import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Shield, Frown, Meh, Smile } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useOffline } from '../contexts/OfflineContext';
import { useGamification } from '../contexts/GamificationContext';
import { saveCheckIn, getTodayCheckIn, getCheckIns, getLatestSkinScore, getWeeklyPhotos, getPatient } from '../utils/db';
import { calculateDay, calculateShields, isMilestoneDay, isWeeklyPhotoDay, generateId } from '../utils/helpers';
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

  // Check if AM routine is already logged today
  const checkTodayAMRoutine = async () => {
    try {
      const todayCheckIn = await getTodayCheckIn(patient?.phoneNumber);
      if (todayCheckIn && todayCheckIn.amRoutine) {
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

  const handleQuickLogSubmit = async (amStatus = 'complete') => {
    if (!patient?.phone) return;
    
    setIsSubmitting(true);
    
    try {
      const checkInData = {
        id: `checkin-${Date.now()}`, // Add required ID for IndexedDB
        patientPhone: patient?.phone || patient?.phoneNumber,
        patientEmail: patient?.email,
        date: new Date().toISOString(),
        day,
        amRoutine,
        pmRoutine,
        dietFollowed: 'skipped', // Skip diet question
        waterIntake: 0, // Skip water question
        skinMood: 'good', // Default mood for quick log
        triggerFoods: [],
        amRoutineStatus: amStatus, // 'complete', 'partial', or 'incomplete'
        synced: false
      };

      // Save to IndexedDB first
      await saveCheckIn(checkInData);
      
      // Try to sync with server if online
      if (isOnline) {
        try {
          const response = await fetch('/api/checkin', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(checkInData),
          });

          if (response.ok) {
            const result = await response.json();
            checkInData.synced = true;
            checkInData.id = result.id;
            await saveCheckIn(checkInData);
            console.log('Quick log saved to MongoDB successfully!');
          }
        } catch (apiError) {
          console.error('Failed to sync quick log to MongoDB:', apiError);
        }
      }

      // Award points for routine completion
      if (amRoutine) awardPoints('am_routine');
      if (pmRoutine) awardPoints('am_routine');
      
      // Refresh streak with small delay to ensure server update is complete
      try {
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms for server to update
        await refreshStreak();
      } catch (streakError) {
        console.error('Error refreshing streak in quick log:', streakError);
        // Don't fail the entire submission if streak refresh fails
      }
      
      // Check if current day is a milestone and show celebration
      if (isMilestoneDay(day)) {
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 5000);
      }
      
      // Stay on PM page to complete PM routine questions
      
    } catch (error) {
      console.error('Error in quick log submission:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Restore streak using shield
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

  useEffect(() => {
    const checkMilestone = async () => {
      // Only redirect to skin-score on milestone days if not already completed
      const latestScore = await getLatestSkinScore(patient?.phoneNumber || patient?.phone);
      const today = new Date().toISOString().split('T')[0];
      const alreadyScoredToday = latestScore && latestScore.date === today;

      if (isMilestoneDay(day) && !alreadyScoredToday) {
        navigate('/skin-score');
      } else if (isWeeklyPhotoDay(patient?.startDate)) {
        const photos = await getWeeklyPhotos(patient?.phoneNumber || patient?.phone);
        const alreadyPhotoed = photos?.some(p => p.date === today);
        if (!alreadyPhotoed) {
          navigate('/weekly-photo');
        }
      }
    };
    if (patient) checkMilestone();
  }, [day, patient, navigate]);

  useEffect(() => {
    // Load today's PM check-in if exists
    const loadToday = async () => {
      const today = await getTodayCheckIn(patient?.phoneNumber);
      if (today && today.pmRoutine) {
        setPmRoutine(today.pmRoutine);
        setDietFollowed(today.dietFollowed);
        setTriggerFoods(today.triggerFoods || []);
        setWaterIntake(today.waterIntake);
        setSkinMood(today.skinMood);
        setHasSubmitted(true);
      }
    };
    loadToday();
  }, [patient]);

  const handleAMRoutineToggle = async () => {
    const newAmRoutine = !amRoutine;
    setAmRoutine(newAmRoutine);
    
    // Auto-save to database when toggled to true
    if (newAmRoutine) {
      try {
        // Get today's existing check-in data
        const existingCheckIn = await getTodayCheckIn(patient?.phoneNumber);
        
        const checkInData = {
          id: existingCheckIn?.id || generateId(),
          patientId: patient?.id,
          patientPhone: patient?.phoneNumber,
          date: new Date().toISOString().split('T')[0],
          day,
          amRoutine: true,
          sunscreen,
          // Preserve existing PM data if any
          pmRoutine: existingCheckIn?.pmRoutine || false,
          dietFollowed: existingCheckIn?.dietFollowed || '',
          triggerFoods: existingCheckIn?.triggerFoods || [],
          waterIntake: existingCheckIn?.waterIntake || 0,
          skinMood: existingCheckIn?.skinMood || '',
          synced: false
        };

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
          
          if (result.success) {
            // Update local record as synced
            checkInData.synced = true;
            checkInData.id = result.id;
            await saveCheckIn(checkInData);
            console.log('AM routine auto-saved to MongoDB successfully!');
          }
        } catch (apiError) {
          console.error('Failed to auto-save AM routine to MongoDB:', apiError);
        }

        // Award points for AM routine
        awardPoints('am_routine');
        
        // Refresh streak
        await refreshStreak();
        
        setHasSubmitted(true);
      } catch (error) {
        console.error('Error auto-saving AM routine:', error);
        // Revert state if save fails
        setAmRoutine(false);
      }
    }
  };

  const handleSunscreenToggle = async () => {
    const newSunscreen = !sunscreen;
    setSunscreen(newSunscreen);
    
    // Auto-save to database when toggled to true
    if (newSunscreen) {
      try {
        // Get today's existing check-in data
        const existingCheckIn = await getTodayCheckIn(patient?.phoneNumber);
        
        const checkInData = {
          id: existingCheckIn?.id || generateId(),
          patientId: patient?.id,
          patientPhone: patient?.phoneNumber,
          date: new Date().toISOString().split('T')[0],
          day,
          amRoutine,
          sunscreen: true,
          // Preserve existing PM data if any
          pmRoutine: existingCheckIn?.pmRoutine || false,
          dietFollowed: existingCheckIn?.dietFollowed || '',
          triggerFoods: existingCheckIn?.triggerFoods || [],
          waterIntake: existingCheckIn?.waterIntake || 0,
          skinMood: existingCheckIn?.skinMood || '',
          synced: false
        };

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
          
          if (result.success) {
            // Update local record as synced
            checkInData.synced = true;
            checkInData.id = result.id;
            await saveCheckIn(checkInData);
            console.log('Sunscreen auto-saved to MongoDB successfully!');
          }
        } catch (apiError) {
          console.error('Failed to auto-save sunscreen to MongoDB:', apiError);
        }

        setHasSubmitted(true);
      } catch (error) {
        console.error('Error auto-saving sunscreen:', error);
        // Revert state if save fails
        setSunscreen(false);
      }
    }
  };

  const handleSubmit = async () => {
    // Validate required fields (skip validation in quick log mode)
    if (!isQuickLogMode) {
      if (waterIntake === 0) {
        alert('Please select your water intake for today');
        return;
      }
      if (!dietFollowed) {
        alert('Please select if you followed your diet plan');
        return;
      }
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
    
    const checkInData = {
      id: existingCheckIn?.id || generateId(),
      patientId: patientId,
      patientPhone: phoneNumber,
      date: new Date().toISOString().split('T')[0],
      day,
      // Preserve existing AM data if any
      amRoutine: existingCheckIn?.amRoutine || false,
      sunscreen: existingCheckIn?.sunscreen || false,
      // Add PM data
      pmRoutine: true,
      dietFollowed,
      triggerFoods,
      waterIntake,
      skinMood,
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
                  <div className="text-sm font-semibold text-gray-900 tracking-tight">
                    Your best streak <span className="text-red-600" style={{ fontFamily: 'Playfair Display, serif', fontSize: '16px sm:20px', fontWeight: '700', marginLeft: '2px' }}>{streakData?.longestStreak || 0}</span> <span className="text-xs text-gray-600 font-normal">days</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1 flex items-center gap-1.5">
                    <span className="xs:inline">Red Hot flame</span>
                    <span className="xs:inline">⚆</span>
                    <span className="w-1 h-1 rounded-full bg-gray-300 hidden xs:inline"></span>
                    <span>{Math.round(progress)}% consistent</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 px-5 py-2.5 sm:px-2 sm:py-1 rounded-lg flex-shrink-0 mb-3 sm:mb-0 border border-red-100" style={{ background: 'rgba(196, 64, 51, 0.05)' }}>
                <Shield className={`w-3 h-3 sm:w-4 sm:h-4 ${getShieldColor(availableShields)}`} />
                <span className={`text-xs sm:text-sm font-bold ${availableShields >= 3 ? 'text-green-700' : availableShields === 2 ? 'text-yellow-700' : availableShields === 1 ? 'text-red-700' : 'text-gray-700'}`}>{streakData?.restorationShields?.available}</span>
                <span className={`text-xs ${availableShields >= 3 ? 'text-green-600' : availableShields === 2 ? 'text-yellow-600' : availableShields === 1 ? 'text-red-600' : 'text-gray-600'} hidden sm:inline py-2 `}>shields</span>
                {streakData?.streak === 0 && availableShields > 0 && (
                  <button 
                    onClick={() => setShowShieldRestore(true)}
                    className={`ml-1 ${availableShields >= 3 ? 'text-green-600 hover:text-green-700' : availableShields === 2 ? 'text-yellow-600 hover:text-yellow-700' : availableShields === 1 ? 'text-red-600 hover:text-red-700' : 'text-gray-600 hover:text-gray-700'}`}
                    title="Use shield to restore streak"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                )}
              </div>
              
            </div>
          </div>

          {!hasAMRoutineToday && (
            <div 
              onClick={() => setShowQuickLogDrawer(true)}
              className="mx-4 mb-3 sm:mx-5 sm:mb-3 px-3 py-2 sm:px-4 sm:py-2.5 bg-gray-50 rounded-xl flex justify-between items-center cursor-pointer border border-gray-200"
            >
              <span className="text-xs sm:text-sm text-gray-500">Tough day? <span className="font-semibold text-gray-700">Quick log</span></span>
              <svg width="12" height="12" className="sm:w-14 sm:h-14" viewBox="0 0 14 14" fill="none">
                <path d="M7 13C10.3137 13 13 10.3137 13 7C13 3.68629 10.3137 1 7 1C3.68629 1 1 3.68629 1 7C1 10.3137 3.68629 13 7 13Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7 4V7L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          <div className="px-4 sm:px-5 flex flex-col gap-3 sm:gap-3.5">
            {/* AM Routine Status - Only show if not already logged today */}
            {!hasAMRoutineToday && (
              <div style={{ padding: '10px 12px', background: 'rgba(212, 160, 23, 0.08)', borderRadius: '12px', border: '1px solid rgba(212, 160, 23, 0.15)' }}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <div 
                    onClick={() => {
                      setAmRoutine(!amRoutine);
                      setSunscreen(!amRoutine); // Toggle both AM routine and sunscreen together
                    }}
                    style={{ width: '20px', height: '20px', borderRadius: '5px', border: '1.5px solid rgb(204, 200, 192)', background: 'rgb(255, 255, 255)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0' }}
                  >
                    {amRoutine && (
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                        <path d="M13.5 4.5L6 12l-3.5-3.5" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                      </svg>
                    )}
                  </div>
                  <span style={{ fontSize: '12px', color: 'rgb(61, 57, 53)', fontFamily: 'Outfit, sans-serif', lineHeight: '1.4' }}>Completed AM routine this morning?</span>
                </label>
              </div>
            )}

            {/* PM Routine Toggle */}
            <button 
              onClick={() => setPmRoutine(!pmRoutine)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '14px 16px', background: 'rgb(255, 255, 255)', border: '1.5px solid rgb(224, 221, 215)', borderRadius: '14px', cursor: 'pointer', transition: '0.25s' }}
            >
              <span style={{ fontSize: '14px', fontWeight: '600', color: 'rgb(25, 23, 22)', fontFamily: 'crimson, sans-serif', letterSpacing: '-0.2px' }}>PM Routine Completed</span>
              <div style={{ width: '44px', height: '26px', borderRadius: '13px', padding: '2px', background: pmRoutine ? '#10b981' : 'rgb(204, 200, 192)', transition: 'background 0.25s', display: 'flex', alignItems: 'center' }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '11px', background: 'rgb(255, 255, 255)', boxShadow: 'rgba(0, 0, 0, 0.18) 0px 1px 4px', transform: pmRoutine ? 'translateX(18px)' : 'translateX(0px)', transition: 'transform 0.25s' }}></div>
              </div>
            </button>

            {/* Diet Plan */}
            {!isQuickLogMode && (
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-2">Followed diet plan?</p>
                <div className="flex gap-1.5 sm:gap-2 mb-3">
                  {['Yes ✓', 'Mostly', 'Not today'].map((option) => (
                    <button
                      key={option}
                      onClick={() => setDietFollowed(option)}
                      className={`flex-1 px-2 py-2.5 sm:px-3 sm:py-3.5 rounded-xl border cursor-pointer text-xs sm:text-sm transition-all ${
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
            )}

            {/* Water Intake */}
            {!isQuickLogMode && (
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
                    onClick={() => setWaterIntake(option.value)}
                    className={`flex-1 px-1 py-3 rounded-xl border cursor-pointer flex flex-col items-center gap-1.5 transition-all ${
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
            )}

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
                    onClick={() => setSkinMood(option.value)}
                    className={`flex-1 px-2 py-3.5 rounded-xl border cursor-pointer flex flex-col items-center gap-1.25 transition-all ${
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
            {!isQuickLogMode && (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full px-4.5 py-5 rounded-xl text-white border-none text-base font-semibold cursor-pointer font-sans mt-1 mb-4 transition-all"
                style={{ 
                  background: isSubmitting ? '#9ca3af' : '#c44033',
                  boxShadow: 'rgba(196, 64, 51, 0.208) 0px 6px 20px'
                }}
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Saving...</span>
                  </div>
                ) : (
                  'Log PM ✓'
                )}
              </button>
            )}
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

      {/* Quick Log Drawer */}
      {showQuickLogDrawer && (
        <motion.div 
          initial={{ y: '100%' }} 
          animate={{ y: 0 }} 
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed inset-0 z-50 flex items-end"
          onClick={() => setShowQuickLogDrawer(false)}
        >
          <motion.div 
            initial={{ y: '100%' }} 
            animate={{ y: 0 }} 
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-full"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'rgb(255, 255, 255)',
              borderRadius: '24px 24px 0px 0px',
              boxShadow: 'rgba(0, 0, 0, 0.12) 0px -12px 40px',
              padding: '20px 20px 36px'
            }}
          >
            {/* Handle */}
            <div style={{
              width: '36px',
              height: '4px',
              background: 'rgb(224, 221, 215)',
              borderRadius: '2px',
              margin: '0px auto 20px'
            }}></div>
            
            {/* Title */}
            <p style={{
              fontSize: '17px',
              fontWeight: '600',
              color: 'rgb(25, 23, 22)',
              fontFamily: 'Outfit, sans-serif',
              marginBottom: '16px',
              textAlign: 'center'
            }}>Quick Log</p>
            
            {/* Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Did some routine */}
              <button
                onClick={() => {
                  setPmRoutine(true);
                  setAmRoutine(true);
                  setHasAMRoutineToday(true); // Mark AM as completed
                  setShowQuickLogDrawer(false);
                  // Submit AM data but stay on PM page for questions
                  handleQuickLogSubmit('complete');
                }}
                style={{
                  width: '100%',
                  padding: '18px 20px',
                  background: 'rgba(26, 138, 74, 0.08)',
                  border: '1.5px solid rgb(26, 138, 74)',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px'
                }}
              >
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgb(255, 255, 255)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  border: '1px solid rgba(26, 138, 74, 0.25)'
                }}>✓</div>
                <div>
                  <div style={{
                    fontSize: '15px',
                    fontWeight: '600',
                    color: 'rgb(25, 23, 22)',
                    fontFamily: 'Outfit, sans-serif'
                  }}>Did some routine</div>
                  <div style={{
                    fontSize: '12px',
                    color: 'rgb(122, 117, 109)',
                    fontFamily: 'Outfit, sans-serif',
                    marginTop: '1px'
                  }}>Streak preserved</div>
                </div>
              </button>

              {/* Just sunscreen */}
              <button
                onClick={() => {
                  setPmRoutine(true);
                  setAmRoutine(true);
                  setHasAMRoutineToday(true); // Mark AM as completed
                  setShowQuickLogDrawer(false);
                  // Submit AM data but stay on PM page for questions
                  handleQuickLogSubmit('partial');
                }}
                style={{
                  width: '100%',
                  padding: '18px 20px',
                  background: 'rgba(37, 99, 235, 0.06)',
                  border: '1.5px solid rgb(59, 130, 246)',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px'
                }}
              >
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgb(255, 255, 255)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  border: '1px solid rgba(59, 130, 246, 0.25)'
                }}>☀</div>
                <div>
                  <div style={{
                    fontSize: '15px',
                    fontWeight: '600',
                    color: 'rgb(25, 23, 22)',
                    fontFamily: 'Outfit, sans-serif'
                  }}>Just sunscreen</div>
                  <div style={{
                    fontSize: '12px',
                    color: 'rgb(122, 117, 109)',
                    fontFamily: 'Outfit, sans-serif',
                    marginTop: '1px'
                  }}>Streak preserved</div>
                </div>
              </button>

              {/* Couldn't today */}
              <button
                onClick={() => {
                  setPmRoutine(false);
                  setAmRoutine(false);
                  setHasAMRoutineToday(false); // Mark AM as incomplete
                  setShowQuickLogDrawer(false);
                  // Open shield restore modal
                  setShowShieldRestore(true);
                }}
                style={{
                  width: '100%',
                  padding: '18px 20px',
                  background: 'rgb(250, 249, 247)',
                  border: '1.5px solid rgb(204, 200, 192)',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px'
                }}
              >
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgb(255, 255, 255)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  border: '1px solid rgba(204, 200, 192, 0.25)'
                }}>—</div>
                <div>
                  <div style={{
                    fontSize: '15px',
                    fontWeight: '600',
                    color: 'rgb(25, 23, 22)',
                    fontFamily: 'Outfit, sans-serif'
                  }}>Couldn't today</div>
                  <div style={{
                    fontSize: '12px',
                    color: 'rgb(122, 117, 109)',
                    fontFamily: 'Outfit, sans-serif',
                    marginTop: '1px'
                  }}>Shield used (2 left)</div>
                </div>
              </button>
            </div>

            {/* Cancel Button */}
            <button
              onClick={() => setShowQuickLogDrawer(false)}
              style={{
                width: '100%',
                marginTop: '14px',
                padding: '14px',
                background: 'none',
                border: 'medium',
                color: 'rgb(163, 158, 149)',
                fontSize: '13px',
                cursor: 'pointer',
                fontFamily: 'Outfit, sans-serif'
              }}
            >Cancel</button>
          </motion.div>
        </motion.div>
      )}
      
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
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}
