import React, { useState, useEffect, useCallback } from 'react';
import api from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';

function fmt(n) { return `KES ${Number(n||0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`; }
function fmtDt(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

const STATUS_BADGE = {
  active:    { cls: 'badge-blue',   label: 'Active'    },
  sent:      { cls: 'badge-amber',  label: 'Sent'      },
  paid:      { cls: 'badge-green',  label: 'Paid'      },
  cancelled: { cls: 'badge-red',    label: 'Cancelled' },
};

export default function OrderHistoryPage() {
  const { user } = useAuth();
  const isAdmin = ['admin','management','cashier'].includes(user?.role);

  const today = new Date().toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];

  const [from, setFrom]       = useState(monthAgo);
  const [to, setTo]           = useState(today);
  const [orders, setOrders]   = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId]     = useState(null);
  const [orderItems, setOrderItems]     = useState({});
  const limit = 30;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to, page, limit });
      const { data } = await api.get('/orders/my-history?' + params.toString());
      setOrders(data.orders || []);
      setTotal(data.total || 0);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [from, to, page]);

  useEffect(() => { load(); }, [load]);

  const loadItems = async (orderId) => {
    if (orderItems[orderId]) { setExpandedId(expandedId === orderId ? null : orderId); return; }
    try {
      const { data } = await api.get('/orders/table/0'); // fallback; real implementation below
      // Fetch order items via bills or direct
      const billRes = await api.get('/bills?order_id=' + orderId).catch(() => ({ data: [] }));
      setOrderItems(prev => ({ ...prev, [orderId]: billRes.data || [] }));
    } catch {}
    setExpandedId(expandedId === orderId ? null : orderId);
  };

  const filtered = orders.filter(o => {
    const matchSearch = !search ||
      String(o.table_number).includes(search) ||
      (o.waiter_name || '').toLowerCase().includes(search.toLowerCase()) ||
      String(o.id).includes(search);
    const matchStatus = !statusFilter || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.ceil(total / limit);
  const grandTotal = filtered.reduce((s, o) => s + (o.total_amount || 0), 0);

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="fa-solid fa-history" style={{ marginRight: 8, color: '#F59E0B' }} />
          {isAdmin ? 'Order History' : 'My Order History'}
        </h2>
      </div>

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Orders',  value: total,          icon: 'fa-receipt',      color: '#3B82F6' },
          { label: 'Showing',       value: filtered.length, icon: 'fa-list',         color: '#8B5CF6' },
          { label: 'Page Value',    value: fmt(grandTotal), icon: 'fa-money-bill',   color: '#10B981' },
        ].map(c => (
          <div key={c.label} style={{ background: 'white', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <i className={'fa-solid ' + c.icon} style={{ color: c.color, fontSize: 14 }} />
              <span style={{ fontSize: 11, color: '#78716C' }}>{c.label}</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1C1917' }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: 12, color: '#78716C', display: 'block', marginBottom: 4 }}>From</label>
          <input type="date" className="form-input" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} style={{ width: 160 }} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#78716C', display: 'block', marginBottom: 4 }}>To</label>
          <input type="date" className="form-input" value={to} onChange={e => { setTo(e.target.value); setPage(1); }} style={{ width: 160 }} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#78716C', display: 'block', marginBottom: 4 }}>Status</label>
          <select className="form-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 140 }}>
            <option value="">All Statuses</option>
            <option value="paid">Paid</option>
            <option value="active">Active</option>
            <option value="sent">Sent</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#78716C', display: 'block', marginBottom: 4 }}>Search</label>
          <input className="form-input" placeholder="Table, waiter, order #…" value={search}
            onChange={e => setSearch(e.target.value)} style={{ width: 200 }} />
        </div>
        <button className="btn btn-outline btn-sm" onClick={load}><i className="fa-solid fa-rotate" /> Refresh</button>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner"/></div>
      ) : (
        <>
          <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#F5F5F4' }}>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: '#78716C', fontWeight: 600 }}>Order #</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: '#78716C', fontWeight: 600 }}>Date & Time</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: '#78716C', fontWeight: 600 }}>Table</th>
                  {isAdmin && <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: '#78716C', fontWeight: 600 }}>Waiter</th>}
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: '#78716C', fontWeight: 600 }}>Type</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, color: '#78716C', fontWeight: 600 }}>Items</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, color: '#78716C', fontWeight: 600 }}>Amount</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: '#78716C', fontWeight: 600 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 8 : 7} style={{ padding: 48, textAlign: 'center', color: '#A8A29E' }}>
                      <i className="fa-solid fa-history" style={{ fontSize: 36, display: 'block', marginBottom: 8, opacity: 0.3 }} />
                      No orders found for this period
                    </td>
                  </tr>
                ) : filtered.map(o => {
                  const sb = STATUS_BADGE[o.status] || { cls: 'badge-blue', label: o.status };
                  return (
                    <tr key={o.id} style={{ borderBottom: '1px solid #F5F5F4', cursor: 'pointer' }}
                      onClick={() => setExpandedId(expandedId === o.id ? null : o.id)}>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#F59E0B' }}>#{o.id}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13 }}>{fmtDt(o.created_at)}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13 }}>
                        {o.table_number ? 'Table ' + o.table_number : <span style={{ color: '#A8A29E' }}>—</span>}
                      </td>
                      {isAdmin && <td style={{ padding: '12px 16px', fontSize: 13 }}>{o.waiter_name || '—'}</td>}
                      <td style={{ padding: '12px 16px', fontSize: 13, textTransform: 'capitalize' }}>
                        {(o.order_type || 'dine_in').replace('_', ' ')}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13 }}>{o.item_count}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>{fmt(o.total_amount)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span className={'badge ' + sb.cls}>{sb.label}</span>
                        <i className={'fa-solid ' + (expandedId === o.id ? 'fa-chevron-up' : 'fa-chevron-down')}
                          style={{ marginLeft: 8, fontSize: 10, color: '#A8A29E' }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
              <button className="btn btn-sm btn-outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                <i className="fa-solid fa-chevron-left" /> Prev
              </button>
              <span style={{ padding: '6px 12px', fontSize: 13, color: '#78716C' }}>
                Page {page} of {totalPages}
              </span>
              <button className="btn btn-sm btn-outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                Next <i className="fa-solid fa-chevron-right" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
