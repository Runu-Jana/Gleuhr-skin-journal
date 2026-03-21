import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, X, ArrowRight, ShieldCheck } from 'lucide-react';

/**
 * StreakRestorationPopup
 *
 * Shown when a customer taps the AM/PM routine button (banner or nav)
 * after missing yesterday's log. Intercepts navigation and lets them
 * either restore their streak (if shields available) or continue anyway.
 *
 * Props:
 *   isVisible        boolean
 *   previousStreak   number – the streak length before the break
 *   shields          number – available restoration shields
 *   onRestore        () => void – called when user taps "Use Shield"
 *   onContinue       () => void – called when user taps "Log Anyway"
 *   onClose          () => void – called when user dismisses without action
 */
export default function StreakRestorationPopup({
  isVisible,
  previousStreak = 0,
  shields = 0,
  onRestore,
  onContinue,
  onClose,
}) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={onClose}
          />

          {/* Card */}
          <motion.div
            className="relative w-full max-w-sm mx-4 mb-6 sm:mb-0 bg-white rounded-3xl overflow-hidden shadow-2xl"
            initial={{ y: 80, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 w-7 h-7 rounded-full bg-[#f4f0ec] flex items-center justify-center"
            >
              <X className="w-4 h-4 text-[#7a756d]" />
            </button>

            {/* Top accent */}
            <div className="h-1.5 w-full bg-gradient-to-r from-[#c44033] to-[#e8895a]" />

            <div className="px-6 pt-6 pb-7">
              {/* Icon row */}
              <div className="flex items-center justify-center mb-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-[20px] bg-[#fff1ef] flex items-center justify-center">
                    <Flame className="w-8 h-8 text-[#c44033]" strokeWidth={1.6} />
                  </div>
                  <span className="absolute -bottom-1 -right-1 text-lg">💔</span>
                </div>
              </div>

              {/* Headline */}
              <h2 className="text-center font-crimson text-[22px] font-bold text-[#191716] leading-tight mb-1">
                You missed yesterday
              </h2>
              <p className="text-center text-sm text-[#7a756d] font-outfit mb-5">
                {previousStreak > 0
                  ? `Your ${previousStreak}-day streak was broken. Don't let it stop you — log today and start fresh!`
                  : `Don't let it stop you — log today and start fresh!`}
              </p>

              {/* Streak visual */}
              {previousStreak > 0 && (
                <div className="flex items-center justify-center gap-4 mb-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold font-crimson text-[#c44033]">{previousStreak}</div>
                    <div className="text-xs text-[#a39e95] font-outfit">best streak</div>
                  </div>
                  <div className="text-[#d0cbc6] font-crimson text-2xl">→</div>
                  <div className="text-center">
                    <div className="text-2xl font-bold font-crimson text-[#191716]">0</div>
                    <div className="text-xs text-[#a39e95] font-outfit">current</div>
                  </div>
                </div>
              )}

              {/* Shield restore button (only if shields available) */}
              {shields > 0 && onRestore && (
                <button
                  onClick={onRestore}
                  className="w-full mb-3 flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#c44033] to-[#e8895a] text-white font-semibold text-sm font-outfit shadow-sm active:scale-[0.98] transition-transform"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Use Shield to Restore Streak
                  <span className="ml-auto text-xs bg-white/20 px-2 py-0.5 rounded-full">
                    {shields} left
                  </span>
                </button>
              )}

              {/* Continue anyway */}
              <button
                onClick={onContinue}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-[#191716] text-white font-semibold text-sm font-outfit active:scale-[0.98] transition-transform"
              >
                Log Today Anyway
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Motivational footer */}
              <p className="text-center text-xs text-[#a39e95] font-outfit mt-4">
                Every day is a fresh start ✨
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
