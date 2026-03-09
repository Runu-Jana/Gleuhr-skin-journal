
import React, { useState, useEffect, useRef } from 'react';

export default function AccessibilityMenu() {
  const [showMenu, setShowMenu] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [fadeTimer, setFadeTimer] = useState(null);
  const dragRef = useRef(null);
  const startPos = useRef({ x: 0, y: 0 });
  const inactivityTimer = useRef(null);

  useEffect(() => {
    // Load saved preferences
    const savedContrast = localStorage.getItem('highContrast') === 'true';
    const savedText = localStorage.getItem('largeText') === 'true';
    const savedPosition = localStorage.getItem('accessibilityButtonPosition');
    
    setHighContrast(savedContrast);
    setLargeText(savedText);
    
    // Load saved position
    if (savedPosition) {
      try {
        const pos = JSON.parse(savedPosition);
        setPosition(pos);
      } catch (e) {
        console.error('Error parsing saved position:', e);
      }
    }
    
    // Apply saved preferences
    if (savedContrast) {
      document.body.classList.add('high-contrast');
    }
    if (savedText) {
      document.body.classList.add('large-text');
    }

    // Start fade timer
    startFadeTimer();
    
    return () => {
      clearFadeTimer();
    };
  }, []);

  const startFadeTimer = () => {
    clearFadeTimer();
    inactivityTimer.current = setTimeout(() => {
      setIsVisible(false);
    }, 5000); // Fade after 5 seconds
  };

  const clearFadeTimer = () => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
  };

  const showButton = () => {
    setIsVisible(true);
    startFadeTimer();
  };

  const toggleHighContrast = () => {
    const newValue = !highContrast;
    setHighContrast(newValue);
    
    if (newValue) {
      document.body.classList.add('high-contrast');
    } else {
      document.body.classList.remove('high-contrast');
    }
    
    localStorage.setItem('highContrast', newValue.toString());
    showButton(); // Reset fade timer on interaction
  };

  const toggleLargeText = () => {
    const newValue = !largeText;
    setLargeText(newValue);
    
    if (newValue) {
      document.body.classList.add('large-text');
    } else {
      document.body.classList.remove('large-text');
    }
    
    localStorage.setItem('largeText', newValue.toString());
    showButton(); // Reset fade timer on interaction
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(true);
    setIsVisible(true);
    clearFadeTimer();
    
    const rect = dragRef.current.getBoundingClientRect();
    startPos.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    const newX = e.clientX - startPos.current.x;
    const newY = e.clientY - startPos.current.y;
    
    // Keep button within viewport bounds
    const maxX = window.innerWidth - 48;
    const maxY = window.innerHeight - 48;
    
    const boundedX = Math.max(0, Math.min(newX, maxX));
    const boundedY = Math.max(0, Math.min(newY, maxY));
    
    setPosition({ x: boundedX, y: boundedY });
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      // Save position to localStorage
      localStorage.setItem('accessibilityButtonPosition', JSON.stringify(position));
      startFadeTimer(); // Restart fade timer after drag
    }
  };

  const handleTouchStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const touch = e.touches[0];
    setIsDragging(true);
    setIsVisible(true);
    clearFadeTimer();
    
    const rect = dragRef.current.getBoundingClientRect();
    startPos.current = {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    };
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    
    const touch = e.touches[0];
    const newX = touch.clientX - startPos.current.x;
    const newY = touch.clientY - startPos.current.y;
    
    const maxX = window.innerWidth - 48;
    const maxY = window.innerHeight - 48;
    
    const boundedX = Math.max(0, Math.min(newX, maxX));
    const boundedY = Math.max(0, Math.min(newY, maxY));
    
    setPosition({ x: boundedX, y: boundedY });
  };

  const handleTouchEnd = () => {
    if (isDragging) {
      setIsDragging(false);
      localStorage.setItem('accessibilityButtonPosition', JSON.stringify(position));
      startFadeTimer();
    }
  };

  const handleClick = (e) => {
    if (!isDragging) {
      e.preventDefault();
      e.stopPropagation();
      setShowMenu(!showMenu);
      showButton();
    }
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleTouchEnd);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging, position]);

  return (
    <>
      {/* Accessibility Button */}
      <div
        ref={dragRef}
        className={`fixed z-50 p-2 bg-white rounded-full shadow-lg border-2 border-gray-200 transition-all duration-300 ${
          isDragging ? 'cursor-grabbing scale-110 shadow-2xl' : 'cursor-grab hover:scale-105'
        } ${!isVisible ? 'opacity-30 hover:opacity-100' : 'opacity-100'}`}
        style={{
          left: `${position.x + 16}px`,
          top: `${position.y + 16}px`,
          transform: isDragging ? 'scale(1.1)' : 'scale(1)',
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onClick={handleClick}
        onMouseEnter={showButton}
        aria-label="Accessibility options"
      >
        <svg 
          width="20" 
          height="20" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
        </svg>
      </div>

      {/* Accessibility Menu */}
      {showMenu && (
        <div 
          className="fixed z-50 w-64 bg-white rounded-lg shadow-xl border border-gray-200 p-4"
          style={{
            left: `${position.x + 16}px`,
            top: `${position.y + 80}px`
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Accessibility Options</h3>
            <button
              onClick={() => {
                setShowMenu(false);
                showButton();
              }}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close menu"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          
          <div className="space-y-3">
            {/* High Contrast Toggle */}
            <div className="flex items-center justify-between">
              <label htmlFor="high-contrast" className="text-sm text-gray-700">
                High Contrast
              </label>
              <button
                id="high-contrast"
                onClick={toggleHighContrast}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  highContrast ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    highContrast ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Large Text Toggle */}
            <div className="flex items-center justify-between">
              <label htmlFor="large-text" className="text-sm text-gray-700">
                Large Text
              </label>
              <button
                id="large-text"
                onClick={toggleLargeText}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  largeText ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    largeText ? 'translate-x-6' : 'translate-x-1'
                  }}`}
                />
              </button>
            </div>
          </div>

          {/* Reset Position Button */}
          <div className="mt-4 pt-3 border-t border-gray-200">
            <button
              onClick={() => {
                setPosition({ x: 0, y: 0 });
                localStorage.setItem('accessibilityButtonPosition', JSON.stringify({ x: 0, y: 0 }));
                showButton();
              }}
              className="w-full px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Reset Button Position
            </button>
          </div>
        </div>
      )}

      {/* Overlay */}
      {showMenu && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-25"
          onClick={() => {
            setShowMenu(false);
            showButton();
          }}
        />
      )}
    </>
  );
}
