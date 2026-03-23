import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Phone as PhoneIcon, ArrowLeft, RefreshCw } from 'lucide-react';
import axios from 'axios';
import './AdminDashboard.css';

const adminApi = axios.create({ baseURL: '/api' });

adminApi.interceptors.request.use(config => {
  const token = localStorage.getItem('adminToken');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

const MOOD_MAP = { excellent: '😄', good: '🙂', fair: '😐', poor: '😞' };

function getInitials(name) {
  if (!name || name === 'Unknown') return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function avatarColor(name) {
  const colors = ['#c44033','#7C3AED','#0369A1','#065F46','#92400E','#9D174D','#1D4ED8'];
  if (!name) return colors[0];
  return colors[name.charCodeAt(0) % colors.length];
}

// ── Status badge colours ────────────────────────────────────────────────────
const CALL_STATUS_STYLE = {
  'Call Pending':   { bg: '#FEF3C7', color: '#92400E' },
  'Not Responding': { bg: '#FEE2E2', color: '#B91C1C' },
  'default':        { bg: '#F3F4F6', color: '#374151' }
};

const DIET_STATUS_STYLE = {
  'Diet Plan Shared':    { bg: '#DCFCE7', color: '#166534' },
  'Google Form Shared':  { bg: '#DBEAFE', color: '#1D4ED8' },
  'Intro Call Pending':  { bg: '#FEF9C3', color: '#713F12' },
  'Not Responding':      { bg: '#FEE2E2', color: '#B91C1C' },
  'default':             { bg: '#F3F4F6', color: '#374151' }
};

/**
 * Safely convert any value (including Airtable Collaborator objects {id,email,name})
 * to a plain string for rendering.
 */
function safeStr(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return safeStr(v[0]);
  if (typeof v === 'object') return v.name || v.email || '';
  return '';
}

function Badge({ label, styleMap }) {
  const labelStr = safeStr(label);
  const s = styleMap[labelStr] || styleMap['default'];
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {labelStr || '—'}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────────

// ── JWT helper (no-verify decode for role detection) ────────────────────────
function decodeToken(token) {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64));
  } catch { return null; }
}

export default function AdminDashboard() {
  const rawToken = localStorage.getItem('adminToken');
  const decoded  = decodeToken(rawToken);
  if (decoded?.role === 'team_lead') {
    return <TeamLeadDashboard teamLeadName={decoded.name || decoded.email || 'Team Lead'} />;
  }
  const [dietician, setDietician] = useState('Dt.Muskan');
  const [dieticians, setDieticians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');  // 'all' | 'inapp' | 'pending'

  // Detail view
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState('overview');

  // Load dietician list and auto-select the first one
  useEffect(() => {
    adminApi.get('/admin/dietician').then(({ data }) => {
      const list = data.data || [];
      setDieticians(list);
      if (list.length > 0) {
        const first = typeof list[0] === 'string' ? list[0] : (list[0]?.name || list[0]?.email || '');
        setDietician(prev => prev === 'Dt.Muskan' ? first : prev);
      }
    }).catch(() => {});
  }, []);

  // Load customers for selected dietician
  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelectedCustomer(null);
    setDetails(null);
    try {
      const { data } = await adminApi.get(`/admin/dietician/${encodeURIComponent(dietician)}/customers`);
      setCustomers(data.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [dietician]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  // Open customer detail
  const openDetail = async (customer) => {
    setSelectedCustomer(customer);
    setActiveDetailTab('overview');
    setDetails(null);

    if (customer.mongodb) {
      // Already have merged data from list — use it directly as base
      setDetails(customer);
      // Also fetch the richer /details endpoint for consistency, weekGrid etc.
      setDetailsLoading(true);
      try {
        const phone = customer.airtable.customerPhone;
        const dialCode = customer.airtable.dialCode || '';
        const fullPhone = dialCode ? `${dialCode}${phone}` : phone;
        const { data } = await adminApi.get(`/admin/patients/${encodeURIComponent(fullPhone)}/details`);
        // Merge the richer admin detail with existing airtable data
        setDetails(prev => ({ ...prev, richDetail: data.data }));
      } catch {
        // Use the merged data we already have
      } finally {
        setDetailsLoading(false);
      }
    }
    // For Airtable-only customers, we already have everything
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = {
    total: customers.length,
    inApp: customers.filter(c => c.mongodb).length,
    callPending: customers.filter(c => c.airtable.dieticianCallStatus === 'Call Pending').length,
    notResponding: customers.filter(c => c.airtable.dieticianCallStatus === 'Not Responding').length,
    dietShared: customers.filter(c => c.airtable.dietPlanStatus === 'Diet Plan Shared').length,
  };

  // ── Filter + search ────────────────────────────────────────────────────────
  let filtered = customers.filter(c => {
    if (activeTab === 'inapp' && !c.mongodb) return false;
    if (activeTab === 'pending' && c.airtable.dieticianCallStatus !== 'Call Pending') return false;
    const term = searchTerm.toLowerCase();
    const name = (c.airtable.customerName || '').toLowerCase();
    const phone = (c.airtable.customerPhone || '');
    return !term || name.includes(term) || phone.includes(term);
  });

  // ── DETAIL VIEW ─────────────────────────────────────────────────────────
  if (selectedCustomer) {
    return (
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-logo"><h2>GLEUHR</h2><p>Skin Journal</p></div>
          <nav className="admin-sidebar-nav">
            <div style={{ padding: '12px 16px 4px', fontSize: 10, fontWeight: 700, letterSpacing: 1, opacity: 0.4, textTransform: 'uppercase' }}>Coaches</div>
            {dieticians.map((d, i) => {
              const name = typeof d === 'string' ? d : (d?.name || d?.email || String(i));
              return (
                <button
                  key={name}
                  className={`admin-sidebar-item ${name === dietician ? 'active' : ''}`}
                  onClick={() => { setDietician(name); setSelectedCustomer(null); setDetails(null); }}
                >
                  <div className="admin-sidebar-avatar" style={{ background: avatarColor(name) }}>
                    {getInitials(name)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{name}</div>
                    <div style={{ fontSize: 11, opacity: 0.6 }}>Coach</div>
                  </div>
                </button>
              );
            })}
          </nav>
          <div className="admin-sidebar-footer">
            <div>Airtable Sync: Live</div>
            <div>Last updated: {new Date().toISOString().split('T')[0]}</div>
          </div>
        </aside>

        <div className="admin-main">
          {/* Back + Header */}
          <div className="admin-header">
            <div className="admin-header-left">
              <button onClick={() => setSelectedCustomer(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c44033', fontSize: 14, display:'flex',alignItems:'center',gap:4,fontWeight:600 }}>
                <ArrowLeft size={16}/> Back to queue
              </button>
            </div>
          </div>

          <CustomerDetailView
            customer={selectedCustomer}
            details={details}
            detailsLoading={detailsLoading}
            activeTab={activeDetailTab}
            setActiveTab={setActiveDetailTab}
          />
        </div>
      </div>
    );
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────────
  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-logo"><h2>GLEUHR</h2><p>Skin Journal</p></div>
        <nav className="admin-sidebar-nav">
          <div style={{ padding: '12px 16px 4px', fontSize: 10, fontWeight: 700, letterSpacing: 1, opacity: 0.4, textTransform: 'uppercase' }}>Coaches</div>
          {dieticians.map((d, i) => {
            const name = typeof d === 'string' ? d : (d?.name || d?.email || String(i));
            return (
              <button
                key={name}
                className={`admin-sidebar-item ${name === dietician ? 'active' : ''}`}
                onClick={() => setDietician(name)}
              >
                <div className="admin-sidebar-avatar" style={{ background: avatarColor(name) }}>
                  {getInitials(name)}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{name}</div>
                  <div style={{ fontSize: 11, opacity: 0.6 }}>Coach</div>
                </div>
              </button>
            );
          })}
        </nav>
        <div className="admin-sidebar-footer">
          <div>Airtable Sync: Live</div>
          <div>Last updated: {new Date().toISOString().split('T')[0]}</div>
        </div>
      </aside>

      {/* Main */}
      <div className="admin-main">
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
              {dietician}'s Patients
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: '#888' }}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              &nbsp;·&nbsp;{stats.total} total customers
            </p>
          </div>
          <button onClick={fetchCustomers} disabled={loading} style={{ display:'flex',alignItems:'center',gap:4,color:'#c44033',fontWeight:600,background:'none',border:'none',cursor:'pointer',fontSize:13,opacity:loading?0.5:1 }}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''}/> Refresh
          </button>
        </div>

        {/* Stats cards */}
        <div className="admin-stats-row">
          <StatCard label="Total Customers" value={stats.total} color="#374151" />
          <StatCard label="Using the App" value={stats.inApp} color="#7C3AED" />
          <StatCard label="Call Pending" value={stats.callPending} color="#92400E" />
          <StatCard label="Not Responding" value={stats.notResponding} color="#B91C1C" />
          <StatCard label="Diet Plan Shared" value={stats.dietShared} color="#166534" />
        </div>

        {/* Tabs + search */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: `All Patients ${stats.total}` },
            { key: 'inapp', label: `In App ${stats.inApp}` },
            { key: 'pending', label: `Call Pending ${stats.callPending}` },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{ padding: '5px 14px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: activeTab === t.key ? '#c44033' : '#F3F4F6',
                color: activeTab === t.key ? '#fff' : '#374151' }}
            >
              {t.label}
            </button>
          ))}
          <div style={{ flex: 1, position: 'relative', minWidth: 200 }}>
            <Search size={14} style={{ position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'#999' }}/>
            <input
              type="text"
              placeholder="Search name or phone..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width:'100%',padding:'6px 10px 6px 30px',border:'1px solid #ddd',borderRadius:8,fontSize:12,outline:'none' }}
            />
          </div>
        </div>

        {error && (
          <div style={{ background:'#FEF2F2',color:'#c44033',padding:12,borderRadius:8,fontSize:13,marginBottom:12 }}>{error}</div>
        )}

        {loading ? (
          <div style={{ display:'flex',justifyContent:'center',padding:60 }}>
            <div style={{ width:28,height:28,border:'3px solid #c44033',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.7s linear infinite' }}/>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center',padding:60,color:'#999' }}>
            {activeTab === 'inapp' ? 'No customers using the app yet' : 'No customers found'}
          </div>
        ) : (
          <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
            {filtered.map((c, i) => (
              <CustomerCard key={c.airtable.id || i} customer={c} onView={() => openDetail(c)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color }) {
  return (
    <div className="admin-stat-card">
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ── Customer list card ───────────────────────────────────────────────────────
function CustomerCard({ customer, onView }) {
  const { airtable, mongodb } = customer;
  const name = safeStr(airtable.customerName) || 'Unknown';
  const phone = airtable.dialCode ? `+${safeStr(airtable.dialCode)} ${safeStr(airtable.customerPhone)}` : safeStr(airtable.customerPhone);

  return (
    <div className="patient-card" style={{ cursor: 'pointer' }} onClick={onView}>
      <div style={{ display:'flex',alignItems:'center',gap:12 }}>
        {/* Avatar */}
        <div style={{ width:42,height:42,borderRadius:'50%',background:avatarColor(name),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14,flexShrink:0 }}>
          {getInitials(name)}
        </div>

        {/* Info */}
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ display:'flex',alignItems:'center',gap:8,flexWrap:'wrap' }}>
            <span style={{ fontWeight:600,fontSize:14 }}>{name}</span>
            {airtable.treatmentPlan && (
              <span style={{ fontSize:11,color:'#888',fontFamily:'monospace' }}>{safeStr(airtable.treatmentPlan)}</span>
            )}
            {mongodb && (
              <span style={{ fontSize:10,padding:'1px 7px',borderRadius:99,background:'#EDE9FE',color:'#6D28D9',fontWeight:700 }}>In App</span>
            )}
          </div>
          <div style={{ fontSize:12,color:'#888',marginTop:2,display:'flex',gap:8,flexWrap:'wrap',alignItems:'center' }}>
            <span>{phone}</span>
            {mongodb && <span>Day {mongodb.currentDay}/90</span>}
            {mongodb && mongodb.streak?.currentStreak > 0 && (
              <span>🔥 {mongodb.streak.currentStreak} streak</span>
            )}
            {mongodb && mongodb.latestSkinScore && (
              <span>Skin: {mongodb.latestSkinScore.totalScore}/20</span>
            )}
          </div>
        </div>

        {/* Badges + button */}
        <div style={{ display:'flex',alignItems:'center',gap:6,flexShrink:0,flexWrap:'wrap',justifyContent:'flex-end' }}>
          <Badge label={airtable.dieticianCallStatus} styleMap={CALL_STATUS_STYLE} />
          {airtable.dietPlanStatus && <Badge label={airtable.dietPlanStatus} styleMap={DIET_STATUS_STYLE} />}
          <button
            style={{ padding:'6px 14px',background:'#c44033',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap' }}
            onClick={e => { e.stopPropagation(); onView(); }}
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Customer detail view ─────────────────────────────────────────────────────
function CustomerDetailView({ customer, details, detailsLoading, activeTab, setActiveTab }) {
  const { airtable, mongodb } = customer;
  const name = safeStr(airtable.customerName) || 'Unknown';
  const phone = airtable.dialCode ? `+${safeStr(airtable.dialCode)} ${safeStr(airtable.customerPhone)}` : safeStr(airtable.customerPhone);

  const rich = details?.richDetail;   // from /api/admin/patients/:phone/details
  const hasApp = !!mongodb;

  return (
    <>
      {/* Patient header */}
      <div className="admin-header" style={{ marginBottom: 16 }}>
        <div className="admin-header-left">
          <div className="admin-header-avatar" style={{ background: avatarColor(name) }}>
            {getInitials(name)}
          </div>
          <div>
            <h2 style={{ margin:0,fontSize:18,fontWeight:700 }}>{name}</h2>
            <div className="admin-header-meta">
              {airtable.treatmentPlan && <span>{safeStr(airtable.treatmentPlan)}</span>}
              <span>{phone}</span>
              {hasApp && <span>Day {mongodb.currentDay}/90</span>}
              {hasApp && <Badge label={airtable.dieticianCallStatus} styleMap={CALL_STATUS_STYLE} />}
              {airtable.dietPlanStatus && <Badge label={airtable.dietPlanStatus} styleMap={DIET_STATUS_STYLE} />}
            </div>
          </div>
        </div>
        <div className="admin-header-right">
          {hasApp && mongodb.streak?.daysAbsent > 0 && (
            <span className="absent-badge">{mongodb.streak.daysAbsent} Days Absent</span>
          )}
          <button className="log-call-btn"><PhoneIcon size={14}/> Log Call</button>
        </div>
      </div>

      {/* Tabs — show full tabs only for app users */}
      <div className="admin-tabs">
        {['overview', 'diet', ...(hasApp ? ['photos', 'calls'] : [])].map(tab => (
          <button
            key={tab}
            className={`admin-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {{ overview: 'Overview', diet: 'Diet & Compliance', photos: 'Photos & Ratings', calls: 'Call History' }[tab]}
          </button>
        ))}
      </div>

      <div className="admin-content">
        {activeTab === 'overview' && (
          <OverviewTab customer={customer} rich={rich} detailsLoading={detailsLoading} />
        )}
        {activeTab === 'diet' && <DietTab airtable={airtable} />}
        {activeTab === 'photos' && hasApp && <PhotosTab rich={rich} mongodb={mongodb} />}
        {activeTab === 'calls' && <CallsTab />}
      </div>
    </>
  );
}

// ── Overview tab ─────────────────────────────────────────────────────────────
function OverviewTab({ customer, rich, detailsLoading }) {
  const { airtable, mongodb } = customer;

  if (!mongodb) {
    // Airtable-only customer
    return (
      <div className="admin-grid-2">
        <div className="admin-card">
          <h4>Airtable Record</h4>
          <div style={{ display:'grid',gap:10,fontSize:13 }}>
            <div><strong>Treatment Plan:</strong> {safeStr(airtable.treatmentPlan) || '—'}</div>
            <div><strong>Call Status:</strong> <Badge label={airtable.dieticianCallStatus} styleMap={CALL_STATUS_STYLE}/></div>
            <div><strong>Diet Plan Status:</strong> <Badge label={airtable.dietPlanStatus} styleMap={DIET_STATUS_STYLE}/></div>
            {airtable.dietPlanDate && <div><strong>Diet Plan Due:</strong> {new Date(airtable.dietPlanDate).toLocaleDateString()}</div>}
          </div>
          <div style={{ marginTop:20,padding:12,background:'#F9FAFB',borderRadius:8,color:'#888',fontSize:12 }}>
            This customer hasn't registered on the Gleuhr Skin Journal app yet. No streak, check-in, or skin score data available.
          </div>
        </div>
        <div className="admin-card">
          <h4>Products</h4>
          <div className="products-list">
            {airtable.products && airtable.products.length > 0 ? (
              airtable.products.map((p, i) => <span key={i} className="product-chip">{p}</span>)
            ) : (
              <span style={{ color:'#999',fontSize:13 }}>No products assigned</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // App user — full view
  const streak = mongodb.streak || {};
  const consistency = rich?.consistency || {};
  const weekGrid = rich?.weekGrid || [];
  const skinTrajectory = rich?.skinTrajectory || [];
  const last7Moods = rich?.last7Moods || [];
  const reorder = rich?.reorder || {};

  return (
    <>
      {detailsLoading && (
        <div style={{ fontSize:12,color:'#888',marginBottom:8,display:'flex',alignItems:'center',gap:6 }}>
          <div style={{ width:12,height:12,border:'2px solid #c44033',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.7s linear infinite' }}/>
          Loading full details...
        </div>
      )}

      <div className="admin-grid-2">
        {/* Streak & Shields */}
        <div className="admin-card">
          <h4>Streak &amp; Shields</h4>
          <div className="streak-row">
            <div className="streak-item">
              <span style={{ fontSize:24 }}>🔥</span>
              <span className="streak-num">{streak.currentStreak || 0}</span>
              <span className="streak-label">Current</span>
            </div>
            <div className="streak-item">
              <span className="streak-num" style={{ fontSize:20 }}>{streak.longestStreak || 0}</span>
              <span className="streak-label">Best</span>
            </div>
            <div className="streak-item">
              <span style={{ fontSize:20 }}>🛡️</span>
              <span className="streak-num" style={{ fontSize:20 }}>{rich?.streak?.shields || 0}</span>
              <span className="streak-label">Shields</span>
            </div>
          </div>
          {streak.daysAbsent > 0 && (
            <div style={{ marginTop:8,fontSize:12,color:'#B91C1C',fontWeight:600 }}>⚠️ {streak.daysAbsent} days absent</div>
          )}
          <button className="restore-btn">🛡️ Restore Shield</button>
        </div>

        {/* Consistency */}
        <div className="admin-card">
          <h4>Consistency Breakdown</h4>
          {consistency.overall !== undefined ? (
            [
              { label: 'Overall', value: consistency.overall },
              { label: 'Sunscreen', value: consistency.sunscreen },
              { label: 'Diet', value: consistency.diet }
            ].map(item => (
              <div className="consistency-row" key={item.label}>
                <span className="consistency-label">{item.label}</span>
                <div className="consistency-bar-bg">
                  <div className="consistency-bar" style={{ width:`${item.value}%` }}/>
                </div>
                <span className="consistency-pct">{item.value}%</span>
              </div>
            ))
          ) : (
            <div style={{ color:'#888',fontSize:13 }}>
              {detailsLoading ? 'Loading…' : 'Consistency data unavailable'}
            </div>
          )}
        </div>
      </div>

      <div className="admin-grid-2">
        {/* Skin Score Trajectory */}
        <div className="admin-card">
          <h4>Skin Score Trajectory</h4>
          {skinTrajectory.length > 0 ? (
            <div className="trajectory-row">
              {skinTrajectory.map(s => (
                <div className="trajectory-col" key={s.day}>
                  {s.totalScore != null ? (
                    <>
                      <span className="trajectory-score">{s.totalScore}</span>
                      <div className="trajectory-bar-container">
                        <div className="trajectory-bar" style={{ height:`${Math.max((s.totalScore/20)*100, 5)}%` }}/>
                      </div>
                    </>
                  ) : <span style={{ color:'#ccc',fontSize:18 }}>—</span>}
                  <span className="trajectory-day">Day {s.day}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color:'#999',fontSize:13 }}>
              {mongodb.latestSkinScore
                ? `Latest score: ${mongodb.latestSkinScore.totalScore}/20`
                : 'No skin scores yet'}
            </div>
          )}
        </div>

        {/* Reorder / Plan status */}
        <div className="admin-card">
          <h4>Plan Status</h4>
          {reorder.daysRemaining !== undefined ? (
            <>
              <div className="reorder-status-badge" style={{ background: reorder.daysRemaining > 14 ? '#DCFCE7' : '#FEF2F2', color: reorder.daysRemaining > 14 ? '#16A34A' : '#c44033' }}>
                {reorder.daysRemaining > 14 ? 'On Track' : 'Attention Needed'}
              </div>
              <div className="reorder-row"><span>Plan ends</span><span className="reorder-val">{reorder.planEndDate || '—'}</span></div>
              <div className="reorder-row"><span>Days remaining</span><span className="reorder-val" style={{ color: reorder.daysRemaining <= 14 ? '#c44033' : '#16A34A' }}>{reorder.daysRemaining} days</span></div>
            </>
          ) : (
            <div style={{ display:'grid',gap:8,fontSize:13 }}>
              <div><strong>Airtable Status:</strong> <Badge label={airtable.dieticianCallStatus} styleMap={CALL_STATUS_STYLE}/></div>
              <div><strong>Diet Plan Status:</strong> <Badge label={airtable.dietPlanStatus} styleMap={DIET_STATUS_STYLE}/></div>
              {airtable.dietPlanDate && <div><strong>Due date:</strong> {new Date(airtable.dietPlanDate).toLocaleDateString()}</div>}
            </div>
          )}
        </div>
      </div>

      <div className="admin-grid-2">
        {/* This Week + Mood */}
        <div className="admin-card">
          <h4>This Week</h4>
          {weekGrid.length > 0 ? (
            <>
              <div className="week-grid">
                <table>
                  <thead>
                    <tr><th></th>{weekGrid.map((d, i) => <th key={i}>{d.dayLabel}</th>)}</tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight:600,fontSize:12 }}>AM</td>
                      {weekGrid.map((d, i) => <td key={i}>{d.isFuture ? '—' : d.amCompleted === true ? '✅' : d.amCompleted === false ? '❌' : '—'}</td>)}
                    </tr>
                    <tr>
                      <td style={{ fontWeight:600,fontSize:12 }}>PM</td>
                      {weekGrid.map((d, i) => <td key={i}>{d.isFuture ? '—' : d.pmCompleted === true ? '✅' : d.pmCompleted === false ? '❌' : '—'}</td>)}
                    </tr>
                  </tbody>
                </table>
              </div>
              <h4 style={{ marginTop:16 }}>Skin Mood (7 Days)</h4>
              <div className="mood-row">
                {(last7Moods || []).map((m, i) => <span key={i} className="mood-emoji">{m ? (MOOD_MAP[m] || '—') : '—'}</span>)}
              </div>
            </>
          ) : (
            <div style={{ color:'#999',fontSize:13 }}>
              {detailsLoading ? 'Loading...' : `Last 7 days: ${mongodb.last7Days?.checkInsCompleted || 0}/7 check-ins completed`}
            </div>
          )}
        </div>

        {/* Products — sourced from Airtable Diet Plan table */}
        <div className="admin-card">
          <h4>Products</h4>
          <div className="products-list">
            {airtable.products && airtable.products.length > 0 ? (
              airtable.products.map((p, i) => <span key={i} className="product-chip">{p}</span>)
            ) : (
              <span style={{ color:'#999',fontSize:13 }}>No products assigned</span>
            )}
          </div>
        </div>
      </div>

      {/* Coach Notes */}
      <div className="admin-card" style={{ marginBottom: 16 }}>
        <h4>Coach Notes</h4>
        <textarea
          className="coach-notes-area"
          placeholder="No notes yet..."
          readOnly
        />
      </div>
    </>
  );
}

// ── Diet tab ─────────────────────────────────────────────────────────────────
function DietTab({ airtable }) {
  return (
    <div className="admin-card">
      <h3 style={{ marginBottom:16 }}>Diet Plan (Airtable)</h3>
      <div style={{ display:'grid',gap:12,fontSize:13 }}>
        <div><strong>Customer:</strong> {safeStr(airtable.customerName) || '—'}</div>
        <div><strong>Phone:</strong> {airtable.customerPhone ? `+${safeStr(airtable.dialCode)} ${safeStr(airtable.customerPhone)}` : '—'}</div>
        <div><strong>Treatment Plan:</strong> {safeStr(airtable.treatmentPlan) || '—'}</div>
        <div><strong>Call Status:</strong> <Badge label={airtable.dieticianCallStatus} styleMap={CALL_STATUS_STYLE}/></div>
        <div><strong>Diet Plan Status:</strong> <Badge label={airtable.dietPlanStatus} styleMap={DIET_STATUS_STYLE}/></div>
        {airtable.dietPlanDate && <div><strong>Diet Plan Due Date:</strong> {new Date(airtable.dietPlanDate).toLocaleDateString()}</div>}
      </div>
    </div>
  );
}

// ── Photos tab ───────────────────────────────────────────────────────────────
function PhotosTab({ rich, mongodb }) {
  const skinScores = rich?.skinScores || mongodb?.skinScoreHistory || [];
  const photos = mongodb?.weeklyPhotos || [];

  return (
    <div className="admin-card">
      <h4>Photos &amp; Skin Scores</h4>
      {photos.length > 0 && (
        <div style={{ display:'flex',gap:10,overflowX:'auto',paddingBottom:8,marginBottom:16 }}>
          {photos.map(p => (
            <div key={p.weekNumber} style={{ flexShrink:0,textAlign:'center' }}>
              {p.photoUrl ? (
                <img src={p.photoUrl} alt={`Week ${p.weekNumber}`} style={{ width:80,height:80,objectFit:'cover',borderRadius:8 }}/>
              ) : (
                <div style={{ width:80,height:80,background:'#F3F4F6',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:'#999' }}>No photo</div>
              )}
              <div style={{ fontSize:10,color:'#888',marginTop:4 }}>Week {p.weekNumber}</div>
            </div>
          ))}
        </div>
      )}

      {skinScores.length > 0 ? (
        <div>
          <h4 style={{ fontSize:11,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'#555',marginBottom:8 }}>Skin Score History</h4>
          {skinScores.slice(0,12).map((s, i) => (
            <div key={i} style={{ display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid #f5f5f5',fontSize:13 }}>
              <span style={{ color:'#888' }}>{s.date ? new Date(s.date).toLocaleDateString() : '—'} (Day {s.day})</span>
              <span style={{ fontWeight:700,color: s.totalScore >= 14 ? '#16A34A' : s.totalScore >= 8 ? '#CA8A04' : '#c44033' }}>
                {s.totalScore}/20
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color:'#999',fontSize:13 }}>No skin scores recorded yet.</p>
      )}
    </div>
  );
}

// ── Calls tab ────────────────────────────────────────────────────────────────
function CallsTab() {
  return (
    <div className="admin-card" style={{ textAlign:'center',padding:40,color:'#999' }}>
      <h4>Call History</h4>
      <p>Call logs will appear here once logged.</p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TEAM LEAD DASHBOARD
// ════════════════════════════════════════════════════════════════════════════

function computeCoachStats(customers) {
  const appPatients = customers.filter(c => c.mongodb);
  const total = customers.length;

  const consistencies = appPatients.map(c => {
    const ci = c.mongodb?.last7Days?.checkInsCompleted ?? 0;
    return Math.round((ci / 7) * 100);
  });
  const avgConsistency = consistencies.length > 0
    ? Math.round(consistencies.reduce((a, b) => a + b, 0) / consistencies.length) : 0;

  const skinScores = appPatients.map(c => c.mongodb?.latestSkinScore?.totalScore).filter(v => v != null);
  const avgSkinScore = skinScores.length > 0
    ? parseFloat((skinScores.reduce((a, b) => a + b, 0) / skinScores.length).toFixed(1)) : 0;

  const urgent  = appPatients.filter(c => (c.mongodb?.streak?.daysAbsent ?? 0) >= 3).length;
  const flagged = appPatients.filter(c => {
    const ci = c.mongodb?.last7Days?.checkInsCompleted ?? 0;
    const absent = c.mongodb?.streak?.daysAbsent ?? 0;
    return absent >= 1 || ci < 4;
  }).length;
  const reorderDue = appPatients.filter(c => (c.mongodb?.currentDay ?? 0) >= 78).length;
  const retained   = appPatients.filter(c => (c.mongodb?.currentDay ?? 0) >= 28).length;

  return { total: appPatients.length, calls: total, avgConsistency, avgSkinScore, urgent, flagged, reorderDue, retained };
}

function TeamStatCard({ value, label, color }) {
  return (
    <div style={{
      flex: 1, background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12,
      padding: '20px', textAlign: 'center', borderTop: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 32, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{label}</div>
    </div>
  );
}

function CoachCard({ name, stats, loading }) {
  if (loading) {
    return (
      <div className="admin-card" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight: 180 }}>
        <div style={{ width:20, height:20, border:'2px solid #c44033', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
      </div>
    );
  }
  const metrics = [
    { label: 'Avg Consistency', value: `${stats.avgConsistency}%`, color: stats.avgConsistency >= 70 ? '#f59e0b' : stats.avgConsistency >= 50 ? '#f59e0b' : '#c44033' },
    { label: 'Avg Skin Score',  value: stats.avgSkinScore,         color: '#1a1a1a' },
    { label: 'Flagged',         value: stats.flagged,              color: stats.flagged > 0 ? '#f59e0b' : '#16a34a' },
    { label: 'Reorder Due',     value: stats.reorderDue,           color: '#1a1a1a' },
    { label: 'Retained',        value: stats.retained,             color: stats.retained > 0 ? '#16a34a' : '#1a1a1a' },
    { label: 'Calls (Total)',   value: stats.calls,                color: '#1a1a1a', bold: true },
  ];
  return (
    <div className="admin-card">
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
        <div style={{ width:40, height:40, borderRadius:10, background:avatarColor(name), color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:13, flexShrink:0 }}>
          {getInitials(name)}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700, fontSize:14 }}>{name}</div>
          <div style={{ fontSize:12, color:'#888' }}>{stats.total} patients</div>
        </div>
        {stats.urgent > 0 && (
          <span style={{ fontSize:11, fontWeight:700, background:'#FEE2E2', color:'#B91C1C', padding:'2px 8px', borderRadius:99 }}>
            {stats.urgent} urgent
          </span>
        )}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 16px' }}>
        {metrics.map(({ label, value, color, bold }) => (
          <div key={label}>
            <div style={{ fontSize:11, color:'#aaa', marginBottom:2 }}>{label}</div>
            <div style={{ fontSize:18, fontWeight: bold ? 700 : 600, color }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamLeadDashboard({ teamLeadName }) {
  const [coaches, setCoaches]     = useState([]);
  const [coachData, setCoachData] = useState({});
  const [loadingList, setLoadingList] = useState(true);
  const [activeTab, setActiveTab] = useState('performance');

  useEffect(() => {
    adminApi.get('/admin/dietician').then(({ data }) => {
      const list = (data.data || []).map(d => typeof d === 'string' ? d : (d?.name || d?.email || ''));
      setCoaches(list);
      setLoadingList(false);
      list.forEach(coach => {
        setCoachData(prev => ({ ...prev, [coach]: { customers: [], loading: true } }));
        adminApi.get(`/admin/dietician/${encodeURIComponent(coach)}/customers`)
          .then(({ data: d }) => setCoachData(prev => ({ ...prev, [coach]: { customers: d.data || [], loading: false } })))
          .catch(()          => setCoachData(prev => ({ ...prev, [coach]: { customers: [],    loading: false } })));
      });
    }).catch(() => setLoadingList(false));
  }, []);

  const coachStats = useMemo(() => {
    const out = {};
    coaches.forEach(coach => {
      out[coach] = computeCoachStats(coachData[coach]?.customers || []);
    });
    return out;
  }, [coaches, coachData]);

  const teamTotals = useMemo(() => {
    const vals = Object.values(coachStats);
    const totalUrgent         = vals.reduce((s, v) => s + v.urgent, 0);
    const totalReorderDue     = vals.reduce((s, v) => s + v.reorderDue, 0);
    const totalRetained       = vals.reduce((s, v) => s + v.retained, 0);
    const totalPatients       = vals.reduce((s, v) => s + v.calls, 0);
    const activeCons = vals.filter(v => v.total > 0).map(v => v.avgConsistency);
    const teamAvgConsistency  = activeCons.length > 0
      ? Math.round(activeCons.reduce((a, b) => a + b, 0) / activeCons.length) : 0;
    return { totalUrgent, teamAvgConsistency, totalReorderDue, totalRetained, totalPatients };
  }, [coachStats]);

  const escalations = useMemo(() =>
    coaches.flatMap(coach =>
      (coachData[coach]?.customers || [])
        .filter(c => c.mongodb && (c.mongodb?.streak?.daysAbsent ?? 0) >= 3)
        .map(c => ({ ...c, coachName: coach }))
    ), [coaches, coachData]);

  const allPatients = useMemo(() =>
    coaches.flatMap(coach =>
      (coachData[coach]?.customers || []).map(c => ({ ...c, coachName: coach }))
    ), [coaches, coachData]);

  const anyLoading = loadingList || Object.values(coachData).some(d => d.loading);

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-logo"><h2>GLEUHR</h2><p>Skin Journal</p></div>
        <nav className="admin-sidebar-nav">
          <div style={{ padding:'12px 16px 4px', fontSize:10, fontWeight:700, letterSpacing:1, opacity:0.4, textTransform:'uppercase' }}>Team</div>
          <div className="admin-sidebar-item active">
            <div className="admin-sidebar-avatar" style={{ background: avatarColor(teamLeadName) }}>
              {getInitials(teamLeadName)}
            </div>
            <div>
              <div style={{ fontWeight:600, fontSize:13 }}>{teamLeadName}</div>
              <div style={{ fontSize:11, opacity:0.6 }}>Team Lead</div>
            </div>
          </div>
          {coaches.length > 0 && (
            <>
              <div style={{ padding:'12px 16px 4px', fontSize:10, fontWeight:700, letterSpacing:1, opacity:0.4, textTransform:'uppercase' }}>Coaches</div>
              {coaches.map(coach => (
                <div key={coach} className="admin-sidebar-item" style={{ cursor:'default' }}>
                  <div className="admin-sidebar-avatar" style={{ background: avatarColor(coach) }}>
                    {getInitials(coach)}
                  </div>
                  <div>
                    <div style={{ fontWeight:500, fontSize:13 }}>{coach}</div>
                    <div style={{ fontSize:11, opacity:0.6 }}>Coach · {coachStats[coach]?.calls ?? 0} patients</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </nav>
        <div className="admin-sidebar-footer">
          <div>Airtable Sync: Live</div>
          <div>Last updated: {new Date().toISOString().split('T')[0]}</div>
        </div>
      </aside>

      {/* Main */}
      <div className="admin-main">
        {/* Header */}
        <div style={{ marginBottom:20 }}>
          <h1 style={{ margin:0, fontSize:24, fontWeight:700 }}>Team Overview — {teamLeadName}</h1>
          <p style={{ margin:'4px 0 0', fontSize:13, color:'#888' }}>
            {coaches.length} coaches · {teamTotals.totalPatients} total patients
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:4, marginBottom:20, background:'#fff', border:'1px solid #e5e5e5', borderRadius:12, padding:6 }}>
          {[
            { key:'performance',  label:'🔥 Team Performance' },
            { key:'escalations',  label:'📋 Escalations',  count: escalations.length },
            { key:'all',          label:'All Patients',     count: allPatients.length },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding:'7px 16px', border:'none', borderRadius:8, cursor:'pointer',
                fontSize:13, fontWeight:600,
                background: activeTab === tab.key ? '#fff' : 'transparent',
                boxShadow: activeTab === tab.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                color: activeTab === tab.key ? '#1a1a1a' : '#888',
              }}
            >
              {tab.label}{tab.count !== undefined ? ` ${tab.count}` : ''}
            </button>
          ))}
        </div>

        {anyLoading && coaches.length === 0 ? (
          <div style={{ display:'flex', justifyContent:'center', padding:60 }}>
            <div style={{ width:28, height:28, border:'3px solid #c44033', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
          </div>
        ) : activeTab === 'performance' ? (
          <>
            {/* Stats row */}
            <div style={{ display:'flex', gap:12, marginBottom:20 }}>
              <TeamStatCard value={teamTotals.totalUrgent}        label="Total Urgent"          color="#c44033" />
              <TeamStatCard value={`${teamTotals.teamAvgConsistency}%`} label="Team Avg Consistency" color="#16a34a" />
              <TeamStatCard value={teamTotals.totalReorderDue}    label="Reorders Due"           color="#2563eb" />
              <TeamStatCard value={teamTotals.totalRetained}      label="Retained"               color="#7c3aed" />
            </div>

            {/* Coach cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:20 }}>
              {coaches.map(coach => (
                <CoachCard
                  key={coach}
                  name={coach}
                  stats={coachStats[coach] || {}}
                  loading={coachData[coach]?.loading ?? true}
                />
              ))}
            </div>

            {/* Consistency comparison */}
            <div className="admin-card">
              <h4>COACH CONSISTENCY COMPARISON</h4>
              {coaches.map(coach => {
                const pct   = coachStats[coach]?.avgConsistency ?? 0;
                const color = pct >= 50 ? '#f59e0b' : '#e5e5e5';
                return (
                  <div key={coach} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                    <div style={{ width:80, fontSize:13, fontWeight:600, flexShrink:0 }}>{coach.split(' ')[0]}</div>
                    <div style={{ flex:1, height:10, background:'#f0ebe6', borderRadius:5, overflow:'hidden' }}>
                      <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:5, transition:'width 0.6s' }} />
                    </div>
                    <div style={{ width:36, fontSize:13, fontWeight:700, color: pct >= 50 ? '#f59e0b' : '#999', textAlign:'right' }}>{pct}%</div>
                  </div>
                );
              })}
            </div>
          </>
        ) : activeTab === 'escalations' ? (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {escalations.length === 0
              ? <div style={{ textAlign:'center', padding:60, color:'#999' }}>No escalations right now</div>
              : escalations.map((c, i) => <CustomerCard key={i} customer={c} onView={() => {}} />)}
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {allPatients.map((c, i) => <CustomerCard key={i} customer={c} onView={() => {}} />)}
          </div>
        )}
      </div>
    </div>
  );
}
