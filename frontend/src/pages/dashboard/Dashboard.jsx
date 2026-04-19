import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import { formatarData, formatarTempoRelativo, formatarMoeda, diasAteVencer } from '../../utils/formatters';
import useAuthStore from '../../store/authStore';
import useConnectionStore from '../../store/connectionStore';

/* ── Animated counter ─────────────────────────────────────────────── */
function AnimatedNumber({ value, duration = 600 }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const num = typeof value === 'number' ? value : 0;
    if (num === 0) { setDisplay(0); return; }
    let start = 0;
    const step = num / (duration / 16);
    const id = setInterval(() => {
      start += step;
      if (start >= num) { setDisplay(num); clearInterval(id); }
      else setDisplay(Math.floor(start));
    }, 16);
    return () => clearInterval(id);
  }, [value, duration]);
  return <>{display}</>;
}

/* ── Origem Badge ─────────────────────────────────────────────────── */
function OrigemBadge({ origem }) {
  const config = {
    tjmg:    { label: 'TJMG',   bg: 'rgba(34,211,238,.12)', color: '#22d3ee', border: 'rgba(34,211,238,.25)', icon: 'fa-landmark' },
    datajud: { label: 'CNJ',    bg: 'rgba(218,165,32,.12)',  color: '#DAA520', border: 'rgba(218,165,32,.2)',  icon: 'fa-database' },
    manual:  { label: 'Manual', bg: 'rgba(156,163,175,.1)',  color: '#9ca3af', border: 'rgba(156,163,175,.2)', icon: 'fa-pen' },
  };
  const c = config[origem] || config.manual;
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      <i className={`fas ${c.icon}`} style={{ fontSize: 8 }} />
      {c.label}
    </span>
  );
}

/* ── Tribunal style helper ────────────────────────────────────────── */
function tribunalStyle(tribunal) {
  const t = tribunal?.toUpperCase() || '';
  if (t === 'TJMG') return { accent: '#22d3ee', bg: 'rgba(34,211,238,.08)', border: 'rgba(34,211,238,.2)' };
  if (t.startsWith('TJ'))  return { accent: '#a78bfa', bg: 'rgba(167,139,250,.08)', border: 'rgba(167,139,250,.2)' };
  if (t.startsWith('TRF')) return { accent: '#f59e0b', bg: 'rgba(245,158,11,.08)',  border: 'rgba(245,158,11,.2)' };
  if (t.startsWith('TRT')) return { accent: '#10b981', bg: 'rgba(16,185,129,.08)',  border: 'rgba(16,185,129,.2)' };
  return { accent: '#DAA520', bg: 'rgba(218,165,32,.08)', border: 'rgba(218,165,32,.2)' };
}

/* ── Notification type config ─────────────────────────────────────── */
const notifConfig = {
  MOVIMENTACAO: { icon: 'fa-bolt',        color: '#22d3ee', bg: 'rgba(34,211,238,.1)' },
  PRAZO:        { icon: 'fa-clock',       color: '#f59e0b', bg: 'rgba(245,158,11,.1)' },
  TAREFA:       { icon: 'fa-list-check',  color: '#60a5fa', bg: 'rgba(96,165,250,.1)' },
  HONORARIO:    { icon: 'fa-sack-dollar', color: '#34d399', bg: 'rgba(52,211,153,.1)' },
  SISTEMA:      { icon: 'fa-gear',        color: '#a78bfa', bg: 'rgba(167,139,250,.1)' },
  INFO:         { icon: 'fa-circle-info', color: '#94a3b8', bg: 'rgba(148,163,184,.1)' },
};

/* ── Accent colors for items ──────────────────────────────────────── */
const accentOf = (i) => ['#eab308', '#22d3ee', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#a78bfa'][i % 7];

/* ── Greeting helper ──────────────────────────────────────────────── */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 5)  return 'Boa madrugada';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

