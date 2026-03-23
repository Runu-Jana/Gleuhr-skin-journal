import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';

/* ─────────────────────────────────────────────
   First-streak celebration (streak === 1)
───────────────────────────────────────────── */
function FirstStreakCelebration({ onContinue }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between py-12 px-6"
      style={{ background: '#111318' }}
    >
      <style>{`
        @keyframes flameOuter {
          0%,100% { transform: scaleX(1)    scaleY(1)    rotate(-2deg); }
          25%      { transform: scaleX(.96)  scaleY(1.06) rotate(2deg);  }
          50%      { transform: scaleX(1.03) scaleY(.97)  rotate(-1deg); }
          75%      { transform: scaleX(.97)  scaleY(1.08) rotate(3deg);  }
        }
        @keyframes flameMid {
          0%,100% { transform: scaleX(1)    scaleY(1)    rotate(1deg);  }
          33%      { transform: scaleX(.95)  scaleY(1.1)  rotate(-2deg); }
          66%      { transform: scaleX(1.04) scaleY(.95)  rotate(2deg);  }
        }
        @keyframes flameInner {
          0%,100% { transform: scaleX(1)    scaleY(1);   opacity:.9; }
          40%      { transform: scaleX(.93)  scaleY(1.12);opacity:1;  }
          70%      { transform: scaleX(1.06) scaleY(.93); opacity:.8; }
        }
        @keyframes flameGlow {
          0%,100% { filter: drop-shadow(0 0 28px rgba(255,100,0,.55)); }
          50%      { filter: drop-shadow(0 0 55px rgba(255,150,0,.8));  }
        }
        @keyframes floatUp {
          0%,100% { transform: translateY(0);    }
          50%      { transform: translateY(-10px); }
        }
        @keyframes riseIn {
          from { transform: translateY(40px); opacity:0; }
          to   { transform: translateY(0);    opacity:1; }
        }
        @keyframes popNum {
          0%   { transform: scale(.5);   opacity:0; }
          60%  { transform: scale(1.12); opacity:1; }
          100% { transform: scale(1);    opacity:1; }
        }
        @keyframes sparkle {
          0%,100% { opacity:0; transform: scale(0) translateY(0);    }
          50%      { opacity:1; transform: scale(1) translateY(-24px); }
        }
        .flame-outer  { animation: flameOuter 1.6s ease-in-out infinite, flameGlow 2s ease-in-out infinite; transform-origin: 50% 100%; }
        .flame-mid    { animation: flameMid   1.3s ease-in-out infinite; transform-origin: 50% 100%; }
        .flame-inner  { animation: flameInner 1s   ease-in-out infinite; transform-origin: 50% 100%; }
        .flame-float  { animation: floatUp    3s   ease-in-out infinite; }
        .spark        { position:absolute; width:6px; height:6px; border-radius:50%; animation: sparkle 1.8s ease-in-out infinite; }
      `}</style>

      {/* Speech bubble */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="relative rounded-2xl px-5 py-4 max-w-xs text-center"
        style={{ background: '#1e2029', border: '1px solid rgba(255,255,255,.08)' }}
      >
        <p style={{ color: '#e8e3dc', fontSize: '17px', fontFamily: 'Outfit, sans-serif', lineHeight: 1.5, margin: 0 }}>
          Your first flame is lit.<br />
          <span style={{ color: '#ff8c42', fontWeight: 600 }}>This is how legends begin.</span>
        </p>
        {/* Bubble tail */}
        <div style={{
          position: 'absolute', bottom: '-10px', left: '50%',
          transform: 'translateX(-50%)',
          width: 0, height: 0,
          borderLeft: '10px solid transparent',
          borderRight: '10px solid transparent',
          borderTop: '10px solid #1e2029',
        }} />
      </motion.div>

      {/* Animated flame */}
      <motion.div
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 180, damping: 14, delay: 0.5 }}
        className="flame-float"
        style={{ position: 'relative', width: 140, height: 180 }}
      >
        {/* Sparks */}
        {[
          { left: '10%', top: '5%',  bg: '#ffd700', delay: '0s'   },
          { left: '75%', top: '0%',  bg: '#ff8c00', delay: '0.6s' },
          { left: '45%', top: '-8%', bg: '#ffffff', delay: '1.1s' },
          { left: '20%', top: '-4%', bg: '#ff4500', delay: '1.5s' },
          { left: '65%', top: '8%',  bg: '#ffd700', delay: '0.3s' },
        ].map((s, i) => (
          <div key={i} className="spark" style={{ left: s.left, top: s.top, background: s.bg, animationDelay: s.delay }} />
        ))}

        {/* Outer flame — deep red → orange */}
        <div className="flame-outer" style={{
          position: 'absolute', bottom: 0, left: '50%',
          transform: 'translateX(-50%)',
          width: 100, height: 150,
          background: 'linear-gradient(to top, #c0392b 0%, #e74c3c 30%, #ff6600 65%, #ff8c00 100%)',
          borderRadius: '50% 50% 20% 20% / 55% 55% 45% 45%',
        }} />

        {/* Mid flame — orange → amber */}
        <div className="flame-mid" style={{
          position: 'absolute', bottom: 0, left: '50%',
          transform: 'translateX(-50%)',
          width: 76, height: 120,
          background: 'linear-gradient(to top, #e55a00 0%, #ff8c00 40%, #ffb347 80%, #ffd700 100%)',
          borderRadius: '50% 50% 20% 20% / 55% 55% 45% 45%',
        }} />

        {/* Inner flame — yellow/white core */}
        <div className="flame-inner" style={{
          position: 'absolute', bottom: 0, left: '50%',
          transform: 'translateX(-50%)',
          width: 44, height: 80,
          background: 'linear-gradient(to top, #ff9500 0%, #ffcc00 50%, #fffde7 100%)',
          borderRadius: '50% 50% 20% 20% / 55% 55% 45% 45%',
        }} />
      </motion.div>

      {/* 1 day streak */}
      <div className="flex flex-col items-center gap-2">
        <span style={{
          fontSize: '100px', fontWeight: 800, lineHeight: 1,
          color: '#ff8c00',
          fontFamily: '"Playfair Display", serif',
          animation: 'popNum .7s .9s both',
          textShadow: '0 0 40px rgba(255,140,0,.5)',
          display: 'block',
        }}>
          1
        </span>
        <span style={{
          fontSize: '26px', fontWeight: 700,
          color: '#ff8c00',
          fontFamily: 'Outfit, sans-serif',
          letterSpacing: '0.02em',
          animation: 'riseIn .5s 1.1s both',
          display: 'block',
        }}>
          day streak
        </span>
      </div>

      {/* CTA button */}
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1.4 }}
        onClick={onContinue}
        style={{
          width: '100%', maxWidth: '360px',
          padding: '18px 0',
          borderRadius: '16px',
          border: 'none',
          background: 'linear-gradient(135deg, #ff6b00, #ff8c42)',
          color: '#fff',
          fontSize: '16px', fontWeight: 800,
          fontFamily: 'Outfit, sans-serif',
          letterSpacing: '0.08em',
          cursor: 'pointer',
          boxShadow: '0 4px 24px rgba(255,107,0,.45)',
        }}
      >
        KEEP MY FLAME ALIVE
      </motion.button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Regular success page (streak > 1)
