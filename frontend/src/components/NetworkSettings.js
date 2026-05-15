import React, { useState, useEffect } from 'react';
import api, { getNetworkInfo, setApiUrl, testNetworkConnection } from '../hooks/useApi';

export default function NetworkSettings({ onClose }) {
  const [networkInfo, setNetworkInfo] = useState(getNetworkInfo());
  const [manualUrl, setManualUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    setNetworkInfo(getNetworkInfo());
    const savedUrl = localStorage.getItem('pos_api_url');
    if (savedUrl) setManualUrl(savedUrl);
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await testNetworkConnection();
    setTestResult(result);
    setTesting(false);
  };

  const handleSetManualUrl = () => {
    if (manualUrl) {
      setApiUrl(manualUrl);
      setNetworkInfo(getNetworkInfo());
      // Reload to apply new URL
      setTimeout(() => window.location.reload(), 500);
    }
  };

  const handleResetUrl = () => {
    localStorage.removeItem('pos_api_url');
    setManualUrl('');
    window.location.reload();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <span className="modal-title">
            <i className="fa-solid fa-network-wired" style={{ marginRight: 8, color: '#F59E0B' }} />
            Network Settings
          </span>
          <button className="modal-close" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="modal-body">
          <div style={{ background: '#F0FDF4', borderRadius: 8, padding: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: '#065F46', marginBottom: 8 }}>
              <i className="fa-solid fa-circle-info" style={{ marginRight: 6 }} />
              Current Connection:
            </div>
            <div><strong>API URL:</strong> {networkInfo.apiUrl}</div>
            <div><strong>Base URL:</strong> {networkInfo.baseUrl}</div>
            <div><strong>Hostname:</strong> {networkInfo.hostname}</div>
            <div><strong>Network Type:</strong> {networkInfo.isLocalNetwork ? 'Local Network' : 'Localhost'}</div>
          </div>

          <div className="form-group">
            <label className="form-label">Manual Server URL (Optional)</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="http://192.168.1.100:3001"
              value={manualUrl}
              onChange={e => setManualUrl(e.target.value)}
            />
            <div style={{ fontSize: 11, color: '#78716C', marginTop: 4 }}>
              Use this if the automatic detection doesn't work. Leave empty for auto-detection.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-outline btn-sm" onClick={handleTestConnection} disabled={testing}>
              {testing ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <><i className="fa-solid fa-plug" /> Test Connection</>}
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleSetManualUrl}>
              <i className="fa-solid fa-save" /> Apply URL
            </button>
            <button className="btn btn-danger btn-sm" onClick={handleResetUrl}>
              <i className="fa-solid fa-undo" /> Reset to Auto
            </button>
          </div>

          {testResult && (
            <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: testResult.success ? '#D1FAE5' : '#FEE2E2', color: testResult.success ? '#065F46' : '#991B1B' }}>
              {testResult.success ? `✅ Connected to ${testResult.url}` : `❌ Connection failed: ${testResult.error}`}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}