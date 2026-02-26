import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { calculateDay, calculateConsistency } from '../utils/helpers';
import { getCheckIns } from '../utils/db';
import { Crown, Gift, Users, Sparkles, Lock, X } from 'lucide-react';

export default function GleuhrInsider() {
  const { patient } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [consistency, setConsistency] = useState(0);
  const [streak, setStreak] = useState(0);

  const day = calculateDay(patient?.startDate);

  useEffect(() => {
    const checkEligibility = async () => {
      // Check if already shown
      if (localStorage.getItem('gleuhrInsiderShown')) return;

      // Calculate consistency
      const checkIns = await getCheckIns(patient?.email);
      const cons = calculateConsistency(checkIns, patient?.startDate);
      setConsistency(cons);

      // Calculate streak
      const uniqueDays = new Set(checkIns.map(c => c.date)).size;
      setStreak(uniqueDays);

      // Show if eligible (Day 42+ and >75% consistency)
      if (day >= 42 && cons > 75) {
        setShowModal(true);
        localStorage.setItem('gleuhrInsiderShown', 'true');
      }
    };

    if (patient?.email) {
      checkEligibility();
    }
  }, [day, patient]);

  if (!showModal) return null;

  const benefits = [
    { icon: Crown, title: 'Community Badge', description: 'Exclusive high-consistency achiever badge', unlocked: true },
    { icon: Gift, title: 'Early Access', description: 'Be the first to try new products', unlocked: consistency >= 80 },
    { icon: Users, title: 'Insider Community', description: 'Join our exclusive WhatsApp group', unlocked: streak >= 30 },
    { icon: Sparkles, title: 'Expert Tips', description: 'Weekly advanced skincare tips', unlocked: true },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-gradient-to-br from-[#c44033] to-[#8b2a20] rounded-3xl p-6 max-w-sm w-full shadow-2xl">
        <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-white/70 hover:text-white">
          <X className="w-6 h-6" />
        </button>

        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">Gleuhr Insider</h2>
          <p className="text-white/80">Welcome to the inner circle</p>
        </div>

        <div className="flex justify-center gap-6 mb-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-white">{streak}</div>
            <div className="text-white/70 text-sm">Day Streak</div>
          </div>
          <div className="w-px bg-white/20" />
          <div className="text-center">
            <div className="text-3xl font-bold text-white">{consistency}%</div>
            <div className="text-white/70 text-sm">Consistency</div>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {benefits.map((benefit, i) => {
            const Icon = benefit.icon;
            return (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${benefit.unlocked ? 'bg-white/20' : 'bg-white/10'}`}>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${benefit.unlocked ? 'bg-white/30' : 'bg-white/10'}`}>
                  {benefit.unlocked ? <Icon className="w-5 h-5 text-white" /> : <Lock className="w-5 h-5 text-white/50" />}
                </div>
                <div className="flex-1">
                  <h4 className={`font-semibold ${benefit.unlocked ? 'text-white' : 'text-white/50'}`}>{benefit.title}</h4>
                  <p className={`text-sm ${benefit.unlocked ? 'text-white/80' : 'text-white/40'}`}>{benefit.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={() => setShowModal(false)} className="w-full bg-white text-[#c44033] font-semibold py-3 rounded-xl hover:bg-white/90 transition-colors">
          Continue My Journey
        </button>
      </motion.div>
    </motion.div>
  );
}
