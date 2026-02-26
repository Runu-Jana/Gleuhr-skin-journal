import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Phone, Calendar, Target, Sparkles, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useGamification } from '../contexts/GamificationContext';

export default function SelfRegisterScreen() {
  const [step, setStep] = useState('details');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  
  // Form states
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    countryCode: '+91',
    age: '',
    gender: '',
    skinType: '',
    skinConcern: '',
    planType: 'Basic',
    goals: ''
  });
  
  const [verificationCode, setVerificationCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const { loginWithToken } = useAuth();
  const { requestPermission } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  // Pre-fill phone from login redirect
  React.useEffect(() => {
    if (location.state?.phoneNumber) {
      const incoming = location.state.phoneNumber;
      const code = location.state?.countryCode || '+91';
      setFormData(prev => ({
        ...prev,
        countryCode: code,
        phoneNumber: incoming.replace(code, '')
      }));
    }
  }, [location.state]);

  const fullPhone = `${formData.countryCode}${formData.phoneNumber.replace(/\s/g, '')}`;

  const handleSendVerification = async (e) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.phoneNumber.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/self-register/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: fullPhone,
          countryCode: formData.countryCode.replace('+', ''),
          fullName: formData.fullName.trim(),
          email: formData.email.trim()
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setStep('verification');
        setCountdown(60);
        if (data.code) {
          console.log('Development verification code:', data.code);
        }
      } else {
        setError(data.error || 'Failed to send verification code');
      }
    } catch (err) {
      setError('Failed to send verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteRegistration = async (e) => {
    e.preventDefault();
    if (!verificationCode.trim() || verificationCode.length !== 6) return;

    setIsLoading(true);
    setError('');

    try {
      const screenRef = window.screen; // eslint-disable-line no-restricted-globals
      const deviceFingerprint = btoa(navigator.userAgent + screenRef.width + screenRef.height + new Date().getTimezoneOffset());
      
      const response = await fetch('/api/self-register/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: fullPhone,
          verificationCode: verificationCode.trim(),
          deviceFingerprint,
          ...formData
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Request notification permission
        await requestPermission();

        // Login directly with the returned token (don't re-verify the code)
        await loginWithToken(data.authToken, data.patient);

        if (data.patient.isNewUser) {
          navigate('/onboarding');
        } else {
          navigate('/');
        }
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (err) {
      setError('Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (countdown > 0) return;
    
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/self-register/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: fullPhone,
          countryCode: formData.countryCode.replace('+', ''),
          fullName: formData.fullName.trim(),
          email: formData.email.trim()
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setCountdown(60);
        if (data.code) {
          console.log('Development RESEND verification code:', data.code);
        }
      } else {
        setError(data.error || 'Failed to resend verification code');
      }
    } catch (err) {
      setError('Failed to resend verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  const countryCodes = [
    { code: '+91', country: 'India', flag: '🇮🇳' },
    { code: '+1', country: 'USA', flag: '🇺🇸' },
    { code: '+44', country: 'UK', flag: '🇬🇧' },
    { code: '+61', country: 'Australia', flag: '🇦🇺' },
    { code: '+86', country: 'China', flag: '🇨🇳' },
    { code: '+81', country: 'Japan', flag: '🇯🇵' },
    { code: '+49', country: 'Germany', flag: '🇩🇪' },
    { code: '+33', country: 'France', flag: '🇫🇷' },
    { code: '+971', country: 'UAE', flag: '🇦🇪' },
    { code: '+65', country: 'Singapore', flag: '🇸🇬' },
    { code: '+62', country: 'Indonesia', flag: '🇮🇩' },
    { code: '+60', country: 'Malaysia', flag: '🇲🇾' },
    { code: '+63', country: 'Philippines', flag: '🇵🇭' },
    { code: '+66', country: 'Thailand', flag: '🇹🇭' },
    { code: '+84', country: 'Vietnam', flag: '🇻🇳' },
  ];

  return (
    <div className="min-h-screen bg-[#faf8f5] flex flex-col">
      {/* Header */}
      <div className="pt-12 pb-8 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#c44033] flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Join Gleuhr</h1>
        <p className="text-gray-500 mt-1">Start your 90-day skin transformation journey</p>
      </div>

      {/* Registration Form */}
      <div className="flex-1 px-6">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            
            {step === 'details' ? (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Create Your Account</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Join thousands achieving their skin goals with personalized guidance
                </p>

                <form onSubmit={handleSendVerification} className="space-y-4">
                  {/* Full Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name *
                    </label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={formData.fullName}
                        onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                        placeholder="Enter your full name"
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-[#c44033] focus:ring-2 focus:ring-[#c44033]/20 outline-none transition-all"
                        disabled={isLoading}
                        required
                      />
                    </div>
                  </div>

                  {/* Email (Optional) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address <span className="text-gray-400">(Optional)</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        placeholder="your@email.com (optional)"
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-[#c44033] focus:ring-2 focus:ring-[#c44033]/20 outline-none transition-all"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  {/* Phone Number */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number *
                    </label>
                    <div className="flex gap-2">
                      {/* Country Code Dropdown */}
                      <select
                        value={formData.countryCode}
                        onChange={(e) => setFormData({...formData, countryCode: e.target.value})}
                        className="px-3 py-3 rounded-xl border border-gray-200 focus:border-[#c44033] focus:ring-2 focus:ring-[#c44033]/20 outline-none"
                        disabled={isLoading}
                      >
                        {countryCodes.map((country) => (
                          <option key={country.code} value={country.code}>
                            {country.flag} {country.code}
                          </option>
                        ))}
                      </select>

                      {/* Phone Number Input */}
                      <input
                        type="tel"
                        value={formData.phoneNumber}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 15);
                          setFormData({...formData, phoneNumber: value});
                        }}
                        placeholder="98765 43210"
                        className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-[#c44033] focus:ring-2 focus:ring-[#c44033]/20 outline-none transition-all"
                        disabled={isLoading}
                        required
                      />
                    </div>
                  </div>

                  {/* Additional Details */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Age
                      </label>
                      <input
                        type="number"
                        value={formData.age}
                        onChange={(e) => setFormData({...formData, age: e.target.value})}
                        placeholder="25"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#c44033] focus:ring-2 focus:ring-[#c44033]/20 outline-none transition-all"
                        disabled={isLoading}
                        min="1"
                        max="100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Gender
                      </label>
                      <select
                        value={formData.gender}
                        onChange={(e) => setFormData({...formData, gender: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#c44033] focus:ring-2 focus:ring-[#c44033]/20 outline-none transition-all"
                        disabled={isLoading}
                      >
                        <option value="">Select</option>
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  {/* Skin Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Skin Type
                    </label>
                    <select
                      value={formData.skinType}
                      onChange={(e) => setFormData({...formData, skinType: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#c44033] focus:ring-2 focus:ring-[#c44033]/20 outline-none transition-all"
                      disabled={isLoading}
                    >
                      <option value="">Select</option>
                      <option value="oily">Oily</option>
                      <option value="dry">Dry</option>
                      <option value="combination">Combination</option>
                      <option value="sensitive">Sensitive</option>
                      <option value="normal">Normal</option>
                    </select>
                  </div>

                  {/* Skin Concern */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Primary Skin Concern
                    </label>
                    <select
                      value={formData.skinConcern}
                      onChange={(e) => setFormData({...formData, skinConcern: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#c44033] focus:ring-2 focus:ring-[#c44033]/20 outline-none transition-all"
                      disabled={isLoading}
                    >
                      <option value="">Select</option>
                      <option value="acne">Acne</option>
                      <option value="aging">Anti-Aging</option>
                      <option value="pigmentation">Pigmentation</option>
                      <option value="dryness">Dryness</option>
                      <option value="sensitivity">Sensitivity</option>
                      <option value="texture">Texture</option>
                    </select>
                  </div>

                  {/* Goals */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Your Goals (comma separated)
                    </label>
                    <textarea
                      value={formData.goals}
                      onChange={(e) => setFormData({...formData, goals: e.target.value})}
                      placeholder="Clear skin, reduce acne, look younger..."
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#c44033] focus:ring-2 focus:ring-[#c44033]/20 outline-none transition-all resize-none"
                      rows={3}
                      disabled={isLoading}
                    />
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading || !formData.fullName.trim() || !formData.phoneNumber.trim()}
                    className="w-full bg-[#c44033] text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-[#a03328] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Sending Verification...
                      </>
                    ) : (
                      <>
                        Send WhatsApp Code
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </form>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Verify Your Phone</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Enter the 6-digit code sent via WhatsApp to <span className="font-medium text-gray-700">{fullPhone}</span>
                </p>

                <form onSubmit={handleCompleteRegistration} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      WhatsApp Verification Code *
                    </label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={verificationCode}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setVerificationCode(value);
                        }}
                        placeholder="123456"
                        maxLength={6}
                        className="w-full pl-12 pr-12 py-3 rounded-xl border border-gray-200 focus:border-[#c44033] focus:ring-2 focus:ring-[#c44033]/20 outline-none transition-all text-center tracking-widest font-semibold text-lg"
                        disabled={isLoading}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading || verificationCode.length !== 6}
                    className="w-full bg-[#c44033] text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-[#a03328] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      <>
                        Complete Registration
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setStep('details');
                        setVerificationCode('');
                      }}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Change phone number
                    </button>
                    
                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={countdown > 0 || isLoading}
                      className="text-sm text-[#c44033] font-medium hover:text-[#a03328] disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      {countdown > 0 ? `Resend in ${countdown}s` : 'Resend Code'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Already have an account?{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-[#c44033] font-medium hover:underline"
              >
                Login here
              </button>
            </p>
          </div>

          {/* Help Text */}
          <div className="mt-3 text-center">
            <p className="text-sm text-gray-500">
              By registering, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="py-6 text-center">
        <p className="text-xs text-gray-400">
          © 2024 Gleuhr Skincare. All rights reserved.
        </p>
      </div>
    </div>
  );
}
