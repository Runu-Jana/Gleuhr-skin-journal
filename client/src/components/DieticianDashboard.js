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

// ── Stat card (right panel) ─────────────────────────────────────────────────
function StatCard({ label, value, color }) {
  return (
    <div style={{
      flex: '1 1 120px', background: '#fff', borderRadius: 12,
      padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{label}</div>
    </div>
  );
}

// ── Left panel patient card (dark theme) ────────────────────────────────────
function PatientCardLeft({ item, isSelected, onClick }) {
  const { airtable, mongodb, reason } = item;
  const name    = safeStr(mongodb?.name) || safeStr(airtable?.customerName) || '—';
  const currentDay   = mongodb?.currentDay;
  const consistency  = mongodb?.consistency?.overall;
  const avatarColor  = getAvatarColor(name);
  const initials     = getInitials(name);

  const consistencyColor = consistency == null
    ? 'rgba(255,255,255,0.4)'
    : consistency >= 70 ? '#4ade80'
    : consistency >= 50 ? '#fbbf24'
    : '#f87171';

  return (
    <div
      onClick={onClick}
      style={{
        padding: '11px 14px',
        borderRadius: 10,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        marginBottom: 3,
        background: isSelected ? 'rgba(196,64,51,0.22)' : 'rgba(255,255,255,0.05)',
        borderLeft: `3px solid ${isSelected ? '#c44033' : 'transparent'}`,
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
    >
      {/* Avatar */}
      <div style={{
        width: 34, height: 34, borderRadius: 9, background: avatarColor,
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, flexShrink: 0,
      }}>
        {initials}
      </div>

      {/* Name + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: '#fff',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {name}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2, display: 'flex', gap: 6 }}>
          {currentDay != null && <span>Day {currentDay}</span>}
          {consistency != null && (
            <span style={{ color: consistencyColor, fontWeight: 600 }}>{consistency}%</span>
          )}
        </div>
      </div>

      {/* Reason dot / mini badge */}
      {reason && (
        <div style={{
          fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99,
          background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.65)',
          flexShrink: 0, maxWidth: 76, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {reason}
        </div>
      )}
    </div>
  );
}

// ── Left panel section ────────────────────────────────────────────────────
function SectionLeft({ icon, label, items, selectedPhone, onSelect }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)',
        letterSpacing: '0.08em', marginBottom: 8, paddingLeft: 4,
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      {items.map((item, i) => (
        <PatientCardLeft
          key={item.airtable?.id || i}
          item={item}
          isSelected={selectedPhone === safeStr(item.airtable?.customerPhone)}
          onClick={() => onSelect(safeStr(item.airtable?.customerPhone))}
        />
      ))}
    </div>
  );
}

// ── Consistency bar (right panel detail) ────────────────────────────────────
function ConsistencyBar({ label, value }) {
  const color = value >= 75 ? '#16a34a' : value >= 50 ? '#ca8a04' : '#dc2626';
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600, color }}>{value}%</span>
      </div>
      <div style={{ background: '#f0f0f0', borderRadius: 99, height: 6, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, background: color, height: '100%', borderRadius: 99, transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

// ── Right panel: patient detail (inline, no modal) ──────────────────────────
function PatientDetailPanel({ phone }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    setData(null);
    setLoading(true);
    setError('');
    api.get(`/api/dietician/patient/${encodeURIComponent(phone)}/details`)
      .then(res => setData(res.data.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [phone]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#aaa' }}>
        <div>
          <div style={{ width: 28, height: 28, border: '3px solid #c44033', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
          Loading patient…
        </div>
      </div>
    );
  }

  if (error) {
    return <div style={{ color: '#dc2626', padding: 20 }}>{error}</div>;
  }

  if (!data) return null;

  return (
    <div style={{ maxWidth: 680 }}>

      {/* Patient header card */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, background: getAvatarColor(data.patient.name),
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 700, flexShrink: 0,
          }}>
            {getInitials(data.patient.name)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a' }}>{data.patient.name}</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>
              {data.patient.phone} · Day {data.patient.currentDay} of 90
            </div>
            {data.patient.skinConcern && (
              <div style={{ fontSize: 12, color: '#aaa', marginTop: 3 }}>
                {data.patient.skinConcern}
              </div>
            )}
          </div>
          {data.dietPlan && (
            <div style={{ textAlign: 'right' }}>
              {data.dietPlan.dieticianCallStatus && (
                <ReasonBadge reason={data.dietPlan.dieticianCallStatus} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Streak',      value: `🔥 ${data.streak.currentStreak}`, color: '#ea580c' },
          { label: 'Points',      value: `⭐ ${data.patient.totalPoints}`,  color: '#eab308' },
          { label: 'Consistency', value: `${data.consistency.overall}%`,    color: '#16a34a' },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, background: '#fff', borderRadius: 12,
            padding: '14px 16px', textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#999', marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Consistency bars */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '18px 22px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 14 }}>Consistency (all-time)</div>
        <ConsistencyBar label="Overall Check-in" value={data.consistency.overall} />
        <ConsistencyBar label="Sunscreen"         value={data.consistency.sunscreen} />
        <ConsistencyBar label="Diet"              value={data.consistency.diet} />
      </div>

      {/* Diet plan info */}
      {data.dietPlan && (
        <div style={{ background: '#eff6ff', borderRadius: 14, padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#2563eb', marginBottom: 10 }}>Diet Plan (Airtable)</div>
          <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div>Call Status: <strong>{safeStr(data.dietPlan.dieticianCallStatus) || '—'}</strong></div>
            <div>Plan Status: <strong>{safeStr(data.dietPlan.dietPlanStatus) || '—'}</strong></div>
            {data.dietPlan.dietPlanDate && <div>Plan Date: <strong>{data.dietPlan.dietPlanDate}</strong></div>}
          </div>
        </div>
      )}

      {/* This week grid */}
      {data.weekGrid && data.weekGrid.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, padding: '18px 22px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 14 }}>This Week</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {data.weekGrid.map((day, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#aaa', marginBottom: 6 }}>{day.dayLabel}</div>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', margin: '0 auto',
                  background: day.isFuture ? '#f3f4f6' : day.amCompleted ? '#c44033' : '#e5e7eb',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, color: day.amCompleted ? '#fff' : '#9ca3af',
                }}>
                  {!day.isFuture && (day.amCompleted ? '✓' : '—')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Products */}
      {data.dietPlan?.products && data.dietPlan.products.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, padding: '18px 22px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 10 }}>Products</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {data.dietPlan.products.map((p, i) => (
              <span key={i} style={{
                fontSize: 12, padding: '5px 14px', borderRadius: 99,
                background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb',
              }}>
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Plan end */}
      {data.reorder?.planEndDate && (
        <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '14px 18px', fontSize: 13 }}>
          Plan ends: <strong>{data.reorder.planEndDate}</strong>
          {data.reorder.daysRemaining > 0 && (
            <span style={{ color: '#888', marginLeft: 8 }}>({data.reorder.daysRemaining} days left)</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Right panel: empty state ─────────────────────────────────────────────────
function EmptyState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#bbb', userSelect: 'none' }}>
      <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>👤</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#ccc' }}>Select a patient</div>
      <div style={{ fontSize: 13, marginTop: 6, color: '#bbb' }}>Click any patient on the left to view their details</div>
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────────────
export default function DieticianDashboard() {
  const [dashData, setDashData]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [selectedPhone, setSelectedPhone] = useState(null);
  const [activeTab, setActiveTab]   = useState('queue');

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
      <div style={{ minHeight: '100vh', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>
          <div style={{ width: 36, height: 36, border: '3px solid #c44033', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
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

  const today  = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const TABS = [
    { id: 'queue',      label: "Today's Queue", count: queueCount },
    { id: 'all',        label: 'All Patients',  count: totalCount || 0 },
    { id: 'onboarding', label: 'Onboarding',    count: onboardingCount ?? onboardingPatients.length },
  ];

  // ── Render left panel content based on active tab ─────────────────────────
  function LeftPanelContent() {
    if (activeTab === 'queue' && queue) {
      const isEmpty = queueCount === 0 && (queue.airtableOnly || []).length === 0;
      if (isEmpty) {
        return (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: 'rgba(255,255,255,0.4)' }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>✅</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>All caught up!</div>
          </div>
        );
      }
      return (
        <>
          <SectionLeft icon="🔴" label="URGENT"    items={queue.urgent}        selectedPhone={selectedPhone} onSelect={setSelectedPhone} />
          <SectionLeft icon="🟡" label="FLAGGED"   items={queue.flagged}       selectedPhone={selectedPhone} onSelect={setSelectedPhone} />
          <SectionLeft icon="📞" label="CALLS"     items={queue.scheduledCalls} selectedPhone={selectedPhone} onSelect={setSelectedPhone} />
          <SectionLeft icon="✅" label="REORDER"   items={queue.reorder}       selectedPhone={selectedPhone} onSelect={setSelectedPhone} />
          <SectionLeft icon="⚪" label="NOT IN APP" items={queue.airtableOnly}  selectedPhone={selectedPhone} onSelect={setSelectedPhone} />
        </>
      );
    }

    if (activeTab === 'all') {
      const sorted = (allPatients || []).slice().sort((a, b) => {
        const na = safeStr(a.mongodb?.name) || safeStr(a.airtable?.customerName);
        const nb = safeStr(b.mongodb?.name) || safeStr(b.airtable?.customerName);
        return na.localeCompare(nb);
      });
      return sorted.map((item, i) => {
        const status = queueStatusMap[item.airtable?.id] || { reason: 'On Track', action: '' };
        const phone  = safeStr(item.airtable?.customerPhone);
        return (
          <PatientCardLeft
            key={item.airtable?.id || i}
            item={{ ...item, ...status }}
            isSelected={selectedPhone === phone}
            onClick={() => setSelectedPhone(phone)}
          />
        );
      });
    }

    if (activeTab === 'onboarding') {
      return onboardingPatients.map((item, i) => {
        const isNew  = item.mongodb && item.mongodb.currentDay <= 7;
        const phone  = safeStr(item.airtable?.customerPhone);
        return (
          <PatientCardLeft
            key={item.airtable?.id || i}
            item={{ ...item, reason: isNew ? 'New Patient' : 'Not in App' }}
            isSelected={selectedPhone === phone}
            onClick={() => setSelectedPhone(phone)}
          />
        );
      });
    }

    return null;
  }

  // ────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── LEFT PANEL: 40% dark ─────────────────────────────────────────── */}
      <div style={{
        width: '40%', minWidth: 300, background: '#1a1a2e',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        borderRight: '1px solid rgba(255,255,255,0.07)',
      }}>

        {/* Left top: brand + dietician name */}
        <div style={{ padding: '22px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#c44033', letterSpacing: '0.1em', marginBottom: 4 }}>
            GLEUHR
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
            {name.startsWith('Dt') ? name : `Dt. ${name.split(' ')[0]}`}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
            {totalCount || 0} active patients
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', padding: '12px 12px 0', gap: 4, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1, padding: '7px 4px 9px', border: 'none', background: 'transparent',
                  cursor: 'pointer', fontSize: 12, fontWeight: active ? 700 : 400,
                  color: active ? '#fff' : 'rgba(255,255,255,0.45)',
                  borderBottom: `2px solid ${active ? '#c44033' : 'transparent'}`,
                  marginBottom: -1, whiteSpace: 'nowrap', transition: 'all 0.15s',
                }}
              >
                {tab.label}
                <span style={{
                  marginLeft: 5, fontSize: 10, fontWeight: 600,
                  background: active ? '#c44033' : 'rgba(255,255,255,0.12)',
                  color: active ? '#fff' : 'rgba(255,255,255,0.6)',
                  padding: '1px 6px', borderRadius: 99,
                }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Scrollable patient list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 10px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
          <LeftPanelContent />
        </div>
      </div>

      {/* ── RIGHT PANEL: 60% light ────────────────────────────────────────── */}
      <div style={{ flex: 1, background: '#f5f6f8', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Right top: dark header bar */}
        <div style={{
          background: '#1a1a2e', padding: '16px 28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>
              {greeting || `Good morning, ${name.split(' ')[0]}!`}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
              {dateStr}
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

        {/* Stats strip */}
        {stats && (
          <div style={{ padding: '16px 24px 0', display: 'flex', gap: 12, flexShrink: 0 }}>
            <StatCard label="Need Attention"  value={stats.needAttention}         color="#dc2626" />
            <StatCard label="Calls Today"     value={stats.callsToday}            color="#d97706" />
            <StatCard label="Avg Consistency" value={`${stats.avgConsistency}%`}  color="#16a34a" />
            <StatCard label="Reorder Due"     value={stats.reorderDue}            color="#2563eb" />
          </div>
        )}

        {/* Detail area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 32px' }}>
          {selectedPhone
            ? <PatientDetailPanel phone={selectedPhone} />
            : <EmptyState />
          }
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 99px; }
      `}</style>
    </div>
  );
}
