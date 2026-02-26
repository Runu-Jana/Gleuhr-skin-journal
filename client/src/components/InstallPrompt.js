import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Sparkles } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const visitCount = parseInt(localStorage.getItem('gleuhrVisits') || '0');
    localStorage.setItem('gleuhrVisits', (visitCount + 1).toString());

    if (visitCount === 2) {
      const handleBeforeInstallPrompt = (e) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setShowPrompt(true);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }
  }, []);

  useEffect(() => {
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => window.removeEventListener('appinstalled', handleAppInstalled);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted install');
    }
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('gleuhrInstallDismissed', Date.now().toString());
  };

  if (isInstalled) return null;
  const dismissedAt = localStorage.getItem('gleuhrInstallDismissed');
  if (dismissedAt && Date.now() - parseInt(dismissedAt) < 7 * 24 * 60 * 60 * 1000) return null;

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="fixed bottom-24 left-4 right-4 z-40">
          <div className="bg-white rounded-2xl p-4 shadow-2xl border border-gray-100">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#c44033]/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-6 h-6 text-[#c44033]" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">Install Gleuhr App</h3>
                <p className="text-sm text-gray-600 mb-3">Add to your home screen for quick access to your skin journey, even offline!</p>
                <div className="flex gap-2">
                  <button onClick={handleInstall} className="flex-1 bg-[#c44033] text-white font-medium py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-[#a03328] transition-colors">
                    <Download className="w-4 h-4" /> Install
                  </button>
                  <button onClick={handleDismiss} className="px-4 py-2.5 text-gray-500 hover:text-gray-700 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
