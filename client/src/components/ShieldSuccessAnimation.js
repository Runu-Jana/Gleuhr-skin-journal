import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * ShieldSuccessAnimation
 *
 * Duolingo-inspired full-screen animation shown after a shield restores the streak.
 * Automatically redirects to `redirectPath` after a short delay, or when user taps Continue.
 *
 * Props:
 *   streakRestored   boolean
 *   shieldsRemaining number  – shields left this month (after using one)
 *   previousStreak   number  – streak before the missed day
 *   newStreak        number  – restored streak count
 *   redirectPath     string  – where to go after animation (default '/')
 */
export default function ShieldSuccessAnimation({
  streakRestored,
  shieldsRemaining = 0,
  previousStreak = 0,
  newStreak = 0,
  redirectPath = '/',
}) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('shield'); // 'shield' | 'streak'
  const [canContinue, setCanContinue] = useState(false);

  // Animation phases: show shield first, then transition to streak info
  useEffect(() => {
    const t1 = setTimeout(() => setPhase('streak'), 1800);
    const t2 = setTimeout(() => setCanContinue(true), 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const handleContinue = () => navigate(redirectPath);

  // Build the week-day row (Sun–Sat) for the current week.
  // Days up to yesterday are "done", today is "shield-restored", future are "empty".
  const weekDayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const todayIndex = new Date().getDay(); // 0 = Sun … 6 = Sat

  const dayStatus = weekDayLabels.map((_, i) => {
    if (i === todayIndex) return 'shield';
    if (i < todayIndex) {
      // Mark the last (newStreak - 1) days before today as completed
      const daysAgo = todayIndex - i;
      return daysAgo <= (newStreak - 1) ? 'done' : 'empty';
    }
    return 'future';
  });

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-between bg-[#131f14] overflow-hidden select-none">

      {/* ── Top: speech bubble ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="mt-16 mx-8"
      >
        <div className="relative bg-[#1f2d20] border border-[#2e4430] rounded-2xl px-5 py-4 max-w-xs">
          <p className="text-white text-base font-semibold font-outfit text-center leading-snug">
            {phase === 'shield'
              ? `Shield activated. Your streak is safe. ${shieldsRemaining} shield${shieldsRemaining !== 1 ? 's' : ''} remaining.`
              : 'Keep going — your streak lives on! 🔥'}
          </p>
          {/* Bubble tail */}
          <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-5 h-5 bg-[#1f2d20] border-b border-r border-[#2e4430] rotate-45" />
        </div>
      </motion.div>

      {/* ── Center: icon + streak number ── */}
      <div className="flex flex-col items-center gap-2">

        <AnimatePresence mode="wait">
          {phase === 'shield' ? (
            // Spinning shield phase
            <motion.div
              key="shield"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 18, stiffness: 280 }}
              className="relative mb-4"
            >
              {/* Glow ring */}
              <motion.div
                animate={{ scale: [1, 1.18, 1], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                className="absolute inset-0 rounded-full bg-amber-500/20 blur-xl"
              />
              <motion.div
                animate={{ rotate: [0, 8, -8, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <ShieldCheck className="w-36 h-36 text-amber-400 fill-amber-400/30" strokeWidth={1.2} />
              </motion.div>
              {/* Sparkle dots */}
              {[...Array(6)].map((_, i) => {
                const angle = (i / 6) * 360;
                const rad = (angle * Math.PI) / 180;
                const x = Math.cos(rad) * 80;
                const y = Math.sin(rad) * 80;
                return (
                  <motion.div
                    key={i}
                    className="absolute w-2.5 h-2.5 rounded-full bg-amber-300"
                    style={{ left: '50%', top: '50%' }}
                    animate={{
                      x: [0, x * 0.6, x],
                      y: [0, y * 0.6, y],
                      opacity: [0, 1, 0],
                      scale: [0, 1.2, 0],
                    }}
                    transition={{ duration: 1.6, delay: i * 0.12, repeat: Infinity, repeatDelay: 0.4 }}
                  />
                );
              })}
            </motion.div>
          ) : (
            // Streak number phase
            <motion.div
              key="streak"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 16, stiffness: 260 }}
              className="flex flex-col items-center"
            >
              {/* Flame emoji */}
              <motion.div
                animate={{ scale: [1, 1.12, 1] }}
                transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
                className="text-7xl mb-1"
              >
                🔥
              </motion.div>

              {/* Big streak number */}
              <motion.span
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 14, stiffness: 300, delay: 0.1 }}
                className="text-[5.5rem] font-bold text-amber-400 leading-none font-crimson"
              >
                {newStreak}
              </motion.span>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="text-amber-400 text-xl font-bold font-outfit tracking-wide"
              >
                day streak
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Week-day row ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: phase === 'streak' ? 0.4 : 1.2, duration: 0.5 }}
          className="flex gap-3 mt-6"
        >
          {weekDayLabels.map((label, i) => {
            const status = dayStatus[i];
            return (
              <div key={label} className="flex flex-col items-center gap-1.5">
                <span className={`text-xs font-semibold font-outfit ${
                  status === 'shield' ? 'text-amber-400' :
                  status === 'done'   ? 'text-amber-400' :
                  'text-[#4a6b4d]'
                }`}>
                  {label}
                </span>
                {status === 'shield' ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 14, delay: 0.1 }}
                    className="w-9 h-9 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center"
                  >
                    <ShieldCheck className="w-4 h-4 text-amber-400 fill-amber-400/40" strokeWidth={1.4} />
                  </motion.div>
                ) : status === 'done' ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 14, delay: 0.05 * i }}
                    className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center"
                  >
                    <span className="text-white text-base font-bold">✓</span>
                  </motion.div>
                ) : status === 'future' ? (
                  <div className="w-9 h-9 rounded-full bg-[#222e23] border border-[#2e4430] flex items-center justify-center">
                    <span className="text-[#3a5a3e] text-sm">·</span>
                  </div>
                ) : (
                  /* empty (days before streak started) */
                  <div className="w-9 h-9 rounded-full bg-[#1c2a1d] border border-[#2e4430]" />
                )}
              </div>
            );
          })}
        </motion.div>

        {/* Shields remaining */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6 }}
          className="mt-4 text-[#5a8a5e] text-sm font-outfit"
        >
          🛡️ {shieldsRemaining} shield{shieldsRemaining !== 1 ? 's' : ''} remaining this month
        </motion.p>
      </div>

      {/* ── Bottom: Continue button ── */}
      <motion.div
        className="w-full px-6 mb-10"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: canContinue ? 1 : 0, y: canContinue ? 0 : 30 }}
        transition={{ duration: 0.4 }}
      >
        <button
          onClick={handleContinue}
          disabled={!canContinue}
          className="w-full py-4 rounded-2xl bg-[#1cb0f6] text-white font-bold text-base font-outfit tracking-wide shadow-lg active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          CONTINUE
        </button>
      </motion.div>
    </div>
  );
}
