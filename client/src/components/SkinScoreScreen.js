import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { saveSkinScore } from '../utils/db';
import { useOffline } from '../contexts/OfflineContext';
import { calculateDay, generateId } from '../utils/helpers';
import { ChevronLeft, Camera, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

const QUESTIONS = [
  { key: 'texture', label: 'Skin Texture', question: 'How smooth is your skin texture?' },
  { key: 'pigmentation', label: 'Pigmentation', question: 'How even is your skin tone?' },
  { key: 'brightness', label: 'Brightness', question: 'How bright and radiant is your skin?' },
  { key: 'breakouts', label: 'Breakouts', question: 'How clear is your skin from breakouts?' },
  { key: 'confidence', label: 'Confidence', question: 'How confident do you feel about your skin?' },
  { key: 'hydration', label: 'Hydration', question: 'How hydrated does your skin feel?' },
  { key: 'smoothness', label: 'Smoothness', question: 'How soft and smooth is your skin to touch?' },
  { key: 'evenness', label: 'Evenness', question: 'How even is your skin surface?' },
  { key: 'firmness', label: 'Firmness', question: 'How firm and elastic is your skin?' },
  { key: 'glow', label: 'Natural Glow', question: 'How much natural glow does your skin have?' },
];

export default function SkinScoreScreen() {
  const { patient } = useAuth();
  const { isOnline, queueForSync } = useOffline();
  const navigate = useNavigate();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const day = calculateDay(patient?.startDate);
  const currentQ = QUESTIONS[currentQuestion];

  const handleAnswer = (value) => {
    setAnswers({ ...answers, [currentQ.key]: value });
    if (currentQuestion < QUESTIONS.length - 1) {
      setTimeout(() => setCurrentQuestion(currentQuestion + 1), 300);
    } else {
      setShowResults(true);
    }
  };

  const calculateTotal = () =>
    Object.values(answers).reduce((a, b) => (b === null ? a : a + b), 0);

  const handleSubmit = async () => {
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
    <div className="min-h-screen bg-gradient-to-br from-[#faf8f5] via-[#f0f4ea]/5 to-[#faf8f5] px-6 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold text-gray-900 mb-2"
          >
            Skin Assessment
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-lg text-gray-600 max-w-md mx-auto"
          >
            Day {day} of your skincare journey
          </motion.p>
        </div>

        {/* Progress Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#c44033]/20 to-[#a03328]/80 flex items-center justify-center text-white font-semibold shadow-lg">
                <span className="text-xl">
                  {Math.round(((currentQuestion + 1) / QUESTIONS.length) * 100)}%
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Question {currentQuestion + 1} of {QUESTIONS.length}
                </p>
                <p className="text-xs text-gray-500">
                  Progress: {currentQuestion + 1}/{QUESTIONS.length}
                </p>
              </div>
            </div>
            <button
              onClick={() =>
                currentQuestion > 0 && setCurrentQuestion(currentQuestion - 1)
              }
              disabled={currentQuestion === 0}
              className="p-3 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              <ChevronLeft className="w-5 h-5 text-gray-400" />
            </button>
            <button
              onClick={() => {
                const remainingQuestions = QUESTIONS.length - currentQuestion - 1;
                if (remainingQuestions > 0) {
                  const finalAnswers = { ...answers };
                  for (let i = currentQuestion + 1; i < QUESTIONS.length; i++) {
                    finalAnswers[QUESTIONS[i].key] = null;
                  }
                  setAnswers(finalAnswers);
                  setCurrentQuestion(currentQuestion + 1);
                } else {
                  setShowResults(true);
                }
              }}
              disabled={currentQuestion >= QUESTIONS.length - 1}
              className="text-sm text-gray-500 hover:text-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed"
            >
              {currentQuestion < QUESTIONS.length - 1 ? 'Skip' : 'View Results'}
            </button>
          </div>

          {/* Question Card */}
          <motion.div
            key={currentQuestion}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8"
          >
            <div className="mb-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center text-white shadow-xl">
                  <Camera className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {currentQ.label}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {currentQ.question}
                  </p>
                </div>
              </div>
            </div>

            {/* Answer Options */}
            <div className="space-y-4">
              {[0, 1, 2].map((value) => (
                <button
                  key={value}
                  onClick={() => handleAnswer(value)}
                  className={`w-full p-6 rounded-2xl border-2 text-left transition-all hover:shadow-lg ${
                    answers[currentQ.key] === value
                      ? 'border-[#c44033] bg-[#c44033] text-white'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                        answers[currentQ.key] === value
                          ? 'border-white bg-white'
                          : 'border-gray-300 bg-gray-50'
                      }`}
                    >
                      {answers[currentQ.key] === value && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-4 h-4 bg-[#c44033] rounded-full"
                        />
                      )}
                    </div>
                    <div className="flex-1">
                      <span className="font-medium">
                        {value === 0 ? 'Poor' : value === 1 ? 'Fair' : 'Good'}
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
            <p className="text-gray-600 mt-4">Your skin assessment is complete!</p>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-8">
            {Object.entries(answers)
              .filter(([_, value]) => value !== null)
              .map(([key, value]) => (
                <div key={key} className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">
                    {formatKey(key)}
                  </h4>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 text-sm">Score:</span>
                    <span className={`font-bold ${getScoreColor(value)}`}>
                      {value}/2
                    </span>
                  </div>
                </div>
              ))}
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
};