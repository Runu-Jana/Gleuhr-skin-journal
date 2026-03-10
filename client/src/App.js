import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import CheckInSuccessPage from './components/CheckInSuccessPage';
import TransformationPage from './components/TransformationPage';
import BottomNavigation from './components/BottomNavigation';
import EnhancedOfflineIndicator from './components/EnhancedOfflineIndicator';
import InstallPrompt from './components/InstallPrompt';
import GleuhrInsider from './components/GleuhrInsider';
import AccessibilityMenu from './components/AccessibilityMenu';
import AchievementPopup from './components/AchievementPopup';
import AdminDietDashboard from './components/AdminDietDashboard';
import AdminDashboard from './components/AdminDashboard';

// Utils
import { initDB } from './utils/db';
import AMPage from './components/amPage';
import PMPage from './components/pmPage';
import { getTimeOfDay } from './utils/timeUtils';
import { calculateDay, isWeeklyPhotoDay } from './utils/helpers';
import SkinScoreAssessment from './components/SkinScoreAssessment';

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
  const { isAuthenticated, patient, isLoading } = useAuth();
  const [showWeeklyPhotoPopup, setShowWeeklyPhotoPopup] = useState(false);

  // Check if today is a weekly photo day (7, 14, 21, 28, etc.)
  useEffect(() => {
    if (isAuthenticated && patient) {
      // Show popup on weekly photo days (every 7th day from start)
      if (isWeeklyPhotoDay(patient?.startDate)) {
        setShowWeeklyPhotoPopup(true);
      }
    }
  }, [isAuthenticated, patient]);

  const handleCloseWeeklyPhotoPopup = () => {
    setShowWeeklyPhotoPopup(false);
  };

  console.log('AppRoutes - isAuthenticated:', isAuthenticated);
  console.log('AppRoutes - patient:', patient);
  console.log('AppRoutes - isLoading:', isLoading);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#c44033] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
          <Route path="/admin/diet-plans" element={<AdminDietDashboard />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
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
            path="/photo-upload" 
            element={!isAuthenticated ? <Navigate to="/login" replace /> : <PhotoUploadPage />} 
          />
          <Route 
            path="/checkin-success" 
            element={!isAuthenticated ? <Navigate to="/login" replace /> : <CheckInSuccessPage />} 
          />
          <Route 
            path="/admin" 
            element={<AdminDashboard />} 
          />
          <Route 
            path="/" 
            element={!isAuthenticated ? <Navigate to="/login" replace /> : <MainApp />} 
          />
        </Routes>
        
      </main>
    </div>
  );
}

function MainApp() {
  const { patient, streak: streakData } = useAuth();
  const [showWeeklyPhotoPopup, setShowWeeklyPhotoPopup] = useState(false);

  // Check if today is a weekly photo day (7, 14, 21, 28, etc.)
  useEffect(() => {
    if (patient) {
      // Show popup on weekly photo days (every 7th day from start)
      if (isWeeklyPhotoDay(patient?.startDate)) {
        setShowWeeklyPhotoPopup(true);
      }
    }
  }, [patient]);

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
    </>
  );
}

export default App;
