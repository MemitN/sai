import React, { useState, useEffect, useCallback } from 'react';
import api from '../hooks/useApi';

function fmt(n) { return `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`; }

export default function SuppliersPage() {
  const [suppliers, setSuppliers]       = useState([]);
  const [inventory, setInventory]       = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [view, setView]                 = useState('suppliers');
  const [modal, setModal]               = useState(null);
  const [editSupplier, setEditSupplier] = useState(null);
  const [sForm, setSForm]               = useState({ name:'', contact_person:'', phone:'', email:'', address:'', payment_terms:'COD' });
  const [poForm, setPoForm]             = useState({ supplier_id:'', notes:'', expected_date:'', items:[{ inventory_id:'', quantity:1, unit_price:0, notes:'' }] });
  const [saving, setSaving]             = useState(false);
  const [searchTerm, setSearchTerm]     = useState('');

  // Partial-receive modal state
  const [receiveModal, setReceiveModal]         = useState(null); // po object
  const [receiveForm, setReceiveForm]           = useState({ delivery_comments:'', items:[] });
  const [receiveLog, setReceiveLog]             = useState([]);
  const [receiveLogModal, setReceiveLogModal]   = useState(null);

  const load = useCallback(async () => {
    try {
      const [sRes, poRes, invRes] = await Promise.all([
        api.get('/suppliers'),
        api.get('/purchase-orders'),
        api.get('/reports/inventory'),
      ]);
      setSuppliers(sRes.data);
      setPurchaseOrders(poRes.data);
      setInventory(invRes.data.items || []);
    } catch(e) { console.error(e); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveSupplier = async () => {
    setSaving(true);
    try {
      if (editSupplier) { await api.put(`/suppliers/${editSupplier.id}`, sForm); }
      else              { await api.post('/suppliers', sForm); }
      setModal(null); setEditSupplier(null);
      setSForm({ name:'', contact_person:'', phone:'', email:'', address:'', payment_terms:'COD' });
      load();
    } catch(e) { alert('Error: ' + e.response?.data?.error); }
    finally { setSaving(false); }
  };

  const openAdd  = () => {
    setSForm({ name:'', contact_person:'', phone:'', email:'', address:'', payment_terms:'COD' });
    setEditSupplier(null);
    setModal('supplier');
  };

  const openEdit = (s) => {
    setEditSupplier(s);
    setSForm({ name:s.name, contact_person:s.contact_person||'', phone:s.phone||'', email:s.email||'', address:s.address||'', payment_terms:s.payment_terms||'COD' });
    setModal('supplier');
  };

  const addPoItem    = () => setPoForm(f => ({ ...f, items:[...f.items, { inventory_id:'', quantity:1, unit_price:0, notes:'' }] }));
  const removePoItem = (i) => setPoForm(f => ({ ...f, items:f.items.filter((_,idx)=>idx!==i) }));
  const updatePoItem = (i, field, val) => setPoForm(f => ({ ...f, items:f.items.map((item,idx)=>idx===i?{...item,[field]:val}:item) }));

  const savePO = async () => {
    setSaving(true);
    try {
      await api.post('/purchase-orders', {
        ...poForm,
        supplier_id: +poForm.supplier_id,
        items: poForm.items.filter(i => i.inventory_id).map(i => ({
          inventory_id: +i.inventory_id, quantity: +i.quantity,
          unit_price: +i.unit_price, notes: i.notes || null,
        }))
      });
      setModal(null);
      setPoForm({ supplier_id:'', notes:'', expected_date:'', items:[{ inventory_id:'', quantity:1, unit_price:0, notes:'' }] });
      load();
    } catch(e) { alert('Error: ' + e.response?.data?.error); }
    finally { setSaving(false); }
  };

  // Open partial-receive modal — prefill each line with full qty as default
  const openReceive = (po) => {
    const items = (po.items || []).map(item => ({
      id: item.id,
      inventory_id: item.inventory_id,
      item_name: item.item_name,
      unit: item.unit,
      ordered_qty: item.quantity,
      already_received: item.received_qty || 0,
      received_qty: item.quantity - (item.received_qty || 0), // default = remaining
      shortage_reason: '',
      condition_notes: '',
    }));
    setReceiveForm({ delivery_comments: po.delivery_comments || '', items });
    setReceiveModal(po);
  };

  const saveReceive = async () => {
    setSaving(true);
    try {
      await api.put(`/purchase-orders/${receiveModal.id}/receive`, {
        delivery_comments: receiveForm.delivery_comments,
        items: receiveForm.items.map(i => ({
          id: i.id,
          inventory_id: i.inventory_id,
          received_qty: +i.received_qty || 0,
          shortage_reason: i.shortage_reason || null,
          condition_notes: i.condition_notes || null,
        })),
      });
      setReceiveModal(null);
      load();
    } catch(e) { alert('Error: ' + (e.response?.data?.error || e.message)); }
    finally { setSaving(false); }
  };

  const openReceiveLog = async (po) => {
    try {
      const { data } = await api.get(`/purchase-orders/${po.id}/receive-log`);
      setReceiveLog(data);
      setReceiveLogModal(po);
    } catch(e) { alert('Error: ' + e.message); }
  };

  const poTotal = poForm.items.reduce((s,i) => s + (+i.quantity||0) * (+i.unit_price||0), 0);

  const getStatusBadge = (status) => {
    const config = {
      received: { bg:'#D1FAE5', color:'#065F46', text:'✓ Received' },
      partial:  { bg:'#FEF3C7', color:'#92400E', text:'◑ Partial'  },
      pending:  { bg:'#EFF6FF', color:'#1D4ED8', text:'⏳ Pending'  },
      cancelled:{ bg:'#FEE2E2', color:'#991B1B', text:'✗ Cancelled'},
    };
    const c = config[status] || config.pending;
    return <span style={{ background:c.bg, color:c.color, padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:600 }}>{c.text}</span>;
  };

  const getItemStatusColor = s => ({ full:'#10B981', partial:'#F59E0B', missing:'#EF4444', pending:'#78716C' }[s] || '#78716C');

  const filteredSuppliers = suppliers.filter(s =>
    !searchTerm || s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.contact_person?.toLowerCase().includes(searchTerm.toLowerCase())
  );


  return (
    <div style={{ background: '#F5F5F4', minHeight: '100vh', padding: '20px 24px' }}>
      
      {/* Header */}
      <div style={{ 
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            background: 'linear-gradient(135deg, #3B82F615, #3B82F608)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #3B82F620',
          }}>
            <i className="fa-solid fa-truck" style={{ fontSize: 22, color: '#3B82F6' }} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1C1917', margin: 0 }}>Suppliers & Purchasing</h1>
        </div>
        
        {/* View Toggle */}
        <div style={{
          display: 'flex',
          gap: 4,
          background: 'white',
          padding: 4,
          borderRadius: 40,
          border: '1px solid #E7E5E4',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        }}>
          <button 
            onClick={() => setView('suppliers')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 20px',
              borderRadius: 32,
              border: 'none',
              background: view === 'suppliers' ? '#3B82F6' : 'transparent',
              color: view === 'suppliers' ? 'white' : '#78716C',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: view === 'suppliers' ? 600 : 500,
              transition: 'all 0.2s',
            }}
          >
            <i className="fa-solid fa-address-book" style={{ fontSize: 12 }} />
            Suppliers
          </button>
          <button 
            onClick={() => setView('orders')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 20px',
              borderRadius: 32,
              border: 'none',
              background: view === 'orders' ? '#3B82F6' : 'transparent',
              color: view === 'orders' ? 'white' : '#78716C',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: view === 'orders' ? 600 : 500,
              transition: 'all 0.2s',
            }}
          >
            <i className="fa-solid fa-file-invoice" style={{ fontSize: 12 }} />
            Purchase Orders
          </button>
        </div>
      </div>

      {/* Suppliers View - TABLE */}
      {view === 'suppliers' && (
        <>
          {/* Search and Add Bar */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 12,
          }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
              <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#A8A29E', fontSize: 13 }} />
              <input 
                type="text"
                placeholder="Search suppliers by name, contact or phone..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  border: '1px solid #E7E5E4',
                  borderRadius: 10,
                  background: 'white',
                  fontSize: 13,
                  color: '#1C1917',
                }}
              />
            </div>
            <button 
              onClick={openAdd}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 20px',
                borderRadius: 10,
                background: '#F59E0B',
                border: 'none',
                color: '#1C1917',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <i className="fa-solid fa-plus" style={{ fontSize: 12 }} />
              Add Supplier
            </button>
          </div>

          {/* Suppliers Table */}
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid #E7E5E4', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#FAFAF9', borderBottom: '1px solid #E7E5E4' }}>
                    <th style={{ textAlign: 'left', padding: '14px 16px', fontSize: 12, color: '#78716C', fontWeight: 600 }}>Supplier</th>
                    <th style={{ textAlign: 'left', padding: '14px 16px', fontSize: 12, color: '#78716C', fontWeight: 600 }}>Contact Person</th>
                    <th style={{ textAlign: 'left', padding: '14px 16px', fontSize: 12, color: '#78716C', fontWeight: 600 }}>Phone</th>
                    <th style={{ textAlign: 'left', padding: '14px 16px', fontSize: 12, color: '#78716C', fontWeight: 600 }}>Email</th>
                    <th style={{ textAlign: 'center', padding: '14px 16px', fontSize: 12, color: '#78716C', fontWeight: 600 }}>Payment Terms</th>
                    <th style={{ textAlign: 'center', padding: '14px 16px', fontSize: 12, color: '#78716C', fontWeight: 600 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #F5F5F4', transition: 'background 0.2s' }}>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            background: 'linear-gradient(135deg, #3B82F615, #3B82F608)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#3B82F6',
                            fontWeight: 700,
                            fontSize: 14,
                          }}>
                            {s.name.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600, color: '#1C1917' }}>{s.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', color: '#78716C', fontSize: 13 }}>{s.contact_person || '—'}</td>
                      <td style={{ padding: '14px 16px', color: '#78716C', fontSize: 13 }}>{s.phone || '—'}</td>
                      <td style={{ padding: '14px 16px', color: '#78716C', fontSize: 13 }}>
                        {s.email ? (s.email.length > 25 ? s.email.substring(0, 22) + '...' : s.email) : '—'}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <span style={{
                          background: '#F0FDF4',
                          padding: '4px 12px',
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#10B981',
                        }}>
                          {s.payment_terms}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                          <button 
                            onClick={() => openEdit(s)}
                            style={{
                              background: '#F5F5F4',
                              border: '1px solid #E7E5E4',
                              borderRadius: 8,
                              padding: '6px 12px',
                              color: '#78716C',
                              cursor: 'pointer',
                              fontSize: 11,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <i className="fa-solid fa-pen" style={{ fontSize: 10 }} /> Edit
                          </button>
                          <button 
                            onClick={() => { setPoForm(f=>({...f, supplier_id:String(s.id)})); setModal('po'); setView('orders'); }}
                            style={{
                              background: '#FEF3C7',
                              border: '1px solid #FDE68A',
                              borderRadius: 8,
                              padding: '6px 12px',
                              color: '#92400E',
                              cursor: 'pointer',
                              fontSize: 11,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <i className="fa-solid fa-plus" style={{ fontSize: 10 }} /> PO
                          </button>
                        </div>
                       </td>
                     </tr>
                  ))}
                  {filteredSuppliers.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 48, color: '#A8A29E' }}>
                        <i className="fa-solid fa-truck" style={{ fontSize: 40, marginBottom: 12, display: 'block', opacity: 0.3 }} />
                        {searchTerm ? 'No suppliers match your search' : 'No suppliers added yet'}
                        {!searchTerm && (
                          <div><button onClick={openAdd} style={{ marginTop: 12, background: '#F59E0B', border: 'none', padding: '8px 20px', borderRadius: 8, color: '#1C1917', cursor: 'pointer' }}>Add your first supplier</button></div>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Purchase Orders View */}
      {view === 'orders' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button 
              onClick={() => { setPoForm({ supplier_id:'', notes:'', expected_date:'', items:[{ inventory_id:'', quantity:1, unit_price:0 }] }); setModal('po'); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 20px',
                borderRadius: 10,
                background: '#F59E0B',
                border: 'none',
                color: '#1C1917',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <i className="fa-solid fa-plus" />
              New Purchase Order
            </button>
          </div>

          {/* Purchase Orders Table */}
          <div style={{ background:'white', borderRadius:16, border:'1px solid #E7E5E4', overflow:'hidden' }}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid #E7E5E4', background:'#FAFAF9' }}>
                    {['PO #','Supplier','Expected','Total','Items','Received','Status','Actions'].map(h=>(
                      <th key={h} style={{ textAlign: h==='Total'?'right':'left', padding:'14px 16px', fontSize:12, color:'#78716C', fontWeight:600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {purchaseOrders.map(po => (
                    <tr key={po.id} style={{ borderBottom:'1px solid #F5F5F4' }}>
                      <td style={{ padding:'12px 16px', fontWeight:700, color:'#F59E0B', fontSize:13 }}>PO-{po.id}</td>
                      <td style={{ padding:'12px 16px', fontWeight:500, color:'#1C1917' }}>
                        {po.supplier_name}
                        {po.notes && <div style={{fontSize:11,color:'#78716C',marginTop:2}}>{po.notes}</div>}
                      </td>
                      <td style={{ padding:'12px 16px', fontSize:12, color:'#78716C' }}>{po.expected_date || '—'}</td>
                      <td style={{ padding:'12px 16px', textAlign:'right', fontWeight:700, color:'#F59E0B' }}>{fmt(po.total_amount)}</td>
                      <td style={{ padding:'12px 16px', fontSize:12 }}>
                        <div style={{fontSize:12}}>{po.item_count || 0} items</div>
                        {po.items_missing > 0 && <div style={{fontSize:10,color:'#EF4444',fontWeight:700}}>{po.items_missing} missing</div>}
                        {po.items_received_partial > 0 && <div style={{fontSize:10,color:'#F59E0B'}}>{po.items_received_partial} partial</div>}
                      </td>
                      <td style={{ padding:'12px 16px', fontSize:12 }}>
                        {po.received_amount > 0 ? (
                          <div>
                            <div style={{fontWeight:700,color:'#10B981'}}>{fmt(po.received_amount)}</div>
                            <div style={{fontSize:10,color:'#78716C'}}>{Math.round((po.received_amount/po.total_amount)*100)}%</div>
                          </div>
                        ) : '—'}
                      </td>
                      <td style={{ padding:'12px 16px' }}>{getStatusBadge(po.status)}</td>
                      <td style={{ padding:'12px 16px' }}>
                        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                          {(po.status === 'pending' || po.status === 'partial') && (
                            <button onClick={() => openReceive(po)}
                              style={{ background:'#F0FDF4', border:'1px solid #D1FAE5', borderRadius:8, padding:'5px 12px', color:'#065F46', fontSize:11, fontWeight:600, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:5 }}>
                              <i className="fa-solid fa-box-open" style={{fontSize:10}} /> Receive
                            </button>
                          )}
                          <button onClick={() => openReceiveLog(po)}
                            style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:8, padding:'5px 10px', color:'#1D4ED8', fontSize:11, cursor:'pointer' }}
                            title="View receive log">
                            <i className="fa-solid fa-history" />
                          </button>
                        </div>
                        {po.delivery_comments && (
                          <div style={{fontSize:10,color:'#78716C',marginTop:4,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={po.delivery_comments}>
                            💬 {po.delivery_comments}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {purchaseOrders.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign:'center', padding:48, color:'#A8A29E' }}>
                        <i className="fa-solid fa-file-invoice" style={{ fontSize:40, marginBottom:12, display:'block', opacity:0.3 }} />
                        No purchase orders yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Partial Receive Modal ─────────────────────────────────────────── */}
      {receiveModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setReceiveModal(null)}>
          <div className="modal" style={{maxWidth:700}}>
            <div className="modal-header">
              <span className="modal-title">
                <i className="fa-solid fa-box-open" style={{marginRight:8,color:'#10B981'}} />
                Receive Goods — PO-{receiveModal.id} ({receiveModal.supplier_name})
              </span>
              <button className="modal-close" onClick={()=>setReceiveModal(null)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="modal-body">
              <div style={{background:'#FFFBEB',border:'1px solid #FCD34D',borderRadius:8,padding:'8px 14px',marginBottom:14,fontSize:13,color:'#92400E'}}>
                <i className="fa-solid fa-triangle-exclamation" style={{marginRight:6}} />
                Enter actual quantities received. Any shortage will be recorded and stock updated only for what was received.
              </div>

              <div className="form-group">
                <label className="form-label">Delivery Comments / Driver Notes</label>
                <textarea className="form-textarea" rows={2}
                  value={receiveForm.delivery_comments}
                  onChange={e=>setReceiveForm({...receiveForm,delivery_comments:e.target.value})}
                  placeholder="e.g. Driver was 2hrs late, some items damp, invoice matches..." />
              </div>

              <div style={{marginBottom:8,fontWeight:700,fontSize:13,color:'#1C1917'}}>Line Items</div>
              <div style={{border:'1px solid #E7E5E4',borderRadius:10,overflow:'hidden'}}>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead>
                    <tr style={{background:'#FAFAF9',borderBottom:'1px solid #E7E5E4'}}>
                      {['Item','Ordered','Already Rcvd','Receiving Now','Shortage','Reason / Condition'].map(h=>(
                        <th key={h} style={{padding:'8px 10px',fontSize:11,fontWeight:700,color:'#78716C',textAlign:'left'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {receiveForm.items.map((item,i) => {
                      const remaining  = item.ordered_qty - item.already_received;
                      const receiving  = +item.received_qty || 0;
                      const shortage   = Math.max(0, remaining - receiving);
                      const isShort    = shortage > 0;
                      return (
                        <tr key={i} style={{borderBottom:'1px solid #F5F5F4',background:isShort?'#FFF7ED':'white'}}>
                          <td style={{padding:'8px 10px'}}>
                            <div style={{fontWeight:600,fontSize:12}}>{item.item_name}</div>
                            <div style={{fontSize:10,color:'#78716C'}}>{item.unit}</div>
                          </td>
                          <td style={{padding:'8px 10px',fontSize:12,fontWeight:700,color:'#1C1917',textAlign:'center'}}>{item.ordered_qty}</td>
                          <td style={{padding:'8px 10px',fontSize:12,color:'#10B981',textAlign:'center',fontWeight:600}}>
                            {item.already_received > 0 ? item.already_received : '—'}
                          </td>
                          <td style={{padding:'8px 10px',minWidth:80}}>
                            <input type="number" min={0} max={remaining}
                              value={item.received_qty}
                              onChange={e=>{
                                const items=[...receiveForm.items];
                                items[i]={...items[i],received_qty:e.target.value};
                                setReceiveForm({...receiveForm,items});
                              }}
                              style={{width:70,padding:'4px 8px',borderRadius:6,border:`1px solid ${isShort?'#F59E0B':'#E7E5E4'}`,fontSize:13,fontWeight:700,textAlign:'center'}}
                            />
                          </td>
                          <td style={{padding:'8px 10px',textAlign:'center'}}>
                            {shortage > 0
                              ? <span style={{color:'#EF4444',fontWeight:700,fontSize:13}}>−{shortage}</span>
                              : <span style={{color:'#10B981',fontSize:13}}>✓</span>
                            }
                          </td>
                          <td style={{padding:'8px 10px'}}>
                            <input placeholder={shortage>0?"Reason for shortage...":"Condition / notes..."}
                              value={item.shortage_reason||''}
                              onChange={e=>{
                                const items=[...receiveForm.items];
                                items[i]={...items[i],shortage_reason:e.target.value};
                                setReceiveForm({...receiveForm,items});
                              }}
                              style={{width:'100%',padding:'4px 8px',borderRadius:6,border:'1px solid #E7E5E4',fontSize:11}}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              {(() => {
                const totalOrdered  = receiveForm.items.reduce((s,i)=>s+i.ordered_qty,0);
                const totalReceiving= receiveForm.items.reduce((s,i)=>s+(+i.received_qty||0),0);
                const totalShortage = totalOrdered - totalReceiving - receiveForm.items.reduce((s,i)=>s+(i.already_received||0),0);
                return (
                  <div style={{display:'flex',gap:12,marginTop:12,flexWrap:'wrap'}}>
                    <div style={{flex:1,background:'#F0FDF4',border:'1px solid #86EFAC',borderRadius:8,padding:'8px 14px',textAlign:'center'}}>
                      <div style={{fontSize:10,color:'#065F46',fontWeight:700}}>RECEIVING NOW</div>
                      <div style={{fontFamily:'Montserrat',fontWeight:800,fontSize:20,color:'#065F46'}}>{totalReceiving}</div>
                    </div>
                    {totalShortage > 0 && (
                      <div style={{flex:1,background:'#FEF2F2',border:'1px solid #FCA5A5',borderRadius:8,padding:'8px 14px',textAlign:'center'}}>
                        <div style={{fontSize:10,color:'#991B1B',fontWeight:700}}>SHORTAGE</div>
                        <div style={{fontFamily:'Montserrat',fontWeight:800,fontSize:20,color:'#991B1B'}}>{totalShortage}</div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={()=>setReceiveModal(null)}>Cancel</button>
              <button className="btn btn-success" onClick={saveReceive} disabled={saving}>
                <i className="fa-solid fa-box-open" /> {saving?'Saving...':'Confirm Receipt & Update Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Receive Log Modal ─────────────────────────────────────────────── */}
      {receiveLogModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setReceiveLogModal(null)}>
          <div className="modal" style={{maxWidth:640}}>
            <div className="modal-header">
              <span className="modal-title">
                <i className="fa-solid fa-history" style={{marginRight:8,color:'#3B82F6'}} />
                Receive History — PO-{receiveLogModal.id}
              </span>
              <button className="modal-close" onClick={()=>setReceiveLogModal(null)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="modal-body">
              {receiveLog.length === 0 ? (
                <div style={{textAlign:'center',padding:32,color:'#78716C'}}>No goods received yet for this PO</div>
              ) : (
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead>
                    <tr style={{background:'#FAFAF9',borderBottom:'1px solid #E7E5E4'}}>
                      {['Item','Ordered','Received','Shortage','Cost','Received By','Date'].map(h=>(
                        <th key={h} style={{padding:'8px 12px',fontSize:11,fontWeight:700,color:'#78716C',textAlign:'left'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {receiveLog.map(r=>(
                      <tr key={r.id} style={{borderBottom:'1px solid #F5F5F4'}}>
                        <td style={{padding:'8px 12px',fontWeight:600,fontSize:12}}>{r.item_name}</td>
                        <td style={{padding:'8px 12px',fontSize:12,textAlign:'center'}}>{r.ordered_qty}</td>
                        <td style={{padding:'8px 12px',fontSize:12,fontWeight:700,color:'#10B981',textAlign:'center'}}>{r.received_qty}</td>
                        <td style={{padding:'8px 12px',fontSize:12,color:r.shortage_qty>0?'#EF4444':'#10B981',textAlign:'center',fontWeight:700}}>
                          {r.shortage_qty > 0 ? `−${r.shortage_qty}` : '✓'}
                        </td>
                        <td style={{padding:'8px 12px',fontSize:12}}>{fmt(r.total_cost)}</td>
                        <td style={{padding:'8px 12px',fontSize:12,color:'#78716C'}}>{r.received_by_name||'—'}</td>
                        <td style={{padding:'8px 12px',fontSize:11,color:'#78716C'}}>
                          {r.received_at ? new Date(r.received_at).toLocaleString('en-KE') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={()=>setReceiveLogModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Modal */}
      {modal === 'supplier' && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',

          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }} onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={{
            background: 'white',
            borderRadius: 20,
            width: '90%',
            maxWidth: 500,
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '18px 20px',
              borderBottom: '1px solid #E7E5E4',
            }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#1C1917', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fa-solid fa-truck" style={{ color: '#F59E0B' }} />
                {editSupplier ? 'Edit Supplier' : 'New Supplier'}
              </span>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', color: '#78716C', fontSize: 20, cursor: 'pointer' }}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#78716C', marginBottom: 6 }}>Company Name *</label>
                <input 
                  value={sForm.name} 
                  onChange={e => setSForm({...sForm, name: e.target.value})}
                  style={{ width: '100%', padding: '10px 12px', background: '#FAFAF9', border: '1px solid #E7E5E4', borderRadius: 8, color: '#1C1917' }}
                  placeholder="e.g. Tusker Distributors"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#78716C', marginBottom: 6 }}>Contact Person</label>
                  <input 
                    value={sForm.contact_person} 
                    onChange={e => setSForm({...sForm, contact_person: e.target.value})}
                    style={{ width: '100%', padding: '10px 12px', background: '#FAFAF9', border: '1px solid #E7E5E4', borderRadius: 8, color: '#1C1917' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#78716C', marginBottom: 6 }}>Phone</label>
                  <input 
                    value={sForm.phone} 
                    onChange={e => setSForm({...sForm, phone: e.target.value})}
                    style={{ width: '100%', padding: '10px 12px', background: '#FAFAF9', border: '1px solid #E7E5E4', borderRadius: 8, color: '#1C1917' }}
                    placeholder="07XX XXX XXX"
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#78716C', marginBottom: 6 }}>Email</label>
                  <input 
                    type="email" 
                    value={sForm.email} 
                    onChange={e => setSForm({...sForm, email: e.target.value})}
                    style={{ width: '100%', padding: '10px 12px', background: '#FAFAF9', border: '1px solid #E7E5E4', borderRadius: 8, color: '#1C1917' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#78716C', marginBottom: 6 }}>Payment Terms</label>
                  <select 
                    value={sForm.payment_terms} 
                    onChange={e => setSForm({...sForm, payment_terms: e.target.value})}
                    style={{ width: '100%', padding: '10px 12px', background: '#FAFAF9', border: '1px solid #E7E5E4', borderRadius: 8, color: '#1C1917' }}
                  >
                    {['COD', 'Net 7', 'Net 14', 'Net 30', 'Net 60', 'Prepaid'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#78716C', marginBottom: 6 }}>Address</label>
                <textarea 
                  rows={2} 
                  value={sForm.address} 
                  onChange={e => setSForm({...sForm, address: e.target.value})}
                  style={{ width: '100%', padding: '10px 12px', background: '#FAFAF9', border: '1px solid #E7E5E4', borderRadius: 8, color: '#1C1917' }}
                  placeholder="Physical address"
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 20px', borderTop: '1px solid #E7E5E4' }}>
              <button onClick={() => setModal(null)} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #E7E5E4', borderRadius: 8, color: '#78716C', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={saveSupplier} disabled={saving || !sForm.name} style={{ padding: '8px 20px', background: '#F59E0B', border: 'none', borderRadius: 8, color: '#1C1917', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : 'Save Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PO Modal */}
      {modal === 'po' && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }} onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={{
            background: 'white',
            borderRadius: 20,
            width: '90%',
            maxWidth: 700,
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '18px 20px',
              borderBottom: '1px solid #E7E5E4',
            }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#1C1917', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fa-solid fa-file-invoice" style={{ color: '#F59E0B' }} />
                New Purchase Order
              </span>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', color: '#78716C', fontSize: 20, cursor: 'pointer' }}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#78716C', marginBottom: 6 }}>Supplier *</label>
                  <select 
                    value={poForm.supplier_id} 
                    onChange={e => setPoForm({...poForm, supplier_id: e.target.value})}
                    style={{ width: '100%', padding: '10px 12px', background: '#FAFAF9', border: '1px solid #E7E5E4', borderRadius: 8, color: '#1C1917' }}
                  >
                    <option value="">— Select Supplier —</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#78716C', marginBottom: 6 }}>Expected Delivery Date</label>
                  <input 
                    type="date" 
                    value={poForm.expected_date} 
                    onChange={e => setPoForm({...poForm, expected_date: e.target.value})}
                    style={{ width: '100%', padding: '10px 12px', background: '#FAFAF9', border: '1px solid #E7E5E4', borderRadius: 8, color: '#1C1917' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#78716C' }}>Order Items</label>
                  <button onClick={addPoItem} style={{ padding: '5px 12px', background: '#FAFAF9', border: '1px solid #E7E5E4', borderRadius: 6, color: '#78716C', fontSize: 11, cursor: 'pointer' }}>
                    <i className="fa-solid fa-plus" /> Add Row
                  </button>
                </div>
                {poForm.items.map((item, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 32px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <select 
                      value={item.inventory_id} 
                      onChange={e => updatePoItem(i, 'inventory_id', e.target.value)}
                      style={{ padding: '8px 10px', background: '#FAFAF9', border: '1px solid #E7E5E4', borderRadius: 6, color: '#1C1917', fontSize: 12 }}
                    >
                      <option value="">— Select Item —</option>
                      {inventory.map(inv => <option key={inv.id} value={inv.id}>{inv.name} ({inv.unit})</option>)}
                    </select>
                    <input 
                      type="number" 
                      placeholder="Qty" 
                      value={item.quantity} 
                      onChange={e => updatePoItem(i, 'quantity', e.target.value)}
                      style={{ padding: '8px 10px', background: '#FAFAF9', border: '1px solid #E7E5E4', borderRadius: 6, color: '#1C1917', fontSize: 12 }}
                      min={1}
                    />
                    <input 
                      type="number" 
                      placeholder="Unit Price" 
                      value={item.unit_price} 
                      onChange={e => updatePoItem(i, 'unit_price', e.target.value)}
                      style={{ padding: '8px 10px', background: '#FAFAF9', border: '1px solid #E7E5E4', borderRadius: 6, color: '#1C1917', fontSize: 12 }}
                      min={0}
                    />
                    <button 
                      onClick={() => removePoItem(i)} 
                      disabled={poForm.items.length === 1}
                      style={{ background: '#FEE2E2', border: 'none', borderRadius: 6, padding: '8px', color: '#EF4444', cursor: 'pointer' }}
                    >
                      <i className="fa-solid fa-trash" style={{ fontSize: 12 }} />
                    </button>
                  </div>
                ))}
                <div style={{ textAlign: 'right', marginTop: 12, paddingTop: 10, borderTop: '1px solid #E7E5E4' }}>
                  <span style={{ fontSize: 13, color: '#78716C' }}>Total: </span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#F59E0B' }}>{fmt(poTotal)}</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#78716C', marginBottom: 6 }}>Notes</label>
                <textarea 
                  rows={2} 
                  value={poForm.notes} 
                  onChange={e => setPoForm({...poForm, notes: e.target.value})}
                  style={{ width: '100%', padding: '10px 12px', background: '#FAFAF9', border: '1px solid #E7E5E4', borderRadius: 8, color: '#1C1917' }}
                  placeholder="Special instructions, delivery notes..."
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 20px', borderTop: '1px solid #E7E5E4' }}>
              <button onClick={() => setModal(null)} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #E7E5E4', borderRadius: 8, color: '#78716C', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={savePO} disabled={saving} style={{ padding: '8px 20px', background: '#F59E0B', border: 'none', borderRadius: 8, color: '#1C1917', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Submitting...' : 'Submit PO'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}