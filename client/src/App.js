import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

import { useAuth } from './contexts/AuthContext';
import { AuthProvider } from './contexts/AuthContext';
import { OfflineProvider } from './contexts/OfflineContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { GamificationProvider } from './contexts/GamificationContext';
import { AccessibilityProvider } from './contexts/AccessibilityContext';
import { AppErrorBoundary, RouteErrorBoundary } from './components/ErrorBoundary';

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
import AdminDashboard from './components/AdminDashboard';

// Utils
import { initDB } from './utils/db';
import AMPage from './components/amPage';
import PMPage from './components/pmPage';
import { getTimeOfDay } from './utils/timeUtils';
import SkinScoreAssessment from './components/SkinScoreAssessment';
import { calculateDayFromDate } from './utils/dateUtils';

function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initDB().then(() => {
      setIsLoading(false);
    }).catch(error => {
      console.error('Failed to initialize database:', error);
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
    <AppErrorBoundary>
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
    </AppErrorBoundary>
  );
}

function AppRoutes() {
  const { isAuthenticated, patient, isLoading } = useAuth();
  const [showWeeklyPhotoPopup, setShowWeeklyPhotoPopup] = useState(false);

  // Check if today is a weekly photo day (7, 14, 21, 28, etc.)
  useEffect(() => {
    if (isAuthenticated && patient) {
      const currentDay = calculateDayFromDate(patient?.startDate);
      const isWeeklyPhotoDay = currentDay % 7 === 0;
      
      // Show popup on weekly photo days
      if (isWeeklyPhotoDay) {
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
            element={isAuthenticated ? <Navigate to="/" replace /> : <RouteErrorBoundary><LoginScreen /></RouteErrorBoundary>}
          />
          <Route
            path="/onboarding"
            element={!isAuthenticated ? <Navigate to="/login" replace /> : patient?.hasCommitted ? <Navigate to="/" replace /> : <RouteErrorBoundary><OnboardingScreen /></RouteErrorBoundary>}
          />
          <Route
            path="/skin-score"
            element={!isAuthenticated ? <Navigate to="/login" replace /> : <RouteErrorBoundary><SkinScoreScreen /></RouteErrorBoundary>}
          />
          <Route
            path="/skin-score-results"
            element={!isAuthenticated ? <Navigate to="/login" replace /> : <RouteErrorBoundary><SkinScoreResults/></RouteErrorBoundary>}
          />
          <Route
            path="/weekly-photo"
            element={!isAuthenticated ? <Navigate to="/login" replace /> : <RouteErrorBoundary><WeeklyPhotoScreen /></RouteErrorBoundary>}
          />
          <Route
            path="/amPage"
            element={!isAuthenticated ? <Navigate to="/login" replace /> : <RouteErrorBoundary><AMPage /></RouteErrorBoundary>}
          />
          <Route
            path="/pmPage"
            element={!isAuthenticated ? <Navigate to="/login" replace /> : <RouteErrorBoundary><PMPage /></RouteErrorBoundary>}
          />
          <Route
            path="/transformation"
            element={!isAuthenticated ? <Navigate to="/login" replace /> : <RouteErrorBoundary><TransformationPage /></RouteErrorBoundary>}
          />
          <Route
            path="/journey"
            element={!isAuthenticated ? <Navigate to="/login" replace /> : <RouteErrorBoundary><JourneyScreen /></RouteErrorBoundary>}
          />
          <Route
            path="/photo-upload"
            element={!isAuthenticated ? <Navigate to="/login" replace /> : <RouteErrorBoundary><PhotoUploadPage /></RouteErrorBoundary>}
          />
          <Route
            path="/checkin-success"
            element={!isAuthenticated ? <Navigate to="/login" replace /> : <RouteErrorBoundary><CheckInSuccessPage /></RouteErrorBoundary>}
          />
          <Route
            path="/admin"
            element={<RouteErrorBoundary><AdminDashboard /></RouteErrorBoundary>}
          />
          <Route 
            path="/" 
            element={!isAuthenticated ? <Navigate to="/login" replace /> : <MainApp showWeeklyPhotoPopup={showWeeklyPhotoPopup} onCloseWeeklyPhotoPopup={handleCloseWeeklyPhotoPopup} patient={patient} />} 
          />
        </Routes>
        
      </main>
    </div>
  );
}

function MainApp({ showWeeklyPhotoPopup, onCloseWeeklyPhotoPopup, patient }) {
  const { streak: streakData } = useAuth();

  return (
    <>
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="*" element={<RouteErrorBoundary><HomeScreen /></RouteErrorBoundary>} />
          <Route path="/home" element={<RouteErrorBoundary><HomeScreen /></RouteErrorBoundary>} />
          <Route path="/amPage" element={<RouteErrorBoundary><AMPage /></RouteErrorBoundary>} />
          <Route path="/pmPage" element={<RouteErrorBoundary><PMPage /></RouteErrorBoundary>} />
          <Route path="/journey" element={<RouteErrorBoundary><JourneyScreen /></RouteErrorBoundary>} />
          <Route path="/skin-score" element={<RouteErrorBoundary><SkinScoreScreen /></RouteErrorBoundary>} />
          <Route path="/skin-score-results" element={<RouteErrorBoundary><SkinScoreResults /></RouteErrorBoundary>} />
          <Route path="/weekly-photo" element={<RouteErrorBoundary><WeeklyPhotoScreen /></RouteErrorBoundary>} />
          <Route path="/photo-upload" element={<RouteErrorBoundary><PhotoUploadPage /></RouteErrorBoundary>} />
          <Route path="/checkin-success" element={<RouteErrorBoundary><CheckInSuccessPage /></RouteErrorBoundary>} />
          <Route path="/transformation" element={<RouteErrorBoundary><TransformationPage /></RouteErrorBoundary>} />
          <Route path="/login" element={<RouteErrorBoundary><LoginScreen /></RouteErrorBoundary>} />
          <Route path="/onboarding" element={<RouteErrorBoundary><OnboardingScreen /></RouteErrorBoundary>} />
        </Routes>
      </AnimatePresence>
      <BottomNavigation />
      <GleuhrInsider />
      
      {/* Weekly Photo Popup */}
      <WeeklyPhotoPopup 
        isVisible={showWeeklyPhotoPopup}
        onClose={onCloseWeeklyPhotoPopup}
        patient={patient}
      />
    </>
  );
}

export default App;
