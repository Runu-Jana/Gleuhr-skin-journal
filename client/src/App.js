import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

import { useAuth } from './contexts/AuthContext';
import { AuthProvider } from './contexts/AuthContext';
import { OfflineProvider } from './contexts/OfflineContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { GamificationProvider } from './contexts/GamificationContext';
import { AccessibilityProvider } from './contexts/AccessibilityContext';

// Components
import LoginScreen from './components/LoginScreen';
import SelfRegisterScreen from './components/SelfRegisterScreen';
import OnboardingScreen from './components/OnboardingScreen';
import HomeScreen from './components/HomeScreen';
import JourneyScreen from './components/JourneyScreen';
import ProfileScreen from './components/ProfileScreen';
import SkinScoreScreen from './components/SkinScoreScreen';
import SkinScoreResults from './components/SkinScoreResults';
import WeeklyPhotoScreen from './components/WeeklyPhotoScreen';
import PhotoUploadPage from './components/PhotoUploadPage';
import WeeklyPhotoPopup from './components/WeeklyPhotoPopup';
import StreakRestorationPopup from './components/StreakRestorationPopup';
import CheckInSuccessPage from './components/CheckInSuccessPage';
import TransformationPage from './components/TransformationPage';
import BottomNavigation from './components/BottomNavigation';
import ShieldSuccessAnimation from './components/ShieldSuccessAnimation';
import EnhancedOfflineIndicator from './components/EnhancedOfflineIndicator';
import InstallPrompt from './components/InstallPrompt';
import GleuhrInsider from './components/GleuhrInsider';
import AccessibilityMenu from './components/AccessibilityMenu';
import AchievementPopup from './components/AchievementPopup';
import AdminDietDashboard from './components/AdminDietDashboard';
import AdminDashboard from './components/AdminDashboard';
import AdminLogin from './components/AdminLogin';
import DieticianLogin from './components/DieticianLogin';
import DieticianDashboard from './components/DieticianDashboard';

// Utils
import { initDB } from './utils/db';
import { saveCheckIn } from './utils/db';
import { generateId } from './utils/helpers';
import AMPage from './components/amPage';
import PMPage from './components/pmPage';
import { getTimeOfDay } from './utils/timeUtils';
import { calculateDay, isWeeklyPhotoDay, getWeekNumber } from './utils/helpers';
import SkinScoreAssessment from './components/SkinScoreAssessment';

function AdminRoute({ children }) {
  const token = localStorage.getItem('adminToken');
  if (!token) return <Navigate to="/admin/login" replace />;
  return children;
}

function DieticianRoute({ children }) {
  const token = localStorage.getItem('dieticianToken');
  if (!token) return <Navigate to="/dietician/login" replace />;
  return children;
}

function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initDB().then(() => {
      setIsLoading(false);
    });
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#c44033] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AuthProvider>
      <AccessibilityProvider>
        <NotificationProvider>
          <GamificationProvider>
            <OfflineProvider>
              <Router>
                <AppRoutes />
              </Router>
            </OfflineProvider>
          </GamificationProvider>
        </NotificationProvider>
      </AccessibilityProvider>
    </AuthProvider>
  );
}

