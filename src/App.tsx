import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { useProjects } from './hooks/useProjects';
import { useAuth } from './hooks/useAuth';
import { WORKSPACES } from './lib/types';
import OverviewPage from './pages/OverviewPage';
import GridPage from './pages/GridPage';
import TablePage from './pages/TablePage';
import KanbanPage from './pages/KanbanPage';
import FocusPage from './pages/FocusPage';
import ProjectPage from './pages/ProjectPage';
import AIPage from './pages/AIPage';
import TasksPage from './pages/TasksPage';
import ContentPage from './pages/ContentPage';
import LoginPage from './pages/LoginPage';

function AppShell() {
  const location = useLocation();
  const auth = useAuth();
  const { data, loading, error, runScan } = useProjects();

  // ─── Auth Loading State ──────────────────────────────────────────────
  if (auth.isLoading || auth.isSetupLoading) {
    return (
      <div className="login-container">
        <div className="loading"><div className="loading-spinner" /> Authenticating...</div>
      </div>
    );
  }

  // ─── Login Gate ──────────────────────────────────────────────────────
  if (!auth.isAuthenticated) {
    return (
      <LoginPage
        needsSetup={auth.needsSetup}
        onLogin={auth.login}
        onRegister={auth.register}
      />
    );
  }

  // ─── Determine active workspace ──────────────────────────────────────
  const getActiveWorkspace = () => {
    const p = location.pathname;
    if (p.startsWith('/ai')) return WORKSPACES.find(ws => ws.id === 'ai')!;
    if (p.startsWith('/projects')) return WORKSPACES.find(ws => ws.id === 'projects')!;
    if (p.startsWith('/content')) return WORKSPACES.find(ws => ws.id === 'content')!;
    return WORKSPACES[0];
  };
  const activeWs = getActiveWorkspace();

  return (
    <div className="app-shell">
      {/* ─── Top Bar ───────────────────────────────────────── */}
      <div className="top-bar">
        <div className="top-bar-logo">🚀 Mission Control</div>
        <div className="workspace-tabs">
          {WORKSPACES.map(ws => (
            <NavLink
              key={ws.id}
              to={ws.path}
              className={`workspace-tab ${activeWs.id === ws.id ? 'active' : ''}`}
            >
              <span className="workspace-tab-icon">{ws.icon}</span>
              {ws.label}
            </NavLink>
          ))}
        </div>
        <div className="top-bar-right">
          <button className="scan-btn-small" onClick={runScan} disabled={loading}>
            {loading ? '⏳ Scanning...' : '🔄 Sync'}
          </button>
          <span className="user-badge" title={auth.user?.email || ''}>
            {auth.user?.name || auth.user?.email || ''}
          </span>
          <button className="logout-btn" onClick={auth.logout} title="Sign out">
            🚪
          </button>
        </div>
      </div>

      {/* ─── Workspace Area ────────────────────────────────── */}
      <div className="workspace-area">
        {/* Dashboard Sidebar */}
        {activeWs.id === 'dashboard' && (
          <aside className="sidebar">
            <div className="sidebar-section">
              <div className="sidebar-section-title">Views</div>
              <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><span className="nav-icon">📊</span> Overview</NavLink>
              <NavLink to="/grid" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><span className="nav-icon">🔲</span> Grid</NavLink>
              <NavLink to="/table" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><span className="nav-icon">📋</span> Table</NavLink>
              <NavLink to="/kanban" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><span className="nav-icon">📌</span> Kanban</NavLink>
              <NavLink to="/focus" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><span className="nav-icon">🎯</span> Focus</NavLink>
            </div>
            {data && (
              <div className="sidebar-section" style={{ marginTop: 'auto', paddingTop: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center' }}>{data.total_projects} projects tracked</div>
              </div>
            )}
          </aside>
        )}

        {/* AI Sidebar */}
        {activeWs.id === 'ai' && (
          <aside className="sidebar">
            <div className="sidebar-section">
              <div className="sidebar-section-title">Sessions</div>
              <NavLink to="/ai" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><span className="nav-icon">💬</span> New Chat</NavLink>
            </div>
          </aside>
        )}

        {/* Projects & Tasks Sidebar */}
        {activeWs.id === 'projects' && (
          <aside className="sidebar">
            <div className="sidebar-section">
              <div className="sidebar-section-title">Tasks</div>
              <NavLink to="/projects" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><span className="nav-icon">✅</span> All Tasks</NavLink>
              <NavLink to="/projects/my-tasks" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><span className="nav-icon">👤</span> My Tasks</NavLink>
              <NavLink to="/projects/board" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><span className="nav-icon">📌</span> Board</NavLink>
            </div>
            <div className="sidebar-section">
              <div className="sidebar-section-title">Organize</div>
              <NavLink to="/projects/by-project" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><span className="nav-icon">📁</span> By Project</NavLink>
              <NavLink to="/projects/by-lane" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><span className="nav-icon">🛤️</span> By Lane</NavLink>
              <NavLink to="/projects/dependencies" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><span className="nav-icon">🔗</span> Dependencies</NavLink>
            </div>
          </aside>
        )}

        {/* Content Sidebar */}
        {activeWs.id === 'content' && (
          <aside className="sidebar">
            <div className="sidebar-section">
              <div className="sidebar-section-title">Views</div>
              <NavLink to="/content" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><span className="nav-icon">📥</span> Release Inbox</NavLink>
            </div>
          </aside>
        )}

        {/* ─── Content ─────────────────────────────────────── */}
        <div className="content">
          {loading && !data ? (
            <div className="loading"><div className="loading-spinner" /> Loading Mission Control...</div>
          ) : error && !data ? (
            <div className="error-message">
              <h3>Failed to connect</h3>
              <p>{error}</p>
              <p style={{ marginTop: 12, color: 'var(--text-secondary)' }}>
                Start the API: <code style={{ background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: 4 }}>node server/index.mjs</code>
              </p>
            </div>
          ) : (
            <Routes>
              <Route path="/" element={data ? <OverviewPage data={data} /> : null} />
              <Route path="/grid" element={data ? <GridPage data={data} /> : null} />
              <Route path="/table" element={data ? <TablePage data={data} /> : null} />
              <Route path="/kanban" element={data ? <KanbanPage data={data} /> : null} />
              <Route path="/focus" element={data ? <FocusPage data={data} /> : null} />
              <Route path="/project/:path" element={<ProjectPage />} />
              <Route path="/ai" element={<AIPage />} />
              <Route path="/projects" element={<TasksPage />} />
              <Route path="/content" element={<ContentPage />} />
            </Routes>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
