import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Shield, Sun, Droplets, Utensils, Frown, Meh, Smile, Flame } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useOffline } from '../contexts/OfflineContext';
import { useGamification } from '../contexts/GamificationContext';
import { useNotifications } from '../contexts/NotificationContext';
import { saveCheckIn, getTodayCheckIn } from '../utils/db';
import { calculateDay, calculateShields, isMilestoneDay, isWeeklyPhotoDay, generateId } from '../utils/helpers';
import { getTimeOfDay, getTodayCheckInStatus } from '../utils/timeUtils';
import ShieldSuccessAnimation from './ShieldSuccessAnimation';
import ReorderBanner from './ReorderBanner';
import GamificationPanel from './GamificationPanel';
import AchievementPopup from './AchievementPopup';

export default function AMPage() {
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
    if (count >= 3) return 'text-green-600 fill-green-600';
    if (count === 2) return 'text-yellow-600 fill-yellow-600';
    if (count === 1) return 'text-red-600 fill-red-600';
    return 'text-gray-300 fill-gray-300';
  };

  const [amRoutine, setAmRoutine] = useState(false);
  const [sunscreen, setSunscreen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [showGamification, setShowGamification] = useState(false);
  const [newAchievement, setNewAchievement] = useState(null);
  const [showShieldRestore, setShowShieldRestore] = useState(false);
  const [showShieldSuccess, setShowShieldSuccess] = useState(false);
  const [shieldRestoreData, setShieldRestoreData] = useState(null);
  const [showCheckinSuccess, setShowCheckinSuccess] = useState(false);

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
    // Check for milestone prompts
    if (isMilestoneDay(day)) {
      navigate('/skin-score');
    } else if (isWeeklyPhotoDay(patient?.startDate)) {
      navigate('/weekly-photo');
    }
  }, [day, patient, navigate]);

  useEffect(() => {
    // Load today's AM check-in if exists
    const loadToday = async () => {
      const today = await getTodayCheckIn(patient?.phoneNumber);
      if (today && today.amRoutine) {
        setAmRoutine(today.amRoutine);
        setSunscreen(today.sunscreen);
        setHasSubmitted(true);
      }
    };
    loadToday();
  }, [patient]);

  const handleAMRoutineToggle = async () => {
    const newAmRoutine = !amRoutine;
    setAmRoutine(newAmRoutine);
    
    // Don't auto-save when toggling AM routine anymore
    // Just update the state, submission will happen via the submit button
  };

  const handleSunscreenToggle = async () => {
    const newSunscreen = !sunscreen;
    setSunscreen(newSunscreen);
    
    // Don't auto-save when toggling sunscreen anymore
    // Just update the state, submission will happen via the submit button
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      // Get today's existing check-in data
      const existingCheckIn = await getTodayCheckIn(patient?.phoneNumber);
      
      const checkInData = {
        id: existingCheckIn?.id || generateId(),
        patientId: patient?.id,
        patientPhone: patient?.phoneNumber,
        date: new Date().toISOString().split('T')[0],
        day,
        amRoutine: amRoutine,
        sunscreen: sunscreen,
        // Preserve existing PM data if any
        pmRoutine: existingCheckIn?.pmRoutine || false,
        dietFollowed: existingCheckIn?.dietFollowed || '',
        triggerFoods: existingCheckIn?.triggerFoods || [],
        waterIntake: existingCheckIn?.waterIntake || 0,
        skinMood: existingCheckIn?.skinMood || '',
        synced: false
      };

      console.log('Submitting AM check-in data:', checkInData);

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
        
        // Check if response is ok before parsing JSON
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('MongoDB AM check-in save response:', result);
        
        if (result.success) {
          // Update local record as synced
          checkInData.synced = true;
          checkInData.id = result.id;
          await saveCheckIn(checkInData);
          console.log('AM check-in saved to MongoDB successfully!');
        }
      } catch (apiError) {
        console.error('Failed to save AM check-in to MongoDB, queuing for sync:', apiError);
        
        // Queue for sync if API fails
        if (isOnline) {
          queueForSync('checkin', checkInData);
        }
      }

      // Award points for AM routine (only if at least one item is completed)
      if (amRoutine || sunscreen) {
        awardPoints('am_routine');
      }
      
      // Refresh streak
      try {
        await refreshStreak();
      } catch (streakError) {
        console.error('Error refreshing streak in AM page:', streakError);
        // Don't fail the entire submission if streak refresh fails
      }

      setHasSubmitted(true);
      
      // Show success message
      setShowCheckinSuccess(true);
      setTimeout(() => setShowCheckinSuccess(false), 3000);
      
    } catch (error) {
      console.error('Error submitting AM check-in:', error);
      alert('Failed to save AM check-in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const milestones = [
    { day: 1, label: 'Day 1', active: day >= 1 },
    { day: 28, label: 'Day 28', active: day >= 28 },
    { day: 56, label: 'Day 56', active: day >= 56 },
    { day: 84, label: 'Day 84', active: day >= 84 },
  ];

  return (
    <div className="min-h-screen bg-[#faf8f5] pb-24">
      {/* Header */}
      <div className="bg-white px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-orange-50 px-3 py-1.5 rounded-full">
              <Flame className="w-5 h-5 text-orange-500" />
              <span className="font-bold text-orange-700">{streakData?.streak || 0}</span>
              <span className="text-xs text-orange-600">day streak</span>
            </div>
            {streakData?.longestStreak > 0 && (
              <div className="flex items-center gap-1 bg-purple-50 px-3 py-1.5 rounded-full">
                <span className="font-bold text-purple-700">{streakData?.longestStreak}</span>
                <span className="text-xs text-purple-600">best</span>
              </div>
            )}
            {streakData?.restorationShields?.available > 0 && (
              <div className="flex items-center gap-1 bg-green-50 px-3 py-1.5 rounded-full">
                <Shield className={`w-4 h-4 ${getShieldColor(availableShields)}`} />
                <span className={`font-bold ${availableShields >= 3 ? 'text-green-700' : availableShields === 2 ? 'text-yellow-700' : availableShields === 1 ? 'text-red-700' : 'text-gray-700'}`}>{streakData?.restorationShields?.available}</span>
                <span className={`text-xs ${availableShields >= 3 ? 'text-green-600' : availableShields === 2 ? 'text-yellow-600' : availableShields === 1 ? 'text-red-600' : 'text-gray-600'}`}>shields</span>
                <button 
                  onClick={() => setShowShieldRestore(true)}
                  className={`ml-1 ${availableShields >= 3 ? 'text-green-600 hover:text-green-700' : availableShields === 2 ? 'text-yellow-600 hover:text-yellow-700' : availableShields === 1 ? 'text-red-600 hover:text-red-700' : 'text-gray-600 hover:text-gray-700'}`}
                  title="Use shield to restore streak"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </div>
            )}
            <div className="flex items-center gap-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <Shield 
                  key={i} 
                  className={`w-5 h-5 ${i < availableShields ? getShieldColor(availableShields) : 'text-gray-300'}`}
                />
              ))}
            </div>
          </div>
          <div className="text-sm text-gray-500">Day {day}/90</div>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Progress Ring */}
        <div className="flex justify-center">
          <div className="relative w-40 h-40">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="80" cy="80" r="70" fill="none" stroke="#e5e7eb" strokeWidth="12" />
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                stroke="#c44033"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 70}`}
                strokeDashoffset={`${2 * Math.PI * 70 * (1 - progress / 100)}`}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold text-gray-900">{day}</span>
              <span className="text-sm text-gray-500">of 90 days</span>
            </div>
          </div>
        </div>

        {/* Milestones */}
        <div className="flex justify-between items-center px-2">
          {milestones.map((milestone) => (
            <div
              key={milestone.day}
              className={`flex-1 text-center ${
                milestone.active ? 'text-blue-600' : 'text-gray-400'
              }`}
            >
              <div className="w-2 h-2 mx-auto mb-1 rounded-full bg-current" />
              <span className="text-xs">{milestone.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* AM Check-in Form */}
      <div className="px-4 py-6">
        <div className="max-w-md mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            <Sun className="w-6 h-6 inline mr-2" />
            AM Routine
          </h2>

          {/* AM Routine Card */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Morning Routine</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between py-4 border-b border-gray-100">
                <span className="text-gray-700 font-medium">AM Routine</span>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleAMRoutineToggle}
                    className={`w-16 h-8 rounded-full transition-colors cursor-pointer ${
                      amRoutine ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform ${
                      amRoutine ? 'translate-x-8' : 'translate-x-2'
                    }`} />
                  </button>
                  <span className={`text-sm font-medium ${
                    amRoutine ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {amRoutine ? 'Completed' : 'Not Started'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between py-4 border-b border-gray-100">
                <span className="text-gray-700 font-medium">Sunscreen</span>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleSunscreenToggle}
                    className={`w-16 h-8 rounded-full transition-colors cursor-pointer ${
                      sunscreen ? 'bg-orange-500' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform ${
                      sunscreen ? 'translate-x-8' : 'translate-x-2'
                    }`} />
                  </button>
                  <span className={`text-sm font-medium ${
                    sunscreen ? 'text-orange-600' : 'text-gray-500'
                  }`}>
                    {sunscreen ? 'Applied' : 'Not Applied'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button 
            onClick={handleSubmit} 
            disabled={isSubmitting || hasSubmitted || !sunscreen} 
            className={`w-full py-4 rounded-xl font-semibold text-white transition-all ${
              hasSubmitted || !sunscreen
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-blue-500 hover:bg-blue-600 active:scale-105'
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </span>
            ) : hasSubmitted ? (
              <span className="flex items-center justify-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                AM Routine Completed
              </span>
            ) : amRoutine && !sunscreen ? (
              <span className="flex items-center justify-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
                </svg>
                Apply Sunscreen
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <Sun className="w-5 h-5 mr-2" />
                Log AM
              </span>
            )}
          </button>

          {/* Return to Home Button */}
          <button 
            onClick={() => navigate('/')} 
            className="w-full py-3 rounded-xl font-semibold text-[#c44033] bg-white border-2 border-[#c44033] hover:bg-[#c44033] hover:text-white transition-all active:scale-105 mt-4"
          >
            <span className="flex items-center justify-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Return to Home
            </span>
          </button>
        </div>
      </div>

      {/* Reorder Banner (Day 25+) */}
      {day >= 25 && <ReorderBanner coachName={patient?.coachName} coachWhatsApp={patient?.coachWhatsApp} day={day} />}

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

      {/* Check-in Success Message */}
      {showCheckinSuccess && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }} 
          animate={{ opacity: 1, y: 0 }} 
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-medium">AM check-in completed successfully!</span>
        </motion.div>
      )}

      {/* Shield Restore Modal */}
      {showShieldRestore && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="bg-white rounded-2xl p-6 text-center max-w-sm mx-4">
            <div className="text-4xl mb-4">🛡️</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Restore Your Streak?</h3>
            <p className="text-gray-600 mb-4">
              Use a shield to restore your streak. You have {streakData?.restorationShields?.available || 0} shields available this month.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowShieldRestore(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={restoreStreakWithShield}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                Use Shield
              </button>
            </div>
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
  );
}