function AppRoutes() {
  const { isAuthenticated, patient, isLoading, weeklyPhotos } = useAuth();
  const [showWeeklyPhotoPopup, setShowWeeklyPhotoPopup] = useState(false);

  // Show weekly photo popup only if today is a photo day AND no photo uploaded yet this week
  useEffect(() => {
    if (isAuthenticated && patient && isWeeklyPhotoDay(patient?.startDate)) {
      const currentWeek = getWeekNumber(patient.startDate);
      const alreadyUploaded = Array.isArray(weeklyPhotos) && weeklyPhotos.some(p => p.week === currentWeek);
      if (!alreadyUploaded) setShowWeeklyPhotoPopup(true);
    }
  }, [isAuthenticated, patient, weeklyPhotos]);

  const handleCloseWeeklyPhotoPopup = () => {
    setShowWeeklyPhotoPopup(false);
  };

  console.log('AppRoutes - isAuthenticated:', isAuthenticated);
  console.log('AppRoutes - patient:', patient);
  console.log('AppRoutes - isLoading:', isLoading);

  return (
    <div className="min-h-screen bg-[#faf8f5] pb-20">
      {/* Skip to main content for accessibility */}
      <button
        onClick={() => document.getElementById('main-content')?.focus()}
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-500 text-white px-4 py-2 rounded-md z-50"
      >
        Skip to main content
      </button>

      <AccessibilityMenu />
      <EnhancedOfflineIndicator />
      <InstallPrompt />

      <main id="main-content" tabIndex="-1">
        <Routes>
          <Route
            path="/register"
            element={<Navigate to="/login" replace />}
          />
          <Route
            path="/login"
            element={isAuthenticated ? <Navigate to="/" replace /> : <LoginScreen />}
          />
          {/* Dietician & admin routes — always available, no auth loading dependency */}
          <Route path="/dietician/login" element={<DieticianLogin onLogin={() => window.location.replace('/dietician/dashboard')} />} />
          <Route path="/dietician/dashboard" element={<DieticianRoute><DieticianDashboard /></DieticianRoute>} />
          <Route path="/admin/login" element={<AdminLogin onLogin={() => window.location.replace('/admin/dashboard')} />} />
          <Route path="/admin/diet-plans" element={<AdminRoute><AdminDietDashboard /></AdminRoute>} />
          <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          {/* Patient routes — show loading spinner while auth state resolves */}
          {isLoading ? (
            <Route path="*" element={
              <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-[#c44033] border-t-transparent rounded-full animate-spin" />
              </div>
            } />
          ) : (
            <>
              <Route
                path="/onboarding"
                element={!isAuthenticated ? <Navigate to="/login" replace /> : patient?.hasCommitted ? <Navigate to="/" replace /> : <OnboardingScreen />}
              />
              <Route
                path="/skin-score"
                element={!isAuthenticated ? <Navigate to="/login" replace /> : <SkinScoreScreen />}
              />
              <Route
                path="/skin-score-results"
                element={!isAuthenticated ? <Navigate to="/login" replace /> : <SkinScoreResults/>}
              />
              <Route
                path="/weekly-photo"
                element={!isAuthenticated ? <Navigate to="/login" replace /> : <WeeklyPhotoScreen />}
              />
              <Route
                path="/amPage"
                element={!isAuthenticated ? <Navigate to="/login" replace /> : <AMPage />}
              />
              <Route
                path="/pmPage"
                element={!isAuthenticated ? <Navigate to="/login" replace /> : <PMPage />}
              />
              <Route
                path="/transformation"
                element={!isAuthenticated ? <Navigate to="/login" replace /> : <TransformationPage />}
              />
              <Route
                path="/journey"
                element={!isAuthenticated ? <Navigate to="/login" replace /> : <JourneyScreen />}
              />
              <Route
                path="/profile"
                element={!isAuthenticated ? <Navigate to="/login" replace /> : <ProfileScreen />}
              />
              <Route
                path="/photo-upload"
                element={!isAuthenticated ? <Navigate to="/login" replace /> : <PhotoUploadPage />}
              />
              <Route
                path="/checkin-success"
                element={!isAuthenticated ? <Navigate to="/login" replace /> : <CheckInSuccessPage />}
              />
              <Route
                path="/"
                element={!isAuthenticated ? <Navigate to="/login" replace /> : <MainApp />}
              />
            </>
          )}
        </Routes>

      </main>
    </div>
  );
}

function MainApp() {
  const { patient, streak: streakData, refreshStreak, weeklyPhotos } = useAuth();
  const navigate = useNavigate();
  const [showWeeklyPhotoPopup, setShowWeeklyPhotoPopup] = useState(false);

  // ── Streak restoration popup ────────────────────────────────────────────────
  const [showStreakPopup, setShowStreakPopup] = useState(false);
  const [streakPopupPath, setStreakPopupPath] = useState('/amPage');
  const [streakPopupPrev, setStreakPopupPrev] = useState(0);

  // ── Shield success animation (shown after restore) ──────────────────────────
  const [showShieldAnimation, setShowShieldAnimation] = useState(false);
  const [shieldAnimationData, setShieldAnimationData] = useState(null);

  // Expose globals so HomeScreen & BottomNavigation can fire the popup
  // without prop-drilling.
  useEffect(() => {
    window.__gleuhrNavigate = navigate;
    window.__gleuhrStreakPopup = (path, previousStreak) => {
      setStreakPopupPath(path);
      setStreakPopupPrev(previousStreak || 0);
      setShowStreakPopup(true);
    };
    return () => {
      delete window.__gleuhrNavigate;
      delete window.__gleuhrStreakPopup;
    };
  }, [navigate]);

  // Show weekly photo popup only if today is a photo day AND no photo uploaded yet this week
  useEffect(() => {
    if (patient && isWeeklyPhotoDay(patient?.startDate)) {
      const currentWeek = getWeekNumber(patient.startDate);
      const alreadyUploaded = Array.isArray(weeklyPhotos) && weeklyPhotos.some(p => p.week === currentWeek);
      if (!alreadyUploaded) setShowWeeklyPhotoPopup(true);
    }
  }, [patient, weeklyPhotos]);

  const handleCloseWeeklyPhotoPopup = () => {
    setShowWeeklyPhotoPopup(false);
  };

  return (
    <>
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="*" element={<HomeScreen />} />
          <Route path="/home" element={<HomeScreen />} />
          <Route path="/amPage" element={<AMPage />} />
          <Route path="/pmPage" element={<PMPage />} />
          <Route path="/journey" element={<JourneyScreen />} />
          <Route path="/skin-score" element={<SkinScoreScreen />} />
          <Route path="/skin-score-results" element={<SkinScoreResults />} />
          <Route path="/weekly-photo" element={<WeeklyPhotoScreen />} />
          <Route path="/photo-upload" element={<PhotoUploadPage />} />
          <Route path="/checkin-success" element={<CheckInSuccessPage />} />
          <Route path="/transformation" element={<TransformationPage />} />
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/onboarding" element={<OnboardingScreen />} />
        </Routes>
      </AnimatePresence>
      <BottomNavigation />
      <GleuhrInsider />
      
      {/* Weekly Photo Popup */}
      <WeeklyPhotoPopup
        isVisible={showWeeklyPhotoPopup}
        onClose={handleCloseWeeklyPhotoPopup}
        patient={patient}
      />

      {/* Streak Restoration Popup */}
      <StreakRestorationPopup
        isVisible={showStreakPopup}
        previousStreak={streakPopupPrev}
        shields={streakData?.restorationShields?.available || 0}
        onRestore={async () => {
          const phone = patient?.phone || patient?.phoneNumber;
          if (!phone) return;
          try {
            const res = await fetch('/api/streak/restore', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ phoneNumber: phone }),
            });
            const result = await res.json();
            if (result.success) {
              // ── 1. Clear the "missed yesterday" flag so the popup never
              //       re-triggers until the streak breaks again.
              //       Also record *which* date was restored so HomeScreen's
              //       fetchData() cannot overwrite the flag back to '1' when
              //       it re-runs (it checks gleuhrShieldRestoredDate first).
              localStorage.setItem('gleuhrMissedYesterday', '0');
              const yesterday = new Date();
              yesterday.setDate(yesterday.getDate() - 1);
              const yesterdayStr = yesterday.toISOString().split('T')[0];
              localStorage.setItem('gleuhrShieldRestoredDate', yesterdayStr);

              // ── 2. Persist the shield-restored check-in to IndexedDB so
              //       HomeScreen calendar picks it up without a full reload.
              const patientIdLocal = patient?.id || patient?._id;
              if (patientIdLocal) {
                await saveCheckIn({
                  id: result.shieldCheckinId || generateId(),
                  patientId: patientIdLocal,
                  patientPhone: phone,
                  date: yesterdayStr,
                  amRoutine: false,
                  pmRoutine: false,
                  shieldRestored: true,
                  completed: true,
                  synced: true,
                });
              }

              await refreshStreak();
              setShowStreakPopup(false);
              setShieldAnimationData({
                streakRestored: true,
                shieldsRemaining: result.shieldsRemaining,
                previousStreak: result.previousStreak,
                newStreak: result.restoredStreak,
                redirectPath: streakPopupPath,
              });
              setShowShieldAnimation(true);
            } else {
              alert(result.error || 'No shields available this month');
            }
          } catch (err) {
            console.error('Shield restore error:', err);
            alert('Failed to restore streak. Please try again.');
          }
        }}
        onContinue={() => {
          setShowStreakPopup(false);
          // Navigate after a short delay so exit animation plays
          setTimeout(() => window.__gleuhrNavigate?.(streakPopupPath), 100);
        }}
        onClose={() => setShowStreakPopup(false)}
      />

      {/* Shield Success Animation */}
      {showShieldAnimation && shieldAnimationData && (
        <ShieldSuccessAnimation
          streakRestored={shieldAnimationData.streakRestored}
          shieldsRemaining={shieldAnimationData.shieldsRemaining}
          previousStreak={shieldAnimationData.previousStreak}
          newStreak={shieldAnimationData.newStreak}
          redirectPath={shieldAnimationData.redirectPath}
        />
      )}
    </>
  );
}

export default App;
