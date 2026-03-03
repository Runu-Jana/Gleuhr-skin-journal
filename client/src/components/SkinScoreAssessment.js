import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { saveSkinScore } from '../utils/db';
import { generateId } from '../utils/helpers';

export default function SkinScoreAssessment() {
  const { patient } = useAuth();
  const navigate = useNavigate();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scores, setScores] = useState({
    pigmentation: 0,      // Darkest patch comparison
    toneEvenness: 0,     // Overall skin tone evenness
    texture: 0,          // Skin texture feel
    confidence: 0        // Confidence level
  });

  const questions = [
    {
      id: 'pigmentation',
      title: 'Look at the darkest patch on your face',
      subtitle: 'Compared to when you started, it is…',
      options: [
        { value: 5, label: 'Much lighter', color: 'bg-green-600' },
        { value: 4, label: 'Somewhat lighter', color: 'bg-green-400' },
        { value: 3, label: 'About the same', color: 'bg-yellow-500' },
        { value: 2, label: 'Slightly darker', color: 'bg-orange-500' },
        { value: 1, label: 'Much darker', color: 'bg-red-500' }
      ],
      icon: '🎯'
    },
    {
      id: 'toneEvenness',
      title: 'How even does your overall skin tone look?',
      subtitle: 'Rate your skin tone evenness',
      options: [
        { value: 5, label: 'Very even', color: 'bg-green-600' },
        { value: 4, label: 'Mostly even', color: 'bg-green-400' },
        { value: 3, label: 'Somewhat uneven', color: 'bg-yellow-500' },
        { value: 2, label: 'Quite uneven', color: 'bg-orange-500' },
        { value: 1, label: 'Very uneven', color: 'bg-red-500' }
      ],
      icon: '✨'
    },
    {
      id: 'texture',
      title: 'How does your skin texture feel?',
      subtitle: 'Rate your skin texture',
      options: [
        { value: 5, label: 'Very smooth', color: 'bg-green-600' },
        { value: 4, label: 'Mostly smooth', color: 'bg-green-400' },
        { value: 3, label: 'Somewhat rough', color: 'bg-yellow-500' },
        { value: 2, label: 'Quite rough', color: 'bg-orange-500' },
        { value: 1, label: 'Very rough', color: 'bg-red-500' }
      ],
      icon: '🌟'
    },
    {
      id: 'confidence',
      title: 'How confident do you feel about your skin right now?',
      subtitle: 'Rate your confidence level',
      options: [
        { value: 5, label: 'Very confident', color: 'bg-green-500' },
        { value: 4, label: 'Mostly confident', color: 'bg-green-400' },
        { value: 3, label: 'Somewhat confident', color: 'bg-yellow-500' },
        { value: 2, label: 'Not very confident', color: 'bg-orange-500' },
        { value: 1, label: 'Not confident at all', color: 'bg-red-500' }
      ],
      icon: '💪'
    }
  ];

  const handleScoreChange = (questionId, value) => {
    setScores(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const calculateTotalScore = () => {
    return Object.values(scores).reduce((sum, score) => sum + score, 0);
  };

  const allQuestionsAnswered = Object.values(scores).every(score => score > 0);

  const handleSubmit = async () => {
    if (!allQuestionsAnswered) {
      alert('Please answer all questions before submitting.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const totalScore = calculateTotalScore();
      
      const scoreData = {
        id: generateId(),
        patientEmail: patient?.email,
        patientName: patient?.name,
        date: new Date().toISOString(),
        day: patient?.day || 1,
        assessmentType: 'skin-score',
        totalScore,
        maxScore: 20,
        individualScores: scores,
        pigmentation: scores.pigmentation,
        toneEvenness: scores.toneEvenness,
        texture: scores.texture,
        confidence: scores.confidence,
        synced: false
      };

      // Save to IndexedDB
      await saveSkinScore(scoreData);
      
      console.log('Skin score assessment completed:', scoreData);
      
      // Navigate home after successful submission
      navigate('/');
      
    } catch (error) {
      console.error('Error saving skin score:', error);
      alert('Failed to save assessment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Skin Score Assessment
          </h1>
          <p className="text-gray-600">
            Day {patient?.day || 1} • 4 quick questions • takes 30 seconds
          </p>
        </motion.div>

        {/* Progress Bar */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          className="mb-8"
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">Progress</span>
            <span className="text-sm font-semibold text-gray-900">
              {Object.values(scores).filter(score => score > 0).length}/4 questions
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-[#c44033] h-2 rounded-full transition-all duration-300"
              style={{ width: `${(Object.values(scores).filter(score => score > 0).length / 4) * 100}%` }}
            />
          </div>
        </motion.div>

        {/* All Questions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          {questions.map((question, index) => (
            <motion.div
              key={question.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
            >
              {/* Question Header */}
              <div className="mb-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{question.icon}</span>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {question.title}
                  </h3>
                </div>
                <p className="text-sm text-gray-600 ml-11">
                  {question.subtitle}
                </p>
              </div>

              {/* Options */}
              <div className="space-y-2 ml-11">
                {question.options.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleScoreChange(question.id, option.value)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all duration-200 ${
                      scores[question.id] === option.value
                        ? 'border-[#c44033] bg-[#c44033] bg-opacity-5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-medium ${
                        scores[question.id] === option.value
                          ? 'text-[#c44033]'
                          : 'text-gray-700'
                      }`}>
                        {option.label}
                      </span>
                      <div className={`w-3 h-3 rounded-full ${
                        scores[question.id] === option.value
                          ? option.color
                          : 'bg-gray-300'
                      }`} />
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Score Preview */}
        {Object.values(scores).some(score => score > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Score</h3>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-[#c44033]">
                  {calculateTotalScore()}/20
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {allQuestionsAnswered 
                    ? 'Assessment complete!' 
                    : `${4 - Object.values(scores).filter(score => score > 0).length} questions remaining`
                  }
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Individual scores:</div>
                <div className="text-xs text-gray-500 mt-1">
                  Pigmentation: {scores.pigmentation || '-'} | 
                  Tone: {scores.toneEvenness || '-'} | 
                  Texture: {scores.texture || '-'} | 
                  Confidence: {scores.confidence || '-'}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Submit Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8"
        >
          <button
            onClick={handleSubmit}
            disabled={!allQuestionsAnswered || isSubmitting}
            className={`w-full py-4 rounded-2xl font-semibold transition-all duration-200 ${
              allQuestionsAnswered && !isSubmitting
                ? 'bg-[#c44033] text-white shadow-lg hover:bg-[#b33a2e]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? 'Saving...' : 'Complete Assessment'}
          </button>
          
          {!allQuestionsAnswered && (
            <p className="text-center text-sm text-gray-500 mt-2">
              Please answer all questions to continue
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
