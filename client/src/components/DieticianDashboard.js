import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// ── Axios helper with dietician token ──────────────────────────────────────
const api = axios.create();
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('dieticianToken');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// ── Helpers ────────────────────────────────────────────────────────────────
function safeStr(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return safeStr(v[0]);
  if (typeof v === 'object') return v.name || v.email || '';
  return '';
}

const AVATAR_COLORS = [
  '#c44033', '#d97706', '#16a34a', '#2563eb', '#7c3aed',
  '#db2777', '#0891b2', '#059669', '#ea580c', '#9333ea',
];
function getAvatarColor(name) {
  const s = String(name || '');
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function getInitials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
}

// ── Reason badge ────────────────────────────────────────────────────────────
const REASON_STYLES = {
  '7 Days Absent':         { bg: '#fef2f2', color: '#dc2626', border: '#fca5a5' },
  'On Hold':               { bg: '#fdf4ff', color: '#9333ea', border: '#d8b4fe' },
  'New Patient':           { bg: '#eff6ff', color: '#2563eb', border: '#93c5fd' },
  'Reorder Window':        { bg: '#f0fdf4', color: '#16a34a', border: '#86efac' },
  'Sunscreen Skipping':    { bg: '#fefce8', color: '#ca8a04', border: '#fde047' },
  'Diet Struggling':       { bg: '#fff7ed', color: '#ea580c', border: '#fdba74' },
  'Consistency Declining': { bg: '#f5f3ff', color: '#7c3aed', border: '#c4b5fd' },
  'Photo Missed':          { bg: '#fff7ed', color: '#c2410c', border: '#fdba74' },
  'Not in App':            { bg: '#f9fafb', color: '#6b7280', border: '#d1d5db' },
  'On Track':              { bg: '#f0fdf4', color: '#16a34a', border: '#86efac' },
  default:                 { bg: '#f9fafb', color: '#6b7280', border: '#d1d5db' },
};
function getReasonStyle(reason) {
  if (reason && reason.includes('Days Missed')) {
    return { bg: '#fff7ed', color: '#ea580c', border: '#fdba74' };
  }
  return REASON_STYLES[reason] || REASON_STYLES.default;
}

function ReasonBadge({ reason }) {
  const s = getReasonStyle(reason);
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '3px 10px',
      borderRadius: 99, background: s.bg, color: s.color,
      border: `1px solid ${s.border}`, whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {reason}
    </span>
  );
}

// ── Stat card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, color }) {
  return (
    <div style={{
      flex: '1 1 140px', background: '#fff', borderRadius: 12,
      padding: '18px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{label}</div>
    </div>
  );
}

// ── Patient card ────────────────────────────────────────────────────────────
function PatientCard({ item, onViewDetails }) {
  const { airtable, mongodb, reason, action } = item;
  const name = safeStr(mongodb?.name) || safeStr(airtable?.customerName) || '—';
  const tp = safeStr(airtable?.treatmentPlan);
  const currentDay = mongodb?.currentDay;
  const streak = mongodb?.streak?.currentStreak || 0;
  const consistency = mongodb?.consistency?.overall;
  const phone = safeStr(airtable?.customerPhone);

  const avatarColor = getAvatarColor(name);
  const initials = getInitials(name);
  const consistencyColor = consistency == null ? '#888'
    : consistency >= 70 ? '#16a34a'
    : consistency >= 50 ? '#d97706'
    : '#dc2626';

  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '13px 16px',
      marginBottom: 8, border: '1px solid #eee',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      {/* Avatar */}
      <div style={{
        width: 38, height: 38, borderRadius: 10, background: avatarColor,
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, flexShrink: 0,
      }}>
        {initials}
      </div>

      {/* Name + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>{name}</div>
        <div style={{ fontSize: 12, color: '#888', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {tp && <span>{tp}</span>}
          {currentDay != null && <span>· Day {currentDay}</span>}
          {streak > 0 && <span>· 🔥{streak}</span>}
          {consistency != null && (
            <span style={{ color: consistencyColor, fontWeight: 600 }}>
              {consistency}%
            </span>
          )}
        </div>
      </div>

      {/* Badge + action + arrow */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {reason && <ReasonBadge reason={reason} />}
        {action && (
          <span style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>
            {action}
          </span>
        )}
        {phone && (
          <button
            onClick={() => onViewDetails(phone)}
            style={{
              background: 'none', border: '1px solid #e5e7eb', borderRadius: 8,
              cursor: 'pointer', color: '#888', fontSize: 14, padding: '4px 8px',
              lineHeight: 1,
            }}
          >
            →
          </button>
        )}
      </div>
    </div>
  );
}

// ── Queue section ────────────────────────────────────────────────────────────
function Section({ icon, label, items, onViewDetails }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#555', letterSpacing: '0.05em' }}>
          {label}
        </span>
      </div>
      {items.map((item, i) => (
        <PatientCard key={item.airtable?.id || i} item={item} onViewDetails={onViewDetails} />
      ))}
    </div>
  );
}