───────────────────────────────────────────── */
export default function CheckInSuccessPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const streak = location.state?.streak || 28;
  const message = location.state?.message || "Your consistency puts you in the top 15% of all Gleuhr users this month.";
  const isFirstStreak = streak === 1;

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/');
    }, isFirstStreak ? 7000 : 3000);
    return () => clearTimeout(timer);
  }, [navigate, isFirstStreak]);

  if (isFirstStreak) {
    return <FirstStreakCelebration onContinue={() => navigate('/')} />;
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <style jsx>{`
        @keyframes popIn {
          0% { transform: scale(0.6); opacity: 0; }
          50% { transform: scale(1.08); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fadeUp {
          from { transform: translateY(12px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes countUp {
          from { transform: translateY(8px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center gap-5"
        style={{ animation: '0.5s cubic-bezier(0.34, 1.56, 0.64, 1) popIn' }}
      >
        {/* Success Icon */}
        <motion.div
          className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center"
          style={{ boxShadow: 'rgba(26, 138, 74, 0.08) 0px 0px 0px 8px' }}
        >
          <svg width="40" height="40" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="9" stroke="#1a8a4a" strokeWidth="1.5"></circle>
            <path d="M6.5 10l2.5 2.5 4.5-5" stroke="#1a8a4a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
          </svg>
        </motion.div>

        {/* Day Counter */}
        <motion.div
          className="flex items-baseline gap-2"
          style={{ animation: '0.5s 0.3s both countUp' }}
        >
          <svg width="28" height="28" viewBox="0 0 20 20" fill="none">
            <path d="M10 18c-3.87 0-6.5-2.42-6.5-5.6 0-2 1.2-4 2.4-5.2.4-.4 1.2-.4 1.2.4 0 1.2.4 2.4 1.6 3.2.4.4.8.4 1.2 0 .4-.4.4-1.2 0-2.4-.4-1.2-.4-2.8.8-4.4.8-1.2 1.6-2 2.4-2.8.4-.4 1.2-.4 1.2.4 0 1.6.8 2.8 2 4 .8.8 1.6 2 1.6 3.6 0 3.2-2.42 5.6-6.5 5.6z" fill="#dc2626"></path>
          </svg>
          <span style={{ fontSize: '36px', fontWeight: '700', color: 'rgb(25, 23, 22)', fontFamily: '"Playfair Display", serif' }}>
            Day {streak}
          </span>
        </motion.div>

        {/* Success Message */}
        <motion.p
          className="text-center max-w-xs"
          style={{
            fontSize: '14px', color: 'rgb(122, 117, 109)',
            fontFamily: 'Outfit, sans-serif', lineHeight: '1.6',
            margin: '0px', animation: '0.5s 0.5s both fadeUp',
          }}
        >
          {message}
        </motion.p>

        {/* Redirect indicator */}
        <motion.div
          className="text-gray-400 text-xs"
          style={{ animation: '0.5s 0.7s both fadeUp' }}
        >
          Redirecting to home...
        </motion.div>
      </motion.div>
    </div>
  );
}
