import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { getSkinScores } from '../utils/db';
import { calculateDay, getMilestoneLabel } from '../utils/helpers';
import { Check, Lock, Star, MapPin } from 'lucide-react';

export default function JourneyScreen() {
  const { patient } = useAuth();
  const [skinScores, setSkinScores] = useState([]);
  const currentDay = calculateDay(patient?.startDate);
  const milestones = [1, 28, 56, 84];

  useEffect(() => {
    const loadScores = async () => {
      const scores = await getSkinScores(patient?.email);
      setSkinScores(scores);
    };
    loadScores();
  }, [patient]);

  return (
    <div className="min-h-screen bg-[#faf8f5] pb-24">
      <div className="bg-white px-6 py-4 border-b border-gray-100">
        <h1 className="text-xl font-bold text-gray-900">My Journey</h1>
        <p className="text-sm text-gray-500">Day {currentDay} of 90</p>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Journey Path */}
        <div className="relative">
          <div className="absolute left-8 top-8 bottom-8 w-1 bg-gradient-to-b from-[#c44033] via-[#c44033]/50 to-gray-200 rounded-full" />
          
          <div className="space-y-8">
            {/* Start Point */}
            <div className="relative flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#c44033] flex items-center justify-center z-10 shadow-lg shadow-[#c44033]/30">
                <MapPin className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <h3 className="font-semibold text-gray-900">Journey Started</h3>
                <p className="text-sm text-gray-500">Day 1 • {new Date(patient?.startDate).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Milestones */}
            {milestones.map((milestoneDay, index) => {
              const isCompleted = currentDay >= milestoneDay;
              const isCurrent = currentDay >= milestoneDay - 7 && currentDay < milestoneDay + 7;
              const skinScore = skinScores.find(s => s.day === milestoneDay);

              return (
                <div key={milestoneDay} className="relative flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center z-10 shadow-lg ${
                    isCompleted ? 'bg-[#c44033] shadow-[#c44033]/30' : isCurrent ? 'bg-white border-4 border-[#c44033] shadow-[#c44033]/20' : 'bg-gray-200 border-4 border-gray-300'
                  }`}>
                    {isCompleted ? (skinScore ? <div className="text-center"><Star className="w-5 h-5 text-white mx-auto" /><span className="text-xs text-white font-bold">{skinScore.totalScore}</span></div> : <Check className="w-8 h-8 text-white" />) : <Lock className={`w-6 h-6 ${isCurrent ? 'text-[#c44033]' : 'text-gray-400'}`} />}
                  </div>
                  <div className={`flex-1 rounded-xl p-4 shadow-sm border ${isCurrent ? 'bg-[#c44033]/5 border-[#c44033]/20' : 'bg-white border-gray-100'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className={`font-semibold ${isCurrent ? 'text-[#c44033]' : 'text-gray-900'}`}>{getMilestoneLabel(milestoneDay)}</h3>
                        <p className="text-sm text-gray-500">
                          {isCompleted ? (skinScore ? `Skin Score: ${skinScore.totalScore}/20` : 'Assessment completed') : isCurrent ? 'Assessment due soon' : `Unlock at Day ${milestoneDay}`}
                        </p>
                      </div>
                      {isCurrent && !isCompleted && <span className="px-3 py-1 bg-[#c44033] text-white text-xs font-medium rounded-full">Now</span>}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* End Point */}
            <div className="relative flex items-center gap-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center z-10 shadow-lg ${currentDay >= 90 ? 'bg-[#c44033] shadow-[#c44033]/30' : 'bg-gray-200 border-4 border-gray-300'}`}>
                {currentDay >= 90 ? <Star className="w-8 h-8 text-white" /> : <span className="text-2xl">🏆</span>}
              </div>
              <div className={`flex-1 rounded-xl p-4 shadow-sm border ${currentDay >= 90 ? 'bg-gradient-to-r from-[#c44033]/10 to-[#e85a4a]/10 border-[#c44033]/20' : 'bg-white border-gray-100'}`}>
                <h3 className="font-semibold text-gray-900">Transformation Complete!</h3>
                <p className="text-sm text-gray-500">{currentDay >= 90 ? 'Congratulations on completing your journey!' : `Day 90 • ${90 - currentDay} days remaining`}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Summary */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3">Your Progress</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-[#c44033]">{currentDay}</div>
              <div className="text-xs text-gray-500">Days Active</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[#c44033]">{skinScores.length}</div>
              <div className="text-xs text-gray-500">Assessments</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[#c44033]">{skinScores.length > 0 ? Math.round(skinScores.reduce((a, b) => a + b.totalScore, 0) / skinScores.length) : '-'}</div>
              <div className="text-xs text-gray-500">Avg Score</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
