import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Trophy, 
  Star, 
  Target, 
  Zap, 
  Crown, 
  Award,
  TrendingUp,
  Share2
} from 'lucide-react';
import { useGamification } from '../contexts/GamificationContext';

export default function GamificationPanel() {
  const { 
    points, 
    level, 
    progressToNextLevel, 
    badges, 
    shareAchievement 
  } = useGamification();
  
  const [activeTab, setActiveTab] = useState('overview');

  const levelBenefits = [
    { level: 1, benefit: 'Basic tracking unlocked', icon: Star },
    { level: 5, benefit: 'Advanced insights', icon: TrendingUp },
    { level: 10, benefit: 'Exclusive badges', icon: Award },
    { level: 20, benefit: 'Premium features', icon: Crown }
  ];

  const recentAchievements = badges.slice(-3);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Your Progress</h2>
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <span className="text-2xl font-bold text-gray-900">{points}</span>
        </div>
      </div>

      {/* Level Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Level {level}</span>
          <span className="text-sm text-gray-500">Level {level + 1}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <motion.div
            className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressToNextLevel}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {Math.round(progressToNextLevel)}% to next level
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {['overview', 'achievements', 'rewards'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === tab
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[200px]">
        {activeTab === 'overview' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">Current Level</span>
                </div>
                <p className="text-2xl font-bold text-blue-900">{level}</p>
              </div>
              
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-900">Total Points</span>
                </div>
                <p className="text-2xl font-bold text-purple-900">{points}</p>
              </div>
            </div>

            {/* Recent Achievements */}
            {recentAchievements.length > 0 && (
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Recent Achievements</h3>
                <div className="space-y-2">
                  {recentAchievements.map((badge, index) => (
                    <motion.div
                      key={badge.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="text-2xl">{badge.icon}</div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{badge.title}</p>
                        <p className="text-sm text-gray-600">{badge.description}</p>
                      </div>
                      <div className="text-sm font-medium text-gray-500">
                        +{badge.points} pts
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'achievements' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            {badges.length > 0 ? (
              badges.map((badge, index) => (
                <motion.div
                  key={badge.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="text-3xl">{badge.icon}</div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{badge.title}</h4>
                    <p className="text-sm text-gray-600">{badge.description}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Unlocked on {new Date(badge.unlockedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-yellow-600">
                      +{badge.points}
                    </span>
                    <button
                      onClick={() => shareAchievement(badge)}
                      className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                      aria-label="Share achievement"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-8">
                <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No achievements yet. Start your journey!</p>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'rewards' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <h3 className="font-medium text-gray-900">Level Benefits</h3>
            <div className="space-y-3">
              {levelBenefits.map((benefit) => {
                const Icon = benefit.icon;
                const isUnlocked = level >= benefit.level;
                return (
                  <div
                    key={benefit.level}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      isUnlocked
                        ? 'bg-green-50 border-green-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${
                      isUnlocked ? 'text-green-600' : 'text-gray-400'
                    }`} />
                    <div className="flex-1">
                      <p className={`font-medium ${
                        isUnlocked ? 'text-green-900' : 'text-gray-700'
                      }`}>
                        Level {benefit.level}
                      </p>
                      <p className={`text-sm ${
                        isUnlocked ? 'text-green-700' : 'text-gray-500'
                      }`}>
                        {benefit.benefit}
                      </p>
                    </div>
                    {isUnlocked && (
                      <div className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                        Unlocked
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
