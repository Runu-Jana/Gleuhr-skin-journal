import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, BookOpen, Target, ChevronRight, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [isCommitting, setIsCommitting] = useState(false);
  const navigate = useNavigate();
  const { commitToProgram } = useAuth();

  const steps = [
    {
      title: 'Welcome to Your Skin Journey',
      subtitle: 'Transform your skin in 90 days with Gleuhr',
      icon: Sparkles,
      content: (
        <div className="space-y-4">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-[#c44033] to-[#e85a4a] rounded-3xl flex items-center justify-center shadow-xl shadow-[#c44033]/20">
            <Sparkles className="w-12 h-12 text-white" />
          </div>
          <p className="text-gray-600 text-center leading-relaxed">
            We're excited to guide you through your personalized 90-day skin transformation program. 
            Track your daily routine, monitor progress, and achieve glowing skin.
          </p>
        </div>
      ),
    },
    {
      title: 'How The Journal Works',
      subtitle: 'Simple daily check-ins, powerful results',
      icon: BookOpen,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: '🌅', label: 'AM Routine', desc: 'Morning skincare' },
              { icon: '🌙', label: 'PM Routine', desc: 'Evening skincare' },
              { icon: '☀️', label: 'Sunscreen', desc: 'Daily protection' },
            ].map((item, i) => (
              <div key={i} className="bg-white rounded-xl p-3 text-center shadow-sm border border-gray-100">
                <div className="text-2xl mb-1">{item.icon}</div>
                <div className="text-xs font-semibold text-gray-900">{item.label}</div>
                <div className="text-[10px] text-gray-500">{item.desc}</div>
              </div>
            ))}
          </div>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#c44033]" />
              Log your daily skincare routine
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#c44033]" />
              Track diet and water intake
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#c44033]" />
              Weekly progress photos
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#c44033]" />
              Skin score assessments
            </li>
          </ul>
        </div>
      ),
    },
    {
      title: 'The Commitment',
      subtitle: '90 days to transform your skin',
      icon: Target,
      content: (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-[#c44033]/10 to-[#e85a4a]/10 rounded-2xl p-5 border border-[#c44033]/20">
            <div className="text-center">
              <div className="text-5xl font-bold text-[#c44033] mb-2">90</div>
              <div className="text-gray-600 font-medium">Days of Commitment</div>
            </div>
          </div>
          <p className="text-gray-600 text-center text-sm leading-relaxed">
            Skin transformation takes time. By committing to 90 days, you're giving your skin 
            the consistent care it needs to truly glow.
          </p>
          <div className="flex items-center justify-center gap-4 text-sm">
            <div className="text-center">
              <div className="font-semibold text-gray-900">28 Days</div>
              <div className="text-gray-500">First assessment</div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <div className="text-center">
              <div className="font-semibold text-gray-900">56 Days</div>
              <div className="text-gray-500">Mid-point review</div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <div className="text-center">
              <div className="font-semibold text-gray-900">84 Days</div>
              <div className="text-gray-500">Final assessment</div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    }
  };

  const handleCommit = async () => {
    setIsCommitting(true);
    await commitToProgram();
    setIsCommitting(false);
    navigate('/');
  };

  const currentStep = steps[step];
  const Icon = currentStep.icon;

  return (
    <div className="min-h-screen bg-[#faf8f5] flex flex-col">
      {/* Progress dots */}
      <div className="pt-8 px-6">
        <div className="flex justify-center gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-8 bg-[#c44033]' : i < step ? 'w-4 bg-[#c44033]/50' : 'w-4 bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center px-6 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#c44033]/10 mb-3">
                <Icon className="w-6 h-6 text-[#c44033]" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">{currentStep.title}</h1>
              <p className="text-gray-500">{currentStep.subtitle}</p>
            </div>

            {/* Content */}
            <div className="max-w-sm mx-auto">
              {currentStep.content}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="px-6 pb-8 pt-4">
        {step < steps.length - 1 ? (
          <button onClick={handleNext} className="btn-primary w-full flex items-center justify-center gap-2">
            Next
            <ChevronRight className="w-5 h-5" />
          </button>
        ) : (
          <button 
            onClick={handleCommit} 
            disabled={isCommitting}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {isCommitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Committing...
              </>
            ) : (
              <>
                <Target className="w-5 h-5" />
                I Commit to 90 Days
              </>
            )}
          </button>
        )}
        
        {step < steps.length - 1 && (
          <button 
            onClick={() => {
              console.log('Onboarding Skip clicked, current step:', step, 'total steps:', steps.length);
              // Skip commitment and mark as completed
              setStep(steps.length);
              navigate('/');
            }}
            disabled={step >= steps.length - 1 || step === 0}
            className="w-full mt-3 text-sm text-gray-400 hover:text-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {step < steps.length - 1 ? 'Skip to commitment' : 'Already at last step'}
          </button>
        )}
      </div>
    </div>
  );
}
