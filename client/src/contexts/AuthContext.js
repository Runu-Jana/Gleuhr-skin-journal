import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

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
        loadPatientData(response.data.patient.phone);
      } else {
        // Token invalid, remove it
        localStorage.removeItem('gleuhrAuthToken');
      }
    } catch (error) {
      console.error('Token verification error:', error);
      localStorage.removeItem('gleuhrAuthToken');
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
      const scoresRes = await axios.get(`/api/skinscore/${phone}`);
      setSkinScores(scoresRes.data);

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
    return btoa(navigator.userAgent + window.screen.width + window.screen.height + new Date().getTimezoneOffset());
  };

  const value = {
    patient,
    streak,
    skinScores,
    isLoading,
    isAuthenticated,
    loginWithWhatsApp,
    logout,
    commitToProgram,
    refreshStreak,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
