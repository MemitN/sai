import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TablesPage from './pages/TablesPage';
import OrderPage from './pages/OrderPage';
import KitchenPage from './pages/KitchenPage';
import CashierPage from './pages/CashierPage';
import InventoryPage from './pages/InventoryPage';
import ReportsPage from './pages/ReportsPage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';
import SuppliersPage from './pages/SuppliersPage';
import MenuPage from './pages/MenuPage';
import RoomBillsPage from './pages/RoomBillsPage';
import RequisitionPage from './pages/RequisitionPage';
import ReservationsPage from './pages/ReservationsPage';
import WaiterShiftsPage from './pages/WaiterShiftsPage';
import CustomersPage from './pages/CustomersPage';
import InsightsPage from './pages/InsightsPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import api, { getBaseUrl, getNetworkInfo, testNetworkConnection, setApiUrl } from './hooks/useApi';

// Helper function to get image URL dynamically (works from any device on the network)
const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  
  // If it's already a full URL (http:// or https://)
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // If it's a data URL (base64 embedded image)
  if (imagePath.startsWith('data:')) {
    return imagePath;
  }
  
  // Ensure the path starts with /
  const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  
  // Use the base URL to construct the full image URL
  return `${getBaseUrl()}${cleanPath}`;
};

// Dynamic logo URL that works from any device
const logoSrc = getImageUrl('/logo.jpeg');

// Role-based navigation config
const NAV = {
  waiter: [
    { page: 'tables',        label: 'Tables',       icon: 'fa-table' },
    { page: 'orders',        label: 'Orders',       icon: 'fa-utensils' },
    { page: 'rooms',         label: 'Rooms',        icon: 'fa-bed' },
    { page: 'reservations',  label: 'Reservations', icon: 'fa-calendar-check' },
    { page: 'waiter_shifts', label: 'My Hours',     icon: 'fa-clock' },
  ],
  bar_attendant: [
    { page: 'tables',        label: 'Tables',       icon: 'fa-table' },
    { page: 'orders',        label: 'Orders',       icon: 'fa-utensils' },
    { page: 'kitchen',       label: 'Kitchen / Bar',icon: 'fa-fire-burner' },
    { page: 'inventory',     label: 'Bar Inventory',icon: 'fa-boxes-stacked' },
    { page: 'cashier',       label: 'Cashier',      icon: 'fa-cash-register' },
    { page: 'waiter_shifts', label: 'My Hours',     icon: 'fa-clock' },
    { page: 'requisitions',  label: 'Requisitions', icon: 'fa-clipboard-list' },
  ],
  cashier: [
    { page: 'cashier',       label: 'Cashier',      icon: 'fa-cash-register' },
    { page: 'customers',     label: 'Customers',    icon: 'fa-users' },
    { page: 'reservations',  label: 'Reservations', icon: 'fa-calendar-check' },
    { page: 'reports',       label: 'Reports',      icon: 'fa-chart-line' },
    { page: 'room_bills',    label: 'Room Bills',   icon: 'fa-receipt' },
    { page: 'shifts',        label: 'Shifts',       icon: 'fa-clock' },
  ],
  kitchen: [
    { page: 'kitchen',       label: 'Kitchen Display', icon: 'fa-fire-burner' },
    { page: 'requisitions',  label: 'Requisitions',    icon: 'fa-clipboard-list' },
  ],
  admin: [
    { page: 'dashboard',     label: 'Dashboard',    icon: 'fa-chart-pie' },
    { page: 'tables',        label: 'Tables',       icon: 'fa-table' },
    { page: 'orders',        label: 'Orders',       icon: 'fa-utensils' },
    { page: 'kitchen',       label: 'Kitchen / Bar',icon: 'fa-fire-burner' },
    { page: 'cashier',       label: 'Cashier',      icon: 'fa-cash-register' },
    { page: 'customers',     label: 'Customers',    icon: 'fa-users' },
    { page: 'menu',          label: 'Menu',         icon: 'fa-bowl-food' },
    { page: 'inventory',     label: 'Inventory',    icon: 'fa-boxes-stacked' },
    { page: 'suppliers',     label: 'Suppliers',    icon: 'fa-truck' },
    { page: 'promotions',    label: 'Promotions',   icon: 'fa-tags' },
    { page: 'rooms',         label: 'Rooms',        icon: 'fa-bed' },
    { page: 'reservations',  label: 'Reservations', icon: 'fa-calendar-check' },
    { page: 'room_bills',    label: 'Room Bills',   icon: 'fa-receipt' },
    { page: 'waiter_shifts', label: 'Staff Hours',  icon: 'fa-user-clock' },
    { page: 'insights',      label: 'Insights',     icon: 'fa-chart-bar' },
    { page: 'reports',       label: 'Reports',      icon: 'fa-chart-line' },
    { page: 'users',         label: 'Users',        icon: 'fa-id-badge' },
    { page: 'settings',      label: 'Settings',     icon: 'fa-gear' },
    { page: 'requisitions',  label: 'Requisitions', icon: 'fa-clipboard-list' },
  ],
  management: [
    { page: 'dashboard',     label: 'Dashboard',    icon: 'fa-chart-pie' },
    { page: 'tables',        label: 'Tables',       icon: 'fa-table' },
    { page: 'orders',        label: 'Orders',       icon: 'fa-utensils' },
    { page: 'kitchen',       label: 'Kitchen / Bar',icon: 'fa-fire-burner' },
    { page: 'cashier',       label: 'Cashier',      icon: 'fa-cash-register' },
    { page: 'customers',     label: 'Customers',    icon: 'fa-users' },
    { page: 'menu',          label: 'Menu',         icon: 'fa-bowl-food' },
    { page: 'inventory',     label: 'Inventory',    icon: 'fa-boxes-stacked' },
    { page: 'suppliers',     label: 'Suppliers',    icon: 'fa-truck' },
    { page: 'promotions',    label: 'Promotions',   icon: 'fa-tags' },
    { page: 'rooms',         label: 'Rooms',        icon: 'fa-bed' },
    { page: 'reservations',  label: 'Reservations', icon: 'fa-calendar-check' },
    { page: 'room_bills',    label: 'Room Bills',   icon: 'fa-receipt' },
    { page: 'waiter_shifts', label: 'Staff Hours',  icon: 'fa-user-clock' },
    { page: 'insights',      label: 'Insights',     icon: 'fa-chart-bar' },
    { page: 'reports',       label: 'Reports',      icon: 'fa-chart-line' },
    { page: 'users',         label: 'Users',        icon: 'fa-id-badge' },
    { page: 'settings',      label: 'Settings',     icon: 'fa-gear' },
    { page: 'requisitions',  label: 'Requisitions', icon: 'fa-clipboard-list' },
  ],
};

