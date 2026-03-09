import React, { useState, useEffect } from 'react';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [currentTab, setCurrentTab] = useState('today');
  const [dashboardData, setDashboardData] = useState({
    stats: { needAttention: 0, callsToday: 0, avgConsistency: 0, reorderDue: 0 },
    patients: { needAttention: [], flagged: [], scheduledCalls: [], reorderConversations: [] },
    summary: { totalPatients: 0, activePatients: 0, date: '' }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
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

  useEffect(() => {
    // Check authentication and restore API key
    const auth = sessionStorage.getItem('adminAuthenticated');
    const savedApiKey = sessionStorage.getItem('adminApiKey');
    
    if (auth === 'true' && savedApiKey) {
      setApiKey(savedApiKey);
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
          'X-Admin-API-Key': apiKey
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

  const handleLogin = async () => {
    if (!apiKey.trim()) {
      alert('Please enter an admin API key');
      return;
    }

    try {
      // Test the API key by making a request
      const response = await fetch('/api/admin/dashboard', {
        headers: {
          'X-Admin-API-Key': apiKey.trim()
        }
      });

      if (response.ok) {
        setIsAuthenticated(true);
        setShowLogin(false);
        sessionStorage.setItem('adminAuthenticated', 'true');
        sessionStorage.setItem('adminApiKey', apiKey.trim());
        loadDashboard();
      } else {
        alert('Invalid admin API key');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed. Please try again.');
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
          'X-Admin-API-Key': apiKey
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
  };

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
          <p>Contact your system administrator for the API key</p>
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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

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
            <span className="user-icon">🧴</span>
            <div>
              <div>Skin Coach</div>
              <div className="user-subtitle">Mary Chauhan</div>
            </div>
          </button>
          <button 
            className={`user-btn ${selectedUser.type === 'admin' ? 'active' : 'inactive'}`}
            onClick={() => selectUser({
              name: 'Priya Arora',
              initials: 'PA',
              role: 'Team Lead',
              type: 'admin',
              phone: '+91-76543-21098',
              email: 'priya.arora@gleuhr.com',
              experience: '10 years'
            })}
          >
            <span className="user-icon">�</span>
            <div>
              <div>Team Lead</div>
              <div className="user-subtitle">Priya Arora</div>
            </div>
          </button>
        </div>
        
        <div className="user-details">
          <div className="user-avatar">{selectedUser.initials}</div>
          <div>
            <div className="user-name">{selectedUser.name}</div>
            <div className="user-role">{selectedUser.role}</div>
          </div>
        </div>
        
        <div className="sidebar-footer">
          <div className="sync-status">📞 {selectedUser.phone}</div>
          <div className="sync-status">✉️ {selectedUser.email}</div>
          <div className="sync-status">💼 {selectedUser.experience} experience</div>
          <div className="sync-status" style={{ marginTop: '8px' }}>Airtable Sync: <strong>Live</strong></div>
          <div className="sync-status">Last updated: {new Date().toISOString().split('T')[0]}</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="header">
          <h1>{greeting}, {selectedUser.name.split(' ')[0]}</h1>
          <p>{updateDateTime()} · {dashboardData?.summary?.activePatients || 0} active patients</p>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card urgent">
            <div className="stat-value">{dashboardData?.stats.needAttention || 0}</div>
            <div className="stat-label">Need Attention</div>
          </div>
          <div className="stat-card calls">
            <div className="stat-value">{dashboardData?.stats.callsToday || 0}</div>
            <div className="stat-label">Calls Today</div>
          </div>
          <div className="stat-card consistency">
            <div className="stat-value">{dashboardData?.stats.avgConsistency || 0}%</div>
            <div className="stat-label">Avg Consistency</div>
          </div>
          <div className="stat-card reorder">
            <div className="stat-value">{dashboardData?.stats.reorderDue || 0}</div>
            <div className="stat-label">Reorder Due</div>
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
};

export default AdminDashboard;
