import { useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';

export default function Header({ titulo, subtitulo }) {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    if (showMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const menuItems = [
    { label: 'Dados do Escritório', icon: 'fa-building', path: '/configuracoes/escritorio' },
    { label: 'Modelos de Documentos', icon: 'fa-file-signature', path: '/configuracoes/modelos' },
  ];

  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between px-6 flex-shrink-0"
      style={{
        height: 56,
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div className="min-w-0">
        <h1 className="text-sm font-bold truncate leading-tight">{titulo}</h1>
        {subtitulo && (
          <p className="text-xs truncate leading-tight mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {subtitulo}
          </p>
        )}
      </div>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowMenu(v => !v)}
          className="flex items-center justify-center rounded-lg hover:opacity-80 transition-opacity"
          style={{
            width: 34,
            height: 34,
            background: showMenu ? 'var(--bg-tertiary)' : 'transparent',
            border: '1px solid var(--border)',
          }}
          title="Configurações"
        >
          <i className="fas fa-gear text-sm" style={{ color: showMenu ? 'var(--accent)' : 'var(--text-muted)' }} />
        </button>

        {showMenu && (
          <div
            className="absolute right-0 mt-2 animate-fadeInFast"
            style={{
              width: 240,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius)',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
              zIndex: 100,
            }}
          >
            <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                Configurações
              </p>
            </div>
            {menuItems.map(item => (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setShowMenu(false); }}
                className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-left transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                <i className={`fas ${item.icon} text-xs`} style={{ width: 16, textAlign: 'center' }} />
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
