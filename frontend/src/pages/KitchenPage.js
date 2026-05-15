import React, { useState, useEffect, useCallback } from 'react';
import api from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';

function elapsed(t) {
  const mins = Math.floor((Date.now() - new Date(t)) / 60000);
  return mins;
}

export default function KitchenPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const role = user?.role;
  const isBarAttendant = role === 'bar_attendant';
  const isKitchen = role === 'kitchen';

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/orders/kitchen');
      // Filter orders: bar attendant only sees bar orders (items from bar department)
      let filteredData = data;
      if (isBarAttendant) {
        filteredData = data.filter(order => order.department === 'bar');
      }
      setOrders(filteredData);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [isBarAttendant]);

  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);
  useEffect(() => { const t = setInterval(() => setTick(p => p+1), 30000); return () => clearInterval(t); }, []);

  const updateStatus = async (orderId, itemId, status) => {
    try {
      await api.put(`/orders/${orderId}/kitchen-status`, { item_id: itemId, status });
      load();
    } catch(e) { alert('Error: ' + e.message); }
  };

  const grouped = {};
  orders.forEach(item => {
    const key = item.order_id;
    if (!grouped[key]) grouped[key] = { ...item, items: [] };
    grouped[key].items.push(item);
  });

  const filteredOrders = Object.values(grouped).filter(o => {
    if (filter === 'all') return true;
    return o.items.some(i => i.kitchen_status === filter);
  });

  const getTitle = () => {
    if (isBarAttendant) return 'Bar Display';
    if (isKitchen) return 'Kitchen Display';
    return 'Kitchen & Bar Display';
  };

  if (loading) return <div className="loading"><div className="spinner"/><p>Loading display...</p></div>;

  return (
    <div>
      <div className="page-header">
        <h2><i className="fa-solid fa-fire-burner" style={{marginRight:8,color:'#F59E0B'}} />{getTitle()}</h2>
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          {['pending','preparing','done','all'].map(f => (
            <button key={f} className={`btn btn-sm ${filter===f?'btn-secondary':'btn-outline'}`} onClick={()=>setFilter(f)}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase()+f.slice(1)}
            </button>
          ))}
          <button className="btn btn-sm btn-outline" onClick={load}><i className="fa-solid fa-rotate" /></button>
        </div>
      </div>

      {filteredOrders.length === 0 && (
        <div className="empty-state" style={{marginTop:60}}>
          <i className="fa-solid fa-check-circle" style={{color:'#10B981'}} />
          <p>No {filter !== 'all' ? filter : ''} orders right now</p>
        </div>
      )}

      <div className="kitchen-layout">
        {filteredOrders.map(order => {
          const mins = elapsed(order.sent_at || order.created_at);
          const urgency = mins > 20 ? 'urgent' : mins > 10 ? 'warning' : 'ok';
          const allDone = order.items.every(i => i.kitchen_status === 'done');
          const anyPreparing = order.items.some(i => i.kitchen_status === 'preparing');

          return (
            <div key={order.order_id} className="kot-card">
              <div className={`kot-header ${allDone?'done':anyPreparing?'preparing':'pending'}`}>
                <div>
                  <span style={{fontFamily:'Poppins',fontWeight:800,fontSize:18}}>
                    {order.table_number ? `Table ${order.table_number}` : 'Order'}
                  </span>
                  <div style={{fontSize:11,opacity:0.7}}>{order.waiter_name}</div>
                  {isBarAttendant && order.department === 'bar' && (
                    <span className="badge badge-purple" style={{marginTop:4, fontSize:10}}>🍸 Bar Order</span>
                  )}
                </div>
                <div style={{textAlign:'right'}}>
                  <div className={`elapsed ${urgency}`}>{mins}m ago</div>
                  {allDone && <span className="badge badge-green" style={{marginTop:4}}>✅ Done</span>}
                </div>
              </div>

              {order.items.map(item => (
                <div key={item.item_id} className="kot-item">
                  <div style={{flex:1}}>
                    <span style={{fontWeight:700,marginRight:6}}>×{item.quantity}</span>
                    {item.item_name}
                    {item.notes && <div style={{fontSize:11,color:'#78716C',fontStyle:'italic'}}>📝 {item.notes}</div>}
                  </div>
                  <div style={{display:'flex',gap:6,alignItems:'center'}}>
                    {item.kitchen_status === 'pending' && (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => updateStatus(order.order_id, item.id, 'preparing')}
                      >
                        <i className="fa-solid fa-fire" /> Start
                      </button>
                    )}
                    {item.kitchen_status === 'preparing' && (
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => updateStatus(order.order_id, item.id, 'done')}
                      >
                        <i className="fa-solid fa-check" /> Done
                      </button>
                    )}
                    {item.kitchen_status === 'done' && (
                      <span className="badge badge-green"><i className="fa-solid fa-check" /> Ready</span>
                    )}
                  </div>
                </div>
              ))}

              {!allDone && (
                <div style={{padding:'8px 16px',borderTop:'1px solid #F5F5F4'}}>
                  <button
                    className="btn btn-sm btn-success btn-full"
                    onClick={() => order.items.forEach(i => {
                      if (i.kitchen_status !== 'done') updateStatus(order.order_id, i.id, 'done');
                    })}
                  >
                    <i className="fa-solid fa-check-double" /> Mark All Done
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}