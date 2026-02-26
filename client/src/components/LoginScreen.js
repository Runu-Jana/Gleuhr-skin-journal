import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Sparkles, ArrowRight, Loader2, Lock, ChevronDown } from 'lucide-react';
import axios from 'axios';

// Common country dial codes
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

export default function LoginScreen() {
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [step, setStep] = useState('phone');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const { loginWithWhatsApp } = useAuth();
  const navigate = useNavigate();

  const fullPhone = `${countryCode}${phoneNumber.replace(/\s/g, '')}`;

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendWhatsAppCode = async (e) => {
    e.preventDefault();
    if (!phoneNumber.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/auth/send-verification', { 
        phoneNumber: fullPhone,
        countryCode: countryCode.replace('+', '')
      });
      
      if (response.data.success) {
        setStep('verification');
        setCountdown(60);
        if (response.data.code) {
          console.log('Development verification code:', response.data.code);
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send WhatsApp verification. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyWhatsAppCode = async (e) => {
    e.preventDefault();
    if (!verificationCode.trim() || verificationCode.length !== 6) return;

    setIsLoading(true);
    setError('');

    const result = await loginWithWhatsApp(fullPhone, verificationCode.trim());
    
    if (result.success) {
      if (result.hasCommitted) {
        // Existing committed patient - go home
        navigate('/');
      } else {
        // New or existing patient not committed - go onboarding
        navigate('/onboarding');
      }
    } else {
      setError(result.error || 'Invalid verification code. Please try again.');
    }

    setIsLoading(false);
  };

  const handleResendWhatsAppCode = async () => {
    if (countdown > 0) return;
    
    setIsLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/auth/resend-verification', { 
        phoneNumber: fullPhone,
        countryCode: countryCode.replace('+', '')
      });
      
      if (response.data.success) {
        setCountdown(60);
        if (response.data.code) {
          console.log('Development RESEND verification code:', response.data.code);
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resend WhatsApp verification.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] flex flex-col">
      {/* Header Logo */}
      <div className="pt-12 pb-8 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#c44033] flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Gleuhr</h1>
        <p className="text-gray-500 mt-1">Your 90-Day Skin Transformation</p>
      </div>

      {/* Login Form */}
      <div className="flex-1 px-6">
        <div className="max-w-sm mx-auto">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            
            {step === 'phone' ? (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Welcome</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Enter your phone number to receive a WhatsApp verification code
                </p>

                <form onSubmit={handleSendWhatsAppCode} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <div className="flex gap-2">
                      {/* Country Code Dropdown */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                          className="h-full px-3 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 font-medium flex items-center gap-1 hover:bg-gray-100 transition-colors min-w-[100px]"
                        >
                          <span>{countryCodes.find(c => c.code === countryCode)?.flag}</span>
                          <span>{countryCode}</span>
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        </button>
                        
                        {showCountryDropdown && (
                          <div className="absolute top-full left-0 mt-1 w-64 max-h-60 overflow-y-auto bg-white rounded-xl border border-gray-200 shadow-lg z-50">
                            {countryCodes.map((country) => (
                              <button
                                key={country.code}
                                type="button"
                                onClick={() => {
                                  setCountryCode(country.code);
                                  setShowCountryDropdown(false);
                                }}
                                className={`w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left ${
                                  countryCode === country.code ? 'bg-gray-50' : ''
                                }`}
                              >
                                <span className="text-lg">{country.flag}</span>
                                <span className="font-medium text-gray-900">{country.code}</span>
                                <span className="text-gray-500 text-sm">{country.country}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Phone Number Input */}
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 15);
                          setPhoneNumber(value);
                        }}
                        placeholder="98765 43210"
                        className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-[#c44033] focus:ring-2 focus:ring-[#c44033]/20 outline-none transition-all"
                        disabled={isLoading}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Enter number without country code</p>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading || !phoneNumber.trim()}
                    className="w-full bg-[#c44033] text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-[#a03328] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        Get WhatsApp Code
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </form>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Verify WhatsApp Code</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Enter 6-digit code sent via WhatsApp to <span className="font-medium text-gray-700">{fullPhone}</span>
                </p>

                <form onSubmit={handleVerifyWhatsAppCode} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      WhatsApp Verification Code
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={verificationCode}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setVerificationCode(value);
                        }}
                        placeholder="123456"
                        maxLength={6}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-[#c44033] focus:ring-2 focus:ring-[#c44033]/20 outline-none transition-all text-center tracking-widest font-semibold text-lg"
                        disabled={isLoading}
                      />
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
                        Verifying WhatsApp Code...
                      </>
                    ) : (
                      <>
                        Verify & Continue
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setStep('phone');
                        setPhoneNumber('');
                      }}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Change number
                    </button>
                    
                    <button
                      type="button"
                      onClick={handleResendWhatsAppCode}
                      disabled={countdown > 0 || isLoading}
                      className="text-sm text-[#c44033] font-medium hover:text-[#a03328] disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      {countdown > 0 ? `Resend in ${countdown}s` : 'Resend WhatsApp Code'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>

          {/* Help Text */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Having trouble?{' '}
              <a
                href="https://wa.me/919876543210?text=Hi%2C%20I%20need%20help%20with%20login"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#c44033] font-medium hover:underline"
              >
                Contact support
              </a>
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
