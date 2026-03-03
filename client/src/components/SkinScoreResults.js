import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getSkinScores, getPatient } from '../utils/db';

export default function SkinScoreResults() {
  const { patient } = useAuth();
  const navigate = useNavigate();
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadScores();
  }, []);

  const loadScores = async () => {
    try {
      // Get patient record to get patientId
      const patientRecord = await getPatient(patient?.phone);
      if (!patientRecord) {
        console.error('Patient not found for skin scores');
        setScores([]);
        return;
      }
      
      const allScores = await getSkinScores(patientRecord.id);
      setScores(allScores || []);
      
      // Trigger HomeScreen refresh by emitting a custom event
      window.dispatchEvent(new CustomEvent('skinScoreUpdated', {
        detail: { scores: allScores, latestScore: allScores[0] }
      }));
      
    } catch (error) {
      console.error('Error loading scores:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProgressPercentage = (score) => {
    return (score / 20) * 100;
  };

  const getProgressColor = (percentage) => {
    if (percentage >= 80) return '#16a34a'; // green-600
    if (percentage >= 60) return '#2563eb'; // blue-600  
    if (percentage >= 40) return '#d97706'; // amber-600
    return '#dc2626'; // red-600
  };

  const getCircleDashArray = (score) => {
    const percentage = getProgressPercentage(score);
    const circumference = 2 * Math.PI * 68; // radius = 68
    const dashArray = (percentage / 100) * circumference;
    return `${dashArray} ${circumference}`;
  };

  const renderScoreDots = (score) => {
    const dots = [];
    for (let i = 1; i <= 5; i++) {
      dots.push(
        <div
          key={i}
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '4px',
            background: i <= score ? '#d97706' : '#e0ddd7'
          }}
        />
      );
    }
    return dots;
  };

  const getBaselineScore = () => {
    if (scores.length === 0) return 8; // Default baseline
    const sortedScores = [...scores].sort((a, b) => a.day - b.day);
    return sortedScores[0]?.totalScore || 8;
  };

  const getImprovement = () => {
    if (scores.length === 0) return 0;
    const latestScore = scores[0]?.totalScore || 0;
    const baseline = getBaselineScore();
    return latestScore - baseline;
  };

  if (loading) {
    return (
      <div className="h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#c44033] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const latestScore = scores[0];

  return (
    <div className="h-screen bg-white flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-7 py-8 text-center">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-7"
        >
          <p className="text-xs text-[#c44033] font-bold uppercase tracking-wider mb-2 font-['Outfit']">
            Day {latestScore?.day || 1} Assessment
          </p>
          <h2 className="text-xl font-bold text-[#191716] font-['Playfair_Display'] mb-0">
            Your Progress Check
          </h2>
        </motion.div>

        {latestScore ? (
          <>
            {/* Circular Progress */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, type: "spring", stiffness: 100 }}
              className="relative w-40 h-40 mb-7"
            >
              <svg width="160" height="160" viewBox="0 0 160 160">
                <circle
                  cx="80"
                  cy="80"
                  r="68"
                  fill="none"
                  stroke="#f4f2ef"
                  strokeWidth="6"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="68"
                  fill="none"
                  stroke={getProgressColor(getProgressPercentage(latestScore.totalScore))}
                  strokeWidth="6"
                  strokeDasharray={getCircleDashArray(latestScore.totalScore)}
                  strokeLinecap="round"
                  transform="rotate(-90 80 80)"
                  style={{
                    transition: 'stroke-dasharray 0.6s ease-in-out'
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-bold text-[#191716] font-['Playfair_Display'] leading-none">
                  {latestScore.totalScore}
                </span>
                <span className="text-xs text-[#a39e95] font-['Outfit']">
                  out of 20
                </span>
              </div>
            </motion.div>

            {/* Individual Scores */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="w-full flex flex-col gap-2 mb-7"
            >
              <div className="flex justify-between items-center p-2.5 bg-[#faf9f7] rounded-xl">
                <span className="text-xs text-[#5c574f] font-['Outfit'] flex-1 text-left">
                  Pigmentation
                </span>
                <div className="flex gap-1">
                  {renderScoreDots(latestScore.pigmentation || 0)}
                </div>
                <span className="text-sm font-bold text-[#191716] font-['Playfair_Display'] ml-2.5 w-5 text-right">
                  {latestScore.pigmentation || 0}
                </span>
              </div>

              <div className="flex justify-between items-center p-2.5 bg-[#faf9f7] rounded-xl">
                <span className="text-xs text-[#5c574f] font-['Outfit'] flex-1 text-left">
                  Tone evenness
                </span>
                <div className="flex gap-1">
                  {renderScoreDots(latestScore.toneEvenness || 0)}
                </div>
                <span className="text-sm font-bold text-[#191716] font-['Playfair_Display'] ml-2.5 w-5 text-right">
                  {latestScore.toneEvenness || 0}
                </span>
              </div>

              <div className="flex justify-between items-center p-2.5 bg-[#faf9f7] rounded-xl">
                <span className="text-xs text-[#5c574f] font-['Outfit'] flex-1 text-left">
                  Texture
                </span>
                <div className="flex gap-1">
                  {renderScoreDots(latestScore.texture || 0)}
                </div>
                <span className="text-sm font-bold text-[#191716] font-['Playfair_Display'] ml-2.5 w-5 text-right">
                  {latestScore.texture || 0}
                </span>
              </div>

              <div className="flex justify-between items-center p-2.5 bg-[#faf9f7] rounded-xl">
                <span className="text-xs text-[#5c574f] font-['Outfit'] flex-1 text-left">
                  Confidence
                </span>
                <div className="flex gap-1">
                  {renderScoreDots(latestScore.confidence || 0)}
                </div>
                <span className="text-sm font-bold text-[#191716] font-['Playfair_Display'] ml-2.5 w-5 text-right">
                  {latestScore.confidence || 0}
                </span>
              </div>
            </motion.div>

            {/* Progress Comparison */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="w-full p-4 bg-[rgba(196, 64, 51, 0.03)] rounded-2xl border border-[rgba(196, 64, 51, 0.06)] mb-6"
            >
              <div className="flex justify-between items-center">
                <div className="text-left">
                  <p className="text-xs font-bold text-[#c44033] font-['Outfit'] mb-0 uppercase tracking-wider">
                    Since Day 1
                  </p>
                  <p className="text-sm text-[#5c574f] font-['Outfit'] mt-1 mb-0">
                    Baseline: {getBaselineScore()}/20
                  </p>
                </div>
                <div className="text-right">
                  <span 
                    className="text-2xl font-bold font-['Playfair_Display']"
                    style={{
                      color: getImprovement() >= 0 ? '#16a34a' : '#dc2626'
                    }}
                  >
                    {getImprovement() >= 0 ? '+' : ''}{getImprovement()}
                  </span>
                  <p 
                    className="text-xs font-['Outfit'] mb-0 font-semibold"
                    style={{
                      color: getImprovement() >= 0 ? '#16a34a' : '#dc2626'
                    }}
                  >
                    {getImprovement() >= 0 ? 'Improving ↑' : 'Declining ↓'}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Continue Button */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              onClick={() => navigate('/')}
              className="w-full py-[18px] rounded-2xl bg-[#c44033] text-white border-none font-semibold text-base font-['Outfit'] cursor-pointer shadow-lg"
              style={{
                boxShadow: 'rgba(196, 64, 51, 0.208) 0px 6px 20px'
              }}
            >
              Continue →
            </motion.button>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#faf9f7] flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
            <h3 className="text-lg font-bold text-[#191716] font-['Playfair_Display'] mb-2">
              No Scores Yet
            </h3>
            <p className="text-sm text-[#5c574f] font-['Outfit'] mb-4">
              Complete your first skin score assessment to see your results here.
            </p>
            <button
              onClick={() => navigate('/skin-score')}
              className="px-6 py-2 bg-[#c44033] text-white rounded-xl font-semibold text-sm font-['Outfit'] hover:bg-[#b33a2e] transition-colors"
            >
              Take Assessment
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
