import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOffline } from '../contexts/OfflineContext';
import { getWeeklyPhotos, fetchWeeklyPhotosFromServer, saveWeeklyPhoto } from '../utils/db';
import { Camera, Lock, Star, TrendingUp, Calendar } from 'lucide-react';
import BottomNavigation from './BottomNavigation';

export default function TransformationPage() {
  const { patient } = useAuth();
  const { isOnline } = useOffline();
  const navigate = useNavigate();
  
  const [photos, setPhotos] = useState([]);
  const [currentWeek, setCurrentWeek] = useState(4);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [weeklyInsight, setWeeklyInsight] = useState('');

  // Generate weekly insights based on week number
  const getWeeklyInsight = (week) => {
    const insights = {
      1: "Starting your journey! This baseline photo will help track your progress over the next 90 days.",
      2: "Early adaptation phase. Your skin is getting used to the active ingredients.",
      3: "Cell turnover beginning. You might notice some initial purging or breakouts.",
      4: "One full cell renewal cycle complete. Glutathione & Alpha Arbutin are at full efficacy. Most women see visible tone changes right around now. Compare your photos closely.",
      5: "Consistency is key. Your skin barrier is strengthening and moisture levels improving.",
      6: "Halfway through first cycle. Continue with your routine for optimal results.",
      7: "Skin adapting well. Any initial sensitivity should be reducing by now.",
      8: "Second cycle beginning. Your skin should be showing noticeable improvements.",
      12: "Three full cycles complete. Significant changes in skin tone and texture should be visible.",
      16: "Four cycles complete. Your skin's natural renewal process is now optimized.",
      20: "Major milestone reached. Your skin should show remarkable improvement.",
      24: "Six cycles complete. Maximum benefits from the treatment protocol should be evident.",
      28: "One month complete! Your skin has undergone significant transformation.",
      56: "Two months complete! Your skin should be showing dramatic improvements.",
      84: "Three months complete! Near-final results should be visible."
    };
    return insights[week] || "Continue your journey with consistency and patience.";
  };

  useEffect(() => {
    loadPhotos();
  }, []);

  const loadPhotos = async () => {
    try {
      let userPhotos = [];
      
      if (isOnline) {
        // Try to fetch from MongoDB first
        userPhotos = await fetchWeeklyPhotosFromServer(patient?.phone || patient?.phoneNumber);
        
        // Also save to IndexedDB for offline access
        for (const photo of userPhotos) {
          await saveWeeklyPhoto({
            id: `server-${photo._id}`,
            patientEmail: patient?.email,
            week: photo.weekNumber,
            photoData: photo.photoData,
            synced: true,
            serverId: photo._id,
            createdAt: photo.createdAt
          });
        }
      }
      
      // Get photos from IndexedDB (either as backup or when offline)
      const localPhotos = await getWeeklyPhotos(patient?.email);
      
      // Merge and deduplicate photos
      const allPhotos = [...localPhotos];
      const serverIds = new Set(allPhotos.filter(p => p.serverId).map(p => p.serverId));
      
      // Add any server photos that aren't already in local storage
      for (const serverPhoto of userPhotos) {
        if (!serverIds.has(serverPhoto._id)) {
          allPhotos.push({
            id: `server-${serverPhoto._id}`,
            patientEmail: patient?.email,
            week: serverPhoto.weekNumber,
            photoData: serverPhoto.photoData,
            synced: true,
            serverId: serverPhoto._id,
            createdAt: serverPhoto.createdAt
          });
        }
      }
      
      // Sort by week number
      allPhotos.sort((a, b) => a.week - b.week);
      setPhotos(allPhotos);
      
    } catch (error) {
      console.error('Error loading photos:', error);
      // Fallback to IndexedDB only
      const localPhotos = await getWeeklyPhotos(patient?.email);
      setPhotos(localPhotos || []);
    }
  };

  const handleWeekSelect = (week) => {
    setSelectedWeek(week);
    setCurrentWeek(week);
    setWeeklyInsight(getWeeklyInsight(week));
  };

  const getWeekStatus = (week) => {
    if (week === 1) return { status: 'baseline', color: '#5c5757', label: 'Baseline' };
    if (week === currentWeek) return { status: 'current', color: '#c44033', label: 'Current' };
    if (week < currentWeek) return { status: 'completed', color: '#1a8a4a', label: `W${week}` };
    return { status: 'upcoming', color: '#ccc8c0', label: `W${week}` };
  };

  const weeks = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="px-5 py-4">
        <p className="text-xs text-[#c44033] font-outfit font-bold uppercase tracking-[1.2px]">Progress</p>
        <h2 className="text-2xl font-bold text-[#191716] font-playfair mb-4">Your Transformation</h2>
      </div>

      <div className="px-5">
        {/* Photo Comparison */}
        <div className="flex gap-2.5 mb-3.5">
          {/* Week 1 - Baseline */}
          <div className="flex-1 aspect-[3/4] rounded-[18px] bg-[#f4f2ef] border flex flex-col items-center justify-center gap-1.5">
            <Camera className="w-5.5 h-5.5 text-[#5c5757]" />
            <span className="text-sm font-semibold text-[#5c5757] font-outfit">Week 1</span>
            <span className="text-xs text-[#a39e95] font-outfit">Baseline</span>
          </div>

          {/* Current Week */}
          <div className="flex-1 aspect-[3/4] rounded-[18px] bg-white border-2 border-dashed border-[rgba(196,64,51,0.19)] flex flex-col items-center justify-center gap-1.5">
            <Camera className="w-5.5 h-5.5 text-[#c44033]" />
            <span className="text-sm font-semibold text-[#c44033] font-outfit">Week {currentWeek}</span>
            <span className="text-xs text-[#7a756d] font-outfit">Current</span>
          </div>
        </div>

        {/* Week Navigation */}
        <div className="flex gap-1.5 overflow-x-auto pb-3.5">
          {weeks.map((weekNum) => {
            const status = getWeekStatus(weekNum);
            return (
              <div
                key={weekNum}
                onClick={() => handleWeekSelect(weekNum)}
                className={`min-w-12 h-12 rounded-[10px] flex items-center justify-center flex-shrink-0 cursor-pointer transition-all hover:scale-105 ${
                  status.status === 'completed' ? 'bg-[#f4f2ef] border border-[#e0ddd7]' :
                  status.status === 'current' ? 'bg-[#f4f2ef] border-2 border-[#c44033]' :
                  'bg-[#faf9f7] border border-dashed border-[#e0ddd7]'
                }`}
              >
                <span className={`text-xs font-outfit ${
                  status.status === 'current' ? 'font-bold text-[#c44033]' :
                  status.status === 'completed' ? 'font-normal text-[#5c5757]' :
                  'font-normal text-[#ccc8c0]'
                }`}>
                  W{weekNum}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Weekly Insight */}
      <div className="mx-5 my-4 px-4.5 bg-[rgba(196,64,51,0.03)] rounded-[16px] border border-[rgba(196,64,51,0.05)]">
        <p className="text-xs font-bold text-[#c44033] font-outfit uppercase tracking-[1px] mb-1.5">Week {selectedWeek || currentWeek} insight</p>
        <p className="text-sm text-[#3d3935] font-outfit leading-[1.6]">
          {weeklyInsight || getWeeklyInsight(selectedWeek || currentWeek)}
        </p>
      </div>

      {/* Progress Stats */}
      <div className="mx-5 mb-6 px-5 py-4 bg-[#faf9f7] rounded-[20px] border border-[#ede9e5]">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#c44033]" />
            <span className="text-sm font-semibold text-[#c44033] font-outfit">Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#5c5757]" />
            <span className="text-sm text-[#5c5757] font-outfit">Day {Math.floor((Date.now() - new Date(patient?.startDate)) / (1000 * 60 * 60 * 24)) + 1}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#f4f2ef] rounded-full h-2 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-[#1a8a4a] to-[#c44033] rounded-full transition-all duration-1000"
            style={{ width: `${((selectedWeek || currentWeek) / 90) * 100}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-[#a39e95] font-outfit">
          <span>Week {selectedWeek || currentWeek} of 90</span>
          <span>{Math.round(((selectedWeek || currentWeek) / 90) * 100)}% Complete</span>
        </div>
      </div>

      {/* Transformation Milestones */}
      <div className="mx-5 mb-6 px-5 py-4 bg-[#faf9f7] rounded-[20px] border border-[#ede9e5]">
        <h3 className="text-lg font-bold text-[#191716] font-outfit mb-4">Transformation Milestones</h3>
        <div className="grid grid-cols-2 gap-4">
          {[
            { week: 4, title: "First Cycle Complete", desc: "Cell renewal cycle completed", icon: "🔄" },
            { week: 12, title: "Three Cycles", desc: "Visible improvements expected", icon: "✨" },
            { week: 28, title: "One Month", desc: "Significant transformation visible", icon: "🎯" },
            { week: 56, title: "Two Months", desc: "Dramatic results achieved", icon: "🏆" },
            { week: 90, title: "Complete Journey", desc: "Full transformation realized", icon: "👑" }
          ].map((milestone) => (
            <div 
              key={milestone.week}
              className={`p-4 rounded-xl border-2 transition-all ${
                (selectedWeek || currentWeek) >= milestone.week 
                  ? 'border-[#c44033] bg-[rgba(196,64,51,0.05)]' 
                  : 'border-[#e0ddd7] bg-white'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{milestone.icon}</span>
                <div>
                  <h4 className="font-bold text-[#191716] font-outfit">{milestone.title}</h4>
                  <p className="text-sm text-[#5c5757] font-outfit">Week {milestone.week}</p>
                </div>
              </div>
              <p className="text-sm text-[#3d3935] font-outfit">{milestone.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}
