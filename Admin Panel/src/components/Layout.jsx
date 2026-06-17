import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  SquaresFour, ShieldCheck, Tooth, Users, Heartbeat,
  Image, Star, CalendarBlank, Receipt, Gift, SignOut, Bell, MagnifyingGlass,
  Gear, CaretDown, UserCircle, Megaphone,
} from '@phosphor-icons/react';
import { useAuth } from '../lib/auth.jsx';
import { imgUrl } from '../lib/api';

const NAV = [
  { to: '/', label: 'Dashboard', Icon: SquaresFour, end: true },
  { to: '/admins', label: 'Admins', Icon: ShieldCheck },
  { to: '/dentists', label: 'Dentists', Icon: Tooth },
  { to: '/patients', label: 'Patients', Icon: Users },
  { to: '/treatments', label: 'Treatments', Icon: Heartbeat },
  { to: '/gallery', label: 'Gallery', Icon: Image },
  { to: '/reviews', label: 'Reviews & Ratings', Icon: Star },
  { to: '/appointments', label: 'Appointments', Icon: CalendarBlank },
  { to: '/bills', label: 'Bills & Bill History', Icon: Receipt },
  { to: '/rewards', label: 'Rewards & Payments', Icon: Gift },
  { to: '/campaigns', label: 'Promotions', Icon: Megaphone },
  { to: '/settings', label: 'Settings', Icon: Gear },
];

export default function Layout() {
  const { admin, logout } = useAuth();
  const nav = useNavigate();
  const name = admin?.profile?.fullName || 'Admin';
  const role = admin?.profile?.adminRole === 'super_admin' ? 'Super Admin' : 'Admin';

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    const onClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const go = (to) => { setMenuOpen(false); nav(to); };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">My Dentist <span className="dot">PK</span></div>
        <nav style={{ flex: 1 }}>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
              <span className="ic"><n.Icon size={18} /></span>{n.label}
            </NavLink>
          ))}
        </nav>
        <div className="nav-item logout" onClick={logout} style={{ cursor: 'pointer' }}>
          <span className="ic"><SignOut size={18} /></span>Logout
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="search"><MagnifyingGlass size={16} className="search-ic" weight="regular" /><input placeholder="Search anything…" /></div>
          <div className="spacer" />
          <Bell size={20} className="muted" />
          <div className="admin-chip" ref={menuRef} style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setMenuOpen((o) => !o)}>
            {admin?.profile?.profileImage
              ? <img src={imgUrl(admin.profile.profileImage)} alt="" />
              : <div className="avatar" />}
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{name}</div>
              <div className="muted" style={{ fontSize: 12 }}>{role}</div>
            </div>
            <CaretDown size={14} className="muted" />
            {menuOpen && (
              <div className="dropdown" onClick={(e) => e.stopPropagation()}>
                <button className="dropdown-item" onClick={() => go('/settings')}><UserCircle size={16} /> My Profile</button>
                <button className="dropdown-item" onClick={() => go('/settings')}><Gear size={16} /> Settings</button>
                <div className="dropdown-sep" />
                <button className="dropdown-item danger" onClick={logout}><SignOut size={16} /> Logout</button>
              </div>
            )}
          </div>
        </header>
        <main className="content"><Outlet /></main>
      </div>
    </div>
  );
}
