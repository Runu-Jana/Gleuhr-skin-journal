import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Phone, User, Utensils, Filter, RefreshCw, ArrowLeft,
  Flame, Calendar, Activity, Droplets, Moon, Zap, Star, TrendingUp
} from 'lucide-react';
import axios from 'axios';

export default function AdminDietDashboard() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPhone, setSelectedPhone] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Fetch all patients from MongoDB
  const fetchPatients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get('/api/admin/patients');
      setPatients(data.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load patients');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // Fetch full details (patient + Airtable diet plan + streak + check-ins + skin scores)
  const openPatientDetails = async (phone) => {
    setSelectedPhone(phone);
    setDetailsLoading(true);
    setDetails(null);
    try {
      const { data } = await axios.get(`/api/admin/patients/${encodeURIComponent(phone)}/details`);
      setDetails(data.data);
    } catch (err) {
      setDetails(null);
      setError(err.response?.data?.error || 'Failed to load patient details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const filtered = patients.filter((p) => {
    const term = searchTerm.toLowerCase();
    return (
      (p.name || '').toLowerCase().includes(term) ||
      (p.phone || '').includes(term) ||
      (p.skinConcern || '').toLowerCase().includes(term)
    );
  });

  // ─── DETAIL VIEW ──────────────────────────────────────────────
  if (selectedPhone) {
    return (
      <div className="max-w-3xl mx-auto p-4">
        <button
          onClick={() => { setSelectedPhone(null); setDetails(null); }}
          className="flex items-center gap-1 text-[#c44033] mb-4 font-medium"
        >
          <ArrowLeft size={18} /> Back to patients
        </button>

        {detailsLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-[#c44033] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !details ? (
          <div className="text-center py-16 text-gray-400">
            <p>Could not load details</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Patient Profile Card */}
            <div className="bg-white rounded-2xl shadow p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{details.patient.name}</h2>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <Phone size={14} /> {details.patient.phone}
                  </p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  details.patient.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {details.patient.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <StatBox icon={<Calendar size={16} />} label="Day" value={details.patient.currentDay} sub="of 90" />
                <StatBox icon={<TrendingUp size={16} />} label="Progress" value={`${details.patient.completionPercentage}%`} />
                <StatBox icon={<Star size={16} />} label="Points" value={details.patient.totalPoints} />
                <StatBox icon={<Zap size={16} />} label="Level" value={details.patient.level} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Skin Concern</p>
                  <p className="font-medium">{details.patient.skinConcern || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Plan Type</p>
                  <p className="font-medium">{details.patient.planType}</p>
                </div>
                <div>
                  <p className="text-gray-500">Coach</p>
                  <p className="font-medium">{details.patient.coachName || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Start Date</p>
                  <p className="font-medium">{details.patient.startDate ? new Date(details.patient.startDate).toLocaleDateString() : '—'}</p>
                </div>
              </div>
            </div>

            {/* Streak Card */}
            <div className="bg-white rounded-2xl shadow p-6">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Flame size={18} className="text-orange-500" /> Streak
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <StatBox icon={<Flame size={16} />} label="Current" value={details.streak.currentStreak} sub="days" color="text-orange-500" />
                <StatBox icon={<TrendingUp size={16} />} label="Longest" value={details.streak.longestStreak} sub="days" color="text-blue-500" />
                <StatBox icon={<Calendar size={16} />} label="Total Check-ins" value={details.streak.totalCheckIns} />
                <StatBox icon={<Calendar size={16} />} label="Last Check-in" value={details.streak.lastCheckIn ? new Date(details.streak.lastCheckIn).toLocaleDateString() : '—'} small />
              </div>
            </div>

            {/* Airtable Diet Plan Card */}
            <div className="bg-white rounded-2xl shadow p-6">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Utensils size={18} className="text-[#c44033]" /> Diet Plan
                <span className="text-xs text-gray-400 font-normal">(from Airtable)</span>
              </h3>

              {details.dietPlan ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">Category</p>
                      <p className="font-medium">{details.dietPlan.planCategory || '—'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Status</p>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                        details.dietPlan.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {details.dietPlan.status}
                      </span>
                    </div>
                    <div>
                      <p className="text-gray-500">Dietician</p>
                      <p className="font-medium">{details.dietPlan.dieticianName || '—'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Dietician Phone</p>
                      <p className="font-medium">{details.dietPlan.dieticianPhone || '—'}</p>
                    </div>
                  </div>

                  {/* Restrictions */}
                  <div>
                    <p className="text-gray-500 text-sm mb-1">Restrictions</p>
                    {Array.isArray(details.dietPlan.restrictions) && details.dietPlan.restrictions.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {details.dietPlan.restrictions.map((r, i) => (
                          <span key={i} className="bg-red-50 text-red-600 text-xs px-2 py-1 rounded-full">{r}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-xs">None</p>
                    )}
                  </div>

                  {/* Recommendations */}
                  <div>
                    <p className="text-gray-500 text-sm mb-1">Recommendations</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">
                      {details.dietPlan.recommendations || '—'}
                    </p>
                  </div>

                  {details.dietPlan.notes && (
                    <div>
                      <p className="text-gray-500 text-sm mb-1">Notes</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{details.dietPlan.notes}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-400 text-sm py-4 text-center">No diet plan found in Airtable for this phone number</p>
              )}
            </div>

            {/* Recent Skin Scores */}
            <div className="bg-white rounded-2xl shadow p-6">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Activity size={18} className="text-purple-500" /> Skin Scores
              </h3>
              {details.skinScores.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {details.skinScores.map((s) => (
                    <div key={s.id} className="flex items-center justify-between border-b pb-2 text-sm">
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500">{s.date ? new Date(s.date).toLocaleDateString() : '—'}</span>
                        <span className="text-gray-400 text-xs">Day {s.day}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold ${s.totalScore >= 70 ? 'text-green-600' : s.totalScore >= 40 ? 'text-yellow-600' : 'text-red-500'}`}>
                          {s.totalScore}
                        </span>
                        <span className="text-xs text-gray-400">/100</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm py-4 text-center">No skin scores recorded yet</p>
              )}
            </div>

            {/* Recent Check-ins */}
            <div className="bg-white rounded-2xl shadow p-6">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Calendar size={18} className="text-blue-500" /> Recent Check-ins
              </h3>
              {details.checkIns.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {details.checkIns.map((c) => (
                    <div key={c.id} className="border-b pb-2 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-gray-600 font-medium">
                          {c.date ? new Date(c.date).toLocaleDateString() : '—'}
                          <span className="text-gray-400 text-xs ml-2">Day {c.dayOfJourney}</span>
                        </span>
                        {c.completed && (
                          <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">Done</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        {c.mood && <span className="flex items-center gap-1"><Star size={12} /> {c.mood}</span>}
                        {c.energy && <span className="flex items-center gap-1"><Zap size={12} /> {c.energy}</span>}
                        {c.sleep && <span className="flex items-center gap-1"><Moon size={12} /> {c.sleep}</span>}
                        {c.waterIntake && <span className="flex items-center gap-1"><Droplets size={12} /> {c.waterIntake}</span>}
                        {c.skinScore != null && <span className="flex items-center gap-1"><Activity size={12} /> Score: {c.skinScore}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm py-4 text-center">No check-ins recorded yet</p>
              )}
            </div>

            {/* Products */}
            {details.patient.products && details.patient.products.length > 0 && (
              <div className="bg-white rounded-2xl shadow p-6">
                <h3 className="font-semibold text-gray-800 mb-3">Products</h3>
                <div className="space-y-2">
                  {details.patient.products.map((pr) => (
                    <div key={pr.id} className="flex items-center justify-between text-sm border-b pb-2">
                      <div>
                        <p className="font-medium">{pr.name}</p>
                        <p className="text-gray-400 text-xs">{pr.instructions}</p>
                      </div>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{pr.category}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── PATIENT LIST VIEW ────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <User size={24} className="text-[#c44033]" />
          Admin Dashboard
        </h1>
        <button
          onClick={fetchPatients}
          disabled={loading}
          className="flex items-center gap-1 text-sm text-[#c44033] font-medium disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, phone, or skin concern..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#c44033]/30"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-[#c44033] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <User size={40} className="mx-auto mb-2 opacity-50" />
          <p>No patients found</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((p) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl shadow-sm border p-4 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => openPatientDetails(p.phone)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{p.name}</h3>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <Phone size={14} /> {p.phone}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                    Day {p.currentDay}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {p.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-4 text-sm text-gray-600">
                {p.skinConcern && (
                  <span className="flex items-center gap-1">
                    <Activity size={14} /> {p.skinConcern}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Star size={14} /> {p.planType}
                </span>
                <span className="flex items-center gap-1">
                  <TrendingUp size={14} /> {p.completionPercentage}%
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// Small stat box component
function StatBox({ icon, label, value, sub, color, small }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <div className={`flex items-center justify-center mb-1 ${color || 'text-gray-500'}`}>
        {icon}
      </div>
      <p className={`font-bold ${small ? 'text-xs' : 'text-lg'} text-gray-900`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}
