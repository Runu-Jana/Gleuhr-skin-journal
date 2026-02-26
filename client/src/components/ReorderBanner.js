import React, { useState } from 'react';
import { useOffline } from '../contexts/OfflineContext';
import { ShoppingBag, X, ArrowRight } from 'lucide-react';

export default function ReorderBanner({ coachName, coachWhatsApp, day }) {
  const [isDismissed, setIsDismissed] = useState(false);
  const { trackReorderClick } = useOffline();

  if (isDismissed) return null;

  const handleReorder = () => {
    trackReorderClick(day);
    const message = encodeURIComponent(`Hi ${coachName}, I'd like to reorder my skincare products. Can you help me with this?`);
    window.open(`https://wa.me/${coachWhatsApp}?text=${message}`, '_blank');
  };

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40">
      <div className="bg-gradient-to-r from-[#c44033] to-[#e85a4a] rounded-2xl p-4 shadow-2xl shadow-[#c44033]/30">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <ShoppingBag className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-white mb-1">Running Low on Products?</h4>
            <p className="text-white/90 text-sm mb-3">Your products are running low! Reorder now to continue your transformation without interruption.</p>
            <button onClick={handleReorder} className="w-full bg-white text-[#c44033] font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-white/90 transition-colors">
              Reorder Now
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <button onClick={() => setIsDismissed(true)} className="p-1 text-white/70 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
