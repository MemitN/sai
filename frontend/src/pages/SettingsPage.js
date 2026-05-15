import React, { useState, useEffect, useCallback } from 'react';
import api from '../hooks/useApi';

export default function SettingsPage() {
  const [tab, setTab] = useState('business');
  const [email, setEmail] = useState({ smtp_host:'', smtp_port:587, smtp_user:'', smtp_pass:'', from_email:'', from_name:'Sai Lounge POS', report_emails:'', send_eod_report:1 });
  const [mpesa, setMpesa] = useState({ shortcode:'', passkey:'', consumer_key:'', consumer_secret:'', callback_url:'', environment:'sandbox' });
  const [promotions, setPromotions] = useState([]);
  const [happyHour, setHappyHour] = useState({ name:'Evening Happy Hour', start_time:'17:00', end_time:'19:00', discount_percent:15, active:1 });
  const [business, setBusiness] = useState({
    business_name:'Sai Lounge', tagline:'Premium Dining Experience', phone:'', email:'', address:'', currency:'KES',
    tax_enabled:0, tax_rate:16, tax_label:'VAT',
    service_charge_enabled:0, service_charge_rate:10, service_charge_label:'Service Charge',
    loyalty_enabled:1, loyalty_points_per_100:1, loyalty_redeem_rate:1,
    loyalty_silver_threshold:5000, loyalty_gold_threshold:20000, loyalty_platinum_threshold:50000,
    receipt_footer:'Thank you for dining with us!',
  });
  const [backups, setBackups] = useState([]);
  const [backing, setBacking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [promoModal, setPromoModal] = useState(false);
  const [promoForm, setPromoForm] = useState({ name:'', type:'percentage', value:0, active:1, start_time:'', end_time:'', description:'' });

  const load = useCallback(async () => {
    try {
      const [sRes, pRes, bRes, backupRes] = await Promise.all([
        api.get('/settings'),
        api.get('/promotions'),
        api.get('/settings/business'),
        api.get('/backups').catch(()=>({data:[]})),
      ]);
      if (sRes.data.email)   setEmail(e => ({ ...e, ...sRes.data.email }));
      if (sRes.data.mpesa)   setMpesa(m => ({ ...m, ...sRes.data.mpesa }));
      if (pRes.data.promotions) setPromotions(pRes.data.promotions);
      if (pRes.data.happyHour)  setHappyHour(h => ({ ...h, ...pRes.data.happyHour }));
      if (bRes.data && bRes.data.id) setBusiness(b => ({ ...b, ...bRes.data }));
      setBackups(backupRes.data || []);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveEmail = async () => {
    setSaving('email');
    try { await api.put('/settings/email', email); alert('✅ Email settings saved!'); }
    catch(e) { alert('Error: ' + e.response?.data?.error); }
    finally { setSaving(''); }
  };

  const saveMpesa = async () => {
    setSaving('mpesa');
    try { await api.put('/settings/mpesa', mpesa); alert('✅ M-Pesa settings saved!'); }
    catch(e) { alert('Error: ' + e.response?.data?.error); }
    finally { setSaving(''); }
  };

  const togglePromo = async (p) => {
    try {
      await api.put(`/promotions/${p.id}`, { ...p, active: p.active ? 0 : 1 });
      load();
    } catch(e) { alert('Error: ' + e.message); }
  };

  const savePromo = async () => {
    setSaving('promo');
    try {
      await api.post('/promotions', promoForm);
      setPromoModal(false);
      load();
    } catch(e) { alert('Error: ' + e.response?.data?.error); }
    finally { setSaving(''); }
  };

  const saveBusiness = async () => {
    setSaving('business');
    try { await api.put('/settings/business', business); alert('✅ Business settings saved!'); }
    catch(e) { alert('Error: ' + e.response?.data?.error); }
    finally { setSaving(''); }
  };

  const doBackup = async () => {
    setBacking(true);
    try {
      const { data } = await api.post('/backups/trigger');
      alert(`✅ Backup created: ${data.filename}`);
      load();
    } catch(e) { alert('Backup failed: ' + e.response?.data?.error); }
    setBacking(false);
  };

  const TABS = [
    { id: 'business',   label: 'Business',   icon: 'fa-building' },
    { id: 'loyalty',    label: 'Loyalty',     icon: 'fa-star' },
    { id: 'email',      label: 'Email',       icon: 'fa-envelope' },
    { id: 'mpesa',      label: 'M-Pesa',      icon: 'fa-mobile-screen' },
    { id: 'promotions', label: 'Promotions',  icon: 'fa-tags' },
    { id: 'happy_hour', label: 'Happy Hour',  icon: 'fa-moon' },
    { id: 'backups',    label: 'Backups',     icon: 'fa-database' },
  ];

  if (loading) return <div className="loading"><div className="spinner"/></div>;

  return (
    <div>
      <div className="page-header">
        <h2><i className="fa-solid fa-gear" style={{marginRight:8,color:'#F59E0B'}} />Settings</h2>
      </div>

      <div className="settings-tabs">
        {TABS.map(t => (
          <button key={t.id} className={`settings-tab ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}>
            <i className={`fa-solid ${t.icon}`} style={{marginRight:6}} />{t.label}
          </button>
        ))}
      </div>

      {/* Business Settings */}
      {tab === 'business' && (
        <div style={{display:'grid',gap:16}}>
          <div className="card">
            <div className="card-header"><span className="card-title"><i className="fa-solid fa-building" style={{marginRight:8,color:'#F59E0B'}}/>Business Information</span></div>
            <div className="card-body">
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                {[['business_name','Business Name'],['tagline','Tagline'],['phone','Phone'],['email','Email'],['address','Address'],['currency','Currency'],['receipt_footer','Receipt Footer']].map(([k,label])=>(
                  <div key={k} className="form-group" style={k==='address'||k==='receipt_footer'?{gridColumn:'1/-1'}:{}}>
                    <label className="form-label">{label}</label>
                    <input className="form-input" value={business[k]||''} onChange={e=>setBusiness({...business,[k]:e.target.value})}/>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title"><i className="fa-solid fa-percent" style={{marginRight:8,color:'#F59E0B'}}/>Tax & Service Charge</span></div>
            <div className="card-body">
              <div style={{display:'grid',gridTemplateColumns:'auto 1fr 1fr',gap:12,alignItems:'center'}}>
                <label style={{display:'flex',alignItems:'center',gap:8,gridColumn:'1/-1',marginBottom:4}}>
                  <input type="checkbox" checked={!!business.tax_enabled} onChange={e=>setBusiness({...business,tax_enabled:e.target.checked?1:0})}/>
                  <span className="form-label" style={{margin:0}}>Enable Tax</span>
                </label>
                <div className="form-group"><label className="form-label">Tax Label</label><input className="form-input" value={business.tax_label||'VAT'} onChange={e=>setBusiness({...business,tax_label:e.target.value})}/></div>
                <div className="form-group"><label className="form-label">Tax Rate (%)</label><input type="number" className="form-input" value={business.tax_rate||16} onChange={e=>setBusiness({...business,tax_rate:e.target.value})}/></div>
                <label style={{display:'flex',alignItems:'center',gap:8,gridColumn:'1/-1',marginTop:8,marginBottom:4}}>
                  <input type="checkbox" checked={!!business.service_charge_enabled} onChange={e=>setBusiness({...business,service_charge_enabled:e.target.checked?1:0})}/>
                  <span className="form-label" style={{margin:0}}>Enable Service Charge</span>
                </label>
                <div className="form-group"><label className="form-label">Label</label><input className="form-input" value={business.service_charge_label||'Service Charge'} onChange={e=>setBusiness({...business,service_charge_label:e.target.value})}/></div>
                <div className="form-group"><label className="form-label">Rate (%)</label><input type="number" className="form-input" value={business.service_charge_rate||10} onChange={e=>setBusiness({...business,service_charge_rate:e.target.value})}/></div>
              </div>
            </div>
          </div>
          <div style={{textAlign:'right'}}>
            <button className="btn btn-primary" onClick={saveBusiness} disabled={saving==='business'}>
              <i className="fa-solid fa-save"/> {saving==='business'?'Saving...':'Save Business Settings'}
            </button>
          </div>
        </div>
      )}

      {/* Loyalty Settings */}
      {tab === 'loyalty' && (
        <div className="card">
          <div className="card-header"><span className="card-title"><i className="fa-solid fa-star" style={{marginRight:8,color:'#F59E0B'}}/>Customer Loyalty Program</span></div>
          <div className="card-body">
            <label style={{display:'flex',alignItems:'center',gap:10,marginBottom:20,cursor:'pointer'}}>
              <input type="checkbox" checked={!!business.loyalty_enabled} onChange={e=>setBusiness({...business,loyalty_enabled:e.target.checked?1:0})} style={{width:18,height:18}}/>
              <div>
                <div style={{fontWeight:700}}>Enable Loyalty Program</div>
                <div style={{fontSize:12,color:'#78716C'}}>Customers earn points on every purchase and can redeem them for discounts</div>
              </div>
            </label>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,opacity:business.loyalty_enabled?1:0.5,pointerEvents:business.loyalty_enabled?'auto':'none'}}>
              <div className="form-group">
                <label className="form-label">Points earned per KES 100 spent</label>
                <input type="number" className="form-input" value={business.loyalty_points_per_100||1} onChange={e=>setBusiness({...business,loyalty_points_per_100:e.target.value})} min={1}/>
                <div style={{fontSize:11,color:'#78716C',marginTop:4}}>e.g. 1 point per KES 100</div>
              </div>
              <div className="form-group">
                <label className="form-label">KES value per point (redemption)</label>
                <input type="number" className="form-input" value={business.loyalty_redeem_rate||1} onChange={e=>setBusiness({...business,loyalty_redeem_rate:e.target.value})} min={0.1} step={0.1}/>
                <div style={{fontSize:11,color:'#78716C',marginTop:4}}>e.g. 1 point = KES 1</div>
              </div>
              <div style={{gridColumn:'1/-1',borderTop:'1px solid #E7E5E4',paddingTop:16,marginTop:4}}>
                <div style={{fontWeight:700,marginBottom:12}}>Tier Thresholds (by total spend)</div>
              </div>
              {[['Silver 🥈','loyalty_silver_threshold',5000],['Gold 🥇','loyalty_gold_threshold',20000],['Platinum 💎','loyalty_platinum_threshold',50000]].map(([label,key,def])=>(
                <div key={key} className="form-group">
                  <label className="form-label">{label} threshold (KES)</label>
                  <input type="number" className="form-input" value={business[key]||def} onChange={e=>setBusiness({...business,[key]:e.target.value})} step={1000}/>
                </div>
              ))}
            </div>
            {/* Preview */}
            <div style={{background:'#FFFBEB',border:'1px solid #FCD34D',borderRadius:10,padding:14,marginTop:16}}>
              <div style={{fontWeight:700,marginBottom:8,color:'#92400E'}}>Loyalty Program Preview</div>
              <div style={{fontSize:13,color:'#78716C',display:'grid',gap:4}}>
                <div>• KES 1,000 order earns <strong style={{color:'#D97706'}}>{Math.floor(1000/100)*(business.loyalty_points_per_100||1)} points</strong></div>
                <div>• 100 points = <strong style={{color:'#D97706'}}>KES {(100*(business.loyalty_redeem_rate||1)).toFixed(0)} discount</strong></div>
                <div>• Silver tier from <strong style={{color:'#9CA3AF'}}>KES {Number(business.loyalty_silver_threshold||5000).toLocaleString()}</strong> spend</div>
                <div>• Gold tier from <strong style={{color:'#D97706'}}>KES {Number(business.loyalty_gold_threshold||20000).toLocaleString()}</strong> spend</div>
                <div>• Platinum tier from <strong style={{color:'#8B5CF6'}}>KES {Number(business.loyalty_platinum_threshold||50000).toLocaleString()}</strong> spend</div>
              </div>
            </div>
          </div>
          <div style={{padding:'12px 20px',borderTop:'1px solid #E7E5E4',textAlign:'right'}}>
            <button className="btn btn-primary" onClick={saveBusiness} disabled={saving==='business'}>
              <i className="fa-solid fa-save"/> {saving==='business'?'Saving...':'Save Loyalty Settings'}
            </button>
          </div>
        </div>
      )}

      {/* Email Settings */}
      {tab === 'email' && (
        <div className="card">
          <div className="card-header"><span className="card-title"><i className="fa-solid fa-envelope" style={{marginRight:8,color:'#F59E0B'}} />Email / SMTP Settings</span></div>
          <div className="card-body">
            <div style={{background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:8,padding:12,marginBottom:16,fontSize:13,color:'#1E40AF'}}>
              <i className="fa-solid fa-circle-info" style={{marginRight:6}} />
              Configure SMTP to enable end-of-day reports, shift notifications, and low-stock alerts sent by email.
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">SMTP Host</label>
                <input className="form-input" value={email.smtp_host} onChange={e=>setEmail({...email,smtp_host:e.target.value})} placeholder="smtp.gmail.com" />
              </div>
              <div className="form-group">
                <label className="form-label">SMTP Port</label>
                <input type="number" className="form-input" value={email.smtp_port} onChange={e=>setEmail({...email,smtp_port:+e.target.value})} />
              </div>
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">SMTP Username / Email</label>
                <input className="form-input" value={email.smtp_user} onChange={e=>setEmail({...email,smtp_user:e.target.value})} placeholder="your@gmail.com" />
              </div>
              <div className="form-group">
                <label className="form-label">SMTP Password / App Password</label>
                <input type="password" className="form-input" value={email.smtp_pass||''} onChange={e=>setEmail({...email,smtp_pass:e.target.value})} placeholder="Leave blank to keep existing" />
              </div>
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">From Email</label>
                <input className="form-input" value={email.from_email} onChange={e=>setEmail({...email,from_email:e.target.value})} placeholder="pos@sailounge.com" />
              </div>
              <div className="form-group">
                <label className="form-label">From Name</label>
                <input className="form-input" value={email.from_name} onChange={e=>setEmail({...email,from_name:e.target.value})} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Report Recipients (comma-separated emails)</label>
              <input className="form-input" value={email.report_emails} onChange={e=>setEmail({...email,report_emails:e.target.value})} placeholder="manager@sailounge.com, owner@gmail.com" />
            </div>
            <div className="form-group" style={{display:'flex',alignItems:'center',gap:10}}>
              <input type="checkbox" id="eod" checked={!!email.send_eod_report} onChange={e=>setEmail({...email,send_eod_report:e.target.checked?1:0})} style={{width:18,height:18,accentColor:'#F59E0B'}} />
              <label htmlFor="eod" style={{fontSize:14,fontWeight:600,cursor:'pointer'}}>Send end-of-day report automatically at midnight</label>
            </div>
            <div style={{marginTop:6,padding:'10px 14px',background:'#F0FDF4',borderRadius:8,fontSize:12,color:'#166534'}}>
              <i className="fa-solid fa-envelope-circle-check" style={{marginRight:6}} />
              <strong>Reports included:</strong> Total sales, M-Pesa, cash, card sales · Shift summaries · Category breakdown · Low stock alerts
            </div>
            <div style={{marginTop:14}}>
              <button className="btn btn-primary" onClick={saveEmail} disabled={saving==='email'}>
                {saving==='email'?<><span className="spinner" style={{width:14,height:14,borderWidth:2}}/> Saving...</>:<><i className="fa-solid fa-floppy-disk" /> Save Email Settings</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* M-Pesa Settings */}
      {tab === 'mpesa' && (
        <div className="card">
          <div className="card-header"><span className="card-title"><i className="fa-solid fa-mobile-screen" style={{marginRight:8,color:'#10B981'}} />M-Pesa Daraja Integration</span></div>
          <div className="card-body">
            <div style={{background:'#F0FDF4',border:'1px solid #A7F3D0',borderRadius:8,padding:14,marginBottom:16,fontSize:13}}>
              <div style={{fontWeight:700,color:'#065F46',marginBottom:6}}><i className="fa-solid fa-circle-check" style={{marginRight:6}} />M-Pesa STK Push Integration</div>
              <div style={{color:'#166534'}}>
                This POS integrates with Safaricom Daraja API for M-Pesa STK Push (Lipa na M-Pesa). When a customer pays via M-Pesa, the system sends an STK push to their phone automatically.
              </div>
              <div style={{marginTop:8,color:'#166534',fontSize:12}}>
                <strong>Setup:</strong> Register at <a href="https://developer.safaricom.co.ke" target="_blank" rel="noreferrer" style={{color:'#059669'}}>developer.safaricom.co.ke</a> → Create App → Get Consumer Key & Secret → Set callback URL to your server's public IP.
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Environment</label>
              <select className="form-select" value={mpesa.environment} onChange={e=>setMpesa({...mpesa,environment:e.target.value})}>
                <option value="sandbox">Sandbox (Testing)</option>
                <option value="production">Production (Live)</option>
              </select>
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Business Short Code (Paybill/Till)</label>
                <input className="form-input" value={mpesa.shortcode} onChange={e=>setMpesa({...mpesa,shortcode:e.target.value})} placeholder="e.g. 174379" />
              </div>
              <div className="form-group">
                <label className="form-label">Lipa na M-Pesa Passkey</label>
                <input type="password" className="form-input" value={mpesa.passkey||''} onChange={e=>setMpesa({...mpesa,passkey:e.target.value})} placeholder="Leave blank to keep existing" />
              </div>
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Consumer Key</label>
                <input className="form-input" value={mpesa.consumer_key} onChange={e=>setMpesa({...mpesa,consumer_key:e.target.value})} placeholder="From Daraja app" />
              </div>
              <div className="form-group">
                <label className="form-label">Consumer Secret</label>
                <input type="password" className="form-input" value={mpesa.consumer_secret||''} onChange={e=>setMpesa({...mpesa,consumer_secret:e.target.value})} placeholder="Leave blank to keep existing" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Callback URL (must be publicly accessible HTTPS)</label>
              <input className="form-input" value={mpesa.callback_url} onChange={e=>setMpesa({...mpesa,callback_url:e.target.value})} placeholder="https://yourdomain.com/api/mpesa/callback" />
            </div>
            <div style={{marginTop:4}}>
              <button className="btn btn-success" onClick={saveMpesa} disabled={saving==='mpesa'}>
                {saving==='mpesa'?<><span className="spinner" style={{width:14,height:14,borderWidth:2}}/> Saving...</>:<><i className="fa-solid fa-floppy-disk" /> Save M-Pesa Settings</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Promotions */}
      {tab === 'promotions' && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:14}}>
            <button className="btn btn-primary" onClick={()=>{ setPromoForm({ name:'', type:'percentage', value:0, active:1, start_time:'', end_time:'', description:'' }); setPromoModal(true); }}>
              <i className="fa-solid fa-plus" /> Add Promotion
            </button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:14}}>
            {promotions.map(p => (
              <div key={p.id} className="card" style={{padding:18,borderLeft:`4px solid ${p.active?'#F59E0B':'#D1D5DB'}`}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                  <div>
                    <div style={{fontFamily:'Poppins',fontWeight:700,fontSize:15}}>{p.name}</div>
                    <span className={`badge ${p.type==='happy_hour'?'badge-purple':p.type==='buy2get1'||p.type==='bogo'?'badge-blue':'badge-amber'}`} style={{marginTop:4}}>
                      {p.type.replace(/_/g,' ').toUpperCase()}
                    </span>
                  </div>
                  <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:12,fontWeight:600}}>
                    <span style={{color:p.active?'#10B981':'#9CA3AF'}}>{p.active?'Active':'Inactive'}</span>
                    <div style={{width:40,height:22,background:p.active?'#10B981':'#D1D5DB',borderRadius:11,position:'relative',transition:'background 0.2s',cursor:'pointer'}} onClick={()=>togglePromo(p)}>
                      <div style={{position:'absolute',top:3,left:p.active?20:3,width:16,height:16,background:'white',borderRadius:'50%',transition:'left 0.2s'}} />
                    </div>
                  </label>
                </div>
                {p.description && <div style={{fontSize:12,color:'#78716C',marginBottom:6}}>{p.description}</div>}
                {p.value > 0 && <div style={{fontSize:13,fontWeight:700,color:'#D97706'}}>{p.type==='percentage'||p.type==='happy_hour'?`${p.value}% off`:`KES ${p.value} off`}</div>}
                {(p.start_time||p.end_time) && (
                  <div style={{fontSize:11,color:'#78716C',marginTop:4}}>
                    <i className="fa-solid fa-clock" style={{marginRight:4}} />{p.start_time} – {p.end_time}
                  </div>
                )}
              </div>
            ))}
          </div>

          {promoModal && (
            <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setPromoModal(false)}>
              <div className="modal">
                <div className="modal-header">
                  <span className="modal-title"><i className="fa-solid fa-tags" style={{marginRight:8,color:'#F59E0B'}} />New Promotion</span>
                  <button className="modal-close" onClick={()=>setPromoModal(false)}><i className="fa-solid fa-xmark" /></button>
                </div>
                <div className="modal-body">
                  <div className="form-group">
                    <label className="form-label">Promotion Name</label>
                    <input className="form-input" value={promoForm.name} onChange={e=>setPromoForm({...promoForm,name:e.target.value})} placeholder="e.g. Weekend Special" />
                  </div>
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label">Type</label>
                      <select className="form-select" value={promoForm.type} onChange={e=>setPromoForm({...promoForm,type:e.target.value})}>
                        <option value="percentage">Percentage Discount</option>
                        <option value="fixed">Fixed Amount Off</option>
                        <option value="happy_hour">Happy Hour</option>
                        <option value="buy2get1">Buy 2 Get 1 Free</option>
                        <option value="bogo">Buy 1 Get 1 Free</option>
                        <option value="buffet">Buffet</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Value (% or KES)</label>
                      <input type="number" className="form-input" value={promoForm.value} onChange={e=>setPromoForm({...promoForm,value:+e.target.value})} />
                    </div>
                  </div>
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label">Start Time (optional)</label>
                      <input type="time" className="form-input" value={promoForm.start_time} onChange={e=>setPromoForm({...promoForm,start_time:e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">End Time (optional)</label>
                      <input type="time" className="form-input" value={promoForm.end_time} onChange={e=>setPromoForm({...promoForm,end_time:e.target.value})} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea className="form-textarea" value={promoForm.description} onChange={e=>setPromoForm({...promoForm,description:e.target.value})} placeholder="Describe the promotion..." />
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline" onClick={()=>setPromoModal(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={savePromo} disabled={saving==='promo'||!promoForm.name}>
                    {saving==='promo'?<span className="spinner" style={{width:14,height:14,borderWidth:2}}/>:<><i className="fa-solid fa-plus" /> Create</>}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Happy Hour */}
      {tab === 'happy_hour' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title"><i className="fa-solid fa-star" style={{marginRight:8,color:'#8B5CF6'}} />Happy Hour Schedule</span>
          </div>
          <div className="card-body">
            <div style={{background:'linear-gradient(135deg,#7C3AED,#5B21B6)',color:'white',borderRadius:12,padding:20,marginBottom:20}}>
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
                <i className="fa-solid fa-champagne-glasses" style={{fontSize:28}} />
                <div>
                  <div style={{fontFamily:'Poppins',fontWeight:700,fontSize:18}}>Happy Hour</div>
                  <div style={{opacity:0.8,fontSize:13}}>Automatic price discounts during set hours</div>
                </div>
              </div>
              <div style={{fontSize:13,opacity:0.9}}>
                During happy hour, menu items with a "Happy Hour Price" set will automatically show the discounted price in the ordering interface. The system reverts automatically when the time window ends.
              </div>
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Schedule Name</label>
                <input className="form-input" value={happyHour.name} onChange={e=>setHappyHour({...happyHour,name:e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Discount (%)</label>
                <input type="number" className="form-input" value={happyHour.discount_percent} onChange={e=>setHappyHour({...happyHour,discount_percent:+e.target.value})} min={0} max={100} />
              </div>
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Start Time</label>
                <input type="time" className="form-input" value={happyHour.start_time} onChange={e=>setHappyHour({...happyHour,start_time:e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">End Time</label>
                <input type="time" className="form-input" value={happyHour.end_time} onChange={e=>setHappyHour({...happyHour,end_time:e.target.value})} />
              </div>
            </div>
            <div className="form-group" style={{display:'flex',alignItems:'center',gap:10}}>
              <input type="checkbox" id="hhactive" checked={!!happyHour.active} onChange={e=>setHappyHour({...happyHour,active:e.target.checked?1:0})} style={{width:18,height:18,accentColor:'#8B5CF6'}} />
              <label htmlFor="hhactive" style={{fontSize:14,fontWeight:600,cursor:'pointer'}}>Happy Hour Enabled</label>
            </div>
            <div style={{background:'#F5F3FF',border:'1px solid #DDD6FE',borderRadius:8,padding:12,fontSize:12,color:'#5B21B6',marginBottom:14}}>
              <i className="fa-solid fa-lightbulb" style={{marginRight:6}} />
              <strong>Tip:</strong> Set Happy Hour prices on individual menu items via the Menu page. Items without a happy hour price will use regular pricing even during happy hours.
            </div>
            <button className="btn btn-primary" onClick={async()=>{
              setSaving('hh');
              try {
                const p = promotions.find(x=>x.type==='happy_hour');
                if (p) await api.put(`/promotions/${p.id}`, { ...p, name:happyHour.name, value:happyHour.discount_percent, start_time:happyHour.start_time, end_time:happyHour.end_time, active:happyHour.active });
                else await api.post('/promotions', { name:happyHour.name, type:'happy_hour', value:happyHour.discount_percent, start_time:happyHour.start_time, end_time:happyHour.end_time, active:happyHour.active });
                alert('✅ Happy Hour schedule saved!');
                load();
              } catch(e) { alert('Error: '+e.response?.data?.error); }
              finally { setSaving(''); }
            }} disabled={saving==='hh'}>
              {saving==='hh'?<><span className="spinner" style={{width:14,height:14,borderWidth:2}}/> Saving...</>:<><i className="fa-solid fa-floppy-disk" /> Save Happy Hour</>}
            </button>
          </div>
        </div>
      )}
      {/* Backups */}
      {tab === 'backups' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title"><i className="fa-solid fa-database" style={{marginRight:8,color:'#F59E0B'}}/>Database Backups</span>
            <button className="btn btn-sm btn-primary" onClick={doBackup} disabled={backing}>
              {backing ? <><span className="spinner" style={{width:14,height:14,borderWidth:2}}/> Backing up...</> : <><i className="fa-solid fa-download"/> Create Backup Now</>}
            </button>
          </div>
          <div className="card-body">
            <div style={{background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:8,padding:12,marginBottom:16,fontSize:13,color:'#1E40AF'}}>
              <i className="fa-solid fa-circle-info" style={{marginRight:6}}/>
              The database is automatically backed up daily at <strong>3:00 AM</strong> to the <code>backups/</code> folder on the server. Up to 14 daily backups are kept.
            </div>
            {backups.length === 0 ? (
              <div style={{textAlign:'center',padding:32,color:'#78716C'}}>No backups yet. Create one above.</div>
            ) : (
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{background:'#FAFAF9',borderBottom:'2px solid #E7E5E4'}}>
                    {['Filename','Size','Type','Created'].map(h=>(
                      <th key={h} style={{padding:'8px 12px',textAlign:'left',fontSize:11,fontWeight:700,color:'#78716C',textTransform:'uppercase'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {backups.map(b=>(
                    <tr key={b.id} style={{borderBottom:'1px solid #F5F5F4'}}>
                      <td style={{padding:'8px 12px',fontSize:12,fontFamily:'monospace'}}>{b.filename}</td>
                      <td style={{padding:'8px 12px',fontSize:12,color:'#78716C'}}>{((b.size_bytes||0)/1024).toFixed(1)} KB</td>
                      <td style={{padding:'8px 12px'}}>
                        <span style={{background:b.type==='manual'?'#EFF6FF':'#F0FDF4',color:b.type==='manual'?'#1E40AF':'#065F46',border:`1px solid ${b.type==='manual'?'#BFDBFE':'#86EFAC'}`,borderRadius:8,padding:'2px 8px',fontSize:11,fontWeight:700}}>
                          {b.type}
                        </span>
                      </td>
                      <td style={{padding:'8px 12px',fontSize:12,color:'#78716C'}}>{new Date(b.created_at).toLocaleString('en-KE')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
