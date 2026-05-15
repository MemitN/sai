import React, { useState, useEffect } from 'react';
import api from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';

// Use absolute paths - these will work in both dev and production
const logoSrc = '/logo.jpeg';
const bgSrc = '/bg.png';

export default function LoginPage() {
  const { login } = useAuth();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scale, setScale] = useState(1);

  // Auto-scale based on screen size
  useEffect(() => {
    const updateScale = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const minDimension = Math.min(width, height);
      if (minDimension < 500) {
        setScale(minDimension / 500);
      } else {
        setScale(1);
      }
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  const handleNumber = (num) => {
    if (pin.length < 4) {
      setPin(pin + num);
      setError('');
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
  };

  const handleLogin = async () => {
    if (pin.length !== 4) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/login', { code: pin });
      login(data.user, data.token);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid PIN');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const backgroundStyle = bgSrc ? {
    backgroundImage: `url(${bgSrc})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  } : {
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
  };

  // Responsive sizing
  const containerPadding = 20 * scale;
  const cardPadding = 40 * scale;
  const cardMaxWidth = 450 * scale;
  const logoSize = 80 * scale;
  const titleSize = 26 * scale;
  const pinDotSize = 14 * scale;
  const pinDotGap = 12 * scale;
  const buttonPadding = 18 * scale;
  const buttonFontSize = 24 * scale;
  const buttonGap = 10 * scale;
  const signInPadding = 16 * scale;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: containerPadding,
      ...backgroundStyle,
      position: 'relative',
    }}>
      {/* Dark overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.6)',
      }} />
      
      {/* Login Card */}
      <div style={{
        position: 'relative',
        background: 'white',
        borderRadius: 32 * scale,
        padding: cardPadding,
        width: '60%',
        maxWidth: cardMaxWidth,
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        zIndex: 1,
      }}>
        
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 * scale }}>
          {logoSrc ? (
            <img 
              src={logoSrc} 
              alt="Sai Lounge" 
              style={{ 
                width: logoSize, 
                height: logoSize, 
                borderRadius: '50%', 
                objectFit: 'cover', 
                marginBottom: 12 * scale,
                border: `${2 * scale}px solid #F59E0B`,
              }} 
            />
          ) : (
            <div style={{ fontSize: 56 * scale, marginBottom: 12 * scale }}>🍹</div>
          )}
          <h1 style={{ 
            fontSize: titleSize, 
            fontWeight: 700, 
            marginBottom: 4 * scale, 
            color: '#1a1a1a' 
          }}>Sai Lounge</h1>
          <p style={{ color: '#666', fontSize: 12 * scale }}>Restaurant & Bar POS System</p>
        </div>

        {/* PIN Dots - 4 digits */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: pinDotGap, 
          marginBottom: 28 * scale 
        }}>
          {[0,1,2,3].map(i => (
            <div
              key={i}
              style={{
                width: pinDotSize,
                height: pinDotSize,
                borderRadius: '50%',
                backgroundColor: i < pin.length ? '#F59E0B' : '#ddd',
                transition: 'all 0.1s',
              }}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: '#fee2e2',
            color: '#dc2626',
            padding: 10 * scale,
            borderRadius: 10 * scale,
            textAlign: 'center',
            fontSize: 13 * scale,
            marginBottom: 20 * scale,
          }}>
            {error}
          </div>
        )}

        {/* Number Pad */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(4, 1fr)', 
          gap: buttonGap, 
          marginBottom: buttonGap 
        }}>
          <button onClick={() => handleNumber('7')} style={{
            ...buttonStyle,
            padding: `${buttonPadding}px 12px`,
            fontSize: buttonFontSize,
            borderRadius: 14 * scale,
          }}>7</button>
          <button onClick={() => handleNumber('8')} style={{
            ...buttonStyle,
            padding: `${buttonPadding}px 12px`,
            fontSize: buttonFontSize,
            borderRadius: 14 * scale,
          }}>8</button>
          <button onClick={() => handleNumber('9')} style={{
            ...buttonStyle,
            padding: `${buttonPadding}px 12px`,
            fontSize: buttonFontSize,
            borderRadius: 14 * scale,
          }}>9</button>
          <button onClick={handleClear} style={{
            ...buttonStyle,
            padding: `${buttonPadding}px 12px`,
            fontSize: buttonFontSize,
            borderRadius: 14 * scale,
            background: '#fee2e2',
            color: '#dc2626',
          }}>C</button>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(4, 1fr)', 
          gap: buttonGap, 
          marginBottom: buttonGap 
        }}>
          <button onClick={() => handleNumber('4')} style={{
            ...buttonStyle,
            padding: `${buttonPadding}px 12px`,
            fontSize: buttonFontSize,
            borderRadius: 14 * scale,
          }}>4</button>
          <button onClick={() => handleNumber('5')} style={{
            ...buttonStyle,
            padding: `${buttonPadding}px 12px`,
            fontSize: buttonFontSize,
            borderRadius: 14 * scale,
          }}>5</button>
          <button onClick={() => handleNumber('6')} style={{
            ...buttonStyle,
            padding: `${buttonPadding}px 12px`,
            fontSize: buttonFontSize,
            borderRadius: 14 * scale,
          }}>6</button>
          <button onClick={handleDelete} style={{
            ...buttonStyle,
            padding: `${buttonPadding}px 12px`,
            fontSize: buttonFontSize * 0.8,
            borderRadius: 14 * scale,
          }}>⌫</button>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(4, 1fr)', 
          gap: buttonGap, 
          marginBottom: buttonGap 
        }}>
          <button onClick={() => handleNumber('1')} style={{
            ...buttonStyle,
            padding: `${buttonPadding}px 12px`,
            fontSize: buttonFontSize,
            borderRadius: 14 * scale,
          }}>1</button>
          <button onClick={() => handleNumber('2')} style={{
            ...buttonStyle,
            padding: `${buttonPadding}px 12px`,
            fontSize: buttonFontSize,
            borderRadius: 14 * scale,
          }}>2</button>
          <button onClick={() => handleNumber('3')} style={{
            ...buttonStyle,
            padding: `${buttonPadding}px 12px`,
            fontSize: buttonFontSize,
            borderRadius: 14 * scale,
          }}>3</button>
          <div />
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(4, 1fr)', 
          gap: buttonGap 
        }}>
          <div />
          <button onClick={() => handleNumber('0')} style={{
            ...buttonStyle,
            padding: `${buttonPadding}px 12px`,
            fontSize: buttonFontSize,
            borderRadius: 14 * scale,
          }}>0</button>
          <div />
          <div />
        </div>

        {/* Sign In Button */}
        <button
          onClick={handleLogin}
          disabled={loading || pin.length !== 4}
          style={{
            width: '100%',
            marginTop: 24 * scale,
            padding: `${signInPadding}px`,
            background: pin.length === 4 && !loading ? '#F59E0B' : '#ccc',
            border: 'none',
            borderRadius: 14 * scale,
            fontSize: 16 * scale,
            fontWeight: 700,
            color: pin.length === 4 && !loading ? '#1a1a1a' : '#888',
            cursor: pin.length === 4 && !loading ? 'pointer' : 'not-allowed',
          }}
        >
          {loading ? 'Please wait...' : 'Sign In'}
        </button>

        {/* Forgot Password Link - Only for Admin/Management */}
        <div style={{ 
          textAlign: 'center', 
          marginTop: 16 * scale,
          paddingTop: 12 * scale,
          borderTop: '1px solid #E7E5E4'
        }}>
          <a 
            href="/reset-password" 
            style={{ 
              color: '#F59E0B', 
              fontSize: 12 * scale, 
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6 * scale,
              transition: 'opacity 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            <i className="fa-solid fa-key" style={{ fontSize: 11 * scale }} />
            Forgot Password? (Admin/Management only)
          </a>
        </div>
      </div>
    </div>
  );
}

const buttonStyle = {
  background: '#f0f0f0',
  border: 'none',
  fontWeight: 600,
  cursor: 'pointer',
  transition: '0.08s',
  textAlign: 'center',
};