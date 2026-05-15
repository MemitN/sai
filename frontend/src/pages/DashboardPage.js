import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import api from '../hooks/useApi';

function fmt(n) { return `KES ${Number(n||0).toLocaleString()}`; }

const COLORS = ['#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#EF4444'];

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const { data } = await api.get('/dashboard/stats');
      setStats(data);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  if (loading) return <div className="loading"><div className="spinner"/><p>Loading dashboard...</p></div>;
  if (!stats) return null;

  const { today, tables, weeklySales, topItems, categoryBreakdown, lowStockItems } = stats;

  const totalPayment = (today.cash_sales || 0) + (today.mpesa_sales || 0) + (today.card_sales || 0);
  const cashPercent = totalPayment > 0 ? (today.cash_sales / totalPayment) * 100 : 0;
  const mpesaPercent = totalPayment > 0 ? (today.mpesa_sales / totalPayment) * 100 : 0;
  const cardPercent = totalPayment > 0 ? (today.card_sales / totalPayment) * 100 : 0;

  return (
    <div>
      {/* Hero Section - Compact */}
      <div style={{ 
        background: 'linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%)',
        borderRadius: 20,
        padding: '20px 24px',
        marginBottom: 20,
        color: 'white',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: -50, right: -50, width: 150, height: 150, borderRadius: '50%', background: 'rgba(245,158,11,0.08)', pointerEvents: 'none' }} />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: '#A8A29E', letterSpacing: 0.5, marginBottom: 4, textTransform: 'uppercase' }}>Today's Revenue</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: '#F59E0B', lineHeight: 1 }}>{fmt(today.total_sales)}</div>
            <div style={{ fontSize: 11, color: '#78716C', marginTop: 6 }}>
              <span style={{ color: '#10B981' }}>↑ 12.5%</span> vs yesterday
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 10, color: '#78716C', marginBottom: 2 }}>ORDERS</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{today.order_count}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#78716C', marginBottom: 2 }}>TABLES</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{tables.occupied}/{tables.total}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#78716C', marginBottom: 2 }}>AVG ORDER</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{fmt(today.total_sales / (today.order_count || 1))}</div>
            </div>
          </div>
        </div>

        {/* Mini payment bar */}
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 2, height: 4, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${cashPercent}%`, background: '#10B981' }} />
            <div style={{ width: `${mpesaPercent}%`, background: '#8B5CF6' }} />
            <div style={{ width: `${cardPercent}%`, background: '#3B82F6' }} />
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 14 }}>
            <span><span style={{ color: '#10B981' }}>●</span> Cash {fmt(today.cash_sales)}</span>
            <span><span style={{ color: '#8B5CF6' }}>●</span> M-Pesa {fmt(today.mpesa_sales)}</span>
            <span><span style={{ color: '#3B82F6' }}>●</span> Card {fmt(today.card_sales)}</span>
          </div>
        </div>
      </div>

      {/* Quick Stats Row - Compact */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        <div style={{ background: 'white', borderRadius: 16, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', border: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-chart-line" style={{ fontSize: 18, color: '#F59E0B' }} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{today.order_count}</div>
              <div style={{ fontSize: 11, color: '#78716C' }}>Total Orders</div>
            </div>
          </div>
        </div>
        <div style={{ background: 'white', borderRadius: 16, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', border: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-user-group" style={{ fontSize: 18, color: '#10B981' }} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{tables.occupied}/{tables.total}</div>
              <div style={{ fontSize: 11, color: '#78716C' }}>Tables Occupied</div>
            </div>
          </div>
        </div>
        <div style={{ background: 'white', borderRadius: 16, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', border: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-box" style={{ fontSize: 18, color: '#EF4444' }} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: stats.lowStockCount > 0 ? '#EF4444' : '#10B981' }}>{stats.lowStockCount || 0}</div>
              <div style={{ fontSize: 11, color: '#78716C' }}>Low Stock</div>
            </div>
          </div>
        </div>
        <div style={{ background: 'white', borderRadius: 16, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', border: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: '#E0E7FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-star" style={{ fontSize: 18, color: '#3B82F6' }} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{topItems[0]?.name?.split(' ')[0] || '—'}</div>
              <div style={{ fontSize: 11, color: '#78716C' }}>Top Seller</div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid - Compact */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 20 }}>
        {/* Sales Trend */}
        <div style={{ background: 'white', borderRadius: 18, padding: '14px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', border: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Sales Trend</div>
              <div style={{ fontSize: 11, color: '#78716C' }}>Last 7 days</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={weeklySales}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#A8A29E' }} tickFormatter={d => d.slice(5)} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#A8A29E' }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
              <Tooltip formatter={v => fmt(v)} contentStyle={{ borderRadius: 10, border: 'none', fontSize: 11 }} />
              <Area type="monotone" dataKey="total" stroke="#F59E0B" strokeWidth={2} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Category Distribution */}
        <div style={{ background: 'white', borderRadius: 18, padding: '14px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', border: '1px solid #f0f0f0' }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Categories</div>
            <div style={{ fontSize: 11, color: '#78716C' }}>Today's sales breakdown</div>
          </div>
          {categoryBreakdown.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, fontSize: 12, color: '#A8A29E' }}>No data</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ResponsiveContainer width="40%" height={150}>
                <PieChart>
                  <Pie data={categoryBreakdown} cx="50%" cy="50%" innerRadius={30} outerRadius={55} dataKey="revenue" paddingAngle={2}>
                    {categoryBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="white" strokeWidth={1.5} />)}
                  </Pie>
                  <Tooltip formatter={v => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1 }}>
                {categoryBreakdown.slice(0, 4).map((c, i) => (
                  <div key={c.category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #f5f5f5', fontSize: 11 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i % COLORS.length] }} />
                      <span>{c.category}</span>
                    </div>
                    <div style={{ fontWeight: 600, color: '#F59E0B' }}>{fmt(c.revenue)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section - Compact */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
        {/* Top Items */}
        <div style={{ background: 'white', borderRadius: 18, padding: '14px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', border: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>🏆 Top Items</div>
              <div style={{ fontSize: 11, color: '#78716C' }}>Best selling this week</div>
            </div>
            <div style={{ fontSize: 10, color: '#A8A29E' }}>{topItems.length} items</div>
          </div>
          {topItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, fontSize: 12, color: '#A8A29E' }}>No data</div>
          ) : (
            <div>
              {topItems.slice(0, 5).map((item, i) => {
                const percent = i === 0 ? 100 : (item.revenue / topItems[0].revenue) * 100;
                return (
                  <div key={i} style={{ marginBottom: i === 4 ? 0 : 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 24, fontSize: 12, fontWeight: 700, color: i === 0 ? '#F59E0B' : '#A8A29E' }}>#{i+1}</span>
                        <span style={{ fontSize: 12, fontWeight: 500 }}>{item.name.length > 20 ? item.name.substring(0, 18) + '...' : item.name}</span>
                        <span style={{ fontSize: 10, color: '#A8A29E' }}>({item.qty_sold})</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#F59E0B' }}>{fmt(item.revenue)}</span>
                    </div>
                    <div style={{ height: 3, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden', marginLeft: 32 }}>
                      <div style={{ width: `${percent}%`, height: '100%', background: i === 0 ? '#F59E0B' : '#FBBF24', borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Low Stock */}
        <div style={{ background: 'white', borderRadius: 18, padding: '14px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', border: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>⚠️ Stock Alerts</div>
              <div style={{ fontSize: 11, color: '#78716C' }}>Items needing attention</div>
            </div>
            {lowStockItems?.length > 0 && <div style={{ background: '#FEE2E2', padding: '2px 10px', borderRadius: 16, fontSize: 11, fontWeight: 600, color: '#DC2626' }}>{lowStockItems.length}</div>}
          </div>
          {!lowStockItems?.length ? (
            <div style={{ textAlign: 'center', padding: 30 }}>
              <div style={{ fontSize: 32, marginBottom: 6 }}>✓</div>
              <div style={{ fontSize: 12, color: '#10B981', fontWeight: 500 }}>All stocks healthy</div>
            </div>
          ) : (
            <div>
              {lowStockItems.slice(0, 4).map((item, idx) => {
                const isCritical = item.quantity <= 0;
                const stockPercent = Math.min(100, (item.quantity / item.reorder_level) * 100);
                return (
                  <div key={item.id} style={{ marginBottom: idx === 3 ? 0 : 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{item.name.length > 15 ? item.name.substring(0, 13) + '...' : item.name}</span>
                        <span style={{ marginLeft: 6, fontSize: 10, color: '#78716C' }}>{item.department}</span>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: isCritical ? '#DC2626' : '#F59E0B' }}>{item.quantity} {item.unit}</div>
                    </div>
                    <div style={{ height: 3, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${stockPercent}%`, height: '100%', background: isCritical ? '#DC2626' : '#F59E0B', borderRadius: 2 }} />
                    </div>
                    {isCritical && <div style={{ fontSize: 10, color: '#DC2626', marginTop: 3 }}>⚠️ Order immediately</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}