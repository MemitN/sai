import React, { useState, useEffect, useCallback } from 'react';
import api from '../hooks/useApi';

export default function MenuPage() {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [activeCat, setActiveCat] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name:'', price:0, happy_hour_price:'', description:'', available:1, category_id:'', image_emoji:'🍽️', image_url:'', unit:'serving', commission_eligible:0, commission_rate:0, commission_threshold:0 });
  const [saving, setSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState('');

  const load = useCallback(async () => {
    try {
      const [cRes, mRes] = await Promise.all([api.get('/menu/categories'), api.get('/menu/items')]);
      setCategories(cRes.data);
      setItems(mRes.data);
      if (!activeCat && cRes.data.length) setActiveCat(cRes.data[0].id);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [activeCat]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditItem(null);
    setForm({ name:'', price:0, happy_hour_price:'', description:'', available:1, category_id:activeCat||categories[0]?.id||'', image_emoji:'🍽️', image_url:'', unit:'serving', commission_eligible:0, commission_rate:0, commission_threshold:0 });
    setImagePreview('');
    setModal('item');
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({
      name: item.name, price: item.price,
      happy_hour_price: item.happy_hour_price||'',
      description: item.description||'',
      available: item.available,
      category_id: item.category_id,
      image_emoji: item.image_emoji||'🍽️',
      image_url: item.image_url||'',
      unit: item.unit||'serving',
      commission_eligible: item.commission_eligible||0,
      commission_rate: item.commission_rate||0,
      commission_threshold: item.commission_threshold||0,
    });
    setImagePreview(item.image_url||'');
    setModal('item');
  };

  const handleImageFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview(ev.target.result);
      setForm(f => ({ ...f, image_url: ev.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const saveItem = async () => {
    if (!form.name || !form.price) return alert('Name and price are required');
    setSaving(true);
    try {
      const payload = { ...form, price: +form.price, happy_hour_price: form.happy_hour_price ? +form.happy_hour_price : null, category_id: +form.category_id };
      if (editItem) await api.put(`/menu/items/${editItem.id}`, payload);
      else await api.post('/menu/items', payload);
      setModal(null);
      load();
    } catch(e) { alert('Error: ' + (e.response?.data?.error || e.message)); }
    finally { setSaving(false); }
  };

  const deleteItem = async (item) => {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    try { await api.delete(`/menu/items/${item.id}`); load(); }
    catch(e) { alert('Error: ' + e.response?.data?.error); }
  };

  const toggleAvailable = async (item) => {
    try {
      await api.put(`/menu/items/${item.id}`, { ...item, available: item.available ? 0 : 1 });
      load();
    } catch(e) { alert('Error'); }
  };

  const filtered = items.filter(i =>
    (!activeCat || i.category_id === activeCat) &&
    (!search || i.name.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return <div className="loading"><div className="spinner"/></div>;

  return (
    <div>
      <div className="page-header">
        <h2><i className="fa-solid fa-bowl-food" style={{marginRight:8,color:'#F59E0B'}} />Menu Management</h2>
        <button className="btn btn-primary" onClick={openAdd}><i className="fa-solid fa-plus" /> Add Item</button>
      </div>

      {/* Clean Category Tabs - No emojis, no department tags */}
      <div style={{display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', borderBottom: '2px solid #E7E5E4', paddingBottom: '12px'}}>
        {categories.map(c => (
          <button 
            key={c.id} 
            onClick={() => { setActiveCat(c.id); setSearch(''); }}
            style={{
              padding: '8px 20px',
              borderRadius: '30px',
              border: 'none',
              background: activeCat === c.id && !search ? '#F59E0B' : '#F5F5F4',
              color: activeCat === c.id && !search ? '#1C1917' : '#78716C',
              fontWeight: activeCat === c.id && !search ? 600 : 500,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: 'Poppins, sans-serif'
            }}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div style={{display: 'flex', justifyContent: 'flex-end', marginBottom: '16px'}}>
        <div className="search-bar" style={{width: '250px'}}>
          <i className="fa-solid fa-magnifying-glass" />
          <input placeholder="Search menu..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && (
            <button onClick={() => setSearch('')} style={{background: 'none', border: 'none', cursor: 'pointer', color: '#78716C'}}>
              <i className="fa-solid fa-times" />
            </button>
          )}
        </div>
      </div>

      {/* Menu Items Grid */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:16}}>
        {filtered.map(item => (
          <div key={item.id} className="card" style={{overflow:'hidden', opacity:item.available?1:0.6, transition: 'transform 0.2s', cursor: 'pointer'}} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
            <div style={{height:140, background:'#FAFAF9', display:'flex', alignItems:'center', justifyContent:'center', position:'relative'}}>
              {item.image_url
                ? <img src={item.image_url} alt={item.name} style={{width:'100%', height:'100%', objectFit:'cover'}} />
                : <span style={{fontSize:48}}>{item.image_emoji || '🍽️'}</span>
              }
              {!item.available && (
                <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center'}}>
                  <span className="badge badge-red" style={{background:'#EF4444', color:'white'}}>Unavailable</span>
                </div>
              )}
            </div>
            <div style={{padding:'14px'}}>
              <div style={{fontWeight:700, fontSize:14, marginBottom:6, color:'#1C1917'}}>{item.name}</div>
              <div style={{display:'flex', alignItems:'baseline', gap:8, marginBottom:8}}>
                <div style={{fontFamily:'Montserrat', fontWeight:800, fontSize:16, color:'#D97706'}}>KES {Number(item.price).toLocaleString()}</div>
                {item.happy_hour_price && (
                  <span style={{fontSize:11, background:'#EDE9FE', color:'#5B21B6', padding:'2px 8px', borderRadius:12, fontWeight:600}}>
                    HH: {Number(item.happy_hour_price).toLocaleString()}
                  </span>
                )}
              </div>
              {item.description && <div style={{fontSize:11, color:'#78716C', marginBottom:10, lineHeight:1.4}}>{item.description.substring(0, 60)}</div>}
              <div style={{display:'flex', gap:8}}>
                <button className="btn btn-sm btn-outline" style={{flex:1}} onClick={()=>openEdit(item)}>
                  <i className="fa-solid fa-pen" /> Edit
                </button>
                <button className={`btn btn-sm ${item.available?'btn-outline':'btn-success'}`} onClick={()=>toggleAvailable(item)} title={item.available?'Mark unavailable':'Mark available'}>
                  <i className={`fa-solid ${item.available?'fa-eye-slash':'fa-eye'}`} />
                </button>
                <button className="btn btn-sm btn-danger" onClick={()=>deleteItem(item)}>
                  <i className="fa-solid fa-trash" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="empty-state" style={{gridColumn:'1/-1'}}><i className="fa-solid fa-bowl-food" /><p>No items in this category</p></div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modal === 'item' && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">
                <i className="fa-solid fa-bowl-food" style={{marginRight:8,color:'#F59E0B'}} />
                {editItem?'Edit Menu Item':'Add Menu Item'}
              </span>
              <button className="modal-close" onClick={()=>setModal(null)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="modal-body">
              <div style={{display:'grid', gridTemplateColumns:'1fr 180px', gap:16}}>
                <div>
                  <div className="form-group">
                    <label className="form-label">Item Name *</label>
                    <input className="form-input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Nyama Choma (500g)" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select className="form-select" value={form.category_id} onChange={e=>setForm({...form,category_id:+e.target.value})}>
                      {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label">Regular Price (KES) *</label>
                      <input type="number" className="form-input" value={form.price} onChange={e=>setForm({...form,price:+e.target.value})} min={0} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Happy Hour Price (KES)</label>
                      <input type="number" className="form-input" value={form.happy_hour_price} onChange={e=>setForm({...form,happy_hour_price:e.target.value})} min={0} placeholder="Leave blank if none" />
                    </div>
                  </div>
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label">Unit</label>
                      <input className="form-input" value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})} placeholder="serving/bottle/kg/pc" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Emoji Icon</label>
                      <input className="form-input" value={form.image_emoji} onChange={e=>setForm({...form,image_emoji:e.target.value})} style={{fontSize:20}} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea className="form-textarea" rows={2} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Brief description of the item..." />
                  </div>
                  <div className="form-group" style={{display:'flex',alignItems:'center',gap:10}}>
                    <input type="checkbox" id="avail" checked={!!form.available} onChange={e=>setForm({...form,available:e.target.checked?1:0})} style={{width:18,height:18,accentColor:'#F59E0B'}} />
                    <label htmlFor="avail" style={{fontSize:14,fontWeight:600,cursor:'pointer'}}>Available for ordering</label>
                  </div>

                  {/* Commission Settings */}
                  <div style={{background:'#FFFBEB',border:'1px solid #FCD34D',borderRadius:10,padding:12,marginTop:4}}>
                    <div style={{fontWeight:700,fontSize:12,color:'#92400E',marginBottom:10}}>
                      <i className="fa-solid fa-coins" style={{marginRight:6}} />Waiter Commission
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                      <input type="checkbox" id="comm_elig" checked={!!form.commission_eligible}
                        onChange={e=>setForm({...form,commission_eligible:e.target.checked?1:0})}
                        style={{width:16,height:16,accentColor:'#D97706'}} />
                      <label htmlFor="comm_elig" style={{fontSize:13,fontWeight:600,cursor:'pointer',color:'#92400E'}}>
                        Commission eligible (premium item)
                      </label>
                    </div>
                    {!!form.commission_eligible && (
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                        <div>
                          <label className="form-label" style={{fontSize:11}}>Commission Rate (%)</label>
                          <input type="number" className="form-input" min={0} max={100} step={0.5}
                            value={form.commission_rate}
                            onChange={e=>setForm({...form,commission_rate:+e.target.value})}
                            placeholder="e.g. 5 (overrides waiter default)" />
                        </div>
                        <div>
                          <label className="form-label" style={{fontSize:11}}>Auto-trigger at price ≥ (KES)</label>
                          <input type="number" className="form-input" min={0}
                            value={form.commission_threshold}
                            onChange={e=>setForm({...form,commission_threshold:+e.target.value})}
                            placeholder="e.g. 2000" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Image Upload */}
                <div>
                  <label className="form-label">Item Image</label>
                  <div style={{border:'2px dashed #E7E5E4', borderRadius:12, padding:16, textAlign:'center', background:'#FAFAF9', marginBottom:10}}>
                    {imagePreview
                      ? <img src={imagePreview} alt="preview" style={{width:'100%', height:120, objectFit:'cover', borderRadius:8, marginBottom:8}} />
                      : <div style={{height:120, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8}}>
                          <span style={{fontSize:40}}>{form.image_emoji || '🍽️'}</span>
                          <span style={{fontSize:12, color:'#78716C'}}>No image</span>
                        </div>
                    }
                  </div>
                  <label style={{display:'block', marginBottom:8}}>
                    <div className="btn btn-outline btn-sm btn-full" style={{cursor:'pointer'}}>
                      <i className="fa-solid fa-image" /> Upload Image
                    </div>
                    <input type="file" accept="image/*" style={{display:'none'}} onChange={handleImageFile} />
                  </label>
                  {imagePreview && (
                    <button className="btn btn-sm btn-danger btn-full" onClick={()=>{setImagePreview('');setForm(f=>({...f,image_url:''}));}}>
                      <i className="fa-solid fa-trash" /> Remove Image
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={()=>setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveItem} disabled={saving}>
                {saving?<><span className="spinner" style={{width:14,height:14,borderWidth:2}}/> Saving...</>:<><i className="fa-solid fa-floppy-disk" /> {editItem?'Save Changes':'Add Item'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}