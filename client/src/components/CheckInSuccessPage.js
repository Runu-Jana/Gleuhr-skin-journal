import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';

export default function CheckInSuccessPage() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get streak and message from navigation state or use defaults
  const streak = location.state?.streak || 28;
  const message = location.state?.message || "Your consistency puts you in the top 15% of all Gleuhr users this month.";

  useEffect(() => {
    // Redirect to home after 3 seconds
    const timer = setTimeout(() => {
      navigate('/');
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

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
        style={{
          animation: '0.5s cubic-bezier(0.34, 1.56, 0.64, 1) popIn',
        }}
      >
        {/* Success Icon */}
        <motion.div
          className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center"
          style={{
            boxShadow: 'rgba(26, 138, 74, 0.08) 0px 0px 0px 8px',
          }}
        >
          <svg width="40" height="40" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="9" stroke="#1a8a4a" strokeWidth="1.5"></circle>
            <path d="M6.5 10l2.5 2.5 4.5-5" stroke="#1a8a4a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
          </svg>
        </motion.div>

        {/* Day Counter */}
        <motion.div
          className="flex items-baseline gap-2"
          style={{
            animation: '0.5s 0.3s both countUp',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 20 20" fill="none">
            <path d="M10 18c-3.87 0-6.5-2.42-6.5-5.6 0-2 1.2-4 2.4-5.2.4-.4 1.2-.4 1.2.4 0 1.2.4 2.4 1.6 3.2.4.4.8.4 1.2 0 .4-.4.4-1.2 0-2.4-.4-1.2-.4-2.8.8-4.4.8-1.2 1.6-2 2.4-2.8.4-.4 1.2-.4 1.2.4 0 1.6.8 2.8 2 4 .8.8 1.6 2 1.6 3.6 0 3.2-2.42 5.6-6.5 5.6z" fill="#dc2626"></path>
          </svg>
          <span 
            style={{ 
              fontSize: '36px', 
              fontWeight: '700', 
              color: 'rgb(25, 23, 22)', 
              fontFamily: '"Playfair Display", serif' 
            }}
          >
            Day {streak}
          </span>
        </motion.div>

        {/* Success Message */}
        <motion.p
          className="text-center max-w-xs"
          style={{
            fontSize: '14px',
            color: 'rgb(122, 117, 109)',
            fontFamily: 'Outfit, sans-serif',
            lineHeight: '1.6',
            margin: '0px',
            animation: '0.5s 0.5s both fadeUp',
          }}
        >
          {message}
        </motion.p>

        {/* Redirect indicator */}
        <motion.div
          className="text-gray-400 text-xs"
          style={{
            animation: '0.5s 0.7s both fadeUp',
          }}
        >
          Redirecting to home...
        </motion.div>
      </motion.div>
    </div>
  );
}
