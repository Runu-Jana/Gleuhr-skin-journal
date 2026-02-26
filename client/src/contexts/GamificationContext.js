import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';

const GamificationContext = createContext();

export function GamificationProvider({ children }) {
  const { patient, streak } = useAuth();
  const { showAchievementNotification, showMilestoneNotification } = useNotifications();
  const [achievements, setAchievements] = useState([]);
  const [points, setPoints] = useState(0);
  const [level, setLevel] = useState(1);
  const [badges, setBadges] = useState([]);

  // Achievement definitions
  const achievementDefinitions = {
    first_checkin: {
      id: 'first_checkin',
      title: 'First Step',
      description: 'Completed your first daily check-in!',
      points: 10,
      icon: '🌟',
      condition: (totalCheckins) => totalCheckins >= 1
    },
    week_warrior: {
      id: 'week_warrior',
      title: 'Week Warrior',
      description: '7-day streak achieved!',
      points: 50,
      icon: '🔥',
      condition: (currentStreak) => currentStreak >= 7
    },
    month_master: {
      id: 'month_master',
      title: 'Month Master',
      description: '30-day streak achieved!',
      points: 200,
      icon: '🏆',
      condition: (currentStreak) => currentStreak >= 30
    },
    photo_perfect: {
      id: 'photo_perfect',
      title: 'Photo Perfect',
      description: '4 weekly photos completed!',
      points: 30,
      icon: '📸',
      condition: (photoCount) => photoCount >= 4
    },
    skin_expert: {
      id: 'skin_expert',
      title: 'Skin Expert',
      description: 'Completed all skin score assessments!',
      points: 100,
      icon: '🔬',
      condition: (skinScores) => skinScores >= 4
    },
    consistent_champion: {
      id: 'consistent_champion',
      title: 'Consistent Champion',
      description: '60-day streak achieved!',
      points: 500,
      icon: '👑',
      condition: (currentStreak) => currentStreak >= 60
    },
    journey_complete: {
      id: 'journey_complete',
      title: 'Journey Complete',
      description: 'Completed the 90-day program!',
      points: 1000,
      icon: '🎯',
      condition: (currentStreak) => currentStreak >= 90
    },
    early_bird: {
      id: 'early_bird',
      title: 'Early Bird',
      description: '5 check-ins before 9 AM!',
      points: 25,
      icon: '🌅',
      condition: (earlyCheckins) => earlyCheckins >= 5
    },
    night_owl: {
      id: 'night_owl',
      title: 'Night Owl',
      description: '5 PM routine completed consistently!',
      points: 25,
      icon: '🌙',
      condition: (pmConsistency) => pmConsistency >= 0.8
    },
    hydration_hero: {
      id: 'hydration_hero',
      title: 'Hydration Hero',
      description: 'Maintained 3+ water intake for 7 days!',
      points: 40,
      icon: '💧',
      condition: (hydrationStreak) => hydrationStreak >= 7
    }
  };

  // Calculate level based on points
  const calculateLevel = useCallback((totalPoints) => {
    return Math.floor(totalPoints / 100) + 1;
  }, []);

  // Check and unlock achievements
  const checkAchievements = useCallback((userStats) => {
    const newAchievements = [];
    
    Object.values(achievementDefinitions).forEach(achievement => {
      if (!achievements.find(a => a.id === achievement.id)) {
        if (achievement.condition(
          userStats.totalCheckins,
          userStats.currentStreak,
          userStats.photoCount,
          userStats.skinScores,
          userStats.earlyCheckins,
          userStats.pmConsistency,
          userStats.hydrationStreak
        )) {
          newAchievements.push(achievement);
        }
      }
    });

    if (newAchievements.length > 0) {
      setAchievements(prev => [...prev, ...newAchievements]);
      
      // Award points for new achievements
      const totalPoints = newAchievements.reduce((sum, achievement) => sum + achievement.points, 0);
      setPoints(prev => {
        const newTotal = prev + totalPoints;
        setLevel(calculateLevel(newTotal));
        return newTotal;
      });

      // Show notifications
      newAchievements.forEach(achievement => {
        showAchievementNotification(achievement);
      });
    }
  }, [achievements, calculateLevel, showAchievementNotification]);

  // Check for milestones
  const checkMilestones = useCallback((currentStreak) => {
    const milestones = [7, 14, 30, 60, 90];
    const milestoneNames = {
      7: '7-day',
      14: '14-day',
      30: '30-day',
      60: '60-day',
      90: '90-day'
    };

    milestones.forEach(days => {
      if (currentStreak === days) {
        showMilestoneNotification(milestoneNames[days]);
      }
    });
  }, [showMilestoneNotification]);

  // Load achievements from localStorage
  useEffect(() => {
    const storedAchievements = localStorage.getItem('gleuhrAchievements');
    const storedPoints = localStorage.getItem('gleuhrPoints');
    
    if (storedAchievements) {
      setAchievements(JSON.parse(storedAchievements));
    }
    if (storedPoints) {
      const points = parseInt(storedPoints);
      setPoints(points);
      setLevel(calculateLevel(points));
    }
  }, [calculateLevel]);

  // Save achievements to localStorage
  useEffect(() => {
    localStorage.setItem('gleuhrAchievements', JSON.stringify(achievements));
  }, [achievements]);

  useEffect(() => {
    localStorage.setItem('gleuhrPoints', points.toString());
  }, [points]);

  // Check milestones when streak changes
  useEffect(() => {
    if (streak?.streak) {
      checkMilestones(streak.streak);
    }
  }, [streak, checkMilestones]);

  // Award points for daily activities
  const awardPoints = useCallback((activity, amount = 1) => {
    const pointValues = {
      daily_checkin: 5,
      weekly_photo: 10,
      skin_score: 15,
      perfect_day: 3,
      streak_bonus: 2
    };

    const pointsToAward = (pointValues[activity] || 1) * amount;
    setPoints(prev => {
      const newTotal = prev + pointsToAward;
      setLevel(calculateLevel(newTotal));
      return newTotal;
    });
  }, [calculateLevel]);

  // Get progress to next level
  const getProgressToNextLevel = useCallback(() => {
    const currentLevelPoints = (level - 1) * 100;
    const nextLevelPoints = level * 100;
    const progress = ((points - currentLevelPoints) / (nextLevelPoints - currentLevelPoints)) * 100;
    return Math.min(progress, 100);
  }, [points, level]);

  // Get unlocked badges
  const getUnlockedBadges = useCallback(() => {
    return achievements.map(achievement => ({
      id: achievement.id,
      title: achievement.title,
      description: achievement.description,
      icon: achievement.icon,
      points: achievement.points,
      unlockedAt: new Date().toISOString()
    }));
  }, [achievements]);

  // Share achievement
  const shareAchievement = useCallback((achievement) => {
    const shareText = `🎉 I just unlocked "${achievement.title}" on Gleuhr Skin Journal! ${achievement.description}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Gleuhr Achievement',
        text: shareText,
        url: window.location.origin
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareText);
      alert('Achievement copied to clipboard!');
    }
  }, []);

  const value = {
    achievements,
    points,
    level,
    badges: getUnlockedBadges(),
    progressToNextLevel: getProgressToNextLevel(),
    awardPoints,
    checkAchievements,
    shareAchievement
  };

  return <GamificationContext.Provider value={value}>{children}</GamificationContext.Provider>;
}

export const useGamification = () => {
  const context = useContext(GamificationContext);
  if (!context) throw new Error('useGamification must be used within GamificationProvider');
  return context;
};
