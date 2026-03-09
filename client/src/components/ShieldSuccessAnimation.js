import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Flame, Star, Sparkles, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ShieldSuccessAnimation({ 
  streakRestored, 
  shieldsRemaining, 
  previousStreak, 
  newStreak 
}) {
  const navigate = useNavigate();
  const [showStars, setShowStars] = useState(false);
  const [showShield, setShowShield] = useState(false);
  const [showFlame, setShowFlame] = useState(false);
  const [showTrophy, setShowTrophy] = useState(false);
  const [showText, setShowText] = useState(false);
  const [countdown, setCountdown] = useState(3);

  // Animation sequence
  useEffect(() => {
    const sequence = [
      { delay: 0, action: () => setShowStars(true) },
      { delay: 300, action: () => setShowShield(true) },
      { delay: 600, action: () => setShowFlame(true) },
      { delay: 900, action: () => setShowTrophy(true) },
      { delay: 1200, action: () => setShowText(true) },
    ];

    sequence.forEach(({ delay, action }) => {
      setTimeout(action, delay);
    });

    // Countdown and auto-navigate
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          setTimeout(() => navigate('/'), 500);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center overflow-hidden">
      {/* Background particles */}
      <AnimatePresence>
        {showStars && (
          <div className="absolute inset-0">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute"
                initial={{ 
                  scale: 0,
                  x: Math.random() * window.innerWidth,
                  y: Math.random() * window.innerHeight
                }}
                animate={{ 
                  scale: [0, 1, 0],
                  y: [Math.random() * window.innerHeight, -100]
                }}
                transition={{ 
                  duration: 2,
                  delay: i * 0.1,
                  repeat: Infinity,
                  repeatDelay: Math.random() * 2
                }}
              >
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="relative z-10 text-center">
        {/* Shield Animation */}
        <AnimatePresence>
          {showShield && (
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="mb-8"
            >
              <div className="relative">
                <motion.div
                  animate={{ rotateY: [0, 360] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <Shield className="w-32 h-32 text-green-500 fill-green-500" />
                </motion.div>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5, type: "spring" }}
                  className="absolute -top-2 -right-2 bg-white rounded-full p-2"
                >
                  <Sparkles className="w-6 h-6 text-yellow-500" />
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Flame Animation */}
        <AnimatePresence>
          {showFlame && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="mb-6"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <Flame className="w-16 h-16 text-orange-500 fill-orange-500" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Trophy Animation */}
        <AnimatePresence>
          {showTrophy && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -100, opacity: 0 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="mb-8"
            >
              <Trophy className="w-20 h-20 text-yellow-500 fill-yellow-500" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success Text */}
        <AnimatePresence>
          {showText && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              transition={{ duration: 0.5 }}
              className="space-y-4"
            >
              <motion.h1
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 20, stiffness: 300 }}
                className="text-4xl font-bold text-green-600 font-outfit"
              >
                Streak Restored! 🎉
              </motion.h1>
              
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="space-y-2"
              >
                <p className="text-2xl font-semibold text-gray-800">
                  {previousStreak} → {newStreak}
                </p>
                <p className="text-lg text-gray-600">
                  {shieldsRemaining} shields remaining
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="flex items-center justify-center gap-2 text-sm text-gray-500"
              >
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>Returning home in {countdown}...</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success particles */}
        <AnimatePresence>
          {showText && (
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(10)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute"
                  initial={{ 
                    scale: 0,
                    x: window.innerWidth / 2,
                    y: window.innerHeight / 2
                  }}
                  animate={{ 
                    scale: [0, 1, 0],
                    x: window.innerWidth / 2 + (Math.random() - 0.5) * 400,
                    y: window.innerHeight / 2 + (Math.random() - 0.5) * 400
                  }}
                  transition={{ 
                    duration: 1.5,
                    delay: i * 0.1,
                    ease: "easeOut"
                  }}
                >
                  <div className="w-3 h-3 bg-green-400 rounded-full" />
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Skip button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        onClick={() => navigate('/')}
        className="absolute top-8 right-8 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full text-gray-600 hover:bg-white transition-colors"
      >
        Skip
      </motion.button>
    </div>
  );
}