// ── Consistency bar (modal) ─────────────────────────────────────────────────
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Patient Details</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888' }}>×</button>
        </div>

        {loading && <div style={{ textAlign: 'center', color: '#888', padding: 32 }}>Loading...</div>}
        {error && <div style={{ color: '#dc2626', padding: 16 }}>{error}</div>}

        {data && (
          <>
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

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
              {[
                { label: 'Streak',      value: `🔥 ${data.streak.currentStreak}`, color: '#ea580c' },
                { label: 'Points',      value: `⭐ ${data.patient.totalPoints}`,  color: '#eab308' },
                { label: 'Consistency', value: `${data.consistency.overall}%`,    color: '#16a34a' },
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

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Consistency (all-time)</div>
              <ConsistencyBar label="Overall Check-in" value={data.consistency.overall} />
              <ConsistencyBar label="Sunscreen" value={data.consistency.sunscreen} />
              <ConsistencyBar label="Diet" value={data.consistency.diet} />
            </div>

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

            {data.dietPlan?.products && data.dietPlan.products.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Products</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {data.dietPlan.products.map((p, i) => (
                    <span key={i} style={{
                      fontSize: 12, padding: '4px 12px', borderRadius: 99,
                      background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb',
                    }}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

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
  const [activeTab, setActiveTab] = useState('queue');

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
      <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
      <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#dc2626', marginBottom: 12 }}>{error}</div>
          <button onClick={fetchDashboard} style={{ padding: '8px 20px', background: '#c44033', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { greeting, stats, queue, allPatients, totalCount, onboardingCount } = dashData || {};

  // Build map: airtable.id → {reason, action} from queue sections
  const queueStatusMap = {};
  if (queue) {
    for (const cat of ['urgent', 'flagged', 'scheduledCalls', 'reorder', 'airtableOnly']) {
      for (const item of (queue[cat] || [])) {
        if (item.airtable?.id) queueStatusMap[item.airtable.id] = { reason: item.reason, action: item.action };
      }
    }
  }

  const onboardingPatients = (allPatients || []).filter(
    item => !item.mongodb || item.mongodb.currentDay <= 7
  );

  const queueCount = [
    ...(queue?.urgent || []),
    ...(queue?.flagged || []),
    ...(queue?.scheduledCalls || []),
    ...(queue?.reorder || []),
  ].length;

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const TABS = [
    { id: 'queue',      label: "Today's Queue", count: queueCount,                               icon: '📋' },
    { id: 'all',        label: 'All Patients',  count: totalCount || 0,                          icon: null },
    { id: 'onboarding', label: 'Onboarding',    count: onboardingCount ?? onboardingPatients.length, icon: null },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>

      {/* Dark header */}
      <div style={{
        background: '#1a1a2e', color: '#fff', padding: '16px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>
            {greeting || `Good morning, ${name.split(' ')[0]}!`}
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
            {dateStr} · {totalCount || 0} active patients
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            padding: '7px 18px', fontSize: 13, fontWeight: 500,
            background: 'rgba(255,255,255,0.1)', color: '#fff',
            border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, cursor: 'pointer',
          }}
        >
          Logout
        </button>
      </div>

      <div style={{ padding: '24px 28px 48px', maxWidth: 900, margin: '0 auto' }}>

        {/* Stat cards */}
        {stats && (
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 28 }}>
            <StatCard label="Need Attention"   value={stats.needAttention}          color="#dc2626" />
            <StatCard label="Calls Today"      value={stats.callsToday}             color="#d97706" />
            <StatCard label="Avg Consistency"  value={`${stats.avgConsistency}%`}   color="#16a34a" />
            <StatCard label="Reorder Due"      value={stats.reorderDue}             color="#2563eb" />
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid #e5e7eb' }}>
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '8px 18px 10px', border: 'none', background: 'transparent',
                  cursor: 'pointer', fontSize: 14, fontWeight: active ? 700 : 400,
                  color: active ? '#1a1a1a' : '#888',
                  borderBottom: active ? '2px solid #1a1a2e' : '2px solid transparent',
                  marginBottom: -1, whiteSpace: 'nowrap',
                }}
              >
                {tab.icon ? `${tab.icon} ` : ''}{tab.label}
                <span style={{
                  marginLeft: 6, fontSize: 12, fontWeight: 600,
                  background: active ? '#1a1a2e' : '#e5e7eb',
                  color: active ? '#fff' : '#555',
                  padding: '1px 7px', borderRadius: 99,
                }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* TODAY'S QUEUE */}
        {activeTab === 'queue' && queue && (
          <>
            <Section icon="🔴" label="URGENT — IMMEDIATE ACTION"   items={queue.urgent}        onViewDetails={setSelectedPhone} />
            <Section icon="🟡" label="FLAGGED — ADDRESS THIS WEEK" items={queue.flagged}        onViewDetails={setSelectedPhone} />
            <Section icon="📞" label="SCHEDULED CALLS"             items={queue.scheduledCalls} onViewDetails={setSelectedPhone} />
            <Section icon="✅" label="REORDER CONVERSATIONS"        items={queue.reorder}        onViewDetails={setSelectedPhone} />
            <Section icon="⚪" label="NOT IN APP"                   items={queue.airtableOnly}   onViewDetails={setSelectedPhone} />
            {queueCount === 0 && (queue.airtableOnly || []).length === 0 && (
              <div style={{ textAlign: 'center', padding: 48, color: '#888' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>All caught up!</div>
                <div style={{ fontSize: 13, marginTop: 6 }}>No patients need attention right now.</div>
              </div>
            )}
          </>
        )}

        {/* ALL PATIENTS */}
        {activeTab === 'all' && (
          <>
            {(allPatients || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: '#888' }}>No patients found.</div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: '#aaa', marginBottom: 14 }}>
                  All {(allPatients || []).length} patients assigned to you
                </div>
                {(allPatients || [])
                  .slice()
                  .sort((a, b) => {
                    const na = safeStr(a.mongodb?.name) || safeStr(a.airtable?.customerName);
                    const nb = safeStr(b.mongodb?.name) || safeStr(b.airtable?.customerName);
                    return na.localeCompare(nb);
                  })
                  .map((item, i) => {
                    const status = queueStatusMap[item.airtable?.id] || { reason: 'On Track', action: '' };
                    return (
                      <PatientCard
                        key={item.airtable?.id || i}
                        item={{ ...item, ...status }}
                        onViewDetails={setSelectedPhone}
                      />
                    );
                  })}
              </>
            )}
          </>
        )}

        {/* ONBOARDING */}
        {activeTab === 'onboarding' && (
          <>
            {onboardingPatients.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: '#888' }}>No patients onboarding right now.</div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: '#aaa', marginBottom: 14 }}>
                  Patients in their first week or not yet in the app
                </div>
                {onboardingPatients.map((item, i) => {
                  const isNew = item.mongodb && item.mongodb.currentDay <= 7;
                  return (
                    <PatientCard
                      key={item.airtable?.id || i}
                      item={{
                        ...item,
                        reason: isNew ? 'New Patient' : 'Not in App',
                        action: isNew ? 'Welcome call' : 'Verify registration',
                      }}
                      onViewDetails={setSelectedPhone}
                    />
                  );
                })}
              </>
            )}
          </>
        )}
      </div>

      {selectedPhone && (
        <PatientDetailModal phone={selectedPhone} onClose={() => setSelectedPhone(null)} />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