const PAGE_TITLES = {
  dashboard:    'Dashboard',
  tables:       'Tables',
  orders:       'Orders',
  rooms:        'Rooms',
  kitchen:      'Kitchen & Bar',
  cashier:      'Cashier',
  inventory:    'Inventory',
  reports:      'Reports',
  users:        'Staff Management',
  settings:     'Settings',
  suppliers:    'Suppliers & Purchase Orders',
  promotions:   'Promotions',
  menu:         'Menu',
  shifts:       'Cashier Shifts',
  room_bills:   'Room Bills & Checkout',
  requisitions: 'Stock Requisitions',
  reservations: 'Room Reservations',
  waiter_shifts:'Staff Hours & Commissions',
  customers:    'Customers & Loyalty',
  insights:     'Business Insights',
};

const ROLE_COLORS = {
  admin: '#EF4444', management: '#8B5CF6', cashier: '#10B981',
  bar_attendant: '#F97316', waiter: '#3B82F6', kitchen: '#F59E0B',
};

// Network Settings Modal Component
function NetworkSettingsModal({ onClose }) {
  const [networkInfo, setNetworkInfo] = useState(getNetworkInfo());
  const [manualUrl, setManualUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    setNetworkInfo(getNetworkInfo());
    const savedUrl = localStorage.getItem('pos_api_url');
    if (savedUrl) setManualUrl(savedUrl);
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await testNetworkConnection();
    setTestResult(result);
    setTesting(false);
  };

  const handleSetManualUrl = () => {
    if (manualUrl) {
      setApiUrl(manualUrl);
      setNetworkInfo(getNetworkInfo());
      setTimeout(() => window.location.reload(), 500);
    }
  };

  const handleResetUrl = () => {
    localStorage.removeItem('pos_api_url');
    setManualUrl('');
    window.location.reload();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <span className="modal-title">
            <i className="fa-solid fa-network-wired" style={{ marginRight: 8, color: '#F59E0B' }} />
            Network Settings
          </span>
          <button className="modal-close" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="modal-body">
          <div style={{ background: '#F0FDF4', borderRadius: 8, padding: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: '#065F46', marginBottom: 8 }}>
              <i className="fa-solid fa-circle-info" style={{ marginRight: 6 }} />
              Current Connection:
            </div>
            <div><strong>API URL:</strong> {networkInfo.apiUrl}</div>
            <div><strong>Base URL:</strong> {networkInfo.baseUrl}</div>
            <div><strong>Hostname:</strong> {networkInfo.hostname}</div>
            <div><strong>Network Type:</strong> {networkInfo.isLocalNetwork ? 'Local Network' : 'Localhost'}</div>
          </div>

          <div className="form-group">
            <label className="form-label">Manual Server URL (Optional)</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="http://192.168.1.100:3001"
              value={manualUrl}
              onChange={e => setManualUrl(e.target.value)}
            />
            <div style={{ fontSize: 11, color: '#78716C', marginTop: 4 }}>
              Use this if the automatic detection doesn't work. Leave empty for auto-detection.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-outline btn-sm" onClick={handleTestConnection} disabled={testing}>
              {testing ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <><i className="fa-solid fa-plug" /> Test Connection</>}
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleSetManualUrl}>
              <i className="fa-solid fa-save" /> Apply URL
            </button>
            <button className="btn btn-danger btn-sm" onClick={handleResetUrl}>
              <i className="fa-solid fa-undo" /> Reset to Auto
            </button>
          </div>

          {testResult && (
            <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: testResult.success ? '#D1FAE5' : '#FEE2E2', color: testResult.success ? '#065F46' : '#991B1B' }}>
              {testResult.success ? `✅ Connected to ${testResult.url}` : `❌ Connection failed: ${testResult.error}`}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function AppShell() {
  const { user, logout } = useAuth();
  const [page, setPage] = useState(() => {
    const nav = NAV[user?.role] || [];
    return nav[0]?.page || 'dashboard';
  });
  const [selectedTable, setSelectedTable] = useState(null);
  const [sidebarOpen, setSidebarOpen]     = useState(false);
  const [time, setTime]                   = useState(new Date());
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen]         = useState(false);
  const [quickStats, setQuickStats]       = useState(null);
  const [showNetworkSettings, setShowNetworkSettings] = useState(false);
  const notifRef = useRef(null);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Notifications
  const loadNotifs = useCallback(async () => {
    try { const { data } = await api.get('/notifications'); setNotifications(data); } catch {}
  }, []);

  // Quick stats
  const loadQuickStats = useCallback(async () => {
    try { const { data } = await api.get('/quick-stats'); setQuickStats(data); } catch {}
  }, []);

  useEffect(() => {
    loadNotifs();
    loadQuickStats();
    const t1 = setInterval(loadNotifs,    30000);
    const t2 = setInterval(loadQuickStats, 60000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, [loadNotifs, loadQuickStats]);

  // Close notif on outside click
  useEffect(() => {
    const h = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const navItems    = NAV[user?.role] || [];
  const unreadNotifs = notifications.filter(n => !n.read_by?.includes(String(user?.id)));

  const navigate = (p) => { setPage(p); setSelectedTable(null); setSidebarOpen(false); };
  const handleSelectTable = (table) => { setSelectedTable(table); setPage('orders'); setSidebarOpen(false); };
  const handleBack = () => { setSelectedTable(null); setPage('tables'); };

  const renderPage = () => {
    if (page === 'promotions')    return <SettingsPage initialTab="promotions" />;
    if (page === 'shifts')        return <CashierPage />;
    if (page === 'room_bills')    return <RoomBillsPage />;
    if (page === 'requisitions')  return <RequisitionPage />;
    if (page === 'reservations')  return <ReservationsPage />;
    if (page === 'waiter_shifts') return <WaiterShiftsPage />;
    if (page === 'customers')     return <CustomersPage />;
    if (page === 'insights')      return <InsightsPage />;

    switch (page) {
      case 'dashboard':  return <DashboardPage />;
      case 'tables':
      case 'orders':
        return selectedTable
          ? <OrderPage table={selectedTable} onBack={handleBack} />
          : <TablesPage onSelectTable={handleSelectTable} />;
      case 'rooms':      return <TablesPage onSelectTable={handleSelectTable} initialView="rooms" />;
      case 'kitchen':    return <KitchenPage />;
      case 'cashier':    return <CashierPage />;
      case 'inventory':  return <InventoryPage />;
      case 'menu':       return <MenuPage />;
      case 'reports':    return <ReportsPage />;
      case 'users':      return <UsersPage />;
      case 'suppliers':  return <SuppliersPage />;
      case 'settings':   return <SettingsPage />;
      default:           return <DashboardPage />;
    }
  };

  return (
    <div className="app-layout">
      <div className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {logoSrc
              ? <img src={logoSrc} alt="logo" style={{ width:36, height:36, borderRadius:'50%', objectFit:'cover', border:'2px solid rgba(245,158,11,0.6)', flexShrink:0 }} />
              : <span style={{ fontSize:24 }}>🍹</span>}
            <h2 style={{ margin:0 }}>Sai Lounge</h2>
          </div>
          <span>Point of Sale System</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.page}
              className={`nav-item ${page === item.page || (page === 'orders' && item.page === 'tables') ? 'active' : ''}`}
              onClick={() => navigate(item.page)}
            >
              <i className={`fa-solid ${item.icon}`} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-badge">
            <div className="user-avatar">{user?.name?.charAt(0)}</div>
            <div style={{ flex:1, overflow:'hidden' }}>
              <div className="user-name" style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.name}</div>
              <div className="user-role" style={{ color: ROLE_COLORS[user?.role] || '#9CA3AF' }}>
                {user?.role?.replace('_', ' ')}
              </div>
            </div>
            <button className="logout-btn" onClick={logout} title="Logout">
              <i className="fa-solid fa-right-from-bracket" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="main-content">
        <header className="topbar">
          <button className="hamburger-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <i className={`fa-solid ${sidebarOpen ? 'fa-xmark' : 'fa-bars'}`} />
          </button>

          <div className="topbar-title">{PAGE_TITLES[page] || 'Sai Lounge POS'}</div>

          {/* Quick Stats */}
          {quickStats && ['admin','management','cashier'].includes(user?.role) && (
            <div style={{ display:'flex', gap:8, alignItems:'center', fontSize:12, flexShrink:0, flexWrap:'wrap' }}>
              <div style={{ display:'flex', alignItems:'center', gap:5, background:'#FFFBEB', border:'1px solid #FCD34D', borderRadius:8, padding:'3px 10px' }}>
                <i className="fa-solid fa-money-bill-wave" style={{ color:'#D97706', fontSize:11 }} />
                <span style={{ fontFamily:'Montserrat', fontWeight:700, color:'#D97706' }}>
                  KES {Number(quickStats.today_revenue || 0).toLocaleString()}
                </span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:5, background:'#F0FDF4', border:'1px solid #86EFAC', borderRadius:8, padding:'3px 10px' }}>
                <i className="fa-solid fa-table" style={{ color:'#10B981', fontSize:11 }} />
                <span style={{ fontWeight:700, color:'#065F46' }}>{quickStats.tables_occupied}/{quickStats.tables_total}</span>
              </div>
              {quickStats.pending_orders > 0 && (
                <div style={{ display:'flex', alignItems:'center', gap:5, background:'#FEF3C7', border:'1px solid #FCD34D', borderRadius:8, padding:'3px 10px' }}>
                  <i className="fa-solid fa-fire-burner" style={{ color:'#D97706', fontSize:11 }} />
                  <span style={{ fontWeight:700, color:'#92400E' }}>{quickStats.pending_orders} active</span>
                </div>
              )}
              {quickStats.low_stock_count > 0 && (
                <div style={{ display:'flex', alignItems:'center', gap:5, background:'#FEF2F2', border:'1px solid #FCA5A5', borderRadius:8, padding:'3px 10px' }}>
                  <i className="fa-solid fa-triangle-exclamation" style={{ color:'#EF4444', fontSize:11 }} />
                  <span style={{ fontWeight:700, color:'#991B1B' }}>{quickStats.low_stock_count} low</span>
                </div>
              )}
            </div>
          )}

          <div className="topbar-actions">
            <div className="topbar-time">
              <i className="fa-solid fa-clock" style={{ marginRight:5, color:'#F59E0B' }} />
              {time.toLocaleTimeString('en-KE', { hour:'2-digit', minute:'2-digit' })}
            </div>

            {/* Network Settings Button */}
            <button 
              className="btn btn-sm btn-outline" 
              onClick={() => setShowNetworkSettings(true)}
              title="Network Settings"
              style={{ padding: '6px 10px' }}
            >
              <i className="fa-solid fa-network-wired" />
            </button>

            {/* Notifications */}
            <div style={{ position:'relative' }} ref={notifRef}>
              <button className="notif-btn" onClick={() => setNotifOpen(!notifOpen)}>
                <i className="fa-solid fa-bell" />
                {unreadNotifs.length > 0 && (
                  <span className="notif-badge">{unreadNotifs.length > 9 ? '9+' : unreadNotifs.length}</span>
                )}
              </button>

              {notifOpen && (
                <div className="notif-panel">
                  <div style={{ padding:'12px 16px', borderBottom:'1px solid #E7E5E4', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontFamily:'Poppins', fontWeight:700, fontSize:14 }}>Notifications</span>
                    {unreadNotifs.length > 0 && <span className="badge badge-red">{unreadNotifs.length} new</span>}
                  </div>
                  {notifications.length === 0 ? (
                    <div style={{ padding:'24px 16px', textAlign:'center', color:'#78716C', fontSize:13 }}>
                      <i className="fa-solid fa-bell-slash" style={{ fontSize:24, display:'block', marginBottom:8, opacity:0.3 }} />
                      No notifications
                    </div>
                  ) : (
                    <div style={{ maxHeight:320, overflowY:'auto' }}>
                      {notifications.slice(0, 20).map(n => {
                        const isUnread = !n.read_by?.includes(String(user?.id));
                        return (
                          <div key={n.id} className="notif-item"
                            style={{ background: isUnread ? '#FFFBEB' : 'white', cursor:'pointer' }}
                            onClick={async () => {
                              try { await api.put(`/notifications/${n.id}/read`); loadNotifs(); } catch {}
                            }}>
                            <div className={`notif-icon ${n.type === 'low_stock' ? 'badge-amber' : n.type === 'out_of_stock' ? 'badge-red' : 'badge-blue'}`}
                              style={{ width:32, height:32, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                              <i className={`fa-solid ${n.type === 'low_stock' || n.type === 'out_of_stock' ? 'fa-triangle-exclamation' : 'fa-info'}`} style={{ fontSize:13 }} />
                            </div>
                            <div style={{ flex:1 }}>
                              <div className="notif-text" style={{ fontWeight: isUnread ? 700 : 400 }}>{n.message}</div>
                              <div className="notif-time">{new Date(n.created_at).toLocaleString()}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button className="btn btn-sm btn-outline" onClick={logout} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <i className="fa-solid fa-right-from-bracket" />
            </button>
          </div>
        </header>

        <div className="page-body">
          {renderPage()}
        </div>
      </div>

      {/* Network Settings Modal */}
      {showNetworkSettings && (
        <NetworkSettingsModal onClose={() => setShowNetworkSettings(false)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}

function AppRouter() {
  const { user } = useAuth();
  if (window.location.pathname.includes('/reset-password')) return <ResetPasswordPage />;
  if (!user) return <LoginPage />;
  return <AppShell />;
}