import React, { useState, useEffect, useCallback } from 'react';
import api from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';

function fmt(n) { return `KES ${Number(n || 0).toLocaleString()}`; }

export default function RoomBillsPage() {
  const { user } = useAuth();
  const [bills, setBills] = useState([]);
  const [selectedBill, setSelectedBill] = useState(null);
  const [extraCharge, setExtraCharge] = useState({ description: '', amount: '' });
  const [paymentAmount, setPaymentAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/room-bills');
      // Ensure data is an array
      const billsArray = Array.isArray(data) ? data : [];
      setBills(billsArray);
    } catch(e) { 
      console.error('Error loading room bills:', e);
      setBills([]);
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { 
    load(); 
    const t = setInterval(load, 15000); 
    return () => clearInterval(t); 
  }, [load]);

  const openBill = async (bill) => {
    try {
      const { data } = await api.get(`/room-bills/${bill.id}`);
      setSelectedBill(data);
      const balance = (data.total_amount || 0) - (data.paid_amount || 0);
      setPaymentAmount(String(balance > 0 ? balance : 0));
    } catch(e) { 
      console.error('Error loading bill details:', e);
      alert('Error loading bill details');
    }
  };

  const addExtraCharge = async () => {
    if (!extraCharge.description || !extraCharge.amount) {
      alert('Enter description and amount');
      return;
    }
    if (Number(extraCharge.amount) <= 0) {
      alert('Amount must be greater than 0');
      return;
    }
    try {
      await api.post(`/room-bills/${selectedBill.id}/extra-charge`, extraCharge);
      setExtraCharge({ description: '', amount: '' });
      // Refresh bill details
      const { data } = await api.get(`/room-bills/${selectedBill.id}`);
      setSelectedBill(data);
      load(); // Refresh the list
    } catch(e) { 
      console.error('Error adding charge:', e);
      alert('Error: ' + (e.response?.data?.error || e.message));
    }
  };

  const removeCharge = async (chargeId) => {
    if (!window.confirm('Remove this charge?')) return;
    try {
      await api.delete(`/room-extra-charges/${chargeId}`);
      // Refresh bill details
      const { data } = await api.get(`/room-bills/${selectedBill.id}`);
      setSelectedBill(data);
      load(); // Refresh the list
    } catch(e) { 
      console.error('Error removing charge:', e);
      alert('Error: ' + (e.response?.data?.error || e.message));
    }
  };

  const processPayment = async () => {
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) {
      alert('Enter payment amount');
      return;
    }
    
    const balance = (selectedBill.total_amount || 0) - (selectedBill.paid_amount || 0);
    if (amount > balance) {
      alert(`Payment amount cannot exceed balance of ${fmt(balance)}`);
      return;
    }
    
    setProcessing(true);
    try {
      await api.post(`/room-bills/${selectedBill.id}/pay`, {
        payment_method: payMethod,
        amount_paid: amount,
        cashier_id: user.id
      });
      alert('Payment processed successfully!');
      setSelectedBill(null);
      load();
    } catch(e) { 
      console.error('Error processing payment:', e);
      alert('Error: ' + (e.response?.data?.error || e.message));
    }
    finally { setProcessing(false); }
  };

  const getStatusBadge = (status) => {
    const config = {
      pending: { bg: '#FEF3C7', color: '#92400E', text: 'Pending' },
      partial: { bg: '#FEF3C7', color: '#D97706', text: 'Partial' },
      paid: { bg: '#D1FAE5', color: '#065F46', text: 'Paid' }
    };
    const c = config[status] || config.pending;
    return <span style={{ background: c.bg, color: c.color, padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{c.text}</span>;
  };

  if (loading) return <div className="loading"><div className="spinner" /><p>Loading room bills...</p></div>;

  const activeBills = bills.filter(b => b.status !== 'paid');
  const paidBills = bills.filter(b => b.status === 'paid');

  return (
    <div>
      <div className="page-header">
        <h2><i className="fa-solid fa-hotel" style={{ marginRight: 8, color: '#F59E0B' }} />Room Bills & Checkout</h2>
        <button className="btn btn-sm btn-outline" onClick={load}><i className="fa-solid fa-rotate" /></button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 16 }}>
        {/* Bills List */}
        <div>
          {activeBills.length === 0 && paidBills.length === 0 ? (
            <div className="empty-state">
              <i className="fa-solid fa-bed" style={{ fontSize: 48, opacity: 0.3 }} />
              <p>No room bills found</p>
            </div>
          ) : (
            <>
              {activeBills.length > 0 && (
                <>
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: '#D97706' }}>
                    <i className="fa-solid fa-clock" style={{ marginRight: 6 }} /> Active Bills ({activeBills.length})
                  </h3>
                  {activeBills.map(bill => (
                    <div 
                      key={bill.id} 
                      className="bill-card" 
                      onClick={() => openBill(bill)} 
                      style={selectedBill?.id === bill.id ? { borderColor: '#F59E0B', background: '#FFFBEB', boxShadow: '0 4px 12px rgba(245,158,11,0.15)' } : {}}
                    >
                      <div className="bill-table">{bill.room_number || 'N/A'}</div>
                      <div className="bill-info">
                        <div style={{ fontWeight: 700 }}>{bill.guest_name || 'No guest'}</div>
                        <div style={{ fontSize: 11, color: '#78716C' }}>
                          {bill.check_in?.slice(0, 10) || '—'} → {bill.check_out?.slice(0, 10) || '—'} 
                          {bill.nights ? ` (${bill.nights} night${bill.nights !== 1 ? 's' : ''})` : ''}
                        </div>
                        {bill.room_type && (
                          <div style={{ fontSize: 10, color: '#A8A29E', marginTop: 2 }}>
                            <i className="fa-solid fa-door-open" style={{ marginRight: 3 }} /> {bill.room_type}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="bill-total">{fmt(bill.total_amount)}</div>
                        {bill.paid_amount > 0 && (
                          <div style={{ fontSize: 11, color: '#10B981' }}>Paid: {fmt(bill.paid_amount)}</div>
                        )}
                        {getStatusBadge(bill.status)}
                      </div>
                      <i className="fa-solid fa-chevron-right" style={{ color: '#D97706' }} />
                    </div>
                  ))}
                </>
              )}

              {paidBills.length > 0 && (
                <>
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginTop: 20, marginBottom: 10, color: '#78716C' }}>
                    <i className="fa-solid fa-check-circle" style={{ marginRight: 6 }} /> Paid Bills ({paidBills.length})
                  </h3>
                  {paidBills.slice(0, 10).map(bill => (
                    <div key={bill.id} className="bill-card" style={{ opacity: 0.7, cursor: 'default' }}>
                      <div className="bill-table">{bill.room_number || 'N/A'}</div>
                      <div className="bill-info">
                        <div style={{ fontWeight: 700 }}>{bill.guest_name || 'No guest'}</div>
                        <div style={{ fontSize: 11, color: '#78716C' }}>
                          {bill.paid_at ? new Date(bill.paid_at).toLocaleDateString() : bill.created_at?.slice(0, 10)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="bill-total">{fmt(bill.total_amount)}</div>
                        <span className="badge badge-green">Paid</span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>

        {/* Bill Details Panel */}
        {selectedBill && (
          <div className="card" style={{ position: 'sticky', top: 76 }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #E7E5E4', background: '#FFFBEB', borderRadius: '12px 12px 0 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>
                    <i className="fa-solid fa-bed" style={{ marginRight: 6, color: '#D97706' }} />
                    Room {selectedBill.room_number || 'N/A'}
                  </div>
                  <div style={{ fontSize: 12, color: '#78716C' }}>{selectedBill.guest_name || 'No guest'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#D97706' }}>{fmt(selectedBill.total_amount)}</div>
                  {selectedBill.paid_amount > 0 && (
                    <div style={{ fontSize: 11, color: '#10B981' }}>Paid: {fmt(selectedBill.paid_amount)}</div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ padding: '16px' }}>
              {/* Stay Info */}
              <div style={{ background: '#FAFAF9', borderRadius: 10, padding: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12 }}>
                  <div><span style={{ color: '#78716C' }}>Check-in:</span> <strong>{selectedBill.check_in?.slice(0, 10) || '—'}</strong></div>
                  <div><span style={{ color: '#78716C' }}>Check-out:</span> <strong>{selectedBill.check_out?.slice(0, 10) || '—'}</strong></div>
                  <div><span style={{ color: '#78716C' }}>Nights:</span> <strong>{selectedBill.nights || 1}</strong></div>
                  {selectedBill.room_charge > 0 && selectedBill.nights > 0 && (
                    <div><span style={{ color: '#78716C' }}>Rate:</span> <strong>{fmt(selectedBill.room_charge / selectedBill.nights)}/night</strong></div>
                  )}
                </div>
              </div>

              {/* Charges Breakdown */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F5F5F4' }}>
                  <span>Room Charge</span>
                  <span style={{ fontWeight: 700 }}>{fmt(selectedBill.room_charge || 0)}</span>
                </div>
                {selectedBill.extra_charges_list && selectedBill.extra_charges_list.length > 0 && (
                  <>
                    <div style={{ padding: '8px 0', color: '#78716C', fontSize: 12, fontWeight: 600 }}>
                      <i className="fa-solid fa-receipt" style={{ marginRight: 6 }} /> Extra Charges
                    </div>
                    {selectedBill.extra_charges_list.map(charge => (
                      <div key={charge.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 6px 16px', borderBottom: '1px solid #F5F5F4' }}>
                        <span style={{ fontSize: 13 }}>{charge.description}</span>
                        <div>
                          <span style={{ fontWeight: 700 }}>{fmt(charge.amount)}</span>
                          {selectedBill.status !== 'paid' && (
                            <button 
                              onClick={() => removeCharge(charge.id)} 
                              style={{ background: 'none', border: 'none', color: '#EF4444', marginLeft: 10, cursor: 'pointer' }}
                            >
                              <i className="fa-solid fa-trash" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {selectedBill.extra_charges > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F5F5F4' }}>
                    <span>Extra Charges Total</span>
                    <span style={{ fontWeight: 700 }}>{fmt(selectedBill.extra_charges)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '2px solid #E7E5E4', marginTop: 8 }}>
                  <span style={{ fontWeight: 700 }}>TOTAL</span>
                  <span style={{ fontWeight: 800, fontSize: 16, color: '#D97706' }}>{fmt(selectedBill.total_amount)}</span>
                </div>
                {selectedBill.paid_amount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', color: '#10B981' }}>
                    <span>Paid</span>
                    <span style={{ fontWeight: 700 }}>-{fmt(selectedBill.paid_amount)}</span>
                  </div>
                )}
                {selectedBill.total_amount - (selectedBill.paid_amount || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', background: '#FEF3C7', borderRadius: 8, marginTop: 8 }}>
                    <span style={{ fontWeight: 700 }}>Balance Due</span>
                    <span style={{ fontWeight: 800, fontSize: 18, color: '#D97706' }}>{fmt(selectedBill.total_amount - (selectedBill.paid_amount || 0))}</span>
                  </div>
                )}
              </div>

              {/* Add Extra Charge - Only if not paid */}
              {selectedBill.status !== 'paid' && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#78716C', display: 'block', marginBottom: 6 }}>
                    <i className="fa-solid fa-plus-circle" style={{ marginRight: 4, color: '#F59E0B' }} /> Add Extra Charge
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input 
                      className="form-input" 
                      placeholder="Description (e.g., Mini Bar, Laundry)" 
                      value={extraCharge.description} 
                      onChange={e => setExtraCharge({ ...extraCharge, description: e.target.value })} 
                      style={{ flex: 2 }} 
                    />
                    <input 
                      className="form-input" 
                      placeholder="Amount" 
                      type="number" 
                      value={extraCharge.amount} 
                      onChange={e => setExtraCharge({ ...extraCharge, amount: e.target.value })} 
                      style={{ width: 100 }} 
                    />
                    <button className="btn btn-primary" onClick={addExtraCharge}>
                      <i className="fa-solid fa-plus" /> Add
                    </button>
                  </div>
                </div>
              )}

              {/* Payment Section - Only if not fully paid */}
              {selectedBill.status !== 'paid' && (selectedBill.total_amount || 0) > (selectedBill.paid_amount || 0) && (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#78716C', display: 'block', marginBottom: 6 }}>Payment Method</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {['cash', 'mpesa', 'card'].map(m => (
                        <button 
                          key={m} 
                          className={`btn btn-sm ${payMethod === m ? 'btn-primary' : 'btn-outline'}`} 
                          onClick={() => setPayMethod(m)} 
                          style={{ flex: 1 }}
                        >
                          <i className={`fa-solid ${m === 'cash' ? 'fa-money-bill' : m === 'mpesa' ? 'fa-mobile-screen' : 'fa-credit-card'}`} /> {m.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <input 
                      type="number" 
                      className="form-input" 
                      placeholder="Amount to pay" 
                      value={paymentAmount} 
                      onChange={e => setPaymentAmount(e.target.value)} 
                    />
                    <button 
                      className="btn btn-success" 
                      onClick={processPayment} 
                      disabled={processing}
                    >
                      {processing ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <><i className="fa-solid fa-check" /> Pay {fmt(Number(paymentAmount))}</>}
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: '#78716C', marginTop: 8, textAlign: 'center' }}>
                    Balance: {fmt((selectedBill.total_amount || 0) - (selectedBill.paid_amount || 0))}
                  </div>
                </>
              )}

              {selectedBill.status === 'paid' && (
                <div style={{ textAlign: 'center', padding: 16, background: '#D1FAE5', borderRadius: 10 }}>
                  <i className="fa-solid fa-check-circle" style={{ fontSize: 24, color: '#065F46', marginBottom: 8 }} />
                  <div style={{ fontWeight: 700, color: '#065F46' }}>Bill Fully Paid</div>
                  <div style={{ fontSize: 12, color: '#065F46', marginTop: 4 }}>
                    Paid on: {selectedBill.paid_at ? new Date(selectedBill.paid_at).toLocaleString() : '—'}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}