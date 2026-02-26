import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOffline } from '../contexts/OfflineContext';
import { saveWeeklyPhoto } from '../utils/db';
import { getWeekNumber, generateId } from '../utils/helpers';
import { ArrowLeft, Check, X, Camera } from 'lucide-react';
import { motion } from 'framer-motion';

export default function WeeklyPhotoScreen() {
  const { patient, weeklyPhotos } = useAuth();
  const { isOnline, queueForSync } = useOffline();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [capturedImage, setCapturedImage] = useState(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const week = getWeekNumber(patient?.startDate);
  const previousPhoto = weeklyPhotos.filter(p => p.week < week).sort((a, b) => b.week - a.week)[0] || null;

  const handleCapture = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setCapturedImage(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!capturedImage) return;
    setIsSubmitting(true);

    const photoData = {
      id: generateId(),
      patientId: patient?.id,
      patientEmail: patient?.email,
      week,
      date: new Date().toISOString(),
      photoUrl: capturedImage,
      consentGiven,
      synced: false
    };

    await saveWeeklyPhoto(photoData);
    if (isOnline) queueForSync('weeklyPhoto', photoData);

    setIsSubmitting(false);
    navigate('/');
  };

  if (!capturedImage) {
    return (
      <div className="min-h-screen bg-black">
        <div className="absolute top-0 left-0 right-0 z-50 p-4 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent">
          <button onClick={() => navigate('/')} className="p-2 text-white"><ArrowLeft className="w-6 h-6" /></button>
          <span className="text-white font-medium">Week {week} Photo</span>
          <div className="w-10" />
        </div>

        <div className="h-screen flex flex-col items-center justify-center p-6">
          <div className="text-center space-y-4 mb-8">
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mx-auto">
              <Camera className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">Time for your weekly photo!</h2>
            <p className="text-gray-400 max-w-xs mx-auto">Take a clear selfie in good lighting to track your skin's progress over time.</p>
          </div>

          <div className="w-64 h-80 rounded-3xl border-4 border-white/30 flex items-center justify-center mb-8 bg-white/5">
            <span className="text-white/50 text-sm">Camera preview</span>
          </div>

          <input ref={fileInputRef} type="file" accept="image/*" capture="user" onChange={handleCapture} className="hidden" />

          <button onClick={() => fileInputRef.current?.click()} className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-2xl active:scale-95 transition-transform">
            <div className="w-16 h-16 rounded-full border-4 border-[#c44033]" />
          </button>
          <p className="text-gray-500 text-sm mt-4">Tap to capture</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="flex-1 relative">
        <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
        {previousPhoto && (
          <div className="absolute bottom-4 left-4 right-4 bg-black/70 rounded-xl p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between text-white">
              <div><p className="text-xs text-gray-400">Week {previousPhoto.week}</p><p className="font-semibold">Before</p></div>
              <div><p className="text-xs text-gray-400">Week {week}</p><p className="font-semibold">Now</p></div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-[#1a1a1a] p-6 space-y-4">
        <button onClick={() => setConsentGiven(!consentGiven)} className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${consentGiven ? 'bg-[#c44033]' : 'bg-white/20'}`}>
            {consentGiven && <Check className="w-4 h-4 text-white" />}
          </div>
          <span className="text-white text-sm">Allow Gleuhr to use my photos for analysis</span>
        </button>

        <div className="flex gap-3">
          <button onClick={handleRetake} className="flex-1 py-3 px-4 rounded-xl bg-white/10 text-white font-medium flex items-center justify-center gap-2">
            <X className="w-5 h-5" /> Retake
          </button>
          <button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 py-3 px-4 rounded-xl bg-[#c44033] text-white font-medium flex items-center justify-center gap-2">
            <Check className="w-5 h-5" /> {isSubmitting ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
