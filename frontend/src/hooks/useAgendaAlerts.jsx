// ══════════════════════════════════════════════════════
//  JuriX — Alertas de agenda em tempo real
//  Verifica, a cada 20s, se algum evento com horário chegou
//  ao horário atual. Se sim: toca um aviso sonoro tecnológico
//  e exibe um lembrete persistente na tela.
//
//  Montado no Layout (shell autenticado), funciona em qualquer
//  página enquanto o usuário está logado.
// ══════════════════════════════════════════════════════
import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../services/api';
import { playAlertSound } from '../utils/alertSound';

// Lembrete visual persistente (some só quando o usuário fecha).
function mostrarLembrete(ev) {
  const cor = ev.etiqueta?.cor || '#C9A84C';
  toast.custom(
    (t) => (
      <div
        className="animate-scaleIn"
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          maxWidth: 380, padding: '14px 16px',
          background: 'var(--glass-bg, rgba(10,17,40,.96))',
          backdropFilter: 'blur(20px) saturate(1.3)',
          border: `1px solid ${cor}55`,
          borderLeft: `4px solid ${cor}`,
          borderRadius: 14,
          boxShadow: '0 12px 40px rgba(0,0,0,.5)',
        }}
      >
        <div
          className="flex items-center justify-center rounded-lg flex-shrink-0"
          style={{ width: 40, height: 40, background: `${cor}22` }}
        >
          <i className="fas fa-bell" style={{ color: cor }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: cor }}>
            Lembrete de agenda
          </p>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)', marginTop: 2 }}>
            {ev.titulo}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
            <i className="fas fa-clock mr-1" />
            {ev.horario} — é agora
            {ev.etiqueta?.nome ? ` · ${ev.etiqueta.nome}` : ''}
          </p>
          {ev.descricao && (
            <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
              {ev.descricao}
            </p>
          )}
        </div>
        <button
          onClick={() => toast.dismiss(t.id)}
          className="flex-shrink-0"
          style={{ color: 'var(--text-muted)' }}
          title="Dispensar"
        >
          <i className="fas fa-xmark" />
        </button>
      </div>
    ),
    { duration: Infinity, id: `agenda-alert-${ev.id}` }
  );
}

export default function useAgendaAlerts() {
  const mesStr = format(new Date(), 'yyyy-MM');
  const disparadosRef = useRef(new Set());

  const { data: eventos = [] } = useQuery({
    queryKey: ['agenda-eventos', mesStr],
    queryFn: () => api.get(`/agenda/eventos?mes=${mesStr}`).then(r => r.data),
    refetchInterval: 5 * 60 * 1000, // revalida a lista a cada 5 min
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (!eventos.length) return;

    const verificar = () => {
      const agora = new Date();
      const hoje = format(agora, 'yyyy-MM-dd');
      const hhmm = format(agora, 'HH:mm');

      for (const ev of eventos) {
        if (!ev.horario) continue;
        const dataEv = format(new Date(ev.data), 'yyyy-MM-dd');
        if (dataEv !== hoje) continue;
        if (String(ev.horario).slice(0, 5) !== hhmm) continue;

        const chave = `${ev.id}_${hoje}_${ev.horario}`;
        if (disparadosRef.current.has(chave)) continue;
        disparadosRef.current.add(chave);

        playAlertSound();
        mostrarLembrete(ev);
      }
    };

    verificar(); // checa imediatamente
    const id = setInterval(verificar, 20000); // e a cada 20s
    return () => clearInterval(id);
  }, [eventos]);
}
