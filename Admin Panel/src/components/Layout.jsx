import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  SquaresFour, ShieldCheck, Tooth, Users, Heartbeat,
  Image, Star, CalendarBlank, Receipt, Gift, SignOut, Bell, MagnifyingGlass,
  Gear, CaretDown, UserCircle, Megaphone, Sparkle, List, X,
  ChartLine, PaperPlaneTilt, ClockCounterClockwise, Percent, SealCheck, Buildings,
} from '@phosphor-icons/react';
import { useAuth } from '../lib/auth.jsx';
import api, { imgUrl } from '../lib/api';

const NAV = [
  { to: '/', label: 'Dashboard', Icon: SquaresFour, end: true },
  { to: '/analytics', label: 'Analytics', Icon: ChartLine },
  { to: '/admins', label: 'Admins', Icon: ShieldCheck },
  { to: '/dentists', label: 'Dentists', Icon: Tooth },
  { to: '/verification', label: 'Verification', Icon: SealCheck },
  { to: '/patients', label: 'Patients', Icon: Users },
  { to: '/treatments', label: 'Treatments', Icon: Heartbeat },
  { to: '/facilities', label: 'Facilities', Icon: Buildings },
  { to: '/gallery', label: 'Gallery', Icon: Image },
  { to: '/reviews', label: 'Reviews & Ratings', Icon: Star },
  { to: '/appointments', label: 'Appointments', Icon: CalendarBlank },
  { to: '/bills', label: 'Bills & Bill History', Icon: Receipt },
  { to: '/rewards', label: 'Rewards & Payments', Icon: Gift },
  { to: '/commission', label: 'Commission', Icon: Percent },
  { to: '/campaigns', label: 'Dr. Promotions', Icon: Megaphone },
  { to: '/patient-campaigns', label: 'Patient Promotions', Icon: Sparkle },
  { to: '/broadcast', label: 'Broadcast', Icon: PaperPlaneTilt },
  { to: '/audit-logs', label: 'Activity Log', Icon: ClockCounterClockwise },
  { to: '/settings', label: 'Settings', Icon: Gear },
];

export default function Layout() {
  const { admin, logout } = useAuth();
  const nav = useNavigate();
  const name = admin?.profile?.fullName || 'Admin';
  const role = admin?.profile?.adminRole === 'super_admin' ? 'Super Admin' : 'Admin';

  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    const onClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Topbar global search
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const searchRef = useRef(null);
  useEffect(() => {
    const onClick = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setResults(null); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults(null); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get('/api/admin/search', { params: { q: term } });
        setResults(data?.data || data || {});
      } catch { setResults(null); }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const goSearch = (to) => { setResults(null); setQ(''); nav(to); };

  const go = (to) => { setMenuOpen(false); nav(to); };

  return (
    <div className="layout">
      {navOpen && <div className="sidebar-overlay" onClick={() => setNavOpen(false)} />}
      <aside className={'sidebar' + (navOpen ? ' open' : '')}>
        <button className="sidebar-close" onClick={() => setNavOpen(false)} aria-label="Close menu"><X size={20} /></button>
        <div className="brand">My Dentist <span className="dot">PK</span></div>
        <nav style={{ flex: 1 }}>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setNavOpen(false)}
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
          <button className="hamburger" onClick={() => setNavOpen(true)} aria-label="Open menu"><List size={22} /></button>
          <div className="search" ref={searchRef}>
            <MagnifyingGlass size={16} className="search-ic" weight="regular" />
            <input
              placeholder="Search anything…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => { if (results) setResults(results); }}
            />
            {results && (() => {
              const dentists = results.dentists || [];
              const patients = results.patients || [];
              const bills = results.bills || [];
              const empty = !dentists.length && !patients.length && !bills.length;
              return (
                <div className="dropdown" style={{ left: 0, right: 0, top: 46, maxHeight: 380, overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
                  {empty && <div className="muted" style={{ padding: '10px 12px', fontSize: 13 }}>No results found</div>}
                  {dentists.length > 0 && (
                    <>
                      <div className="muted" style={{ padding: '8px 12px 4px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>Dentists</div>
                      {dentists.map((d) => (
                        <button key={d._id} className="dropdown-item" onClick={() => goSearch('/dentists/' + d._id)}>
                          {d.photo ? <img src={imgUrl(d.photo)} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} /> : <div className="avatar" style={{ width: 28, height: 28 }} />}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.fullName || 'Dentist'}</div>
                            <div className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[d.clinicName, d.city].filter(Boolean).join(' · ')}</div>
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                  {patients.length > 0 && (
                    <>
                      <div className="muted" style={{ padding: '8px 12px 4px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>Patients</div>
                      {patients.map((p) => (
                        <button key={p._id} className="dropdown-item" onClick={() => goSearch('/patients/' + p._id)}>
                          {p.profileImage ? <img src={imgUrl(p.profileImage)} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} /> : <div className="avatar" style={{ width: 28, height: 28 }} />}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.fullName || 'Patient'}</div>
                            <div className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[p.mobileNumber, p.city].filter(Boolean).join(' · ')}</div>
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                  {bills.length > 0 && (
                    <>
                      <div className="muted" style={{ padding: '8px 12px 4px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>Bills</div>
                      {bills.map((b) => (
                        <button key={b._id} className="dropdown-item" onClick={() => goSearch('/bills')}>
                          <span className="ic" style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F1F5F9', borderRadius: '50%' }}><Receipt size={15} /></span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.invoiceNumber || b.treatmentName || 'Bill'}</div>
                            <div className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[b.treatmentName, b.status].filter(Boolean).join(' · ')}</div>
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              );
            })()}
          </div>
          <div className="spacer" />
          <Bell size={20} className="muted" />
          <div className="admin-chip" ref={menuRef} style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setMenuOpen((o) => !o)}>
            {admin?.profile?.profileImage
              ? <img src={imgUrl(admin.profile.profileImage)} alt="" />
              : <div className="avatar" />}
            <div className="chip-text">
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
