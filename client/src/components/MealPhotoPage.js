import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useOffline } from '../contexts/OfflineContext';
import { saveMealPhoto, getTodayMealPhotos } from '../utils/db';
import { calculateDay } from '../utils/helpers';
import BottomNavigation from './BottomNavigation';
import { Camera, Check, X, UtensilsCrossed, Sunrise, Sun, Moon } from 'lucide-react';

const MEALS = [
  {
    id: 'breakfast',
    label: 'Breakfast',
    timeHint: '7 – 10 AM',
    Icon: Sunrise,
    gradient: 'from-orange-50 to-amber-50',
    accent: 'text-amber-600',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-700'
  },
  {
    id: 'lunch',
    label: 'Lunch',
    timeHint: '12 – 2 PM',
    Icon: Sun,
    gradient: 'from-yellow-50 to-lime-50',
    accent: 'text-lime-700',
    border: 'border-lime-200',
    badge: 'bg-lime-100 text-lime-700'
  },
  {
    id: 'dinner',
    label: 'Dinner',
    timeHint: '7 – 9 PM',
    Icon: Moon,
    gradient: 'from-indigo-50 to-blue-50',
    accent: 'text-indigo-600',
    border: 'border-indigo-200',
    badge: 'bg-indigo-100 text-indigo-700'
  }
];

