import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

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
import WeeklyPhotoScreen from './components/WeeklyPhotoScreen';
import BottomNav from './components/BottomNav';
import EnhancedOfflineIndicator from './components/EnhancedOfflineIndicator';
import InstallPrompt from './components/InstallPrompt';
import GleuhrInsider from './components/GleuhrInsider';
import AccessibilityMenu from './components/AccessibilityMenu';
import AchievementPopup from './components/AchievementPopup';

// Utils
import { initDB } from './utils/db';

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
            element={isAuthenticated ? <Navigate to="/" replace /> : <SelfRegisterScreen />} 
          />
          <Route 
            path="/login" 
            element={isAuthenticated ? <Navigate to="/" replace /> : <LoginScreen />} 
          />
          <Route 
            path="/onboarding" 
            element={!isAuthenticated ? <Navigate to="/login" replace /> : patient?.hasCommitted ? <Navigate to="/" replace /> : <OnboardingScreen />} 
          />
          <Route 
            path="/skin-score" 
            element={!isAuthenticated ? <Navigate to="/login" replace /> : <SkinScoreScreen />} 
          />
          <Route 
            path="/weekly-photo" 
            element={!isAuthenticated ? <Navigate to="/login" replace /> : <WeeklyPhotoScreen />} 
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
  const [activeTab, setActiveTab] = useState('home');

  return (
    <>
      <AnimatePresence mode="wait">
        {activeTab === 'home' && (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <HomeScreen />
          </motion.div>
        )}

        {activeTab === 'journey' && (
          <motion.div
            key="journey"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <JourneyScreen />
          </motion.div>
        )}

        {activeTab === 'profile' && (
          <motion.div
            key="profile"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <ProfileScreen />
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      <GleuhrInsider />
    </>
  );
}

export default App;
