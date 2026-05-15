import React, { useState, useEffect, useCallback } from 'react';
import api from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';

// Use absolute path for logo
const logoSrc = '/logo.jpeg';

function fmt(n) { return `KES ${Number(n||0).toLocaleString()}`; }

function isHappyHour() {
  const now = new Date();
  const h = now.getHours(), m = now.getMinutes();
  const t = h * 60 + m;
  return t >= 17 * 60 && t <= 19 * 60;
}

export default function OrderPage({ table, onBack }) {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [existingOrder, setExistingOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [noteItem, setNoteItem] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [splitMode, setSplitMode] = useState(false);
  const [splitGuests, setSplitGuests] = useState(2);
  const [splitItems, setSplitItems] = useState([]);
  const [splitting, setSplitting] = useState(false);

  // Customer lookup
  const [customerPhone, setCustomerPhone] = useState('');
  const [customer, setCustomer]           = useState(null);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [customerError, setCustomerError] = useState('');
  
  const happyHour = isHappyHour();

  const lookupCustomer = async () => {
    if (!customerPhone.trim()) return;
    setCustomerSearching(true); setCustomerError(''); setCustomer(null);
    try {
      const { data } = await api.get('/customers/lookup', { params:{ phone: customerPhone.trim() } });
      setCustomer(data);
    } catch(e) {
      if (e.response?.status === 404) setCustomerError('Customer not found — you can add them in the Customers page');
      else setCustomerError('Lookup failed');
    }
    setCustomerSearching(false);
  };

  const load = useCallback(async () => {
    try {
      const [catRes, menuRes] = await Promise.all([api.get('/menu/categories'), api.get('/menu/items')]);
      setCategories(catRes.data);
      setMenuItems(menuRes.data);
      if (catRes.data.length) setActiveCategory(catRes.data[0].id);

      if (table) {
        try {
          const orderRes = await api.get(`/orders/table/${table.id}`);
          if (orderRes.data && orderRes.data.items) {
            setExistingOrder(orderRes.data);
            
            const itemsMap = new Map();
            
            orderRes.data.items.forEach(i => {
              const key = i.menu_item_id;
              if (itemsMap.has(key)) {
                const existing = itemsMap.get(key);
                existing.qty += i.quantity;
                if (i.notes && !existing.note) existing.note = i.notes;
                if (i.notes && existing.note && existing.note !== i.notes) {
                  existing.note = existing.note + ' | ' + i.notes;
                }
              } else {
                itemsMap.set(key, {
                  id: i.menu_item_id,
                  name: i.item_name,
                  price: i.unit_price,
                  qty: i.quantity,
                  note: i.notes || '',
                  orderItemId: i.id,
                  sent: !!i.sent_at,
                  image_emoji: i.image_emoji,
                });
              }
            });
            
            const loaded = Array.from(itemsMap.values());
            setOrderItems(loaded);
          }
        } catch(err) { 
          console.log('No existing order:', err);
        }
      }
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [table]);

  useEffect(() => { load(); }, [load]);

  const addItem = (item) => {
    const price = happyHour && item.happy_hour_price ? item.happy_hour_price : item.price;
    setOrderItems(prev => {
      const existingIndex = prev.findIndex(i => i.id === item.id && !i.sent);
      
      if (existingIndex !== -1) {
        const newItems = [...prev];
        newItems[existingIndex] = {
          ...newItems[existingIndex],
          qty: newItems[existingIndex].qty + 1
        };
        return newItems;
      } else {
        const existingSentIndex = prev.findIndex(i => i.id === item.id && i.sent);
        
        if (existingSentIndex !== -1) {
          return [...prev, { 
            id: item.id, 
            name: item.name, 
            price, 
            qty: 1, 
            note: '', 
            sent: false, 
            image_emoji: item.image_emoji 
          }];
        }
        
        return [...prev, { 
          id: item.id, 
          name: item.name, 
          price, 
          qty: 1, 
          note: '', 
          sent: false, 
          image_emoji: item.image_emoji 
        }];
      }
    });
  };

  const changeQty = (id, delta, sent) => {
    if (sent) return;
    setOrderItems(prev =>
      prev.map(i => i.id === id && !i.sent
        ? { ...i, qty: Math.max(0, i.qty + delta) }
        : i
      ).filter(i => i.qty > 0)
    );
  };

  const removeItem = (id) => setOrderItems(prev => prev.filter(i => !(i.id === id && !i.sent)));

  const subtotal = orderItems.reduce((s, i) => s + i.price * i.qty, 0);
  const unsent = orderItems.filter(i => !i.sent);
  const sent = orderItems.filter(i => i.sent);

  const sendOrder = async () => {
    if (!unsent.length) return;
    setSending(true);
    try {
      const combinedItemsMap = new Map();
      unsent.forEach(item => {
        if (combinedItemsMap.has(item.id)) {
          const existing = combinedItemsMap.get(item.id);
          existing.quantity += item.qty;
        } else {
          combinedItemsMap.set(item.id, {
            menu_item_id: item.id,
            quantity: item.qty,
            unit_price: item.price,
            notes: item.note
          });
        }
      });
      
      const combinedItems = Array.from(combinedItemsMap.values());
      
      const payload = {
        table_id: table.id,
        waiter_id: user.id,
        items: combinedItems,
      };
      
      if (existingOrder) {
        await api.put(`/orders/${existingOrder.id}`, payload);
        await api.post(`/orders/${existingOrder.id}/send`, {});
        try {
          await api.post('/bills/refresh', { order_id: existingOrder.id, table_id: table.id });
        } catch(e) { console.log('Bill refresh error:', e); }
      } else {
        const { data } = await api.post('/orders', payload);
        await api.post(`/orders/${data.id}/send`, {});
        setExistingOrder(data);
      }
      
      setOrderItems(prev => prev.map(i => ({ ...i, sent: true })));
      alert(`Order sent to kitchen! ${unsent.length} item(s) sent.`);
    } catch(e) { 
      alert('Error: ' + (e.response?.data?.error || e.message)); 
    }
    finally { setSending(false); }
  };

  const requestBill = async () => {
    if (!existingOrder) return alert('No order sent yet');
    try {
      await api.post('/bills', { order_id: existingOrder.id, table_id: table.id });
      alert('Bill request sent to cashier!');
    } catch(e) { alert('Error: ' + e.response?.data?.error); }
  };

  const openSplitModal = () => {
    if (orderItems.length === 0) {
      alert('No items to split');
      return;
    }
    const initialSplitItems = orderItems.filter(i => !i.sent).map(item => {
      const perGuest = Math.floor(item.qty / splitGuests);
      const remainder = item.qty % splitGuests;
      const guestQtys = Array(splitGuests).fill(perGuest);
      for (let i = 0; i < remainder; i++) guestQtys[i]++;
      return {
        ...item,
        guestQtys: guestQtys,
        totalQty: item.qty
      };
    });
    setSplitItems(initialSplitItems);
    setSplitMode(true);
  };

  const confirmSplit = async () => {
    setSplitting(true);
    try {
      for (let guest = 0; guest < splitGuests; guest++) {
        const guestItems = [];
        for (const item of splitItems) {
          const qtyForGuest = item.guestQtys[guest];
          if (qtyForGuest > 0) {
            guestItems.push({
              menu_item_id: item.id,
              quantity: qtyForGuest,
              unit_price: item.price,
              notes: item.note
            });
          }
        }
        
        if (guestItems.length > 0) {
          const { data } = await api.post('/orders', {
            table_id: table.id,
            waiter_id: user.id,
            items: guestItems,
            notes: `Guest ${guest + 1} of ${splitGuests}`
          });
          await api.post(`/orders/${data.id}/send`, {});
        }
      }
      
      alert(`Bill split into ${splitGuests} parts successfully!`);
      setSplitMode(false);
      onBack();
    } catch(e) {
      alert('Error splitting bill: ' + (e.response?.data?.error || e.message));
    } finally {
      setSplitting(false);
    }
  };

  const updateSplitItemQty = (index, guestIndex, delta) => {
    setSplitItems(prev => {
      const newItems = [...prev];
      const item = { ...newItems[index] };
      const guestQtys = [...(item.guestQtys || Array(splitGuests).fill(0))];
      const newQty = Math.max(0, guestQtys[guestIndex] + delta);
      guestQtys[guestIndex] = newQty;
      item.guestQtys = guestQtys;
      item.totalQty = guestQtys.reduce((a, b) => a + b, 0);
      newItems[index] = item;
      return newItems;
    });
  };

  const printKOT = () => {
    const kotNo = `KOT-${Date.now().toString().slice(-6)}`;
    const logoHTML = logoSrc ? `<img src="${logoSrc}" style="width:50px;height:50px;border-radius:50%;object-fit:cover;border:2px solid #F59E0B;margin-bottom:4px" alt="logo"/>` : '<div style="font-size:30px">🍹</div>';
    const win = window.open('', '_blank', 'width=380,height=650,toolbar=0,menubar=0');
    if (win) {
      win.document.write(`<!DOCTYPE html><html><head><title>KOT ${kotNo}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Courier New',monospace;font-size:12px;padding:10px;background:white;color:#111}
        .header{text-align:center;border-bottom:2px dashed #888;padding-bottom:10px;margin-bottom:10px}
        .kot-label{background:#111;color:white;font-size:10px;font-weight:900;letter-spacing:2px;padding:4px 14px;border-radius:20px;display:inline-block;margin-bottom:6px}
        h2{font-size:16px;font-weight:900;font-family:Georgia,serif;margin:4px 0 2px}
        .meta{font-size:11px;color:#333;margin:3px 0}
        .priority{background:#FF4444;color:white;padding:2px 10px;border-radius:4px;font-size:10px;font-weight:900;display:inline-block;margin:6px 0}
        table{width:100%;border-collapse:collapse;font-size:12px;margin:8px 0}
        th{text-align:left;border-bottom:1px solid #888;padding:3px 0;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#555}
        td{padding:6px 0;border-bottom:1px dashed #ddd;vertical-align:top}
        td.qty{font-size:16px;font-weight:900;width:30px}
        td.item{font-weight:700}
        td.note{font-size:10px;color:#666;font-style:italic;padding:0 0 6px 30px}
        .footer{text-align:center;border-top:2px dashed #888;padding-top:8px;margin-top:10px;font-size:10px;color:#666}
        .no-print{text-align:center;padding:14px;font-family:sans-serif}
        @media print{.no-print{display:none}@page{margin:0;size:80mm auto}}
      </style></head>
      <body>
        <div class="header">
          ${logoHTML}
          <div class="kot-label">KITCHEN ORDER TICKET</div>
          <h2>SAI LOUNGE</h2>
          <div class="meta"><strong>Table: ${table?.number || '—'}</strong></div>
          <div class="meta">KOT #: ${kotNo}</div>
          <div class="meta">Time: ${new Date().toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</div>
          <div class="meta">Date: ${new Date().toLocaleDateString('en-KE',{day:'2-digit',month:'short',year:'numeric'})}</div>
          <div class="meta">Waiter: <strong>${user?.name || '—'}</strong></div>
          <div class="priority">⚡ NEW ORDER — PLEASE PREPARE</div>
        </div>
        <table>
          <thead><tr><th>Qty</th><th>Item</th></tr></thead>
          <tbody>
            ${unsent.map(i=>`
              <tr>
                <td class="qty">${i.qty}×</td>
                <td class="item">${i.name}</td>
              </tr>
              ${i.note?`<tr><td class="note" colspan="2">📝 ${i.note}</td></tr>`:''}
            `).join('')}
          </tbody>
        </table>
        <div class="footer">*** END OF KOT *** <br>${kotNo}</div>
        <div class="no-print">
          <button onclick="window.print()" style="background:#F59E0B;color:#1C1917;border:none;padding:10px 24px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;margin-right:8px">🖨️ Print KOT</button>
          <button onclick="window.close()" style="background:#f5f5f4;border:1px solid #ddd;padding:10px 16px;border-radius:8px;font-size:13px;cursor:pointer">Close</button>
        </div>
      </body></html>`);
      win.document.close();
      setTimeout(() => win.print(), 400);
    }
  };

  const printBill = () => {
    const logoHTML = logoSrc ? `<img src="${logoSrc}" style="width:60px;height:60px;border-radius:50%;object-fit:cover;border:2px solid #F59E0B;margin-bottom:6px" alt="logo"/>` : '<div style="font-size:32px">🍹</div>';
    const win = window.open('', '_blank', 'width=380,height=700,toolbar=0,menubar=0');
    if (win) {
      win.document.write(`<!DOCTYPE html><html><head><title>Draft Bill</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Courier New',monospace;font-size:12px;padding:10px;background:white;color:#111}
        .header{text-align:center;border-bottom:2px dashed #888;padding-bottom:10px;margin-bottom:10px}
        h2{font-size:18px;font-weight:900;font-family:Georgia,serif;color:#1a1a1a}
        h2 span{color:#D97706}
        .draft-badge{background:#FEF3C7;border:1.5px solid #F59E0B;color:#92400E;padding:3px 14px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:1px;display:inline-block;margin:6px 0}
        .meta{font-size:11px;color:#555;margin:2px 0}
        table{width:100%;border-collapse:collapse;margin:10px 0;font-size:12px}
        th{text-align:left;padding:4px 0;font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #ddd}
        td{padding:5px 0;border-bottom:1px dashed #eee}
        .total-row td{font-weight:900;font-size:14px;padding-top:8px;border-top:2px solid #111;border-bottom:none;color:#D97706}
        .footer{text-align:center;border-top:2px dashed #888;padding-top:8px;margin-top:10px;font-size:10px;color:#666;line-height:1.8}
        .no-print{text-align:center;padding:14px;font-family:sans-serif}
        @media print{.no-print{display:none}@page{margin:0;size:80mm auto}}
      </style></head>
      <body>
        <div class="header">
          ${logoHTML}
          <h2>Sai <span>Lounge</span></h2>
          <div class="draft-badge">📋 DRAFT BILL — NOT FINAL</div>
          <div class="meta">Table: <strong>${table?.number || '—'}</strong></div>
          <div class="meta">Waiter: <strong>${user?.name || '—'}</strong></div>
          <div class="meta">${new Date().toLocaleString('en-KE',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:true})}</div>
        </div>
        <table>
          <thead><tr><th>Item</th><th style="text-align:right">KES</th></tr></thead>
          <tbody>
            ${orderItems.map(i=>`<tr><td style="padding:5px 0">${i.qty}× ${i.name}</td><td style="text-align:right">${(i.price*i.qty).toLocaleString('en-KE',{minimumFractionDigits:2})}</td></tr>`).join('')}
          </tbody>
          <tfoot>
            <tr class="total-row"><td>TOTAL</td><td style="text-align:right">KES ${subtotal.toLocaleString('en-KE',{minimumFractionDigits:2})}</td></tr>
          </tfoot>
        </table>
        <div class="footer">
          This is a draft bill — final receipt issued at payment.<br>
          Thank you for visiting Sai Lounge!
        </div>
        <div class="no-print">
          <button onclick="window.print()" style="background:#F59E0B;color:#1C1917;border:none;padding:10px 24px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;margin-right:8px">🖨️ Print Draft</button>
          <button onclick="window.close()" style="background:#f5f5f4;border:1px solid #ddd;padding:10px 16px;border-radius:8px;font-size:13px;cursor:pointer">Close</button>
        </div>
      </body></html>`);
      win.document.close();
      setTimeout(() => win.print(), 400);
    }
  };

  const filteredMenu = menuItems.filter(m => {
    const inCat = activeCategory ? m.category_id === activeCategory : true;
    return inCat;
  });

  if (loading) return <div className="loading"><div className="spinner"/><p>Loading menu...</p></div>;

  // Rest of your JSX remains the same...
  return (
    <div>
      <div style={{
        background: '#1a1a1a',
        borderRadius: '12px',
        marginBottom: '20px',
        padding: '12px 20px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '12px',
          paddingBottom: '10px',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button 
              onClick={onBack}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: 'white',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <i className="fa-solid fa-arrow-left" /> Tables
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-utensils" style={{ color: '#F59E0B', fontSize: '16px' }} />
                <span style={{ color: 'white', fontWeight: 600, fontSize: '14px' }}>
                  Table {table?.number || '—'}
                </span>
                <span style={{ color: '#78716C', fontSize: '11px' }}>
                  {orderItems.length} items
                </span>
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ 
              background: 'rgba(255,255,255,0.1)', 
              padding: '4px 10px', 
              borderRadius: '20px',
              fontSize: '11px',
              color: '#F59E0B'
            }}>
              <i className="fa-solid fa-user" style={{ marginRight: '4px' }} />
              {user?.name?.split(' ')[0] || 'Waiter'}
            </div>
            {happyHour && (
              <div style={{ 
                background: '#8B5CF6', 
                padding: '4px 10px', 
                borderRadius: '20px',
                fontSize: '11px',
                color: 'white'
              }}>
                <i className="fa-solid fa-star" style={{ marginRight: '4px' }} /> Happy Hour
              </div>
            )}
          </div>
        </div>

        {/* Customer Lookup */}
        <div style={{padding:'8px 12px',borderBottom:'1px solid #E7E5E4',background:'#FAFAF9'}}>
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            <i className="fa-solid fa-user-tag" style={{color:'#D97706',fontSize:14}}/>
            <input
              value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&lookupCustomer()}
              placeholder="Customer phone for loyalty points..."
              style={{flex:1,border:'1px solid #E7E5E4',borderRadius:8,padding:'5px 10px',fontSize:12,outline:'none'}}
            />
            <button onClick={lookupCustomer} disabled={customerSearching}
              style={{background:'#F59E0B',color:'white',border:'none',borderRadius:8,padding:'5px 12px',fontSize:12,fontWeight:700,cursor:'pointer'}}>
              {customerSearching ? '...' : 'Find'}
            </button>
            {customer && (
              <button onClick={()=>{setCustomer(null);setCustomerPhone('');}}
                style={{background:'none',border:'none',cursor:'pointer',color:'#78716C',fontSize:16}}>✕</button>
            )}
          </div>
          {customer && (
            <div style={{marginTop:6,background:'#F0FDF4',border:'1px solid #86EFAC',borderRadius:8,padding:'6px 10px',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12}}>
              <div>
                <span style={{fontWeight:700,color:'#065F46'}}>{customer.name}</span>
                <span style={{color:'#78716C',marginLeft:8}}>
                  {['bronze','silver','gold','platinum'].includes(customer.tier) ? {bronze:'🥉',silver:'🥈',gold:'🥇',platinum:'💎'}[customer.tier] : ''} {customer.tier}
                </span>
              </div>
              <span style={{fontFamily:'Montserrat',fontWeight:800,color:'#D97706'}}>{(customer.loyalty_points||0).toLocaleString()} pts</span>
            </div>
          )}
          {customerError && <div style={{fontSize:11,color:'#EF4444',marginTop:4}}>{customerError}</div>}
        </div>

        <div style={{
          display: 'flex',
          gap: '6px',
          flexWrap: 'wrap',
          overflowX: 'auto',
          paddingBottom: '4px'
        }}>
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              style={{
                padding: '5px 14px',
                borderRadius: '20px',
                border: 'none',
                background: activeCategory === c.id ? '#F59E0B' : 'rgba(255,255,255,0.1)',
                color: activeCategory === c.id ? '#1C1917' : 'rgba(255,255,255,0.7)',
                fontWeight: activeCategory === c.id ? 600 : 500,
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="order-layout">
        <div className="menu-panel">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: '10px'
          }}>
            {filteredMenu.map(item => {
              const displayPrice = happyHour && item.happy_hour_price ? item.happy_hour_price : item.price;
              const inCart = orderItems.find(i => i.id === item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => item.available && addItem(item)}
                  style={{
                    background: 'white',
                    border: `1.5px solid ${inCart ? '#F59E0B' : '#E7E5E4'}`,
                    borderRadius: '10px',
                    padding: '10px',
                    cursor: item.available ? 'pointer' : 'not-allowed',
                    opacity: item.available ? 1 : 0.5,
                    position: 'relative'
                  }}
                >
                  <div style={{
                    height: '80px',
                    background: '#FAFAF9',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '8px'
                  }}>
                    {item.image_url
                      ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
                      : <span style={{ fontSize: '32px' }}>{item.image_emoji || '🍽️'}</span>
                    }
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '4px' }}>{item.name}</div>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: '#D97706' }}>KES {displayPrice.toLocaleString()}</div>
                  {inCart && (
                    <div style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-6px',
                      background: '#F59E0B',
                      color: '#1C1917',
                      borderRadius: '20px',
                      padding: '2px 8px',
                      fontSize: '10px',
                      fontWeight: 700
                    }}>
                      {inCart.qty}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="order-panel" style={{ maxHeight: 'calc(100vh - 120px)', overflow: 'auto' }}>
          <div className="order-header" style={{ padding: '12px 14px' }}>
            <h3 style={{ fontSize: '14px', margin: 0 }}>
              <i className="fa-solid fa-receipt" style={{ marginRight: '6px', color: '#F59E0B' }} />
              Current Order
            </h3>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button className="btn btn-sm btn-outline" onClick={printBill} title="Print Draft Bill" style={{ padding: '4px 8px' }}>
                <i className="fa-solid fa-print" />
              </button>
              <button className="btn btn-sm btn-outline" onClick={printKOT} title="Print KOT" style={{ padding: '4px 8px' }}>
                <i className="fa-solid fa-kitchen-set" />
              </button>
              <button 
                className="btn btn-sm btn-outline" 
                onClick={openSplitModal} 
                title="Split Bill"
                style={{ padding: '4px 8px', color: '#8B5CF6', borderColor: '#8B5CF6' }}
                disabled={orderItems.filter(i => !i.sent).length === 0}
              >
                <i className="fa-solid fa-divide" /> Split
              </button>
            </div>
          </div>

          <div className="order-items" style={{ padding: '8px 12px', maxHeight: 'calc(100vh - 280px)', overflow: 'auto' }}>
            {orderItems.length === 0 && (
              <div className="empty-state" style={{ padding: '30px 16px' }}>
                <i className="fa-solid fa-basket-shopping" style={{ fontSize: '32px', opacity: 0.3 }} />
                <p style={{ fontSize: '12px' }}>Tap items to order</p>
              </div>
            )}

            {sent.length > 0 && (
              <>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#10B981', padding: '6px 0', borderBottom: '1px solid #F5F5F4' }}>
                  ✓ Sent ({sent.length})
                </div>
                {sent.map((item, i) => (
                  <div key={`sent-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 0', borderBottom: '1px solid #F5F5F4', opacity: 0.7 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: 500 }}>{item.name}</div>
                      {item.note && <div style={{ fontSize: '10px', color: '#78716C' }}>{item.note}</div>}
                    </div>
                    <div style={{ fontSize: '12px', color: '#78716C' }}>×{item.qty}</div>
                    <div style={{ fontSize: '12px', fontWeight: 600 }}>{fmt(item.price * item.qty)}</div>
                  </div>
                ))}
              </>
            )}

            {unsent.length > 0 && (
              <>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#D97706', padding: '6px 0', borderBottom: '1px solid #F5F5F4', marginTop: sent.length ? '8px' : 0 }}>
                  🆕 New ({unsent.length})
                </div>
                {unsent.map((item, i) => (
                  <div key={`new-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 0', borderBottom: '1px solid #F5F5F4' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: 500 }}>{item.name}</div>
                      {item.note && <div style={{ fontSize: '10px', color: '#78716C' }}>{item.note}</div>}
                      <button
                        style={{ fontSize: '9px', color: '#78716C', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: '2px' }}
                        onClick={() => { setNoteItem(item); setNoteText(item.note || ''); }}
                      >
                        <i className="fa-solid fa-pen" style={{ marginRight: '2px' }} /> Add note
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button className="qty-btn" onClick={() => changeQty(item.id, -1, false)} style={{ width: '22px', height: '22px' }}>−</button>
                      <span style={{ fontSize: '12px', fontWeight: 600, minWidth: '20px', textAlign: 'center' }}>{item.qty}</span>
                      <button className="qty-btn" onClick={() => changeQty(item.id, 1, false)} style={{ width: '22px', height: '22px' }}>+</button>
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 600, minWidth: '70px', textAlign: 'right' }}>{fmt(item.price * item.qty)}</div>
                    <button
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: '0 2px' }}
                      onClick={() => removeItem(item.id)}
                    >
                      <i className="fa-solid fa-trash" style={{ fontSize: '11px' }} />
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="order-footer" style={{ padding: '10px 12px' }}>
            <div className="order-total" style={{ marginBottom: '8px' }}>
              <span style={{ fontSize: '13px' }}>Total</span>
              <strong style={{ fontSize: '18px' }}>{fmt(subtotal)}</strong>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                className="btn btn-primary"
                onClick={sendOrder}
                disabled={sending || unsent.length === 0}
                style={{ padding: '8px', fontSize: '12px' }}
              >
                {sending
                  ? <><span className="spinner" style={{ width: '12px', height: '12px' }} /> Send</>
                  : <><i className="fa-solid fa-paper-plane" /> Send ({unsent.length})</>}
              </button>
              <button
                className="btn btn-success"
                onClick={requestBill}
                disabled={!existingOrder}
                style={{ padding: '8px', fontSize: '12px' }}
              >
                <i className="fa-solid fa-file-invoice-dollar" /> Bill
              </button>
            </div>
          </div>
        </div>
      </div>

      {splitMode && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSplitMode(false)}>
          <div className="modal modal-lg" style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <span className="modal-title">
                <i className="fa-solid fa-divide" style={{ marginRight: '8px', color: '#8B5CF6' }} />
                Split Bill - {splitGuests} Guests
              </span>
              <button className="modal-close" onClick={() => setSplitMode(false)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <label style={{ fontWeight: 600, fontSize: '13px' }}>Number of Guests:</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[2, 3, 4, 5, 6, 7, 8].map(num => (
                    <button
                      key={num}
                      onClick={() => {
                        setSplitGuests(num);
                        const newSplitItems = splitItems.map(item => {
                          const perGuest = Math.floor(item.totalQty / num);
                          const remainder = item.totalQty % num;
                          const guestQtys = Array(num).fill(perGuest);
                          for (let i = 0; i < remainder; i++) guestQtys[i]++;
                          return { ...item, guestQtys };
                        });
                        setSplitItems(newSplitItems);
                      }}
                      style={{
                        width: '40px',
                        padding: '6px',
                        borderRadius: '8px',
                        border: splitGuests === num ? '2px solid #8B5CF6' : '1px solid #E7E5E4',
                        background: splitGuests === num ? '#EDE9FE' : 'white',
                        fontWeight: splitGuests === num ? 700 : 500,
                        cursor: 'pointer'
                      }}
                    >
                      {num}
                    </button>
                  ))}
                </div>
                <div style={{ marginLeft: 'auto', fontSize: '12px', color: '#78716C' }}>
                  Total: {fmt(splitItems.reduce((s, i) => s + i.price * i.totalQty, 0))}
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th>Item</th>
                      {Array(splitGuests).fill(0).map((_, idx) => (
                        <th key={idx} style={{ textAlign: 'center', minWidth: '70px' }}>Guest {idx + 1}</th>
                      ))}
                      <th style={{ textAlign: 'center' }}>Total</th>
                      <th>Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {splitItems.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{item.name}</td>
                        {item.guestQtys.map((qty, guestIdx) => (
                          <td key={guestIdx} style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                              <button
                                onClick={() => updateSplitItemQty(idx, guestIdx, -1)}
                                style={{ width: '22px', height: '22px', borderRadius: '4px', border: '1px solid #E7E5E4', background: 'white', cursor: 'pointer' }}
                                disabled={qty <= 0}
                              >
                                −
                              </button>
                              <span style={{ minWidth: '24px', textAlign: 'center', fontWeight: 600 }}>{qty}</span>
                              <button
                                onClick={() => updateSplitItemQty(idx, guestIdx, 1)}
                                style={{ width: '22px', height: '22px', borderRadius: '4px', border: '1px solid #E7E5E4', background: 'white', cursor: 'pointer' }}
                              >
                                +
                              </button>
                            </div>
                          </td>
                        ))}
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.totalQty}</td>
                        <td style={{ color: '#D97706', fontWeight: 700 }}>{fmt(item.price * item.totalQty)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setSplitMode(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmSplit} disabled={splitting} style={{ background: '#8B5CF6' }}>
                {splitting ? <><span className="spinner" style={{ width: '14px', height: '14px' }} /> Processing...</> : <><i className="fa-solid fa-check" /> Split into {splitGuests} Bills</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {noteItem && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setNoteItem(null)}>
          <div className="modal" style={{ maxWidth: '380px' }}>
            <div className="modal-header" style={{ padding: '14px 18px' }}>
              <span className="modal-title" style={{ fontSize: '15px' }}>
                <i className="fa-solid fa-pen" style={{ marginRight: '6px', color: '#F59E0B' }} />
                Note for {noteItem.name}
              </span>
              <button className="modal-close" onClick={() => setNoteItem(null)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="modal-body" style={{ padding: '16px 18px' }}>
              <textarea
                className="form-textarea"
                rows={3}
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="e.g. No onions, extra spicy, well done..."
                autoFocus
                style={{ fontSize: '13px' }}
              />
            </div>
            <div className="modal-footer" style={{ padding: '12px 18px' }}>
              <button className="btn btn-outline" onClick={() => setNoteItem(null)} style={{ padding: '6px 14px' }}>Cancel</button>
              <button className="btn btn-primary" onClick={() => {
                setOrderItems(prev => prev.map(i => i.id === noteItem.id && !i.sent ? { ...i, note: noteText } : i));
                setNoteItem(null);
                setNoteText('');
              }} style={{ padding: '6px 14px' }}>
                <i className="fa-solid fa-check" /> Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}