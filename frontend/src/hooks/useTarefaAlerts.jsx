// ══════════════════════════════════════════════════════
//  JuriX — Alerta de tarefas com prazo para HOJE
//  Quando uma tarefa pendente chega ao dia marcado, toca um som suave,
//  mostra um aviso no canto superior direito e — no app — dispara a
//  notificação nativa do Windows. Uma vez por tarefa por dia.
//
//  Devolve a quantidade de tarefas pendentes para hoje, para o badge
//  visual no menu Tarefas (visível nos temas claro e escuro).
// ══════════════════════════════════════════════════════
import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../services/api';
import { playSoftAlert } from '../utils/alertSound';

const mesmaData = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function avisoVisual(tarefa) {
  toast.custom(
    (t) => (
      <div className="animate-scaleIn" style={{
        display: 'flex', alignItems: 'flex-start', gap: 12, maxWidth: 380, padding: '14px 16px',
        background: 'var(--glass-bg, rgba(10,17,40,.96))', backdropFilter: 'blur(20px) saturate(1.3)',
        border: '1px solid rgba(245,158,11,.45)', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,.5)',
        opacity: t.visible ? 1 : 0,
        transform: t.visible ? 'translateY(0)' : 'translateY(-10px)',
        transition: 'opacity .7s ease, transform .7s ease',
      }}>
        <div className="flex items-center justify-center rounded-lg flex-shrink-0" style={{ width: 40, height: 40, background: 'rgba(245,158,11,.15)' }}>
          <i className="fas fa-list-check" style={{ color: '#f59e0b' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#f59e0b' }}>Tarefa para hoje</p>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)', marginTop: 2 }}>{tarefa.titulo}</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)', marginTop: 2 }}>Vence hoje — não esqueça.</p>
        </div>
        <button onClick={() => toast.dismiss(t.id)} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} title="Dispensar">
          <i className="fas fa-xmark" />
        </button>
      </div>
    ),
    { duration: 15000, id: `tarefa-hoje-${tarefa.id}` }
  );
}

export default function useTarefaAlerts() {
  const disparadosRef = useRef(new Set());

  const { data: tarefas = [] } = useQuery({
    queryKey: ['tarefas', 'PENDENTE', ''],
    queryFn: () => api.get('/tarefas', { params: { status: 'PENDENTE' } }).then(r => r.data),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  const hoje = new Date();
  const pendentesHoje = tarefas.filter(t => t.prazo && t.status !== 'CONCLUIDA' && mesmaData(new Date(t.prazo), hoje));

  useEffect(() => {
    if (!pendentesHoje.length) return;

    const disparar = () => {
      const chaveDia = new Date().toISOString().slice(0, 10);
      for (const t of pendentesHoje) {
        const chave = `${t.id}_${chaveDia}`;
        if (disparadosRef.current.has(chave)) continue;
        disparadosRef.current.add(chave);

        playSoftAlert();
        avisoVisual(t);
        if (typeof document === 'undefined' || !document.hasFocus()) {
          window.jurixDesktop?.notify?.({
            titulo: 'Tarefa para hoje',
            corpo: `${t.titulo} — vence hoje`,
            tipo: 'TAREFA',
          });
        }
      }
    };

    disparar();
    const id = setInterval(disparar, 60000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendentesHoje.length]);

  return pendentesHoje.length;
}
