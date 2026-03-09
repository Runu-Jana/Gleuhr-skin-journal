import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { savePatient } from '../utils/db';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [patient, setPatient] = useState(null);
  const [streak, setStreak] = useState({ streak: 0, shields: 0 });
  const [skinScores, setSkinScores] = useState([]);
  const [weeklyPhotos, setWeeklyPhotos] = useState([]);
  const [sessionExpiry, setSessionExpiry] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check for stored auth token on app load
    const storedToken = localStorage.getItem('gleuhrAuthToken');
    if (storedToken) {
      // Auto-login with stored token
      verifyStoredToken(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const verifyStoredToken = async (authToken) => {
    try {
      const deviceFingerprint = generateDeviceFingerprint();
      const response = await axios.post('/api/auth/verify-token', { 
        authToken, 
        deviceFingerprint 
      });
      
      if (response.data.success) {
        setPatient(response.data.patient);
        setIsAuthenticated(true);
        // Save patient to IndexedDB for offline use
        await savePatient(response.data.patient);
        loadPatientData(response.data.patient.phone);
      } else {
        // Token invalid, remove it
        localStorage.removeItem('gleuhrAuthToken');
      }
    } catch (error) {
      console.error('Token verification error:', error);
      // If server error (500), don't remove token - might be temporary server issue
      if (error.response?.status === 500) {
        console.warn('Server error during token verification, keeping token for retry');
        // Don't remove token on server error, user can try again
      } else {
        // For other errors (401, 403, etc.), remove token
        localStorage.removeItem('gleuhrAuthToken');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithWhatsApp = async (phone, verificationCode) => {
    try {
      const deviceFingerprint = generateDeviceFingerprint();
      const response = await axios.post('/api/auth/register', { 
        phoneNumber: phone, 
        verificationCode,
        deviceFingerprint 
      });
      
      if (response.data.success) {
        const { authToken, patient } = response.data;
        
        // Store auth token for persistent login
        localStorage.setItem('gleuhrAuthToken', authToken);
        
        setPatient(patient);
        setIsAuthenticated(true);
        
        // Save patient to IndexedDB for offline use
        await savePatient(patient);
        
        // Load additional data
        await loadPatientData(patient.phone);
        
        return { success: true, hasCommitted: patient.hasCommitted };
      } else {
        return { success: false, error: 'Registration failed' };
      }
    } catch (error) {
      console.error('WhatsApp login error:', error);
      return { success: false, error: error.response?.data?.error || 'Login failed' };
    }
  };

  const loadPatientData = async (phone) => {
    try {
      // Load streak using phone
      const streakRes = await axios.get(`/api/streak/${phone}`);
      setStreak(streakRes.data);

      // Load skin scores using phone
      try {
        const scoresRes = await axios.get(`/api/skinscore/${phone}`);
        setSkinScores(scoresRes.data);
      } catch (skinScoreError) {
        console.error('Skin score API not available:', skinScoreError);
        setSkinScores([]); // Set empty array as fallback
      }

      // Load weekly photos using phone
      const photosRes = await axios.get(`/api/photo/${phone}`);
      setWeeklyPhotos(photosRes.data);
    } catch (error) {
      console.error('Error loading patient data:', error);
    }
  };

  const refreshStreak = async () => {
    if (patient?.phone) {
      const streakRes = await axios.get(`/api/streak/${patient.phone}`);
      setStreak(streakRes.data);
    }
  };

  const refreshSkinScores = async () => {
    if (patient?.phone) {
      try {
        const scoresRes = await axios.get(`/api/skinscore/${patient.phone}`);
        setSkinScores(scoresRes.data);
      } catch (error) {
        console.error('Error refreshing skin scores:', error);
      }
    }
  };

  const commitToProgram = async () => {
    try {
      await axios.post('/api/self-register/commitment', { phoneNumber: patient.phone, hasCommitted: true });
      const updated = { ...patient, hasCommitted: true };
      setPatient(updated);
      localStorage.setItem('gleuhrPatient', JSON.stringify(updated));
    } catch (error) {
      console.error('Commit error:', error);
    }
  };

  const logout = () => {
    setPatient(null);
    setIsAuthenticated(false);
    setStreak({ streak: 0, shields: 0 });
    setSkinScores([]);
    setWeeklyPhotos([]);
    localStorage.removeItem('gleuhrAuthToken');
  };

  const generateDeviceFingerprint = () => {
    const screenRef = window.screen; // eslint-disable-line no-restricted-globals
    return btoa(navigator.userAgent + screenRef.width + screenRef.height + new Date().getTimezoneOffset());
  };

  const loginWithToken = async (authToken, patientData) => {
    localStorage.setItem('gleuhrAuthToken', authToken);
    setPatient(patientData);
    setIsAuthenticated(true);
    if (patientData.phone) {
      await loadPatientData(patientData.phone);
    }
    return { success: true, hasCommitted: patientData.hasCommitted };
  };

  const value = {
    patient,
    streak,
    skinScores,
    isLoading,
    isAuthenticated,
    loginWithWhatsApp,
    loginWithToken,
    logout,
    commitToProgram,
    refreshStreak,
    refreshSkinScores,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
