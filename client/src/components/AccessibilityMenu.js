import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Eye, 
  EyeOff, 
  Type, 
  Zap, 
  Monitor, 
  Volume2, 
  ChevronDown,
  ChevronUp,
  Sun,
  Moon
} from 'lucide-react';
import { useAccessibility } from '../contexts/AccessibilityContext';

export default function AccessibilityMenu() {
  const {
    highContrast,
    largeText,
    reducedMotion,
    keyboardNav,
    toggleHighContrast,
    toggleLargeText,
    toggleReducedMotion
  } = useAccessibility();

  const [isOpen, setIsOpen] = useState(false);

  const accessibilityOptions = [
    {
      id: 'highContrast',
      label: 'High Contrast',
      description: 'Increase contrast for better visibility',
      icon: highContrast ? Sun : Moon,
      isActive: highContrast,
      toggle: toggleHighContrast,
      shortcut: 'Alt + H'
    },
    {
      id: 'largeText',
      label: 'Large Text',
      description: 'Increase text size for better readability',
      icon: Type,
      isActive: largeText,
      toggle: toggleLargeText,
      shortcut: 'Alt + T'
    },
    {
      id: 'reducedMotion',
      label: 'Reduced Motion',
      description: 'Minimize animations and transitions',
      icon: Zap,
      isActive: reducedMotion,
      toggle: toggleReducedMotion,
      shortcut: 'Alt + R'
    }
  ];

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="relative">
        {/* Toggle Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-white rounded-full shadow-lg border border-gray-200 p-3 hover:bg-gray-50 transition-colors"
          aria-label="Accessibility options"
          aria-expanded={isOpen}
        >
          {isOpen ? <ChevronUp className="w-5 h-5 text-gray-700" /> : <ChevronDown className="w-5 h-5 text-gray-700" />}
        </button>

        {/* Accessibility Menu */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute top-full right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden"
            >
              <div className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Monitor className="w-5 h-5 text-gray-700" />
                  <h3 className="font-semibold text-gray-900">Accessibility</h3>
                </div>

                <div className="space-y-3">
                  {accessibilityOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                      <div key={option.id} className="flex items-start gap-3">
                        <button
                          onClick={option.toggle}
                          className={`flex items-center gap-3 flex-1 p-3 rounded-lg border transition-colors ${
                            option.isActive
                              ? 'bg-blue-50 border-blue-200 text-blue-700'
                              : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                          }`}
                          aria-pressed={option.isActive}
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <Icon className="w-5 h-5" />
                            <div className="text-left">
                              <div className="font-medium">{option.label}</div>
                              <div className="text-sm opacity-75">{option.description}</div>
                              <div className="text-xs opacity-60 mt-1">{option.shortcut}</div>
                            </div>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            option.isActive
                              ? 'bg-blue-500 border-blue-500'
                              : 'border-gray-300'
                          }`}>
                            {option.isActive && (
                              <div className="w-2 h-2 bg-white rounded-full" />
                            )}
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Keyboard Navigation Indicator */}
                {keyboardNav && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-green-700">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-sm font-medium">Keyboard Navigation Active</span>
                    </div>
                    <p className="text-xs text-green-600 mt-1">
                      Use Tab to navigate, Enter to select, Escape to close
                    </p>
                  </div>
                )}

                {/* Additional Help */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-2">Additional Help</h4>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <span className="font-mono bg-gray-100 px-2 py-1 rounded">Tab</span>
                      <span>Navigate between elements</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono bg-gray-100 px-2 py-1 rounded">Enter</span>
                      <span>Activate buttons and links</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono bg-gray-100 px-2 py-1 rounded">Escape</span>
                      <span>Close modals and menus</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono bg-gray-100 px-2 py-1 rounded">Alt + S</span>
                      <span>Skip to main content</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
