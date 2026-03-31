import { NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';
import useAuthStore from '../../store/authStore';
import { getIniciais } from '../../utils/formatters';
import PerfilModal from '../perfil/PerfilModal';

const navItems = [
  { path: '/dashboard', icon: 'fa-gauge-high',     label: 'Dashboard'       },
  { path: '/processos', icon: 'fa-scale-balanced', label: 'Processos'       },
  { path: '/tarefas',   icon: 'fa-list-check',     label: 'Tarefas'         },
  { path: '/agenda',    icon: 'fa-calendar-days',  label: 'Agenda'          },
];

const planBadge = {
  GRATUITO:  { bg: 'rgba(99,102,241,.12)',  color: '#818cf8', border: 'rgba(99,102,241,.2)', label: 'GRATUITO'   },
  MENSAL:    { bg: 'rgba(201,168,76,.12)',  color: '#C9A84C', border: 'rgba(201,168,76,.25)',  label: 'MENSAL'     },
  ANUAL:     { bg: 'rgba(201,168,76,.12)',  color: '#C9A84C', border: 'rgba(201,168,76,.25)',  label: 'ANUAL'      },
  VITALICIO: { bg: 'rgba(16,185,129,.12)',  color: '#34d399', border: 'rgba(16,185,129,.25)',  label: 'VITALICIO' },
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
         transition-all duration-200 relative group
         ${isActive ? 'nav-active' : ''}`
      }
      style={({ isActive }) => ({ color: isActive ? 'var(--accent)' : 'var(--text-secondary)' })}
      onMouseEnter={e => {
        if (!e.currentTarget.classList.contains('nav-active')) {
          e.currentTarget.style.background = 'var(--bg-hover)';
          e.currentTarget.style.color = 'var(--text-primary)';
        }
      }}
      onMouseLeave={e => {
        if (!e.currentTarget.classList.contains('nav-active')) {
          e.currentTarget.style.background = '';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }
      }}
    >
      {({ isActive }) => (
        <>
          <i
            className={`fas ${item.icon} flex-shrink-0 transition-transform duration-200 group-hover:scale-110`}
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
  const [collapsed, setCollapsed]   = useState(false);
  const [showPerfil, setShowPerfil] = useState(false);
  const [hoverCard, setHoverCard]   = useState(false);

  const toggle = () => { const next = !collapsed; setCollapsed(next); onCollapse?.(next); };

  const plano = usuario?.plano || 'GRATUITO';
  const ps    = planBadge[plano] || planBadge.GRATUITO;

  const avatarUrl = usuario?.avatar ? `http://localhost:3001${usuario.avatar}` : null;

  return (
    <>
      <aside
        className="fixed left-0 top-0 h-screen z-50 flex flex-col"
        style={{
          width: collapsed ? 72 : 240,
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border)',
          transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
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
            className="flex items-center justify-center rounded-lg transition-all hover:opacity-70 flex-shrink-0"
            style={{
              width: 24, height: 24,
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
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
              className="rounded-xl p-3 cursor-pointer"
              style={{
                background: hoverCard ? 'var(--bg-tertiary)' : 'transparent',
                border: `1px solid ${hoverCard ? 'var(--border-strong)' : 'transparent'}`,
                transition: 'var(--transition)',
              }}
              onClick={() => setShowPerfil(true)}
              onMouseEnter={() => setHoverCard(true)}
              onMouseLeave={() => setHoverCard(false)}
            >
              <div className="flex items-center gap-3 mb-2.5">
                <div className="relative flex-shrink-0">
                  <div
                    className="flex items-center justify-center rounded-xl font-bold overflow-hidden"
                    style={{
                      width: 38, height: 38,
                      background: 'linear-gradient(135deg,#C9A84C,#A8873A)',
                      color: '#0c0c0e', fontSize: 13,
                    }}
                  >
                    {avatarUrl
                      ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                      : getIniciais(usuario?.nome)
                    }
                  </div>
                  <span
                    className="absolute -bottom-0.5 -right-0.5 rounded-full border-2"
                    style={{ width: 10, height: 10, background: '#22c55e', borderColor: 'var(--bg-secondary)' }}
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
                  className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg transition-all hover:opacity-70"
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
                  className="flex items-center justify-center rounded-xl font-bold overflow-hidden"
                  style={{ width: 38, height: 38, background: 'linear-gradient(135deg,#C9A84C,#A8873A)', color: '#0c0c0e', fontSize: 13 }}
                >
                  {avatarUrl
                    ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                    : getIniciais(usuario?.nome)
                  }
                </div>
                <span
                  className="absolute -bottom-0.5 -right-0.5 rounded-full border-2"
                  style={{ width: 10, height: 10, background: '#22c55e', borderColor: 'var(--bg-secondary)' }}
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
