import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';

function fmt(n) { return `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

// Use absolute path for logo (works in both dev and production)
const logoSrc = '/logo.jpeg';
// ─── Receipt Generator ──────────────────────────────────────────────────────
function generateReceiptId(billId, timestamp) {
  const base = `SAI${timestamp.getFullYear()}${String(timestamp.getMonth()+1).padStart(2,'0')}${String(timestamp.getDate()).padStart(2,'0')}-${billId}`;
  let checksum = 0;
  for (let i = 0; i < base.length; i++) { checksum = (checksum + base.charCodeAt(i)) % 100; }
  return `${base}-${String(checksum).padStart(2,'0')}`;
}

function generateReceiptHTML({ bill, items, payment, cashier, change, waiterName }) {
  const now = new Date();
  const receiptNo = generateReceiptId(bill.id, now);
  const thankYouMessages = [
    "Thank you for dining with us!", "Asante sana! Karibu tena!",
    "We appreciate your visit!", "Have a wonderful day!",
    "Thank you! Come again!", "Twende! Karibu tena Sai Lounge!",
    "Hakuna Matata! See you soon!"
  ];
  const randomMessage = thankYouMessages[Math.floor(Math.random() * thankYouMessages.length)];
  const logoWatermark = logoSrc
    ? `<img src="${logoSrc}" style="width:120px;height:120px;border-radius:50%;object-fit:cover;opacity:0.08;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;" />`
    : '<div style="font-size:80px;opacity:0.08;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;">🍹</div>';
  const logoHTML = logoSrc
    ? `<img src="${logoSrc}" alt="Sai Lounge" style="width:45px;height:45px;border-radius:50%;object-fit:cover;border:2px solid #F59E0B"/>`
    : `<div style="font-size:24px">🍹</div>`;

  // Combine items with same name
  const combinedItemsMap = new Map();
  items.forEach(item => {
    const key = item.item_name;
    if (combinedItemsMap.has(key)) {
      const existing = combinedItemsMap.get(key);
      existing.quantity += item.quantity;
      if (item.notes && !existing.notes) existing.notes = item.notes;
      else if (item.notes && existing.notes && existing.notes !== item.notes)
        existing.notes = existing.notes + ' | ' + item.notes;
    } else {
      combinedItemsMap.set(key, { item_name: item.item_name, quantity: item.quantity, unit_price: item.unit_price, notes: item.notes });
    }
  });
  const combinedItems = Array.from(combinedItemsMap.values());
  const calculatedTotal = combinedItems.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0);
  const finalTotal = calculatedTotal - (bill.discount || 0);

  const itemsHTML = combinedItems.map(i => `
    <tr style="border-bottom:1px solid #eee">
      <td style="padding:3px 0;font-size:9px">${i.item_name.length > 20 ? i.item_name.substring(0, 18) + '..' : i.item_name}</td>
      <td style="padding:3px 4px;text-align:center;font-size:9px">${i.quantity}</td>
      <td style="padding:3px 0;text-align:right;font-size:9px">${(i.quantity * i.unit_price).toLocaleString('en-KE',{minimumFractionDigits:2})}</td>
    </tr>
    ${i.notes ? `<tr><td colspan="3" style="font-size:7px;color:#888;padding-bottom:2px;padding-left:8px">✎ ${i.notes.substring(0, 35)}</td></tr>` : ''}
  `).join('');

  const paymentRows = [
    payment.method === 'cash' || payment.method === 'split' ? `<tr><td style="padding:2px 0">Cash</td><td style="text-align:right">${(payment.cash||0).toLocaleString('en-KE',{minimumFractionDigits:2})}</td></tr>` : '',
    payment.method === 'mpesa' || payment.method === 'split' ? `<tr><td style="padding:2px 0">M-Pesa</td><td style="text-align:right">${(payment.mpesa||0).toLocaleString('en-KE',{minimumFractionDigits:2})}</td></tr>` : '',
    payment.method === 'card' || payment.method === 'split' ? `<tr><td style="padding:2px 0">Card/PDQ</td><td style="text-align:right">${(payment.card||0).toLocaleString('en-KE',{minimumFractionDigits:2})}</td></tr>` : '',
  ].filter(Boolean).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Receipt ${receiptNo}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; font-size: 9.5px; background: white; color: #1a1a1a; padding: 0; margin: 0; }
  .receipt { width: 80mm; max-width: 80mm; margin: 0 auto; padding: 5px 6px; position: relative; background: white; }
  .watermark-container { position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; overflow: hidden; z-index: 0; }
  .content { position: relative; z-index: 1; }
  .header { text-align: center; padding-bottom: 4px; border-bottom: 1px dashed #ccc; margin-bottom: 5px; }
  .logo { margin-bottom: 3px; }
  .biz-name { font-size: 15px; font-weight: 900; font-family: Georgia, serif; }
  .biz-name span { color: #D97706; }
  .biz-sub { font-size: 7.5px; color: #666; }
  .info-grid { display: flex; justify-content: space-between; background: #FAFAF9; padding: 5px 6px; margin: 5px 0; border-radius: 4px; font-size: 8px; }
  .info-item { text-align: center; flex: 1; }
  .info-label { font-weight: 700; color: #78716C; font-size: 7px; text-transform: uppercase; margin-bottom: 2px; }
  .info-value { font-weight: 600; font-size: 9px; }
  .divider { border: none; border-top: 1px dashed #ccc; margin: 4px 0; }
  .divider-solid { border: none; border-top: 1px solid #1a1a1a; margin: 4px 0; }
  .section-label { font-size: 7.5px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: #888; margin-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; margin: 2px 0; }
  .totals-table { width: 100%; border-collapse: collapse; margin: 2px 0; }
  .totals-table td { padding: 2px 0; font-size: 9px; }
  .grand-total { font-size: 11px; font-weight: 900; }
  .change-box { background: #f0fff4; border: 1px solid #10B981; border-radius: 4px; padding: 4px 8px; margin: 5px 0; text-align: center; }
  .change-label { font-size: 7px; color: #065F46; text-transform: uppercase; }
  .change-amount { font-size: 13px; font-weight: 900; color: #065F46; }
  .thankyou-box { background: #1C1917; color: #F59E0B; text-align: center; padding: 5px; margin: 6px 0; border-radius: 6px; font-size: 8px; font-weight: 700; }
  .footer { text-align: center; padding-top: 5px; border-top: 1px dashed #ccc; margin-top: 5px; font-size: 7px; color: #666; }
  .security { font-size: 6px; text-align: center; color: #999; margin-top: 3px; }
  .waiter-signature { text-align: right; font-size: 7px; margin-top: 5px; padding-top: 3px; border-top: 1px dotted #ccc; }
  @media print { body { margin: 0; padding: 0; } .no-print { display: none; } @page { margin: 0; size: 80mm auto; } }
</style>
</head>
<body>
<div class="receipt">
  <div class="watermark-container">${logoWatermark}</div>
  <div class="content">
    <div class="header">
      <div class="logo">${logoHTML}</div>
      <div class="biz-name">Sai <span>Lounge</span></div>
      <div class="biz-sub">Nairobi · +254 700 000 000</div>
    </div>
    <div class="info-grid">
      <div class="info-item"><div class="info-label">Receipt #</div><div class="info-value">${receiptNo.slice(-12)}</div></div>
      <div class="info-item"><div class="info-label">Date</div><div class="info-value">${now.toLocaleString('en-KE',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</div></div>
    </div>
    <div class="info-grid">
      <div class="info-item"><div class="info-label">Table</div><div class="info-value">${bill.table_number || '—'}</div></div>
      <div class="info-item"><div class="info-label">Served By</div><div class="info-value">${waiterName || '—'}</div></div>
      <div class="info-item"><div class="info-label">Cashier</div><div class="info-value">${cashier?.name?.split(' ')[0] || '—'}</div></div>
    </div>
    <div class="divider"></div>
    <div class="section-label">ITEMS</div>
    <table style="width:100%">
      <thead><tr style="border-bottom:1px solid #ddd"><th style="text-align:left;font-size:7.5px;padding:2px 0">Item</th><th style="text-align:center;font-size:7.5px;padding:2px">Qty</th><th style="text-align:right;font-size:7.5px;padding:2px 0">KES</th></tr></thead>
      <tbody>${itemsHTML}</tbody>
    </table>
    <div class="divider-solid"></div>
    <table class="totals-table">
      <tr><td style="padding:2px 0">Subtotal</td><td style="text-align:right">${fmt(calculatedTotal)}</td></tr>
      ${bill.discount > 0 ? `<tr><td style="color:#059669">Discount</td><td style="text-align:right;color:#059669">-${fmt(bill.discount)}</td></tr>` : ''}
      <tr style="border-top:1px dashed #ccc"><td class="grand-total">TOTAL</td><td class="grand-total" style="text-align:right;color:#D97706">${fmt(finalTotal)}</td></tr>
    </table>
    <div class="divider"></div>
    <table class="totals-table">${paymentRows}<tr style="font-weight:700"><td>Paid</td><td style="text-align:right">${fmt(payment.cash + payment.mpesa + payment.card)}</td></tr></table>
    ${change > 0 ? `<div class="change-box"><div class="change-label">CHANGE DUE</div><div class="change-amount">${fmt(change)}</div></div>` : ''}
    <div style="text-align:center;margin:4px 0"><span style="background:#1C1917;color:#F59E0B;font-size:7px;font-weight:700;padding:2px 8px;border-radius:12px">${payment.method === 'mpesa' ? '📱 M-PESA' : payment.method === 'card' ? '💳 CARD' : payment.method === 'split' ? '🔀 SPLIT' : '💵 CASH'}</span></div>
    <div class="thankyou-box">🙏 ${randomMessage} 🙏</div>
    <div class="waiter-signature">___________________<br>Waiter Signature</div>
    <div class="footer"><strong>Sai Lounge - Premium Dining Experience</strong><br><span style="font-size:6px">${receiptNo} · ${now.toLocaleDateString('en-KE')}</span></div>
    <div class="security">VERIFIED · KRA APPROVED</div>
  </div>
</div>
<div class="no-print" style="text-align:center;padding:10px;font-family:sans-serif">
  <button onclick="window.print()" style="background:#F59E0B;color:#1C1917;border:none;padding:8px 20px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;margin-right:8px">🖨️ Print Receipt</button>
  <button onclick="window.close()" style="background:#f5f5f4;color:#555;border:1px solid #ddd;padding:8px 16px;border-radius:8px;font-size:12px;cursor:pointer">Close</button>
</div>
</body>
</html>`;
}

