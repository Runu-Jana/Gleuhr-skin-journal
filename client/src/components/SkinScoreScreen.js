import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOffline } from '../contexts/OfflineContext';
import { saveSkinScore } from '../utils/db';
import { Camera, ChevronLeft, TrendingUp } from 'lucide-react';
import { calculateDay, generateId } from '../utils/helpers';
import { ChevronLeft, Camera, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

const QUESTIONS = [
  { 
    key: 'darkest_patch', 
    question: 'Look at the darkest patch on your face. Compared to when you started, it is...',
    options: ['Much darker', 'Slightly darker', 'Same', 'Somewhat lighter', 'Much lighter']
  },
  { 
    key: 'skin_tone', 
    question: 'How even does your overall skin tone look?',
    options: ['Very uneven', 'Quite uneven', 'Somewhat', 'Mostly even', 'Very even']
  },
  { 
    key: 'texture', 
    question: 'How does your skin texture feel?',
    options: ['Very rough', 'Rough places', 'Average', 'Mostly smooth', 'Smooth healthy']
  },
  { 
    key: 'confidence', 
    question: 'How confident do you feel about your skin right now?',
    options: ['Very self-conscious', 'Somewhat', 'Neutral', 'Fairly confident', 'Very confident']
  },
];

export default function SkinScoreScreen() {
  const { patient, refreshSkinScores } = useAuth();
  const { isOnline, queueForSync } = useOffline();
  const navigate = useNavigate();
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const day = calculateDay(patient?.startDate);

  const handleAnswer = (questionKey, value) => {
    console.log('Answer selected:', value, 'for question:', questionKey);
    
    const newAnswers = { ...answers, [questionKey]: value };
    setAnswers(newAnswers);
  };

  const calculateTotalScore = () => {
    return Object.values(answers).reduce((sum, answer) => sum + answer, 0);
  };

  const allQuestionsAnswered = Object.keys(answers).length === QUESTIONS.length;

  const handleSubmit = async () => {
    if (!allQuestionsAnswered) {
      alert('Please answer all questions before submitting.');
      return;
    }

    setIsSubmitting(true);
    const total = calculateTotal();
    const scoreData = {
      id: generateId(),
      patientId: patient?.id,
      patientEmail: patient?.email,
      date: new Date().toISOString(),
      day,
      ...answers,
      totalScore: total,
      synced: false,
    };
    await saveSkinScore(scoreData);
    if (isOnline) queueForSync('skinScore', scoreData);
    setIsSubmitting(false);
    navigate('/');
  };

  if (showResults) {
    return (
      <ResultsScreen
        answers={answers}
        totalScore={calculateTotal()}
        onRetake={() => setShowResults(false)}
      />
    );
  }

  return (
    <div className="h-screen bg-white flex flex-col">
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <p className="text-xs text-[#c44033] font-bold uppercase tracking-wider mb-0">
            Day {day} Progress Check
          </p>
          <h2 className="text-xl font-bold text-[#191716] font-['Playfair_Display'] mb-1">
            Skin Score
          </h2>
          <p className="text-sm text-[#7a756d] font-['Outfit'] mb-0">
            4 quick questions · takes 30 seconds
          </p>
        </div>

        {/* Progress Dots */}
        <div className="flex justify-center gap-2 px-6 pb-5">
          {[1, 2, 3, 4].map((q) => (
            <div
              key={q}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                Object.keys(answers).length >= q ? 'bg-[#c44033]' : 'bg-[#e0ddd7]'
              }`}
            />
          ))}
        </div>

        {/* Questions */}
        <div className="px-6 flex flex-col gap-6">
          {QUESTIONS.map((question, index) => (
            <motion.div
              key={question.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <p className="text-sm font-semibold text-[#191716] font-['Outfit'] mb-3 leading-relaxed">
                {question.question}
              </p>
              
              {/* Options */}
              <div className="flex gap-1.5">
                {question.options.map((option, optionIndex) => {
                  const value = optionIndex + 1;
                  return (
                    <button
                      key={value}
                      onClick={() => handleAnswer(question.key, value)}
                      className="flex-1 py-3 px-1 rounded-xl border-[1.5px] border-[#e0ddd7] bg-white cursor-pointer flex flex-col items-center gap-1 transition-all duration-150 min-h-[64px] justify-center hover:border-[#d0cdc7]"
                      style={{
                        backgroundColor: answers[question.key] === value ? '#fef2f1' : 'white',
                        borderColor: answers[question.key] === value ? '#c44033' : '#e0ddd7'
                      }}
                    >
                      <span 
                        className="text-base font-bold font-['Playfair_Display']"
                        style={{
                          color: answers[question.key] === value ? '#c44033' : '#ccc8c0'
                        }}
                      >
                        {value}
                      </span>
                      <span className="text-xs text-[#7a756d] font-['Outfit'] leading-tight text-center whitespace-pre-line font-normal">
                        {option}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 mt-8">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 bg-[#c44033] text-white py-4 px-6 rounded-xl font-semibold hover:bg-[#a03328] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-5 h-5" />
                    <span>Save Results</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

// Results Screen Component
const ResultsScreen = ({ answers, totalScore, onRetake }) => {
  const navigate = useNavigate();

  const getScoreLabel = (score) => {
    if (score >= 16) return 'Excellent';
    if (score >= 12) return 'Good';
    if (score >= 8) return 'Fair';
    return 'Needs Improvement';
  };

  const getScoreColor = (score) => {
    if (score === null || score === undefined) return 'text-gray-400';
    if (score >= 2) return 'text-green-600';
    if (score >= 1) return 'text-blue-600';
    return 'text-red-600';
  };

  const formatKey = (key) => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf8f5] via-[#f0f4ea]/5 to-[#faf8f5] px-6 py-8">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8"
        >
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-24 h-24 mx-auto rounded-full bg-gradient-to-r from-[#c44033]/20 to-[#a03328]/80 flex flex-col items-center justify-center text-white shadow-xl"
            >
              <span className="text-4xl font-bold">{totalScore}</span>
              <span className="text-sm mt-2">{getScoreLabel(totalScore)}</span>
            </motion.div>
          ))}
        </div>
      </div>

          <div className="flex gap-4">
            <button
              onClick={onRetake}
              className="flex-1 bg-gray-200 text-gray-800 py-3 px-6 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
            >
              Retake Assessment
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex-1 bg-[#c44033] text-white py-3 px-6 rounded-xl font-semibold hover:bg-[#a03328] transition-colors shadow-lg"
            >
              Continue to Home
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );

  // Helper function to get color based on score value
  function getScoreColor(value) {
    switch (value) {
      case 5: return 'bg-green-500';
      case 4: return 'bg-green-400';
      case 3: return 'bg-yellow-500';
      case 2: return 'bg-orange-500';
      case 1: return 'bg-red-500';
      default: return 'bg-gray-300';
    }
  }
}
