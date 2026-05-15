import React, { useState, useEffect, useCallback } from 'react';
import api from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';

const fmt     = n => `KES ${Number(n||0).toLocaleString('en-KE', {minimumFractionDigits:0})}`;
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-KE',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const TIER_CFG = {
  bronze:   { color:'#CD7F32', bg:'#FDF5EC', icon:'🥉', label:'Bronze' },
  silver:   { color:'#9CA3AF', bg:'#F9FAFB', icon:'🥈', label:'Silver' },
  gold:     { color:'#D97706', bg:'#FFFBEB', icon:'🥇', label:'Gold'   },
  platinum: { color:'#8B5CF6', bg:'#F5F3FF', icon:'💎', label:'Platinum'},
};

const BLANK = { name:'', phone:'', email:'', birthday:'', notes:'' };

export default function CustomersPage() {
  const { user } = useAuth();
  const isManager = ['admin','management','cashier'].includes(user?.role);

  const [customers, setCustomers]     = useState([]);
  const [summary, setSummary]         = useState({});
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [filterTier, setFilterTier]   = useState('');
  const [modal, setModal]             = useState(null); // 'new'|'view'|'edit'|'adjust'
  const [selected, setSelected]       = useState(null);
  const [detail, setDetail]           = useState(null);
  const [form, setForm]               = useState(BLANK);
  const [adjustForm, setAdjustForm]   = useState({ points:'', description:'' });
  const [saving, setSaving]           = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/customers', {
        params: { search: search || undefined, tier: filterTier || undefined },
      });
      setCustomers(data.customers || []);
      setSummary(data.summary || {});
    } catch(e) { console.error(e); }
    setLoading(false);
  }, [search, filterTier]);

  useEffect(() => { load(); }, [load]);

  const openView = async (c) => {
    setSelected(c);
    setModal('view');
    try {
      const { data } = await api.get(`/customers/${c.id}`);
      setDetail(data);
    } catch(e) { console.error(e); }
  };

  const save = async () => {
    if (!form.name) { alert('Name is required'); return; }
    setSaving(true);
    try {
      if (modal === 'new') {
        await api.post('/customers', form);
      } else {
        await api.put(`/customers/${selected.id}`, form);
      }
      setModal(null);
      load();
    } catch(e) { alert(e.response?.data?.error || e.message); }
    setSaving(false);
  };

  const doAdjust = async () => {
    if (!adjustForm.points) return;
    setSaving(true);
    try {
      await api.post(`/customers/${selected.id}/adjust-points`, adjustForm);
      setModal(null);
      load();
      if (detail) openView(selected);
    } catch(e) { alert(e.response?.data?.error || e.message); }
    setSaving(false);
  };

  return (
    <div>
      <div className="page-header">
        <h2><i className="fa-solid fa-users" style={{marginRight:8,color:'#F59E0B'}} />Customers & Loyalty</h2>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-sm btn-primary" onClick={()=>{setForm(BLANK);setModal('new');}}>
            <i className="fa-solid fa-plus" /> Add Customer
          </button>
          <button className="btn btn-sm btn-outline" onClick={load}><i className="fa-solid fa-rotate" /></button>
        </div>
      </div>

      {/* Summary */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10,marginBottom:16}}>
        {[
          {label:'Total Customers', val:summary.total||0,           color:'#1C1917', icon:'fa-users'},
          {label:'Total Points',    val:(summary.total_points||0).toLocaleString(), color:'#D97706', icon:'fa-star'},
          {label:'Total Spend',     val:fmt(summary.total_spend||0), color:'#10B981', icon:'fa-money-bill'},
          {label:'Silver',  val:summary.silver||0,   color:'#9CA3AF', icon:'fa-medal'},
          {label:'Gold',    val:summary.gold||0,     color:'#D97706', icon:'fa-medal'},
          {label:'Platinum',val:summary.platinum||0, color:'#8B5CF6', icon:'fa-gem'},
        ].map(c=>(
          <div key={c.label} className="card" style={{padding:'10px 14px',textAlign:'center'}}>
            <i className={`fa-solid ${c.icon}`} style={{fontSize:20,color:c.color,display:'block',marginBottom:4}}/>
            <div style={{fontFamily:'Montserrat',fontWeight:800,fontSize:18,color:c.color}}>{c.val}</div>
            <div style={{fontSize:11,color:'#78716C'}}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
        <div className="search-bar" style={{flex:1,maxWidth:320}}>
          <i className="fa-solid fa-magnifying-glass"/>
          <input placeholder="Search name, phone, email..." value={search}
            onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&load()}/>
        </div>
        <select className="form-input" style={{width:140}} value={filterTier} onChange={e=>setFilterTier(e.target.value)}>
          <option value="">All Tiers</option>
          <option value="bronze">🥉 Bronze</option>
          <option value="silver">🥈 Silver</option>
          <option value="gold">🥇 Gold</option>
          <option value="platinum">💎 Platinum</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{textAlign:'center',padding:40,color:'#78716C'}}>Loading...</div>
      ) : customers.length === 0 ? (
        <div className="empty-state"><i className="fa-solid fa-users-slash"/><p>No customers found</p></div>
      ) : (
        <div className="card" style={{overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:'#FAFAF9',borderBottom:'2px solid #E7E5E4'}}>
                {['Customer','Phone','Tier','Points','Total Spend','Visits','Last Visit',''].map(h=>(
                  <th key={h} style={{padding:'9px 12px',textAlign:'left',fontSize:11,fontWeight:700,color:'#78716C',textTransform:'uppercase'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map(c=>{
                const tier = TIER_CFG[c.tier] || TIER_CFG.bronze;
                return (
                  <tr key={c.id} style={{borderBottom:'1px solid #F5F5F4',cursor:'pointer'}}
                    onMouseEnter={e=>e.currentTarget.style.background='#FAFAF9'}
                    onMouseLeave={e=>e.currentTarget.style.background='white'}
                    onClick={()=>openView(c)}
                  >
                    <td style={{padding:'9px 12px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <div style={{width:36,height:36,borderRadius:'50%',background:tier.bg,border:`2px solid ${tier.color}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>{tier.icon}</div>
                        <div>
                          <div style={{fontWeight:700,fontSize:13}}>{c.name}</div>
                          <div style={{fontSize:11,color:'#78716C'}}>{c.email||'—'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{padding:'9px 12px',fontSize:12}}>{c.phone||'—'}</td>
                    <td style={{padding:'9px 12px'}}>
                      <span style={{background:tier.bg,color:tier.color,border:`1px solid ${tier.color}40`,borderRadius:10,padding:'2px 10px',fontSize:11,fontWeight:700}}>{tier.label}</span>
                    </td>
                    <td style={{padding:'9px 12px',fontFamily:'Montserrat',fontWeight:700,color:'#D97706'}}>{(c.loyalty_points||0).toLocaleString()}</td>
                    <td style={{padding:'9px 12px',fontSize:12,fontWeight:600}}>{fmt(c.total_spend)}</td>
                    <td style={{padding:'9px 12px',textAlign:'center',fontSize:12}}>{c.visit_count||0}</td>
                    <td style={{padding:'9px 12px',fontSize:11,color:'#78716C'}}>{fmtDate(c.last_visit)}</td>
                    <td style={{padding:'9px 12px'}}>
                      <button className="btn btn-sm btn-outline" style={{padding:'3px 8px'}} onClick={e=>{e.stopPropagation();setSelected(c);setAdjustForm({points:'',description:''});setModal('adjust');}}>
                        <i className="fa-solid fa-star"/> Adjust
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* New / Edit Modal */}
      {(modal==='new'||modal==='edit') && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal" style={{maxWidth:480}}>
            <div className="modal-header">
              <span className="modal-title"><i className="fa-solid fa-user-plus" style={{marginRight:8,color:'#F59E0B'}}/>{modal==='new'?'New Customer':'Edit Customer'}</span>
              <button className="modal-close" onClick={()=>setModal(null)}><i className="fa-solid fa-xmark"/></button>
            </div>
            <div className="modal-body">
              {[['name','Full Name *','text'],['phone','Phone Number','tel'],['email','Email','email'],['birthday','Birthday','date']].map(([k,label,type])=>(
                <div key={k} className="form-group">
                  <label className="form-label">{label}</label>
                  <input type={type} className="form-input" value={form[k]||''} onChange={e=>setForm({...form,[k]:e.target.value})} />
                </div>
              ))}
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" rows={2} value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})}/>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={()=>setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Saving...':modal==='new'?'Add Customer':'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {modal==='view' && selected && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal" style={{maxWidth:580}}>
            <div className="modal-header">
              <span className="modal-title"><i className="fa-solid fa-user" style={{marginRight:8,color:'#F59E0B'}}/>{selected.name}</span>
              <button className="modal-close" onClick={()=>setModal(null)}><i className="fa-solid fa-xmark"/></button>
            </div>
            <div className="modal-body">
              {detail ? (
                <>
                  {/* Loyalty card */}
                  {(() => { const tier=TIER_CFG[detail.tier]||TIER_CFG.bronze; return (
                    <div style={{background:`linear-gradient(135deg, #1C1917, #292524)`,borderRadius:14,padding:'16px 20px',color:'white',marginBottom:16,position:'relative',overflow:'hidden'}}>
                      <div style={{position:'absolute',top:-20,right:-20,width:100,height:100,borderRadius:'50%',background:`${tier.color}20`}}/>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                        <div>
                          <div style={{fontSize:11,color:'#A8A29E',marginBottom:4}}>LOYALTY POINTS</div>
                          <div style={{fontFamily:'Montserrat',fontWeight:900,fontSize:36,color:'#F59E0B',lineHeight:1}}>{(detail.loyalty_points||0).toLocaleString()}</div>
                          <div style={{fontSize:12,color:'#78716C',marginTop:4}}>≈ {fmt((detail.loyalty_points||0))} redeemable</div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontSize:28}}>{tier.icon}</div>
                          <div style={{fontSize:12,color:tier.color,fontWeight:700}}>{tier.label}</div>
                        </div>
                      </div>
                      <div style={{marginTop:12,display:'flex',gap:24,fontSize:12,color:'#D1D5DB'}}>
                        <span>Visits: <strong style={{color:'white'}}>{detail.visit_count||0}</strong></span>
                        <span>Spend: <strong style={{color:'white'}}>{fmt(detail.total_spend)}</strong></span>
                        <span>Last: <strong style={{color:'white'}}>{fmtDate(detail.last_visit)}</strong></span>
                      </div>
                    </div>
                  )})()}
                  {/* Info */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
                    {[['Phone',detail.phone||'—'],['Email',detail.email||'—'],['Birthday',fmtDate(detail.birthday)],['Member since',fmtDate(detail.created_at)]].map(([k,v])=>(
                      <div key={k} style={{background:'#FAFAF9',borderRadius:6,padding:'8px 12px'}}>
                        <div style={{fontSize:10,color:'#78716C',fontWeight:700,textTransform:'uppercase',marginBottom:2}}>{k}</div>
                        <div style={{fontSize:13,fontWeight:600}}>{v}</div>
                      </div>
                    ))}
                  </div>
                  {/* Recent bills */}
                  {detail.recentBills?.length > 0 && (
                    <div style={{marginBottom:14}}>
                      <div style={{fontWeight:700,fontSize:13,marginBottom:8}}>Recent Bills</div>
                      <div style={{maxHeight:150,overflowY:'auto'}}>
                        {detail.recentBills.map(b=>(
                          <div key={b.id} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid #F5F5F4',fontSize:12}}>
                            <span style={{color:'#78716C'}}>{fmtDate(b.paid_at)}</span>
                            <span style={{fontWeight:700}}>{fmt(b.total)}</span>
                            <span style={{color:'#78716C'}}>{b.payment_method}</span>
                            {b.loyalty_points_earned > 0 && <span style={{color:'#D97706'}}>+{b.loyalty_points_earned}pts</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Transaction history */}
                  {detail.transactions?.length > 0 && (
                    <div>
                      <div style={{fontWeight:700,fontSize:13,marginBottom:8}}>Points History</div>
                      <div style={{maxHeight:140,overflowY:'auto'}}>
                        {detail.transactions.map(t=>(
                          <div key={t.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:'1px solid #F5F5F4',fontSize:12}}>
                            <span style={{color:'#78716C',fontSize:11}}>{fmtDate(t.created_at)}</span>
                            <span style={{flex:1,marginLeft:10,color:'#44403C'}}>{t.description}</span>
                            <span style={{fontWeight:700,color:t.points>0?'#D97706':'#EF4444',minWidth:60,textAlign:'right'}}>{t.points>0?'+':''}{t.points} pts</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : <div style={{textAlign:'center',padding:32,color:'#78716C'}}>Loading...</div>}
            </div>
            <div className="modal-footer">
              {isManager && (
                <>
                  <button className="btn btn-outline btn-sm" onClick={()=>{setForm({name:selected.name,phone:selected.phone||'',email:selected.email||'',birthday:selected.birthday||'',notes:selected.notes||''});setModal('edit');}}>
                    <i className="fa-solid fa-pen"/> Edit
                  </button>
                  <button className="btn btn-sm" style={{background:'#FFFBEB',color:'#D97706',border:'1px solid #FCD34D'}} onClick={()=>{setAdjustForm({points:'',description:''});setModal('adjust');}}>
                    <i className="fa-solid fa-star"/> Adjust Points
                  </button>
                </>
              )}
              <button className="btn btn-outline" onClick={()=>setModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Points Modal */}
      {modal==='adjust' && selected && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal" style={{maxWidth:380}}>
            <div className="modal-header">
              <span className="modal-title"><i className="fa-solid fa-star" style={{marginRight:8,color:'#D97706'}}/>Adjust Points — {selected.name}</span>
              <button className="modal-close" onClick={()=>setModal(null)}><i className="fa-solid fa-xmark"/></button>
            </div>
            <div className="modal-body">
              <div style={{background:'#FFFBEB',borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:13}}>
                Current balance: <strong style={{color:'#D97706'}}>{(selected.loyalty_points||0).toLocaleString()} points</strong>
              </div>
              <div className="form-group">
                <label className="form-label">Points Adjustment (use negative to deduct)</label>
                <input type="number" className="form-input" value={adjustForm.points}
                  onChange={e=>setAdjustForm({...adjustForm,points:e.target.value})}
                  placeholder="e.g. 100 or -50"/>
              </div>
              <div className="form-group">
                <label className="form-label">Reason</label>
                <input className="form-input" value={adjustForm.description}
                  onChange={e=>setAdjustForm({...adjustForm,description:e.target.value})}
                  placeholder="e.g. Birthday bonus, correction..."/>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={()=>setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={doAdjust} disabled={saving||!adjustForm.points}>
                {saving?'...':'Apply Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
