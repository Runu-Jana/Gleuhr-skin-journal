import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, Phone, User, Utensils, Filter, RefreshCw, ArrowLeft } from 'lucide-react';
import axios from 'axios';

export default function AdminDietDashboard() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedPlan, setSelectedPlan] = useState(null);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const { data } = await axios.get('/api/admin/diet-plans', { params });
      setPlans(data.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load diet plans');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const filtered = plans.filter((p) => {
    const term = searchTerm.toLowerCase();
    return (
      p.customerName.toLowerCase().includes(term) ||
      p.customerPhone.includes(term) ||
      p.dieticianName.toLowerCase().includes(term)
    );
  });

  // Detail view
  if (selectedPlan) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <button
          onClick={() => setSelectedPlan(null)}
          className="flex items-center gap-1 text-[#c44033] mb-4 font-medium"
        >
          <ArrowLeft size={18} /> Back to list
        </button>

        <div className="bg-white rounded-2xl shadow p-6 space-y-4">
          <h2 className="text-xl font-bold text-gray-900">{selectedPlan.customerName}</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Customer Phone</p>
              <p className="font-medium">{selectedPlan.customerPhone}</p>
            </div>
            <div>
              <p className="text-gray-500">Plan Category</p>
              <p className="font-medium">{selectedPlan.planCategory}</p>
            </div>
            <div>
              <p className="text-gray-500">Status</p>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                selectedPlan.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {selectedPlan.status}
              </span>
            </div>
            <div>
              <p className="text-gray-500">Start Date</p>
              <p className="font-medium">{selectedPlan.startDate || '—'}</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold text-gray-800 mb-1">Assigned Dietician</h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#c44033]/10 flex items-center justify-center">
                <User size={18} className="text-[#c44033]" />
              </div>
              <div>
                <p className="font-medium">{selectedPlan.dieticianName || '—'}</p>
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <Phone size={14} /> {selectedPlan.dieticianPhone || '—'}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold text-gray-800 mb-1">Restrictions</h3>
            {Array.isArray(selectedPlan.restrictions) && selectedPlan.restrictions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selectedPlan.restrictions.map((r, i) => (
                  <span key={i} className="bg-red-50 text-red-600 text-xs px-2 py-1 rounded-full">{r}</span>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">None</p>
            )}
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold text-gray-800 mb-1">Recommendations</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedPlan.recommendations || '—'}</p>
          </div>

          {selectedPlan.notes && (
            <div className="border-t pt-4">
              <h3 className="font-semibold text-gray-800 mb-1">Notes</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedPlan.notes}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Utensils size={24} className="text-[#c44033]" />
          Diet Plans
        </h1>
        <button
          onClick={fetchPlans}
          disabled={loading}
          className="flex items-center gap-1 text-sm text-[#c44033] font-medium disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, phone, or dietician..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#c44033]/30"
          />
        </div>
        <div className="relative">
          <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-9 pr-8 py-2 border rounded-lg text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-[#c44033]/30"
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
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
          <Utensils size={40} className="mx-auto mb-2 opacity-50" />
          <p>No diet plans found</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((plan) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl shadow-sm border p-4 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedPlan(plan)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{plan.customerName}</h3>
                  <p className="text-sm text-gray-500">{plan.customerPhone}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  plan.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {plan.status}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Utensils size={14} /> {plan.planCategory || '—'}
                </span>
                <span className="flex items-center gap-1">
                  <User size={14} /> {plan.dieticianName || 'Unassigned'}
                </span>
                <span className="flex items-center gap-1">
                  <Phone size={14} /> {plan.dieticianPhone || '—'}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
