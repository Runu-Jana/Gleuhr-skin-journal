import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// ── Axios helper with dietician token ──────────────────────────────────────
const api = axios.create();
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('dieticianToken');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// ── Reason badge color map ─────────────────────────────────────────────────
const REASON_STYLES = {
  '7 Days Absent':       { bg: '#fef2f2', color: '#dc2626', border: '#fca5a5' },
  'absent':              { bg: '#fef2f2', color: '#dc2626', border: '#fca5a5' },
  'missed':              { bg: '#fff7ed', color: '#ea580c', border: '#fdba74' },
  'new':                 { bg: '#eff6ff', color: '#2563eb', border: '#93c5fd' },
  'New Patient':         { bg: '#eff6ff', color: '#2563eb', border: '#93c5fd' },
  'reorder':             { bg: '#f0fdf4', color: '#16a34a', border: '#86efac' },
  'Reorder Window':      { bg: '#f0fdf4', color: '#16a34a', border: '#86efac' },
  'sunscreen':           { bg: '#fefce8', color: '#ca8a04', border: '#fde047' },
  'Sunscreen Skipping':  { bg: '#fefce8', color: '#ca8a04', border: '#fde047' },
  'diet':                { bg: '#fff7ed', color: '#c2410c', border: '#fdba74' },
  'Diet Struggling':     { bg: '#fff7ed', color: '#c2410c', border: '#fdba74' },
  'consistency':         { bg: '#f5f3ff', color: '#7c3aed', border: '#c4b5fd' },
  'Consistency Declining': { bg: '#f5f3ff', color: '#7c3aed', border: '#c4b5fd' },
  'Not in App':          { bg: '#f9fafb', color: '#6b7280', border: '#d1d5db' },
  default:               { bg: '#f9fafb', color: '#6b7280', border: '#d1d5db' },
};

