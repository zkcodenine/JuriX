import { NavLink, useLocation } from 'react-router-dom';
import { useState, useMemo } from 'react';
import useAuthStore from '../../store/authStore';
import useThemeStore from '../../store/themeStore';
import { getIniciais } from '../../utils/formatters';
const DEFAULT_AVATAR = '/default-avatar.svg';
import PerfilModal from '../perfil/PerfilModal';

const navItems = [
  { path: '/dashboard', icon: 'fa-gauge-high',     label: 'Dashboard'       },
  { path: '/processos', icon: 'fa-scale-balanced', label: 'Processos'       },
  { path: '/tarefas',   icon: 'fa-list-check',     label: 'Tarefas'         },
  { path: '/agenda',    icon: 'fa-calendar-days',  label: 'Agenda'          },
];

const planBadge = {
  GRATUITO:  { bg: 'rgba(99,102,241,.08)',  color: '#818cf8', border: 'rgba(99,102,241,.15)', label: 'GRATUITO'   },
  MENSAL:    { bg: 'rgba(201,168,76,.08)',  color: '#C9A84C', border: 'rgba(201,168,76,.15)',  label: 'MENSAL'     },
  ANUAL:     { bg: 'rgba(201,168,76,.08)',  color: '#C9A84C', border: 'rgba(201,168,76,.15)',  label: 'ANUAL'      },
  VITALICIO: { bg: 'rgba(16,185,129,.08)',  color: '#34d399', border: 'rgba(16,185,129,.15)',  label: 'VITALICIO' },
};

