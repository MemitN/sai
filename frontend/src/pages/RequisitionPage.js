// frontend/src/pages/RequisitionPage.js
import React, { useState, useEffect, useCallback } from 'react';
import api from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';

function fmt(n) { return `KES ${Number(n || 0).toLocaleString()}`; }

export default function RequisitionPage() {
  const { user } = useAuth();
  const [requisitions, setRequisitions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [period, setPeriod] = useState('daily');
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [department, setDepartment] = useState('all');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ department: 'kitchen', items: [], notes: '', requested_by: '' });
  const [inventory, setInventory] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (period === 'custom') {
        params.append('from', dateFrom);
        params.append('to', dateTo);
      } else {
        params.append('period', period);
      }
      if (department !== 'all') params.append('department', department);
      
      const { data } = await api.get(`/reports/requisitions?${params}`);
      setRequisitions(data.requisitions || []);
      setSummary(data.summary);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [period, dateFrom, dateTo, department]);

  const loadInventory = async () => {
    try {
      const { data } = await api.get('/reports/inventory');
      setInventory(data.items || []);
    } catch(e) { console.error(e); }
  };

  useEffect(() => { load(); }, [load]);

  const openNewRequisition = () => {
    loadInventory();
    setForm({ department: 'kitchen', items: [], notes: '', requested_by: user?.name || '' });
    setModal('new');
  };

  const addRequisitionItem = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { inventory_id: '', quantity: 1, unit: '', name: '' }]
    }));
  };

  const updateRequisitionItem = (index, field, value) => {
    setForm(prev => {
      const newItems = [...prev.items];
      if (field === 'inventory_id') {
        const selectedItem = inventory.find(i => i.id === parseInt(value));
        newItems[index] = {
          ...newItems[index],
          inventory_id: value,
          name: selectedItem?.name || '',
          unit: selectedItem?.unit || 'pcs'
        };
      } else {
        newItems[index] = { ...newItems[index], [field]: value };
      }
      return { ...prev, items: newItems };
    });
  };

  const removeRequisitionItem = (index) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const submitRequisition = async () => {
    if (!form.items.length || !form.requested_by) {
      alert('Please add at least one item and provide requested by name');
      return;
    }
    setSaving(true);
    try {
      await api.post('/requisitions', form);
      setModal(null);
      load();
      alert('Requisition submitted successfully!');
    } catch(e) {
      alert('Error: ' + (e.response?.data?.error || e.message));
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/requisitions/${id}/status`, { status });
      load();
    } catch(e) { alert('Error: ' + e.message); }
  };

  const exportCSV = () => {
    if (!requisitions.length) return alert('No data to export');
    const headers = ['Date', 'Department', 'Requested By', 'Items', 'Status', 'Approved/Issued By', 'Notes'];
    const rows = requisitions.map(r => [
      new Date(r.created_at).toLocaleDateString(),
      r.department,
      r.requested_by,
      r.items?.map(i => `${i.quantity}× ${i.name}`).join('; '),
      r.status,
      r.approved_by || r.issued_by || '—',
      r.notes || '—'
    ]);
    const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv,' + encodeURIComponent(csv);
    a.download = `requisitions_${period}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const getStatusBadge = (status) => {
    const config = {
      pending: { bg: '#FEF3C7', color: '#92400E', text: '⏳ Pending' },
      approved: { bg: '#D1FAE5', color: '#065F46', text: '✓ Approved' },
      issued: { bg: '#DBEAFE', color: '#1E40AF', text: '📦 Issued' },
      rejected: { bg: '#FEE2E2', color: '#991B1B', text: '✗ Rejected' }
    };
    const c = config[status] || config.pending;
    return <span style={{ background: c.bg, color: c.color, padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{c.text}</span>;
  };

  const canCreate = ['admin', 'management', 'bar_attendant', 'kitchen'].includes(user?.role);
  const canApprove = ['admin', 'management'].includes(user?.role);

  return (
    <div>
      <div className="page-header">
        <h2><i className="fa-solid fa-clipboard-list" style={{ marginRight: 8, color: '#F59E0B' }} />Requisition Reports</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {canCreate && (
            <button className="btn btn-primary" onClick={openNewRequisition}>
              <i className="fa-solid fa-plus" /> New Requisition
            </button>
          )}
          <button className="btn btn-outline" onClick={exportCSV}>
            <i className="fa-solid fa-download" /> Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        background: '#1a1a1a',
        borderRadius: 12,
        padding: '12px 16px',
        marginBottom: 20,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: 'white', fontSize: 12, fontWeight: 500 }}>Period:</span>
          {['daily', 'weekly', 'monthly', 'custom'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '5px 14px',
                borderRadius: 20,
                border: 'none',
                background: period === p ? '#F59E0B' : 'rgba(255,255,255,0.1)',
                color: period === p ? '#1C1917' : 'rgba(255,255,255,0.7)',
                fontSize: 12,
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {p}
            </button>
          ))}
        </div>
        
        {period === 'custom' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="date"
              className="form-input"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              style={{ background: '#0a0a0a', color: 'white', borderColor: '#333' }}
            />
            <span style={{ color: '#78716C' }}>to</span>
            <input
              type="date"
              className="form-input"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              style={{ background: '#0a0a0a', color: 'white', borderColor: '#333' }}
            />
          </div>
        )}

        <select
          className="form-select"
          value={department}
          onChange={e => setDepartment(e.target.value)}
          style={{ width: 140, background: '#0a0a0a', color: 'white', borderColor: '#333' }}
        >
          <option value="all">All Departments</option>
          <option value="kitchen">Kitchen</option>
          <option value="bar">Bar</option>
          <option value="store">Store</option>
          <option value="equipment">Equipment</option>
        </select>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: '#78716C' }}>Total Requisitions</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{summary.total_requisitions || 0}</div>
          </div>
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: '#78716C' }}>Total Items Requested</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{summary.total_items || 0}</div>
          </div>
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: '#78716C' }}>Pending Approval</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#F59E0B' }}>{summary.pending_count || 0}</div>
          </div>
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: '#78716C' }}>Completed</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#10B981' }}>{summary.completed_count || 0}</div>
          </div>
        </div>
      )}

      {/* Requisitions Table */}
      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : (
        <div className="card">
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Department</th>
                  <th>Requested By</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th>Approved/Issued By</th>
                  <th>Notes</th>
                  {canApprove && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {requisitions.map(req => (
                  <tr key={req.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(req.created_at).toLocaleDateString()}</td>
                    <td>
                      <span className={`tag ${req.department === 'bar' ? 'tag-bar' : 'tag-kitchen'}`}>
                        {req.department}
                      </span>
                    </td>
                    <td>{req.requested_by}</td>
                    <td>
                      <div style={{ fontSize: 11 }}>
                        {req.items?.slice(0, 3).map((item, idx) => (
                          <div key={idx}>• {item.quantity}× {item.name}</div>
                        ))}
                        {req.items?.length > 3 && <div style={{ color: '#78716C' }}>+{req.items.length - 3} more</div>}
                      </div>
                    </td>
                    <td>{getStatusBadge(req.status)}</td>
                    <td>{req.approved_by || req.issued_by || '—'}</td>
                    <td style={{ maxWidth: 150, whiteSpace: 'normal', fontSize: 11 }}>{req.notes || '—'}</td>
                    {canApprove && (
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {req.status === 'pending' && (
                            <>
                              <button
                                className="btn btn-sm btn-success"
                                onClick={() => updateStatus(req.id, 'approved')}
                                title="Approve"
                              >
                                <i className="fa-solid fa-check" />
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => updateStatus(req.id, 'rejected')}
                                title="Reject"
                              >
                                <i className="fa-solid fa-times" />
                              </button>
                            </>
                          )}
                          {req.status === 'approved' && (
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => updateStatus(req.id, 'issued')}
                              title="Mark as Issued"
                            >
                              <i className="fa-solid fa-box" /> Issue
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {requisitions.length === 0 && (
                  <tr>
                    <td colSpan={canApprove ? 8 : 7} style={{ textAlign: 'center', padding: 48, color: '#A8A29E' }}>
                      <i className="fa-solid fa-clipboard-list" style={{ fontSize: 40, opacity: 0.3, marginBottom: 12, display: 'block' }} />
                      No requisitions found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Requisition Modal */}
      {modal === 'new' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal modal-lg" style={{ maxWidth: 700 }}>
            <div className="modal-header">
              <span className="modal-title">
                <i className="fa-solid fa-clipboard-list" style={{ marginRight: 8, color: '#F59E0B' }} />
                New Stock Requisition
              </span>
              <button className="modal-close" onClick={() => setModal(null)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select
                    className="form-select"
                    value={form.department}
                    onChange={e => setForm({ ...form, department: e.target.value })}
                  >
                    <option value="kitchen">Kitchen</option>
                    <option value="bar">Bar</option>
                    <option value="store">Store</option>
                    <option value="equipment">Equipment</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Requested By</label>
                  <input
                    className="form-input"
                    value={form.requested_by}
                    onChange={e => setForm({ ...form, requested_by: e.target.value })}
                    placeholder="Your name"
                  />
                </div>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label className="form-label">Items Requested</label>
                  <button className="btn btn-sm btn-outline" onClick={addRequisitionItem}>
                    <i className="fa-solid fa-plus" /> Add Item
                  </button>
                </div>
                {form.items.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <select
                      className="form-select"
                      value={item.inventory_id}
                      onChange={e => updateRequisitionItem(idx, 'inventory_id', e.target.value)}
                      style={{ flex: 2 }}
                    >
                      <option value="">Select Item</option>
                      {inventory
                        .filter(i => form.department === 'all' || i.department === form.department)
                        .map(inv => (
                          <option key={inv.id} value={inv.id}>{inv.name} ({inv.quantity} {inv.unit} available)</option>
                        ))}
                    </select>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={e => updateRequisitionItem(idx, 'quantity', e.target.value)}
                      style={{ width: 80 }}
                      min={1}
                    />
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => removeRequisitionItem(idx)}
                      disabled={form.items.length === 1}
                    >
                      <i className="fa-solid fa-trash" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="form-group">
                <label className="form-label">Notes / Reason</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Reason for requisition, urgency, etc."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitRequisition} disabled={saving}>
                {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <><i className="fa-solid fa-paper-plane" /> Submit Requisition</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}