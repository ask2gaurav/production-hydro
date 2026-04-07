import { useEffect, useState } from 'react';

const OfflineBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);

    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a5c99 0%, #063d6b 100%)',
      color: '#ffffff',
      fontFamily: 'sans-serif',
      padding: '32px',
      textAlign: 'center',
    }}>
      {/* Wave / no-wifi icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="96"
        height="96"
        viewBox="0 0 24 24"
        fill="none"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ marginBottom: '24px' }}
      >
        {/* wifi arcs crossed out */}
        <line x1="2" y1="2" x2="22" y2="22" />
        <path d="M8.5 16.5a5 5 0 0 1 7 0" />
        <path d="M5 13a10 10 0 0 1 5.17-2.83" />
        <path d="M19 13a10 10 0 0 0-2.24-1.54" />
        <path d="M2 8.82a15 15 0 0 1 4.17-2.65" />
        <path d="M22 8.82A15 15 0 0 0 8.93 6.33" />
        <circle cx="12" cy="20" r="1" fill="rgba(255,255,255,0.9)" stroke="none" />
      </svg>

      <h1 style={{
        fontSize: '28px',
        fontWeight: 700,
        margin: '0 0 12px',
        letterSpacing: '-0.5px',
      }}>
        You're Offline
      </h1>

      <p style={{
        fontSize: '16px',
        lineHeight: 1.6,
        maxWidth: '360px',
        margin: '0 0 32px',
        opacity: 0.85,
      }}>
        Please check your internet connection and try again. The app will reconnect automatically once you're back online.
      </p>

      <button
        onClick={() => window.location.reload()}
        style={{
          background: 'rgba(255,255,255,0.15)',
          border: '2px solid rgba(255,255,255,0.6)',
          borderRadius: '8px',
          color: '#ffffff',
          cursor: 'pointer',
          fontSize: '15px',
          fontWeight: 600,
          padding: '12px 32px',
          backdropFilter: 'blur(4px)',
          transition: 'background 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
      >
        Try Again
      </button>

      <p style={{
        marginTop: '24px',
        fontSize: '13px',
        opacity: 0.55,
      }}>
        Hydrotherapy System
      </p>
    </div>
  );
};

export default OfflineBanner;
