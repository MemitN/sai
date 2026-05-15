import React, { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../hooks/useApi';

function fmt(n) { return `KES ${Number(n||0).toLocaleString()}`; }

const TABS = [
  { id: 'sales', label: 'Sales Report', icon: 'fa-chart-line', color: '#F59E0B' },
  { id: 'department', label: 'By Department', icon: 'fa-sitemap', color: '#10B981' },
  { id: 'stock', label: 'Stock Report', icon: 'fa-boxes-stacked', color: '#3B82F6' },
  { id: 'commission', label: 'Commissions', icon: 'fa-percent', color: '#8B5CF6' },
  { id: 'purchases', label: 'Purchases', icon: 'fa-truck', color: '#EC4899' },
  { id: 'fast-slow', label: 'Item Velocity', icon: 'fa-gauge-high', color: '#06B6D4' },
  { id: 'shifts', label: 'Shifts', icon: 'fa-clock', color: '#F97316' },
];

export default function ReportsPage() {
  const [tab, setTab] = useState('sales');
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => new Date(Date.now()-7*86400000).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [stockDept, setStockDept] = useState('all');
  const [stockPeriod, setStockPeriod] = useState('daily');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      if (tab === 'sales') res = await api.get(`/reports/sales?from=${dateFrom}&to=${dateTo}`);
      else if (tab === 'department') res = await api.get(`/reports/sales?from=${dateFrom}&to=${dateTo}`);
      else if (tab === 'stock') res = await api.get(`/reports/stock?period=${stockPeriod}&dept=${stockDept === 'all' ? '' : stockDept}`);
      else if (tab === 'commission') res = await api.get(`/reports/commissions?from=${dateFrom}&to=${dateTo}`);
      else if (tab === 'purchases') res = await api.get(`/reports/purchases?from=${dateFrom}&to=${dateTo}`);
      else if (tab === 'fast-slow') res = await api.get('/reports/fast-slow');
      else if (tab === 'shifts') res = await api.get('/shifts');
      setData(res?.data || {});
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [tab, dateFrom, dateTo, stockDept, stockPeriod]);

  useEffect(() => { load(); }, [load]);

  const exportCSV = (rows, headers, filename) => {
    if (!rows?.length) return alert('No data to export');
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${r[h] || ''}"`).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv,' + encodeURIComponent(csv);
    a.download = filename + '.csv';
    a.click();
  };

  const getCurrentTabIcon = () => {
    const current = TABS.find(t => t.id === tab);
    return current?.icon || 'fa-chart-line';
  };

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', padding: '20px 24px' }}>
      
      {/* Creative Header - Just Icon and Title */}
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
            background: `linear-gradient(135deg, ${TABS.find(t => t.id === tab)?.color || '#F59E0B'}20, ${TABS.find(t => t.id === tab)?.color || '#F59E0B'}05)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid ${TABS.find(t => t.id === tab)?.color || '#F59E0B'}30`,
          }}>
            <i className={`fa-solid ${getCurrentTabIcon()}`} style={{ fontSize: 22, color: TABS.find(t => t.id === tab)?.color || '#F59E0B' }} />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'white', margin: 0 }}>
            {TABS.find(t => t.id === tab)?.label}
          </h1>
        </div>
        
        {/* Live indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          background: '#1a1a1a',
          borderRadius: 30,
          border: '1px solid #2a2a2a',
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981', animation: 'pulse 2s infinite' }} />
          <span style={{ fontSize: 11, color: '#78716C' }}>Live Data</span>
        </div>
      </div>

      {/* Premium Tabs - Dark */}
      <div style={{ 
        display: 'flex', 
        gap: 4, 
        marginBottom: 20, 
        flexWrap: 'wrap',
        background: '#1a1a1a',
        padding: 6,
        borderRadius: 12,
        border: '1px solid #2a2a2a'
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 10,
              border: 'none',
              background: tab === t.id ? t.color : 'transparent',
              color: tab === t.id ? 'white' : '#78716C',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: tab === t.id ? 600 : 500,
              transition: 'all 0.2s',
            }}
          >
            <i className={`fa-solid ${t.icon}`} style={{ fontSize: 12 }} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Date Range Selector - Dark */}
      {['sales', 'department', 'commission', 'purchases'].includes(tab) && (
        <div style={{ 
          background: '#1a1a1a', 
          borderRadius: 12, 
          padding: '12px 16px', 
          marginBottom: 16,
          border: '1px solid #2a2a2a',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="fa-regular fa-calendar" style={{ color: '#F59E0B', fontSize: 13 }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: '#A8A29E' }}>Period</span>
            </div>
            <input 
              type="date" 
              value={dateFrom} 
              onChange={e => setDateFrom(e.target.value)}
              style={{
                padding: '6px 10px',
                border: '1px solid #333',
                borderRadius: 8,
                fontSize: 12,
                background: '#0a0a0a',
                color: 'white',
              }}
            />
            <span style={{ color: '#78716C', fontSize: 12 }}>→</span>
            <input 
              type="date" 
              value={dateTo} 
              onChange={e => setDateTo(e.target.value)}
              style={{
                padding: '6px 10px',
                border: '1px solid #333',
                borderRadius: 8,
                fontSize: 12,
                background: '#0a0a0a',
                color: 'white',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['today', 'week', 'month'].map(p => (
              <button
                key={p}
                onClick={() => {
                  const now = new Date();
                  if (p === 'today') {
                    setDateFrom(now.toISOString().split('T')[0]);
                    setDateTo(now.toISOString().split('T')[0]);
                  } else if (p === 'week') {
                    setDateFrom(new Date(now - 7 * 86400000).toISOString().split('T')[0]);
                    setDateTo(now.toISOString().split('T')[0]);
                  } else {
                    setDateFrom(new Date(now - 30 * 86400000).toISOString().split('T')[0]);
                    setDateTo(now.toISOString().split('T')[0]);
                  }
                }}
                style={{
                  padding: '4px 12px',
                  borderRadius: 16,
                  border: '1px solid #333',
                  background: '#0a0a0a',
                  color: '#A8A29E',
                  fontSize: 11,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stock Report Filters */}
      {tab === 'stock' && (
        <div style={{ 
          background: '#1a1a1a', 
          borderRadius: 12, 
          padding: '10px 14px', 
          marginBottom: 16,
          border: '1px solid #2a2a2a',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {['daily', 'weekly', 'monthly'].map(p => (
              <button
                key={p}
                onClick={() => setStockPeriod(p)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 16,
                  border: 'none',
                  background: stockPeriod === p ? '#3B82F6' : '#0a0a0a',
                  color: stockPeriod === p ? 'white' : '#78716C',
                  fontSize: 11,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {p}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['all', 'kitchen', 'bar', 'store', 'equipment'].map(d => (
              <button
                key={d}
                onClick={() => setStockDept(d)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 16,
                  border: 'none',
                  background: stockDept === d ? '#F59E0B' : '#0a0a0a',
                  color: stockDept === d ? 'black' : '#78716C',
                  fontSize: 11,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
        </div>
      )}

      {/* Sales Report - Black Theme */}
      {tab === 'sales' && !loading && (
        <div>
          {data.totals && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Total Sales', value: fmt(data.totals.total_sales), icon: 'fa-coins', color: '#F59E0B', change: '+12%' },
                { label: 'Bills', value: data.totals.bill_count, icon: 'fa-receipt', color: '#10B981', change: '+8%' },
                { label: 'Cash', value: fmt(data.totals.cash), icon: 'fa-money-bill', color: '#10B981', change: '-3%' },
                { label: 'M-Pesa', value: fmt(data.totals.mpesa), icon: 'fa-mobile-screen', color: '#8B5CF6', change: '+18%' },
                { label: 'Card', value: fmt(data.totals.card), icon: 'fa-credit-card', color: '#3B82F6', change: '+22%' },
                { label: 'Discounts', value: fmt(data.totals.total_discounts), icon: 'fa-tag', color: '#EF4444', change: '+5%' },
              ].map(s => (
                <div key={s.label} style={{ background: '#1a1a1a', borderRadius: 10, padding: '10px 12px', border: '1px solid #2a2a2a', transition: 'transform 0.2s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className={`fa-solid ${s.icon}`} style={{ fontSize: 14, color: s.color }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 10, color: '#78716C' }}>{s.label}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: s.change.startsWith('+') ? '#10B981' : '#EF4444' }}>
                      {s.change}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ background: '#1a1a1a', borderRadius: 12, padding: '14px 16px', marginBottom: 16, border: '1px solid #2a2a2a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fa-solid fa-chart-line" style={{ color: '#F59E0B', fontSize: 14 }} />
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'white', margin: 0 }}>Revenue Trend</h3>
              </div>
              <button onClick={() => exportCSV(data.sales || [], ['date', 'bill_count', 'total_sales', 'cash', 'mpesa', 'card'], 'sales-report')} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #333', background: '#0a0a0a', color: '#A8A29E', fontSize: 10, cursor: 'pointer' }}>
                <i className="fa-solid fa-download" style={{ marginRight: 4, fontSize: 10 }} /> Export
              </button>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data.sales || []}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#78716C' }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: '#78716C' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={v => fmt(v)} contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, color: 'white' }} />
                <Area type="monotone" dataKey="total_sales" stroke="#F59E0B" strokeWidth={2} fill="url(#salesGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: '#1a1a1a', borderRadius: 12, padding: '14px 16px', border: '1px solid #2a2a2a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <i className="fa-solid fa-table-list" style={{ color: '#10B981', fontSize: 14 }} />
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'white', margin: 0 }}>Daily Breakdown</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                    <th style={{ textAlign: 'left', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Date</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Bills</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Total</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Cash</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>M-Pesa</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Card</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.sales || []).map(r => (
                    <tr key={r.date} style={{ borderBottom: '1px solid #2a2a2a' }}>
                      <td style={{ padding: '8px 6px', fontSize: 12, color: 'white' }}>{r.date}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'right', color: '#A8A29E' }}>{r.bill_count}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600, color: '#F59E0B' }}>{fmt(r.total_sales)}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'right', color: '#A8A29E' }}>{fmt(r.cash)}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'right', color: '#A8A29E' }}>{fmt(r.mpesa)}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'right', color: '#A8A29E' }}>{fmt(r.card)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Department Report - Black Theme */}
      {tab === 'department' && !loading && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ background: '#1a1a1a', borderRadius: 12, padding: '14px 16px', border: '1px solid #2a2a2a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fa-solid fa-chart-pie" style={{ color: '#10B981', fontSize: 14 }} />
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'white', margin: 0 }}>Sales by Category</h3>
              </div>
              <button onClick={() => exportCSV(data.byDepartment || [], ['department', 'category', 'qty', 'revenue'], 'dept-sales')} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #333', background: '#0a0a0a', color: '#A8A29E', fontSize: 10, cursor: 'pointer' }}>
                <i className="fa-solid fa-download" /> Export
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                    <th style={{ textAlign: 'left', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Dept</th>
                    <th style={{ textAlign: 'left', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Category</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Qty</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.byDepartment || []).map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #2a2a2a' }}>
                      <td style={{ padding: '8px 6px' }}>
                        <span style={{ background: r.department === 'bar' ? '#FEF3C720' : '#D1FAE520', padding: '3px 8px', borderRadius: 10, fontSize: 10, color: r.department === 'bar' ? '#F59E0B' : '#10B981' }}>{r.department}</span>
                      </td>
                      <td style={{ padding: '8px 6px', fontSize: 12, color: 'white' }}>{r.category}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'right', color: '#A8A29E' }}>{r.qty}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600, color: '#F59E0B' }}>{fmt(r.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ background: '#1a1a1a', borderRadius: 12, padding: '14px 16px', border: '1px solid #2a2a2a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <i className="fa-solid fa-clipboard-list" style={{ color: '#8B5CF6', fontSize: 14 }} />
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'white', margin: 0 }}>Item Performance</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                    <th style={{ textAlign: 'left', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Item</th>
                    <th style={{ textAlign: 'left', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Category</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Qty</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.itemSales || []).slice(0, 20).map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #2a2a2a' }}>
                      <td style={{ padding: '8px 6px', fontSize: 12, fontWeight: 500, color: 'white' }}>{r.name}</td>
                      <td style={{ padding: '8px 6px', fontSize: 11, color: '#78716C' }}>{r.category}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'right', color: '#A8A29E' }}>{r.qty}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600, color: '#F59E0B' }}>{fmt(r.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Stock Report - Black Theme */}
      {tab === 'stock' && !loading && (
        <div style={{ background: '#1a1a1a', borderRadius: 12, padding: '14px 16px', border: '1px solid #2a2a2a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fa-solid fa-boxes-stacked" style={{ color: '#3B82F6', fontSize: 14 }} />
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'white', margin: 0 }}>Stock Movement</h3>
            </div>
            <button onClick={() => exportCSV(data.movements || [], ['name', 'department', 'unit', 'received', 'used', 'closing_stock'], 'stock-report')} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #333', background: '#0a0a0a', color: '#A8A29E', fontSize: 10, cursor: 'pointer' }}>
              <i className="fa-solid fa-download" /> Export
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                  <th style={{ textAlign: 'left', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Item</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Dept</th>
                  <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>In</th>
                  <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Out</th>
                  <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Balance</th>
                  <th style={{ textAlign: 'center', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {(data.movements || []).map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #2a2a2a' }}>
                    <td style={{ padding: '8px 6px', fontSize: 12, fontWeight: 500, color: 'white' }}>{r.name}</td>
                    <td style={{ padding: '8px 6px' }}>
                      <span style={{ background: r.department === 'bar' ? '#FEF3C720' : '#D1FAE520', padding: '3px 8px', borderRadius: 10, fontSize: 10, color: r.department === 'bar' ? '#F59E0B' : '#10B981' }}>{r.department}</span>
                    </td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', color: '#10B981' }}>{r.received || 0}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', color: '#EF4444' }}>{r.used || 0}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600, color: 'white' }}>{r.closing_stock} {r.unit}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: r.closing_stock <= 0 ? '#EF444420' : r.closing_stock <= 5 ? '#F59E0B20' : '#10B98120', color: r.closing_stock <= 0 ? '#EF4444' : r.closing_stock <= 5 ? '#F59E0B' : '#10B981' }}>
                        {r.closing_stock <= 0 ? 'Out' : r.closing_stock <= 5 ? 'Low' : 'OK'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Commission Report - Black Theme */}
      {tab === 'commission' && !loading && (
        <div style={{ background: '#1a1a1a', borderRadius: 12, padding: '14px 16px', border: '1px solid #2a2a2a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fa-solid fa-percent" style={{ color: '#8B5CF6', fontSize: 14 }} />
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'white', margin: 0 }}>Staff Commissions</h3>
            </div>
            <button onClick={() => exportCSV(data.commissions || [], ['waiter_name', 'orders_served', 'total_sales', 'commission_rate', 'commission'], 'commissions')} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #333', background: '#0a0a0a', color: '#A8A29E', fontSize: 10, cursor: 'pointer' }}>
              <i className="fa-solid fa-download" /> Export
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                  <th style={{ textAlign: 'left', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Staff</th>
                  <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Orders</th>
                  <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Sales</th>
                  <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Rate</th>
                  <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Commission</th>
                </tr>
              </thead>
              <tbody>
                {(data.commissions || []).map(r => (
                  <tr key={r.waiter_id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                    <td style={{ padding: '8px 6px', fontSize: 12, fontWeight: 500, color: 'white' }}>{r.waiter_name}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', color: '#A8A29E' }}>{r.orders_served}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600, color: '#F59E0B' }}>{fmt(r.total_sales)}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', color: '#A8A29E' }}>{r.commission_rate}%</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700, color: '#10B981' }}>{fmt(r.commission)}</td>
                  </tr>
                ))}
              </tbody>
              {data.commissions?.length > 0 && (
                <tfoot>
                  <tr style={{ background: '#0a0a0a' }}>
                    <td style={{ padding: '10px 6px', fontWeight: 600, color: 'white' }}>Total</td>
                    <td style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 600, color: 'white' }}>{data.commissions.reduce((s, r) => s + r.orders_served, 0)}</td>
                    <td style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 700, color: '#F59E0B' }}>{fmt(data.commissions.reduce((s, r) => s + r.total_sales, 0))}</td>
                    <td style={{ padding: '10px 6px', textAlign: 'right' }}>—</td>
                    <td style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 700, color: '#10B981' }}>{fmt(data.commissions.reduce((s, r) => s + r.commission, 0))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Shifts Report - Black Theme */}
      {tab === 'shifts' && !loading && (
        <div style={{ background: '#1a1a1a', borderRadius: 12, padding: '14px 16px', border: '1px solid #2a2a2a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fa-solid fa-clock" style={{ color: '#F97316', fontSize: 14 }} />
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'white', margin: 0 }}>Shift History</h3>
            </div>
            <button onClick={() => exportCSV(Array.isArray(data) ? data : [], ['user_name', 'opened_at', 'closed_at', 'opening_float', 'closing_cash', 'closing_mpesa', 'closing_card', 'total_sales'], 'shifts')} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #333', background: '#0a0a0a', color: '#A8A29E', fontSize: 10, cursor: 'pointer' }}>
              <i className="fa-solid fa-download" /> Export
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                  <th style={{ textAlign: 'left', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Staff</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Date</th>
                  <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Float</th>
                  <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Cash</th>
                  <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>M-Pesa</th>
                  <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Card</th>
                  <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Total</th>
                  <th style={{ textAlign: 'center', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(data) ? data : []).map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                    <td style={{ padding: '8px 6px', fontSize: 12, fontWeight: 500, color: 'white' }}>{s.user_name}</td>
                    <td style={{ padding: '8px 6px', fontSize: 11, color: '#A8A29E' }}>{new Date(s.opened_at).toLocaleDateString()}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', color: '#A8A29E' }}>{fmt(s.opening_float)}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', color: '#A8A29E' }}>{fmt(s.closing_cash)}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', color: '#A8A29E' }}>{fmt(s.closing_mpesa)}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', color: '#A8A29E' }}>{fmt(s.closing_card)}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600, color: '#F59E0B' }}>{fmt(s.total_sales)}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: s.status === 'open' ? '#10B98120' : '#78716C20', color: s.status === 'open' ? '#10B981' : '#78716C' }}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fast/Slow Items - Black Theme */}
      {tab === 'fast-slow' && !loading && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            {['fast', 'medium', 'slow'].map(cls => {
              const items = (data.items || []).filter(i => i.classification === cls);
              const config = {
                fast: { color: '#10B981', bg: '#10B98115', icon: 'fa-bolt', label: 'Fast Moving', desc: 'High velocity items' },
                medium: { color: '#F59E0B', bg: '#F59E0B15', icon: 'fa-chart-line', label: 'Medium Moving', desc: 'Steady performers' },
                slow: { color: '#EF4444', bg: '#EF444415', icon: 'fa-hourglass-half', label: 'Slow Moving', desc: 'Low turnover items' }
              };
              return (
                <div key={cls} style={{ background: '#1a1a1a', borderRadius: 12, padding: '12px', border: '1px solid #2a2a2a' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: config[cls].bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className={`fa-solid ${config[cls].icon}`} style={{ color: config[cls].color, fontSize: 16 }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: config[cls].color }}>{config[cls].label}</div>
                      <div style={{ fontSize: 9, color: '#78716C' }}>{config[cls].desc}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    {items.slice(0, 6).map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < 5 ? '1px solid #2a2a2a' : 'none' }}>
                        <span style={{ fontSize: 11, color: 'white' }}>{item.name.length > 15 ? item.name.substring(0, 13) + '...' : item.name}</span>
                        <span style={{ fontSize: 10, fontWeight: 500, color: config[cls].color }}>{item.qty_sold || 0} sold</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ background: '#1a1a1a', borderRadius: 12, padding: '14px 16px', border: '1px solid #2a2a2a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <i className="fa-solid fa-chart-simple" style={{ color: '#06B6D4', fontSize: 14 }} />
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'white', margin: 0 }}>Velocity Analysis</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                    <th style={{ textAlign: 'left', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>#</th>
                    <th style={{ textAlign: 'left', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Item</th>
                    <th style={{ textAlign: 'left', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Category</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Sold</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Revenue</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Velocity</th>
                    <th style={{ textAlign: 'center', padding: '8px 6px', fontSize: 11, color: '#78716C' }}>Class</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.items || []).map(r => (
                    <tr key={r.name} style={{ borderBottom: '1px solid #2a2a2a' }}>
                      <td style={{ padding: '8px 6px', fontWeight: 700, color: '#F59E0B', fontSize: 12 }}>#{r.rank}</td>
                      <td style={{ padding: '8px 6px', fontSize: 12, fontWeight: 500, color: 'white' }}>{r.name}</td>
                      <td style={{ padding: '8px 6px', fontSize: 11, color: '#78716C' }}>{r.category}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'right', color: '#A8A29E' }}>{r.qty_sold || 0}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600, color: '#F59E0B' }}>{fmt(r.revenue)}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                        <div style={{ background: '#0a0a0a', borderRadius: 12, height: 20, width: '100%', maxWidth: 70, position: 'relative', overflow: 'hidden' }}>
                          <div style={{ width: `${r.velocity || 0}%`, height: '100%', background: r.classification === 'fast' ? '#10B981' : r.classification === 'slow' ? '#EF4444' : '#F59E0B', borderRadius: 12 }} />
                          <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color: 'white' }}>{r.velocity}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: r.classification === 'fast' ? '#10B98120' : r.classification === 'slow' ? '#EF444420' : '#F59E0B20', color: r.classification === 'fast' ? '#10B981' : r.classification === 'slow' ? '#EF4444' : '#F59E0B' }}>
                          {r.classification}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}