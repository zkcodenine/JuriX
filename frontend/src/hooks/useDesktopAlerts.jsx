// ══════════════════════════════════════════════════════
//  JuriX — Alertas de desktop (notificação do Windows + som suave)
//
//  Um vigia global: pergunta ao backend "o que chegou de novo?" e, quando
//  há notificação nova (movimentação de processo, prazo, mensagem em processo
//  compartilhado, anexo...), toca um som suave e — se rodando no app Electron —
//  dispara o toast nativo do Windows. Também empurra o número de não lidas
//  para o badge da barra de tarefas / bandeja.
//
//  Só alerta quando a janela NÃO está em foco: se o usuário já está olhando o
//  app, o badge interno basta e nada de som/toast atrapalhando.
//
//  Montado no Layout, funciona em qualquer página enquanto logado — inclusive
//  com o app escondido na bandeja (a janela fica viva, só oculta).
// ══════════════════════════════════════════════════════
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import { playSoftAlert } from '../utils/alertSound';

const desktop = typeof window !== 'undefined' ? window.jurixDesktop : undefined;

// Balão persistente e chamativo para NOVA MOVIMENTAÇÃO de processo — aparece em
// qualquer tela (mesmo com o app em foco) e só some quando o usuário fecha ou
// clica para abrir o processo. É o "força a ver o que teve de novo".
function balaoMovimentacao(n, navigate) {
  toast.custom(
    (t) => (
      <div
        className="animate-scaleIn"
        onClick={() => { toast.dismiss(t.id); if (n.processoId) navigate(`/processos/${n.processoId}?tab=movimentacoes`); }}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 12, maxWidth: 400, padding: '14px 16px', cursor: 'pointer',
          background: 'var(--glass-bg, rgba(10,17,40,.97))', backdropFilter: 'blur(20px) saturate(1.3)',
          border: '1px solid rgba(201,168,76,.5)', borderRadius: 14,
          boxShadow: '0 12px 40px rgba(0,0,0,.55), 0 0 0 1px rgba(201,168,76,.15)',
        }}
      >
        <div className="flex items-center justify-center rounded-lg flex-shrink-0" style={{ width: 40, height: 40, background: 'rgba(201,168,76,.16)' }}>
          <i className="fas fa-bolt" style={{ color: '#C9A84C' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#C9A84C' }}>Nova movimentação</p>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)', marginTop: 2 }}>{n.titulo}</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{n.mensagem}</p>
          <p className="text-[11px] font-bold mt-1.5" style={{ color: '#C9A84C' }}>Clique para ver o processo →</p>
        </div>
        <button onClick={(e) => { e.stopPropagation(); toast.dismiss(t.id); }} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} title="Dispensar">
          <i className="fas fa-xmark" />
        </button>
      </div>
    ),
    { duration: Infinity, id: `mov-${n.id}` }
  );
}

export default function useDesktopAlerts(naoLidas = 0) {
  const navigate = useNavigate();
  // Só alerta o que chegar A PARTIR de agora — nada de despejar o histórico
  // ao abrir o app.
  const desdeRef = useRef(new Date().toISOString());
  const vistosRef = useRef(new Set());

  // Clique no toast nativo → abre o processo correspondente.
  useEffect(() => {
    desktop?.onAbrirProcesso?.((processoId) => {
      if (processoId) navigate(`/processos/${processoId}`);
    });
  }, [navigate]);

  // Espelha o contador de não lidas no badge da barra de tarefas / bandeja.
  useEffect(() => {
    desktop?.setBadge?.(naoLidas || 0);
  }, [naoLidas]);

  // Polling das notificações novas.
  useEffect(() => {
    let cancelado = false;

    const checar = async () => {
      try {
        const { data } = await api.get('/notificacoes/recentes', {
          params: { desde: desdeRef.current },
        });
        if (cancelado || !Array.isArray(data) || data.length === 0) return;

        // Avança o cursor para a mais recente recebida.
        desdeRef.current = data[data.length - 1].criadoEm;

        const novos = data.filter((n) => !vistosRef.current.has(n.id));
        novos.forEach((n) => vistosRef.current.add(n.id));
        if (novos.length === 0) return;

        const focado = typeof document !== 'undefined' && document.hasFocus();
        const movimentacoes = novos.filter((n) => n.tipo === 'MOVIMENTACAO');
        const outros = novos.filter((n) => n.tipo !== 'MOVIMENTACAO');

        // NOVA MOVIMENTAÇÃO — força a ver: balão persistente em QUALQUER tela,
        // som, e notificação do Windows (mesmo em foco, o balão aparece).
        if (movimentacoes.length > 0) {
          playSoftAlert();
          movimentacoes.slice(0, 4).forEach((n) => balaoMovimentacao(n, navigate));
          movimentacoes.slice(0, 3).forEach((n) => {
            desktop?.notify?.({ titulo: n.titulo, corpo: n.mensagem, processoId: n.processoId, tipo: n.tipo });
          });
        }

        // Demais notificações (prazo, honorário, mensagem): só quando fora de
        // foco — o badge interno já mostra quando o usuário está no app.
        if (outros.length > 0 && !focado) {
          playSoftAlert();
          outros.slice(0, 3).forEach((n) => {
            desktop?.notify?.({ titulo: n.titulo, corpo: n.mensagem, processoId: n.processoId, tipo: n.tipo });
          });
        }
      } catch {
        // Silencioso — alerta é secundário; a lista de notificações é a fonte oficial.
      }
    };

    checar();
    const id = setInterval(checar, 20000);
    return () => { cancelado = true; clearInterval(id); };
  }, []);
}
