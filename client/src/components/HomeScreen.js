import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOffline } from '../contexts/OfflineContext';
import { useGamification } from '../contexts/GamificationContext';
import { useNotifications } from '../contexts/NotificationContext';
import { saveCheckIn, getTodayCheckIn, getCheckIns } from '../utils/db';
import { calculateDay, calculateStreak, calculateShields, isMilestoneDay, isWeeklyPhotoDay, generateId } from '../utils/helpers';
import { Flame, Shield, Sun, Moon, Droplets, Utensils, Frown, Meh, Smile } from 'lucide-react';
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

  const [amRoutine, setAmRoutine] = useState(false);
  const [pmRoutine, setPmRoutine] = useState(false);
  const [sunscreen, setSunscreen] = useState(false);
  const [dietFollowed, setDietFollowed] = useState('Yes');
  const [triggerFoods, setTriggerFoods] = useState([]);
  const [waterIntake, setWaterIntake] = useState(2);
  const [skinMood, setSkinMood] = useState('Okay');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [showGamification, setShowGamification] = useState(false);
  const [newAchievement, setNewAchievement] = useState(null);

  useEffect(() => {
    // Check for milestone prompts
    if (isMilestoneDay(day)) {
      navigate('/skin-score');
    } else if (isWeeklyPhotoDay(patient?.startDate)) {
      navigate('/weekly-photo');
    }
  }, [day, patient, navigate]);

  useEffect(() => {
    // Load today's check-in if exists
    const loadToday = async () => {
      const today = await getTodayCheckIn(patient?.phoneNumber);
      if (today) {
        setAmRoutine(today.amRoutine);
        setPmRoutine(today.pmRoutine);
        setSunscreen(today.sunscreen);
        setDietFollowed(today.dietFollowed);
        setTriggerFoods(today.triggerFoods || []);
        setWaterIntake(today.waterIntake);
        setSkinMood(today.skinMood);
        setHasSubmitted(true);
      }
    };
    loadToday();
  }, [patient]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    const checkInData = {
      id: generateId(),
      patientId: patient?.id,
      patientPhone: patient?.phoneNumber,
      date: new Date().toISOString().split('T')[0],
      day,
      amRoutine,
      pmRoutine,
      sunscreen,
      dietFollowed,
      triggerFoods,
      waterIntake,
      skinMood,
      synced: false
    };

    // Save to IndexedDB
    await saveCheckIn(checkInData);

    // Queue for sync if online
    if (isOnline) {
      queueForSync('checkin', checkInData);
    }

    // Award points for daily check-in
    awardPoints('daily_checkin');
    
    // Award bonus points for perfect day
    if (amRoutine && pmRoutine && sunscreen && dietFollowed === 'Yes' && waterIntake >= 3) {
      awardPoints('perfect_day');
    }

    // Refresh streak
    await refreshStreak();

    // Check for achievements
    const checkIns = await getCheckIns();
    const userStats = {
      totalCheckins: checkIns.length,
      currentStreak: calculateStreak(checkIns),
      photoCount: 0, // Would need to fetch from photos
      skinScores: 0, // Would need to fetch from skin scores
      earlyCheckins: 0, // Would need to check time of check-ins
      pmConsistency: 0.8, // Would need to calculate
      hydrationStreak: 0 // Would need to calculate
    };
    checkAchievements(userStats);

    // Check for celebration
    const currentStreak = calculateStreak(checkIns);
    if (currentStreak > 0 && currentStreak % 7 === 0) {
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 3000);
    }

    setHasSubmitted(true);
    setIsSubmitting(false);
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
            <div className="flex items-center gap-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <Shield 
                  key={i} 
                  className={`w-5 h-5 ${i < shields ? 'text-blue-500 fill-blue-500' : 'text-gray-300'}`}
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
          {milestones.map((m, i) => (
            <div key={m.day} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                day >= m.day 
                  ? 'bg-[#c44033] text-white' 
                  : day >= m.day - 7 
                    ? 'bg-[#c44033]/20 text-[#c44033] border-2 border-[#c44033]' 
                    : 'bg-gray-200 text-gray-400'
              }`}>
                {m.day === 1 ? '1' : m.day === 28 ? '28' : m.day === 56 ? '56' : '84'}
              </div>
              {i < milestones.length - 1 && (
                <div className={`w-8 h-0.5 mx-1 ${day > m.day ? 'bg-[#c44033]' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Check-in Card */}
        <div className="card space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Sun className="w-5 h-5 text-[#c44033]" />
            Daily Routine
          </h3>
          
          <div className="space-y-3">
            <ToggleRow icon={<Sun className="w-4 h-4" />} label="AM Routine" checked={amRoutine} onChange={setAmRoutine} />
            <ToggleRow icon={<Moon className="w-4 h-4" />} label="PM Routine" checked={pmRoutine} onChange={setPmRoutine} />
            <ToggleRow icon={<span>☀️</span>} label="Sunscreen" checked={sunscreen} onChange={setSunscreen} />
          </div>
        </div>

        {/* Diet Card */}
        <div className="card space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Utensils className="w-5 h-5 text-[#c44033]" />
            Diet & Hydration
          </h3>
          
          <div>
            <p className="text-sm text-gray-600 mb-2">Followed diet today?</p>
            <div className="flex gap-2">
              {['Yes', 'Mostly', 'No'].map((option) => (
                <button
                  key={option}
                  onClick={() => setDietFollowed(option)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    dietFollowed === option ? 'bg-[#c44033] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-2">Trigger foods consumed</p>
            <div className="flex flex-wrap gap-2">
              {['Dairy', 'Sugar', 'Gluten', 'Spicy', 'Fried', 'Caffeine', 'Alcohol'].map((food) => (
                <button
                  key={food}
                  onClick={() => toggleTriggerFood(food)}
                  className={`chip ${triggerFoods.includes(food) ? 'chip-active' : 'chip-inactive'}`}
                >
                  {food}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-2">Water intake</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((level) => (
                <button
                  key={level}
                  onClick={() => setWaterIntake(level)}
                  className={`flex-1 py-3 rounded-lg flex justify-center transition-all ${
                    waterIntake >= level ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  <Droplets className={`w-5 h-5 ${waterIntake >= level ? 'fill-blue-500' : ''}`} />
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1 text-center">
              {waterIntake === 1 && '1 glass'}
              {waterIntake === 2 && '2-4 glasses'}
              {waterIntake === 3 && '5-7 glasses'}
              {waterIntake === 4 && '8+ glasses'}
            </p>
          </div>
        </div>

        {/* Skin Mood Card */}
        <div className="card space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">How is your skin feeling today?</h3>
          <div className="flex justify-center gap-4">
            <button onClick={() => setSkinMood('Good')} className={`emoji-btn ${skinMood === 'Good' ? 'emoji-btn-active' : 'emoji-btn-inactive'}`}>
              <Smile className="w-8 h-8 text-green-500" />
              <span className="text-xs mt-1 font-medium">Good</span>
            </button>
            <button onClick={() => setSkinMood('Okay')} className={`emoji-btn ${skinMood === 'Okay' ? 'emoji-btn-active' : 'emoji-btn-inactive'}`}>
              <Meh className="w-8 h-8 text-yellow-500" />
              <span className="text-xs mt-1 font-medium">Okay</span>
            </button>
            <button onClick={() => setSkinMood('Off')} className={`emoji-btn ${skinMood === 'Off' ? 'emoji-btn-active' : 'emoji-btn-inactive'}`}>
              <Frown className="w-8 h-8 text-red-500" />
              <span className="text-xs mt-1 font-medium">Off</span>
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <button onClick={handleSubmit} disabled={isSubmitting} className="btn-primary w-full">
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving...
            </span>
          ) : hasSubmitted ? 'Update Check-in' : 'Submit Check-in'}
        </button>
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

      {/* Gamification Panel */}
      {showGamification && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Your Progress</h2>
              <button onClick={() => setShowGamification(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <GamificationPanel />
          </motion.div>
        </motion.div>
      )}

      {/* Achievement Popup */}
      {newAchievement && (
        <AchievementPopup 
          achievement={newAchievement} 
          onClose={() => setNewAchievement(null)}
          onShare={(achievement) => {
            // Share achievement logic
            console.log('Sharing achievement:', achievement);
          }}
        />
      )}

      {/* Gamification Button */}
      <button
        onClick={() => setShowGamification(true)}
        className="fixed bottom-24 right-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white p-3 rounded-full shadow-lg z-40"
        aria-label="View progress and achievements"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
    </div>
  );
}

function ToggleRow({ icon, label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">{icon}</div>
        <span className="font-medium text-gray-900">{label}</span>
      </div>
      <button onClick={() => onChange(!checked)} className={`toggle-btn ${checked ? 'toggle-btn-active' : 'toggle-btn-inactive'}`}>
        <div className={`toggle-knob ${checked ? 'toggle-knob-active' : ''}`} />
      </button>
    </div>
  );
}
