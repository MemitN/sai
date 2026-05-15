import React, { useState, useEffect, useCallback } from 'react';
import api from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';

const fmt = n => `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 0 })}`;
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const statusColor = s => ({ confirmed:'#3B82F6', checked_in:'#10B981', checked_out:'#78716C', cancelled:'#EF4444', no_show:'#F97316' }[s] || '#78716C');
const statusBg    = s => ({ confirmed:'#EFF6FF', checked_in:'#F0FDF4', checked_out:'#F5F5F4', cancelled:'#FEF2F2', no_show:'#FFF7ED' }[s] || '#F5F5F4');
const sourceIcon  = s => ({ walk_in:'🚶', phone:'📞', online:'🌐', agent:'🤝', repeat:'⭐' }[s] || '🚶');

const BLANK = {
  room_id:'', guest_name:'', guest_phone:'', guest_email:'', guest_id_number:'',
  check_in_date:'', check_out_date:'', adults:1, children:0,
  deposit_required:0, deposit_paid:0, special_requests:'', source:'walk_in', notes:'',
};

export default function ReservationsPage() {
  const { user } = useAuth();
  const isManager = ['admin','management','cashier'].includes(user?.role);

  const [reservations, setReservations]       = useState([]);
  const [summary, setSummary]                 = useState({});
  const [todayArrivals, setTodayArrivals]     = useState([]);
  const [rooms, setRooms]                     = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [modal, setModal]                     = useState(null); // 'new'|'edit'|'view'|'checkin'|'availability'
  const [selected, setSelected]               = useState(null);
  const [form, setForm]                       = useState(BLANK);
  const [saving, setSaving]                   = useState(false);
  const [filterStatus, setFilterStatus]       = useState('all');
  const [filterFrom, setFilterFrom]           = useState('');
  const [filterTo, setFilterTo]               = useState('');
  const [search, setSearch]                   = useState('');
  const [availRooms, setAvailRooms]           = useState([]);
  const [availSearch, setAvailSearch]         = useState({ check_in:'', check_out:'', type:'' });
  const [checkingAvail, setCheckingAvail]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus !== 'all') params.status = filterStatus;
      if (filterFrom) params.from = filterFrom;
      if (filterTo)   params.to   = filterTo;
      const [rvRes, roomsRes] = await Promise.all([
        api.get('/reservations', { params }),
        api.get('/rooms'),
      ]);
      setReservations(rvRes.data.reservations || []);
      setSummary(rvRes.data.summary || {});
      setTodayArrivals(rvRes.data.todayArrivals || []);
      setRooms((roomsRes.data || []).filter(r => r.status !== 'deleted'));
    } catch(e) { console.error(e); }
    setLoading(false);
  }, [filterStatus, filterFrom, filterTo]);

  useEffect(() => { load(); }, [load]);

  const nights = (a, b) => {
    if (!a || !b) return 0;
    return Math.max(1, Math.ceil((new Date(b) - new Date(a)) / 86400000));
  };

  const selectedRoom = rooms.find(r => String(r.id) === String(form.room_id));
  const nightsCount  = nights(form.check_in_date, form.check_out_date);
  const estimatedTotal = (selectedRoom?.rate_per_night || 0) * nightsCount;

  const openNew = () => { setForm(BLANK); setModal('new'); };
  const openEdit = rv => { setForm({ ...rv }); setSelected(rv); setModal('edit'); };
  const openView = rv => { setSelected(rv); setModal('view'); };

  const save = async () => {
    if (!form.room_id || !form.guest_name || !form.check_in_date || !form.check_out_date) {
      alert('Room, guest name, check-in and check-out dates are required.'); return;
    }
    setSaving(true);
    try {
      if (modal === 'new') {
        await api.post('/reservations', form);
      } else {
        await api.put(`/reservations/${selected.id}`, form);
      }
      setModal(null);
      load();
    } catch(e) { alert('Error: ' + (e.response?.data?.error || e.message)); }
    setSaving(false);
  };

  const cancel = async (rv) => {
    const reason = prompt(`Cancellation reason for ${rv.guest_name}'s reservation:`);
    if (reason === null) return;
    try {
      await api.put(`/reservations/${rv.id}`, { ...rv, status: 'cancelled', cancellation_reason: reason });
      load();
    } catch(e) { alert('Error: ' + (e.response?.data?.error || e.message)); }
  };

  const checkIn = async (rv) => {
    if (!window.confirm(`Check in ${rv.guest_name} to Room ${rv.room_number}?`)) return;
    try {
      await api.post(`/reservations/${rv.id}/checkin`);
      load();
    } catch(e) { alert('Error: ' + (e.response?.data?.error || e.message)); }
  };

  const checkAvailability = async () => {
    if (!availSearch.check_in || !availSearch.check_out) { alert('Enter check-in and check-out dates'); return; }
    setCheckingAvail(true);
    try {
      const { data } = await api.get('/reservations/availability', { params: availSearch });
      setAvailRooms(data.rooms || []);
    } catch(e) { alert(e.response?.data?.error || e.message); }
    setCheckingAvail(false);
  };

  const filtered = reservations.filter(rv => {
    if (search) {
      const s = search.toLowerCase();
      return rv.guest_name?.toLowerCase().includes(s) ||
             rv.guest_phone?.includes(s) ||
             rv.room_number?.toString().includes(s);
    }
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <h2><i className="fa-solid fa-calendar-check" style={{marginRight:8,color:'#F59E0B'}} />Room Reservations</h2>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button className="btn btn-sm btn-outline" onClick={() => setModal('availability')}>
            <i className="fa-solid fa-search" /> Check Availability
          </button>
          <button className="btn btn-sm btn-primary" onClick={openNew}>
            <i className="fa-solid fa-plus" /> New Reservation
          </button>
          <button className="btn btn-sm btn-outline" onClick={load}><i className="fa-solid fa-rotate" /></button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginBottom:16}}>
        {[
          { label:'Confirmed',   val: summary.confirmed||0,     color:'#3B82F6', icon:'fa-clock' },
          { label:'Checked In',  val: summary.checked_in||0,    color:'#10B981', icon:'fa-door-open' },
          { label:'Arriving Today', val: summary.arriving_today||0, color:'#F59E0B', icon:'fa-plane-arrival' },
          { label:'Departing Today',val: summary.departing_today||0,color:'#8B5CF6',icon:'fa-plane-departure' },
          { label:'No Show',     val: summary.no_show||0,       color:'#EF4444', icon:'fa-user-xmark' },
        ].map(c => (
          <div key={c.label} className="card" style={{padding:'12px 16px',textAlign:'center'}}>
            <i className={`fa-solid ${c.icon}`} style={{fontSize:22,color:c.color,display:'block',marginBottom:6}} />
            <div style={{fontFamily:'Montserrat',fontWeight:800,fontSize:20,color:c.color}}>{c.val}</div>
            <div style={{fontSize:11,color:'#78716C'}}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Today's arrivals banner */}
      {todayArrivals.length > 0 && (
        <div style={{background:'#FFFBEB',border:'1px solid #FCD34D',borderRadius:10,padding:'10px 16px',marginBottom:14,display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
          <i className="fa-solid fa-plane-arrival" style={{color:'#D97706',fontSize:18}} />
          <strong style={{color:'#92400E'}}>Arrivals today:</strong>
          {todayArrivals.map(rv => (
            <span key={rv.id} style={{background:'#FEF3C7',border:'1px solid #FCD34D',borderRadius:6,padding:'2px 10px',fontSize:12,color:'#92400E'}}>
              {rv.guest_name} → Room {rv.room_number}
              <button style={{marginLeft:8,background:'#D97706',color:'white',border:'none',borderRadius:4,padding:'1px 6px',fontSize:11,cursor:'pointer'}}
                onClick={() => checkIn(rv)}>Check In</button>
            </span>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
        <div className="search-bar" style={{flex:1,maxWidth:280}}>
          <i className="fa-solid fa-magnifying-glass" />
          <input placeholder="Search guest or room..." value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        <select className="form-input" style={{width:140}} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="all">All Status</option>
          <option value="confirmed">Confirmed</option>
          <option value="checked_in">Checked In</option>
          <option value="checked_out">Checked Out</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No Show</option>
        </select>
        <input type="date" className="form-input" style={{width:140}} value={filterFrom} onChange={e=>setFilterFrom(e.target.value)} placeholder="From" />
        <input type="date" className="form-input" style={{width:140}} value={filterTo} onChange={e=>setFilterTo(e.target.value)} placeholder="To" />
      </div>

      {/* Table */}
      {loading ? (
        <div style={{textAlign:'center',padding:40,color:'#78716C'}}>Loading reservations...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><i className="fa-solid fa-calendar-xmark" /><p>No reservations found</p></div>
      ) : (
        <div className="card" style={{overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:'#FAFAF9',borderBottom:'2px solid #E7E5E4'}}>
                {['Guest','Room','Check-in','Check-out','Nights','Total','Deposit','Source','Status','Actions'].map(h => (
                  <th key={h} style={{padding:'10px 12px',textAlign:'left',fontSize:11,fontWeight:700,color:'#78716C',textTransform:'uppercase'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(rv => (
                <tr key={rv.id} style={{borderBottom:'1px solid #F5F5F4',cursor:'pointer'}}
                  onMouseEnter={e=>e.currentTarget.style.background='#FAFAF9'}
                  onMouseLeave={e=>e.currentTarget.style.background='white'}
                >
                  <td style={{padding:'10px 12px'}}>
                    <div style={{fontWeight:700,fontSize:13}}>{rv.guest_name}</div>
                    <div style={{fontSize:11,color:'#78716C'}}>{rv.guest_phone || '—'}</div>
                  </td>
                  <td style={{padding:'10px 12px'}}>
                    <div style={{fontWeight:700}}>{rv.room_number}</div>
                    <div style={{fontSize:11,color:'#78716C'}}>{rv.room_name}</div>
                  </td>
                  <td style={{padding:'10px 12px',fontSize:12,whiteSpace:'nowrap'}}>{fmtDate(rv.check_in_date)}</td>
                  <td style={{padding:'10px 12px',fontSize:12,whiteSpace:'nowrap'}}>{fmtDate(rv.check_out_date)}</td>
                  <td style={{padding:'10px 12px',textAlign:'center',fontWeight:700}}>{rv.nights}</td>
                  <td style={{padding:'10px 12px',fontSize:12,fontWeight:700,color:'#D97706'}}>{fmt(rv.estimated_total)}</td>
                  <td style={{padding:'10px 12px',fontSize:12}}>
                    <div style={{color:'#10B981'}}>{fmt(rv.deposit_paid)}</div>
                    {rv.deposit_required > rv.deposit_paid && (
                      <div style={{fontSize:10,color:'#EF4444'}}>Due: {fmt(rv.deposit_required - rv.deposit_paid)}</div>
                    )}
                  </td>
                  <td style={{padding:'10px 12px',fontSize:18}} title={rv.source}>{sourceIcon(rv.source)}</td>
                  <td style={{padding:'10px 12px'}}>
                    <span style={{background:statusBg(rv.status),color:statusColor(rv.status),border:`1px solid ${statusColor(rv.status)}40`,borderRadius:12,padding:'2px 10px',fontSize:11,fontWeight:700,whiteSpace:'nowrap'}}>
                      {rv.status.replace('_',' ')}
                    </span>
                  </td>
                  <td style={{padding:'10px 12px'}}>
                    <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                      <button className="btn btn-sm btn-outline" style={{padding:'3px 8px',fontSize:11}} onClick={()=>openView(rv)} title="View"><i className="fa-solid fa-eye" /></button>
                      {isManager && rv.status === 'confirmed' && (
                        <>
                          <button className="btn btn-sm btn-success" style={{padding:'3px 8px',fontSize:11}} onClick={()=>checkIn(rv)} title="Check In"><i className="fa-solid fa-door-open" /></button>
                          <button className="btn btn-sm btn-outline" style={{padding:'3px 8px',fontSize:11}} onClick={()=>openEdit(rv)} title="Edit"><i className="fa-solid fa-pen" /></button>
                          <button className="btn btn-sm btn-danger" style={{padding:'3px 8px',fontSize:11}} onClick={()=>cancel(rv)} title="Cancel"><i className="fa-solid fa-xmark" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Availability Modal */}
      {modal === 'availability' && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal" style={{maxWidth:700}}>
            <div className="modal-header">
              <span className="modal-title"><i className="fa-solid fa-search" style={{marginRight:8,color:'#F59E0B'}} />Check Room Availability</span>
              <button className="modal-close" onClick={()=>setModal(null)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="modal-body">
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr auto',gap:10,marginBottom:16,alignItems:'end'}}>
                <div><label className="form-label">Check-in Date</label><input type="date" className="form-input" value={availSearch.check_in} onChange={e=>setAvailSearch({...availSearch,check_in:e.target.value})} /></div>
                <div><label className="form-label">Check-out Date</label><input type="date" className="form-input" value={availSearch.check_out} onChange={e=>setAvailSearch({...availSearch,check_out:e.target.value})} /></div>
                <div><label className="form-label">Room Type</label>
                  <select className="form-input" value={availSearch.type} onChange={e=>setAvailSearch({...availSearch,type:e.target.value})}>
                    <option value="">All Types</option>
                    <option value="standard">Standard</option>
                    <option value="deluxe">Deluxe</option>
                    <option value="suite">Suite</option>
                  </select>
                </div>
                <button className="btn btn-primary" onClick={checkAvailability} disabled={checkingAvail}>
                  {checkingAvail ? '...' : 'Search'}
                </button>
              </div>
              {availRooms.length > 0 && (
                <div>
                  <div style={{fontWeight:700,marginBottom:10,color:'#1C1917'}}>
                    {nights(availSearch.check_in, availSearch.check_out)} night(s) · {availRooms.filter(r=>r.available).length} rooms available
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:10}}>
                    {availRooms.map(r => (
                      <div key={r.id} style={{border:`2px solid ${r.available?'#10B981':'#E7E5E4'}`,borderRadius:10,padding:12,background:r.available?'#F0FDF4':'#FAFAF9',opacity:r.available?1:0.6}}>
                        <div style={{fontWeight:800,fontSize:16,color:'#1C1917'}}>Room {r.number}</div>
                        <div style={{fontSize:12,color:'#78716C',marginBottom:6}}>{r.name} · {r.type}</div>
                        <div style={{fontFamily:'Montserrat',fontWeight:700,color:'#D97706',marginBottom:8}}>{fmt(r.estimated_total)}</div>
                        <div style={{fontSize:11,color:'#78716C',marginBottom:8}}>KES {r.rate_per_night?.toLocaleString()}/night</div>
                        {r.available ? (
                          <button className="btn btn-sm btn-success btn-full" onClick={()=>{
                            setForm({...BLANK, room_id: String(r.id), check_in_date: availSearch.check_in, check_out_date: availSearch.check_out});
                            setModal('new');
                          }}>
                            <i className="fa-solid fa-plus" /> Reserve
                          </button>
                        ) : (
                          <div style={{fontSize:11,color:'#EF4444',fontWeight:700,textAlign:'center'}}>
                            <i className="fa-solid fa-ban" style={{marginRight:4}} />Not Available
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New / Edit Modal */}
      {(modal === 'new' || modal === 'edit') && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal" style={{maxWidth:640}}>
            <div className="modal-header">
              <span className="modal-title">
                <i className="fa-solid fa-calendar-plus" style={{marginRight:8,color:'#F59E0B'}} />
                {modal === 'new' ? 'New Reservation' : 'Edit Reservation'}
              </span>
              <button className="modal-close" onClick={()=>setModal(null)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="modal-body">
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div className="form-group" style={{gridColumn:'1/-1'}}>
                  <label className="form-label">Room *</label>
                  <select className="form-input" value={form.room_id} onChange={e=>setForm({...form,room_id:e.target.value})}>
                    <option value="">Select room...</option>
                    {rooms.filter(r=>r.status==='available'||r.id===form.room_id).map(r => (
                      <option key={r.id} value={r.id}>{r.number} — {r.name} ({r.type}) · KES {r.rate_per_night?.toLocaleString()}/night</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{gridColumn:'1/-1'}}>
                  <label className="form-label">Guest Name *</label>
                  <input className="form-input" value={form.guest_name} onChange={e=>setForm({...form,guest_name:e.target.value})} placeholder="Full name" />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" value={form.guest_phone||''} onChange={e=>setForm({...form,guest_phone:e.target.value})} placeholder="07XX XXX XXX" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-input" value={form.guest_email||''} onChange={e=>setForm({...form,guest_email:e.target.value})} placeholder="email@example.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">ID / Passport #</label>
                  <input className="form-input" value={form.guest_id_number||''} onChange={e=>setForm({...form,guest_id_number:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Source</label>
                  <select className="form-input" value={form.source} onChange={e=>setForm({...form,source:e.target.value})}>
                    <option value="walk_in">🚶 Walk-in</option>
                    <option value="phone">📞 Phone</option>
                    <option value="online">🌐 Online</option>
                    <option value="agent">🤝 Agent</option>
                    <option value="repeat">⭐ Repeat Guest</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Check-in Date *</label>
                  <input type="date" className="form-input" value={form.check_in_date} onChange={e=>setForm({...form,check_in_date:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Check-out Date *</label>
                  <input type="date" className="form-input" value={form.check_out_date} onChange={e=>setForm({...form,check_out_date:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Adults</label>
                  <input type="number" className="form-input" min={1} value={form.adults} onChange={e=>setForm({...form,adults:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Children</label>
                  <input type="number" className="form-input" min={0} value={form.children} onChange={e=>setForm({...form,children:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Deposit Required (KES)</label>
                  <input type="number" className="form-input" value={form.deposit_required} onChange={e=>setForm({...form,deposit_required:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Deposit Paid (KES)</label>
                  <input type="number" className="form-input" value={form.deposit_paid} onChange={e=>setForm({...form,deposit_paid:e.target.value})} />
                </div>
                <div className="form-group" style={{gridColumn:'1/-1'}}>
                  <label className="form-label">Special Requests</label>
                  <textarea className="form-textarea" rows={2} value={form.special_requests||''} onChange={e=>setForm({...form,special_requests:e.target.value})} placeholder="Early check-in, extra pillows, dietary requirements..." />
                </div>
                <div className="form-group" style={{gridColumn:'1/-1'}}>
                  <label className="form-label">Internal Notes</label>
                  <textarea className="form-textarea" rows={2} value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})} />
                </div>
              </div>
              {nightsCount > 0 && selectedRoom && (
                <div style={{background:'#FFFBEB',border:'1px solid #FCD34D',borderRadius:10,padding:'12px 16px',marginTop:8}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:13}}>
                    <span>{nightsCount} night(s) × KES {selectedRoom.rate_per_night?.toLocaleString()}/night</span>
                    <strong style={{color:'#D97706',fontFamily:'Montserrat',fontSize:16}}>{fmt(estimatedTotal)}</strong>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={()=>setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving...' : modal==='new' ? 'Create Reservation' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {modal === 'view' && selected && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal" style={{maxWidth:520}}>
            <div className="modal-header">
              <span className="modal-title"><i className="fa-solid fa-calendar-check" style={{marginRight:8,color:'#F59E0B'}} />Reservation Details</span>
              <button className="modal-close" onClick={()=>setModal(null)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="modal-body">
              <div style={{background:statusBg(selected.status),border:`1px solid ${statusColor(selected.status)}40`,borderRadius:8,padding:'8px 14px',marginBottom:14,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontWeight:700,color:statusColor(selected.status)}}>{selected.status.replace('_',' ').toUpperCase()}</span>
                <span style={{fontSize:18}}>{sourceIcon(selected.source)}</span>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {[
                  ['Guest', selected.guest_name],
                  ['Room', `${selected.room_number} — ${selected.room_name}`],
                  ['Phone', selected.guest_phone || '—'],
                  ['Email', selected.guest_email || '—'],
                  ['ID #', selected.guest_id_number || '—'],
                  ['Check-in', fmtDate(selected.check_in_date)],
                  ['Check-out', fmtDate(selected.check_out_date)],
                  ['Nights', selected.nights],
                  ['Adults/Children', `${selected.adults} adults, ${selected.children} children`],
                  ['Estimated Total', fmt(selected.estimated_total)],
                  ['Deposit Required', fmt(selected.deposit_required)],
                  ['Deposit Paid', fmt(selected.deposit_paid)],
                ].map(([k, v]) => (
                  <div key={k} style={{padding:'8px 12px',background:'#FAFAF9',borderRadius:6}}>
                    <div style={{fontSize:10,color:'#78716C',fontWeight:700,textTransform:'uppercase',marginBottom:2}}>{k}</div>
                    <div style={{fontSize:13,fontWeight:600}}>{v}</div>
                  </div>
                ))}
                {selected.special_requests && (
                  <div style={{gridColumn:'1/-1',padding:'8px 12px',background:'#FFFBEB',borderRadius:6}}>
                    <div style={{fontSize:10,color:'#D97706',fontWeight:700,marginBottom:2}}>SPECIAL REQUESTS</div>
                    <div style={{fontSize:13}}>{selected.special_requests}</div>
                  </div>
                )}
                {selected.cancellation_reason && (
                  <div style={{gridColumn:'1/-1',padding:'8px 12px',background:'#FEF2F2',borderRadius:6}}>
                    <div style={{fontSize:10,color:'#EF4444',fontWeight:700,marginBottom:2}}>CANCELLATION REASON</div>
                    <div style={{fontSize:13}}>{selected.cancellation_reason}</div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              {isManager && selected.status === 'confirmed' && (
                <>
                  <button className="btn btn-success" onClick={()=>checkIn(selected)}>
                    <i className="fa-solid fa-door-open" /> Check In Now
                  </button>
                  <button className="btn btn-outline" onClick={()=>openEdit(selected)}>
                    <i className="fa-solid fa-pen" /> Edit
                  </button>
                </>
              )}
              <button className="btn btn-outline" onClick={()=>setModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
