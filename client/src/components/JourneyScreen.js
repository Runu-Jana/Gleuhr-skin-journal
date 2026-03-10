import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { getSkinScores } from '../utils/db';
import { calculateDay, getMilestoneLabel } from '../utils/helpers';
import { Check, Lock, Star, MapPin, TrendingUp, Gift, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from './BottomNavigation';

export default function JourneyScreen() {
  const { patient } = useAuth();
  const [skinScores, setSkinScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const currentDay = calculateDay(patient?.startDate);
  const consistency = Math.round((currentDay / 90) * 100);
  
  // Milestone data from the prototype
  const milestones = [
    {
      day: 14,
      week: 2,
      title: "Your Skin is Responding",
      description: "Personalised data insight",
      type: "insight",
      earned: currentDay >= 14
    },
    {
      day: 28,
      week: 4,
      title: "Month 1 Report + Free Sample",
      description: "Progress report & earned reward",
      type: "reward",
      earned: currentDay >= 28
    },
    {
      day: 42,
      week: 6,
      title: "Transformation Card",
      description: "Shareable before/after",
      type: "achievement",
      earned: currentDay >= 42
    },
    {
      day: 56,
      week: 8,
      title: "Surprise Gift in Month 3",
      description: "Physical gift with next order",
      type: "reward",
      earned: currentDay >= 56
    }
  ];

  // Skin score weeks data
  const skinScoreWeeks = [
    { week: "Baseline", day: 0, score: 8, available: true, locked: false },
    { week: "Week 4", day: 28, score: null, available: currentDay >= 28, locked: currentDay < 28 },
    { week: "Week 8", day: 56, score: null, available: currentDay >= 56, locked: currentDay < 56 },
    { week: "Week 12", day: 84, score: null, available: currentDay >= 84, locked: currentDay < 84 }
  ];

  useEffect(() => {
    const loadScores = async () => {
      try {
        // First try to get from IndexedDB (offline data)
        const localScores = await getSkinScores(patient?.id);
        
        // Also try to get latest scores from server using phone number
        try {
          const response = await fetch(`/api/skinscore/${patient?.phone}`, {
            headers: {
              'Authorization': `Bearer ${patient?.token}`
            }
          });
          
          if (response.ok) {
            const serverScores = await response.json();
            // Merge server scores with local scores, preferring server data
            const mergedScores = serverScores.map(serverScore => ({
              ...serverScore,
              id: serverScore._id || serverScore.id
            }));
            setSkinScores(mergedScores);
          } else {
            // Fallback to local scores if server fails
            setSkinScores(localScores || []);
          }
        } catch (serverError) {
          // Fallback to local scores if server fails
          console.log('Server fetch failed, using local scores:', serverError);
          setSkinScores(localScores || []);
        }
      } catch (error) {
        console.error('Error loading skin scores:', error);
        setSkinScores([]);
      } finally {
        setLoading(false);
      }
    };
    
    if (patient?.phone) {
      loadScores();
    } else {
      setLoading(false);
    }
  }, [patient]);

  const handleTakeAssessment = () => {
    navigate('/skin-score');
  };

  const getScoreForWeek = (day) => {
    const score = skinScores.find(s => s.day === day);
    return score ? score.totalScore : null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#c44033] mx-auto mb-4"></div>
          <p className="text-gray-500">Loading your journey...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8f5] pb-24">
      {/* Header */}
      <div className="bg-white px-6 py-4 border-b border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">Milestones & Rewards</h1>
        <p className="text-sm text-gray-500 mt-1">
          Day {currentDay} of 90 · {consistency}% consistent
        </p>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Skin Score Section */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">SKIN SCORE</h2>
              <p className="text-sm text-gray-500">Track your progress</p>
            </div>
            <button
              onClick={handleTakeAssessment}
              className="px-4 py-2 bg-[#c44033] text-white rounded-lg hover:bg-[#b3382b] transition-colors"
            >
              Take Assessment
            </button>
          </div>
          
          {/* Skin Score Timeline */}
          <div className="space-y-4">
            {skinScoreWeeks.map((week, index) => {
              const score = getScoreForWeek(week.day);
              return (
                <div key={week.week} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      week.locked ? 'bg-gray-200' : score !== null ? 'bg-[#c44033]' : 'bg-gray-300'
                    }`}>
                      {week.locked ? (
                        <Lock className="w-5 h-5 text-gray-400" />
                      ) : score !== null ? (
                        <span className="text-white font-bold text-sm">{score}</span>
                      ) : (
                        <span className="text-white font-bold text-sm">?</span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{week.week}</p>
                      {score !== null && (
                        <p className="text-xs text-gray-500">Score: {score}/20</p>
                      )}
                    </div>
                  </div>
                  {week.locked && (
                    <span className="text-xs text-gray-400">Unlocks Day {week.day}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Journey Timeline */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Your Journey</h2>
          
          <div className="space-y-6">
            {milestones.map((milestone, index) => (
              <motion.div
                key={milestone.day}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`relative flex items-start gap-4 p-4 rounded-xl border ${
                  milestone.earned 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                {/* Milestone Icon */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                  milestone.earned 
                    ? 'bg-[#c44033] shadow-lg shadow-[#c44033]/30' 
                    : 'bg-gray-200 border-2 border-gray-300'
                }`}>
                  {milestone.earned ? (
                    milestone.type === 'reward' ? (
                      <Gift className="w-6 h-6 text-white" />
                    ) : milestone.type === 'achievement' ? (
                      <Star className="w-6 h-6 text-white" />
                    ) : (
                      <TrendingUp className="w-6 h-6 text-white" />
                    )
                  ) : (
                    <Lock className="w-6 h-6 text-gray-400" />
                  )}
                </div>
                
                {/* Milestone Content */}
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        WEEK {milestone.week} · DAY {milestone.day}: {milestone.title}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">{milestone.description}</p>
                    </div>
                    {milestone.earned && (
                      <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                        Earned
                      </span>
                    )}
                  </div>
                  
                  {!milestone.earned && (
                    <p className="text-xs text-gray-500 mt-2">
                      Unlocks in {milestone.day - currentDay} days
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Progress Summary */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">Your Progress</h3>
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
              <div className="text-2xl font-bold text-[#c44033]">
                {skinScores.length > 0 
                  ? (skinScores.reduce((sum, score) => sum + (score.totalScore || 0), 0) / skinScores.length).toFixed(1)
                  : '0'
                }
              </div>
              <div className="text-xs text-gray-500">Avg Score</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}
