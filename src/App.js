import React, { useState, useEffect } from 'react';
import './styles.css';

export default function App() {
  // GOOGLE SHEETS CONFIGURATION - YOUR ACTUAL DATA
  const SHEET_ID = '1ZeDTaXgZ9mb_hxospWmlZwwvmcjo_VXY6keOwNhob2U';
  const SHEET_NAME = 'Sheet1';
  const PUBLISHED_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRBc1ensXFeuqBjjsp5vfTiIjYHcuPD0w1sAoiozuCCpyaxO6q4zaux0JFAIZbANAXcCt3GTTnOvn5_/pub?gid=0&single=true&output=csv';
  const GOOGLE_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycby0-eS-c2_AfXrYxjSJcA9vKuxDm4tkNsgSiyLjBR3O8jBjNARl-BxmUbFO7MXsNeSaig/exec';
  
  // Shift Configuration (6PM to 6AM with break 12-1AM)
  const SHIFT_CONFIG = {
    startHour: 18, // 6 PM
    endHour: 6,    // 6 AM
    breakStart: 0, // 12 AM
    breakEnd: 1    // 1 AM
  };
  
  // Process paths
  const processRoles = [
    'Pick Liquidation', 'Pick Recycle', 'Pick RMV-Hazmat', 'Pick Multis', 
    'Pick Singles', 'Pick LTL', 'Pick Donation', 'Stow', 'Rebin', 
    'CRETS', 'Slam', 'WHO', 'OB-PS', 'IB-PS', 'Ext-Repair', 
    'WRAP', 'TRANSHIP', 'WATERSPIDER', 'CREOLI', 'LS - Pack', 
    'ILS - WaterSpider', 'ILS - Downstack', 'ILS - PS', 'Pit Driver', 
    'Pack Singles', 'Pack Multis', 'Pack LTL'
  ];

  // State management
  const [associates, setAssociates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState(null);
  const [scannedBadge, setScannedBadge] = useState('');
  const [currentAssignment, setCurrentAssignment] = useState(null);
  const [todayAssignments, setTodayAssignments] = useState({});
  const [assignmentHistory, setAssignmentHistory] = useState({});
  const [roleRequirements, setRoleRequirements] = useState({});
  const [rotationEnabled, setRotationEnabled] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [manualDataEntry, setManualDataEntry] = useState(false);
  const [csvData, setCsvData] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [scanAnimation, setScanAnimation] = useState(false);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch data from Google Sheets
  const fetchFromGoogleSheets = async () => {
    try {
      setLoading(true);
      setDataError(null);
      
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(PUBLISHED_CSV_URL)}`;
      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        throw new Error('Failed to fetch from Google Sheets');
      }
      
      const csvText = await response.text();
      const lines = csvText.split('\n');
      
      if (lines.length < 2) {
        throw new Error('No data found in sheet');
      }
      
      const associatesList = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = line.split(',').map(v => v.trim());
        if (!values[0] || !values[1]) continue;
        
        const trainedRoles = [];
        for (let j = 2; j < values.length && j - 2 < processRoles.length; j++) {
          const value = values[j].toUpperCase();
          if (value === '1' || value === 'TRUE') {
            trainedRoles.push(processRoles[j - 2]);
          }
        }
        
        associatesList.push({
          login: values[0],
          badge: values[1].toString(),
          name: values[0].charAt(0).toUpperCase() + values[0].slice(1),
          trainedRoles: trainedRoles
        });
      }
      
      if (associatesList.length > 0) {
        setAssociates(associatesList);
        localStorage.setItem('associatesData', JSON.stringify(associatesList));
      }
      
      setDataError(null);
    } catch (error) {
      console.error('Error fetching data:', error);
      setDataError('Using cached data');
    } finally {
      setLoading(false);
    }
  };

  // Parse CSV data
  const parseCSVData = (csvText) => {
    const lines = csvText.trim().split('\n');
    const associatesList = [];
    
    lines.forEach(line => {
      const parts = line.split(',');
      if (parts.length < 3) return;
      
      const login = parts[0].trim();
      const badge = parts[1].trim();
      const trainedRoles = [];
      
      for (let i = 2; i < parts.length && i - 2 < processRoles.length; i++) {
        const value = parts[i].trim().toUpperCase();
        if (value === '1' || value === 'TRUE') {
          trainedRoles.push(processRoles[i - 2]);
        }
      }
      
      associatesList.push({
        login: login,
        badge: badge,
        name: login.charAt(0).toUpperCase() + login.slice(1),
        trainedRoles: trainedRoles
      });
    });
    
    setAssociates(associatesList);
    localStorage.setItem('associatesData', JSON.stringify(associatesList));
    setManualDataEntry(false);
    alert(`Successfully loaded ${associatesList.length} associates!`);
  };

  // Initialize
  useEffect(() => {
    const savedAssociates = localStorage.getItem('associatesData');
    if (savedAssociates) {
      const parsed = JSON.parse(savedAssociates);
      if (parsed.length > 0) {
        setAssociates(parsed);
      }
    }
    
    const savedHistory = localStorage.getItem('assignmentHistory');
    if (savedHistory) {
      setAssignmentHistory(JSON.parse(savedHistory));
    }
    
    const today = getTodayDate();
    const savedToday = localStorage.getItem(`assignments_${today}`);
    if (savedToday) {
      setTodayAssignments(JSON.parse(savedToday));
    }
    
    const savedRequirements = localStorage.getItem('roleRequirements');
    if (savedRequirements) {
      setRoleRequirements(JSON.parse(savedRequirements));
    } else {
      const defaults = {};
      processRoles.forEach(role => {
        defaults[role] = { min: 1, max: 2, priority: 5 };
      });
      setRoleRequirements(defaults);
    }
    
    const savedRotation = localStorage.getItem('rotationEnabled');
    if (savedRotation !== null) {
      setRotationEnabled(JSON.parse(savedRotation));
    }
    
    fetchFromGoogleSheets().catch(error => {
      console.error('Initial fetch failed:', error);
    });
  }, []);

  // Save functions
  useEffect(() => {
    if (Object.keys(assignmentHistory).length > 0) {
      localStorage.setItem('assignmentHistory', JSON.stringify(assignmentHistory));
    }
  }, [assignmentHistory]);

  useEffect(() => {
    if (Object.keys(todayAssignments).length > 0) {
      const today = getTodayDate();
      localStorage.setItem(`assignments_${today}`, JSON.stringify(todayAssignments));
    }
  }, [todayAssignments]);

  useEffect(() => {
    localStorage.setItem('roleRequirements', JSON.stringify(roleRequirements));
  }, [roleRequirements]);

  useEffect(() => {
    localStorage.setItem('rotationEnabled', JSON.stringify(rotationEnabled));
  }, [rotationEnabled]);

  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const getAssociateHistory = (badge) => {
    const history = [];
    const today = new Date();
    
    for (let i = 1; i <= 4; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      if (assignmentHistory[dateStr] && assignmentHistory[dateStr][badge]) {
        history.push(assignmentHistory[dateStr][badge]);
      }
    }
    
    return history;
  };

  const calculateRoleScore = (associate, role) => {
    let score = 100;
    
    if (!associate.trainedRoles.includes(role)) {
      return 0;
    }
    
    score += 50;
    
    if (rotationEnabled) {
      const history = getAssociateHistory(associate.badge);
      const recentCount = history.filter(r => r === role).length;
      
      if (history.length > 0 && history[0] === role) {
        score -= 80;
      }
      
      score -= (recentCount * 30);
    }
    
    const priority = roleRequirements[role]?.priority || 10;
    score += (15 - priority) * 10;
    
    return score;
  };

  const assignRole = (badge) => {
    const associate = associates.find(a => a.badge === badge);
    if (!associate) {
      return { error: 'Badge not recognized. Please contact your supervisor.' };
    }

    if (todayAssignments[badge]) {
      return { role: todayAssignments[badge], name: associate.name };
    }

    const roleCount = {};
    processRoles.forEach(role => {
      roleCount[role] = Object.values(todayAssignments).filter(r => r === role).length;
    });

    let bestRole = null;
    let bestScore = -1;

    processRoles.forEach(role => {
      const req = roleRequirements[role];
      if (!req) return;
      
      if (roleCount[role] < req.min) {
        const score = calculateRoleScore(associate, role);
        
        if (score > bestScore) {
          bestScore = score;
          bestRole = role;
        }
      }
    });

    if (!bestRole) {
      processRoles.forEach(role => {
        const req = roleRequirements[role];
        if (!req) return;
        
        if (roleCount[role] < req.max) {
          const score = calculateRoleScore(associate, role);
          
          if (score > bestScore) {
            bestScore = score;
            bestRole = role;
          }
        }
      });
    }

    if (bestRole) {
      const newAssignments = { ...todayAssignments, [badge]: bestRole };
      setTodayAssignments(newAssignments);
      
      const today = getTodayDate();
      const newHistory = {
        ...assignmentHistory,
        [today]: { ...assignmentHistory[today], [badge]: bestRole }
      };
      setAssignmentHistory(newHistory);
      
      return { role: bestRole, name: associate.name };
    }

    return { error: 'No available roles match your training. Please see your supervisor.' };
  };

  const handleBadgeScan = () => {
    if (!scannedBadge.trim()) return;

    setScanAnimation(true);
    setTimeout(() => {
      const result = assignRole(scannedBadge);
      
      if (result.error) {
        alert(result.error);
        setScannedBadge('');
        setScanAnimation(false);
      } else {
        setCurrentAssignment({
          name: result.name,
          role: result.role,
          badge: scannedBadge
        });
        setScanAnimation(false);
        
        setTimeout(() => {
          setCurrentAssignment(null);
          setScannedBadge('');
        }, 7000);
      }
    }, 1500);
  };

  const handleAdminLogin = () => {
    if (adminPassword === 'admin123') {
      setAdminAuthenticated(true);
      setAdminPassword('');
    } else {
      alert('Incorrect password');
      setAdminPassword('');
    }
  };

  const updateRequirement = (role, field, value) => {
    const numValue = parseInt(value) || 0;
    setRoleRequirements(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [field]: numValue
      }
    }));
  };

  const clearTodayAssignments = () => {
    if (window.confirm('Clear all assignments for today?')) {
      setTodayAssignments({});
      const today = getTodayDate();
      localStorage.removeItem(`assignments_${today}`);
    }
  };

  const getRoleStats = () => {
    const stats = {};
    processRoles.forEach(role => {
      const count = Object.values(todayAssignments).filter(r => r === role).length;
      const req = roleRequirements[role];
      stats[role] = {
        current: count,
        min: req.min,
        max: req.max,
        percentage: (count / req.max) * 100,
        status: count < req.min ? 'critical' : count > req.max ? 'over' : 'optimal'
      };
    });
    return stats;
  };

  // Loading screen
  if (loading) {
    return (
      <div className="premium-loading">
        <div className="loading-spinner"></div>
        <h2>Initializing System</h2>
        <p>Connecting to database...</p>
      </div>
    );
  }

  // Main Scanner Interface
  if (!showAdmin) {
    return (
      <div className="premium-scanner">
        {/* Animated Background */}
        <div className="animated-bg">
          <div className="gradient-sphere sphere-1"></div>
          <div className="gradient-sphere sphere-2"></div>
          <div className="gradient-sphere sphere-3"></div>
        </div>

        {/* Admin Button */}
        <button 
          onClick={() => setShowAdmin(true)} 
          className="admin-access-btn"
          aria-label="Admin Access"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
          </svg>
        </button>

        {/* Header */}
        <div className="premium-header">
          <div className="header-content">
            <div className="company-brand">
              <div className="brand-icon">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <rect x="5" y="5" width="30" height="30" rx="6" stroke="currentColor" strokeWidth="2"/>
                  <path d="M15 20L18 23L25 16" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </div>
              <div className="brand-text">
                <h1>SmartAssign Pro</h1>
                <p>Intelligent Workforce Management</p>
              </div>
            </div>
            <div className="header-stats">
              <div className="stat-item">
                <span className="stat-value">{Object.keys(todayAssignments).length}</span>
                <span className="stat-label">Assigned</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{associates.length}</span>
                <span className="stat-label">Associates</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{currentTime.toLocaleTimeString()}</span>
                <span className="stat-label">{currentTime.toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="scanner-content">
          {!currentAssignment ? (
            <div className={`scanner-card ${scanAnimation ? 'scanning' : ''}`}>
              <div className="card-glow"></div>
              <div className="scanner-icon">
                <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
                  <circle cx="60" cy="60" r="58" stroke="url(#gradient)" strokeWidth="2" opacity="0.3"/>
                  <circle cx="60" cy="60" r="48" stroke="url(#gradient)" strokeWidth="2" opacity="0.5"/>
                  <circle cx="60" cy="60" r="38" stroke="url(#gradient)" strokeWidth="2" opacity="0.7"/>
                  <rect x="40" y="40" width="40" height="40" rx="8" fill="url(#gradient)"/>
                  <path d="M10 30V10H30M90 10H110V30M110 90V110H90M30 110H10V90" 
                        stroke="url(#gradient)" strokeWidth="3" strokeLinecap="round"/>
                  <defs>
                    <linearGradient id="gradient" x1="0" y1="0" x2="120" y2="120">
                      <stop offset="0%" stopColor="#667eea"/>
                      <stop offset="50%" stopColor="#764ba2"/>
                      <stop offset="100%" stopColor="#f093fb"/>
                    </linearGradient>
                  </defs>
                </svg>
                {scanAnimation && <div className="scan-line"></div>}
              </div>
              
              <h2 className="scanner-title">Badge Authentication</h2>
              <p className="scanner-subtitle">Enter your unique identifier to receive today's assignment</p>
              
              <div className="input-container">
                <input
                  type="text"
                  placeholder="Badge ID"
                  value={scannedBadge}
                  onChange={(e) => setScannedBadge(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleBadgeScan()}
                  className="badge-input-field"
                  autoFocus
                  maxLength="20"
                />
                <button onClick={handleBadgeScan} className="scan-button">
                  <span>Authenticate</span>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M5 10H15M15 10L10 5M15 10L10 15" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                </button>
              </div>

              <div className="scanner-footer">
                <div className="status-indicator">
                  <span className="status-dot"></span>
                  <span>System Online</span>
                </div>
                <div className="associates-count">
                  {associates.length} Associates Active
                </div>
              </div>
            </div>
          ) : (
            <div className="assignment-card success">
              <div className="success-animation">
                <svg className="checkmark" width="120" height="120" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#4ade80" strokeWidth="3"/>
                  <path d="M35 60L50 75L85 40" fill="none" stroke="#4ade80" strokeWidth="4" strokeLinecap="round"/>
                </svg>
              </div>
              
              <div className="assignment-header">
                <h2>Assignment Confirmed</h2>
                <div className="assignment-badge">#{currentAssignment.badge}</div>
              </div>

              <div className="assignment-content">
                <div className="associate-info">
                  <div className="info-label">Associate</div>
                  <div className="info-value">{currentAssignment.name}</div>
                </div>

                <div className="role-assignment">
                  <div className="role-label">Today's Assignment</div>
                  <div className="role-value">
                    <div className="role-icon">
                      <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
                        <rect x="5" y="5" width="20" height="20" rx="4" stroke="currentColor" strokeWidth="2"/>
                        <circle cx="15" cy="15" r="5" fill="currentColor"/>
                      </svg>
                    </div>
                    <span>{currentAssignment.role}</span>
                  </div>
                </div>

                <div className="assignment-meta">
                  <div className="meta-item">
                    <span className="meta-label">Shift Start</span>
                    <span className="meta-value">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Duration</span>
                    <span className="meta-value">8 Hours</span>
                  </div>
                </div>
              </div>

              <div className="assignment-footer">
                <p>Please proceed to your assigned area</p>
              </div>
            </div>
          )}
        </div>

        {/* Quick Stats Bar */}
        <div className="quick-stats-bar">
          {['Pick Singles', 'Pick Multis', 'Stow', 'Pack Singles'].map(role => {
            const stat = getRoleStats()[role];
            return (
              <div key={role} className={`stat-badge ${stat.status}`}>
                <span className="stat-role">{role}</span>
                <span className="stat-progress">
                  {stat.current}/{stat.max}
                </span>
                <div className="stat-bar">
                  <div 
                    className="stat-fill" 
                    style={{ width: `${Math.min(stat.percentage, 100)}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Admin Login
  if (!adminAuthenticated) {
    return (
      <div className="premium-admin-login">
        <div className="animated-bg">
          <div className="gradient-sphere sphere-1"></div>
          <div className="gradient-sphere sphere-2"></div>
        </div>
        
        <div className="login-modal">
          <button 
            onClick={() => { setShowAdmin(false); setAdminPassword(''); }} 
            className="close-button"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </button>
          
          <div className="login-icon">
            <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
              <circle cx="30" cy="20" r="8" stroke="currentColor" strokeWidth="2"/>
              <path d="M10 50C10 40 20 35 30 35C40 35 50 40 50 50" stroke="currentColor" strokeWidth="2"/>
              <circle cx="45" cy="45" r="10" fill="currentColor" opacity="0.2"/>
              <path d="M45 40V45M45 45V50M45 45H40M45 45H50" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </div>
          
          <h2>Administrator Access</h2>
          <p>Enter your credentials to continue</p>
          
          <div className="login-form">
            <div className="input-group">
              <input
                type="password"
                placeholder="Authentication Code"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin()}
                className="password-field"
                autoFocus
              />
              <button onClick={handleAdminLogin} className="login-submit">
                Access Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Admin Dashboard
  return (
    <div className="premium-admin">
      <div className="admin-sidebar">
        <div className="sidebar-header">
          <div className="admin-logo">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect x="5" y="5" width="30" height="30" rx="6" stroke="currentColor" strokeWidth="2"/>
              <circle cx="20" cy="20" r="8" fill="currentColor" opacity="0.3"/>
              <circle cx="20" cy="20" r="4" fill="currentColor"/>
            </svg>
          </div>
          <h3>Control Panel</h3>
        </div>

        <nav className="sidebar-nav">
          <button className="nav-item active">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="2" width="6" height="6" rx="1" fill="currentColor"/>
              <rect x="12" y="2" width="6" height="6" rx="1" fill="currentColor"/>
              <rect x="2" y="12" width="6" height="6" rx="1" fill="currentColor"/>
              <rect x="12" y="12" width="6" height="6" rx="1" fill="currentColor"/>
            </svg>
            Dashboard
          </button>
          <button className="nav-item" onClick={() => setManualDataEntry(!manualDataEntry)}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2V10M10 10V18M10 10H18M10 10H2" stroke="currentColor" strokeWidth="2"/>
            </svg>
            Data Import
          </button>
          <button className="nav-item" onClick={() => fetchFromGoogleSheets()}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 4V16L8 12L12 16L16 12V4" stroke="currentColor" strokeWidth="2"/>
            </svg>
            Sync Data
          </button>
        </nav>

        <button 
          onClick={() => { setShowAdmin(false); setAdminAuthenticated(false); }} 
          className="sidebar-logout"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M8 2H2V18H8M13 14L17 10L13 6M17 10H5" stroke="currentColor" strokeWidth="2"/>
          </svg>
          Exit Dashboard
        </button>
      </div>

      <div className="admin-main">
        <div className="admin-header">
          <h1>Workforce Management Dashboard</h1>
          <div className="header-actions">
            <button 
              className="action-btn primary"
              onClick={() => fetchFromGoogleSheets()}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2V8M8 8V14M8 8L14 8M8 8L2 8" stroke="currentColor" strokeWidth="2" strokeTransform="rotate(45 8 8)"/>
              </svg>
              Sync Google Sheets
            </button>
            <button 
              className="action-btn danger"
              onClick={clearTodayAssignments}
            >
              Reset Day
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-icon blue">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="2"/>
                <path d="M6 20C6 16 9 14 12 14C15 14 18 16 18 20" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <div className="kpi-content">
              <div className="kpi-value">{Object.keys(todayAssignments).length}</div>
              <div className="kpi-label">Assigned Today</div>
              <div className="kpi-change positive">+12% vs yesterday</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon green">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M9 12L11 14L15 10M21 12C21 16.97 16.97 21 12 21C7.03 21 3 16.97 3 12C3 7.03 7.03 3 12 3C16.97 3 21 7.03 21 12Z" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <div className="kpi-content">
              <div className="kpi-value">{Math.round((Object.keys(todayAssignments).length / associates.length) * 100)}%</div>
              <div className="kpi-label">Coverage Rate</div>
              <div className="kpi-change positive">Optimal</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon purple">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L15 9L22 10L17 15L18 22L12 18L6 22L7 15L2 10L9 9L12 2Z" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <div className="kpi-content">
              <div className="kpi-value">{associates.length}</div>
              <div className="kpi-label">Total Associates</div>
              <div className="kpi-change neutral">All systems active</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon orange">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 2V12L16 16M12 21C7.03 21 3 16.97 3 12C3 7.03 7.03 3 12 3C16.97 3 21 7.03 21 12C21 16.97 16.97 21 12 21Z" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <div className="kpi-content">
              <div className="kpi-value">{rotationEnabled ? 'Active' : 'Disabled'}</div>
              <div className="kpi-label">Smart Rotation</div>
              <div className="kpi-change">{rotationEnabled ? 'Preventing fatigue' : 'Manual mode'}</div>
            </div>
          </div>
        </div>

        {/* Data Import Section */}
        {manualDataEntry && (
          <div className="data-import-section">
            <div className="section-header">
              <h3>Import Associate Data</h3>
              <button onClick={() => setManualDataEntry(false)} className="close-section">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </button>
            </div>
            <div className="import-content">
              <p className="import-instructions">
                Paste CSV data below. Format: login,badge,TRUE/FALSE for each training path
              </p>
              <textarea
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
                placeholder="Example: jsmith,12345678,TRUE,FALSE,TRUE,FALSE..."
                className="import-textarea"
              />
              <div className="import-actions">
                <button 
                  onClick={() => { parseCSVData(csvData); setCsvData(''); }} 
                  className="action-btn primary"
                >
                  Import Data
                </button>
                <button 
                  onClick={() => { setCsvData(''); setManualDataEntry(false); }} 
                  className="action-btn secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Settings Section */}
        <div className="settings-section">
          <h3>System Configuration</h3>
          <div className="settings-grid">
            <div className="setting-card">
              <div className="setting-header">
                <h4>Rotation System</h4>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={rotationEnabled}
                    onChange={(e) => setRotationEnabled(e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <p>Automatically prevent consecutive day assignments to the same role</p>
            </div>

            <div className="setting-card">
              <div className="setting-header">
                <h4>Data Source</h4>
                <span className="status-badge connected">Connected</span>
              </div>
              <p>Google Sheets ID: {SHEET_ID.substring(0, 10)}...</p>
            </div>
          </div>
        </div>

        {/* Role Requirements Table */}
        <div className="requirements-section">
          <h3>Role Requirements Matrix</h3>
          <div className="table-container">
            <table className="requirements-table">
              <thead>
                <tr>
                  <th>Process Path</th>
                  <th>Minimum</th>
                  <th>Maximum</th>
                  <th>Priority</th>
                  <th>Current</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(getRoleStats()).slice(0, 10).map(([role, stat]) => (
                  <tr key={role}>
                    <td className="role-name">{role}</td>
                    <td>
                      <input
                        type="number"
                        value={roleRequirements[role]?.min || 0}
                        onChange={(e) => updateRequirement(role, 'min', e.target.value)}
                        className="table-input"
                        min="0"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={roleRequirements[role]?.max || 0}
                        onChange={(e) => updateRequirement(role, 'max', e.target.value)}
                        className="table-input"
                        min="0"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={roleRequirements[role]?.priority || 5}
                        onChange={(e) => updateRequirement(role, 'priority', e.target.value)}
                        className="table-input"
                        min="1"
                        max="10"
                      />
                    </td>
                    <td className="current-count">{stat.current}</td>
                    <td>
                      <span className={`status-indicator ${stat.status}`}>
                        {stat.status === 'critical' ? 'Under' : 
                         stat.status === 'over' ? 'Over' : 'Optimal'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Today's Assignments */}
        <div className="assignments-section">
          <h3>Today's Assignments</h3>
          <div className="assignments-grid">
            {Object.entries(todayAssignments).length > 0 ? (
              Object.entries(todayAssignments).map(([badge, role]) => {
                const associate = associates.find(a => a.badge === badge);
                return (
                  <div key={badge} className="assignment-card-admin">
                    <div className="assignment-avatar">
                      {associate?.name.charAt(0) || 'A'}
                    </div>
                    <div className="assignment-info">
                      <div className="assignment-name">{associate?.name || 'Unknown'}</div>
                      <div className="assignment-badge">Badge: {badge}</div>
                      <div className="assignment-role">{role}</div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty-state">
                <svg width="60" height="60" viewBox="0 0 60 60" fill="none" opacity="0.3">
                  <circle cx="30" cy="30" r="28" stroke="currentColor" strokeWidth="2"/>
                  <path d="M20 30H40M30 20V40" stroke="currentColor" strokeWidth="2"/>
                </svg>
                <p>No assignments yet today</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
