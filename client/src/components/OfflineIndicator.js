import React from 'react';
import { motion } from 'framer-motion';
import { WifiOff } from 'lucide-react';
import { useOffline } from '../contexts/OfflineContext';

export default function OfflineIndicator() {
  const { isOnline } = useOffline();

  // Only show when actually offline - hide yellow pending banner
  if (isOnline) {
    return null;
  }

  return (
    <motion.div
      initial={{ y: -50 }}
      animate={{ y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 px-4 py-2 bg-red-500"
    >
      <div className="flex items-center justify-center max-w-md mx-auto">
        <div className="flex items-center gap-2 text-white">
          <WifiOff className="w-4 h-4" />
          <span className="text-sm font-medium">Offline</span>
        </div>
      </div>
    </motion.div>
  );
}
