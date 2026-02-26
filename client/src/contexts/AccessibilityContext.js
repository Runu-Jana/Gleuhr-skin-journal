import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AccessibilityContext = createContext();

export function AccessibilityProvider({ children }) {
  const [highContrast, setHighContrast] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [keyboardNav, setKeyboardNav] = useState(false);
  const [screenReader, setScreenReader] = useState(false);

  // Detect user preferences from system
  useEffect(() => {
    // Check for reduced motion preference
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(motionQuery.matches);
    
    const handleMotionChange = (e) => setReducedMotion(e.matches);
    motionQuery.addListener(handleMotionChange);

    // Check for high contrast preference
    const contrastQuery = window.matchMedia('(prefers-contrast: high)');
    setHighContrast(contrastQuery.matches);
    
    const handleContrastChange = (e) => setHighContrast(e.matches);
    contrastQuery.addListener(handleContrastChange);

    // Check for screen reader
    const screenReaderQuery = window.matchMedia('(prefers-reduced-data: reduce)');
    setScreenReader(screenReaderQuery.matches);

    return () => {
      motionQuery.removeListener(handleMotionChange);
      contrastQuery.removeListener(handleContrastChange);
    };
  }, []);

  // Detect keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Tab') {
        setKeyboardNav(true);
      }
    };

    const handleMouseDown = () => {
      setKeyboardNav(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  // Apply accessibility classes to body
  useEffect(() => {
    const body = document.body;
    
    // Remove all accessibility classes first
    body.classList.remove('high-contrast', 'large-text', 'reduced-motion');
    
    // Apply current settings
    if (highContrast) body.classList.add('high-contrast');
    if (largeText) body.classList.add('large-text');
    if (reducedMotion) body.classList.add('reduced-motion');
  }, [highContrast, largeText, reducedMotion]);

  // Toggle functions
  const toggleHighContrast = useCallback(() => {
    setHighContrast(prev => !prev);
  }, []);

  const toggleLargeText = useCallback(() => {
    setLargeText(prev => !prev);
  }, []);

  const toggleReducedMotion = useCallback(() => {
    setReducedMotion(prev => !prev);
  }, []);

  // Announce to screen readers
  const announceToScreenReader = useCallback((message, priority = 'polite') => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }, []);

  // Focus management
  const trapFocus = useCallback((element) => {
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            lastFocusable.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            firstFocusable.focus();
            e.preventDefault();
          }
        }
      }
    };

    element.addEventListener('keydown', handleTabKey);
    firstFocusable.focus();

    return () => {
      element.removeEventListener('keydown', handleTabKey);
    };
  }, []);

  // Skip to main content
  const skipToMain = useCallback(() => {
    const main = document.getElementById('main-content');
    if (main) {
      main.focus();
      main.scrollIntoView();
    }
  }, []);

  // Save preferences to localStorage
  useEffect(() => {
    const preferences = {
      highContrast,
      largeText,
      reducedMotion
    };
    localStorage.setItem('gleuhrAccessibility', JSON.stringify(preferences));
  }, [highContrast, largeText, reducedMotion]);

  // Load preferences from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('gleuhrAccessibility');
    if (stored) {
      try {
        const preferences = JSON.parse(stored);
        setHighContrast(preferences.highContrast || false);
        setLargeText(preferences.largeText || false);
        setReducedMotion(preferences.reducedMotion || false);
      } catch (error) {
        console.error('Error loading accessibility preferences:', error);
      }
    }
  }, []);

  const value = {
    highContrast,
    largeText,
    reducedMotion,
    keyboardNav,
    screenReader,
    toggleHighContrast,
    toggleLargeText,
    toggleReducedMotion,
    announceToScreenReader,
    trapFocus,
    skipToMain
  };

  return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>;
}

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) throw new Error('useAccessibility must be used within AccessibilityProvider');
  return context;
};