function NavItem({ item, collapsed, naoLidas = 0, badgeCount = 0 }) {
  const showBadge = (item.path === '/notificacoes' && naoLidas > 0) || (item.path === '/processos' && badgeCount > 0);
  const count = item.path === '/notificacoes' ? naoLidas : badgeCount;
  return (
    <NavLink
      to={item.path}
      title={collapsed ? item.label : ''}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm
         transition-all duration-300 relative group
         ${isActive ? 'nav-active' : ''}`
      }
      style={({ isActive }) => ({ color: isActive ? 'var(--accent)' : 'var(--text-secondary)' })}
      onMouseEnter={e => {
        if (!e.currentTarget.classList.contains('nav-active')) {
          e.currentTarget.style.background = 'rgba(250,204,21,.06)';
          e.currentTarget.style.color = 'var(--accent)';
          e.currentTarget.style.borderColor = 'rgba(250,204,21,.1)';
          e.currentTarget.style.boxShadow = '0 0 20px rgba(250,204,21,.04)';
        }
      }}
      onMouseLeave={e => {
        if (!e.currentTarget.classList.contains('nav-active')) {
          e.currentTarget.style.background = '';
          e.currentTarget.style.color = 'var(--text-secondary)';
          e.currentTarget.style.borderColor = '';
          e.currentTarget.style.boxShadow = '';
        }
      }}
    >
      {({ isActive }) => (
        <>
          <i
            className={`fas ${item.icon} flex-shrink-0 transition-all duration-300 group-hover:scale-110`}
            style={{ width: 20, textAlign: 'center', fontSize: 14, color: isActive ? 'var(--accent)' : 'inherit' }}
          />
          {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
          {showBadge && !collapsed && (
            <span
              className="text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse-gold"
              style={{ background: 'var(--accent)', color: '#0c0c0e', minWidth: 18, height: 18, padding: '0 4px' }}
            >
              {count > 99 ? '99+' : count}
            </span>
          )}
          {showBadge && collapsed && (
            <span
              className="absolute top-2 right-2 rounded-full animate-pulse-gold"
              style={{ width: 7, height: 7, background: 'var(--accent)' }}
            />
          )}
        </>
      )}
    </NavLink>
  );
}

export default function Sidebar({ naoLidas = 0, processosAlertas = 0, onCollapse }) {
  const { usuario, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const [collapsed, setCollapsed]   = useState(false);
  const [showPerfil, setShowPerfil] = useState(false);
  const [hoverCard, setHoverCard]   = useState(false);
  const toggle = () => { const next = !collapsed; setCollapsed(next); onCollapse?.(next); };

  const plano = usuario?.plano || 'GRATUITO';
  const ps    = planBadge[plano] || planBadge.GRATUITO;

  // Build avatar URL — detecta se frontend está em :3000 (Vite dev) e aponta p/ backend :3001
  const buildAvatarUrl = (path) => {
    if (!path) return null;
    if (/^https?:/i.test(path)) return path;
    const origin = window.location.port === '3000'
      ? window.location.origin.replace(':3000', ':3001')
      : window.location.origin;
    return `${origin}${path.startsWith('/') ? '' : '/'}${path}`;
  };
  const avatarBase = buildAvatarUrl(usuario?.avatar);
  // Cache-buster estável: atualiza apenas quando avatar muda ou upload novo
  const avatarUrl = useMemo(() => {
    if (!avatarBase) return null;
    return usuario?._avatarTs
      ? `${avatarBase}?v=${usuario._avatarTs}`
      : avatarBase;
  }, [avatarBase, usuario?._avatarTs]);

  return (
    <>
      <aside
        className="fixed left-0 top-0 h-screen z-50 flex flex-col"
        style={{
          width: collapsed ? 72 : 240,
          background: 'var(--glass-bg, rgba(10,17,40,.85))',
          backdropFilter: 'var(--glass-blur)',
          WebkitBackdropFilter: 'var(--glass-blur)',
          borderRight: '1px solid var(--glass-border)',
          transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* ─── LOGO ────────────────────────────────── */}
        <div
          className="flex items-center gap-3 px-4 flex-shrink-0"
          style={{ height: 64, borderBottom: '1px solid var(--border)' }}
        >
          <div
            className="flex items-center justify-center flex-shrink-0 overflow-hidden rounded-xl"
            style={{ width: 34, height: 34 }}
          >
            <img src="/logo.png" alt="JuriX" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          {!collapsed && (
            <span className="text-base font-bold tracking-tight text-gold-gradient flex-1">JuriX</span>
          )}
          <button
            onClick={toggle}
            className="flex items-center justify-center rounded-lg transition-all duration-300 hover:scale-110 flex-shrink-0"
            style={{
              width: 24, height: 24,
              background: 'rgba(255,255,255,.04)',
              border: '1px solid rgba(255,255,255,.06)',
              color: 'var(--text-muted)',
              fontSize: 10,
              marginLeft: collapsed ? 'auto' : 0,
            }}
          >
            <i className={`fas fa-chevron-${collapsed ? 'right' : 'left'}`} />
          </button>
        </div>

        {/* ─── USER CARD ──────────────────────────── */}
        <div className="px-3 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          {!collapsed ? (
            <div
              className="rounded-xl p-3 cursor-pointer transition-all duration-300"
              style={{
                background: hoverCard ? 'rgba(250,204,21,.05)' : 'transparent',
                border: `1px solid ${hoverCard ? 'rgba(250,204,21,.12)' : 'transparent'}`,
                boxShadow: hoverCard ? '0 0 20px rgba(250,204,21,.04)' : 'none',
              }}
              onClick={() => setShowPerfil(true)}
              onMouseEnter={() => setHoverCard(true)}
              onMouseLeave={() => setHoverCard(false)}
            >
              <div className="flex items-center gap-3 mb-2.5">
                <div className="relative flex-shrink-0">
                  <div
                    className="flex items-center justify-center font-bold overflow-hidden transition-all duration-300"
                    style={{
                      width: 40, height: 40,
                      borderRadius: 8,
                      background: 'linear-gradient(135deg,#facc15,#eab308)',
                      color: '#0c0c0e', fontSize: 13,
                      boxShadow: hoverCard ? '0 0 12px rgba(0,0,0,.3)' : 'none',
                    }}
                  >
                    <img
                      src={avatarUrl || DEFAULT_AVATAR}
                      alt="avatar"
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                    />
                  </div>
                  <span
                    className="absolute -bottom-0.5 -right-0.5 rounded-full border-2"
                    style={{ width: 10, height: 10, background: '#22c55e', borderColor: 'var(--bg-primary)' }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate leading-tight">{usuario?.nome}</p>
                  <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {usuario?.oab ? `OAB ${usuario.oab}` : usuario?.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                  style={{ background: ps.bg, color: ps.color, border: `1px solid ${ps.border}` }}
                >
                  {ps.label}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); logout(); }}
                  className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg transition-all duration-300 hover:text-red-400"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <i className="fas fa-right-from-bracket" style={{ fontSize: 10 }} />
                  Sair
                </button>
              </div>
            </div>
          ) : (
            <div
              className="flex justify-center cursor-pointer"
              onClick={() => setShowPerfil(true)}
              title="Meu Perfil"
            >
              <div className="relative">
                <div
                  className="flex items-center justify-center font-bold overflow-hidden transition-all duration-300 hover:shadow-gold"
                  style={{ width: 40, height: 40, borderRadius: 8, background: 'linear-gradient(135deg,#facc15,#eab308)', color: '#0c0c0e', fontSize: 13 }}
                >
                  <img
                    src={avatarUrl || DEFAULT_AVATAR}
                    alt="avatar"
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                  />
                </div>
                <span
                  className="absolute -bottom-0.5 -right-0.5 rounded-full border-2"
                  style={{ width: 10, height: 10, background: '#22c55e', borderColor: 'var(--bg-primary)' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ─── NAVIGATION ───────────────────────────── */}
        <nav className="flex-1 py-3 px-2.5 flex flex-col gap-0.5 overflow-y-auto">
          {!collapsed && (
            <p className="text-[10px] font-bold uppercase tracking-widest px-3 mb-1.5 mt-1" style={{ color: 'var(--text-muted)' }}>
              Menu
            </p>
          )}

          {navItems.map(item => (
            <NavItem key={item.path} item={item} collapsed={collapsed} naoLidas={naoLidas} badgeCount={item.path === '/processos' ? processosAlertas : 0} />
          ))}

          <div className="my-2 mx-1" style={{ height: 1, background: 'var(--border)' }} />

          {!collapsed && (
            <p className="text-[10px] font-bold uppercase tracking-widest px-3 mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Conta
            </p>
          )}

          <NavItem item={{ path: '/planos', icon: 'fa-crown', label: 'Planos' }} collapsed={collapsed} />


        </nav>
      </aside>

      {showPerfil && <PerfilModal onClose={() => setShowPerfil(false)} />}
    </>
  );
}
