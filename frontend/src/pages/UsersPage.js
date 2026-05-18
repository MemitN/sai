import React, { useState, useEffect, useCallback } from 'react';
import api from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';

const ROLES = ['admin','management','cashier','bar_attendant','waiter','kitchen'];
const ROLE_LABELS = { admin:'Admin', management:'Management', cashier:'Cashier', bar_attendant:'Bar Attendant', waiter:'Waiter', kitchen:'Kitchen' };
const ROLE_BADGE = { admin:'badge-red', management:'badge-purple', cashier:'badge-green', bar_attendant:'badge-orange', waiter:'badge-blue', kitchen:'badge-amber' };

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const isAdmin = ['admin','management'].includes(currentUser?.role);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // 'add' | 'edit'
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ name:'', code:'', role:'waiter', email:'', phone:'', commission_rate:3, active:1 });
  const [saving, setSaving] = useState(false);
  const [resetModal, setResetModal] = useState(null);
  const [resetPin, setResetPin] = useState('');
  const [resetSaving, setResetSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/users');
      setUsers(data);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setForm({ name:'', code:'', role:'waiter', email:'', phone:'', commission_rate:3, active:1 });
    setSelected(null);
    setModal('add');
  };

  const openEdit = (u) => {
    setSelected(u);
    setForm({ name:u.name, code:u.code, role:u.role, email:u.email||'', phone:u.phone||'', commission_rate:u.commission_rate||3, active:u.active });
    setModal('edit');
  };

  const save = async () => {
    if (!form.name || !form.code || !form.role) return alert('Name, PIN and role are required');
    setSaving(true);
    try {
      if (modal === 'add') {
        await api.post('/users', form);
      } else {
        await api.put(`/users/${selected.id}`, form);
      }
      setModal(null);
      load();
    } catch(e) { alert('Error: ' + (e.response?.data?.error || e.message)); }
    finally { setSaving(false); }
  };

  const doResetPin = async () => {
    if (!resetPin || resetPin.length < 4) return alert('PIN must be at least 4 digits');
    setResetSaving(true);
    try {
      await api.post('/password/admin-reset', { user_id: resetModal.id, new_password: resetPin });
      alert(`PIN for ${resetModal.name} has been reset successfully!`);
      setResetModal(null);
      setResetPin('');
    } catch(e) {
      alert('Error: ' + (e.response?.data?.error || e.message));
    } finally { setResetSaving(false); }
  };

  const toggleActive = async (u) => {
    try {
      await api.put(`/users/${u.id}`, { ...u, active: u.active ? 0 : 1 });
      load();
    } catch(e) { alert('Error: ' + e.message); }
  };

  const deleteUser = async (u) => {
    if (!window.confirm(`Permanently delete ${u.name}? This action cannot be undone.`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      load();
    } catch(e) { alert('Error: ' + (e.response?.data?.error || e.message)); }
  };

  const filtered = users.filter(u =>
    (filter === 'all' || u.role === filter) &&
    (!search || u.name.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return <div className="loading"><div className="spinner"/></div>;

  return (
    <div>
      <div className="page-header">
        <h2><i className="fa-solid fa-users" style={{marginRight:8,color:'#F59E0B'}} />Staff Management</h2>
        <button className="btn btn-primary" onClick={openAdd}>
          <i className="fa-solid fa-user-plus" /> Add Staff
        </button>
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
        <button className={`cat-tab ${filter==='all'?'active':''}`} onClick={()=>setFilter('all')}>
          All <span style={{background:'#E7E5E4',borderRadius:10,padding:'1px 7px',fontSize:11,fontWeight:700}}>{users.length}</span>
        </button>
        {ROLES.map(r => {
          const count = users.filter(u=>u.role===r).length;
          if (count===0) return null;
          return (
            <button key={r} className={`cat-tab ${filter===r?'active':''}`} onClick={()=>setFilter(r)}>
              {ROLE_LABELS[r]}
              <span style={{background:'#E7E5E4',borderRadius:10,padding:'1px 7px',fontSize:11,fontWeight:700}}>{count}</span>
            </button>
          );
        })}
        <div className="search-bar" style={{marginLeft:'auto'}}>
          <i className="fa-solid fa-magnifying-glass" />
          <input placeholder="Search staff..." value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card">
        <div style={{overflowX:'auto'}}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Staff Member</th>
                <th>Role</th>
                <th>PIN Code</th>
                <th>Contact</th>
                <th>Commission Rate</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} style={{opacity:u.active?1:0.5}}>
                  <td>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:36,height:36,borderRadius:'50%',background:'#FEF3C7',color:'#92400E',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Poppins',fontWeight:700,fontSize:13,flexShrink:0}}>
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <div style={{fontWeight:700,fontSize:13}}>{u.name}</div>
                        <div style={{fontSize:11,color:'#78716C'}}>{u.email||'No email'}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className={`badge ${ROLE_BADGE[u.role]||'badge-gray'}`}>{ROLE_LABELS[u.role]||u.role}</span></td>
                  <td>
                    <span style={{fontFamily:'Montserrat',fontWeight:700,background:'#F5F5F4',padding:'3px 10px',borderRadius:6,fontSize:13,letterSpacing:2}}>
                      {'•'.repeat(u.code?.length||4)}
                    </span>
                  </td>
                  <td style={{fontSize:12,color:'#78716C'}}>{u.phone||'—'}</td>
                  <td style={{fontFamily:'Montserrat',fontWeight:700,color:'#10B981'}}>{u.commission_rate||3}%</td>
                  <td>
                    <span className={`badge ${u.active?'badge-green':'badge-gray'}`}>
                      {u.active?'Active':'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div style={{display:'flex', gap:6}}>
                      <button className="btn btn-sm btn-outline" onClick={()=>openEdit(u)} title="Edit">
                        <i className="fa-solid fa-pen" />
                      </button>
                      <button
                        className={`btn btn-sm ${u.active?'btn-outline':'btn-success'}`}
                        onClick={()=>toggleActive(u)}
                        title={u.active?'Pause':'Activate'}
                      >
                        <i className={`fa-solid ${u.active?'fa-pause':'fa-play'}`} />
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={()=>deleteUser(u)} title="Permanently Delete User">
                        <i className="fa-solid fa-user-xmark" />
                      </button>
                      <button
                        className="btn btn-sm"
                        style={{background:'#FEF3C7',color:'#92400E',border:'1px solid #FCD34D'}}
                        onClick={()=>{setResetModal(u);setResetPin('');}}
                        title="Reset PIN"
                      >
                        <i className="fa-solid fa-key" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">
                <i className={`fa-solid ${modal==='add'?'fa-user-plus':'fa-user-pen'}`} style={{marginRight:8,color:'#F59E0B'}} />
                {modal==='add'?'Add New Staff':'Edit Staff Member'}
              </span>
              <button className="modal-close" onClick={()=>setModal(null)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="form-input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Alice Wanjiku" />
                </div>
                <div className="form-group">
                  <label className="form-label">PIN Code *</label>
                  <input className="form-input" value={form.code} onChange={e=>setForm({...form,code:e.target.value})} placeholder="4-6 digit PIN" maxLength={6} type="number" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Role *</label>
                <select className="form-select" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-input" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="email@example.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="07XX XXX XXX" />
                </div>
              </div>
              {['waiter','bar_attendant'].includes(form.role) && (
                <div className="form-group">
                  <label className="form-label">Commission Rate (%)</label>
                  <input type="number" className="form-input" value={form.commission_rate} onChange={e=>setForm({...form,commission_rate:+e.target.value})} min={0} max={20} step={0.5} />
                  <div style={{fontSize:11,color:'#78716C',marginTop:4}}>Percentage of total sales paid as commission</div>
                </div>
              )}
              {modal==='edit' && (
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={form.active} onChange={e=>setForm({...form,active:+e.target.value})}>
                    <option value={1}>Active</option>
                    <option value={0}>Inactive / Paused</option>
                  </select>
                </div>
              )}
              <div style={{background:'#FEF3C7',border:'1px solid #FCD34D',borderRadius:8,padding:10,fontSize:12,color:'#92400E',marginTop:4}}>
                <i className="fa-solid fa-lock" style={{marginRight:6}} />
                <strong>Security:</strong> Share the PIN code securely with the staff member. They use it to log in.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={()=>setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving?<><span className="spinner" style={{width:14,height:14,borderWidth:2}}/> Saving...</>:<><i className="fa-solid fa-floppy-disk" /> {modal==='add'?'Add Staff':'Save Changes'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset PIN Modal ── */}
      {resetModal && (
        <div className="modal-overlay" onClick={()=>setResetModal(null)}>
          <div className="modal-content" style={{maxWidth:400}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h3><i className="fa-solid fa-key" style={{marginRight:8,color:'#F59E0B'}} />Reset PIN — {resetModal.name}</h3>
              <button className="modal-close" onClick={()=>setResetModal(null)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="modal-body">
              <div style={{background:'#FEF3C7',border:'1px solid #FCD34D',borderRadius:8,padding:12,marginBottom:16,fontSize:13,color:'#92400E'}}>
                <i className="fa-solid fa-triangle-exclamation" style={{marginRight:6}} />
                You are resetting the PIN for <strong>{resetModal.name}</strong> ({resetModal.role}). The old PIN will stop working immediately.
              </div>
              <div className="form-group">
                <label className="form-label">New PIN (4–6 digits)</label>
                <input
                  className="form-input"
                  type="number"
                  value={resetPin}
                  onChange={e=>setResetPin(e.target.value)}
                  placeholder="Enter new 4–6 digit PIN"
                  maxLength={6}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={()=>setResetModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={doResetPin} disabled={resetSaving}>
                {resetSaving
                  ? <><span className="spinner" style={{width:14,height:14,borderWidth:2}}/> Resetting...</>
                  : <><i className="fa-solid fa-key" /> Reset PIN</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