/* ── Day labels ───────────────────────────────────────────────────── */
const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/* ══════════════════════════════════════════════════════════════════════
   DASHBOARD — Card wrapper with stagger animation
══════════════════════════════════════════════════════════════════════ */
function DashCard({ children, className = '', colSpan = 'full', hero = false, delay = 0, onClick, style = {} }) {
  const ref = useRef(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  const colClass = colSpan === 'full' ? 'dash-col-full' : colSpan === '2' ? 'dash-col-2' : 'dash-col-1';

  return (
    <div
      ref={ref}
      onClick={onClick}
      className={`dash-card ${colClass} ${className}`}
      style={{
        background: 'rgba(255,255,255,.03)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid var(--border)',
        borderRadius: 18,
        padding: '28px 28px 26px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color .25s, box-shadow .25s, transform .2s',
        cursor: onClick ? 'pointer' : 'default',
        opacity: revealed ? 1 : 0,
        transform: revealed ? 'translateY(0)' : 'translateY(28px)',
        transitionProperty: 'opacity, transform, border-color, box-shadow',
        transitionDuration: '.5s',
        transitionTimingFunction: 'cubic-bezier(.22,.68,0,1.2)',
        ...(hero ? {
          background: 'linear-gradient(rgba(255,255,255,.01), rgba(255,255,255,.02)) padding-box, linear-gradient(135deg, rgba(218,165,32,.55), rgba(59,130,246,.35), rgba(16,185,129,.35)) border-box',
          backdropFilter: 'blur(20px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
          border: '1.5px solid transparent',
        } : {}),
        ...style,
      }}
    >
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(135deg, rgba(218,165,32,.04) 0%, transparent 60%)',
        pointerEvents: 'none', borderRadius: 'inherit',
      }} />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
}

/* ── Card label ───────────────────────────────────────────────────── */
function CardLabel({ icon, children, live, color }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.4px',
      color: color || 'var(--text-secondary)', marginBottom: 18,
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <i className={`fas ${icon}`} style={{ fontSize: 13, color: 'var(--accent)', opacity: .85 }} />
      {children}
      {live && (
        <span style={{
          display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
          background: 'var(--success)', marginLeft: 4,
          animation: 'pulse 2s infinite',
        }} />
      )}
    </div>
  );
}

