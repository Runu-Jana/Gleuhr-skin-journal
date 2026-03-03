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

  const loadPreviousPhoto = async () => {
    try {
      const userPhotos = await getWeeklyPhotos(patient?.email);
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

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setCapturedImage(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setShowSuccess(false);
  };

  const handleSubmit = async () => {
    if (!capturedImage || !consentGiven) return;
    
    setIsSubmitting(true);
    
    try {
      const photoData = {
        patientPhone: patient?.phone || patient?.phoneNumber,
        weekNumber: week,
        photoData: capturedImage,
        photoUrl: '', // Will be set by server if needed
        skinScore: 0,
        notes: `Week ${week} photo - ${weeklyInsight.substring(0, 100)}...`,
        tags: [`week-${week}`, 'progress-photo', consentGiven ? 'consent-given' : 'no-consent']
      };

      if (isOnline) {
        // Save directly to MongoDB
        const response = await fetch('/api/photo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(photoData),
        });

        if (!response.ok) {
          throw new Error('Failed to save photo to server');
        }

        const result = await response.json();
        console.log('Photo saved to MongoDB:', result);
        
        // Also save to IndexedDB for local backup
        await saveWeeklyPhoto({
          id: `photo-${Date.now()}`,
          patientEmail: patient?.email,
          week,
          photoData: capturedImage,
          synced: true,
          serverId: result.id,
          createdAt: new Date().toISOString()
        });
      } else {
        // Queue for sync when online
        await queueForSync({
          type: 'photo',
          data: photoData,
          id: `photo-${Date.now()}`,
          createdAt: new Date().toISOString()
        });

        // Save to IndexedDB
        await saveWeeklyPhoto({
          id: `photo-${Date.now()}`,
          patientEmail: patient?.email,
          week,
          photoData: capturedImage,
          synced: false,
          createdAt: new Date().toISOString()
        });
      }

      setShowSuccess(true);
      setTimeout(() => {
        navigate('/transformation');
      }, 2000);
      
    } catch (error) {
      console.error('Error saving photo:', error);
      
      // Fallback: save to IndexedDB only
      await saveWeeklyPhoto({
        id: `photo-${Date.now()}`,
        patientEmail: patient?.email,
        week,
        photoData: capturedImage,
        synced: false,
        createdAt: new Date().toISOString()
      });
      
      setShowSuccess(true);
      setTimeout(() => {
        navigate('/transformation');
      }, 2000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentDay = Math.floor((Date.now() - new Date(patient?.startDate)) / (1000 * 60 * 60 * 24)) + 1;

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="bg-[#1a1a1a] p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-white text-lg font-semibold">Week {week} Photo</h1>
          <div className="text-white/60 text-sm">
            Day {currentDay} of 90
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
                <Upload className="w-8 h-8 text-white/60" />
              </div>
              <p className="text-white/80 text-sm mb-4">Upload your week {week} photo</p>
              <label className="bg-[#c44033] text-white px-6 py-3 rounded-xl cursor-pointer inline-flex items-center gap-2 hover:bg-[#a0352a] transition-colors">
                <Camera className="w-5 h-5" />
                <span>Choose Photo</span>
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>
        )}

        {/* Previous Photo Comparison */}
        {previousPhoto && (
          <div className="absolute bottom-4 left-4 right-4 bg-black/70 rounded-xl p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between text-white">
              <div>
                <p className="text-xs text-gray-400">Week {previousPhoto.week}</p>
                <p className="font-semibold">Before</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Week {week}</p>
                <p className="font-semibold">Now</p>
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
          <span className="text-white text-sm">Allow Gleuhr to use my photos for analysis</span>
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
            disabled={isSubmitting || !capturedImage || !consentGiven}
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