function ReasonBadge({ reason }) {
  const s = REASON_STYLES[reason] || REASON_STYLES.default;
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '3px 8px',
      borderRadius: 99, background: s.bg, color: s.color,
      border: `1px solid ${s.border}`, whiteSpace: 'nowrap',
    }}>
      {reason}
    </span>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{
      flex: '1 1 140px', background: '#fff', borderRadius: 12,
      padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function ConsistencyBar({ label, value }) {
  const color = value >= 75 ? '#16a34a' : value >= 50 ? '#ca8a04' : '#dc2626';
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#666', marginBottom: 3 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600, color }}>{value}%</span>
      </div>
      <div style={{ background: '#f0f0f0', borderRadius: 99, height: 5, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, background: color, height: '100%', borderRadius: 99, transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

function safeStr(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return safeStr(v[0]);
  if (typeof v === 'object') return v.name || v.email || '';
  return '';
}

function PatientCard({ item, onViewDetails }) {
  const { airtable, mongodb, reason, action } = item;
  const name = safeStr(mongodb?.name) || safeStr(airtable?.customerName) || '—';
  const phone = safeStr(airtable?.customerPhone) || '—';
  const currentDay = mongodb?.currentDay;
  const streak = mongodb?.streak?.currentStreak || 0;
  const consistency = mongodb?.consistency;
  const callStatus = safeStr(airtable?.dieticianCallStatus);
  const planStatus = safeStr(airtable?.dietPlanStatus);

  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '16px 18px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 10,
      border: '1px solid #f0f0f0',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        {/* Left: name + badges */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>{name}</span>
            <ReasonBadge reason={reason} />
          </div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
            {phone}{currentDay ? ` · Day ${currentDay}` : ''}{streak ? ` · 🔥 ${streak} streak` : ''}
          </div>

          {/* Airtable statuses */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: consistency ? 10 : 0 }}>
            {callStatus && (
              <span style={{
                fontSize: 10, padding: '2px 7px', borderRadius: 99,
                background: callStatus === 'Call Done' ? '#f0fdf4' : '#fef9c3',
                color: callStatus === 'Call Done' ? '#16a34a' : '#92400e',
              }}>
                {callStatus}
              </span>
            )}
            {planStatus && (
              <span style={{
                fontSize: 10, padding: '2px 7px', borderRadius: 99,
                background: planStatus === 'Diet Plan Shared' ? '#eff6ff' : '#f9fafb',
                color: planStatus === 'Diet Plan Shared' ? '#2563eb' : '#6b7280',
              }}>
                {planStatus}
              </span>
            )}
            {airtable?.treatmentPlan && (
              <span style={{ fontSize: 10, color: '#aaa' }}>{airtable.treatmentPlan}</span>
            )}
          </div>

          {/* Consistency bars (only if MongoDB data exists) */}
          {consistency && (
            <div style={{ marginTop: 8 }}>
              <ConsistencyBar label="Overall" value={consistency.overall} />
              <ConsistencyBar label="Sunscreen" value={consistency.sunscreen} />
              <ConsistencyBar label="Diet" value={consistency.diet} />
            </div>
          )}
        </div>

        {/* Right: action button */}
        {mongodb && (
          <button
            onClick={() => onViewDetails(phone)}
            style={{
              flexShrink: 0, padding: '7px 14px', fontSize: 12, fontWeight: 600,
              background: '#c44033', color: '#fff', border: 'none', borderRadius: 8,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            View Details
          </button>
        )}
      </div>

      {action && (
        <div style={{ fontSize: 11, color: '#888', marginTop: 8, borderTop: '1px solid #f5f5f5', paddingTop: 8 }}>
          Action: <span style={{ fontWeight: 600, color: '#555' }}>{action}</span>
        </div>
      )}
    </div>
  );
}

function QueueSection({ title, items, onViewDetails, color, collapsed: initCollapsed = false }) {
  const [collapsed, setCollapsed] = useState(initCollapsed);
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: 24 }}>
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '0 0 10px 0', width: '100%', textAlign: 'left',
        }}
      >
        <span style={{
          width: 10, height: 10, borderRadius: '50%',
          background: color, display: 'inline-block', flexShrink: 0,
        }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', flex: 1 }}>
          {title}
        </span>
        <span style={{
          fontSize: 12, fontWeight: 600, padding: '2px 9px', borderRadius: 99,
          background: '#f5f5f5', color: '#555',
        }}>
          {items.length}
        </span>
        <span style={{ fontSize: 16, color: '#aaa', marginLeft: 4 }}>
          {collapsed ? '▶' : '▼'}
        </span>
      </button>

      {!collapsed && items.map((item, i) => (
        <PatientCard key={item.airtable?.id || i} item={item} onViewDetails={onViewDetails} />
      ))}
    </div>
  );
}

// ── Patient Detail Modal ────────────────────────────────────────────────────
function PatientDetailModal({ phone, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/api/dietician/patient/${encodeURIComponent(phone)}/details`)
      .then(res => setData(res.data.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [phone]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560,
        maxHeight: '90vh', overflowY: 'auto', padding: 28,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        {/* Close */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Patient Details</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888' }}>×</button>
        </div>

        {loading && <div style={{ textAlign: 'center', color: '#888', padding: 32 }}>Loading...</div>}
        {error && <div style={{ color: '#dc2626', padding: 16 }}>{error}</div>}

        {data && (
          <>
            {/* Patient header */}
            <div style={{ background: '#faf8f5', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{data.patient.name}</div>
              <div style={{ fontSize: 13, color: '#888' }}>
                {data.patient.phone} · Day {data.patient.currentDay} of 90
              </div>
              {data.patient.skinConcern && (
                <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
                  Concern: {data.patient.skinConcern}
                </div>
              )}
            </div>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
              {[
                { label: 'Streak', value: `🔥 ${data.streak.currentStreak}`, color: '#ea580c' },
                { label: 'Points', value: `⭐ ${data.patient.totalPoints}`, color: '#eab308' },
                { label: 'Consistency', value: `${data.consistency.overall}%`, color: '#16a34a' },
              ].map(s => (
                <div key={s.label} style={{
                  flex: '1 1 100px', background: '#f9fafb', borderRadius: 10,
                  padding: '12px 14px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Consistency details */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Consistency (all-time)</div>
              <ConsistencyBar label="Overall Check-in" value={data.consistency.overall} />
              <ConsistencyBar label="Sunscreen" value={data.consistency.sunscreen} />
              <ConsistencyBar label="Diet" value={data.consistency.diet} />
            </div>

            {/* Airtable diet plan */}
            {data.dietPlan && (
              <div style={{ background: '#eff6ff', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#2563eb', marginBottom: 6 }}>Diet Plan (Airtable)</div>
                <div style={{ fontSize: 13 }}>
                  <div>Call Status: <strong>{safeStr(data.dietPlan.dieticianCallStatus) || '—'}</strong></div>
                  <div>Plan Status: <strong>{safeStr(data.dietPlan.dietPlanStatus) || '—'}</strong></div>
                  {data.dietPlan.dietPlanDate && <div>Plan Date: <strong>{data.dietPlan.dietPlanDate}</strong></div>}
                </div>
              </div>
            )}

            {/* Weekly grid */}
            {data.weekGrid && data.weekGrid.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>This Week</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {data.weekGrid.map((day, i) => (
                    <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#aaa', marginBottom: 4 }}>{day.dayLabel}</div>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', margin: '0 auto',
                        background: day.isFuture ? '#f3f4f6' : day.amCompleted ? '#c44033' : '#e5e7eb',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, color: day.amCompleted ? '#fff' : '#9ca3af',
                      }}>
                        {!day.isFuture && (day.amCompleted ? '✓' : '—')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Products */}
            {data.patient.products && data.patient.products.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Products</div>
                {data.patient.products.map((p, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13,
                  }}>
                    <span>{p.name}</span>
                    <span style={{
                      fontSize: 10, padding: '2px 7px', borderRadius: 99,
                      background: p.category === 'AM' ? '#fef9c3' : p.category === 'PM' ? '#ede9fe' : '#f0fdf4',
                      color: p.category === 'AM' ? '#92400e' : p.category === 'PM' ? '#6d28d9' : '#16a34a',
                    }}>
                      {p.category}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Reorder info */}
            {data.reorder?.planEndDate && (
              <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '12px 16px', fontSize: 13 }}>
                Plan ends: <strong>{data.reorder.planEndDate}</strong>
                {data.reorder.daysRemaining > 0 && (
                  <span style={{ color: '#888', marginLeft: 8 }}>({data.reorder.daysRemaining} days left)</span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────────────
export default function DieticianDashboard() {
  const [dashData, setDashData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPhone, setSelectedPhone] = useState(null);

  const name = localStorage.getItem('dieticianName') || 'Dietician';

  const fetchDashboard = useCallback(() => {
    setLoading(true);
    api.get('/api/dietician/dashboard')
      .then(res => setDashData(res.data.data))
      .catch(err => {
        if (err.response?.status === 401) {
          localStorage.removeItem('dieticianToken');
          localStorage.removeItem('dieticianName');
          window.location.replace('/dietician/login');
        }
        setError(err.response?.data?.error || 'Failed to load dashboard');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const handleLogout = () => {
    localStorage.removeItem('dieticianToken');
    localStorage.removeItem('dieticianName');
    window.location.replace('/dietician/login');
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#888' }}>
          <div style={{
            width: 36, height: 36, border: '3px solid #c44033', borderTopColor: 'transparent',
            borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
          }} />
          Loading your dashboard…
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#dc2626', marginBottom: 12 }}>{error}</div>
          <button onClick={fetchDashboard} style={{ padding: '8px 20px', background: '#c44033', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { greeting, stats, queue } = dashData || {};

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      {/* Header */}
      <div style={{
        background: '#1a1a2e', color: '#fff', padding: '16px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{greeting || `Hello, ${name}`}</div>
          <div style={{ fontSize: 12, color: '#aab', marginTop: 2 }}>Dietician Dashboard</div>
        </div>
        <button
          onClick={handleLogout}
          style={{ padding: '7px 16px', fontSize: 13, background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, cursor: 'pointer' }}
        >
          Logout
        </button>
      </div>

      <div style={{ padding: '20px 20px 40px', maxWidth: 680, margin: '0 auto' }}>
        {/* Stats */}
        {stats && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
            <StatCard label="Need Attention" value={stats.needAttention} color="#dc2626" />
            <StatCard label="Calls Today" value={stats.callsToday} color="#2563eb" />
            <StatCard label="Avg Consistency" value={`${stats.avgConsistency}%`} color="#16a34a" />
            <StatCard label="Reorder Due" value={stats.reorderDue} color="#ca8a04" />
          </div>
        )}

        {/* Queue sections */}
        {queue && (
          <>
            <QueueSection
              title="Urgent — Call Required"
              items={queue.urgent}
              onViewDetails={setSelectedPhone}
              color="#dc2626"
            />
            <QueueSection
              title="Scheduled Calls"
              items={queue.scheduledCalls}
              onViewDetails={setSelectedPhone}
              color="#2563eb"
            />
            <QueueSection
              title="Reorder Conversations"
              items={queue.reorder}
              onViewDetails={setSelectedPhone}
              color="#16a34a"
            />
            <QueueSection
              title="Flagged — Consistency Issues"
              items={queue.flagged}
              onViewDetails={setSelectedPhone}
              color="#ca8a04"
            />
            <QueueSection
              title="Airtable Only (Not in App)"
              items={queue.airtableOnly}
              onViewDetails={setSelectedPhone}
              color="#9ca3af"
              collapsed
            />
          </>
        )}

        {dashData && queue && Object.values(queue).every(q => q.length === 0) && (
          <div style={{ textAlign: 'center', padding: 48, color: '#888' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>All caught up!</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>No patients need attention right now.</div>
          </div>
        )}
      </div>

      {/* Patient detail modal */}
      {selectedPhone && (
        <PatientDetailModal phone={selectedPhone} onClose={() => setSelectedPhone(null)} />
      )}
    </div>
  );
}