// ─── Main Cashier Page ──────────────────────────────────────────────────────
export default function CashierPage() {
  const { user } = useAuth();
  const [bills, setBills] = useState([]);
  const [selected, setSelected] = useState(null);
  const [billDetail, setBillDetail] = useState(null);
  const [payMethod, setPayMethod] = useState('cash');
  const [cashAmt, setCashAmt] = useState('');
  const [mpesaAmt, setMpesaAmt] = useState('');
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [cardAmt, setCardAmt] = useState('');
  const [discount, setDiscount] = useState(0);
  const [discountLabel, setDiscountLabel] = useState('');
  const [promotions, setPromotions] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [mpesaLoading, setMpesaLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [search, setSearch] = useState('');
  const [activeShift, setActiveShift] = useState(null);
  const [openFloat, setOpenFloat] = useState('');
  const [closingModal, setClosingModal] = useState(false);
  const [closingData, setClosingData] = useState({ cash:'', mpesa:'', card:'', notes:'' });
  const [refreshing, setRefreshing] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [shiftSummary, setShiftSummary] = useState(null);

  const load = useCallback(async () => {
    try {
      const [bRes, pRes] = await Promise.all([api.get('/bills'), api.get('/promotions')]);
      setBills(bRes.data);
      setPromotions(pRes.data.promotions || []);
    } catch(e) { console.error(e); }
  }, []);

  const loadShift = useCallback(async () => {
    try {
      const { data } = await api.get('/dashboard/stats');
      setActiveShift(data.activeShift);
    } catch(e) {}
  }, []);

  useEffect(() => {
    load();
    loadShift();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load, loadShift]);

  const autoApplyDiscount = useCallback((subtotal, activePromos) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    for (const p of activePromos) {
      if (!p.active) continue;
      if (p.start_time && p.end_time) {
        if (timeStr < p.start_time || timeStr > p.end_time) continue;
      }
      if (p.type === 'percentage' || p.type === 'happy_hour') {
        const d = Math.round(subtotal * (p.value / 100) * 100) / 100;
        return { amount: d, label: `${p.name} (${p.value}% off)` };
      }
      if (p.type === 'fixed') {
        return { amount: Math.min(p.value, subtotal), label: `${p.name} (KES ${p.value} off)` };
      }
    }
    return null;
  }, []);

  const refreshBillTotal = async () => {
    if (!selected) return;
    setRefreshing(true);
    try {
      // FIX: Use correct PUT /bills/:id/refresh endpoint
      await api.put(`/bills/${selected.id}/refresh`);
      const refreshed = await api.get(`/bills/${selected.id}`);
      setBillDetail(refreshed.data);
      // Sync cash amount with new total
      const newTotal = refreshed.data.items
        ? refreshed.data.items.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0)
        : refreshed.data.total;
      const newNet = Math.max(0, newTotal - discount);
      if (payMethod === 'cash') setCashAmt(String(newNet));
    } catch(e) {
      console.error('Refresh error:', e);
      alert('Could not refresh bill total');
    } finally {
      setRefreshing(false);
    }
  };

  const openBill = async (bill) => {
    setSelected(bill);
    setSuccess(false);
    setPaymentError('');
    setPayMethod('cash');
    setCashAmt('');
    setMpesaAmt('');
    setCardAmt('');
    setMpesaPhone('');
    setDiscount(0);
    setDiscountLabel('');
    try {
      const { data } = await api.get(`/bills/${bill.id}`);
      setBillDetail(data);
      const subtotal = data.items
        ? data.items.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0)
        : data.total;
      const auto = autoApplyDiscount(subtotal, promotions);
      if (auto) {
        setDiscount(auto.amount);
        setDiscountLabel(auto.label);
        // Pre-fill cash with net total after discount
        setCashAmt(String(Math.max(0, subtotal - auto.amount)));
      } else {
        setCashAmt(String(data.total));
      }
    } catch(e) { console.error(e); }
  };

  // Calculate net total from items (most accurate)
  const netTotal = billDetail ? Math.max(0, (() => {
    if (billDetail.items) {
      return billDetail.items.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0) - discount;
    }
    return billDetail.total - discount;
  })()) : 0;

  // FIX: Correct totalPaid calculation for mpesa/card (use entered amounts, not hardcoded netTotal)
  const totalPaid = (() => {
    if (payMethod === 'cash') return Number(cashAmt) || 0;
    if (payMethod === 'mpesa') return Number(mpesaAmt) || 0;
    if (payMethod === 'card') return Number(cardAmt) || 0;
    if (payMethod === 'split') return (Number(cashAmt)||0) + (Number(mpesaAmt)||0) + (Number(cardAmt)||0);
    return 0;
  })();

  const change = payMethod === 'cash'
    ? Math.max(0, (Number(cashAmt)||0) - netTotal)
    : payMethod === 'split'
      ? Math.max(0, totalPaid - netTotal)
      : 0;

  // Payment validation
  const isUnderpaid = totalPaid > 0 && totalPaid < netTotal;
  const isReadyToPay = !isUnderpaid || payMethod === 'split';

  const initiateMpesa = async () => {
    if (!mpesaPhone) return alert('Enter customer M-Pesa phone number');
    setMpesaLoading(true);
    try {
      const amount = payMethod === 'split' ? (Number(mpesaAmt) || netTotal) : netTotal;
      const { data } = await api.post('/mpesa/initiate', { phone: mpesaPhone, amount, bill_id: selected.id });
      if (data.ResponseCode === '0') {
        alert('✅ STK Push sent! Ask customer to enter their M-Pesa PIN.');
        if (payMethod === 'mpesa') setMpesaAmt(String(netTotal));
      } else {
        alert('M-Pesa error: ' + (data.errorMessage || data.ResponseDescription || 'Unknown error'));
      }
    } catch(e) { alert('M-Pesa not configured: ' + (e.response?.data?.error || e.message)); }
    finally { setMpesaLoading(false); }
  };

  const processPayment = async () => {
    setPaymentError('');

    // Validate payment amounts
    if (payMethod === 'cash' && (Number(cashAmt)||0) <= 0) {
      setPaymentError('Please enter the cash amount received.');
      return;
    }
    if (payMethod === 'mpesa' && (Number(mpesaAmt)||0) <= 0) {
      setPaymentError('Please enter the M-Pesa amount.');
      return;
    }
    if (payMethod === 'card' && (Number(cardAmt)||0) <= 0) {
      setPaymentError('Please enter the card/PDQ amount.');
      return;
    }
    if (payMethod === 'split') {
      const splitTotal = (Number(cashAmt)||0) + (Number(mpesaAmt)||0) + (Number(cardAmt)||0);
      if (splitTotal < netTotal) {
        setPaymentError(`Split total ${fmt(splitTotal)} is less than bill total ${fmt(netTotal)}. Please check amounts.`);
        return;
      }
    }

    setProcessing(true);
    try {
      const paymentInfo = {
        payment_method: payMethod,
        cash_amount:  payMethod === 'cash'  ? Number(cashAmt)||0  : payMethod === 'split' ? Number(cashAmt)||0  : 0,
        mpesa_amount: payMethod === 'mpesa' ? Number(mpesaAmt)||netTotal : payMethod === 'split' ? Number(mpesaAmt)||0 : 0,
        card_amount:  payMethod === 'card'  ? Number(cardAmt)||netTotal  : payMethod === 'split' ? Number(cardAmt)||0  : 0,
        cashier_id: user.id,
        discount,
      };
      await api.post(`/bills/${selected.id}/pay`, paymentInfo);

      const receiptData = {
        bill: { ...billDetail, discount },
        items: billDetail.items || [],
        payment: { method: payMethod, cash: paymentInfo.cash_amount, mpesa: paymentInfo.mpesa_amount, card: paymentInfo.card_amount },
        cashier: user,
        change,
        waiterName: billDetail.waiter_name
      };
      setSuccessData(receiptData);
      setSuccess(true);
      printReceipt(receiptData);
      load();
      setTimeout(() => { setSelected(null); setBillDetail(null); setSuccess(false); setSuccessData(null); }, 7000);
    } catch(e) {
      setPaymentError('Payment error: ' + (e.response?.data?.error || e.message));
    } finally {
      setProcessing(false);
    }
  };

  const printReceipt = (data) => {
    const html = generateReceiptHTML(data || successData);
    const win = window.open('', '_blank', 'width=380,height=600,toolbar=0,menubar=0');
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 500); }
  };

  const openShift = async () => {
    if (!openFloat && openFloat !== 0) return alert('Enter an opening float (enter 0 if none).');
    try {
      await api.post('/shifts/open', { opening_float: Number(openFloat)||0 });
      setOpenFloat('');
      loadShift();
    } catch(e) { alert('Error: ' + e.response?.data?.error); }
  };

  const loadShiftSummary = async () => {
    try {
      const { data } = await api.get('/dashboard/stats');
      setShiftSummary(data);
    } catch(e) {}
  };

  const closeShift = async () => {
    try {
      await api.put(`/shifts/${activeShift.id}/close`, {
        closing_cash: Number(closingData.cash)||0,
        closing_mpesa: Number(closingData.mpesa)||0,
        closing_card: Number(closingData.card)||0,
        notes: closingData.notes
      });
      setClosingModal(false);
      setShiftSummary(null);
      setActiveShift(null);
      loadShift();
    } catch(e) { alert('Error: ' + e.response?.data?.error); }
  };

  // Quick discount presets
  const applyDiscountPreset = (pct) => {
    if (!billDetail) return;
    const subtotal = billDetail.items
      ? billDetail.items.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0)
      : billDetail.total;
    const d = Math.round(subtotal * (pct / 100) * 100) / 100;
    setDiscount(d);
    setDiscountLabel(`${pct}% discount`);
  };

  const filtered = bills.filter(b =>
    !search ||
    String(b.table_number).includes(search) ||
    b.waiter_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <h2><i className="fa-solid fa-cash-register" style={{marginRight:8,color:'#F59E0B'}} />Cashier</h2>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          {activeShift
            ? <>
                <span className="badge badge-green">
                  <i className="fa-solid fa-circle" style={{fontSize:8,marginRight:4}} />
                  Shift Open · {new Date(activeShift.opened_at).toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit'})}
                </span>
                <button className="btn btn-sm btn-danger" onClick={()=>{ loadShiftSummary(); setClosingModal(true); }}>
                  <i className="fa-solid fa-door-closed" /> Close Shift
                </button>
              </>
            : <>
                <input className="form-input" style={{width:140}} type="number" placeholder="Opening float (KES)" value={openFloat} onChange={e=>setOpenFloat(e.target.value)} />
                <button className="btn btn-sm btn-success" onClick={openShift}>
                  <i className="fa-solid fa-door-open" /> Open Shift
                </button>
              </>
          }
          <button className="btn btn-sm btn-outline" onClick={load}><i className="fa-solid fa-rotate" /></button>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 460px',gap:16}}>
        {/* Bills list */}
        <div>
          <div style={{display:'flex',gap:8,marginBottom:12}}>
            <div className="search-bar" style={{flex:1,maxWidth:320}}>
              <i className="fa-solid fa-magnifying-glass" />
              <input placeholder="Search by table or waiter..." value={search} onChange={e=>setSearch(e.target.value)} />
            </div>
            {selected && (
              <button className="btn btn-sm btn-outline" onClick={refreshBillTotal} disabled={refreshing} title="Recalculate bill total from items">
                <i className="fa-solid fa-calculator" /> {refreshing ? 'Recalculating...' : 'Recalc Total'}
              </button>
            )}
          </div>

          {filtered.length === 0
            ? <div className="empty-state"><i className="fa-solid fa-receipt" /><p>No pending bills</p></div>
            : <div className="bills-list">
                {filtered.map(bill => (
                  <div key={bill.id} className="bill-card"
                    style={selected?.id===bill.id?{borderColor:'#F59E0B',background:'#FFFBEB',boxShadow:'0 4px 20px rgba(245,158,11,0.2)'}:{}}
                    onClick={() => openBill(bill)}
                  >
                    <div className="bill-table">{bill.table_number}</div>
                    <div className="bill-info">
                      <div style={{fontSize:14,fontWeight:700}}>Table {bill.table_number}</div>
                      <div style={{fontSize:12,color:'#78716C',marginTop:2}}>
                        <i className="fa-solid fa-user" style={{marginRight:4}} />Waiter: {bill.waiter_name||'—'}
                      </div>
                      <div style={{fontSize:11,color:'#A8A29E',marginTop:1}}>
                        <i className="fa-solid fa-clock" style={{marginRight:4}} />{new Date(bill.created_at).toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit'})}
                      </div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div className="bill-total">{fmt(bill.total)}</div>
                      <span className="badge badge-amber" style={{marginTop:4}}>Unpaid</span>
                    </div>
                    <i className="fa-solid fa-chevron-right" style={{color:'#D97706'}} />
                  </div>
                ))}
              </div>
          }
        </div>

        {/* Payment panel */}
        <div>
          {!selected && (
            <div className="card" style={{padding:48,textAlign:'center'}}>
              <i className="fa-solid fa-hand-pointer" style={{fontSize:44,color:'#D1D5DB',marginBottom:12,display:'block'}} />
              <p style={{color:'#78716C',fontSize:14}}>Select a bill to process payment</p>
            </div>
          )}

          {selected && success && successData && (
            <div className="card" style={{padding:40,textAlign:'center'}}>
              <i className="fa-solid fa-circle-check" style={{fontSize:60,color:'#10B981',marginBottom:16,display:'block'}} />
              <h3 style={{fontFamily:'Poppins',fontSize:20,marginBottom:6}}>Payment Complete!</h3>
              <p style={{color:'#78716C',marginBottom:16}}>Receipt printed automatically</p>
              {change > 0 && (
                <div style={{background:'#D1FAE5',border:'2px solid #10B981',borderRadius:12,padding:'12px 20px',marginBottom:16}}>
                  <div style={{fontSize:12,color:'#065F46',fontWeight:700,marginBottom:4}}>CHANGE DUE</div>
                  <div style={{fontFamily:'Montserrat',fontSize:28,fontWeight:800,color:'#065F46'}}>{fmt(change)}</div>
                </div>
              )}
              <button className="btn btn-outline" onClick={()=>printReceipt(successData)}>
                <i className="fa-solid fa-print" /> Reprint Receipt
              </button>
            </div>
          )}

          {selected && !success && billDetail && (
            <div className="card">
              {/* Bill header */}
              <div style={{padding:'16px 20px',borderBottom:'1px solid #E7E5E4',background:'#FFFBEB',borderRadius:'12px 12px 0 0'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{fontFamily:'Poppins',fontWeight:800,fontSize:17}}>Table {billDetail.table_number}</div>
                    <div style={{fontSize:12,color:'#78716C',marginTop:2}}>
                      <i className="fa-solid fa-user" style={{marginRight:5,color:'#D97706'}} />
                      Waiter: <strong>{billDetail.waiter_name||'—'}</strong>
                    </div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontFamily:'Montserrat',fontWeight:900,fontSize:24,color:'#D97706'}}>{fmt(netTotal)}</div>
                    {discount > 0 && (
                      <div style={{fontSize:11,color:'#10B981',marginTop:2}}>
                        <i className="fa-solid fa-tag" style={{marginRight:3}} />Saved: −{fmt(discount)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Items */}
              <div style={{padding:'10px 20px',maxHeight:160,overflowY:'auto',borderBottom:'1px solid #E7E5E4'}}>
                {billDetail.items?.map((item,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:12.5,padding:'4px 0',borderBottom:i<billDetail.items.length-1?'1px solid #F5F5F4':'none'}}>
                    <span style={{color:'#44403C'}}>{item.quantity}× {item.item_name}</span>
                    <span style={{fontWeight:700}}>KES {(item.quantity*item.unit_price).toLocaleString('en-KE',{minimumFractionDigits:2})}</span>
                  </div>
                ))}
              </div>

              <div style={{padding:'14px 20px'}}>
                {/* Promo label */}
                {discountLabel && (
                  <div style={{background:'#D1FAE5',border:'1px solid #A7F3D0',borderRadius:8,padding:'8px 12px',marginBottom:12,fontSize:12,color:'#065F46',display:'flex',alignItems:'center',gap:8}}>
                    <i className="fa-solid fa-tag" />
                    <span><strong>Promo applied:</strong> {discountLabel}</span>
                    <button style={{marginLeft:'auto',background:'none',border:'none',cursor:'pointer',color:'#065F46',fontSize:14}} onClick={()=>{setDiscount(0);setDiscountLabel('');}}>✕</button>
                  </div>
                )}

                {/* Discount input + quick presets */}
                <div style={{marginBottom:14}}>
                  <label style={{fontSize:12,fontWeight:700,color:'#78716C',display:'block',marginBottom:6}}>
                    <i className="fa-solid fa-percent" style={{marginRight:4,color:'#D97706'}} />Discount (KES)
                  </label>
                  <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
                    <input type="number" className="form-input" style={{flex:1,minWidth:100}}
                      value={discount}
                      onChange={e=>{setDiscount(Number(e.target.value)||0); setDiscountLabel('Manual discount');}}
                      min={0} max={netTotal + discount}
                    />
                    {[10,15,20,50].map(pct => (
                      <button key={pct} className="btn btn-sm btn-outline" style={{padding:'4px 8px',fontSize:11}}
                        onClick={() => applyDiscountPreset(pct)}>
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment method selector */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:14}}>
                  {[
                    {id:'cash', icon:'fa-money-bill-wave', label:'Cash',    color:'#10B981'},
                    {id:'mpesa',icon:'fa-mobile-screen',  label:'M-Pesa',   color:'#059669'},
                    {id:'card', icon:'fa-credit-card',    label:'Card/PDQ', color:'#3B82F6'},
                    {id:'split',icon:'fa-divide',         label:'Split',    color:'#8B5CF6'},
                  ].map(m=>(
                    <div key={m.id} onClick={()=>{setPayMethod(m.id); setPaymentError('');}} style={{
                      border:`2px solid ${payMethod===m.id?m.color:'#E7E5E4'}`,
                      background: payMethod===m.id ? `${m.color}15` : '#FAFAF9',
                      borderRadius:10, padding:'12px 6px', cursor:'pointer', textAlign:'center', transition:'all 0.15s',
                    }}>
                      <i className={`fa-solid ${m.icon}`} style={{fontSize:20,color:payMethod===m.id?m.color:'#C0BBBB',display:'block',marginBottom:4}} />
                      <span style={{fontSize:10,fontWeight:700,color:payMethod===m.id?'#1C1917':'#9CA3AF'}}>{m.label}</span>
                    </div>
                  ))}
                </div>

                {/* Cash input */}
                {(payMethod==='cash'||payMethod==='split') && (
                  <div className="form-group">
                    <label className="form-label">Cash Received (KES)</label>
                    <input type="number" className="form-input" value={cashAmt}
                      onChange={e=>setCashAmt(e.target.value)}
                      placeholder={fmt(netTotal)}
                    />
                    {change > 0 && (
                      <div style={{marginTop:8,padding:'10px 14px',background:'#D1FAE5',borderRadius:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontSize:13,fontWeight:700,color:'#065F46'}}><i className="fa-solid fa-arrow-left" style={{marginRight:6}} />Change Due</span>
                        <span style={{fontFamily:'Montserrat',fontSize:18,fontWeight:800,color:'#065F46'}}>{fmt(change)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* M-Pesa input */}
                {(payMethod==='mpesa'||payMethod==='split') && (
                  <div className="form-group">
                    <label className="form-label">M-Pesa Amount (KES)</label>
                    <input type="number" className="form-input" value={mpesaAmt}
                      onChange={e=>setMpesaAmt(e.target.value)}
                      placeholder={payMethod==='mpesa'?fmt(netTotal):'Amount via M-Pesa'}
                      style={{marginBottom:8}}
                    />
                    <div style={{display:'flex',gap:8}}>
                      <input className="form-input" value={mpesaPhone} onChange={e=>setMpesaPhone(e.target.value)}
                        placeholder="07XX XXX XXX (STK Push)" style={{flex:1}} />
                      <button className="btn btn-secondary btn-sm" onClick={initiateMpesa} disabled={mpesaLoading} style={{whiteSpace:'nowrap'}}>
                        {mpesaLoading
                          ? <span className="spinner" style={{width:14,height:14,borderWidth:2}}/>
                          : <><i className="fa-solid fa-paper-plane" /> STK Push</>
                        }
                      </button>
                    </div>
                  </div>
                )}

                {/* Card input */}
                {(payMethod==='card'||payMethod==='split') && (
                  <div className="form-group">
                    <label className="form-label">Card/PDQ Amount (KES)</label>
                    <input type="number" className="form-input" value={cardAmt}
                      onChange={e=>setCardAmt(e.target.value)}
                      placeholder={payMethod==='card'?fmt(netTotal):'Amount via card'}
                    />
                  </div>
                )}

                {/* Split summary */}
                {payMethod === 'split' && (
                  <div style={{background:'#F5F3FF',border:'1px solid #DDD6FE',borderRadius:8,padding:'10px 12px',marginBottom:12,fontSize:12}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                      <span>Split total:</span>
                      <strong style={{color: totalPaid >= netTotal ? '#059669' : '#DC2626'}}>
                        {fmt(totalPaid)}
                      </strong>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between'}}>
                      <span>Bill total:</span>
                      <strong>{fmt(netTotal)}</strong>
                    </div>
                    {totalPaid >= netTotal && (
                      <div style={{marginTop:4,color:'#059669',fontWeight:700}}>
                        ✓ {totalPaid > netTotal ? `Change: ${fmt(totalPaid - netTotal)}` : 'Exact amount'}
                      </div>
                    )}
                  </div>
                )}

                {/* Underpayment warning */}
                {isUnderpaid && payMethod !== 'split' && (
                  <div style={{background:'#FEF3C7',border:'1px solid #FCD34D',borderRadius:8,padding:'8px 12px',marginBottom:10,fontSize:12,color:'#92400E'}}>
                    <i className="fa-solid fa-triangle-exclamation" style={{marginRight:6}} />
                    Amount entered is {fmt(netTotal - totalPaid)} short of the bill total.
                  </div>
                )}

                {/* Payment error */}
                {paymentError && (
                  <div style={{background:'#FEE2E2',border:'1px solid #FCA5A5',borderRadius:8,padding:'8px 12px',marginBottom:10,fontSize:12,color:'#991B1B'}}>
                    <i className="fa-solid fa-circle-xmark" style={{marginRight:6}} />
                    {paymentError}
                  </div>
                )}

                {/* Confirm payment button */}
                <button
                  className="btn btn-success btn-full btn-lg"
                  onClick={processPayment}
                  disabled={processing}
                  style={{fontFamily:'Poppins',fontWeight:700}}
                >
                  {processing
                    ? <><span className="spinner" style={{width:18,height:18,borderWidth:2}}/> Processing…</>
                    : <><i className="fa-solid fa-circle-check" /> Confirm Payment · {fmt(netTotal)}</>
                  }
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Close Shift Modal */}
      {closingModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setClosingModal(false)}>
          <div className="modal" style={{maxWidth:500}}>
            <div className="modal-header">
              <span className="modal-title"><i className="fa-solid fa-door-closed" style={{marginRight:8,color:'#EF4444'}} />Close Shift</span>
              <button className="modal-close" onClick={()=>setClosingModal(false)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="modal-body">
              {/* Shift summary */}
              {shiftSummary && (
                <div style={{background:'#F0FDF4',border:'1px solid #86EFAC',borderRadius:10,padding:14,marginBottom:16}}>
                  <div style={{fontWeight:700,fontSize:13,color:'#065F46',marginBottom:8}}>
                    <i className="fa-solid fa-chart-bar" style={{marginRight:6}} />Shift Summary
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,fontSize:12}}>
                    <div style={{textAlign:'center',background:'white',borderRadius:8,padding:'8px 4px'}}>
                      <div style={{color:'#78716C',fontSize:10}}>TOTAL SALES</div>
                      <div style={{fontWeight:800,color:'#065F46',fontSize:14}}>{fmt(shiftSummary.today?.total_sales||0)}</div>
                    </div>
                    <div style={{textAlign:'center',background:'white',borderRadius:8,padding:'8px 4px'}}>
                      <div style={{color:'#78716C',fontSize:10}}>ORDERS</div>
                      <div style={{fontWeight:800,color:'#1C1917',fontSize:14}}>{shiftSummary.today?.order_count||0}</div>
                    </div>
                    <div style={{textAlign:'center',background:'white',borderRadius:8,padding:'8px 4px'}}>
                      <div style={{color:'#78716C',fontSize:10}}>FLOAT</div>
                      <div style={{fontWeight:800,color:'#1C1917',fontSize:14}}>{fmt(activeShift?.opening_float||0)}</div>
                    </div>
                  </div>
                </div>
              )}

              <div style={{background:'#FEF3C7',border:'1px solid #FCD34D',borderRadius:8,padding:12,marginBottom:16,fontSize:13}}>
                <i className="fa-solid fa-circle-info" style={{color:'#D97706',marginRight:6}} />
                Count your till and enter the actual amounts you have on hand.
              </div>

              {[['cash','Cash in Till (KES)','fa-money-bill'],['mpesa','M-Pesa Total (KES)','fa-mobile-screen'],['card','Card/PDQ Total (KES)','fa-credit-card']].map(([key,label,icon])=>(
                <div className="form-group" key={key}>
                  <label className="form-label"><i className={`fa-solid ${icon}`} style={{marginRight:6,color:'#D97706'}} />{label}</label>
                  <input type="number" className="form-input"
                    value={closingData[key]}
                    onChange={e=>setClosingData({...closingData,[key]:e.target.value})}
                    placeholder="0.00"
                  />
                </div>
              ))}
              <div className="form-group">
                <label className="form-label">Notes / Discrepancies</label>
                <textarea className="form-textarea"
                  value={closingData.notes}
                  onChange={e=>setClosingData({...closingData,notes:e.target.value})}
                  placeholder="Any notes about this shift (e.g. cash discrepancies, voids)..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={()=>setClosingModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={closeShift}>
                <i className="fa-solid fa-door-closed" /> Close Shift
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
