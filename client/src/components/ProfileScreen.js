import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { calculateDay } from '../utils/helpers';
import { LogOut, Phone, ShoppingBag, MessageCircle, ChevronLeft, Shield, Flame } from 'lucide-react';

export default function ProfileScreen() {
  const { patient, streak: streakData, logout } = useAuth();
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  if (!patient) {
    return (
      <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#c44033] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const name = patient.name || patient.fullName || 'You';
  const initial = name.charAt(0).toUpperCase();
  const day = calculateDay(patient?.startDate);
  const currentStreak = streakData?.streak || 0;
  const planType = patient.planType || '90-Day Programme';

  const handleLogout = async () => {
    setLoggingOut(true);
    // Small delay for visual feedback
    await new Promise(r => setTimeout(r, 600));
    logout(); // clears localStorage token + React state only — MongoDB data is preserved
    navigate('/login', { replace: true });
  };

  const handleWhatsApp = () => {
    if (!patient.coachWhatsApp) return;
    const msg = encodeURIComponent(`Hi ${patient.coachName || 'Coach'}, this is ${name}. I have a question about my skin journey.`);
    window.open(`https://wa.me/${patient.coachWhatsApp}?text=${msg}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#faf8f5]">

      {/* Header */}
      <div className="bg-[#191716] px-5 pt-12 pb-8 relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-[rgba(196,64,51,0.06)]" />
        <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-[rgba(196,64,51,0.04)]" />

        {/* Back arrow */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-[rgba(255,255,255,0.5)] mb-6 text-sm font-outfit"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        {/* Avatar + name */}
        <div className="flex items-center gap-4 relative">
          <div className="w-16 h-16 rounded-[22px] bg-[rgba(196,64,51,0.18)] border border-[rgba(196,64,51,0.25)] flex items-center justify-center">
            <span className="text-3xl font-bold text-[#c44033] font-crimson">{initial}</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white font-crimson leading-tight">{name}</h1>
            <span className="mt-1 inline-block px-2.5 py-0.5 rounded-full bg-[rgba(196,64,51,0.15)] border border-[rgba(196,64,51,0.2)] text-[#e07b72] text-xs font-outfit font-medium">
              {planType}
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-3 mt-6">
          <div className="flex-1 bg-[rgba(255,255,255,0.05)] rounded-[14px] px-3 py-3 border border-[rgba(255,255,255,0.06)]">
            <p className="text-xs text-[rgba(255,255,255,0.4)] font-outfit uppercase tracking-[0.6px]">Day</p>
            <p className="text-xl font-bold text-white font-crimson mt-0.5">{day} <span className="text-xs font-normal text-[rgba(255,255,255,0.35)] font-outfit">/ 90</span></p>
          </div>
          <div className="flex-1 bg-[rgba(255,255,255,0.05)] rounded-[14px] px-3 py-3 border border-[rgba(255,255,255,0.06)]">
            <p className="text-xs text-[rgba(255,255,255,0.4)] font-outfit uppercase tracking-[0.6px] flex items-center gap-1">
              <Flame className="w-3 h-3 text-[#dc2626]" /> Streak
            </p>
            <p className="text-xl font-bold text-white font-crimson mt-0.5">{currentStreak} <span className="text-xs font-normal text-[rgba(255,255,255,0.35)] font-outfit">days</span></p>
          </div>
          <div className="flex-1 bg-[rgba(255,255,255,0.05)] rounded-[14px] px-3 py-3 border border-[rgba(255,255,255,0.06)]">
            <p className="text-xs text-[rgba(255,255,255,0.4)] font-outfit uppercase tracking-[0.6px] flex items-center gap-1">
              <Shield className="w-3 h-3 text-[#c44033]" /> Shields
            </p>
            <p className="text-xl font-bold text-white font-crimson mt-0.5">{streakData?.shields || 0}</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-6 space-y-4">

        {/* Contact info */}
        <div className="bg-white rounded-[18px] overflow-hidden border border-[#ede9e5]">
          <div className="px-4 py-3 border-b border-[#f4f2ef]">
            <p className="text-xs font-bold text-[#c44033] font-outfit uppercase tracking-[0.8px]">Account</p>
          </div>
          <div className="px-4 py-3.5 flex justify-between items-center">
            <span className="text-sm text-[#7a756d] font-outfit">Phone</span>
            <span className="text-sm font-semibold text-[#191716] font-outfit">{patient.phone || patient.phoneNumber || '—'}</span>
          </div>
          {patient.email && (
            <div className="px-4 py-3.5 border-t border-[#f4f2ef] flex justify-between items-center">
              <span className="text-sm text-[#7a756d] font-outfit">Email</span>
              <span className="text-sm font-semibold text-[#191716] font-outfit">{patient.email}</span>
            </div>
          )}
          {patient.concern && (
            <div className="px-4 py-3.5 border-t border-[#f4f2ef] flex justify-between items-center">
              <span className="text-sm text-[#7a756d] font-outfit">Concern</span>
              <span className="text-sm font-semibold text-[#191716] font-outfit">{patient.concern}</span>
            </div>
          )}
        </div>

        {/* Products */}
        {patient.products?.length > 0 && (
          <div className="bg-white rounded-[18px] overflow-hidden border border-[#ede9e5]">
            <div className="px-4 py-3 border-b border-[#f4f2ef] flex items-center gap-2">
              <ShoppingBag className="w-3.5 h-3.5 text-[#c44033]" />
              <p className="text-xs font-bold text-[#c44033] font-outfit uppercase tracking-[0.8px]">Your Products</p>
            </div>
            {patient.products.map((product, i) => (
              <div key={product.id || i} className={`px-4 py-3.5 flex justify-between items-center ${i > 0 ? 'border-t border-[#f4f2ef]' : ''}`}>
                <span className="text-sm text-[#3d3935] font-outfit">{product.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-outfit font-medium ${
                  product.category === 'AM' ? 'bg-orange-50 text-orange-600' :
                  product.category === 'PM' ? 'bg-indigo-50 text-indigo-600' :
                  'bg-purple-50 text-purple-600'
                }`}>{product.category}</span>
              </div>
            ))}
          </div>
        )}

        {/* Skin Coach */}
        {patient.coachName && (
          <div className="bg-white rounded-[18px] overflow-hidden border border-[#ede9e5]">
            <div className="px-4 py-3 border-b border-[#f4f2ef] flex items-center gap-2">
              <MessageCircle className="w-3.5 h-3.5 text-[#c44033]" />
              <p className="text-xs font-bold text-[#c44033] font-outfit uppercase tracking-[0.8px]">Skin Coach</p>
            </div>
            <div className="px-4 py-3.5 flex justify-between items-center">
              <div>
                <p className="text-sm font-semibold text-[#191716] font-outfit">{patient.coachName}</p>
                <p className="text-xs text-[#a39e95] font-outfit mt-0.5">Available on WhatsApp</p>
              </div>
              {patient.coachWhatsApp && (
                <button
                  onClick={handleWhatsApp}
                  className="w-9 h-9 rounded-[12px] bg-green-500 flex items-center justify-center shadow-sm"
                >
                  <Phone className="w-4 h-4 text-white" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Logout button */}
        <button
          onClick={() => setShowConfirm(true)}
          className="w-full flex items-center justify-between px-4 py-4 bg-white rounded-[18px] border border-[#ede9e5] group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[12px] bg-[rgba(220,38,38,0.06)] flex items-center justify-center">
              <LogOut className="w-4 h-4 text-[#dc2626]" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-[#dc2626] font-outfit">Log Out</p>
              <p className="text-xs text-[#a39e95] font-outfit mt-0.5">Your journey stays saved</p>
            </div>
          </div>
          <div className="w-4 h-4 text-[#ccc8c0]">
            <svg viewBox="0 0 16 16" fill="none" strokeWidth={2} strokeLinecap="round">
              <path d="M6 3l5 5-5 5" stroke="currentColor" />
            </svg>
          </div>
        </button>

        <p className="text-center text-xs text-[#c0bbb4] font-outfit pb-4">
          Gleuhr Skin Journal · 90-Day Programme
        </p>
      </div>

      {/* Logout confirmation bottom sheet */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowConfirm(false)}
          />

          {/* Sheet */}
          <div className="relative w-full max-w-md bg-white rounded-t-[28px] px-5 pt-6 pb-8 shadow-2xl">
            {/* Handle */}
            <div className="w-10 h-1 rounded-full bg-[#e0ddd7] mx-auto mb-6" />

            <div className="w-14 h-14 rounded-[18px] bg-[rgba(220,38,38,0.06)] flex items-center justify-center mx-auto mb-4">
              <LogOut className="w-6 h-6 text-[#dc2626]" />
            </div>

            <h2 className="text-xl font-bold text-[#191716] font-crimson text-center">Log out?</h2>
            <p className="text-sm text-[#7a756d] font-outfit text-center mt-2 leading-relaxed">
              Your streak, check-ins, and progress are safely saved.{'\n'}
              When you log back in you'll continue right where you left off.
            </p>

            <div className="flex flex-col gap-3 mt-6">
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full py-3.5 rounded-[14px] bg-[#dc2626] text-white font-semibold font-outfit text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loggingOut ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <LogOut className="w-4 h-4" />
                    Yes, log me out
                  </>
                )}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="w-full py-3.5 rounded-[14px] bg-[#f4f2ef] text-[#3d3935] font-semibold font-outfit text-sm"
              >
                Stay in
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
