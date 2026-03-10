import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOffline } from '../contexts/OfflineContext';
import { saveWeeklyPhoto, getWeeklyPhotos } from '../utils/db';
import { Camera, X, Check, Upload, Calendar, TrendingUp } from 'lucide-react';
import BottomNavigation from './BottomNavigation';

export default function PhotoUploadPage() {
  const { patient } = useAuth();
  const { isOnline, queueForSync } = useOffline();
  const navigate = useNavigate();
  
  const [capturedImage, setCapturedImage] = useState(null);
  const [previousPhoto, setPreviousPhoto] = useState(null);
  const [week, setWeek] = useState(4);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [weeklyInsight, setWeeklyInsight] = useState('');

  // Generate random weekly insights
  const weeklyInsights = [
    "One full cell renewal cycle complete. Glutathione & Alpha Arbutin are at full efficacy. Most women see visible tone changes right around now. Compare your photos closely.",
    "Your skin barrier is strengthening. Notice how your complexion appears more even and less reactive this week.",
    "Melanin production is regulating. You should notice reduced hyperpigmentation and more uniform skin tone.",
    "Collagen production is peaking. Your skin should feel plumper and more hydrated than previous weeks.",
    "Cellular turnover is accelerating. Dead skin cells are shedding faster, revealing brighter skin underneath.",
    "Antioxidant levels are optimal. Your skin is better protected against environmental stressors and free radicals.",
    "Blood circulation to skin has improved. You might notice a healthy glow and better nutrient delivery.",
    "Inflammation is reducing. Any previous redness or irritation should be noticeably calmer this week.",
    "Hydration levels are balancing. Your skin should maintain moisture better throughout the day."
  ];

  useEffect(() => {
    loadPreviousPhoto();
    generateWeeklyInsight();
  }, [week]);

  const patientPhone = patient?.phone || patient?.phoneNumber;

  const loadPreviousPhoto = async () => {
    try {
      const userPhotos = await getWeeklyPhotos(patientPhone);
      if (userPhotos && userPhotos.length > 0) {
        const lastWeek = userPhotos[userPhotos.length - 1];
        setPreviousPhoto(lastWeek);
      }
    } catch (error) {
      console.error('Error loading previous photo:', error);
    }
  };

  const generateWeeklyInsight = () => {
    const randomInsight = weeklyInsights[Math.floor(Math.random() * weeklyInsights.length)];
    setWeeklyInsight(randomInsight);
  };

  const handleCameraCapture = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setCapturedImage(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUnlockProgress = () => {
    // Try mobile camera first, fallback to PC file picker
    const mobileInput = document.getElementById('camera-input');
    const pcInput = document.getElementById('pc-camera-input');
    
    if (mobileInput) {
      mobileInput.click();
    }
    
    // Fallback for PC - if mobile doesn't work, try PC input after a delay
    setTimeout(() => {
      if (!capturedImage && pcInput) {
        pcInput.click();
      }
    }, 1000);
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setShowSuccess(false);
    // Trigger camera again
    setTimeout(() => {
      document.getElementById('camera-input').click();
    }, 100);
  };

  const handleSubmit = async () => {
    if (!capturedImage) return;
    
    setIsSubmitting(true);
    
    try {
      const serverPayload = {
        patientPhone,
        weekNumber: weekNumber,
        day: currentDay,
        photoData: capturedImage,
        photoUrl: '',
        skinScore: 0,
        notes: `Week ${weekNumber} photo - ${weeklyInsight.substring(0, 100)}...`,
        tags: [`week-${weekNumber}`, `day-${currentDay}`, 'progress-photo', consentGiven ? 'consent-given' : 'no-consent']
      };

      const localPhoto = {
        id: `photo-${Date.now()}`,
        patientPhone,
        week: weekNumber,
        day: currentDay,
        photoData: capturedImage,
        synced: false,
        createdAt: new Date().toISOString()
      };

      // Always save locally first
      await saveWeeklyPhoto(localPhoto);

      if (isOnline) {
        try {
          const response = await fetch('/api/photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(serverPayload),
          });

          if (response.ok) {
            const result = await response.json();
            console.log('Photo saved to MongoDB:', result);
            await saveWeeklyPhoto({ ...localPhoto, synced: true, serverId: result.id });
          } else {
            console.error('Photo upload failed with status:', response.status);
            await queueForSync('weeklyPhoto', serverPayload);
          }
        } catch (syncError) {
          console.warn('Photo saved locally, queued for sync:', syncError.message);
          await queueForSync('weeklyPhoto', serverPayload);
        }
      } else {
        await queueForSync('weeklyPhoto', serverPayload);
      }

      setShowSuccess(true);
      setTimeout(() => {
        navigate('/transformation');
      }, 2000);

    } catch (error) {
      console.error('Error saving photo:', error);
      alert('Failed to save photo. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentDay = Math.floor((Date.now() - new Date(patient?.startDate)) / (1000 * 60 * 60 * 24)) + 1;
  const isWeeklyPhotoDay = currentDay % 7 === 0;
  const weekNumber = Math.ceil(currentDay / 7);

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="bg-[#1a1a1a] p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white text-lg font-semibold">Weekly Progress Check</h1>
            <p className="text-white/60 text-sm mt-1">Week {weekNumber} • Day {currentDay}</p>
          </div>
          <div className="text-center">
            <div className="text-2xl mb-1">🎉</div>
            <div className="text-white/60 text-xs">7-Day Streak Complete!</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative">
        {capturedImage ? (
          <img 
            src={capturedImage} 
            alt="Captured" 
            className="w-full h-full object-cover" 
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mb-4">
                <div className="text-3xl">🔑</div>
              </div>
              <p className="text-white/80 text-sm mb-2">You've earned your weekly progress check!</p>
              <p className="text-white/60 text-xs mb-4">Take your photo to unlock your progress comparison</p>
              <button 
                onClick={handleUnlockProgress}
                className="bg-[#c44033] text-white px-6 py-3 rounded-xl cursor-pointer inline-flex items-center gap-2 hover:bg-[#a0352a] transition-colors"
              >
                <Camera className="w-5 h-5" />
                <span>Unlock Progress</span>
              </button>
              <input
                id="camera-input"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleCameraCapture}
                className="hidden"
              />
              {/* PC fallback */}
              <input
                id="pc-camera-input"
                type="file"
                accept="image/*"
                onChange={handleCameraCapture}
                className="hidden"
              />
            </div>
          </div>
        )}

        {/* Progress Comparison - The Reward */}
        {capturedImage && previousPhoto && (
          <div className="absolute bottom-4 left-4 right-4 bg-black/80 rounded-xl p-4 backdrop-blur-sm border border-[#c44033]/30">
            <div className="text-center mb-3">
              <div className="text-2xl mb-1">✨</div>
              <p className="text-white font-semibold text-sm">Your Progress Comparison</p>
              <p className="text-white/60 text-xs">You've unlocked your weekly transformation!</p>
            </div>
            <div className="flex items-center justify-between text-white">
              <div className="text-center">
                <p className="text-xs text-gray-400">Week {previousPhoto.week}</p>
                <p className="font-semibold">Before</p>
                <div className="w-12 h-12 rounded-lg bg-white/10 mt-1 overflow-hidden">
                  <img src={previousPhoto.photoData} alt="Before" className="w-full h-full object-cover" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400">Week {weekNumber}</p>
                <p className="font-semibold">Now</p>
                <div className="w-12 h-12 rounded-lg bg-white/10 mt-1 overflow-hidden">
                  <img src={capturedImage} alt="Now" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-[#1a1a1a] p-6 space-y-4">
        <button 
          onClick={() => setConsentGiven(!consentGiven)} 
          className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
        >
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${consentGiven ? 'bg-[#c44033]' : 'bg-white/20'}`}>
            {consentGiven && <Check className="w-4 h-4 text-white" />}
          </div>
          <span className="text-white text-sm">I'd like to share my photos to help improve Gleuhr's analysis</span>
        </button>

        <div className="flex gap-3">
          <button 
            onClick={handleRetake} 
            className="flex-1 py-3 px-4 rounded-xl bg-white/10 text-white font-medium flex items-center justify-center gap-2 hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" /> Retake
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !capturedImage}
            className="flex-1 py-3 px-4 rounded-xl bg-[#c44033] text-white font-medium flex items-center justify-center gap-2 hover:bg-[#a0352a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Check className="w-5 h-5" /> {isSubmitting ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Success Message */}
      {showSuccess && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
        >
          <motion.div 
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            className="bg-white rounded-2xl p-8 text-center max-w-sm mx-4"
          >
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Photo Saved!</h3>
            <p className="text-gray-600">Your week {week} photo has been saved successfully.</p>
            <div className="mt-4 text-sm text-gray-500">
              Redirecting to your journey...
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}
