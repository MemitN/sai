import React, { useState, useEffect, useCallback } from 'react';
import api from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';

const STATUS_MAP = {
  free: { label: 'Free', icon: 'fa-circle-check', color: '#10B981' },
  occupied: { label: 'Occupied', icon: 'fa-utensils', color: '#D97706' },
  billing: { label: 'Billing', icon: 'fa-circle-exclamation', color: '#EF4444' },
};

const ROOM_STATUS_MAP = {
  available: { label: 'Available', icon: 'fa-circle-check', color: '#10B981' },
  occupied: { label: 'Occupied', icon: 'fa-bed', color: '#D97706' },
  checkout: { label: 'Checkout', icon: 'fa-circle-exclamation', color: '#EF4444' },
  maintenance: { label: 'Maintenance', icon: 'fa-wrench', color: '#9CA3AF' },
};

export default function TablesPage({ onSelectTable, initialView = 'tables' }) {
  const { user } = useAuth();
  const [tables, setTables] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [view, setView] = useState(initialView);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [manageModal, setManageModal] = useState(null);
  const [manageForm, setManageForm] = useState({ number: '', name: '', capacity: 4, type: 'standard', rate_per_night: 0 });
  const [checkInModal, setCheckInModal] = useState(null);
  const [checkInForm, setCheckInForm] = useState({ 
    guest_name: '', guest_phone: '', guest_email: '', guest_id_number: '', 
    check_in: '', check_out: '', deposit_paid: 0, notes: '' 
  });
  const [checkoutConfirm, setCheckoutConfirm] = useState(null);
  
  // Merge Bill States
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedTables, setSelectedTables] = useState([]);
  const [merging, setMerging] = useState(false);
  const [mergePreview, setMergePreview] = useState(null);

  const load = useCallback(async () => {
    try {
      const [tRes, rRes] = await Promise.all([
        api.get('/tables'),
        api.get('/rooms'),
      ]);
      setTables(tRes.data);
      setRooms(rRes.data);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);

  const filteredTables = tables.filter(t => filter === 'all' || t.status === filter);
  const counts = {
    all: tables.length,
    free: tables.filter(t=>t.status==='free').length,
    occupied: tables.filter(t=>t.status==='occupied').length,
    billing: tables.filter(t=>t.status==='billing').length,
  };

  const roomCounts = {
    all: rooms.length,
    available: rooms.filter(r=>r.status==='available').length,
    occupied: rooms.filter(r=>r.status==='occupied').length,
    checkout: rooms.filter(r=>r.status==='checkout').length,
    maintenance: rooms.filter(r=>r.status==='maintenance').length,
  };

  // Merge Bill Functions
  const toggleMergeSelect = (table) => {
    if (table.status !== 'occupied' && table.status !== 'billing') {
      alert('Only occupied or billing tables can be merged');
      return;
    }
    setSelectedTables(prev => {
      const exists = prev.find(t => t.id === table.id);
      if (exists) {
        return prev.filter(t => t.id !== table.id);
      } else {
        return [...prev, table];
      }
    });
  };

  const previewMerge = async () => {
    if (selectedTables.length < 2) {
      alert('Select at least 2 tables to merge');
      return;
    }
    try {
      const tableIds = selectedTables.map(t => t.id);
      const { data } = await api.post('/bills/merge-preview', { table_ids: tableIds });
      setMergePreview(data);
    } catch(e) {
      alert('Error previewing merge: ' + (e.response?.data?.error || e.message));
    }
  };

  const confirmMerge = async () => {
    if (selectedTables.length < 2) return;
    setMerging(true);
    try {
      const tableIds = selectedTables.map(t => t.id);
      await api.post('/bills/merge', { table_ids: tableIds });
      alert(`Successfully merged ${selectedTables.length} tables!`);
      setMergeMode(false);
      setSelectedTables([]);
      setMergePreview(null);
      load();
    } catch(e) {
      alert('Error merging bills: ' + (e.response?.data?.error || e.message));
    } finally {
      setMerging(false);
    }
  };

  const cancelMerge = () => {
    setMergeMode(false);
    setSelectedTables([]);
    setMergePreview(null);
  };

  // Handle check-in
  const openCheckIn = (room) => {
    const today = new Date().toISOString().slice(0, 16);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 16);
    setCheckInForm({
      guest_name: '', guest_phone: '', guest_email: '', guest_id_number: '',
      check_in: today, check_out: tomorrow, deposit_paid: 0, notes: ''
    });
    setCheckInModal(room);
  };

  const handleCheckIn = async () => {
    if (!checkInForm.guest_name) {
      alert('Guest name is required');
      return;
    }
    try {
      await api.post(`/rooms/${checkInModal.id}/checkin`, checkInForm);
      setCheckInModal(null);
      load();
      alert('Guest checked in successfully!');
    } catch(e) {
      alert('Error: ' + (e.response?.data?.error || e.message));
    }
  };

  // Handle check-out
  const handleCheckOut = async (room) => {
    try {
      const { data } = await api.post(`/rooms/${room.id}/checkout`);
      setCheckoutConfirm(null);
      load();
      alert(`Bill created! Bill Number: ${data.bill_number}\nAmount: KES ${(data.total_amount || 0).toLocaleString()}\n\nGo to Room Bills page to process payment.`);
    } catch(e) {
      alert('Error: ' + (e.response?.data?.error || e.message));
    }
  };

  // Handle add table/room
  const handleAdd = async () => {
    if (!manageForm.number) {
      alert('Number is required');
      return;
    }
    try {
      if (manageModal === 'table') {
        await api.post('/tables', { number: manageForm.number, name: manageForm.name, capacity: manageForm.capacity });
      } else {
        await api.post('/rooms', { number: manageForm.number, name: manageForm.name, type: manageForm.type, rate_per_night: manageForm.rate_per_night });
      }
      setManageModal(null);
      setManageForm({ number: '', name: '', capacity: 4, type: 'standard', rate_per_night: 0 });
      load();
    } catch(e) {
      alert('Error: ' + (e.response?.data?.error || e.message));
    }
  };

  // Handle delete
  const handleDelete = async (type, id) => {
    if (!window.confirm(`Delete this ${type}? This action cannot be undone.`)) return;
    try {
      if (type === 'table') {
        await api.delete(`/tables/${id}`);
      } else {
        await api.delete(`/rooms/${id}`);
      }
      load();
    } catch(e) {
      alert('Error: ' + (e.response?.data?.error || e.message));
    }
  };

  if (loading) return <div className="loading"><div className="spinner"/><p>Loading...</p></div>;

  return (
    <div>
      {/* View toggle */}
      <div className="page-header">
        <h2>
          <i className={`fa-solid ${view === 'tables' ? 'fa-table-cells' : 'fa-hotel'}`} style={{marginRight:8,color:'#F59E0B'}} />
          {view === 'tables' ? 'Restaurant Tables' : 'Guest Rooms'}
        </h2>
        <div style={{display:'flex',gap:6}}>
          {view === 'tables' && (
            <button 
              className={`btn btn-sm ${mergeMode ? 'btn-primary' : 'btn-outline'}`} 
              onClick={() => setMergeMode(!mergeMode)}
              style={{ background: mergeMode ? '#8B5CF6' : undefined, borderColor: '#8B5CF6', color: mergeMode ? 'white' : '#8B5CF6' }}
            >
              <i className="fa-solid fa-layer-group" /> {mergeMode ? 'Exit Merge Mode' : 'Merge Bills'}
            </button>
          )}
          <button className={`btn btn-sm ${view==='tables'?'btn-secondary':'btn-outline'}`} onClick={() => { setView('tables'); setMergeMode(false); setSelectedTables([]); }}>
            <i className="fa-solid fa-table" /> Tables
          </button>
          <button className={`btn btn-sm ${view==='rooms'?'btn-secondary':'btn-outline'}`} onClick={() => { setView('rooms'); setMergeMode(false); setSelectedTables([]); }}>
            <i className="fa-solid fa-bed" /> Rooms
          </button>
          <button className="btn btn-sm btn-outline" onClick={load}>
            <i className="fa-solid fa-rotate" />
          </button>
        </div>
      </div>

      {view === 'tables' ? (
        <>
          {/* Filter Tabs for Tables */}
          <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
            {['all','free','occupied','billing'].map(f => (
              <button
                key={f}
                className={`cat-tab ${filter===f?'active':''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase()+f.slice(1)}
                <span style={{
                  background: filter===f?'rgba(0,0,0,0.15)':'#E7E5E4',
                  borderRadius:10, padding:'1px 7px', fontSize:11, fontWeight:700
                }}>{counts[f]}</span>
              </button>
            ))}
          </div>

          {/* Merge Preview Panel */}
          {mergeMode && selectedTables.length > 0 && (
            <div style={{
              background: '#EDE9FE',
              border: '2px solid #8B5CF6',
              borderRadius: '12px',
              padding: '12px 16px',
              marginBottom: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div>
                <i className="fa-solid fa-layer-group" style={{ color: '#8B5CF6', marginRight: '8px' }} />
                <strong>{selectedTables.length} table(s) selected for merge:</strong>
                <span style={{ marginLeft: '8px', fontSize: '12px' }}>
                  {selectedTables.map(t => `Table ${t.number}`).join(', ')}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-sm btn-outline" onClick={previewMerge} style={{ borderColor: '#8B5CF6', color: '#8B5CF6' }}>
                  <i className="fa-solid fa-eye" /> Preview
                </button>
                <button className="btn btn-sm btn-success" onClick={confirmMerge} disabled={merging}>
                  {merging ? <span className="spinner" style={{ width: '12px', height: '12px' }} /> : <><i className="fa-solid fa-check" /> Merge</>}
                </button>
                <button className="btn btn-sm btn-danger" onClick={cancelMerge}>
                  <i className="fa-solid fa-times" /> Cancel
                </button>
              </div>
            </div>
          )}

          {/* Merge Preview Modal */}
          {mergePreview && (
            <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setMergePreview(null)}>
              <div className="modal modal-lg" style={{ maxWidth: '500px' }}>
                <div className="modal-header">
                  <span className="modal-title">
                    <i className="fa-solid fa-layer-group" style={{ marginRight: '8px', color: '#8B5CF6' }} />
                    Merge Preview
                  </span>
                  <button className="modal-close" onClick={() => setMergePreview(null)}><i className="fa-solid fa-xmark" /></button>
                </div>
                <div className="modal-body">
                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ marginBottom: '8px' }}>Tables being merged:</h4>
                    {mergePreview.tables?.map(table => (
                      <div key={table.id} style={{ padding: '6px 0', borderBottom: '1px solid #F0F0F0' }}>
                        <strong>Table {table.number}</strong> - {fmt(table.total || 0)}
                      </div>
                    ))}
                  </div>
                  <div style={{ background: '#F5F5F4', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                    <h4 style={{ marginBottom: '8px' }}>Merged Items:</h4>
                    {mergePreview.items?.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                        <span>{item.quantity}× {item.name}</span>
                        <span style={{ fontWeight: 600 }}>{fmt(item.total)}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '12px', borderTop: '2px solid #E7E5E4' }}>
                    <strong style={{ fontSize: '16px' }}>New Total:</strong>
                    <strong style={{ fontSize: '18px', color: '#D97706' }}>{fmt(mergePreview.total || 0)}</strong>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline" onClick={() => setMergePreview(null)}>Close</button>
                </div>
              </div>
            </div>
          )}

          <div className="tables-grid">
            {filteredTables.map(table => (
              <div
                key={table.id}
                className={`table-card ${table.status}`}
                onClick={() => {
                  if (mergeMode) {
                    toggleMergeSelect(table);
                  } else {
                    onSelectTable(table);
                  }
                }}
                style={{
                  cursor: mergeMode ? 'pointer' : 'pointer',
                  border: mergeMode && selectedTables.find(t => t.id === table.id) ? '3px solid #8B5CF6' : undefined,
                  opacity: mergeMode && table.status !== 'occupied' && table.status !== 'billing' ? 0.4 : 1
                }}
              >
                {mergeMode && selectedTables.find(t => t.id === table.id) && (
                  <div style={{ position: 'absolute', top: '-10px', right: '-10px', background: '#8B5CF6', color: 'white', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                    {selectedTables.findIndex(t => t.id === table.id) + 1}
                  </div>
                )}
                <i className={`fa-solid ${STATUS_MAP[table.status]?.icon}`}
                   style={{color: STATUS_MAP[table.status]?.color, fontSize:14, marginBottom:4}} />
                <div className="table-number">{table.number}</div>
                {table.name && <div style={{fontSize:10, color:'#78716C'}}>{table.name}</div>}
                <div className="table-status" style={{color: STATUS_MAP[table.status]?.color}}>
                  {STATUS_MAP[table.status]?.label}
                </div>
                <div className="table-info">
                  <i className="fa-solid fa-user" /> {table.capacity} seats
                </div>
              </div>
            ))}
          </div>

          {/* Management - Add Table Button */}
          {(user?.role === 'admin' || user?.role === 'management') && !mergeMode && (
            <button className="btn btn-sm btn-primary" style={{marginTop:16}} onClick={() => setManageModal('table')}>
              <i className="fa-solid fa-plus" /> Add Table
            </button>
          )}

          <div style={{display:'flex',gap:16,marginTop:16,flexWrap:'wrap'}}>
            {Object.entries(STATUS_MAP).map(([k,v]) => (
              <div key={k} style={{display:'flex',alignItems:'center',gap:6,fontSize:12}}>
                <i className={`fa-solid ${v.icon}`} style={{color:v.color}} />
                <span style={{color:'#78716C'}}>{v.label}: {counts[k]||0}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Filter Tabs for Rooms */}
          <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
            {['all','available','occupied','checkout','maintenance'].map(f => (
              <button
                key={f}
                className={`cat-tab ${filter===f?'active':''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase()+f.slice(1)}
                <span style={{
                  background: filter===f?'rgba(0,0,0,0.15)':'#E7E5E4',
                  borderRadius:10, padding:'1px 7px', fontSize:11, fontWeight:700
                }}>{roomCounts[f]}</span>
              </button>
            ))}
          </div>

          <div className="rooms-grid" style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:12}}>
            {rooms.filter(r => filter === 'all' || r.status === filter).map(room => (
              <div
                key={room.id}
                className={`room-card ${room.status}`}
                style={{
                  border: `2px solid ${ROOM_STATUS_MAP[room.status]?.color || '#E7E5E4'}`,
                  borderRadius: 12,
                  padding: 16,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  background: room.status === 'occupied' ? '#FFFBEB' : 'white'
                }}
              >
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8}}>
                  <i className={`fa-solid ${ROOM_STATUS_MAP[room.status]?.icon}`}
                     style={{color: ROOM_STATUS_MAP[room.status]?.color, fontSize:16}} />
                  {(user?.role === 'admin' || user?.role === 'management') && room.status !== 'occupied' && (
                    <button 
                      className="btn btn-sm btn-outline" 
                      style={{padding:'2px 6px', fontSize:10}}
                      onClick={(e) => { e.stopPropagation(); handleDelete('room', room.id); }}
                    >
                      <i className="fa-solid fa-trash" style={{fontSize:10}} />
                    </button>
                  )}
                </div>
                <div style={{fontFamily:'Poppins', fontSize:22, fontWeight:800}}>{room.number}</div>
                {room.name && <div style={{fontSize:12, color:'#78716C', marginTop:2}}>{room.name}</div>}
                <div style={{fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px', marginTop:4, color: ROOM_STATUS_MAP[room.status]?.color}}>
                  {ROOM_STATUS_MAP[room.status]?.label}
                </div>
                <div style={{fontSize:12, fontWeight:700, color:'#D97706', marginTop:6}}>
                  KES {Number(room.rate_per_night || 0).toLocaleString()}/night
                </div>
                
                {/* Guest info if occupied */}
                {room.status === 'occupied' && room.guest_name && (
                  <div style={{marginTop:10, paddingTop:8, borderTop:'1px solid #F5F5F4'}}>
                    <div style={{fontSize:11, color:'#78716C'}}>
                      <i className="fa-solid fa-user" style={{marginRight:4}} /> {room.guest_name}
                    </div>
                    {room.check_in && (
                      <div style={{fontSize:10, color:'#A8A29E', marginTop:2}}>
                        <i className="fa-solid fa-calendar" style={{marginRight:4}} /> 
                        {room.check_in.slice(0,10)} → {room.check_out?.slice(0,10) || '—'}
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons based on status */}
                <div style={{marginTop:12, display:'flex', gap:6}}>
                  {room.status === 'available' && (
                    <button 
                      className="btn btn-sm btn-primary" 
                      style={{flex:1}}
                      onClick={(e) => { e.stopPropagation(); openCheckIn(room); }}
                    >
                      <i className="fa-solid fa-sign-in-alt" /> Check In
                    </button>
                  )}
                  {room.status === 'occupied' && (
                    <button 
                      className="btn btn-sm btn-success" 
                      style={{flex:1}}
                      onClick={(e) => { e.stopPropagation(); setCheckoutConfirm(room); }}
                    >
                      <i className="fa-solid fa-sign-out-alt" /> Check Out
                    </button>
                  )}
                  {(user?.role === 'admin' || user?.role === 'management') && room.status === 'available' && (
                    <button 
                      className="btn btn-sm btn-outline"
                      onClick={(e) => { e.stopPropagation(); setManageModal('room'); setManageForm({ number: room.number, name: room.name || '', type: room.type, rate_per_night: room.rate_per_night }); }}
                    >
                      <i className="fa-solid fa-edit" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Management - Add Room Button */}
          {(user?.role === 'admin' || user?.role === 'management') && (
            <button className="btn btn-sm btn-primary" style={{marginTop:16}} onClick={() => setManageModal('room')}>
              <i className="fa-solid fa-plus" /> Add Room
            </button>
          )}
        </>
      )}

      {/* Manage Modal (Add/Edit Table/Room) */}
      {manageModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setManageModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">
                <i className={`fa-solid ${manageModal === 'table' ? 'fa-table' : 'fa-bed'}`} style={{marginRight:8, color:'#F59E0B'}} />
                {manageForm.number ? 'Edit' : 'Add New'} {manageModal === 'table' ? 'Table' : 'Room'}
              </span>
              <button className="modal-close" onClick={() => setManageModal(null)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">{manageModal === 'table' ? 'Table Number' : 'Room Number'}</label>
                <input 
                  className="form-input" 
                  placeholder={manageModal === 'table' ? "e.g. 21" : "e.g. R01"} 
                  value={manageForm.number} 
                  onChange={e => setManageForm({ ...manageForm, number: e.target.value })} 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Name (optional)</label>
                <input 
                  className="form-input" 
                  placeholder={manageModal === 'table' ? "e.g. Window Table" : "e.g. Executive Suite"} 
                  value={manageForm.name} 
                  onChange={e => setManageForm({ ...manageForm, name: e.target.value })} 
                />
              </div>
              {manageModal === 'table' && (
                <div className="form-group">
                  <label className="form-label">Capacity (seats)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={manageForm.capacity} 
                    onChange={e => setManageForm({ ...manageForm, capacity: e.target.value })} 
                  />
                </div>
              )}
              {manageModal === 'room' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Room Type</label>
                    <select 
                      className="form-select" 
                      value={manageForm.type} 
                      onChange={e => setManageForm({ ...manageForm, type: e.target.value })}
                    >
                      <option value="standard">Standard</option>
                      <option value="deluxe">Deluxe</option>
                      <option value="suite">Suite</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Rate per Night (KES)</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={manageForm.rate_per_night} 
                      onChange={e => setManageForm({ ...manageForm, rate_per_night: e.target.value })} 
                    />
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setManageModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAdd}>
                <i className="fa-solid fa-check" /> {manageForm.number ? 'Save' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Check-In Modal */}
      {checkInModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setCheckInModal(null)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">
                <i className="fa-solid fa-sign-in-alt" style={{marginRight:8, color:'#F59E0B'}} />
                Check In - Room {checkInModal.number}
              </span>
              <button className="modal-close" onClick={() => setCheckInModal(null)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Guest Name *</label>
                  <input 
                    className="form-input" 
                    value={checkInForm.guest_name} 
                    onChange={e => setCheckInForm({...checkInForm, guest_name: e.target.value})} 
                    placeholder="Full name"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input 
                    className="form-input" 
                    value={checkInForm.guest_phone} 
                    onChange={e => setCheckInForm({...checkInForm, guest_phone: e.target.value})} 
                    placeholder="07XX XXX XXX"
                  />
                </div>
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input 
                    className="form-input" 
                    type="email"
                    value={checkInForm.guest_email} 
                    onChange={e => setCheckInForm({...checkInForm, guest_email: e.target.value})} 
                    placeholder="guest@example.com"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">ID Number</label>
                  <input 
                    className="form-input" 
                    value={checkInForm.guest_id_number} 
                    onChange={e => setCheckInForm({...checkInForm, guest_id_number: e.target.value})} 
                    placeholder="National ID / Passport"
                  />
                </div>
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Check In Date & Time</label>
                  <input 
                    type="datetime-local" 
                    className="form-input" 
                    value={checkInForm.check_in} 
                    onChange={e => setCheckInForm({...checkInForm, check_in: e.target.value})} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Check Out Date & Time</label>
                  <input 
                    type="datetime-local" 
                    className="form-input" 
                    value={checkInForm.check_out} 
                    onChange={e => setCheckInForm({...checkInForm, check_out: e.target.value})} 
                  />
                </div>
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Deposit Paid (KES)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={checkInForm.deposit_paid} 
                    onChange={e => setCheckInForm({...checkInForm, deposit_paid: e.target.value})} 
                    placeholder="0"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Room Rate (KES/night)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={checkInModal.rate_per_night || 0} 
                    disabled
                    style={{background:'#F5F5F4'}}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes / Special Requests</label>
                <textarea 
                  className="form-textarea" 
                  rows={2}
                  value={checkInForm.notes} 
                  onChange={e => setCheckInForm({...checkInForm, notes: e.target.value})} 
                  placeholder="Any special notes about the guest or stay..."
                />
              </div>
              <div style={{background:'#FEF3C7', padding:12, borderRadius:8, fontSize:12, color:'#92400E'}}>
                <i className="fa-solid fa-info-circle" style={{marginRight:6}} />
                Estimated total: <strong>KES {((checkInModal.rate_per_night || 0) * 1).toLocaleString()}</strong> (per night)
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setCheckInModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCheckIn}>
                <i className="fa-solid fa-check" /> Confirm Check In
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Confirmation Modal */}
      {checkoutConfirm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setCheckoutConfirm(null)}>
          <div className="modal" style={{maxWidth:400}}>
            <div className="modal-header">
              <span className="modal-title">
                <i className="fa-solid fa-sign-out-alt" style={{marginRight:8, color:'#F59E0B'}} />
                Check Out - Room {checkoutConfirm.number}
              </span>
              <button className="modal-close" onClick={() => setCheckoutConfirm(null)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="modal-body">
              <div style={{textAlign:'center', marginBottom:16}}>
                <i className="fa-solid fa-hotel" style={{fontSize:48, color:'#D97706', marginBottom:12}} />
                <h3>{checkoutConfirm.guest_name || 'Guest'}</h3>
                {checkoutConfirm.check_in && (
                  <p style={{fontSize:12, color:'#78716C', marginTop:8}}>
                    Stay: {checkoutConfirm.check_in.slice(0,10)} → {checkoutConfirm.check_out?.slice(0,10) || '—'}
                  </p>
                )}
                <div style={{background:'#FFFBEB', padding:12, borderRadius:8, marginTop:12}}>
                  <div style={{fontSize:12, color:'#78716C'}}>Room Rate</div>
                  <div style={{fontSize:20, fontWeight:800, color:'#D97706'}}>
                    KES {Number(checkoutConfirm.rate_per_night || 0).toLocaleString()}/night
                  </div>
                </div>
              </div>
              <p style={{fontSize:13, color:'#78716C', textAlign:'center'}}>
                A bill will be generated with room charges. Extra charges (mini bar, laundry, etc.) can be added from the Room Bills page.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setCheckoutConfirm(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => handleCheckOut(checkoutConfirm)}>
                <i className="fa-solid fa-file-invoice" /> Generate Bill & Check Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function fmt(n) {
  return `KES ${Number(n || 0).toLocaleString()}`;
}