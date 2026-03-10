import React, { useState, useEffect, useCallback } from 'react';
import { Search, Phone as PhoneIcon, RefreshCw, ArrowRight } from 'lucide-react';
import axios from 'axios';
import './AdminDashboard.css';

const adminApi = axios.create({
  baseURL: '/api',
  headers: { 'x-admin-api-key': 'gleuhr-admin-2024' }
});

const MOOD_MAP = { excellent: '\uD83D\uDE04', good: '\uD83D\uDE42', fair: '\uD83D\uDE10', poor: '\uD83D\uDE1E' };

const AVATAR_COLORS = ['#c44033', '#16A34A', '#8B5CF6', '#CA8A04', '#0891B2', '#DB2777', '#EA580C', '#4F46E5'];
function avatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name) {
  if (!name) return '??';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// ═══════════════════════════════════════════════════════════════
export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Queue state
  const [queueData, setQueueData] = useState(null);
  const [dieticians, setDieticians] = useState([]);
  const [selectedDietician, setSelectedDietician] = useState(null);
  const [activeTab, setActiveTab] = useState('queue');
  const [searchTerm, setSearchTerm] = useState('');

  // Detail state
  const [selectedPhone, setSelectedPhone] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState('overview');
  const [selectedUser, setSelectedUser] = useState(null);

  // Fetch queue data
  const fetchQueue = useCallback(async (dieticianName) => {
    setLoading(true);
    setError(null);
    try {
      const params = dieticianName ? { dietician: dieticianName } : {};
      const { data } = await adminApi.get('/admin/patients/queue', { params });
      setQueueData(data.data);
      setDieticians(data.data.dieticians || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue(selectedDietician);
  }, [fetchQueue, selectedDietician]);

  const openPatientDetails = async (phone) => {
    setSelectedPhone(phone);
    setDetailsLoading(true);
    setDetails(null);
    setActiveDetailTab('overview');
    try {
      const { data } = await adminApi.get(`/admin/patients/${encodeURIComponent(phone)}/details`);
      setDetails(data.data);
      if (data.data.dietPlan) {
        setSelectedUser(data.data.dietPlan);
      } else {
        setSelectedUser(null);
      }
    } catch (err) {
      setDetails(null);
      setError(err.response?.data?.error || 'Failed to load patient details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const goBack = () => {
    setSelectedPhone(null);
    setDetails(null);
  };

  // ─── PATIENT DETAIL VIEW ───────────────────────────────────
  if (selectedPhone) {
    return (
      <div className="admin-layout">
        <Sidebar
          dieticians={dieticians}
          selectedDietician={selectedDietician}
          onSelect={setSelectedDietician}
          detailMode
          coachName={details?.patient?.coachName}
          dieticianUser={selectedUser}
        />
        <div className="admin-main">
          {detailsLoading ? (
            <div className="admin-center-spinner"><div className="spinner" /></div>
          ) : !details ? (
            <div style={{ textAlign: 'center', padding: 80, color: '#999' }}>
              <button onClick={goBack} className="back-link">&larr; Back to queue</button>
              <p>Could not load details</p>
            </div>
          ) : (
            <>
              <div className="admin-header">
                <div className="admin-header-left">
                  <button onClick={goBack} className="back-arrow">&larr;</button>
                  <div className="admin-header-avatar" style={{ background: avatarColor(details.patient.name) }}>
                    {getInitials(details.patient.name)}
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{details.patient.name}</h2>
                    <div className="admin-header-meta">
                      {details.patient.planType && <span>{details.patient.planType}</span>}
                      <span>{details.patient.phone}</span>
                      <span>Day {details.patient.currentDay}/90</span>
                      <span>{details.patient.skinConcern}</span>
                    </div>
                  </div>
                </div>
                <div className="admin-header-right">
                  {details.streak.daysAbsent > 0 && (
                    <span className="absent-badge">{details.streak.daysAbsent} Days Absent</span>
                  )}
                  <button className="log-call-btn"><PhoneIcon size={14} /> Log Call</button>
                </div>
              </div>
              <div className="admin-tabs">
                {['overview', 'diet', 'photos', 'calls'].map(tab => (
                  <button key={tab} className={`admin-tab ${activeDetailTab === tab ? 'active' : ''}`} onClick={() => setActiveDetailTab(tab)}>
                    {{ overview: 'Overview', diet: 'Diet & Compliance', photos: 'Photos & Ratings', calls: 'Call History' }[tab]}
                  </button>
                ))}
              </div>
              <div className="admin-content">
                {activeDetailTab === 'overview' && <OverviewTab details={details} />}
                {activeDetailTab === 'diet' && <DietTab details={details} />}
                {activeDetailTab === 'photos' && <PhotosTab details={details} />}
                {activeDetailTab === 'calls' && <CallsTab />}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ─── QUEUE DASHBOARD VIEW ──────────────────────────────────
  const summary = queueData?.summary || {};
  const categories = queueData?.categories || {};
  const allPatients = queueData?.allPatients || [];
  const onboarding = queueData?.onboarding || [];

  // Filter patients by search
  const filterList = (list) => {
    if (!searchTerm) return list;
    const term = searchTerm.toLowerCase();
    const digits = term.replace(/[^\d]/g, '');
    return list.filter(p =>
      (p.name || '').toLowerCase().includes(term) ||
      (p.phone || '').includes(term) ||
      (digits.length >= 4 && (p.phone || '').replace(/[^\d]/g, '').includes(digits)) ||
      (p.tpId || '').toLowerCase().includes(term)
    );
  };

  const queueCount = (categories.urgent?.length || 0) + (categories.flagged?.length || 0) +
    (categories.scheduledCalls?.length || 0) + (categories.reorder?.length || 0);

  const firstName = selectedDietician ? selectedDietician.split(' ')[0] : 'Admin';

  return (
    <div className="admin-layout">
      <Sidebar
        dieticians={dieticians}
        selectedDietician={selectedDietician}
        onSelect={(d) => { setSelectedDietician(d); setActiveTab('queue'); }}
      />
      <div className="admin-main">
        <div className="queue-header">
          <div>
            <h1 className="queue-greeting">{getGreeting()}, {firstName}</h1>
            <p className="queue-date">{formatDate()} &middot; {summary.activePatients || 0} active patients</p>
          </div>
          <button onClick={() => fetchQueue(selectedDietician)} disabled={loading} className="refresh-btn">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Summary Cards */}
        <div className="summary-cards">
          <div className="summary-card">
            <div className="summary-num" style={{ color: '#DC2626' }}>{summary.needAttention || 0}</div>
            <div className="summary-label">Need Attention</div>
          </div>
          <div className="summary-card">
            <div className="summary-num" style={{ color: '#CA8A04' }}>{summary.callsToday || 0}</div>
            <div className="summary-label">Calls Today</div>
          </div>
          <div className="summary-card">
            <div className="summary-num" style={{ color: '#16A34A' }}>{summary.avgConsistency || 0}%</div>
            <div className="summary-label">Avg Consistency</div>
          </div>
          <div className="summary-card">
            <div className="summary-num" style={{ color: '#0891B2' }}>{summary.reorderDue || 0}</div>
            <div className="summary-label">Reorder Due</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="queue-tabs">
          <button className={`queue-tab ${activeTab === 'queue' ? 'active' : ''}`} onClick={() => setActiveTab('queue')}>
            Today's Queue {queueCount > 0 && <span className="tab-badge">{queueCount}</span>}
          </button>
          <button className={`queue-tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>
            All Patients <span className="tab-count">{allPatients.length}</span>
          </button>
          <button className={`queue-tab ${activeTab === 'onboarding' ? 'active' : ''}`} onClick={() => setActiveTab('onboarding')}>
            Onboarding <span className="tab-count">{onboarding.length}</span>
          </button>
        </div>

        {/* Search (for All Patients tab) */}
        {activeTab === 'all' && (
          <div className="queue-search">
            <Search size={16} className="queue-search-icon" />
            <input
              type="text"
              placeholder="Search by name, phone, or TP-ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="queue-search-input"
            />
          </div>
        )}

        {error && <div className="queue-error">{error}</div>}

        {loading ? (
          <div className="admin-center-spinner"><div className="spinner" /></div>
        ) : (
          <div className="queue-content">
            {activeTab === 'queue' && (
              <>
                {categories.urgent?.length > 0 && (
                  <CategorySection
                    icon="red"
                    title="URGENT \u2014 IMMEDIATE ACTION"
                    patients={categories.urgent}
                    onSelect={openPatientDetails}
                  />
                )}
                {categories.flagged?.length > 0 && (
                  <CategorySection
                    icon="yellow"
                    title="FLAGGED \u2014 ADDRESS THIS WEEK"
                    patients={categories.flagged}
                    onSelect={openPatientDetails}
                  />
                )}
                {categories.scheduledCalls?.length > 0 && (
                  <CategorySection
                    icon="phone"
                    title="SCHEDULED CALLS"
                    patients={categories.scheduledCalls}
                    onSelect={openPatientDetails}
                  />
                )}
                {categories.reorder?.length > 0 && (
                  <CategorySection
                    icon="green"
                    title="REORDER CONVERSATIONS"
                    patients={categories.reorder}
                    onSelect={openPatientDetails}
                  />
                )}
                {queueCount === 0 && (
                  <div className="queue-empty">No items in today's queue. All patients are on track!</div>
                )}
              </>
            )}

            {activeTab === 'all' && (
              <div className="patient-list">
                {filterList(allPatients).length === 0 ? (
                  <div className="queue-empty">No patients found</div>
                ) : (
                  filterList(allPatients).map(p => (
                    <PatientCard key={p.id} patient={p} onSelect={openPatientDetails} />
                  ))
                )}
              </div>
            )}

            {activeTab === 'onboarding' && (
              <div className="patient-list">
                {onboarding.length === 0 ? (
                  <div className="queue-empty">No patients currently onboarding</div>
                ) : (
                  onboarding.map(p => (
                    <PatientCard key={p.id} patient={p} onSelect={openPatientDetails} />
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════════
function Sidebar({ dieticians, selectedDietician, onSelect, detailMode, coachName, dieticianUser }) {
  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-logo">
        <h2>GLEUHR</h2>
        <p>Skin Journal</p>
      </div>
      <nav className="admin-sidebar-nav">
        {detailMode ? (
          <>
            <button className="admin-sidebar-item active">
              <div className="admin-sidebar-avatar" style={{ background: '#c44033' }}>
                {coachName ? getInitials(coachName) : 'CO'}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Coach</div>
                <div style={{ fontSize: 11, opacity: 0.6 }}>{coachName || '\u2014'}</div>
              </div>
            </button>
            {dieticianUser && (
              <button className="admin-sidebar-item">
                <div className="admin-sidebar-avatar" style={{ background: '#8B5CF6' }}>
                  {getInitials(dieticianUser.dieticianName)}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Dietician</div>
                  <div style={{ fontSize: 11, opacity: 0.6 }}>{dieticianUser.dieticianName || 'N/A'}</div>
                </div>
              </button>
            )}
          </>
        ) : (
          <>
            {/* Show all dieticians */}
            {dieticians.map(d => (
              <button
                key={d}
                className={`admin-sidebar-item ${selectedDietician === d ? 'active' : ''}`}
                onClick={() => onSelect(d)}
              >
                <div className="admin-sidebar-avatar" style={{ background: avatarColor(d) }}>
                  {getInitials(d)}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{d}</div>
                  <div style={{ fontSize: 11, opacity: 0.6 }}>Skin Coach</div>
                </div>
              </button>
            ))}
            {/* Show All option */}
            <button
              className={`admin-sidebar-item ${!selectedDietician ? 'active' : ''}`}
              onClick={() => onSelect(null)}
            >
              <div className="admin-sidebar-avatar" style={{ background: '#555' }}>
                All
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>All Patients</div>
                <div style={{ fontSize: 11, opacity: 0.6 }}>Overview</div>
              </div>
            </button>
          </>
        )}
      </nav>
      <div className="admin-sidebar-footer">
        <div>Airtable Sync: Live</div>
        <div>Last updated: {new Date().toISOString().split('T')[0]}</div>
      </div>
    </aside>
  );
}

// ═══════════════════════════════════════════════════════════════
// CATEGORY SECTION
// ═══════════════════════════════════════════════════════════════
function CategorySection({ icon, title, patients, onSelect }) {
  const iconMap = {
    red: '\uD83D\uDD34',
    yellow: '\uD83D\uDFE1',
    phone: '\uD83D\uDCDE',
    green: '\u2705'
  };
  return (
    <div className="category-section">
      <h3 className="category-title">{iconMap[icon] || ''} {title}</h3>
      {patients.map(p => (
        <PatientCard key={p.id} patient={p} onSelect={onSelect} />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PATIENT CARD (queue row)
// ═══════════════════════════════════════════════════════════════
function PatientCard({ patient: p, onSelect }) {
  return (
    <div className="queue-patient-card" onClick={() => onSelect(p.phone)}>
      <div className="qpc-left">
        <div className="qpc-avatar" style={{ background: avatarColor(p.name) }}>
          {getInitials(p.name)}
        </div>
        <div className="qpc-info">
          <div className="qpc-name">{p.name}</div>
          <div className="qpc-meta">
            {p.tpId && <span>{p.tpId}</span>}
            <span>Day {p.currentDay}</span>
            {p.streak > 0 && <span className="qpc-streak">{'\uD83D\uDD25'}{p.streak}</span>}
            <span className={`qpc-consistency ${p.consistency >= 60 ? 'good' : p.consistency >= 40 ? 'ok' : 'low'}`}>
              {p.consistency}%
            </span>
          </div>
        </div>
      </div>
      <div className="qpc-right">
        {p.flag && (
          <span className="qpc-flag" style={{ background: p.flagColor + '18', color: p.flagColor, borderColor: p.flagColor + '40' }}>
            {p.flag}
          </span>
        )}
        {p.actionNeeded && <span className="qpc-action">{p.actionNeeded}</span>}
        <ArrowRight size={16} className="qpc-arrow" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════════════════════════
function OverviewTab({ details }) {
  const { patient, streak, consistency, reorder, weekGrid, skinTrajectory, last7Moods } = details;
  return (
    <>
      <div className="admin-grid-2">
        <div className="admin-card">
          <h4>Streak & Shields</h4>
          <div className="streak-row">
            <div className="streak-item">
              <span style={{ fontSize: 24 }}>{'\uD83D\uDD25'}</span>
              <span className="streak-num">{streak.currentStreak}</span>
              <span className="streak-label">Current</span>
            </div>
            <div className="streak-item">
              <span className="streak-num" style={{ fontSize: 20 }}>{streak.longestStreak}</span>
              <span className="streak-label">Best</span>
            </div>
            <div className="streak-item">
              <span style={{ fontSize: 20 }}>{'\uD83D\uDEE1\uFE0F'}</span>
              <span className="streak-num" style={{ fontSize: 20 }}>{streak.shields}</span>
              <span className="streak-label">Shields</span>
            </div>
          </div>
          <button className="restore-btn">{'\uD83D\uDEE1\uFE0F'} Restore Shield</button>
        </div>
        <div className="admin-card">
          <h4>Consistency Breakdown</h4>
          {[
            { label: 'Overall', value: consistency.overall },
            { label: 'Sunscreen', value: consistency.sunscreen },
            { label: 'Diet', value: consistency.diet }
          ].map(item => (
            <div className="consistency-row" key={item.label}>
              <span className="consistency-label">{item.label}</span>
              <div className="consistency-bar-bg">
                <div className="consistency-bar" style={{ width: `${item.value}%` }} />
              </div>
              <span className="consistency-pct">{item.value}%</span>
            </div>
          ))}
        </div>
      </div>
      <div className="admin-grid-2">
        <div className="admin-card">
          <h4>Skin Score Trajectory</h4>
          <div className="trajectory-row">
            {skinTrajectory.map(s => (
              <div className="trajectory-col" key={s.day}>
                {s.totalScore != null ? (
                  <>
                    <span className="trajectory-score">{s.totalScore}</span>
                    <div className="trajectory-bar-container">
                      <div className="trajectory-bar" style={{ height: `${Math.max(s.totalScore, 5)}%` }} />
                    </div>
                  </>
                ) : (
                  <span style={{ color: '#ccc', fontSize: 20 }}>&mdash;</span>
                )}
                <span className="trajectory-day">Day {s.day}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="admin-card">
          <h4>Reorder Status (Auto-Detected)</h4>
          <div className="reorder-status-badge" style={{ background: reorder.daysRemaining > 14 ? '#DCFCE7' : '#FEF2F2', color: reorder.daysRemaining > 14 ? '#16A34A' : '#c44033' }}>
            {reorder.daysRemaining > 14 ? 'On Track' : 'Attention Needed'}
          </div>
          <div className="reorder-row"><span>Plan ends</span><span className="reorder-val">{reorder.planEndDate || '\u2014'}</span></div>
          <div className="reorder-row"><span>Days remaining</span><span className="reorder-val" style={{ color: reorder.daysRemaining <= 14 ? '#c44033' : '#16A34A' }}>{reorder.daysRemaining} days</span></div>
          <div className="reorder-row"><span>Banner shown in app</span><span>{reorder.bannerShown ? '\u2705' : '\u274C'}</span></div>
          <div className="reorder-row"><span>Banner clicked</span><span>{reorder.bannerClicked ? 'Yes' : 'No'}</span></div>
          <div className="reorder-row"><span>New Treatment Plan (Airtable)</span><span style={{ color: reorder.newTreatmentPlan ? '#16A34A' : '#c44033', fontWeight: 600 }}>{reorder.newTreatmentPlan ? '\u2705 Ready' : '\u274C Not yet'}</span></div>
        </div>
      </div>
      <div className="admin-grid-2">
        <div className="admin-card">
          <h4>This Week</h4>
          <div className="week-grid">
            <table>
              <thead><tr><th></th>{weekGrid.map((d, i) => <th key={i}>{d.dayLabel}</th>)}</tr></thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 600, fontSize: 12 }}>AM</td>
                  {weekGrid.map((d, i) => <td key={i}>{d.isFuture ? '\u2014' : d.amCompleted === true ? '\u2705' : d.amCompleted === false ? '\u274C' : '\u2014'}</td>)}
                </tr>
                <tr>
                  <td style={{ fontWeight: 600, fontSize: 12 }}>PM</td>
                  {weekGrid.map((d, i) => <td key={i}>{d.isFuture ? '\u2014' : d.pmCompleted === true ? '\u2705' : d.pmCompleted === false ? '\u274C' : '\u2014'}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
          <h4 style={{ marginTop: 16 }}>Skin Mood (7 Days)</h4>
          <div className="mood-row">
            {(last7Moods || []).map((m, i) => (
              <span key={i} className="mood-emoji">{m ? (MOOD_MAP[m] || '\u2014') : '\u2014'}</span>
            ))}
          </div>
        </div>
        <div className="admin-card">
          <h4>Products</h4>
          <div className="products-list">
            {patient.products && patient.products.length > 0 ? (
              patient.products.map(pr => <span key={pr.id} className="product-chip">{pr.name}</span>)
            ) : (
              <span style={{ color: '#999', fontSize: 13 }}>No products assigned</span>
            )}
          </div>
        </div>
      </div>
      <div className="admin-card" style={{ marginBottom: 16 }}>
        <h4>Coach Notes</h4>
        <textarea className="coach-notes-area" placeholder="Add notes about this patient..." defaultValue={details.checkIns?.[0]?.notes || ''} readOnly />
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// DIET TAB
// ═══════════════════════════════════════════════════════════════
function DietTab({ details }) {
  const { dietPlan } = details;
  if (!dietPlan) {
    return <div className="admin-card" style={{ textAlign: 'center', padding: 40, color: '#999' }}>No diet plan found in Airtable for this customer</div>;
  }
  return (
    <div className="admin-card">
      <h3 style={{ marginBottom: 16 }}>Diet Plan (Airtable)</h3>
      <div style={{ display: 'grid', gap: 12 }}>
        <div><strong>Customer:</strong> {dietPlan.customerName || 'N/A'}</div>
        <div><strong>Phone:</strong> {dietPlan.customerPhone || 'N/A'}</div>
        <div><strong>Plan Category:</strong> {dietPlan.planCategory || 'N/A'}</div>
        <div><strong>Status:</strong> <span style={{ color: dietPlan.status === 'Active' ? '#16A34A' : '#c44033', fontWeight: 600 }}>{dietPlan.status || 'N/A'}</span></div>
        {dietPlan.restrictions && dietPlan.restrictions.length > 0 && <div><strong>Restrictions:</strong> {Array.isArray(dietPlan.restrictions) ? dietPlan.restrictions.join(', ') : dietPlan.restrictions}</div>}
        {dietPlan.recommendations && <div><strong>Recommendations:</strong> {dietPlan.recommendations}</div>}
        <div><strong>Dietician:</strong> {dietPlan.dieticianName || 'N/A'} {dietPlan.dieticianPhone ? `(${dietPlan.dieticianPhone})` : ''}</div>
        {dietPlan.startDate && <div><strong>Start Date:</strong> {dietPlan.startDate}</div>}
        {dietPlan.notes && <div><strong>Notes:</strong> {dietPlan.notes}</div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PHOTOS & CALLS TABS
// ═══════════════════════════════════════════════════════════════
function PhotosTab({ details }) {
  return (
    <div className="admin-card" style={{ textAlign: 'center', padding: 40, color: '#999' }}>
      <h4>Photos & Ratings</h4>
      <p>Weekly photos and skin score ratings will appear here.</p>
      {details.skinScores && details.skinScores.length > 0 && (
        <div style={{ marginTop: 16, textAlign: 'left' }}>
          <h4 style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#555', marginBottom: 12 }}>Skin Score History</h4>
          {details.skinScores.slice(0, 10).map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
              <span style={{ color: '#888' }}>{s.date ? new Date(s.date).toLocaleDateString() : '\u2014'} (Day {s.day})</span>
              <span style={{ fontWeight: 700, color: s.totalScore >= 70 ? '#16A34A' : s.totalScore >= 40 ? '#CA8A04' : '#c44033' }}>{s.totalScore}/100</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CallsTab() {
  return (
    <div className="admin-card" style={{ textAlign: 'center', padding: 40, color: '#999' }}>
      <h4>Call History</h4>
      <p>Call logs will appear here once logged.</p>
    </div>
  );
}
