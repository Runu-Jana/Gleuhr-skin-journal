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

// ── Consistency bar ──────────────────────────────────────────────────────────
function ConsistencyBar({ label, value }) {
  const color = value >= 75 ? '#16a34a' : value >= 50 ? '#ca8a04' : '#dc2626';
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#444', marginBottom: 5 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700, color }}>{value}%</span>
      </div>
      <div style={{ background: '#f0f0f0', borderRadius: 99, height: 7, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, background: '#c44033', height: '100%', borderRadius: 99, transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

// ── Skin score mini bar chart ────────────────────────────────────────────────
function SkinScoreChart({ data }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, minHeight: 80 }}>
      {data.map(({ day, totalScore }) => (
        <div key={day} style={{ flex: 1, textAlign: 'center' }}>
          {totalScore != null ? (
            <>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#c44033', marginBottom: 6 }}>{totalScore}</div>
              <div style={{ height: 48, background: 'rgba(196,64,51,0.12)', borderRadius: 6, display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
                <div style={{ width: '100%', height: `${Math.max(10, (totalScore / 20) * 100)}%`, background: 'rgba(196,64,51,0.35)', borderRadius: 4 }} />
              </div>
            </>
          ) : (
            <>
              <div style={{ color: '#ccc', marginBottom: 6, fontSize: 16 }}>—</div>
              <div style={{ height: 48 }} />
            </>
          )}
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 6 }}>Day {day}</div>
        </div>
      ))}
    </div>
  );
}

// ── This week grid (AM + PM rows) ────────────────────────────────────────────
function WeekGrid({ weekGrid, last7Moods }) {
  const Check = ({ val, isFuture }) => {
    if (isFuture) return <span style={{ color: '#ccc', fontSize: 13 }}>—</span>;
    if (val === true)  return <span style={{ color: '#16a34a', fontSize: 15 }}>✓</span>;
    if (val === false) return <span style={{ color: '#dc2626', fontSize: 15 }}>✗</span>;
    return <span style={{ color: '#ccc', fontSize: 13 }}>—</span>;
  };
  const moodEmoji = (m) => ({ happy: '😄', good: '😊', neutral: '😐', sad: '😞', bad: '😟' }[m] || '—');
  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ width: 28, fontSize: 11, color: '#bbb' }} />
        {weekGrid.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#999' }}>{d.dayLabel}</div>
        ))}
      </div>
      {/* AM row */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ width: 28, fontSize: 11, color: '#888', fontWeight: 600 }}>AM</div>
        {weekGrid.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            <Check val={d.amCompleted} isFuture={d.isFuture} />
          </div>
        ))}
      </div>
      {/* PM row */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ width: 28, fontSize: 11, color: '#888', fontWeight: 600 }}>PM</div>
        {weekGrid.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            <Check val={d.pmCompleted} isFuture={d.isFuture} />
          </div>
        ))}
      </div>
      {/* Skin Mood */}
      <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', letterSpacing: '0.08em', marginBottom: 8 }}>SKIN MOOD (7 DAYS)</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {(last7Moods || []).map((mood, i) => (
          <div key={i} style={{ fontSize: 20 }}>{moodEmoji(mood)}</div>
        ))}
      </div>
    </div>
  );
}

// ── Section heading ──────────────────────────────────────────────────────────
function SectionHeading({ label }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', letterSpacing: '0.1em', marginBottom: 14 }}>
      {label}
    </div>
  );
}

// ── Photos & Ratings tab ─────────────────────────────────────────────────────
const RATING_LABELS = {
  1: 'No visible change',
  2: 'Minimal change',
  3: 'Moderate improvement',
  4: 'Good improvement',
  5: 'Significant improvement',
};

