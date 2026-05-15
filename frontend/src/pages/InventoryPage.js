import React, { useState, useEffect, useCallback } from 'react';
import api from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';

export default function InventoryPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState([]);
  const [dept, setDept] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState(null);
  const [addModal, setAddModal] = useState(false);
  const [form, setForm] = useState({});
  const [newForm, setNewForm] = useState({ name:'', category:'', department:'kitchen', quantity:0, unit:'pcs', reorder_level:5, cost_price:0 });
  const [saving, setSaving] = useState(false);
  const canEdit = ['admin','management','bar_attendant'].includes(user?.role);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/reports/inventory' + (dept !== 'all' ? `?dept=${dept}` : ''));
      setItems(data.items || []);
      setSummary(data.summary || []);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [dept]);

  useEffect(() => { load(); }, [load]);

  const openEdit = (item) => {
    setEditItem(item);
    setForm({ quantity: item.quantity, name: item.name, reorder_level: item.reorder_level, cost_price: item.cost_price });
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await api.put(`/inventory/${editItem.id}`, form);
      setEditItem(null);
      load();
    } catch(e) { alert('Error: ' + e.response?.data?.error); }
    finally { setSaving(false); }
  };

  const addItem = async () => {
    setSaving(true);
    try {
      await api.post('/inventory', newForm);
      setAddModal(false);
      setNewForm({ name:'', category:'', department:'kitchen', quantity:0, unit:'pcs', reorder_level:5, cost_price:0 });
      load();
    } catch(e) { alert('Error: ' + e.response?.data?.error); }
    finally { setSaving(false); }
  };

  const filtered = items.filter(i =>
    (dept === 'all' || i.department === dept) &&
    (!search || i.name.toLowerCase().includes(search.toLowerCase()) || i.category.toLowerCase().includes(search.toLowerCase()))
  );

  const stockPct = (item) => Math.min(100, (item.quantity / (item.reorder_level * 3)) * 100);
  const statusClass = (item) => item.quantity <= 0 ? 'out' : item.quantity <= item.reorder_level ? 'low' : 'ok';
  const statusLabel = { ok: { label: 'OK', cls: 'badge-green' }, low: { label: 'Low', cls: 'badge-amber' }, out: { label: 'Out', cls: 'badge-red' } };

  if (loading) return <div className="loading"><div className="spinner"/></div>;

  return (
    <div>
      <div className="page-header">
        <h2><i className="fa-solid fa-boxes-stacked" style={{marginRight:8,color:'#F59E0B'}} />Inventory</h2>
        {['admin','management'].includes(user?.role) && (
          <button className="btn btn-primary" onClick={()=>setAddModal(true)}>
            <i className="fa-solid fa-plus" /> Add Item
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:12,marginBottom:16}}>
        {summary.map(s => (
          <div key={s.department} className="card" style={{padding:'14px 16px'}}>
            <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',color:'#78716C',letterSpacing:'0.05em'}}>{s.department}</div>
            <div style={{fontFamily:'Montserrat',fontSize:22,fontWeight:800,marginTop:4}}>{s.items} items</div>
            <div style={{fontSize:12,color:'#D97706',marginTop:2}}>Value: KES {Number(s.total_value||0).toLocaleString()}</div>
            {s.low_items > 0 && <span className="badge badge-red" style={{marginTop:6}}>{s.low_items} low stock</span>}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
        {['all','kitchen','bar','store','equipment'].map(d => (
          <button key={d} className={`cat-tab ${dept===d?'active':''}`} onClick={()=>setDept(d)}>
            {d.charAt(0).toUpperCase()+d.slice(1)}
          </button>
        ))}
        <div className="search-bar" style={{marginLeft:'auto'}}>
          <i className="fa-solid fa-magnifying-glass" />
          <input placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card">
        <div style={{overflowX:'auto'}}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th>Dept</th>
                <th>Stock Level</th>
                <th>Qty</th>
                <th>Min Level</th>
                <th>Unit Cost</th>
                <th>Value</th>
                <th>Status</th>
                {canEdit && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const sc = statusClass(item);
                return (
                  <tr key={item.id}>
                    <td style={{fontWeight:600}}>{item.name}</td>
                    <td style={{color:'#78716C',fontSize:12}}>{item.category}</td>
                    <td><span className={`tag ${item.department==='bar'?'tag-bar':'tag-kitchen'}`}>{item.department}</span></td>
                    <td style={{minWidth:120}}>
                      <div className="inv-level">
                        <div className="inv-level-bar" style={{
                          width: `${stockPct(item)}%`,
                          background: sc==='out'?'#EF4444':sc==='low'?'#F59E0B':'#10B981'
                        }} />
                      </div>
                    </td>
                    <td style={{fontFamily:'Montserrat',fontWeight:700}}>{item.quantity} {item.unit}</td>
                    <td style={{color:'#78716C'}}>{item.reorder_level} {item.unit}</td>
                    <td>KES {Number(item.cost_price||0).toLocaleString()}</td>
                    <td style={{fontWeight:600}}>KES {Number((item.quantity*item.cost_price)||0).toLocaleString()}</td>
                    <td><span className={`badge ${statusLabel[sc].cls}`}>{statusLabel[sc].label}</span></td>
                    {canEdit && (
                      <td>
                        <button className="btn btn-sm btn-outline" onClick={()=>openEdit(item)}>
                          <i className="fa-solid fa-pen" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editItem && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setEditItem(null)}>
          <div className="modal" style={{maxWidth:420}}>
            <div className="modal-header">
              <span className="modal-title"><i className="fa-solid fa-pen" style={{marginRight:8,color:'#F59E0B'}} />Edit: {editItem.name}</span>
              <button className="modal-close" onClick={()=>setEditItem(null)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Item Name</label>
                <input className="form-input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} />
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Current Quantity ({editItem.unit})</label>
                  <input type="number" className="form-input" value={form.quantity} onChange={e=>setForm({...form,quantity:Number(e.target.value)})} step="0.1" />
                </div>
                <div className="form-group">
                  <label className="form-label">Reorder Level ({editItem.unit})</label>
                  <input type="number" className="form-input" value={form.reorder_level} onChange={e=>setForm({...form,reorder_level:Number(e.target.value)})} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Cost Price (KES per {editItem.unit})</label>
                <input type="number" className="form-input" value={form.cost_price} onChange={e=>setForm({...form,cost_price:Number(e.target.value)})} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={()=>setEditItem(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>
                {saving?<span className="spinner" style={{width:14,height:14,borderWidth:2}}/>:<><i className="fa-solid fa-floppy-disk" /> Save</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {addModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setAddModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title"><i className="fa-solid fa-plus" style={{marginRight:8,color:'#F59E0B'}} />Add Inventory Item</span>
              <button className="modal-close" onClick={()=>setAddModal(false)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Item Name</label>
                <input className="form-input" value={newForm.name} onChange={e=>setNewForm({...newForm,name:e.target.value})} placeholder="e.g. Tusker Bottles" />
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <input className="form-input" value={newForm.category} onChange={e=>setNewForm({...newForm,category:e.target.value})} placeholder="e.g. Beer, Meat" />
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select className="form-select" value={newForm.department} onChange={e=>setNewForm({...newForm,department:e.target.value})}>
                    <option value="kitchen">Kitchen</option>
                    <option value="bar">Bar</option>
                    <option value="store">Store</option>
                    <option value="equipment">Equipment</option>
                  </select>
                </div>
              </div>
              <div className="form-grid-3">
                <div className="form-group">
                  <label className="form-label">Quantity</label>
                  <input type="number" className="form-input" value={newForm.quantity} onChange={e=>setNewForm({...newForm,quantity:+e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit</label>
                  <input className="form-input" value={newForm.unit} onChange={e=>setNewForm({...newForm,unit:e.target.value})} placeholder="bottles/kg/pcs" />
                </div>
                <div className="form-group">
                  <label className="form-label">Min Level</label>
                  <input type="number" className="form-input" value={newForm.reorder_level} onChange={e=>setNewForm({...newForm,reorder_level:+e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Cost Price (KES)</label>
                <input type="number" className="form-input" value={newForm.cost_price} onChange={e=>setNewForm({...newForm,cost_price:+e.target.value})} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={()=>setAddModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addItem} disabled={saving||!newForm.name}>
                {saving?<span className="spinner" style={{width:14,height:14,borderWidth:2}}/>:<><i className="fa-solid fa-plus" /> Add Item</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