export default function MealPhotoPage() {
  const { patient } = useAuth();
  const { isOnline, queueForSync } = useOffline();

  const patientPhone = patient?.phone || patient?.phoneNumber;
  const today = new Date().toISOString().split('T')[0];
  const dayOfJourney = calculateDay(patient?.startDate);

  // { breakfast: {photoData, synced, ...} | null, lunch: ..., dinner: ... }
  const [photos, setPhotos] = useState({ breakfast: null, lunch: null, dinner: null });
  // which meal is currently being captured
  const [capturing, setCapturing] = useState(null);
  // captured image (base64) pending confirmation
  const [pendingImage, setPendingImage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef(null);

  // Load today's meal photos from IndexedDB on mount
  useEffect(() => {
    const load = async () => {
      if (!patientPhone) return;
      try {
        const local = await getTodayMealPhotos(patientPhone);
        const map = { breakfast: null, lunch: null, dinner: null };
        local.forEach(p => { if (map[p.mealType] !== undefined) map[p.mealType] = p; });
        setPhotos(map);
      } catch (e) {
        console.error('Error loading meal photos:', e);
      }
    };
    load();

    // Also try server
    const loadServer = async () => {
      if (!patientPhone) return;
      try {
        const res = await fetch(`/api/meal-photo/${patientPhone}/date/${today}`);
        if (!res.ok) return;
        const serverPhotos = await res.json();
        setPhotos(prev => {
          const updated = { ...prev };
          serverPhotos.forEach(p => {
            if (updated[p.mealType] !== undefined) {
              updated[p.mealType] = p;
            }
          });
          return updated;
        });
      } catch { /* non-fatal */ }
    };
    loadServer();
  }, [patientPhone, today]);

  const openCamera = (mealType) => {
    setCapturing(mealType);
    setPendingImage(null);
    setTimeout(() => fileInputRef.current?.click(), 50);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) { setCapturing(null); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setPendingImage(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDiscard = () => {
    setPendingImage(null);
    setCapturing(null);
  };

  const handleSave = async () => {
    if (!pendingImage || !capturing) return;
    setIsSaving(true);

    const record = {
      id: `meal_${capturing}_${today}_${Date.now()}`,
      patientId: patientPhone,
      patientPhone,
      mealType: capturing,
      mealDate: today,
      photoData: pendingImage,
      dayOfJourney,
      synced: false,
      createdAt: new Date().toISOString()
    };

    try {
      await saveMealPhoto(record);

      setPhotos(prev => ({ ...prev, [capturing]: record }));

      const serverPayload = {
        patientPhone,
        mealType: capturing,
        mealDate: today,
        photoData: pendingImage,
        day: dayOfJourney,
        tags: [capturing, today, `day-${dayOfJourney}`]
      };

      if (isOnline) {
        try {
          const res = await fetch('/api/meal-photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(serverPayload)
          });
          if (res.ok) {
            const result = await res.json();
            await saveMealPhoto({ ...record, synced: true, serverId: result.id });
            setPhotos(prev => ({ ...prev, [capturing]: { ...record, synced: true } }));
          } else {
            await queueForSync('mealPhoto', serverPayload);
          }
        } catch {
          await queueForSync('mealPhoto', serverPayload);
        }
      } else {
        await queueForSync('mealPhoto', serverPayload);
      }
    } catch (err) {
      console.error('Failed to save meal photo:', err);
    } finally {
      setIsSaving(false);
      setPendingImage(null);
      setCapturing(null);
    }
  };

  const loggedCount = Object.values(photos).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-[#faf8f5] pb-24">
      {/* Header */}
      <div className="bg-white border-b border-[#ede9e5] px-5 pt-10 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#fef3f0] flex items-center justify-center">
            <UtensilsCrossed className="w-5 h-5 text-[#c44033]" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-[17px] font-semibold text-[#1a1a1a] font-outfit">Meal Log</h1>
            <p className="text-xs text-[#9b9088] font-outfit">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="ml-auto">
            <span className="text-xs font-outfit font-medium text-[#c44033] bg-[#fef3f0] px-2.5 py-1 rounded-full">
              {loggedCount}/3 logged
            </span>
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex gap-2 mt-4">
          {MEALS.map(m => (
            <div
              key={m.id}
              className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
                photos[m.id] ? 'bg-[#c44033]' : 'bg-[#ede9e5]'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Meal cards */}
      <div className="px-4 pt-5 space-y-4">
        {MEALS.map((meal) => {
          const photo = photos[meal.id];
          const MealIcon = meal.Icon;

          return (
            <motion.div
              key={meal.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-gradient-to-br ${meal.gradient} border ${meal.border} rounded-2xl overflow-hidden`}
            >
              {photo ? (
                /* Uploaded state */
                <div className="flex items-stretch">
                  <img
                    src={photo.photoData || photo.photoUrl}
                    alt={meal.label}
                    className="w-28 h-28 object-cover flex-shrink-0"
                  />
                  <div className="flex-1 p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`text-[11px] font-medium font-outfit ${meal.badge} px-2 py-0.5 rounded-full`}>
                          {meal.label}
                        </span>
                        <span className={`w-4 h-4 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0`}>
                          <Check className="w-2.5 h-2.5 text-green-600" strokeWidth={2.5} />
                        </span>
                      </div>
                      <p className="text-[12px] text-[#6b6560] font-outfit">Photo logged</p>
                    </div>
                    <button
                      onClick={() => openCamera(meal.id)}
                      className={`text-[11px] font-outfit font-medium ${meal.accent} underline underline-offset-2 text-left`}
                    >
                      Retake photo
                    </button>
                  </div>
                </div>
              ) : (
                /* Empty state */
                <div className="p-4 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl bg-white/70 flex items-center justify-center flex-shrink-0`}>
                    <MealIcon className={`w-6 h-6 ${meal.accent}`} strokeWidth={1.5} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[14px] font-semibold text-[#1a1a1a] font-outfit">{meal.label}</p>
                    <p className="text-[11px] text-[#9b9088] font-outfit">{meal.timeHint}</p>
                  </div>
                  <button
                    onClick={() => openCamera(meal.id)}
                    className="flex items-center gap-1.5 bg-white/80 border border-white/60 rounded-xl px-3 py-2 shadow-sm active:scale-95 transition-transform"
                  >
                    <Camera className={`w-4 h-4 ${meal.accent}`} strokeWidth={1.5} />
                    <span className={`text-[12px] font-outfit font-medium ${meal.accent}`}>Add</span>
                  </button>
                </div>
              )}
            </motion.div>
          );
        })}

        {/* Tip */}
        <p className="text-center text-[11px] text-[#b0a89e] font-outfit pt-2">
          Photos help your dietician review your meals and give personalised advice.
        </p>
      </div>

      {/* Preview & confirm overlay */}
      <AnimatePresence>
        {pendingImage && capturing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black flex flex-col"
          >
            <img
              src={pendingImage}
              alt="preview"
              className="flex-1 object-contain w-full"
            />
            <div className="bg-black px-6 pt-4 pb-8 flex gap-4">
              <button
                onClick={handleDiscard}
                disabled={isSaving}
                className="flex-1 flex items-center justify-center gap-2 bg-white/10 rounded-2xl py-4 text-white font-outfit font-medium"
              >
                <X className="w-5 h-5" />
                Retake
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 flex items-center justify-center gap-2 bg-[#c44033] rounded-2xl py-4 text-white font-outfit font-semibold"
              >
                {isSaving ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check className="w-5 h-5" />
                )}
                Save
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNavigation />
    </div>
  );
}
