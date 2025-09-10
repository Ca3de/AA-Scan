import React, { useState, useEffect } from "react";
import "./styles.css";

export default function App() {
  // GOOGLE SHEETS CONFIGURATION - YOUR ACTUAL DATA
  const SHEET_ID = "1ZeDTaXgZ9mb_hxospWmlZwwvmcjo_VXY6keOwNhob2U"; // Your actual Sheet ID
  const SHEET_NAME = "Sheet1"; // Your sheet tab name
  const PUBLISHED_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRBc1ensXFeuqBjjsp5vfTiIjYHcuPD0w1sAoiozuCCpyaxO6q4zaux0JFAIZbANAXcCt3GTTnOvn5_/pub?gid=0&single=true&output=csv";

  // Process paths - these should match your column headers in Google Sheets
  const processRoles = [
    "Pick Liquidation",
    "Pick Recycle",
    "Pick RMV-Hazmat",
    "Pick Multis",
    "Pick Singles",
    "Pick LTL",
    "Pick Donation",
    "Stow",
    "Rebin",
    "CRETS",
    "Slam",
    "WHO",
    "OB-PS",
    "IB-PS",
    "Ext-Repair",
    "WRAP",
    "TRANSHIP",
    "WATERSPIDER",
    "CREOLI",
    "LS - Pack",
    "ILS - WaterSpider",
    "ILS - Downstack",
    "ILS - PS",
    "Pit Driver",
    "Pack Singles",
    "Pack Multis",
    "Pack LTL",
  ];

  // State management with default test data
  const [associates, setAssociates] = useState([
    // Default test data to get started
    {
      login: "test1",
      badge: "11111111",
      name: "Test User 1",
      trainedRoles: [
        "Pick Singles",
        "Pick Multis",
        "Stow",
        "Rebin",
        "Pack Singles",
      ],
    },
    {
      login: "test2",
      badge: "22222222",
      name: "Test User 2",
      trainedRoles: [
        "Pick Liquidation",
        "Pick Recycle",
        "Pick RMV-Hazmat",
        "CRETS",
        "Slam",
      ],
    },
    {
      login: "test3",
      badge: "33333333",
      name: "Test User 3",
      trainedRoles: [
        "Pick LTL",
        "Pick Donation",
        "WRAP",
        "TRANSHIP",
        "Pack LTL",
      ],
    },
    {
      login: "test4",
      badge: "44444444",
      name: "Test User 4",
      trainedRoles: processRoles,
    }, // Trained in all
  ]);
  const [loading, setLoading] = useState(false);
  const [dataError, setDataError] = useState(null);
  const [scannedBadge, setScannedBadge] = useState("");
  const [currentAssignment, setCurrentAssignment] = useState(null);
  const [todayAssignments, setTodayAssignments] = useState({});
  const [assignmentHistory, setAssignmentHistory] = useState({});
  const [roleRequirements, setRoleRequirements] = useState({});
  const [rotationEnabled, setRotationEnabled] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [manualDataEntry, setManualDataEntry] = useState(false);
  const [csvData, setCsvData] = useState("");

  // Fetch data from Google Sheets using published URL
  const fetchFromGoogleSheets = async () => {
    try {
      setLoading(true);
      setDataError(null);

      // Using CORS proxy for CodeSandbox
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(
        PUBLISHED_CSV_URL
      )}`;

      const response = await fetch(proxyUrl);

      if (!response.ok) {
        throw new Error("Failed to fetch from Google Sheets");
      }

      const csvText = await response.text();
      const lines = csvText.split("\n");

      if (lines.length < 2) {
        throw new Error("No data found in sheet");
      }

      // Parse CSV data
      const associatesList = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(",").map((v) => v.trim());
        if (!values[0] || !values[1]) continue;

        const trainedRoles = [];
        for (let j = 2; j < values.length && j - 2 < processRoles.length; j++) {
          const value = values[j].toUpperCase();
          if (value === "1" || value === "TRUE") {
            trainedRoles.push(processRoles[j - 2]);
          }
        }

        associatesList.push({
          login: values[0],
          badge: values[1].toString(),
          name: values[0],
          trainedRoles: trainedRoles,
        });
      }

      if (associatesList.length > 0) {
        setAssociates(associatesList);
        localStorage.setItem("associatesData", JSON.stringify(associatesList));
        console.log(
          `Successfully loaded ${associatesList.length} associates from Google Sheets`
        );
      }

      setDataError(null);
    } catch (error) {
      console.error("Error fetching data:", error);
      setDataError(
        "Google Sheets sync will work better after deployment. Using test data for now."
      );
      // Keep existing data if fetch fails
    } finally {
      setLoading(false);
    }
  };

  // Parse CSV data manually entered
  const parseCSVData = (csvText) => {
    const lines = csvText.trim().split("\n");
    const associatesList = [];

    lines.forEach((line) => {
      const parts = line.split(",");
      if (parts.length < 3) return;

      const login = parts[0].trim();
      const badge = parts[1].trim();
      const trainedRoles = [];

      for (let i = 2; i < parts.length && i - 2 < processRoles.length; i++) {
        if (parts[i].trim() === "1") {
          trainedRoles.push(processRoles[i - 2]);
        }
      }

      associatesList.push({
        login: login,
        badge: badge,
        name: login,
        trainedRoles: trainedRoles,
      });
    });

    setAssociates(associatesList);
    localStorage.setItem("associatesData", JSON.stringify(associatesList));
    setManualDataEntry(false);
    alert(`Loaded ${associatesList.length} associates successfully!`);
  };

  // Initialize on component mount
  useEffect(() => {
    // Load from localStorage first
    const savedAssociates = localStorage.getItem("associatesData");
    if (savedAssociates) {
      const parsed = JSON.parse(savedAssociates);
      if (parsed.length > 0) {
        setAssociates(parsed);
      }
    }

    // Load other saved data
    const savedHistory = localStorage.getItem("assignmentHistory");
    if (savedHistory) {
      setAssignmentHistory(JSON.parse(savedHistory));
    }

    const today = getTodayDate();
    const savedToday = localStorage.getItem(`assignments_${today}`);
    if (savedToday) {
      setTodayAssignments(JSON.parse(savedToday));
    }

    const savedRequirements = localStorage.getItem("roleRequirements");
    if (savedRequirements) {
      setRoleRequirements(JSON.parse(savedRequirements));
    } else {
      // Set default requirements
      const defaults = {};
      processRoles.forEach((role) => {
        defaults[role] = { min: 1, max: 2, priority: 5 };
      });
      setRoleRequirements(defaults);
    }

    const savedRotation = localStorage.getItem("rotationEnabled");
    if (savedRotation !== null) {
      setRotationEnabled(JSON.parse(savedRotation));
    }

    // Try to fetch from Google Sheets
    fetchFromGoogleSheets().catch((error) => {
      console.error("Initial Google Sheets fetch failed:", error);
    });
  }, []);

  // Save functions
  useEffect(() => {
    if (Object.keys(assignmentHistory).length > 0) {
      localStorage.setItem(
        "assignmentHistory",
        JSON.stringify(assignmentHistory)
      );
    }
  }, [assignmentHistory]);

  useEffect(() => {
    if (Object.keys(todayAssignments).length > 0) {
      const today = getTodayDate();
      localStorage.setItem(
        `assignments_${today}`,
        JSON.stringify(todayAssignments)
      );
    }
  }, [todayAssignments]);

  useEffect(() => {
    localStorage.setItem("roleRequirements", JSON.stringify(roleRequirements));
  }, [roleRequirements]);

  useEffect(() => {
    localStorage.setItem("rotationEnabled", JSON.stringify(rotationEnabled));
  }, [rotationEnabled]);

  const getTodayDate = () => {
    return new Date().toISOString().split("T")[0];
  };

  const getAssociateHistory = (badge) => {
    const history = [];
    const today = new Date();

    for (let i = 1; i <= 4; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];

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
      const recentCount = history.filter((r) => r === role).length;

      if (history.length > 0 && history[0] === role) {
        score -= 80;
      }

      score -= recentCount * 30;
    }

    const priority = roleRequirements[role]?.priority || 10;
    score += (15 - priority) * 10;

    return score;
  };

  const assignRole = (badge) => {
    const associate = associates.find((a) => a.badge === badge);
    if (!associate) {
      return { error: "Badge not found! Please contact your supervisor." };
    }

    if (todayAssignments[badge]) {
      return { role: todayAssignments[badge], name: associate.name };
    }

    const roleCount = {};
    processRoles.forEach((role) => {
      roleCount[role] = Object.values(todayAssignments).filter(
        (r) => r === role
      ).length;
    });

    let bestRole = null;
    let bestScore = -1;

    processRoles.forEach((role) => {
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
      processRoles.forEach((role) => {
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
        [today]: { ...assignmentHistory[today], [badge]: bestRole },
      };
      setAssignmentHistory(newHistory);

      return { role: bestRole, name: associate.name };
    }

    return {
      error:
        "No available roles match your training. Please see your supervisor.",
    };
  };

  const handleBadgeScan = () => {
    if (!scannedBadge.trim()) return;

    const result = assignRole(scannedBadge);

    if (result.error) {
      alert(result.error);
      setScannedBadge("");
    } else {
      setCurrentAssignment({
        name: result.name,
        role: result.role,
        badge: scannedBadge,
      });

      setTimeout(() => {
        setCurrentAssignment(null);
        setScannedBadge("");
      }, 5000);
    }
  };

  const handleAdminLogin = () => {
    if (adminPassword === "admin123") {
      setAdminAuthenticated(true);
      setAdminPassword("");
    } else {
      alert("Incorrect password");
      setAdminPassword("");
    }
  };

  const updateRequirement = (role, field, value) => {
    const numValue = parseInt(value) || 0;
    setRoleRequirements((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [field]: numValue,
      },
    }));
  };

  const clearTodayAssignments = () => {
    if (
      window.confirm("Are you sure you want to clear all today's assignments?")
    ) {
      setTodayAssignments({});
      const today = getTodayDate();
      localStorage.removeItem(`assignments_${today}`);
    }
  };

  // Loading screen
  if (loading) {
    return (
      <div className="scanner-interface">
        <div className="scanner-container">
          <div className="scanner-box">
            <h1>Loading...</h1>
            <p>Fetching associate data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Main Associate Interface
  if (!showAdmin) {
    return (
      <div className="scanner-interface">
        <button onClick={() => setShowAdmin(true)} className="admin-button">
          ⚙️
        </button>

        {dataError && (
          <div
            style={{
              position: "absolute",
              top: "10px",
              left: "10px",
              background: "rgba(255,255,0,0.9)",
              padding: "10px",
              borderRadius: "5px",
              color: "black",
              fontSize: "12px",
            }}
          >
            ⚠️ {dataError}
          </div>
        )}

        <div className="scanner-container">
          {!currentAssignment ? (
            <div className="scanner-box">
              <div className="scan-icon">📷</div>
              <h1>Scan Your Badge</h1>
              <p>Enter your badge number for today's assignment</p>
              <p style={{ fontSize: "14px", opacity: 0.7 }}>
                {associates.length} associates loaded
                {associates[0]?.login === "test1"
                  ? " (TEST MODE)"
                  : " (Live Data)"}
              </p>

              <input
                type="text"
                placeholder="Badge Number"
                value={scannedBadge}
                onChange={(e) => setScannedBadge(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleBadgeScan()}
                className="badge-input"
                autoFocus
              />
            </div>
          ) : (
            <div className="assignment-box">
              <div className="success-icon">✅</div>
              <h2>Assignment Complete!</h2>
              <div className="assignment-details">
                <p className="welcome">Welcome,</p>
                <p className="name">{currentAssignment.name}</p>
                <p className="your-path">Your process path today:</p>
                <p className="role">{currentAssignment.role}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Admin Login
  if (!adminAuthenticated) {
    return (
      <div className="admin-login">
        <div className="login-box">
          <button
            onClick={() => {
              setShowAdmin(false);
              setAdminPassword("");
            }}
            className="back-button"
          >
            ← Back to Scanner
          </button>
          <h2>🔒 Admin Access</h2>
          <input
            type="password"
            placeholder="Enter admin password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleAdminLogin()}
            className="password-input"
            autoFocus
          />
          <button onClick={handleAdminLogin} className="login-button">
            Login
          </button>
        </div>
      </div>
    );
  }

  // Admin Panel
  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>Admin Panel</h1>
        <button
          onClick={() => {
            setShowAdmin(false);
            setAdminAuthenticated(false);
          }}
          className="back-button"
        >
          Back to Scanner
        </button>
      </div>

      {/* Data Management Section */}
      <div
        className="data-section"
        style={{
          background: "#f0f9ff",
          padding: "20px",
          borderRadius: "10px",
          marginBottom: "20px",
        }}
      >
        <h2>Data Management</h2>
        {associates[0]?.login === "test1" && (
          <div
            style={{
              background: "#fef3c7",
              padding: "10px",
              borderRadius: "5px",
              marginBottom: "15px",
              fontSize: "14px",
            }}
          >
            📝 <strong>Using Test Data!</strong> To use real data:
            <br />
            1. Add your data to{" "}
            <a
              href={`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`}
              target="_blank"
              rel="noopener noreferrer"
            >
              your Google Sheet
            </a>
            <br />
            2. Click "Refresh from Google Sheets" below, or
            <br />
            3. Use "Manual CSV Entry" to paste your data
          </div>
        )}
        <div
          className="data-controls"
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <button
            onClick={() =>
              fetchFromGoogleSheets()
                .then(() => alert("Data refreshed!"))
                .catch((err) =>
                  alert("Could not refresh. Try manual CSV entry.")
                )
            }
            style={{
              background: "#3b82f6",
              color: "white",
              padding: "10px 20px",
              borderRadius: "5px",
              border: "none",
              cursor: "pointer",
            }}
          >
            🔄 Refresh from Google Sheets
          </button>
          <button
            onClick={() => setManualDataEntry(true)}
            style={{
              background: "#10b981",
              color: "white",
              padding: "10px 20px",
              borderRadius: "5px",
              border: "none",
              cursor: "pointer",
            }}
          >
            📝 Manual CSV Entry
          </button>
          <div style={{ marginLeft: "auto" }}>
            <p style={{ margin: 0 }}>
              Associates loaded: <strong>{associates.length}</strong>
            </p>
            <p style={{ margin: 0, fontSize: "12px", opacity: 0.7 }}>
              Source:{" "}
              {associates[0]?.login === "test1"
                ? "Test Data"
                : "Google Sheets/Manual"}
            </p>
          </div>
        </div>

        {manualDataEntry && (
          <div
            style={{
              marginTop: "20px",
              padding: "15px",
              background: "white",
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
            }}
          >
            <h3>Paste CSV Data</h3>
            <p style={{ fontSize: "14px", marginBottom: "10px" }}>
              Format: login,badge,1,0,1,1... (1=trained, 0=not trained)
            </p>
            <textarea
              value={csvData}
              onChange={(e) => setCsvData(e.target.value)}
              placeholder="oladeisr,13525472,1,0,1,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0"
              rows="10"
              style={{
                width: "100%",
                marginBottom: "10px",
                padding: "10px",
                border: "1px solid #d1d5db",
                borderRadius: "5px",
                fontFamily: "monospace",
              }}
            />
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => {
                  parseCSVData(csvData);
                  setCsvData("");
                }}
                style={{
                  background: "#10b981",
                  color: "white",
                  padding: "8px 16px",
                  borderRadius: "5px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Save Data
              </button>
              <button
                onClick={() => setManualDataEntry(false)}
                style={{
                  background: "#6b7280",
                  color: "white",
                  padding: "8px 16px",
                  borderRadius: "5px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="admin-controls">
        <div className="control-card">
          <h3>Rotation Settings</h3>
          <label>
            <input
              type="checkbox"
              checked={rotationEnabled}
              onChange={(e) => setRotationEnabled(e.target.checked)}
            />
            Enable rotation (prevent consecutive days)
          </label>
        </div>

        <div className="control-card">
          <h3>Today's Statistics</h3>
          <p className="stat-number">{Object.keys(todayAssignments).length}</p>
          <p>Associates assigned</p>
        </div>

        <div className="control-card">
          <h3>Actions</h3>
          <button onClick={clearTodayAssignments} className="clear-button">
            Clear Today's Assignments
          </button>
        </div>
      </div>

      {/* Role Requirements Table */}
      <div className="requirements-table">
        <h2>Role Requirements</h2>
        <table>
          <thead>
            <tr>
              <th>Process Path</th>
              <th>Min</th>
              <th>Max</th>
              <th>Priority</th>
              <th>Current</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {processRoles.map((role) => {
              const req = roleRequirements[role] || {
                min: 0,
                max: 0,
                priority: 10,
              };
              const current = Object.values(todayAssignments).filter(
                (r) => r === role
              ).length;
              const status =
                current < req.min
                  ? "Under"
                  : current > req.max
                  ? "Over"
                  : "Good";

              return (
                <tr key={role}>
                  <td>{role}</td>
                  <td>
                    <input
                      type="number"
                      value={req.min}
                      onChange={(e) =>
                        updateRequirement(role, "min", e.target.value)
                      }
                      min="0"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={req.max}
                      onChange={(e) =>
                        updateRequirement(role, "max", e.target.value)
                      }
                      min="0"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={req.priority}
                      onChange={(e) =>
                        updateRequirement(role, "priority", e.target.value)
                      }
                      min="1"
                      max="10"
                    />
                  </td>
                  <td>{current}</td>
                  <td>
                    <span className={`status status-${status.toLowerCase()}`}>
                      {status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Today's Assignments */}
      <div className="assignments-grid">
        <h2>Today's Assignments</h2>
        <div className="assignments-list">
          {Object.entries(todayAssignments).length > 0 ? (
            Object.entries(todayAssignments).map(([badge, role]) => {
              const associate = associates.find((a) => a.badge === badge);
              return (
                <div key={badge} className="assignment-card">
                  <p className="associate-name">{associate?.name || badge}</p>
                  <p className="badge-number">Badge: {badge}</p>
                  <p className="assigned-role">{role}</p>
                </div>
              );
            })
          ) : (
            <p>No assignments yet today</p>
          )}
        </div>
      </div>
    </div>
  );
}
