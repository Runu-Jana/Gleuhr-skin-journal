import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, X, Share2 } from 'lucide-react';
import { useGamification } from '../contexts/GamificationContext';

export default function AchievementPopup({ achievement, onClose, onShare }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300);
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const handleShare = () => {
    onShare(achievement);
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.8 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed top-4 left-4 right-4 z-50 max-w-sm mx-auto"
        >
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg shadow-xl p-4 text-white">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div className="bg-white/20 rounded-full p-3">
                  <Trophy className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-1">Achievement Unlocked!</h3>
                  <p className="text-white/90 font-medium">{achievement.title}</p>
                  <p className="text-white/80 text-sm mt-1">{achievement.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="bg-white/20 px-2 py-1 rounded-full text-xs font-medium">
                      +{achievement.points} points
                    </span>
                    <span className="text-2xl">{achievement.icon}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={handleShare}
                  className="bg-white/20 hover:bg-white/30 rounded-full p-2 transition-colors"
                  aria-label="Share achievement"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                <button
                  onClick={handleClose}
                  className="bg-white/20 hover:bg-white/30 rounded-full p-2 transition-colors"
                  aria-label="Close achievement"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
