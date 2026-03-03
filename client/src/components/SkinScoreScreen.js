import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOffline } from '../contexts/OfflineContext';
import { saveSkinScore } from '../utils/db';
import { Camera, ChevronLeft, TrendingUp } from 'lucide-react';
import { calculateDay, generateId } from '../utils/helpers';
import axios from 'axios';

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
  const { patient } = useAuth();
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
    
    try {
      const totalScore = calculateTotalScore();
      
      const scoreData = {
        id: generateId(),
        patientEmail: patient?.email,
        patientName: patient?.name,
        patientPhone: patient?.phone,
        date: new Date().toISOString(),
        day: day,
        assessmentType: 'skin-score',
        totalScore,
        maxScore: 20,
        individualScores: answers,
        pigmentation: answers.darkest_patch || 0,
        toneEvenness: answers.skin_tone || 0,
        texture: answers.texture || 0,
        confidence: answers.confidence || 0,
        synced: false
      };

      // Save to IndexedDB
      await saveSkinScore(scoreData);
      
      // Try to save to MongoDB directly
      try {
        const response = await axios.post('/api/skinscore', scoreData);
        console.log('MongoDB save response:', response.data);
        
        // Update local record as synced
        scoreData.synced = true;
        scoreData.id = response.data.id;
        await saveSkinScore(scoreData);
        console.log('Skin score saved to MongoDB successfully!');
      } catch (apiError) {
        console.error('Skin score API not available, data saved locally:', apiError);
        // Keep data in IndexedDB for later sync
      }
      
      console.log('Skin score assessment completed:', scoreData);
      
      // Navigate to results page after successful submission
      navigate('/skin-score-results');
      
    } catch (error) {
      console.error('Error saving skin score:', error);
      alert('Failed to save assessment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
                    </button>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>
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
