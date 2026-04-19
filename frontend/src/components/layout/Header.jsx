import { useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import useThemeStore from '../../store/themeStore';

export default function Header({ titulo, subtitulo }) {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);
  const { theme, toggleTheme } = useThemeStore();

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
        background: 'rgba(10,17,40,.85)',
        backdropFilter: 'blur(20px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
        borderBottom: '1px solid rgba(255,255,255,.04)',
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

      <div className="flex items-center gap-2">
        {/* ─── Theme Toggle ─── */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
          className="flex items-center justify-center rounded-lg transition-all duration-300"
          style={{
            width: 34,
            height: 34,
            background: 'rgba(255,255,255,.03)',
            border: '1px solid rgba(255,255,255,.06)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(201,168,76,.08)';
            e.currentTarget.style.borderColor = 'rgba(201,168,76,.15)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,.03)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,.06)';
          }}
        >
          <i
            className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'} text-sm transition-all duration-300`}
            style={{ color: 'var(--text-muted)' }}
          />
        </button>

        {/* ─── Gear / Configurações ─── */}
        <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowMenu(v => !v)}
          className="flex items-center justify-center rounded-lg transition-all duration-300"
          style={{
            width: 34,
            height: 34,
            background: showMenu ? 'rgba(201,168,76,.08)' : 'rgba(255,255,255,.03)',
            border: `1px solid ${showMenu ? 'rgba(201,168,76,.15)' : 'rgba(255,255,255,.06)'}`,
          }}
          title="Configurações"
          onMouseEnter={e => {
            if (!showMenu) {
              e.currentTarget.style.background = 'rgba(201,168,76,.06)';
              e.currentTarget.style.borderColor = 'rgba(201,168,76,.12)';
              e.currentTarget.style.boxShadow = '0 0 16px rgba(201,168,76,.06)';
            }
          }}
          onMouseLeave={e => {
            if (!showMenu) {
              e.currentTarget.style.background = 'rgba(255,255,255,.03)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,.06)';
              e.currentTarget.style.boxShadow = '';
            }
          }}
        >
          <i className="fas fa-gear text-sm transition-transform duration-300 hover:rotate-90" style={{ color: showMenu ? 'var(--accent)' : 'var(--text-muted)' }} />
        </button>

        {showMenu && (
          <div
            className="absolute right-0 mt-2 animate-fadeInFast"
            style={{
              width: 240,
              background: 'rgba(10,17,40,.95)',
              backdropFilter: 'blur(20px) saturate(1.3)',
              WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
              border: '1px solid rgba(255,255,255,.08)',
              borderRadius: 'var(--radius)',
              boxShadow: '0 16px 48px rgba(0,0,0,.6)',
              overflow: 'hidden',
              zIndex: 100,
            }}
          >
            <div className="px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                Configurações
              </p>
            </div>
            {menuItems.map(item => (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setShowMenu(false); }}
                className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-left transition-all duration-300"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(201,168,76,.06)';
                  e.currentTarget.style.color = 'var(--accent)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                <i className={`fas ${item.icon} text-xs transition-transform duration-300 group-hover:scale-110`} style={{ width: 16, textAlign: 'center' }} />
                {item.label}
              </button>
            ))}
          </div>
        )}
        </div>
      </div>
    </header>
  );
}
