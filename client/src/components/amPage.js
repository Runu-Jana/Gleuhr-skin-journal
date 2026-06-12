import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Shield, Flame } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useOffline } from '../contexts/OfflineContext';
import { useGamification } from '../contexts/GamificationContext';
import { saveCheckIn, getTodayCheckIn, getCheckIns, getPatient } from '../utils/db';
import { calculateDay, calculateShields, isMilestoneDay, generateId, calculateConsistency } from '../utils/helpers';
import ShieldSuccessAnimation from './ShieldSuccessAnimation';
import ReorderBanner from './ReorderBanner';
import BottomNavigation from './BottomNavigation';

export default function AMPage() {
  const { patient, streak: streakData, refreshStreak } = useAuth();
  const { isOnline, queueForSync } = useOffline();
  const { awardPoints } = useGamification();
  const navigate = useNavigate();

  const day = calculateDay(patient?.startDate);
  const shields = calculateShields(streakData?.streak || 0);
  const availableShields = streakData?.restorationShields?.available || shields || 0;

  const getShieldColor = (count) => {
    if (count >= 3) return 'text-green-600 fill-green-600';
    if (count === 2) return 'text-yellow-600 fill-yellow-600';
    if (count === 1) return 'text-red-600 fill-red-600';
    return 'text-gray-300 fill-gray-300';
  };

  const [amRoutine, setAmRoutine] = useState(false);
  const [sunscreen, setSunscreen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [showShieldRestore, setShowShieldRestore] = useState(false);
  const [showShieldSuccess, setShowShieldSuccess] = useState(false);
  const [shieldRestoreData, setShieldRestoreData] = useState(null);
  const [checkIns, setCheckIns] = useState([]);

  const consistency = calculateConsistency(checkIns, patient?.startDate);

  const restoreStreakWithShield = async () => {
    if (!patient?.phone) return;
    try {
      const yest = new Date(); yest.setDate(yest.getDate() - 1);
      const yesterdayStr = yest.toISOString().split('T')[0];

      const response = await fetch('/api/streak/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: patient.phone })
      });
      const result = await response.json();
      if (result.success) {
        // Persist so the popup won't reappear for this missed day
        localStorage.setItem('gleuhrShieldRestoredDate', yesterdayStr);
        await refreshStreak();
        setShowShieldRestore(false);
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

  const dismissShieldPopup = () => {
    // Remember the dismissal for today so it doesn't reappear on every navigation
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('gleuhrShieldDismissedDate', today);
    setShowShieldRestore(false);
  };

  useEffect(() => {
    const loadToday = async () => {
      try {
        const phone = patient?.phone || patient?.phoneNumber;
        const todayDate = new Date().toISOString().split('T')[0];

        let today = await getTodayCheckIn(patient?.id);

        if (!today && phone) {
          try {
            const res = await fetch(`/api/checkin/${phone}`);
            if (res.ok) {
              const checkins = await res.json();
              today = checkins.find(c => c.date === todayDate);
            }
          } catch { /* non-fatal */ }
        }

        if (today?.date === todayDate) {
          setAmRoutine(today.amRoutine);
          setSunscreen(today.amRoutine ? true : (today.sunscreen || false));
          setHasSubmitted(true);
        }

        const allCheckIns = await getCheckIns(patient?.id);
        setCheckIns(allCheckIns || []);

        // Show shield popup only if: yesterday was missed AND not already dismissed/restored today
        const yest = new Date(); yest.setDate(yest.getDate() - 1);
        const yesterdayStr = yest.toISOString().split('T')[0];
        const shieldRestoredDate = localStorage.getItem('gleuhrShieldRestoredDate');
        const shieldDismissedDate = localStorage.getItem('gleuhrShieldDismissedDate');
        const hadHistory = allCheckIns?.some(c => c.amRoutine || c.pmRoutine || c.shieldRestored);
        const yesterdayActive = allCheckIns?.some(
          c => c.date === yesterdayStr && (c.amRoutine || c.pmRoutine || c.shieldRestored)
        );
        if (
          hadHistory &&
          !yesterdayActive &&
          shieldRestoredDate !== yesterdayStr &&
          shieldDismissedDate !== todayDate
        ) {
          setShowShieldRestore(true);
        }
      } catch (error) {
        console.error('Error loading today check-in:', error);
      } finally {
        setIsLoading(false);
      }
    };
    if (patient) loadToday();
  }, [patient]);

  const handleSubmit = async () => {
    // Hard guard — prevents re-submission even if button is briefly enabled during load
    if (hasSubmitted || isLoading) return;
    if (!amRoutine) {
      alert('Please complete your AM routine before submitting');
      return;
    }
    if (!sunscreen) {
      alert('Please apply sunscreen before submitting');
      return;
    }
    setIsSubmitting(true);
    const phoneNumber = patient?.phoneNumber || patient?.phone;
    if (!phoneNumber) {
      alert('No phone number found. Please check your patient data.');
      setIsSubmitting(false);
      return;
    }
    const patientRecord = await getPatient(phoneNumber);
    if (!patientRecord) {
      alert('Patient record not found. Please contact support.');
      setIsSubmitting(false);
      return;
    }
    const patientId = patientRecord.id;
    const checkInData = {
      id: generateId(),
      patientId,
      patientPhone: phoneNumber,
      date: new Date().toISOString().split('T')[0],
      day,
      amRoutine,
      sunscreen,
      synced: false
    };
    await saveCheckIn(checkInData);
    try {
      const response = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkInData)
      });
      const result = await response.json();
      if (result.success) {
        checkInData.synced = true;
        checkInData.id = result.id;
        await saveCheckIn(checkInData);
      }
    } catch (apiError) {
      console.error('Failed to save AM check-in to MongoDB, queuing for sync:', apiError);
      if (isOnline) queueForSync('checkin', checkInData);
    }
    awardPoints('am_routine');
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      await refreshStreak();
    } catch (streakError) {
      console.error('Error refreshing streak:', streakError);
    }
    if (isMilestoneDay(day)) {
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 5000);
    }
    setHasSubmitted(true);
    setIsSubmitting(false);
    navigate('/checkin-success', {
      state: {
        streak: day,
        message: "Great start to your day! Keep your morning routine going strong."
      }
    });
  };

  // Derived button state
  const alreadyDone = !isLoading && hasSubmitted;
  const canSubmit = !isLoading && !hasSubmitted && amRoutine && sunscreen;

  return (
    <div className="min-h-screen bg-[#ede9e4] pb-24 pt-2">

      {/* Main card */}
      <div className="mx-4 mt-8 bg-white rounded-[28px] shadow-sm overflow-hidden">
        <div className="px-5 pt-8 pb-8">

          <p className="text-xs font-bold text-[#c44033] font-outfit uppercase tracking-[1.2px] mb-2">
            Morning Check-in
          </p>

          <h1 className="text-[2.6rem] font-bold text-[#191716] font-crimson leading-none mb-6">
            Day {day}
          </h1>

          {/* Streak card */}
          <div className="bg-white border border-[#ede9e4] rounded-[18px] px-4 py-4 flex items-center gap-3.5 mb-3">
            <div className="w-11 h-11 rounded-[14px] bg-[rgba(196,64,51,0.08)] flex items-center justify-center flex-shrink-0">
              <Flame className="w-5 h-5 text-[#c44033]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#191716] font-outfit leading-tight">
                {(() => {
                  const current = streakData?.streak || 0;
                  if (current === 0) {
                    if (hasSubmitted) return 'Amazing! Log your PM routine tonight to build your streak 🌙';
                    return 'Log today to start your streak';
                  }
                  const milestones = [7, 14, 28, 56, 84, 90];
                  const next = milestones.find(m => m > current);
                  if (!next) return 'You completed the journey! 🎉';
                  const daysLeft = next - current;
                  return daysLeft === 1
                    ? <><span className="text-[#c44033] font-bold font-crimson text-xl">1</span> day to {next}-day milestone!</>
                    : <><span className="text-[#c44033] font-bold font-crimson text-xl">{daysLeft}</span> days to {next}-day milestone</>;
                })()}
              </p>
              <p className="text-xs text-[#a39e95] font-outfit mt-0.5">
                {(streakData?.streak || 0) > 0
                  ? <><span>Streak: </span><span className="font-semibold text-[#191716]">{streakData.streak}</span><span> days · {consistency}% consistent</span></>
                  : <span>{consistency}% consistent</span>
                }
              </p>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] bg-[rgba(196,64,51,0.06)] flex-shrink-0">
              <Shield className={`w-3.5 h-3.5 ${getShieldColor(availableShields)}`} strokeWidth={1.3} />
              <span className="text-sm font-bold text-[#c44033] font-outfit">{availableShields}</span>
            </div>
          </div>

          {/* AM Routine toggle — locked once submitted */}
          <div className={`bg-white border border-[#ede9e4] rounded-[18px] px-4 py-4 flex items-center justify-between mb-3 ${alreadyDone ? 'opacity-60' : ''}`}>
            <span className="text-sm font-semibold text-[#191716] font-outfit">AM Routine Completed</span>
            <button
              onClick={() => !alreadyDone && setAmRoutine(v => !v)}
              disabled={alreadyDone}
              className={`w-[52px] h-[30px] rounded-full flex items-center px-[3px] flex-shrink-0 transition-colors duration-300 ${
                amRoutine ? 'bg-[#c44033]' : 'bg-[#d4cfc9]'
              } ${alreadyDone ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className={`w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-300 ${
                amRoutine ? 'translate-x-[22px]' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Sunscreen toggle — locked once submitted */}
          <div className={`bg-white border border-[#ede9e4] rounded-[18px] px-4 py-4 flex items-center justify-between mb-6 ${alreadyDone ? 'opacity-60' : ''}`}>
            <span className="text-sm font-semibold text-[#191716] font-outfit">Sunscreen Applied</span>
            <button
              onClick={() => !alreadyDone && setSunscreen(v => !v)}
              disabled={alreadyDone}
              className={`w-[52px] h-[30px] rounded-full flex items-center px-[3px] flex-shrink-0 transition-colors duration-300 ${
                sunscreen ? 'bg-[#c44033]' : 'bg-[#d4cfc9]'
              } ${alreadyDone ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className={`w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-300 ${
                sunscreen ? 'translate-x-[22px]' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Submit / completed button */}
          {alreadyDone ? (
            <div className="w-full py-4 rounded-[18px] bg-[#f0fdf4] border border-[#bbf7d0] flex items-center justify-center gap-2">
              <span className="text-[15px] font-semibold text-[#16a34a] font-outfit">AM Routine Completed ✓</span>
            </div>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || isLoading || !canSubmit}
              className={`w-full py-4 rounded-[18px] font-semibold text-sm font-outfit transition-all ${
                isSubmitting || isLoading
                  ? 'bg-[#e4e0db] text-[#a39e95] cursor-not-allowed'
                  : canSubmit
                  ? 'bg-[#c44033] text-white shadow-[rgba(196,64,51,0.22)_0px_4px_14px] cursor-pointer'
                  : 'bg-[#e4e0db] text-[#a39e95] cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Saving...
                </span>
              ) : isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-[#a39e95]/40 border-t-[#a39e95] rounded-full animate-spin" />
                  Loading...
                </span>
              ) : (
                'Log AM ✓'
              )}
            </button>
          )}

        </div>
      </div>

      {/* Reorder banner — inline below the card, not floating */}
      {day >= 30 && (
        <ReorderBanner
          coachName={patient?.coachName}
          coachWhatsApp={patient?.coachWhatsApp}
          day={day}
          inline
        />
      )}

      {/* Milestone celebration */}
      {showCelebration && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        >
          <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="bg-white rounded-2xl p-8 text-center max-w-sm mx-4">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">{streakData?.streak || 0} Day Streak!</h3>
            <p className="text-gray-600">You're building great habits. Keep it up!</p>
          </motion.div>
        </motion.div>
      )}

      {/* Shield Restore Modal */}
      {showShieldRestore && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4"
        >
          <motion.div
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="w-full max-w-md bg-white rounded-[28px] px-5 pt-6 pb-8"
          >
            <div className="w-10 h-1 rounded-full bg-[#e0ddd7] mx-auto mb-6" />
            <div className="text-4xl text-center mb-3">🛡️</div>
            <h3 className="text-xl font-bold text-[#191716] font-crimson text-center mb-2">Restore Your Streak?</h3>
            <p className="text-sm text-[#7a756d] font-outfit text-center mb-6">
              Use a shield to restore your streak. You have {streakData?.restorationShields?.available || 0} shields available.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={restoreStreakWithShield}
                className="w-full py-3.5 rounded-[14px] bg-[#c44033] text-white font-semibold font-outfit text-sm"
              >
                Use Shield
              </button>
              <button
                onClick={dismissShieldPopup}
                className="w-full py-3.5 rounded-[14px] bg-[#f4f2ef] text-[#3d3935] font-semibold font-outfit text-sm"
              >
                Not Now
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

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

      <BottomNavigation />
    </div>
  );
}