function PhotoRatingsTab({ phone, currentDay }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ratings, setRatings] = useState({});
  const [editingNote, setEditingNote] = useState(null);
  const [noteInput, setNoteInput] = useState('');
  const [saving, setSaving] = useState({});

  useEffect(() => {
    setPhotos([]);
    setLoading(true);
    api.get(`/api/dietician/patient/${encodeURIComponent(phone)}/photos`)
      .then(res => {
        const list = res.data.photos || [];
        setPhotos(list);
        const existing = {};
        list.forEach(p => {
          if (p.weekNumber && p.coachRating != null) {
            existing[p.weekNumber] = { rating: p.coachRating, note: p.coachNote || '' };
          }
        });
        setRatings(existing);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [phone]);

  const maxWeek = Math.max(
    Math.ceil((currentDay || 1) / 7),
    photos.length > 0 ? Math.max(...photos.map(p => p.weekNumber)) : 1
  );

  const handleRating = async (weekNumber, rating) => {
    const note = ratings[weekNumber]?.note || '';
    setRatings(prev => ({ ...prev, [weekNumber]: { rating, note } }));
    setSaving(prev => ({ ...prev, [weekNumber]: true }));
    try {
      await api.post(`/api/dietician/patient/${encodeURIComponent(phone)}/photo-rating`, { weekNumber, rating, note });
    } catch (_) { /* best-effort */ }
    finally { setSaving(prev => ({ ...prev, [weekNumber]: false })); }
  };

  const handleNoteSave = async (weekNumber) => {
    const existing = ratings[weekNumber];
    setRatings(prev => ({ ...prev, [weekNumber]: { ...prev[weekNumber], note: noteInput } }));
    setEditingNote(null);
    if (existing?.rating) {
      try {
        await api.post(`/api/dietician/patient/${encodeURIComponent(phone)}/photo-rating`, { weekNumber, rating: existing.rating, note: noteInput });
      } catch (_) { /* best-effort */ }
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
        <div style={{ width: 24, height: 24, border: '3px solid #c44033', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  const ratedWeeks = Array.from({ length: maxWeek }, (_, i) => i + 1)
    .map(w => ratings[w]?.rating)
    .filter(Boolean);

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '18px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#888', marginBottom: 16 }}>
        Weekly Photo Ratings
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: maxWeek }, (_, i) => i + 1).map(week => {
          const photo = photos.find(p => p.weekNumber === week);
          const ratingData = ratings[week];
          const currentRating = ratingData?.rating ?? null;
          const currentNote = ratingData?.note || '';

          if (!photo) {
            return (
              <div key={week} style={{ borderRadius: 10, background: 'repeating-linear-gradient(-45deg,#f5f5f5 0,#f5f5f5 8px,#ececec 8px,#ececec 16px)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ flexShrink: 0, textAlign: 'center' }}>
                  <div style={{ width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#bbb' }}>—</div>
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>Week {week}</div>
                </div>
                <div style={{ color: '#bbb', fontSize: 13 }}>Photo not taken</div>
              </div>
            );
          }

          const autoLabel = currentRating ? RATING_LABELS[currentRating] : '';
          const descText = autoLabel
            ? (currentNote ? `${autoLabel} — '${currentNote}'` : autoLabel)
            : '';

          return (
            <div key={week} style={{ background: '#f9f7f5', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* Thumbnail */}
              <div style={{ flexShrink: 0, textAlign: 'center' }}>
                {photo.photoUrl ? (
                  <img src={photo.photoUrl} alt={`Week ${week}`} style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8 }} />
                ) : (
                  <div style={{ width: 52, height: 52, background: '#2b2b2b', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                    📷
                  </div>
                )}
                <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>Week {week}</div>
              </div>

              {/* Rating + description */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => handleRating(week, n)}
                      style={{
                        width: 26, height: 26, borderRadius: 5,
                        border: currentRating != null && n <= currentRating ? '1.5px solid #c44033' : '1.5px solid #ddd',
                        background: 'transparent',
                        color: currentRating != null && n <= currentRating ? '#c44033' : '#bbb',
                        fontSize: 13, fontWeight: 600, cursor: 'pointer', lineHeight: 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                      }}>
                      {n}
                    </button>
                  ))}
                  {saving[week] && <span style={{ fontSize: 11, color: '#aaa', marginLeft: 4 }}>Saving...</span>}
                </div>

                {editingNote === week ? (
                  <input
                    autoFocus
                    value={noteInput}
                    onChange={e => setNoteInput(e.target.value)}
                    onBlur={() => handleNoteSave(week)}
                    onKeyDown={e => e.key === 'Enter' && handleNoteSave(week)}
                    placeholder="Add coach note..."
                    style={{ fontSize: 12, color: '#555', border: '1px solid #ddd', borderRadius: 6, padding: '3px 8px', width: '100%', outline: 'none', background: '#fff' }}
                  />
                ) : (
                  <div
                    onClick={() => { setEditingNote(week); setNoteInput(currentNote); }}
                    style={{ fontSize: 12, color: descText ? '#888' : '#ccc', cursor: 'text', minHeight: 18 }}>
                    {descText || (currentRating ? 'Click to add note...' : 'Select a rating above')}
                  </div>
                )}
              </div>

              {/* Score */}
              <div style={{ fontSize: 24, fontWeight: 300, color: '#c0b8b0', flexShrink: 0, minWidth: 44, textAlign: 'right', letterSpacing: -1 }}>
                {currentRating != null ? `${currentRating}/5` : ''}
              </div>
            </div>
          );
        })}
      </div>

      {ratedWeeks.length > 0 && (
        <div style={{ marginTop: 12, padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>Improvement Curve:</span>
          <span style={{ fontSize: 13, color: '#16a34a' }}>
            {ratedWeeks.map(r => `${r}/5`).join(' → ')}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Diet & Compliance tab ────────────────────────────────────────────────────
const WATER_LABELS = { 1: '< 1L', 2: '1–2L', 3: '2–3L', 4: '3L+' };

function DietComplianceTab({ phone, card }) {
  const [dietData, setDietData] = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    setDietData(null);
    setLoading(true);
    api.get(`/api/dietician/patient/${encodeURIComponent(phone)}/diet`)
      .then(res => setDietData(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [phone]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#aaa' }}>
        <div style={{ width: 24, height: 24, border: '3px solid #c44033', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  const { dietPlanHistory = [], triggerFoodFrequency = [], waterIntake = {}, dietCompliance = 0 } = dietData || {};
  const maxTriggerDays = triggerFoodFrequency[0]?.days || 1;

  // Colour for trigger food bar based on frequency
  const triggerColor = (days) => days >= 7 ? '#dc2626' : days >= 4 ? '#d97706' : '#ca8a04';

  // Water bucket widths (% of total days logged)
  const totalWaterLogs = Object.values(waterIntake.buckets || {}).reduce((a, b) => a + b, 0) || 1;
  const avgBucket = waterIntake.average || 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '55% 1fr', gap: 16 }}>

      {/* ── Left: Diet Plan History ── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <SectionHeading label="DIET PLAN HISTORY" />
          <button style={{
            background: '#c44033', color: '#fff', border: 'none',
            borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            + Log Diet Change
          </button>
        </div>

        {dietPlanHistory.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#bbb', padding: '30px 0', fontSize: 13 }}>
            No diet plan recorded yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {dietPlanHistory.map((plan, i) => (
              <div key={i} style={{
                border: `1.5px solid ${plan.isActive ? '#c4b5fd' : '#e5e7eb'}`,
                borderRadius: 12, padding: '14px 16px',
                background: plan.isActive ? 'rgba(196,181,253,0.07)' : '#fafafa',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#555' }}>
                    v{i + 1}
                  </span>
                  {plan.isActive && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                      background: '#ede9fe', color: '#7c3aed', letterSpacing: '0.05em',
                    }}>
                      ACTIVE
                    </span>
                  )}
                  {plan.createdAt && (
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: '#aaa' }}>
                      {new Date(plan.createdAt).toISOString().split('T')[0]}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 8 }}>
                  {plan.category}
                </div>
                {plan.restrictions.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {plan.restrictions.map((r, j) => (
                      <span key={j} style={{
                        fontSize: 11, padding: '3px 10px', borderRadius: 99,
                        background: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe',
                      }}>
                        {r}
                      </span>
                    ))}
                  </div>
                )}
                {plan.notes && (
                  <div style={{ fontSize: 12, color: '#888', fontStyle: 'italic' }}>
                    "{plan.notes}"
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Right: Trigger Foods + Water + Compliance ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Trigger Food Frequency */}
        <div style={card}>
          <SectionHeading label="TRIGGER FOOD FREQUENCY (14 DAYS)" />
          {triggerFoodFrequency.length === 0 ? (
            <div style={{ color: '#bbb', fontSize: 13 }}>No trigger foods reported.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {triggerFoodFrequency.map(({ food, days }) => (
                <div key={food}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: '#444', fontWeight: 500 }}>{food}</span>
                    <span style={{ fontWeight: 700, color: triggerColor(days) }}>{days} days</span>
                  </div>
                  <div style={{ background: '#f0f0f0', borderRadius: 99, height: 7, overflow: 'hidden' }}>
                    <div style={{
                      width: `${(days / 14) * 100}%`,
                      background: triggerColor(days),
                      height: '100%', borderRadius: 99, transition: 'width 0.4s',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Water Intake (Avg) */}
        <div style={card}>
          <SectionHeading label="WATER INTAKE (AVG)" />
          <div style={{ display: 'flex', gap: 8 }}>
            {[1, 2, 3, 4].map(bucket => {
              const isActive = bucket === avgBucket;
              return (
                <div key={bucket} style={{
                  flex: 1, textAlign: 'center', padding: '10px 6px', borderRadius: 10,
                  border: `1.5px solid ${isActive ? '#3b82f6' : '#e5e7eb'}`,
                  background: isActive ? '#eff6ff' : '#fafafa',
                }}>
                  <div style={{ fontSize: 13, fontWeight: isActive ? 700 : 400, color: isActive ? '#2563eb' : '#aaa' }}>
                    {WATER_LABELS[bucket]}
                  </div>
                  {totalWaterLogs > 1 && (
                    <div style={{ fontSize: 10, color: '#bbb', marginTop: 3 }}>
                      {waterIntake.buckets?.[bucket] || 0}d
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Diet Compliance */}
        <div style={card}>
          <SectionHeading label="DIET COMPLIANCE" />
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#444', marginBottom: 5 }}>
              <span>Overall</span>
              <span style={{ fontWeight: 700, color: dietCompliance >= 70 ? '#16a34a' : '#c44033' }}>
                {dietCompliance}%
              </span>
            </div>
            <div style={{ background: '#f0f0f0', borderRadius: 99, height: 7, overflow: 'hidden' }}>
              <div style={{
                width: `${dietCompliance}%`,
                background: '#c44033', height: '100%', borderRadius: 99, transition: 'width 0.4s',
              }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Right panel: patient detail ──────────────────────────────────────────────
function PatientDetailPanel({ phone, onBack }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [noteText, setNoteText]   = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [notes, setNotes]         = useState([]);
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);
  const [restoringShield, setRestoringShield] = useState(false);
  const [shieldMsg, setShieldMsg] = useState('');

  const fetchNotes = () => {
    setNotesLoading(true);
    api.get(`/api/dietician/patient/${encodeURIComponent(phone)}/notes`)
      .then(res => setNotes(res.data.notes || []))
      .catch(() => {})
      .finally(() => setNotesLoading(false));
  };

  useEffect(() => {
    setData(null);
    setLoading(true);
    setError('');
    setNoteText('');
    setNotes([]);
    setShowAllNotes(false);
    api.get(`/api/dietician/patient/${encodeURIComponent(phone)}/details`)
      .then(res => setData(res.data.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load'))
      .finally(() => setLoading(false));
    fetchNotes();
  }, [phone]); // eslint-disable-line

  const handleRestoreShield = async () => {
    setRestoringShield(true);
    setShieldMsg('');
    try {
      const res = await api.post(`/api/dietician/patient/${encodeURIComponent(phone)}/restore-shield`);
      const remaining = res.data.coachRestorations?.remaining ?? '?';
      setShieldMsg(`Shield restored. ${remaining} coach restoration${remaining === 1 ? '' : 's'} remaining this month.`);
      // Refresh patient data to update shield count
      const updated = await api.get(`/api/dietician/patient/${encodeURIComponent(phone)}/details`);
      setData(updated.data.data);
    } catch (e) {
      setShieldMsg(e.response?.data?.error || 'Failed to restore shield');
    } finally {
      setRestoringShield(false);
    }
  };

  const handleSaveNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      await api.post(`/api/dietician/patient/${encodeURIComponent(phone)}/notes`, { note: noteText });
      setNoteText('');
      fetchNotes();
    } catch (e) {
      alert('Failed to save note');
    } finally {
      setSavingNote(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#aaa' }}>
        <div style={{ textAlign: 'center' }}>
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

  const { patient, dietPlan, streak, consistency, reorder, weekGrid, skinTrajectory, last7Moods, airtableOnly } = data;
  const daysAbsent = streak?.daysAbsent || 0;
  const card = { background: '#fff', borderRadius: 14, padding: '18px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' };

  return (
    <div style={{ maxWidth: 1020 }}>

      {/* ← Back */}
      {onBack && (
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#888', marginBottom: 14, padding: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
          ← Back to queue
        </button>
      )}

      {/* ── Header ── */}
      <div style={{ ...card, marginBottom: 16, padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Avatar */}
          <div style={{
            width: 56, height: 56, borderRadius: 14, background: getAvatarColor(patient.name),
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 700, flexShrink: 0,
          }}>
            {getInitials(patient.name)}
          </div>

          {/* Name + meta */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>{patient.name}</div>
            <div style={{ fontSize: 13, color: '#777', display: 'flex', flexWrap: 'wrap', gap: '0 14px' }}>
              {dietPlan?.treatmentPlan && <span style={{ fontWeight: 600, color: '#555' }}>{dietPlan.treatmentPlan}</span>}
              {patient.phone && <span>{patient.phone}</span>}
              {patient.currentDay != null && <span>Day {patient.currentDay}/90</span>}
              {patient.skinConcern && <span>{patient.skinConcern}</span>}
            </div>
          </div>

          {/* Badges + Log Call */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {airtableOnly && <ReasonBadge reason="Not in App" />}
            {!airtableOnly && daysAbsent >= 7 && <ReasonBadge reason="7 Days Absent" />}
            {!airtableOnly && daysAbsent >= 2 && daysAbsent < 7 && <ReasonBadge reason={`${daysAbsent} Days Missed`} />}
            <button style={{
              background: '#8DBF6E', color: '#000', border: 'none', borderRadius: 9,
              padding: '9px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              📞 Log Call
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', background: '#fff', borderRadius: 12, padding: '4px 6px', marginBottom: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', gap: 2 }}>
        {['Overview', 'Diet & Compliance', 'Photos & Ratings', 'Call History'].map((tab, i) => {
          const key = ['overview', 'diet', 'photos', 'calls'][i];
          const active = activeTab === key;
          return (
            <button key={key} onClick={() => setActiveTab(key)} style={{
              flex: 1, padding: '8px 12px', border: 'none', borderRadius: 9,
              cursor: 'pointer', fontWeight: active ? 600 : 400, fontSize: 13,
              background: active ? '#f0f0f0' : 'transparent',
              color: active ? '#1a1a1a' : '#999',
              transition: 'all 0.15s',
            }}>
              {tab}
            </button>
          );
        })}
      </div>

      {/* ── Overview tab ── */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '55% 1fr', gap: 16 }}>

          {/* ── Left column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Streak & Shields */}
            {!airtableOnly && streak && (
              <div style={card}>
                <SectionHeading label="STREAK & SHIELDS" />
                <div style={{ display: 'flex', gap: 28, alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 26 }}>🔥 <span style={{ fontSize: 22, fontWeight: 700 }}>{streak.currentStreak || 0}</span></div>
                    <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>Current</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a' }}>{streak.longestStreak}</div>
                    <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>Best</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 22 }}>🛡️ <span style={{ fontWeight: 700 }}>{streak.shields}</span></div>
                    <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>Shields left</div>
                  </div>
                </div>
                {/* Coach shield restoration */}
                <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 14 }}>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 10, lineHeight: 1.4 }}>
                    Restore a shield for this patient if they had a tough day. Max 2 coach restorations per patient per month.
                  </div>
                  <button
                    onClick={handleRestoreShield}
                    disabled={restoringShield}
                    style={{
                      background: restoringShield ? '#e5e7eb' : '#c44033',
                      color: restoringShield ? '#aaa' : '#fff',
                      border: 'none', borderRadius: 8, padding: '8px 18px',
                      fontSize: 13, fontWeight: 600, cursor: restoringShield ? 'default' : 'pointer',
                    }}
                  >
                    {restoringShield ? 'Restoring…' : '🛡️ Restore Shield'}
                  </button>
                  {shieldMsg && (
                    <div style={{
                      marginTop: 10, fontSize: 12, fontWeight: 500,
                      color: shieldMsg.startsWith('Shield restored') ? '#16a34a' : '#dc2626',
                    }}>
                      {shieldMsg}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Skin Score Trajectory */}
            {!airtableOnly && skinTrajectory && skinTrajectory.length > 0 && (
              <div style={card}>
                <SectionHeading label="SKIN SCORE TRAJECTORY" />
                <SkinScoreChart data={skinTrajectory} />
              </div>
            )}

            {/* This Week */}
            {!airtableOnly && weekGrid && weekGrid.length > 0 && (
              <div style={card}>
                <SectionHeading label="THIS WEEK" />
                <WeekGrid weekGrid={weekGrid} last7Moods={last7Moods} />
              </div>
            )}

            {/* Coach Notes */}
            <div style={card}>
              <SectionHeading label="COACH NOTES" />
              <textarea
                rows={4}
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Add a note about this patient…"
                style={{
                  width: '100%', border: '1px solid #e5e7eb', borderRadius: 8,
                  padding: '10px 12px', fontSize: 13, color: '#444', resize: 'vertical',
                  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button
                  onClick={handleSaveNote}
                  disabled={savingNote || !noteText.trim()}
                  style={{
                    background: noteText.trim() ? '#c44033' : '#e5e7eb',
                    color: noteText.trim() ? '#fff' : '#aaa',
                    border: 'none', borderRadius: 8, padding: '8px 18px',
                    fontSize: 13, fontWeight: 600, cursor: noteText.trim() ? 'pointer' : 'default',
                  }}
                >
                  {savingNote ? 'Saving…' : 'Save Note'}
                </button>
                <button
                  onClick={() => { setShowAllNotes(v => !v); if (!showAllNotes) fetchNotes(); }}
                  style={{
                    background: 'transparent', color: '#c44033',
                    border: '1.5px solid #c44033', borderRadius: 8, padding: '8px 18px',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {showAllNotes ? 'Hide Notes' : 'Show All Notes'}
                </button>
              </div>

              {/* All notes list */}
              {showAllNotes && (
                <div style={{ marginTop: 16, borderTop: '1px solid #f0f0f0', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {notesLoading && <div style={{ color: '#aaa', fontSize: 13 }}>Loading…</div>}
                  {!notesLoading && notes.length === 0 && (
                    <div style={{ color: '#bbb', fontSize: 13 }}>No notes saved yet.</div>
                  )}
                  {notes.map((n, i) => (
                    <div key={n._id || i} style={{ background: '#fafafa', borderRadius: 8, padding: '10px 14px', borderLeft: '3px solid #e5e7eb' }}>
                      <div style={{ fontSize: 11, color: '#aaa', marginBottom: 5 }}>
                        {new Date(n.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {' · '}{new Date(n.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        {n.dieticianName && <span style={{ marginLeft: 8, color: '#bbb' }}>· {n.dieticianName}</span>}
                      </div>
                      <div style={{ fontSize: 13, color: '#444', lineHeight: 1.5 }}>{n.note}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Airtable-only notice (left column) */}
            {airtableOnly && (
              <div style={{ background: '#fafafa', borderRadius: 14, padding: '20px 22px', border: '1.5px dashed #e5e7eb', textAlign: 'center', color: '#aaa' }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>📋</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#777', marginBottom: 6 }}>Not registered in app yet</div>
                <div style={{ fontSize: 13 }}>Streak, consistency and weekly data will appear once the patient logs in.</div>
              </div>
            )}
          </div>

          {/* ── Right column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Consistency Breakdown */}
            {!airtableOnly && consistency && (
              <div style={card}>
                <SectionHeading label="CONSISTENCY BREAKDOWN" />
                <ConsistencyBar label="Overall"   value={consistency.overall} />
                <ConsistencyBar label="Sunscreen" value={consistency.sunscreen} />
                <ConsistencyBar label="Diet"      value={consistency.diet} />
              </div>
            )}

            {/* Reorder Status */}
            {!airtableOnly && reorder?.planEndDate && (
              <div style={card}>
                <SectionHeading label="REORDER STATUS (AUTO-DETECTED)" />
                {/* Status badge */}
                <div style={{
                  background: reorder.daysRemaining > 14 ? '#f0fdf4' : '#fef2f2',
                  borderRadius: 8, padding: '9px 14px', marginBottom: 14,
                }}>
                  <span style={{ fontWeight: 700, color: reorder.daysRemaining > 14 ? '#16a34a' : '#dc2626', fontSize: 14 }}>
                    {reorder.daysRemaining > 14 ? 'On Track' : 'Reorder Soon'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#666' }}>Plan ends</span>
                    <span style={{ fontWeight: 700 }}>{reorder.planEndDate}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#666' }}>Days remaining</span>
                    <span style={{ fontWeight: 600, color: '#16a34a' }}>{reorder.daysRemaining} days</span>
                  </div>
                  {/* Progress bar */}
                  <div style={{ background: '#f0f0f0', borderRadius: 99, height: 6, margin: '2px 0' }}>
                    <div style={{
                      width: `${Math.min(100, ((90 - reorder.daysRemaining) / 90) * 100)}%`,
                      background: '#c44033', height: '100%', borderRadius: 99,
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#666' }}>Banner shown in app</span>
                    <span>{reorder.daysRemaining <= 30 ? '☑' : '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#666' }}>Banner clicked</span>
                    <span style={{ color: '#666' }}>No</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#666' }}>New Treatment Plan (Airtable)</span>
                    <span style={{ color: dietPlan?.treatmentPlan ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                      {dietPlan?.treatmentPlan ? `✓ ${dietPlan.treatmentPlan}` : '✗ Not yet'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Products */}
            {dietPlan?.products && dietPlan.products.length > 0 && (
              <div style={card}>
                <SectionHeading label="PRODUCTS" />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {dietPlan.products.map((p, i) => (
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

            {/* Airtable-only: show available info */}
            {airtableOnly && dietPlan && (
              <div style={card}>
                <SectionHeading label="AIRTABLE RECORD" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                  {dietPlan.treatmentPlan && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#666' }}>Treatment Plan</span>
                      <span style={{ fontWeight: 700 }}>{dietPlan.treatmentPlan}</span>
                    </div>
                  )}
                  {dietPlan.dieticianCallStatus && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#666' }}>Call Status</span>
                      <ReasonBadge reason={dietPlan.dieticianCallStatus} />
                    </div>
                  )}
                  {dietPlan.dietPlanStatus && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#666' }}>Plan Status</span>
                      <span style={{ fontWeight: 600 }}>{dietPlan.dietPlanStatus}</span>
                    </div>
                  )}
                  {dietPlan.dietPlanDueDate && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#666' }}>Plan Date</span>
                      <span>{dietPlan.dietPlanDueDate}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Diet & Compliance tab ── */}
      {activeTab === 'diet' && (
        <DietComplianceTab phone={phone} card={card} />
      )}

      {/* ── Photos & Ratings tab ── */}
      {activeTab === 'photos' && (
        <PhotoRatingsTab phone={phone} currentDay={patient.currentDay} />
      )}

      {/* ── Call History tab placeholder ── */}
      {activeTab === 'calls' && (
        <div style={{ background: '#fff', borderRadius: 14, padding: '40px', textAlign: 'center', color: '#bbb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🚧</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#ccc' }}>Coming soon</div>
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
    { id: 'queue',      label: "Today's Queue", shortLabel: 'Queue',      count: queueCount },
    { id: 'all',        label: 'All Patients',  shortLabel: 'All',        count: totalCount || 0 },
    { id: 'onboarding', label: 'Onboarding',   shortLabel: 'Onboarding', count: onboardingCount ?? onboardingPatients.length },
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

      {/* ── LEFT PANEL: 20% dark ─────────────────────────────────────────── */}
      <div style={{
        width: '20%', minWidth: 300, background: '#1a1a2e',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        borderRight: '1px solid rgba(255,255,255,0.07)',
      }}>

        {/* Left top: brand + dietician name */}
        <div style={{ padding: '22px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#c44033', letterSpacing: '0.1em', marginBottom: 4 }}>
            GLEUHR
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
            {`Dt. ${name.replace(/^Dt\.?\s*/i, '').split(' ')[0]}`}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
            {totalCount || 0} active patients
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', padding: '10px 10px 0', gap: 2, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1, padding: '6px 4px 8px', border: 'none', background: 'transparent',
                  cursor: 'pointer', fontSize: 11, fontWeight: active ? 700 : 400,
                  color: active ? '#fff' : 'rgba(255,255,255,0.45)',
                  borderBottom: `2px solid ${active ? '#c44033' : 'transparent'}`,
                  marginBottom: -1, whiteSpace: 'nowrap', transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}
              >
                {tab.shortLabel || tab.label}
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  background: active ? '#c44033' : 'rgba(255,255,255,0.12)',
                  color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                  padding: '1px 5px', borderRadius: 99, flexShrink: 0,
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
            ? <PatientDetailPanel phone={selectedPhone} onBack={() => setSelectedPhone(null)} />
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
