import { HashRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { Admin } from './pages/Admin';
import { Group } from './pages/Group';
import { HowItWorks } from './pages/HowItWorks';
import { Picks } from './pages/Picks';
import { Welcome } from './pages/Welcome';

function Shell() {
  const { player, loading, logout } = useAuth();

  if (loading) return <p className="muted center">Loading…</p>;
  if (!player) {
    return (
      <Routes>
        <Route path="/how" element={<main className="content"><HowItWorks showBack /></main>} />
        <Route path="*" element={<Welcome />} />
      </Routes>
    );
  }

  return (
    <>
      <header className="topbar">
        <span className="wordmark small">CourtCast</span>
        <nav>
          <NavLink to="/" end>Picks</NavLink>
          <NavLink to="/group">Group</NavLink>
          <NavLink to="/how">Rules</NavLink>
          {player.is_admin && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <button className="link" onClick={logout} title="Log out">
          {player.display_name} ↩
        </button>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<Picks />} />
          <Route path="/group" element={<Group />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/how" element={<HowItWorks />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </>
  );
}

export function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </AuthProvider>
  );
}
