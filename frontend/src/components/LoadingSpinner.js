import React from 'react';

export default function LoadingSpinner({ size = 40, color = '#F59E0B' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
      <div
        style={{
          width: size,
          height: size,
          border: `3px solid #E7E5E4`,
          borderTopColor: color,
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
