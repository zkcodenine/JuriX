import { useState, useEffect } from 'react';

/**
 * Fullscreen overlay that blocks the app during mandatory updates.
 * Listens to window.jurixUpdater.onStatus (exposed by Electron preload).
 */
export default function UpdateOverlay() {
  const [status, setStatus] = useState(null); // null | 'available' | 'progress' | 'downloaded' | 'error'
  const [version, setVersion] = useState('');
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    if (!window.jurixUpdater) return;

    window.jurixUpdater.onStatus((data) => {
      switch (data.event) {
        case 'available':
          setStatus('available');
          setVersion(data.version || '');
          break;
        case 'progress':
          setStatus('progress');
          setPercent(data.percent || 0);
          if (data.version) setVersion(data.version);
          break;
        case 'downloaded':
          setStatus('downloaded');
          if (data.version) setVersion(data.version);
          break;
        case 'error':
          // Don't block the app on error — just hide the overlay
          setStatus(null);
          break;
        case 'up-to-date':
          setStatus(null);
          break;
      }
    });
  }, []);

  // Don't render anything if no update in progress
  if (!status) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.92)',
      backdropFilter: 'blur(12px)',
      color: '#fff',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      userSelect: 'none',
    }}>
      {/* Icon */}
      <div style={{
        width: 64,
        height: 64,
        borderRadius: 16,
        background: 'rgba(201, 168, 76, 0.1)',
        border: '1px solid rgba(201, 168, 76, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </div>

      {/* Title */}
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, letterSpacing: '0.5px' }}>
        Atualização Obrigatória
      </h2>

      {/* Version */}
      {version && (
        <p style={{ fontSize: 13, color: '#c9a84c', marginBottom: 24, fontWeight: 600 }}>
          Versão {version}
        </p>
      )}

      {/* Status messages */}
      {status === 'available' && (
        <p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
          Preparando download...
        </p>
      )}

      {status === 'progress' && (
        <>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
            Baixando atualização...
          </p>
          {/* Progress bar */}
          <div style={{
            width: 300,
            height: 4,
            background: '#1a1a1a',
            borderRadius: 2,
            overflow: 'hidden',
            marginBottom: 10,
          }}>
            <div style={{
              height: '100%',
              width: `${percent}%`,
              background: 'linear-gradient(90deg, #a07a2a, #e8c96c)',
              borderRadius: 2,
              transition: 'width 0.3s ease',
            }} />
          </div>
          <p style={{ fontSize: 12, color: '#666' }}>{percent}%</p>
        </>
      )}

      {status === 'downloaded' && (
        <p style={{ fontSize: 13, color: '#c9a84c' }}>
          Atualização concluída. Reiniciando...
        </p>
      )}

      {/* Subtitle */}
      <p style={{ fontSize: 11, color: '#555', marginTop: 24, maxWidth: 320, textAlign: 'center', lineHeight: 1.5 }}>
        O JuriX será atualizado automaticamente. Por favor, aguarde.
      </p>
    </div>
  );
}
