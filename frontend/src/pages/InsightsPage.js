import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import api from '../hooks/useApi';

const fmt    = n => `KES ${Number(n||0).toLocaleString('en-KE',{minimumFractionDigits:0})}`;
const fmtPct = n => `${Number(n||0).toFixed(1)}%`;
const COLORS  = ['#F59E0B','#10B981','#3B82F6','#8B5CF6','#EC4899','#06B6D4','#F97316','#EF4444'];
const DAYS    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function InsightsPage() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom]     = useState(() => {
    const d = new Date(); d.setDate(d.getDate()-30); return d.toISOString().split('T')[0];
  });
  const [to, setTo]         = useState(new Date().toISOString().split('T')[0]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: d } = await api.get('/insights', { params:{from,to} });
      setData(d);
    } catch(e) { console.error(e); }
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const totalPayments = data?.paymentSplit?.reduce((s,p)=>s+p.total,0)||1;

  return (
    <div>
      <div className="page-header">
        <h2><i className="fa-solid fa-chart-bar" style={{marginRight:8,color:'#F59E0B'}}/>Business Insights</h2>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <input type="date" className="form-input" style={{width:140}} value={from} onChange={e=>setFrom(e.target.value)}/>
          <span style={{color:'#78716C'}}>to</span>
          <input type="date" className="form-input" style={{width:140}} value={to} onChange={e=>setTo(e.target.value)}/>
          <button className="btn btn-primary btn-sm" onClick={load}>Apply</button>
        </div>
      </div>

      {loading ? (
        <div style={{textAlign:'center',padding:60,color:'#78716C'}}>
          <div className="spinner" style={{margin:'0 auto 12px'}}/>Loading insights...
        </div>
      ) : !data ? null : (
        <div style={{display:'grid',gap:16}}>

          {/* KPI row */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10}}>
            {[
              {label:'Avg Bill Value',   val:fmt(data.avgBill?.avg_bill||0),   color:'#D97706', icon:'fa-receipt'},
              {label:'Highest Bill',     val:fmt(data.avgBill?.max_bill||0),   color:'#10B981', icon:'fa-trophy'},
              {label:'Total Bills',      val:(data.avgBill?.bill_count||0).toLocaleString(), color:'#3B82F6', icon:'fa-file-invoice'},
              {label:'Repeat Customers', val:`${data.loyaltyStats?.repeat_customers||0}`, color:'#8B5CF6', icon:'fa-user-check'},
              {label:'VIP Customers',    val:`${data.loyaltyStats?.vip_customers||0}`,  color:'#F59E0B', icon:'fa-crown'},
            ].map(k=>(
              <div key={k.label} className="card" style={{padding:'12px 16px',textAlign:'center'}}>
                <i className={`fa-solid ${k.icon}`} style={{fontSize:22,color:k.color,display:'block',marginBottom:6}}/>
                <div style={{fontFamily:'Montserrat',fontWeight:800,fontSize:20,color:k.color}}>{k.val}</div>
                <div style={{fontSize:11,color:'#78716C'}}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Top items + Peak hours */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>

            {/* Top Items */}
            <div className="card" style={{padding:20}}>
              <h3 style={{fontFamily:'Poppins',fontSize:15,fontWeight:700,marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
                <i className="fa-solid fa-fire" style={{color:'#F59E0B'}}/> Top Selling Items
              </h3>
              {data.topItems?.length ? (
                <div>
                  {data.topItems.map((item,i)=>{
                    const maxRev = data.topItems[0]?.revenue||1;
                    return (
                      <div key={i} style={{marginBottom:10}}>
                        <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}>
                          <span style={{fontWeight:600}}>{item.image_emoji} {item.name}</span>
                          <span style={{color:'#D97706',fontWeight:700}}>{fmt(item.revenue)}</span>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          <div style={{flex:1,background:'#E7E5E4',borderRadius:3,height:6,overflow:'hidden'}}>
                            <div style={{width:`${(item.revenue/maxRev)*100}%`,height:'100%',background:COLORS[i%COLORS.length]}}/>
                          </div>
                          <span style={{fontSize:10,color:'#78716C',minWidth:40,textAlign:'right'}}>{item.qty_sold} sold</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <p style={{color:'#78716C',fontSize:13}}>No data</p>}
            </div>

            {/* Peak Hours */}
            <div className="card" style={{padding:20}}>
              <h3 style={{fontFamily:'Poppins',fontSize:15,fontWeight:700,marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
                <i className="fa-solid fa-clock" style={{color:'#3B82F6'}}/> Peak Hours
              </h3>
              {data.peakHours?.length ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.peakHours.map(h=>({
                    name:`${h.hour}:00`, orders:h.order_count, revenue:h.revenue
                  }))} barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F4"/>
                    <XAxis dataKey="name" tick={{fontSize:10}} />
                    <YAxis tick={{fontSize:10}}/>
                    <Tooltip formatter={(v,n)=>n==='revenue'?[fmt(v),'Revenue']:[v,'Orders']}/>
                    <Bar dataKey="orders" fill="#3B82F6" radius={[3,3,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              ) : <p style={{color:'#78716C',fontSize:13}}>No data</p>}
            </div>
          </div>

          {/* Top Waiters + Day of week */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>

            {/* Top Waiters */}
            <div className="card" style={{padding:20}}>
              <h3 style={{fontFamily:'Poppins',fontSize:15,fontWeight:700,marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
                <i className="fa-solid fa-medal" style={{color:'#D97706'}}/> Top Waiters
              </h3>
              {data.topWaiters?.length ? (
                <div>
                  {data.topWaiters.map((w,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'8px 0',borderBottom:'1px solid #F5F5F4'}}>
                      <div style={{width:28,height:28,borderRadius:'50%',background:i===0?'#FFFBEB':i===1?'#F9FAFB':'#F5F5F4',border:`2px solid ${i===0?'#D97706':i===1?'#9CA3AF':'#D1D5DB'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,flexShrink:0}}>
                        {i+1}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700,fontSize:13}}>{w.waiter_name}</div>
                        <div style={{fontSize:11,color:'#78716C'}}>{w.orders_served} orders · avg {fmt(w.avg_bill_value)}</div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontFamily:'Montserrat',fontWeight:700,color:'#D97706',fontSize:14}}>{fmt(w.revenue)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p style={{color:'#78716C',fontSize:13}}>No data</p>}
            </div>

            {/* Day of week */}
            <div className="card" style={{padding:20}}>
              <h3 style={{fontFamily:'Poppins',fontSize:15,fontWeight:700,marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
                <i className="fa-solid fa-calendar-week" style={{color:'#10B981'}}/> Busiest Days
              </h3>
              {data.dayOfWeek?.length ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.dayOfWeek.map(d=>({name:d.day, orders:d.orders, revenue:d.revenue}))} barSize={24}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F4"/>
                    <XAxis dataKey="name" tick={{fontSize:11}}/>
                    <YAxis tick={{fontSize:10}}/>
                    <Tooltip formatter={(v,n)=>n==='revenue'?[fmt(v),'Revenue']:[v,'Orders']}/>
                    <Bar dataKey="orders" fill="#10B981" radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              ) : <p style={{color:'#78716C',fontSize:13}}>No data</p>}
            </div>
          </div>

          {/* Payment split + Slow items */}
          <div style={{display:'grid',gridTemplateColumns:'auto 1fr',gap:16}}>

            {/* Payment split */}
            <div className="card" style={{padding:20,minWidth:260}}>
              <h3 style={{fontFamily:'Poppins',fontSize:15,fontWeight:700,marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
                <i className="fa-solid fa-credit-card" style={{color:'#8B5CF6'}}/> Payment Methods
              </h3>
              {data.paymentSplit?.length ? (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={data.paymentSplit} dataKey="total" nameKey="payment_method" cx="50%" cy="50%" outerRadius={65} label={({payment_method,percent})=>`${payment_method} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                        {data.paymentSplit.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                      </Pie>
                      <Tooltip formatter={v=>[fmt(v),'Revenue']}/>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{marginTop:10}}>
                    {data.paymentSplit.map((p,i)=>(
                      <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'3px 0'}}>
                        <span style={{display:'flex',alignItems:'center',gap:6}}>
                          <span style={{width:10,height:10,borderRadius:'50%',background:COLORS[i%COLORS.length],display:'inline-block'}}/>
                          {p.payment_method}
                        </span>
                        <span style={{fontWeight:700}}>{fmt(p.total)} ({fmtPct((p.total/totalPayments)*100)})</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : <p style={{color:'#78716C',fontSize:13}}>No data</p>}
            </div>

            {/* Slow movers */}
            <div className="card" style={{padding:20}}>
              <h3 style={{fontFamily:'Poppins',fontSize:15,fontWeight:700,marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
                <i className="fa-solid fa-snooze" style={{color:'#EF4444'}}/> Slow Moving Items
                <span style={{fontSize:11,fontWeight:400,color:'#78716C'}}>(bottom 10 by qty sold)</span>
              </h3>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:8}}>
                {data.slowItems?.map((item,i)=>(
                  <div key={i} style={{background:'#FEF2F2',borderRadius:8,padding:'8px 12px',border:'1px solid #FCA5A520'}}>
                    <div style={{fontSize:12,fontWeight:700}}>{item.image_emoji||'🍽️'} {item.name}</div>
                    <div style={{fontSize:11,color:'#78716C',marginTop:2}}>{item.category}</div>
                    <div style={{fontSize:11,color:'#EF4444',fontWeight:700,marginTop:4}}>
                      {item.qty_sold} sold · {fmt(item.revenue)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
