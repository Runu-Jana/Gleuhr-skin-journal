import React, { useState, useEffect, useCallback } from 'react';
import { Search, Phone as PhoneIcon, ArrowLeft, RefreshCw, Activity, Star, TrendingUp } from 'lucide-react';
import axios from 'axios';
import './AdminDashboard.css';

const MOOD_MAP = {
  excellent: '\uD83D\uDE04',
  good: '\uD83D\uDE42',
  fair: '\uD83D\uDE10',
  poor: '\uD83D\uDE1E'
};

function getInitials(name) {
  if (!name) return '??';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function AdminDashboard() {
  const [currentTab, setCurrentTab] = useState('today');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Selected patient detail
  const [selectedPhone, setSelectedPhone] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState('overview');

  // Sidebar user — populated from Airtable dietPlan of first loaded patient or selected patient
  const [selectedUser, setSelectedUser] = useState(null);

  // Load patients
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

  // Load patient detail
  const openPatientDetails = async (phone) => {
    setSelectedPhone(phone);
    setDetailsLoading(true);
    setDetails(null);
    setActiveDetailTab('overview');
    try {
      const { data } = await axios.get(`/api/admin/patients/${encodeURIComponent(phone)}/details`);
      setDetails(data.data);
      // Set sidebar user from Airtable dietPlan dietician
      if (data.data.dietPlan) {
        setSelectedUser({
          name: data.data.dietPlan.dieticianName || 'Unknown',
          initials: getInitials(data.data.dietPlan.dieticianName),
          role: 'Dietician',
          type: 'dietitian',
          phone: data.data.dietPlan.dieticianPhone || '',
          planCategory: data.data.dietPlan.planCategory || ''
        });
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

  const filtered = patients.filter((p) => {
    const term = searchTerm.toLowerCase();
    return (
      (p.name || '').toLowerCase().includes(term) ||
      (p.phone || '').includes(term) ||
      (p.skinConcern || '').toLowerCase().includes(term)
    );
  });

  // ─── PATIENT DETAIL VIEW ─────────────────────────────────────
  if (selectedPhone) {
    return (
      <div className="admin-layout">
        {/* Sidebar */}
        <aside className="admin-sidebar">
          <div className="admin-sidebar-logo">
            <h2>GLEUHR</h2>
            <p>Skin Journal</p>
          </div>
          <nav className="admin-sidebar-nav">
            {/* Coach from MongoDB */}
            <button className="admin-sidebar-item active">
              <div className="admin-sidebar-avatar" style={{ background: '#c44033' }}>
                {details?.patient?.coachName ? getInitials(details.patient.coachName) : 'CO'}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Coach</div>
                <div style={{ fontSize: 11, opacity: 0.6 }}>{details?.patient?.coachName || '—'}</div>
              </div>
            </button>

            {/* Dietician from Airtable */}
            {selectedUser && (
              <button className="admin-sidebar-item">
                <div className="admin-sidebar-avatar" style={{ background: '#8B5CF6' }}>
                  {selectedUser.initials}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Dietician</div>
                  <div style={{ fontSize: 11, opacity: 0.6 }}>{selectedUser.name}</div>
                </div>
              </button>
            )}
          </nav>
          <div className="admin-sidebar-footer">
            <div>Airtable Sync: Live</div>
            <div>Last updated: {new Date().toISOString().split('T')[0]}</div>
          </div>
        </aside>

        {/* Main content */}
        <div className="admin-main">
          {detailsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
              <div className="w-8 h-8 border-4 border-[#c44033] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !details ? (
            <div style={{ textAlign: 'center', padding: 80, color: '#999' }}>
              <button onClick={goBack} style={{ color: '#c44033', fontWeight: 600, marginBottom: 16, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>
                &larr; Back to patients
              </button>
              <p>Could not load details</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="admin-header">
                <div className="admin-header-left">
                  <button onClick={goBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c44033', fontSize: 18, marginRight: 4 }}>
                    &larr;
                  </button>
                  <div className="admin-header-avatar">
                    {getInitials(details.patient.name)}
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{details.patient.name}</h2>
                    <div className="admin-header-meta">
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
                  <button className="log-call-btn">
                    <PhoneIcon size={14} /> Log Call
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="admin-tabs">
                {['overview', 'diet', 'photos', 'calls'].map(tab => (
                  <button
                    key={tab}
                    className={`admin-tab ${activeDetailTab === tab ? 'active' : ''}`}
                    onClick={() => setActiveDetailTab(tab)}
                  >
                    {{ overview: 'Overview', diet: 'Diet & Compliance', photos: 'Photos & Ratings', calls: 'Call History' }[tab]}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
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

  // ─── PATIENT LIST VIEW ────────────────────────────────────────
  return (
    <div className="patient-list-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
          <span style={{ color: '#c44033' }}>GLEUHR</span> Admin Dashboard
        </h1>
        <button
          onClick={fetchPatients}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#c44033', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, opacity: loading ? 0.5 : 1 }}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
        <input
          type="text"
          placeholder="Search by name, phone, or skin concern..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, outline: 'none' }}
        />
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', color: '#c44033', padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{error}</div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="w-8 h-8 border-4 border-[#c44033] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>No patients found</div>
      ) : (
        filtered.map((p) => (
          <div key={p.id} className="patient-card" onClick={() => openPatientDetails(p.phone)}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#c44033', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>
                  {getInitials(p.name)}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{p.phone} &middot; Day {p.currentDay}/90 &middot; {p.skinConcern || '—'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, background: p.isActive ? '#DCFCE7' : '#F3F4F6', color: p.isActive ? '#16A34A' : '#666', fontWeight: 600 }}>
                  {p.isActive ? 'Active' : 'Inactive'}
                </span>
                <button
                  style={{ padding: '6px 14px', background: '#c44033', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); openPatientDetails(p.phone); }}
                >
                  View Details
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── OVERVIEW TAB ──────────────────────────────────────────────
function OverviewTab({ details }) {
  const { patient, streak, consistency, reorder, weekGrid, skinTrajectory, last7Moods } = details;

  return (
    <>
      <div className="admin-grid-2">
        {/* Streak & Shields */}
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

        {/* Consistency Breakdown */}
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
        {/* Skin Score Trajectory */}
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

        {/* Reorder Status */}
        <div className="admin-card">
          <h4>Reorder Status (Auto-Detected)</h4>
          <div
            className="reorder-status-badge"
            style={{ background: reorder.daysRemaining > 14 ? '#DCFCE7' : '#FEF2F2', color: reorder.daysRemaining > 14 ? '#16A34A' : '#c44033' }}
          >
            {reorder.daysRemaining > 14 ? 'On Track' : 'Attention Needed'}
          </div>
          <div className="reorder-row">
            <span>Plan ends</span>
            <span className="reorder-val">{reorder.planEndDate || '—'}</span>
          </div>
          <div className="reorder-row">
            <span>Days remaining</span>
            <span className="reorder-val" style={{ color: reorder.daysRemaining <= 14 ? '#c44033' : '#16A34A' }}>{reorder.daysRemaining} days</span>
          </div>
          <div className="reorder-row">
            <span>Banner shown in app</span>
            <span>{reorder.bannerShown ? '\u2705' : '\u274C'}</span>
          </div>
          <div className="reorder-row">
            <span>Banner clicked</span>
            <span>{reorder.bannerClicked ? 'Yes' : 'No'}</span>
          </div>
          <div className="reorder-row">
            <span>New Treatment Plan (Airtable)</span>
            <span style={{ color: reorder.newTreatmentPlan ? '#16A34A' : '#c44033', fontWeight: 600 }}>
              {reorder.newTreatmentPlan ? '\u2705 Ready' : '\u274C Not yet'}
            </span>
          </div>
        </div>
      </div>

      <div className="admin-grid-2">
        {/* This Week */}
        <div className="admin-card">
          <h4>This Week</h4>
          <div className="week-grid">
            <table>
              <thead>
                <tr>
                  <th></th>
                  {weekGrid.map((d, i) => <th key={i}>{d.dayLabel}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 600, fontSize: 12 }}>AM</td>
                  {weekGrid.map((d, i) => (
                    <td key={i}>
                      {d.isFuture ? '\u2014' : d.completed === true ? '\u2705' : d.completed === false ? '\u274C' : '\u2014'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td style={{ fontWeight: 600, fontSize: 12 }}>PM</td>
                  {weekGrid.map((d, i) => (
                    <td key={i}>
                      {d.isFuture ? '\u2014' : d.completed === true ? '\u2705' : d.completed === false ? '\u274C' : '\u2014'}
                    </td>
                  ))}
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

        {/* Products */}
        <div className="admin-card">
          <h4>Products</h4>
          <div className="products-list">
            {patient.products && patient.products.length > 0 ? (
              patient.products.map(pr => (
                <span key={pr.id} className="product-chip">{pr.name}</span>
              ))
            ) : (
              <span style={{ color: '#999', fontSize: 13 }}>No products assigned</span>
            )}
          </div>
        </div>
      </div>

      {/* Coach Notes */}
      <div className="admin-card" style={{ marginBottom: 16 }}>
        <h4>Coach Notes</h4>
        <textarea
          className="coach-notes-area"
          placeholder="Add notes about this patient..."
          defaultValue={details.checkIns?.[0]?.notes || ''}
          readOnly
        />
      </div>
    </>
  );
}

// ─── DIET TAB ──────────────────────────────────────────────────
function DietTab({ details }) {
  const { dietPlan } = details;

  if (!dietPlan) {
    return (
      <div className="admin-card" style={{ textAlign: 'center', padding: 40, color: '#999' }}>
        No diet plan found in Airtable for this customer phone number
      </div>
    );
  }

  return (
    <div className="admin-card">
      <h3 style={{ marginBottom: 16 }}>🥗 Diet Plan</h3>
      <div style={{ display: 'grid', gap: 12 }}>
        <div>
          <strong>Plan:</strong> {dietPlan.planName || 'N/A'}
        </div>
        <div>
          <strong>Duration:</strong> {dietPlan.duration || 'N/A'}
        </div>
        <div>
          <strong>Calories:</strong> {dietPlan.calories || 'N/A'}
        </div>
        <div>
          <strong>Notes:</strong> {dietPlan.notes || 'N/A'}
        </div>
      </div>
    </div>
  );
}
  const [apiKey, setApiKey] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [selectedUser, setSelectedUser] = useState({
    name: 'Dr. Anjali Sharma',
    initials: 'AS',
    role: 'Senior Dietitian',
    type: 'dietitian',
    phone: '+91-98765-43210',
    email: 'anjali.sharma@gleuhr.com',
    experience: '8 years'
  });

  const ADMIN_API_KEY = 'gleuhr-admin-2024';

  useEffect(() => {
    // Check authentication
    const auth = sessionStorage.getItem('adminAuthenticated');
    if (auth === 'true') {
      setIsAuthenticated(true);
      loadDashboard();
    } else {
      setShowLogin(true);
    }
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/dashboard', {
        headers: {
          'X-Admin-API-Key': ADMIN_API_KEY
        }
      });

      if (response.status === 401) {
        sessionStorage.removeItem('adminAuthenticated');
        setIsAuthenticated(false);
        setShowLogin(true);
        return;
      }

      const data = await response.json();
      setDashboardData(data);
      setError(null);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    if (apiKey === ADMIN_API_KEY) {
      setIsAuthenticated(true);
      setShowLogin(false);
      sessionStorage.setItem('adminAuthenticated', 'true');
      loadDashboard();
    } else {
      alert('Invalid admin key');
    }
  };

  const selectUser = (user) => {
    setSelectedUser(user);
  };

  const viewPatient = async (patientId) => {
    try {
      // Get patient details by phone number from backend API
      const response = await fetch(`/api/admin/patient/${patientId}`, {
        headers: {
          'X-Admin-API-Key': ADMIN_API_KEY
        }
      });
      
      if (response.ok) {
        const patientData = await response.json();
        console.log('Patient details:', patientData);
        
        // Show patient details in a modal or navigate to detail page
        alert(`Patient Details:\n\nName: ${patientData.name}\nPhone: ${patientData.phone}\nDay: ${patientData.day}\nStreak: ${patientData.streak}\nConsistency: ${patientData.consistency}%\n\nRecent check-ins: ${patientData.recentCheckIns?.length || 0}\nSkin scores: ${patientData.skinScores?.length || 0}`);
      } else {
        console.error('Failed to fetch patient details');
        alert('Failed to load patient details');
      }
    } catch (error) {
      console.error('Error fetching patient details:', error);
      alert('Error loading patient details');
    }
  };

  const updateDateTime = () => {
    const now = new Date();
    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return now.toLocaleDateString('en-US', options);
  };

  const getAvatarColor = (type) => {
    const colors = {
      urgent: '#d44040',
      flagged: '#d4a017',
      call: '#c44033',
      reorder: '#2d9d5c'
    };
    return colors[type] || '#c44033';
  };

  const renderPatientCard = (patient, type) => {
    const initials = patient.name.split(' ').map(n => n[0]).join('').toUpperCase();
    const avatarColor = getAvatarColor(type);
    
    const metaInfo = [];
    if (patient.patientId) metaInfo.push(patient.patientId);
    if (patient.day) metaInfo.push(`Day ${patient.day}`);
    if (patient.streak !== undefined) metaInfo.push(`🔥${patient.streak}`);
    if (patient.consistency !== undefined) {
      const color = patient.consistency < 50 ? '#d44040' : 
                   patient.consistency < 75 ? '#e6820e' : '#2d9d5c';
      metaInfo.push(<span key="consistency" style={{ color }}>{patient.consistency}%</span>);
    }

    return (
      <div className="patient-card" key={patient._id} onClick={() => viewPatient(patient._id)}>
        <div className="patient-info">
          <div className="patient-avatar" style={{ background: avatarColor }}>
            {initials}
          </div>
          <div className="patient-details">
            <div className="patient-name">{patient.name}</div>
            <div className="patient-meta">{metaInfo.map((info, i) => (
              <React.Fragment key={i}>
                {info}
                {i < metaInfo.length - 1 && ' • '}
              </React.Fragment>
            ))}</div>
          </div>
        </div>
        <div className={`status-badge ${type}`}>{patient.status}</div>
        <div className="priority-text">{patient.priority || 'View details'}</div>
        <div className="arrow">→</div>
      </div>
    );
  };

  const renderTodayQueue = () => {
  if (!dashboardData || loading) return null;

    const sections = [];

    // Urgent patients
    if (dashboardData.patients.needAttention.length > 0) {
      sections.push(
        <div key="urgent">
          <div className="section-header">🔴 Urgent — Immediate Action</div>
          <div className="patient-list">
            {dashboardData.patients.needAttention.map(patient => renderPatientCard(patient, 'urgent'))}
          </div>
        </div>
      );
    }

    // Scheduled calls
    if (dashboardData.patients.scheduledCalls.length > 0) {
      sections.push(
        <div key="calls">
          <div className="section-header">📞 Scheduled Calls</div>
          <div className="patient-list">
            {dashboardData.patients.scheduledCalls.map(patient => renderPatientCard(patient, 'call'))}
          </div>
        </div>
      );
    }

    // Reorder conversations
    if (dashboardData.patients.reorderConversations.length > 0) {
      sections.push(
        <div key="reorder">
          <div className="section-header">✅ Reorder Conversations</div>
          <div className="patient-list">
            {dashboardData.patients.reorderConversations.map(patient => renderPatientCard(patient, 'reorder'))}
          </div>
        </div>
      );
    }

    if (sections.length === 0) {
      return <div className="loading">No patients in today's queue</div>;
    }

    return <div className="patient-section">{sections}</div>;
  };

  const renderAllPatients = () => {
  if (!dashboardData || loading) return null;

    const sections = [];

    // Urgent patients
    if (dashboardData.patients.needAttention.length > 0) {
      sections.push(
        <div key="urgent">
          <div className="section-header">🔴 Urgent — Immediate Action</div>
          <div className="patient-list">
            {dashboardData.patients.needAttention.map(patient => renderPatientCard(patient, 'urgent'))}
          </div>
        </div>
      );
    }

    // Flagged patients
    if (dashboardData.patients.flagged.length > 0) {
      sections.push(
        <div key="flagged">
          <div className="section-header">🟡 Flagged — Address This Week</div>
          <div className="patient-list">
            {dashboardData.patients.flagged.map(patient => renderPatientCard(patient, 'flagged'))}
          </div>
        </div>
      );
    }

    if (sections.length === 0) {
      return <div className="loading">All patients are doing well!</div>;
    }

    return <div className="patient-section">{sections}</div>;
  };

  const renderOnboardingPatients = () => {
  if (!dashboardData || loading) return null;

    if (dashboardData.patients.scheduledCalls.length === 0) {
      return <div className="loading">No new patients onboarding</div>;
    }

    return (
      <div className="patient-section">
        <div className="section-header">📞 Scheduled Calls</div>
        <div className="patient-list">
          {dashboardData.patients.scheduledCalls.map(patient => renderPatientCard(patient, 'call'))}
        </div>
      </div>
    );

  if (showLogin) {
    return (
      <div className="login-modal">
        <div className="login-content">
          <h2>Admin Login</h2>
          <input
            type="password"
            placeholder="Enter admin API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
          />
          <button onClick={handleLogin}>Login</button>
          <p>Demo key: gleuhr-admin-2024</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (loading) {
    return (
      <div className="admin-dashboard">
        <div className="loading">
          <div className="spinner"></div>
          Loading dashboard...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-dashboard">
        <div className="loading">{error}</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="admin-card">
        <h4>Diet Plan Details (from Airtable)</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 13 }}>
          <div>
            <span style={{ color: '#888' }}>Category</span>
            <p style={{ fontWeight: 600, margin: '4px 0 0' }}>{dietPlan.planCategory || '—'}</p>
          </div>
          <div>
            <span style={{ color: '#888' }}>Status</span>
            <p style={{ margin: '4px 0 0' }}>
              <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: dietPlan.status === 'Active' ? '#DCFCE7' : '#F3F4F6', color: dietPlan.status === 'Active' ? '#16A34A' : '#666' }}>
                {dietPlan.status}
              </span>
            </p>
          </div>
          <div>
            <span style={{ color: '#888' }}>Dietician</span>
            <p style={{ fontWeight: 600, margin: '4px 0 0' }}>{dietPlan.dieticianName || '—'}</p>
          </div>
          <div>
            <span style={{ color: '#888' }}>Dietician Phone</span>
            <p style={{ fontWeight: 600, margin: '4px 0 0' }}>{dietPlan.dieticianPhone || '—'}</p>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <h4>Restrictions</h4>
        {Array.isArray(dietPlan.restrictions) && dietPlan.restrictions.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {dietPlan.restrictions.map((r, i) => (
              <span key={i} style={{ padding: '4px 12px', background: '#FEF2F2', color: '#c44033', borderRadius: 16, fontSize: 12, fontWeight: 500 }}>{r}</span>
            ))}
          </div>
        ) : (
          <span style={{ color: '#999', fontSize: 13 }}>None specified</span>
        )}
      </div>

      <div className="admin-card">
        <h4>Recommendations</h4>
        <p style={{ fontSize: 13, color: '#333', whiteSpace: 'pre-wrap', background: '#FAF8F5', padding: 12, borderRadius: 8 }}>
          {dietPlan.recommendations || '—'}
        </p>
      </div>

      {dietPlan.notes && (
        <div className="admin-card">
          <h4>Notes</h4>
          <p style={{ fontSize: 13, color: '#333', whiteSpace: 'pre-wrap' }}>{dietPlan.notes}</p>
        </div>
      )}
    </div>
  );


// ─── PHOTOS TAB (placeholder) ──────────────────────────────────
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
              <span style={{ color: '#888' }}>{s.date ? new Date(s.date).toLocaleDateString() : '—'} (Day {s.day})</span>
              <span style={{ fontWeight: 700, color: s.totalScore >= 70 ? '#16A34A' : s.totalScore >= 40 ? '#CA8A04' : '#c44033' }}>
                {s.totalScore}/100
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── CALLS TAB (placeholder) ───────────────────────────────────
function CallsTab() {
  return (
    <div className="admin-card" style={{ textAlign: 'center', padding: 40, color: '#999' }}>
      <h4>Call History</h4>
      <p>Call logs will appear here once logged.</p>
    </div>
  );
} 
return (
    <div className="admin-dashboard">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h1>GLEUHR</h1>
          <p>Skin Journal</p>
        </div>
        
        <div className="user-selector">
          <button 
            className={`user-btn ${selectedUser.type === 'dietitian' ? 'active' : 'inactive'}`}
            onClick={() => selectUser({
              name: 'Dr. Anjali Sharma',
              initials: 'AS',
              role: 'Senior Dietitian',
              type: 'dietitian',
              phone: '+91-98765-43210',
              email: 'anjali.sharma@gleuhr.com',
              experience: '8 years'
            })}
          >
            <span className="user-icon">👩‍⚕️</span>
            <div>
              <div>Dietitian</div>
              <div className="user-subtitle">Dr. Anjali Sharma</div>
            </div>
          </button>
          
          <button 
            className={`user-btn ${selectedUser.type === 'coach' ? 'active' : 'inactive'}`}
            onClick={() => selectUser({
              name: 'Mary Chauhan',
              initials: 'MC',
              role: 'Skin Coach',
              type: 'coach',
              phone: '+91-87654-32109',
              email: 'mary.chauhan@gleuhr.com',
              experience: '5 years'
            })}
          >
            <span className="user-icon">👩‍⚕️</span>
            <div>
              <div>Coach</div>
              <div className="user-subtitle">Mary Chauhan</div>
            </div>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="content-header">
          <h2>Patient Management</h2>
          <div className="header-actions">
            <button 
              onClick={() => window.open('https://airtable.com/app/vi32916h5i4w/tbl3291316h5i4w', '_blank')}
              className="airtable-btn"
            >
              📊 Open Airtable
            </button>
            <button onClick={() => window.location.reload()}>
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="filter-tabs">
          <button 
            className={`filter-tab ${currentTab === 'today' ? 'active' : ''}`}
            onClick={() => setCurrentTab('today')}
          >
            <span>📋</span>Today's Queue
            <span className="badge urgent">
              {(dashboardData?.patients.needAttention.length || 0) + (dashboardData?.patients.scheduledCalls.length || 0)}
            </span>
          </button>
          <button 
            className={`filter-tab ${currentTab === 'all' ? 'active' : ''}`}
            onClick={() => setCurrentTab('all')}
          >
            All Patients
            <span className="badge all">{dashboardData?.summary?.activePatients || 0}</span>
          </button>
          <button 
            className={`filter-tab ${currentTab === 'onboarding' ? 'active' : ''}`}
            onClick={() => setCurrentTab('onboarding')}
          >
            Onboarding
            <span className="badge onboarding">{dashboardData?.patients.scheduledCalls.length || 0}</span>
          </button>
        </div>

        {/* Patient Content */}
        {currentTab === 'today' && renderTodayQueue()}
        {currentTab === 'all' && renderAllPatients()}
        {currentTab === 'onboarding' && renderOnboardingPatients()}
      </div>
    </div>
  );
}

export default AdminDashboard;
