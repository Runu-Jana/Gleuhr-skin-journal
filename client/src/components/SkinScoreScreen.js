import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOffline } from '../contexts/OfflineContext';
import { saveSkinScore } from '../utils/db';
import { ChevronLeft, TrendingUp } from 'lucide-react';
import { calculateDay, generateId } from '../utils/helpers';

const QUESTIONS = [
  { 
    key: 'pigmentation', 
    question: 'Look at the darkest patch on your face. Compared to when you started, it is...',
    options: [
      { value: 1, label: 'Much darker', color: 'bg-red-600' },
      { value: 2, label: 'Slightly darker', color: 'bg-orange-600' },
      { value: 3, label: 'Same', color: 'bg-yellow-600' },
      { value: 4, label: 'Somewhat lighter', color: 'bg-green-400' },
      { value: 5, label: 'Much lighter', color: 'bg-green-600' }
    ]
  },
  { 
    key: 'toneEvenness', 
    question: 'How even does your overall skin tone look?',
    options: [
      { value: 1, label: 'Much less even', color: 'bg-red-600' },
      { value: 2, label: 'Less even', color: 'bg-orange-600' },
      { value: 3, label: 'Same', color: 'bg-yellow-600' },
      { value: 4, label: 'More even', color: 'bg-green-400' },
      { value: 5, label: 'Much more even', color: 'bg-green-600' }
    ]
  },
  { 
    key: 'texture', 
    question: 'How does your skin texture feel?',
    options: [
      { value: 1, label: 'Very rough', color: 'bg-red-600' },
      { value: 2, label: 'Rough', color: 'bg-orange-600' },
      { value: 3, label: 'Normal', color: 'bg-yellow-600' },
      { value: 4, label: 'Smooth', color: 'bg-green-400' },
      { value: 5, label: 'Very smooth', color: 'bg-green-600' }
    ]
  },
  { 
    key: 'confidence', 
    question: 'How confident do you feel about your skin right now?',
    options: [
      { value: 1, label: 'Not confident at all', color: 'bg-red-500' },
      { value: 2, label: 'Not very confident', color: 'bg-orange-500' },
      { value: 3, label: 'Somewhat confident', color: 'bg-yellow-500' },
      { value: 4, label: 'Mostly confident', color: 'bg-blue-500' },
      { value: 5, label: 'Very confident', color: 'bg-green-500' }
    ]
  }
];

export default function SkinScoreScreen() {
  const { patient } = useAuth();
  const { isOnline, queueForSync } = useOffline();
  const navigate = useNavigate();
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const day = calculateDay(patient?.startDate);

  const handleAnswer = (questionKey, value) => {
    setAnswers({ ...answers, [questionKey]: value });
  };

  const calculateTotalScore = () => {
    return Object.values(answers).reduce((sum, score) => sum + score, 0);
  };

  const allQuestionsAnswered = Object.values(answers).every(score => score > 0);

  const handleSubmit = async () => {
    if (!allQuestionsAnswered) {
      alert('Please answer all questions before submitting.');
      return;
    }

    // Validate patient data exists
    if (!patient?.id) {
      alert('Patient information not found. Please log in again.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const totalScore = calculateTotalScore();
      
      const scoreData = {
        id: generateId(),
        patientId: patient?.id,
        patientName: patient?.name,
        patientPhone: patient?.phone,
        date: new Date().toISOString(),
        day: day || 1,
        assessmentType: 'skin-score',
        totalScore,
        maxScore: 20,
        individualScores: answers,
        darkest_patch: answers.pigmentation ?? 0,
        skin_tone: answers.toneEvenness ?? 0,
        texture: answers.texture ?? 0,
        confidence: answers.confidence ?? 0,
        synced: false
      };

      await saveSkinScore(scoreData);

      // Save to MongoDB directly
      try {
        const apiData = {
          patientPhone: patient?.phone,
          date: scoreData.date,
          day: scoreData.day,
          darkest_patch: scoreData.darkest_patch,
          skin_tone: scoreData.skin_tone,
          texture: scoreData.texture,
          confidence: scoreData.confidence,
          totalScore: scoreData.totalScore
        };
        const response = await fetch('/api/skinscore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(apiData)
        });
        const result = await response.json();
        if (result.success) {
          scoreData.synced = true;
          await saveSkinScore(scoreData);
        } else if (isOnline) {
          queueForSync('skinScore', apiData);
        }
      } catch (apiError) {
        console.error('Failed to save skin score to MongoDB:', apiError);
        if (isOnline) {
          queueForSync('skinScore', { patientPhone: patient?.phone, ...scoreData });
        }
      }
      
      console.log('Skin score assessment completed:', scoreData);
      
      navigate('/skin-score-results');
      
    } catch (error) {
      console.error('Error saving skin score:', error);
      alert('Failed to save assessment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf8f5] via-[#f0f4ea]/5 to-[#faf8f5] py-8">
      <div className="max-w-2xl mx-auto">
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
                {question.options.map((option) => {
                  const value = option.value;
                  return (
                    <button
                      key={value}
                      onClick={() => handleAnswer(question.key, value)}
                      className="flex-1 min-w-0 py-3 px-1 rounded-xl border-[1.5px] border-[#e0ddd7] bg-white cursor-pointer flex flex-col items-center gap-1 transition-all duration-150 min-h-[64px] justify-center hover:border-[#d0cdc7]"
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
                      <span className="text-xs text-[#7a756d] font-['Outfit'] leading-tight text-center break-words font-normal w-full">
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Submit Button */}
        <div className="px-6 py-7">
          <button
            onClick={handleSubmit}
            disabled={!allQuestionsAnswered || isSubmitting}
            className={`w-full py-[18px] rounded-2xl font-semibold transition-all duration-250 font-['Outfit'] text-base ${
              allQuestionsAnswered && !isSubmitting
                ? 'bg-[#c44033] text-white shadow-lg hover:bg-[#b33a2e]'
                : 'bg-[#e0ddd7] text-[#a39e95] cursor-default'
            }`}
            style={{
              boxShadow: allQuestionsAnswered && !isSubmitting ? '0 4px 12px rgba(196, 64, 51, 0.3)' : 'none'
            }}
          >
            {isSubmitting ? 'Saving...' : 'See My Score →'}
          </button>
        </div>
      </div>
    </div>
  );
}
