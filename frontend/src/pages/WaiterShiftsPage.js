// WaiterShiftsPage.js - Fixed timezone handling

import React, { useState, useEffect, useCallback } from 'react';
import api from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';

// Helper function to format time - ensures correct local timezone display
function formatTime(dateString) {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';
    // Use Kenya timezone (EAT / UTC+3)
    return date.toLocaleTimeString('en-KE', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false,
      timeZone: 'Africa/Nairobi'
    });
  } catch (e) {
    return '—';
  }
}

function formatDate(dateString) {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-KE', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      timeZone: 'Africa/Nairobi'
    });
  } catch (e) {
    return '—';
  }
}

function formatDateTime(dateString) {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleString('en-KE', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false,
      timeZone: 'Africa/Nairobi'
    });
  } catch (e) {
    return '—';
  }
}

function fmt(n) { return `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`; }
function fmtHrs(h) { 
  const hrs = Math.floor(h); 
  const mins = Math.round((h - hrs) * 60); 
  return `${hrs}h ${mins}m`; 
}

export default function WaiterShiftsPage() {
  const { user } = useAuth();
  // Allow waiter, bar_attendant, AND cashier to clock in/out
  const canClockIn = ['waiter', 'bar_attendant', 'cashier'].includes(user?.role);
  const isManager = ['admin', 'management'].includes(user?.role);
  const canSeeAllShifts = isManager;

  const [tab, setTab] = useState('live');
  const [active, setActive] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [shiftSummary, setShiftSummary] = useState({});
  const [commissions, setCommissions] = useState([]);
  const [commSummary, setCommSummary] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [clockInModal, setClockInModal] = useState(false);
  const [clockOutModal, setClockOutModal] = useState(null);
  const [overtimeModal, setOvertimeModal] = useState(null);
  const [payCommModal, setPayCommModal] = useState(null);

  const [clockInForm, setClockInForm] = useState({ user_id: '', notes: '' });
  const [clockOutForm, setClockOutForm] = useState({ break_minutes: 0, notes: '' });
  const [overtimeForm, setOvertimeForm] = useState({ approved: true, notes: '' });

  const [histFrom, setHistFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [histTo, setHistTo] = useState(new Date().toISOString().split('T')[0]);
  const [histUser, setHistUser] = useState('');
  const [commFrom, setCommFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [commTo, setCommTo] = useState(new Date().toISOString().split('T')[0]);

  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const loadActive = useCallback(async () => {
    try {
      const { data } = await api.get('/waiter-shifts/active');
      let filteredData = data || [];
      
      if (!canSeeAllShifts) {
        filteredData = filteredData.filter(s => s.user_id === user?.id);
      }
      
      setActive(filteredData);
    } catch (e) { console.error(e); }
  }, [canSeeAllShifts, user?.id]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = { from: histFrom, to: histTo };
      
      if (!canSeeAllShifts) {
        params.user_id = user?.id;
      } else if (histUser) {
        params.user_id = histUser;
      }
      
      const { data } = await api.get('/waiter-shifts', { params });
      setShifts(data.shifts || []);
      setShiftSummary(data.summary || {});
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [histFrom, histTo, histUser, canSeeAllShifts, user?.id]);

  const loadCommissions = useCallback(async () => {
    setLoading(true);
    try {
      const params = { from: commFrom, to: commTo };
      
      if (!canSeeAllShifts) {
        params.waiter_id = user?.id;
      }
      
      const { data } = await api.get('/commissions', { params });
      setCommissions(data.logs || []);
      setCommSummary(data.summary || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [commFrom, commTo, canSeeAllShifts, user?.id]);

  const loadUsers = useCallback(async () => {
    try {
      const { data } = await api.get('/users');
      if (canSeeAllShifts) {
        setUsers(data.filter(u => ['waiter', 'bar_attendant', 'cashier'].includes(u.role)));
      } else {
        setUsers([]);
      }
    } catch (e) { }
  }, [canSeeAllShifts]);

  useEffect(() => {
    loadActive();
    loadUsers();
    const t = setInterval(loadActive, 60000);
    return () => clearInterval(t);
  }, [loadActive, loadUsers]);

  useEffect(() => {
    if (tab === 'history') loadHistory();
  }, [tab, loadHistory]);

  useEffect(() => {
    if (tab === 'commissions') loadCommissions();
  }, [tab, loadCommissions]);

  // Calculate hours worked - using local time comparison
  const hoursWorked = (clockInTime) => {
    if (!clockInTime) return 0;
    try {
      const clockIn = new Date(clockInTime);
      if (isNaN(clockIn.getTime())) return 0;
      const diff = (now.getTime() - clockIn.getTime()) / 3600000;
      return Math.max(0, diff);
    } catch (e) {
      return 0;
    }
  };

  const doClockIn = async () => {
    let userId;
    
    if (isManager && clockInForm.user_id) {
      userId = clockInForm.user_id;
    } else {
      userId = user?.id;
    }
    
    if (!userId) {
      alert('Please select a staff member');
      return;
    }
    
    setSaving(true);
    try {
      await api.post('/waiter-shifts/clock-in', {
        user_id: userId,
        notes: clockInForm.notes || null,
      });
      setClockInModal(false);
      setClockInForm({ user_id: '', notes: '' });
      loadActive();
      alert('✅ Clocked in successfully!');
    } catch (e) {
      const errorMsg = e.response?.data?.error || e.message;
      if (errorMsg.includes('Already clocked in')) {
        alert('⚠️ You are already clocked in!');
      } else {
        alert('Error: ' + errorMsg);
      }
    }
    setSaving(false);
  };

  const doClockOut = async () => {
    setSaving(true);
    try {
      await api.post('/waiter-shifts/clock-out', {
        shift_id: clockOutModal.id,
        ...clockOutForm
      });
      setClockOutModal(null);
      setClockOutForm({ break_minutes: 0, notes: '' });
      loadActive();
      if (tab === 'history') loadHistory();
      alert('✅ Clocked out successfully!');
    } catch (e) {
      alert('Error: ' + (e.response?.data?.error || e.message));
    }
    setSaving(false);
  };

  const doApproveOvertime = async () => {
    setSaving(true);
    try {
      await api.put(`/waiter-shifts/${overtimeModal.id}/approve-overtime`, overtimeForm);
      setOvertimeModal(null);
      loadHistory();
      alert('✅ Overtime ' + (overtimeForm.approved ? 'approved' : 'rejected'));
    } catch (e) {
      alert('Error: ' + (e.response?.data?.error || e.message));
    }
    setSaving(false);
  };

  const doPayCommission = async () => {
    setSaving(true);
    try {
      await api.post('/commissions/pay', {
        waiter_id: payCommModal.waiter_id,
        from: commFrom,
        to: commTo
      });
      setPayCommModal(null);
      loadCommissions();
      alert('✅ Commission paid successfully!');
    } catch (e) {
      alert('Error: ' + (e.response?.data?.error || e.message));
    }
    setSaving(false);
  };

  // Get current user's active shift
  const myShift = active.find(s => s.user_id === user?.id);

  // Current time display
  const currentTime = now.toLocaleTimeString('en-KE', { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: false,
    timeZone: 'Africa/Nairobi'
  });

  return (
    <div>
      <div className="page-header">
        <h2><i className="fa-solid fa-clock" style={{ marginRight: 8, color: '#F59E0B' }} />Staff Hours & Commissions</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Current time display */}
          <div style={{ 
            background: '#EFF6FF', 
            border: '1px solid #BFDBFE', 
            borderRadius: 8, 
            padding: '5px 12px',
            fontSize: 13,
            color: '#1E40AF',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <i className="fa-solid fa-clock" />
            <span>{currentTime}</span>
          </div>
          
          {canClockIn && !myShift && (
            <button className="btn btn-success" onClick={() => setClockInModal(true)}>
              <i className="fa-solid fa-play" /> Clock In
            </button>
          )}
          {canClockIn && myShift && (
            <button className="btn btn-danger" onClick={() => setClockOutModal(myShift)}>
              <i className="fa-solid fa-stop" /> Clock Out ({fmtHrs(hoursWorked(myShift.clock_in))})
            </button>
          )}
          {isManager && (
            <button className="btn btn-sm btn-outline" onClick={() => setClockInModal(true)}>
              <i className="fa-solid fa-user-plus" /> Clock In Staff
            </button>
          )}
        </div>
      </div>

      {/* My shift status - Only show if user has an active shift */}
      {myShift && canClockIn && (
        <div style={{ background: '#F0FDF4', border: '2px solid #10B981', borderRadius: 12, padding: '12px 20px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700, color: '#065F46', fontSize: 14 }}>
              <i className="fa-solid fa-circle" style={{ color: '#10B981', fontSize: 8, marginRight: 8 }} />
              You clocked in at {formatTime(myShift.clock_in)}
            </div>
            <div style={{ fontSize: 12, color: '#065F46', marginTop: 2 }}>
              {fmtHrs(hoursWorked(myShift.clock_in))} worked · Scheduled: {myShift.scheduled_hours}h
              {hoursWorked(myShift.clock_in) > myShift.scheduled_hours && (
                <span style={{ marginLeft: 12, background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D', borderRadius: 8, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>
                  ⚠️ {fmtHrs(hoursWorked(myShift.clock_in) - myShift.scheduled_hours)} OVERTIME
                </span>
              )}
            </div>
          </div>
          <div style={{ fontFamily: 'Montserrat', fontWeight: 900, fontSize: 28, color: '#065F46' }}>
            {fmtHrs(hoursWorked(myShift.clock_in))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid #E7E5E4', flexWrap: 'wrap' }}>
        <button onClick={() => setTab('live')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '8px 16px', fontWeight: 700, fontSize: 13,
            color: tab === 'live' ? '#D97706' : '#78716C',
            borderBottom: tab === 'live' ? '2px solid #D97706' : '2px solid transparent',
            marginBottom: -2
          }}>
          <i className="fa-solid fa-circle-dot" style={{ marginRight: 6 }} />Live Shifts
        </button>
        
        <button onClick={() => setTab('history')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '8px 16px', fontWeight: 700, fontSize: 13,
            color: tab === 'history' ? '#D97706' : '#78716C',
            borderBottom: tab === 'history' ? '2px solid #D97706' : '2px solid transparent',
            marginBottom: -2
          }}>
          <i className="fa-solid fa-history" style={{ marginRight: 6 }} />{canSeeAllShifts ? 'History' : 'My History'}
        </button>
        
        <button onClick={() => setTab('commissions')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '8px 16px', fontWeight: 700, fontSize: 13,
            color: tab === 'commissions' ? '#D97706' : '#78716C',
            borderBottom: tab === 'commissions' ? '2px solid #D97706' : '2px solid transparent',
            marginBottom: -2
          }}>
          <i className="fa-solid fa-coins" style={{ marginRight: 6 }} />{canSeeAllShifts ? 'Commissions' : 'My Commissions'}
        </button>
      </div>

      {/* LIVE TAB */}
      {tab === 'live' && (
        <div>
          {active.length === 0 ? (
            <div className="empty-state">
              <i className="fa-solid fa-user-clock" />
              <p>{canSeeAllShifts ? 'No staff clocked in right now' : 'You are not clocked in'}</p>
              {canClockIn && !myShift && (
                <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setClockInModal(true)}>
                  <i className="fa-solid fa-play" /> Clock In Now
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
              {active.map(s => {
                const hrs = hoursWorked(s.clock_in);
                const isOT = hrs > (s.scheduled_hours || 8);
                const pct = Math.min(100, (hrs / (s.scheduled_hours || 8)) * 100);
                return (
                  <div key={s.id} className="card" style={{ padding: 16, border: `2px solid ${isOT ? '#F59E0B' : '#E7E5E4'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 15 }}>{s.waiter_name}</div>
                        <div style={{ fontSize: 11, color: '#78716C', textTransform: 'uppercase' }}>{s.role}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'Montserrat', fontWeight: 900, fontSize: 22, color: isOT ? '#D97706' : '#1C1917' }}>{fmtHrs(hrs)}</div>
                        {isOT && <div style={{ fontSize: 10, color: '#D97706', fontWeight: 700 }}>+{fmtHrs(hrs - 8)} OT</div>}
                      </div>
                    </div>
                    <div style={{ background: '#E7E5E4', borderRadius: 4, height: 6, marginBottom: 8, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: isOT ? '#F59E0B' : '#10B981', transition: 'width 1s' }} />
                    </div>
                    <div style={{ fontSize: 11, color: '#78716C', marginBottom: 10 }}>
                      In: {formatTime(s.clock_in)} · Scheduled: {s.scheduled_hours}h
                    </div>
                    {(s.user_id === user?.id || isManager) && canClockIn && (
                      <button className="btn btn-sm btn-danger btn-full" onClick={() => setClockOutModal(s)}>
                        <i className="fa-solid fa-stop" /> Clock Out
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {tab === 'history' && (
        <div>
          {isManager && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'end' }}>
              <div><label className="form-label">From</label><input type="date" className="form-input" value={histFrom} onChange={e => setHistFrom(e.target.value)} /></div>
              <div><label className="form-label">To</label><input type="date" className="form-input" value={histTo} onChange={e => setHistTo(e.target.value)} /></div>
              <div><label className="form-label">Staff</label>
                <select className="form-input" value={histUser} onChange={e => setHistUser(e.target.value)}>
                  <option value="">All</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <button className="btn btn-primary" onClick={loadHistory}>Search</button>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 14 }}>
            {[
              ['Total Shifts', shiftSummary.total_shifts || 0, '#1C1917'],
              ['Total Hours', fmtHrs(shiftSummary.total_hours || 0), '#3B82F6'],
              ['Overtime', fmtHrs(shiftSummary.total_overtime || 0), '#F59E0B'],
              ['OT Shifts', shiftSummary.overtime_shifts || 0, '#EF4444'],
            ].map(([label, val, color]) => (
              <div key={label} className="card" style={{ padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 18, color }}>{typeof val === 'string' ? val : val}</div>
                <div style={{ fontSize: 11, color: '#78716C' }}>{label}</div>
              </div>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 32, color: '#78716C' }}>Loading...</div>
          ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#FAFAF9', borderBottom: '2px solid #E7E5E4' }}>
                    {isManager && <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#78716C' }}>Staff</th>}
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#78716C' }}>Date</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#78716C' }}>Clock In</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#78716C' }}>Clock Out</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#78716C' }}>Break</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#78716C' }}>Hours</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#78716C' }}>Overtime</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#78716C' }}>Status</th>
                    {isManager && <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#78716C' }}>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {shifts.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #F5F5F4' }}>
                      {isManager && <td style={{ padding: '8px 12px', fontWeight: 700, fontSize: 13 }}>{s.waiter_name}</td>}
                      <td style={{ padding: '8px 12px', fontSize: 12, color: '#78716C' }}>{formatDate(s.date)}</td>
                      <td style={{ padding: '8px 12px', fontSize: 12 }}>{formatTime(s.clock_in)}</td>
                      <td style={{ padding: '8px 12px', fontSize: 12 }}>{s.clock_out ? formatTime(s.clock_out) : <span style={{ color: '#10B981', fontWeight: 700 }}>Active</span>}</td>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: '#78716C' }}>{s.break_minutes || 0}m</td>
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: '#3B82F6' }}>{s.actual_hours ? fmtHrs(s.actual_hours) : '—'}</td>
                      <td style={{ padding: '8px 12px' }}>
                        {s.overtime_hours > 0 ? (
                          <div>
                            <span style={{ color: s.overtime_approved ? '#10B981' : '#F59E0B', fontWeight: 700, fontSize: 12 }}>
                              {fmtHrs(s.overtime_hours)}
                            </span>
                            <div style={{ fontSize: 10, color: '#78716C' }}>
                              {s.overtime_approved ? '✓ Approved' : '⏳ Pending'}
                            </div>
                          </div>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{
                          background: s.status === 'active' ? '#F0FDF4' : '#F5F5F4',
                          color: s.status === 'active' ? '#065F46' : '#78716C',
                          border: `1px solid ${s.status === 'active' ? '#86EFAC' : '#E7E5E4'}`,
                          borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700
                        }}>
                          {s.status}
                        </span>
                      </td>
                      {isManager && (
                        <td style={{ padding: '8px 12px' }}>
                          {s.overtime_hours > 0 && !s.overtime_approved && s.status !== 'active' && (
                            <button className="btn btn-sm btn-warning" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => { setOvertimeModal(s); setOvertimeForm({ approved: true, notes: '' }); }}>
                              Approve OT
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {shifts.length === 0 && <div style={{ textAlign: 'center', padding: 32, color: '#78716C' }}>No shifts found</div>}
            </div>
          )}
        </div>
      )}

      {/* COMMISSIONS TAB */}
      {tab === 'commissions' && (
        <div>
          {isManager && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'end' }}>
              <div><label className="form-label">From</label><input type="date" className="form-input" value={commFrom} onChange={e => setCommFrom(e.target.value)} /></div>
              <div><label className="form-label">To</label><input type="date" className="form-input" value={commTo} onChange={e => setCommTo(e.target.value)} /></div>
              <button className="btn btn-primary" onClick={loadCommissions}>Search</button>
            </div>
          )}

          {commSummary.length > 0 && isManager && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10, marginBottom: 16 }}>
              {commSummary.map(w => (
                <div key={w.waiter_id} className="card" style={{ padding: 14 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>{w.waiter_name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: '#78716C' }}>Total earned:</span>
                    <strong style={{ color: '#D97706' }}>{fmt(w.total_commission)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: '#78716C' }}>Paid out:</span>
                    <strong style={{ color: '#10B981' }}>{fmt(w.paid_commission)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 10 }}>
                    <span style={{ color: '#78716C' }}>Unpaid:</span>
                    <strong style={{ color: w.unpaid_commission > 0 ? '#EF4444' : '#10B981' }}>{fmt(w.unpaid_commission)}</strong>
                  </div>
                  {w.unpaid_commission > 0 && (
                    <button className="btn btn-sm btn-success btn-full" onClick={() => setPayCommModal(w)}>
                      <i className="fa-solid fa-money-bill" /> Pay {fmt(w.unpaid_commission)}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {!isManager && commSummary.length > 0 && (
            <div className="card" style={{ padding: 16, marginBottom: 16, textAlign: 'center' }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Your Commission Summary ({commFrom} to {commTo})</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#78716C' }}>Total Earned</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#D97706' }}>{fmt(commSummary[0]?.total_commission || 0)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#78716C' }}>Paid Out</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#10B981' }}>{fmt(commSummary[0]?.paid_commission || 0)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#78716C' }}>Unpaid</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: commSummary[0]?.unpaid_commission > 0 ? '#EF4444' : '#10B981' }}>{fmt(commSummary[0]?.unpaid_commission || 0)}</div>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: 32, color: '#78716C' }}>Loading...</div>
          ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #E7E5E4', fontWeight: 700, fontSize: 13 }}>
                Commission Transactions ({commissions.length})
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#FAFAF9', borderBottom: '2px solid #E7E5E4' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#78716C' }}>Date</th>
                    {isManager && <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#78716C' }}>Waiter</th>}
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#78716C' }}>Item</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#78716C' }}>Qty</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#78716C' }}>Sale</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#78716C' }}>Rate</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#78716C' }}>Commission</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#78716C' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #F5F5F4' }}>
                      <td style={{ padding: '8px 12px', fontSize: 11, color: '#78716C' }}>{formatDate(c.created_at)}</td>
                      {isManager && <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 700 }}>{c.waiter_name}</td>}
                      <td style={{ padding: '8px 12px', fontSize: 12 }}>{c.item_name || c.item_name_fresh}</td>
                      <td style={{ padding: '8px 12px', fontSize: 12, textAlign: 'center' }}>{c.quantity}</td>
                      <td style={{ padding: '8px 12px', fontSize: 12, textAlign: 'right' }}>{fmt(c.sale_amount)}</td>
                      <td style={{ padding: '8px 12px', fontSize: 12, textAlign: 'center', color: '#78716C' }}>{c.commission_rate}%</td>
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: '#D97706', textAlign: 'right' }}>{fmt(c.commission_amount)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        {c.paid ? (
                          <span style={{ color: '#10B981', fontSize: 11, fontWeight: 700 }}>✓ Paid</span>
                        ) : (
                          <span style={{ color: '#EF4444', fontSize: 11, fontWeight: 700 }}>Unpaid</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {commissions.length === 0 && <div style={{ textAlign: 'center', padding: 32, color: '#78716C' }}>No commissions in this period</div>}
            </div>
          )}
        </div>
      )}

      {/* Clock In Modal */}
      {clockInModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setClockInModal(false)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <span className="modal-title"><i className="fa-solid fa-play" style={{ marginRight: 8, color: '#10B981' }} />Clock In</span>
              <button className="modal-close" onClick={() => setClockInModal(false)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="modal-body">
              {isManager && (
                <div className="form-group">
                  <label className="form-label">Staff Member</label>
                  <select className="form-input" value={clockInForm.user_id} onChange={e => setClockInForm({ ...clockInForm, user_id: e.target.value })}>
                    <option value="">— Select staff —</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                  </select>
                </div>
              )}
              {!isManager && (
                <div style={{ background: '#F0FDF4', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
                  <div><strong>Clocking in as:</strong> {user?.name}</div>
                  <div style={{ fontSize: 12, color: '#78716C', marginTop: 4 }}>Role: {user?.role}</div>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Notes (optional)</label>
                <input className="form-input" value={clockInForm.notes} onChange={e => setClockInForm({ ...clockInForm, notes: e.target.value })} placeholder="e.g. covering for Alice" />
              </div>
              <div style={{ background: '#EFF6FF', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#1E40AF' }}>
                <i className="fa-solid fa-clock" style={{ marginRight: 8 }} />
                Current time: <strong>{currentTime}</strong> (East Africa Time)
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setClockInModal(false)}>Cancel</button>
              <button className="btn btn-success" onClick={doClockIn} disabled={saving}>
                <i className="fa-solid fa-play" /> {saving ? '...' : 'Clock In'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clock Out Modal */}
      {clockOutModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setClockOutModal(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <span className="modal-title"><i className="fa-solid fa-stop" style={{ marginRight: 8, color: '#EF4444' }} />Clock Out — {clockOutModal.waiter_name}</span>
              <button className="modal-close" onClick={() => setClockOutModal(null)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="modal-body">
              <div style={{ background: '#FEF2F2', borderRadius: 8, padding: '12px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, color: '#78716C' }}>Time worked</div>
                  <div style={{ fontFamily: 'Montserrat', fontWeight: 900, fontSize: 24, color: '#1C1917' }}>
                    {fmtHrs(hoursWorked(clockOutModal.clock_in))}
                  </div>
                </div>
                {hoursWorked(clockOutModal.clock_in) > (clockOutModal.scheduled_hours || 8) && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: '#D97706', fontWeight: 700 }}>OVERTIME</div>
                    <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 18, color: '#D97706' }}>
                      +{fmtHrs(hoursWorked(clockOutModal.clock_in) - (clockOutModal.scheduled_hours || 8))}
                    </div>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Break taken (minutes)</label>
                <input type="number" className="form-input" min={0} value={clockOutForm.break_minutes}
                  onChange={e => setClockOutForm({ ...clockOutForm, break_minutes: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <input className="form-input" value={clockOutForm.notes}
                  onChange={e => setClockOutForm({ ...clockOutForm, notes: e.target.value })} />
              </div>
              {hoursWorked(clockOutModal.clock_in) > (clockOutModal.scheduled_hours || 8) && (
                <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#92400E' }}>
                  <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 6 }} />
                  Overtime will be flagged for management approval.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setClockOutModal(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={doClockOut} disabled={saving}>
                <i className="fa-solid fa-stop" /> {saving ? '...' : 'Confirm Clock Out'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Overtime Modal - Managers only */}
      {overtimeModal && isManager && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setOvertimeModal(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <span className="modal-title"><i className="fa-solid fa-clock" style={{ marginRight: 8, color: '#F59E0B' }} />Overtime Approval</span>
              <button className="modal-close" onClick={() => setOvertimeModal(null)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="modal-body">
              <div style={{ background: '#FFFBEB', borderRadius: 8, padding: '12px 16px', marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{overtimeModal.waiter_name}</div>
                <div style={{ fontSize: 13, color: '#78716C', marginTop: 4 }}>
                  Worked: {fmtHrs(overtimeModal.actual_hours)} · Overtime: <strong style={{ color: '#D97706' }}>{fmtHrs(overtimeModal.overtime_hours)}</strong>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <button onClick={() => setOvertimeForm({ ...overtimeForm, approved: true })}
                  style={{ flex: 1, padding: '10px', borderRadius: 8, border: `2px solid ${overtimeForm.approved ? '#10B981' : '#E7E5E4'}`, background: overtimeForm.approved ? '#F0FDF4' : 'white', cursor: 'pointer', fontWeight: 700, color: overtimeForm.approved ? '#065F46' : '#78716C' }}>
                  ✓ Approve
                </button>
                <button onClick={() => setOvertimeForm({ ...overtimeForm, approved: false })}
                  style={{ flex: 1, padding: '10px', borderRadius: 8, border: `2px solid ${!overtimeForm.approved ? '#EF4444' : '#E7E5E4'}`, background: !overtimeForm.approved ? '#FEF2F2' : 'white', cursor: 'pointer', fontWeight: 700, color: !overtimeForm.approved ? '#991B1B' : '#78716C' }}>
                  ✕ Reject
                </button>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" rows={2} value={overtimeForm.notes}
                  onChange={e => setOvertimeForm({ ...overtimeForm, notes: e.target.value })}
                  placeholder={overtimeForm.approved ? 'Reason for approval...' : 'Reason for rejection...'} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setOvertimeModal(null)}>Cancel</button>
              <button className={`btn ${overtimeForm.approved ? 'btn-success' : 'btn-danger'}`} onClick={doApproveOvertime} disabled={saving}>
                {saving ? '...' : overtimeForm.approved ? 'Approve Overtime' : 'Reject Overtime'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Commission Modal - Managers only */}
      {payCommModal && isManager && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPayCommModal(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <span className="modal-title"><i className="fa-solid fa-money-bill" style={{ marginRight: 8, color: '#10B981' }} />Pay Commission</span>
              <button className="modal-close" onClick={() => setPayCommModal(null)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, color: '#44403C', marginBottom: 16 }}>
                Pay all unpaid commissions for <strong>{payCommModal.waiter_name}</strong> ({commFrom} to {commTo})?
              </p>
              <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#065F46' }}>Amount to pay</div>
                <div style={{ fontFamily: 'Montserrat', fontWeight: 900, fontSize: 28, color: '#065F46' }}>{fmt(payCommModal.unpaid_commission)}</div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setPayCommModal(null)}>Cancel</button>
              <button className="btn btn-success" onClick={doPayCommission} disabled={saving}>
                {saving ? '...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}