/* ── Stat pill ────────────────────────────────────────────────────── */
function StatPill({ value, label, borderColor = 'var(--accent)', valueColor, sub, tint }) {
  // tint: cor base do banner (glass tintado). Fallback p/ borderColor.
  const base = tint || borderColor;
  // Quando cor é CSS var, usa como está; senão aplica glass tint na própria cor
  const isVar = typeof base === 'string' && base.startsWith('var(');
  const bgStyle = isVar
    ? {
        background: `linear-gradient(135deg, rgba(201,168,76,.18), rgba(184,137,61,.10))`,
      }
    : {
        background: `linear-gradient(135deg, ${base}28, ${base}10)`,
      };
  return (
    <div className="dash-stat-pill group" style={{
      ...bgStyle,
      backdropFilter: 'blur(14px) saturate(1.3)',
      WebkitBackdropFilter: 'blur(14px) saturate(1.3)',
      border: `1px solid ${isVar ? 'rgba(184,137,61,.35)' : `${base}45`}`,
      borderTop: `2px solid ${borderColor}`,
      borderRadius: 14, padding: '16px 14px', textAlign: 'center',
      position: 'relative', overflow: 'hidden',
      cursor: 'default',
      boxShadow: `0 4px 20px ${isVar ? 'rgba(184,137,61,.12)' : `${base}20`}, inset 0 1px 0 rgba(255,255,255,.18)`,
    }}>
      {/* brilho decorativo */}
      <div style={{
        position: 'absolute', top: -30, right: -30, width: 80, height: 80,
        background: `radial-gradient(circle, ${isVar ? 'rgba(201,168,76,.25)' : `${base}35`} 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{
        fontSize: 28, fontWeight: 800, color: valueColor || borderColor,
        lineHeight: 1, letterSpacing: '-.5px', position: 'relative',
        animation: 'floatUp .5s ease both',
        textShadow: '0 1px 2px rgba(0,0,0,.08)',
      }}>
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </div>
      <div style={{
        fontSize: '10.5px', color: 'var(--text-secondary)', textTransform: 'uppercase',
        letterSpacing: '.6px', marginTop: 6, fontWeight: 700, position: 'relative',
      }}>{label}</div>
      {sub && <div style={{ fontSize: 10, opacity: .75, marginTop: 4, position: 'relative' }}>{sub}</div>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   DASHBOARD COMPONENT
══════════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const { usuario } = useAuthStore();
  const navigate = useNavigate();
  const { isOnline, isUsingCache, connectionQuality } = useConnectionStore();

  // Adaptive: 60s good, 180s slow, disabled offline
  const dashInterval = !isOnline ? false : connectionQuality === 'slow' ? 180000 : 60000;

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then(r => r.data),
    refetchInterval: dashInterval,
  });

  const ind = data?.indicadores || {};
  const prazos = data?.ultimosPrazos || [];
  const processosAtualizados = data?.processosAtualizados || [];
  const notificacoes = data?.notificacoesRecentes || [];
  const graficos = data?.graficos || {};
  const audienciasHoje = data?.audienciasHoje || [];
  const eventosSemana = data?.eventosSemana || [];
  const honorarios = data?.honorariosMes || {};
  const processosLista = data?.processosLista || [];
  const prazosHoje = data?.prazosHoje || [];

  /* ── Week calendar data ─────────────────────────── */
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const todayDow = now.getDay();
  const weekStartDate = data?.weekStart ? new Date(data.weekStart) : (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); return d; })();

  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStartDate);
    d.setDate(weekStartDate.getDate() + i);
    const dStr = d.toISOString().slice(0, 10);
    const dayEvents = eventosSemana.filter(e => e.data?.slice(0, 10) === dStr);
    weekDays.push({ d, dStr, isToday: dStr === todayStr, dow: i, events: dayEvents });
  }

  /* ── Combine today activities for timeline ──────── */
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const timelineItems = [
    ...audienciasHoje.map(a => ({
      time: a.horario || null,
      title: a.titulo,
      sub: a.descricao || a.etiqueta?.nome || 'Compromisso',
      type: 'event',
    })),
    ...prazosHoje.map(p => ({
      time: null,
      title: p.titulo,
      sub: p.processo?.numero || p.processo?.numeroCnj || 'Prazo',
      type: 'prazo',
    })),
  ].sort((a, b) => {
    const toMins = t => { if (!t) return 9999; const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
    return toMins(a.time) - toMins(b.time);
  });

  /* ── Formatted date string ──────────────────────── */
  const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const userName = usuario?.nome?.split(' ')[0] || 'Doutor(a)';

  /* ── Status chart data ──────────────────────────── */
  const statusData = graficos.statusDistribuicao || {};
  const totalProcessos = Object.values(statusData).reduce((a, b) => a + b, 0);

  // ── Loading skeleton ──────────────────────────────
  if (isLoading) return (
    <div className="space-y-6" style={{ maxWidth: 1400, margin: '0 auto' }}>
      <div className="skeleton h-12 w-64 rounded-2xl" />
      <div className="skeleton h-36 rounded-2xl" />
      <div className="skeleton h-48 rounded-2xl" />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 skeleton h-64 rounded-2xl" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }} className="animate-fadeIn">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="dash-header-flex" style={{ marginBottom: 32, paddingBottom: 24, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--accent)', marginBottom: 6 }}>
            {getGreeting()}, {userName}
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.2 }}>Painel Juridico</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{dateStr}</div>
        </div>
        {isUsingCache && (
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(245,158,11,.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,.2)' }}>
            <i className="fas fa-database mr-1" style={{ fontSize: 9 }} />dados em cache
          </span>
        )}
      </div>

      {/* ── Grid ────────────────────────────────────────────────── */}
      <div className="dash-grid-container">

        {/* ═══ ROW 1: Visão Geral (full) ═══════════════════════════ */}
        <DashCard colSpan="full" delay={0}>
          <CardLabel icon="fa-chart-bar" live>Visão Geral</CardLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" style={{ marginTop: 4 }}>
            <StatPill value={ind.processosAtivos ?? 0} label="Processos Ativos" borderColor="#c9a84c" tint="#c9a84c"
              sub={ind.processosSuspensos > 0 ? `${ind.processosSuspensos} suspenso(s)` : undefined} />
            <StatPill value={ind.audienciasHoje ?? 0} label="Compromissos Hoje" borderColor="#3b82f6" tint="#3b82f6" />
            <StatPill value={ind.prazosProximos ?? 0} label="Prazos na Semana" borderColor="#f97316" tint="#f97316"
              sub={ind.prazosVencidos > 0 ? `${ind.prazosVencidos} vencido(s)!` : undefined} />
          </div>
        </DashCard>

        {/* ═══ ROW 2: Audiências do Dia (full) ═════════════════════ */}
        <DashCard colSpan="full" delay={70}>
          <CardLabel icon="fa-gavel">Compromissos do Dia</CardLabel>
          {audienciasHoje.length === 0 && prazosHoje.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--text-muted)', fontSize: 12 }}>
              <i className="fas fa-gavel" style={{ fontSize: 26, marginBottom: 8, display: 'block', opacity: .4 }} />
              Nenhum compromisso agendado para hoje — aproveite para revisar seus processos.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
              {audienciasHoje.map((a, i) => (
                <div key={a.id} className="dash-list-item group" style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                  background: 'rgba(255,255,255,.03)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderRadius: 11,
                  border: '1px solid var(--border)', cursor: 'pointer',
                  animation: `floatUp .4s ease ${i * .06}s both`,
                }} onClick={() => navigate('/agenda')}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                    background: a.etiqueta?.cor || 'var(--accent)',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <i className="fas fa-gavel" style={{ marginRight: 5, opacity: .6 }} />{a.titulo}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {a.descricao || a.etiqueta?.nome || 'Sem detalhes'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {a.horario || 'Sem horario'}
                    </div>
                  </div>
                </div>
              ))}
              {prazosHoje.map((p, i) => (
                <div key={p.id} className="group" style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                  background: 'rgba(245,158,11,.05)', borderRadius: 11,
                  border: '1px solid rgba(245,158,11,.2)', cursor: 'pointer',
                  transition: 'border-color .2s, transform .15s',
                  animation: `floatUp .4s ease ${(audienciasHoje.length + i) * .06}s both`,
                }} onClick={() => navigate(`/processos/${p.processoId}`)}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                    background: '#f59e0b', animation: 'pulse 1.5s infinite',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <i className="fas fa-clock" style={{ marginRight: 5, opacity: .6, color: '#f59e0b' }} />{p.titulo}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {p.processo?.numero || p.processo?.numeroCnj || 'Prazo'}
                    </div>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full animate-pulse"
                    style={{ background: 'rgba(245,158,11,.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,.25)' }}>
                    HOJE
                  </span>
                </div>
              ))}
            </div>
          )}
        </DashCard>

        {/* ═══ ROW 3: Controle de Honorários (full) ════════════════ */}
        <DashCard colSpan="full" delay={140} onClick={() => navigate('/honorarios')}>
          <CardLabel icon="fa-file-invoice-dollar">Controle de Honorarios</CardLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" style={{ marginTop: 16, marginBottom: 20 }}>
            <StatPill
              value={formatarMoeda(honorarios.recebido ?? 0)}
              label="Recebido no Mes"
              borderColor="rgba(16,185,129,.3)"
              valueColor="var(--success)"
            />
            <StatPill
              value={formatarMoeda(honorarios.pendente ?? 0)}
              label="Pendentes"
              borderColor="rgba(234,179,8,.3)"
              valueColor="var(--accent)"
            />
            <StatPill
              value={formatarMoeda(honorarios.atrasado ?? 0)}
              label="Atrasados"
              borderColor="rgba(239,68,68,.3)"
              valueColor="var(--danger)"
            />
          </div>
          <div style={{
            gridColumn: '1 / -1',
            background: 'rgba(59,130,246,.05)', border: '1px solid rgba(59,130,246,.15)',
            borderRadius: 14, padding: '12px 14px', textAlign: 'center', marginBottom: 16,
          }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#3b82f6' }}>
              {formatarMoeda(honorarios.previsto ?? 0)}
            </div>
            <div style={{ fontSize: '10.5px', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '.6px', marginTop: 4, fontWeight: 600 }}>
              Total Previsto (Mes)
            </div>
          </div>

        </DashCard>

        {/* ═══ ROW 4: Calendário Semanal (full) ════════════════════ */}
        <DashCard colSpan="full" delay={210}>
          <CardLabel icon="fa-calendar-week">Calendario Semanal</CardLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {weekDays.map(day => {
              const hasEvents = day.events.length > 0;
              return (
                <div key={day.dStr} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                    {DOW[day.dow]}
                  </div>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700,
                    background: day.isToday ? 'var(--accent)' : 'rgba(255,255,255,.03)',
                    border: day.isToday ? '1px solid var(--accent)' : `1px solid ${hasEvents ? 'rgba(201,168,76,.4)' : 'var(--border)'}`,
                    color: day.isToday ? '#fff' : 'var(--text-secondary)',
                    boxShadow: day.isToday ? '0 0 0 3px rgba(201,168,76,.25)' : 'none',
                  }}>
                    {day.d.getDate()}
                  </div>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center', minHeight: 8 }}>
                    {day.events.slice(0, 3).map((e, ei) => (
                      <div key={ei} style={{ width: 5, height: 5, borderRadius: '50%', background: e.etiqueta?.cor || 'var(--accent)' }} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Week events list */}
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {eventosSemana.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '10px 0', color: 'var(--text-muted)', fontSize: 12 }}>
                <i className="fas fa-calendar-check" style={{ fontSize: 22, display: 'block', opacity: .4, marginBottom: 8 }} />
                Nenhum prazo ou compromisso esta semana
              </div>
            ) : (
              eventosSemana.slice(0, 6).map(e => {
                const evDate = new Date(e.data);
                const evDateStr = evDate.toISOString().slice(0, 10);
                const isToday = evDateStr === todayStr;
                const label = isToday ? 'Hoje' : `${DOW[evDate.getDay()]} ${evDate.getDate()}/${evDate.getMonth() + 1}`;
                return (
                  <div key={e.id} onClick={() => navigate('/agenda')} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 12, color: 'var(--text-secondary)',
                    padding: '7px 10px', background: isToday ? 'rgba(201,168,76,.12)' : 'rgba(255,255,255,.03)',
                    borderRadius: 8, borderLeft: `${isToday ? 4 : 3}px solid ${isToday ? 'var(--accent)' : e.etiqueta?.cor || 'var(--accent)'}`,
                    boxShadow: isToday ? '0 0 12px rgba(201,168,76,.15)' : 'none',
                    cursor: 'pointer',
                  }}>
                    <i className="fas fa-calendar-day" style={{ fontSize: 10, color: isToday ? 'var(--accent)' : e.etiqueta?.cor || 'var(--accent)', flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, color: isToday ? 'var(--accent)' : 'var(--text-primary)', flexShrink: 0 }}>{label}</span>
                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.titulo}</span>
                    {e.horario && <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{e.horario}</span>}
                  </div>
                );
              })
            )}
          </div>
        </DashCard>

        {/* ═══ ROW 5: Processos Atualizados (col 2) + Próximos Prazos (col 1) ═══ */}
        <DashCard colSpan="2" delay={280}>
          <CardLabel icon="fa-balance-scale">
            {processosAtualizados.length > 0 ? (
              <>{`Processos Atualizados — ${processosAtualizados.length} nas ultimas 48h`}</>
            ) : 'Radar Processual'}
          </CardLabel>
          {processosAtualizados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 16px' }}>
              <i className="fas fa-check-double" style={{ fontSize: 32, color: 'var(--success)', marginBottom: 12, display: 'block' }} />
              <div style={{ color: 'var(--success)', fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Tudo em dia</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Nenhuma movimentacao recente nos<br />seus processos.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {processosAtualizados.slice(0, 5).map((proc, i) => {
                const ts = tribunalStyle(proc.tribunal);
                return (
                  <div key={proc.id} className="group" style={{
                    background: 'rgba(255,255,255,.03)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderRadius: 11,
                    padding: '12px 14px', border: `1px solid var(--border)`,
                    borderLeft: `3px solid ${ts.accent}`,
                    cursor: 'pointer', transition: 'border-color .2s, transform .15s',
                    animation: `floatUp .4s ease ${i * .06}s both`,
                  }} onClick={() => navigate(`/processos/${proc.id}`)}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{proc.partes?.[0]?.nome || proc.numero || proc.numeroCnj}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {proc.tribunal && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: ts.bg, color: ts.accent, border: `1px solid ${ts.border}` }}>
                            {proc.tribunal}
                          </span>
                        )}
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatarTempoRelativo(proc.dataUltimaAtualizacao)}</span>
                      </div>
                    </div>
                    {proc.movimentacoes?.slice(0, 2).map(mov => (
                      <div key={mov.id} style={{
                        display: 'flex', alignItems: 'start', gap: 6, marginTop: 4,
                        fontSize: 11, color: 'var(--text-secondary)',
                      }}>
                        <i className="fas fa-bolt text-[9px] mt-1" style={{ color: ts.accent, flexShrink: 0 }} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mov.descricao}</span>
                        <OrigemBadge origem={mov.origemApi} />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </DashCard>

        <DashCard colSpan="1" delay={350}>
          <CardLabel icon="fa-clock">Proximos Prazos</CardLabel>
          {prazos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--text-muted)', fontSize: 12 }}>
              <i className="fas fa-check-circle" style={{ fontSize: 26, display: 'block', opacity: .4, marginBottom: 8 }} />
              Nenhum prazo critico nos proximos dias
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {prazos.slice(0, 5).map((prazo, i) => {
                const dias = diasAteVencer(prazo.dataVencimento);
                const isHoje = dias === 0;
                const urgente = dias !== null && dias <= 2;
                const critico = dias !== null && dias < 0;
                const urgCls = isHoje ? 'today' : urgente ? 'soon' : 'later';
                const urgTxt = critico ? 'Vencido' : isHoje ? 'Hoje' : dias === 1 ? 'Amanha' : `em ${dias}d`;
                const dt = new Date(prazo.dataVencimento);
                return (
                  <div key={prazo.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 12px', background: 'rgba(255,255,255,.03)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                    borderRadius: 10, border: '1px solid var(--border)',
                    cursor: 'pointer', transition: 'border-color .2s, transform .15s',
                    animation: `floatUp .4s ease ${i * .06}s both`,
                  }} onClick={() => navigate(`/processos/${prazo.processoId}`)}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 10,
                      background: 'rgba(201,168,76,.12)', border: '1px solid rgba(201,168,76,.2)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>{dt.getDate()}</div>
                      <div style={{ fontSize: 8, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{MONTHS[dt.getMonth()]}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {prazo.titulo}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {prazo.processo?.numero || prazo.processo?.numeroCnj || 'Prazo geral'}
                      </div>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${critico || isHoje ? 'animate-pulse' : ''}`}
                      style={{
                        background: critico ? 'rgba(239,68,68,.15)' : urgente || isHoje ? 'rgba(245,158,11,.15)' : 'rgba(16,185,129,.12)',
                        color: critico ? '#ef4444' : urgente || isHoje ? '#f59e0b' : '#10b981',
                        border: `1px solid ${critico ? 'rgba(239,68,68,.25)' : urgente || isHoje ? 'rgba(245,158,11,.25)' : 'rgba(16,185,129,.2)'}`,
                        flexShrink: 0,
                      }}>
                      {urgTxt}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </DashCard>

        {/* ═══ ROW 6: Atividades do Dia (col 1) + Seus Processos (col 2) ═══ */}
        <DashCard colSpan="1" delay={420}>
          <CardLabel icon="fa-stream">Atividades do Dia</CardLabel>
          {timelineItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--text-muted)', fontSize: 12 }}>
              <i className="fas fa-moon" style={{ fontSize: 26, display: 'block', opacity: .4, marginBottom: 8 }} />
              Sem atividades registradas hoje
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative' }}>
              {timelineItems.map((item, ii) => {
                const toMins = t => { if (!t) return -1; const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
                const itemStart = toMins(item.time);
                const isActive = item.time && nowMins >= itemStart && nowMins <= itemStart + 60;
                const isDone = item.time && nowMins > itemStart + 60;
                const isLast = ii === timelineItems.length - 1;
                const icon = item.type === 'prazo' ? 'fa-clock' : 'fa-gavel';

                return (
                  <div key={ii} style={{
                    display: 'flex', gap: 12, paddingBottom: isLast ? 0 : 14, position: 'relative',
                    animation: `floatUp .4s ease ${ii * .08}s both`,
                  }}>
                    {!isLast && <div style={{
                      width: 1, background: 'var(--border)',
                      position: 'absolute', left: 56, top: 4, bottom: 0,
                    }} />}
                    <div style={{ width: 44, textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {item.time || '—'}
                      </div>
                    </div>
                    <div style={{
                      flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', width: 16,
                    }}>
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%',
                        border: `2px solid ${isActive ? 'var(--accent)' : isDone ? 'var(--success)' : 'var(--accent)'}`,
                        background: isActive ? 'var(--accent)' : isDone ? 'var(--success)' : 'rgba(255,255,255,.03)',
                        boxShadow: isActive ? '0 0 0 3px rgba(201,168,76,.25)' : 'none',
                        flexShrink: 0, marginTop: 2,
                      }} />
                    </div>
                    <div style={{ flex: 1, paddingBottom: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>
                        <i className={`fas ${icon}`} style={{ marginRight: 5, opacity: .6, fontSize: 10 }} />{item.title}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{item.sub}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DashCard>

        <DashCard colSpan="2" delay={490}>
          <CardLabel icon="fa-folder-open">Seus Processos</CardLabel>
          {processosLista.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--text-muted)', fontSize: 12 }}>
              <i className="fas fa-folder-open" style={{ fontSize: 26, display: 'block', opacity: .4, marginBottom: 8 }} />
              Nenhum processo cadastrado ainda
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {processosLista.map((p, pi) => {
                const color = accentOf(pi);
                return (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px', background: 'rgba(255,255,255,.03)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                    borderRadius: 10, border: '1px solid var(--border)',
                    cursor: 'pointer', transition: 'border-color .2s, transform .15s',
                    position: 'relative', minWidth: 0,
                    animation: `floatUp .4s ease ${pi * .05}s both`,
                  }} onClick={() => navigate(`/processos/${p.id}`)}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 8,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, flexShrink: 0,
                      background: `${color}20`, border: `1px solid ${color}35`, color: color,
                    }}>
                      <i className="fas fa-scale-balanced" style={{ fontSize: 12 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.nomeCliente || p.numero || p.numeroCnj}
                      </div>
                      {p.nomeCliente && <div style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.numero || p.numeroCnj}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
                      {p.tribunal && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: `${tribunalStyle(p.tribunal).bg}`, color: tribunalStyle(p.tribunal).accent, border: `1px solid ${tribunalStyle(p.tribunal).border}` }}>
                          {p.tribunal}
                        </span>
                      )}
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ color: 'var(--text-muted)', borderColor: 'var(--border)', border: '1px solid var(--border)', background: 'transparent' }}>
                        {p.movimentacoes} mov.
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DashCard>

        {/* ═══ ROW 7: Notificações Recentes (full) — if any ════════ */}
        {notificacoes.length > 0 && (
          <DashCard colSpan="full" delay={560} style={{
            padding: 0,
            border: '1px solid rgba(167,139,250,.2)',
            background: 'linear-gradient(135deg, rgba(167,139,250,.04), rgba(10,10,10,.85))',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 24px', borderBottom: '1px solid rgba(167,139,250,.12)',
            }}>
              <h3 style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#a78bfa' }} />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: '#a78bfa' }} />
                </span>
                <span style={{ color: '#a78bfa' }}>
                  {notificacoes.length} {notificacoes.length === 1 ? 'Nova Notificacao' : 'Novas Notificacoes'}
                </span>
              </h3>
              <button onClick={() => navigate('/notificacoes')}
                style={{ fontSize: 12, fontWeight: 600, color: '#a78bfa', background: 'none', border: 'none', cursor: 'pointer' }}>
                Ver todas
              </button>
            </div>
            <div>
              {notificacoes.map((notif, i) => {
                const nc = notifConfig[notif.tipo] || notifConfig.INFO;
                return (
                  <div key={notif.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px',
                      cursor: 'pointer', transition: 'background .15s',
                      borderBottom: i < notificacoes.length - 1 ? '1px solid rgba(167,139,250,.08)' : 'none',
                      animation: `floatUp .4s ease ${i * .05}s both`,
                    }}
                    onClick={() => notif.processoId ? navigate(`/processos/${notif.processoId}`) : navigate('/notificacoes')}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 12, background: nc.bg, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <i className={`fas ${nc.icon}`} style={{ fontSize: 12, color: nc.color }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{notif.titulo}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{notif.mensagem}</p>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                      {formatarTempoRelativo(notif.criadoEm)}
                    </span>
                  </div>
                );
              })}
            </div>
          </DashCard>
        )}

      </div>{/* /grid */}
    </div>
  );
}
