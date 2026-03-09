import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOffline } from '../contexts/OfflineContext';
import { getWeeklyPhotos, fetchWeeklyPhotosFromServer, saveWeeklyPhoto } from '../utils/db';
import { Camera, TrendingUp, Calendar } from 'lucide-react';
import BottomNavigation from './BottomNavigation';

export default function TransformationPage() {
  const { patient } = useAuth();
  const { isOnline } = useOffline();
  const navigate = useNavigate();

  const [photos, setPhotos] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [compareWeek, setCompareWeek] = useState(1);
  const [weeklyInsight, setWeeklyInsight] = useState('');

  const patientPhone = patient?.phone || patient?.phoneNumber;
  const currentDay = patient?.startDate
    ? Math.floor((Date.now() - new Date(patient.startDate)) / (1000 * 60 * 60 * 24)) + 1
    : 1;
  const actualWeek = Math.ceil(currentDay / 7);

  const getWeeklyInsight = (week) => {
    const insights = {
      1: "Starting your journey! This baseline photo will help track your progress over the next 90 days.",
      2: "Early adaptation phase. Your skin is getting used to the active ingredients.",
      3: "Cell turnover beginning. You might notice some initial purging or breakouts.",
      4: "One full cell renewal cycle complete. Glutathione & Alpha Arbutin are at full efficacy. Most women see visible tone changes right around now.",
      5: "Consistency is key. Your skin barrier is strengthening and moisture levels improving.",
      6: "Halfway through first cycle. Continue with your routine for optimal results.",
      7: "Skin adapting well. Any initial sensitivity should be reducing by now.",
      8: "Second cycle beginning. Your skin should be showing noticeable improvements.",
      12: "Three full cycles complete. Significant changes in skin tone and texture should be visible.",
      28: "One month complete! Your skin has undergone significant transformation.",
      56: "Two months complete! Your skin should be showing dramatic improvements.",
      84: "Three months complete! Near-final results should be visible."
    };
    return insights[week] || "Continue your journey with consistency and patience.";
  };

  useEffect(() => {
    loadPhotos();
  }, [patientPhone]);

  const loadPhotos = async () => {
    if (!patientPhone) return;

    try {
      let serverPhotos = [];

      if (isOnline) {
        serverPhotos = await fetchWeeklyPhotosFromServer(patientPhone);
        // Cache server photos to IndexedDB
        for (const photo of serverPhotos) {
          await saveWeeklyPhoto({
            id: `server-${photo._id || photo.id}`,
            patientPhone,
            week: photo.weekNumber || photo.week,
            day: photo.dayOfJourney || photo.day,
            date: photo.uploadDate || photo.date,
            photoData: photo.photoData,
            synced: true,
            serverId: photo._id || photo.id,
            createdAt: photo.createdAt
          });
        }
      }

      // Get from IndexedDB (uses patientPhone as patientId key)
      const localPhotos = await getWeeklyPhotos(patientPhone);

      // Merge: deduplicate by week (prefer synced versions)
      const byWeek = {};
      for (const photo of (localPhotos || [])) {
        const w = photo.week || photo.weekNumber;
        if (!byWeek[w] || photo.synced) {
          byWeek[w] = photo;
        }
      }

      const allPhotos = Object.values(byWeek).sort((a, b) => (a.week || 0) - (b.week || 0));
      setPhotos(allPhotos);

      // Set initial selected week to latest photo week
      if (allPhotos.length > 0 && !selectedWeek) {
        const latestWeek = allPhotos[allPhotos.length - 1].week;
        setSelectedWeek(latestWeek);
        // Default compare to week 1 if available, otherwise earliest
        setCompareWeek(allPhotos[0].week || 1);
      }
    } catch (error) {
      console.error('Error loading photos:', error);
      const localPhotos = await getWeeklyPhotos(patientPhone);
      setPhotos(localPhotos || []);
    }
  };

  const getPhotoForWeek = (week) => {
    return photos.find(p => p.week === week || p.weekNumber === week);
  };

  const handleWeekSelect = (week) => {
    const photo = getPhotoForWeek(week);
    if (photo) {
      // If tapping a week with a photo, set it as the comparison target
      if (selectedWeek && week !== selectedWeek) {
        setCompareWeek(selectedWeek);
      }
      setSelectedWeek(week);
    }
    setWeeklyInsight(getWeeklyInsight(week));
  };

  const weeksWithPhotos = new Set(photos.map(p => p.week || p.weekNumber));
  const weeks = Array.from({ length: 13 }, (_, i) => i + 1);

  const leftPhoto = getPhotoForWeek(compareWeek);
  const rightPhoto = getPhotoForWeek(selectedWeek);
  const leftPhotoImage = leftPhoto?.photoData || leftPhoto?.photoUrl;
  const rightPhotoImage = rightPhoto?.photoData || rightPhoto?.photoUrl;

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <div className="px-5 py-4">
        <p className="text-xs text-[#c44033] font-outfit font-bold uppercase tracking-[1.2px]">Progress</p>
        <h2 className="text-2xl font-bold text-[#191716] font-playfair mb-4">Your Transformation</h2>
      </div>

      <div className="px-5">
        {/* Photo Comparison - Side by Side */}
        <div className="flex gap-2.5 mb-3.5">
          {/* Left: Compare Week (baseline/earlier) */}
          <div className="flex-1 aspect-[3/4] rounded-[18px] bg-[#f4f2ef] border overflow-hidden relative">
            {leftPhotoImage ? (
              <>
                <img src={leftPhotoImage} alt={`Week ${compareWeek}`} className="w-full h-full object-cover" />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                  <span className="text-sm font-semibold text-white font-outfit">Week {compareWeek}</span>
                  {leftPhoto?.day && <span className="text-xs text-white/70 font-outfit ml-1">Day {leftPhoto.day}</span>}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-1.5">
                <Camera className="w-6 h-6 text-[#5c5757]" />
                <span className="text-sm font-semibold text-[#5c5757] font-outfit">Week {compareWeek}</span>
                <span className="text-xs text-[#a39e95] font-outfit">No photo yet</span>
              </div>
            )}
          </div>

          {/* Right: Selected Week (current/later) */}
          <div className="flex-1 aspect-[3/4] rounded-[18px] bg-white border-2 border-dashed border-[rgba(196,64,51,0.19)] overflow-hidden relative">
            {rightPhotoImage ? (
              <>
                <img src={rightPhotoImage} alt={`Week ${selectedWeek}`} className="w-full h-full object-cover" />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                  <span className="text-sm font-semibold text-white font-outfit">Week {selectedWeek}</span>
                  {rightPhoto?.day && <span className="text-xs text-white/70 font-outfit ml-1">Day {rightPhoto.day}</span>}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-1.5">
                <Camera className="w-6 h-6 text-[#c44033]" />
                <span className="text-sm font-semibold text-[#c44033] font-outfit">Week {selectedWeek || actualWeek}</span>
                <span className="text-xs text-[#7a756d] font-outfit">No photo yet</span>
              </div>
            )}
          </div>
        </div>

        {/* Week Navigation */}
        <div className="flex gap-1.5 overflow-x-auto pb-3.5">
          {weeks.map((weekNum) => {
            const hasPhoto = weeksWithPhotos.has(weekNum);
            const isCurrent = weekNum === actualWeek;
            const isSelected = weekNum === selectedWeek;
            return (
              <div
                key={weekNum}
                onClick={() => handleWeekSelect(weekNum)}
                className={`min-w-12 h-12 rounded-[10px] flex flex-col items-center justify-center flex-shrink-0 cursor-pointer transition-all hover:scale-105 ${
                  isSelected ? 'bg-[#f4f2ef] border-2 border-[#c44033]' :
                  hasPhoto ? 'bg-[#f4f2ef] border border-[#1a8a4a]' :
                  isCurrent ? 'bg-[#f4f2ef] border border-[#c44033]' :
                  'bg-[#faf9f7] border border-dashed border-[#e0ddd7]'
                }`}
              >
                <span className={`text-xs font-outfit ${
                  isSelected ? 'font-bold text-[#c44033]' :
                  hasPhoto ? 'font-semibold text-[#1a8a4a]' :
                  isCurrent ? 'font-normal text-[#c44033]' :
                  'font-normal text-[#ccc8c0]'
                }`}>
                  W{weekNum}
                </span>
                {hasPhoto && (
                  <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSelected ? 'bg-[#c44033]' : 'bg-[#1a8a4a]'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Weekly Insight */}
      <div className="mx-5 my-4 p-4 bg-[rgba(196,64,51,0.03)] rounded-[16px] border border-[rgba(196,64,51,0.05)]">
        <p className="text-xs font-bold text-[#c44033] font-outfit uppercase tracking-[1px] mb-1.5">Week {selectedWeek || actualWeek} insight</p>
        <p className="text-sm text-[#3d3935] font-outfit leading-[1.6]">
          {weeklyInsight || getWeeklyInsight(selectedWeek || actualWeek)}
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
            <span className="text-sm text-[#5c5757] font-outfit">Day {currentDay} &middot; Week {actualWeek}</span>
          </div>
        </div>

        <div className="w-full bg-[#f4f2ef] rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#1a8a4a] to-[#c44033] rounded-full transition-all duration-1000"
            style={{ width: `${Math.min((currentDay / 90) * 100, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-[#a39e95] font-outfit">
          <span>Day {currentDay} of 90</span>
          <span>{Math.min(Math.round((currentDay / 90) * 100), 100)}% Complete</span>
        </div>

        {/* Photo count */}
        <div className="mt-3 pt-3 border-t border-[#ede9e5] flex justify-between text-xs text-[#5c5757] font-outfit">
          <span>{photos.length} photo{photos.length !== 1 ? 's' : ''} uploaded</span>
          <span>{weeksWithPhotos.size} of {actualWeek} weeks captured</span>
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
                actualWeek >= milestone.week
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
