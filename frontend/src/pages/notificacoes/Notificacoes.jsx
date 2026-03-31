import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { formatarTempoRelativo } from '../../utils/formatters';

const tipoIcon = {
  MOVIMENTACAO: { icon: 'fa-bolt',        color: '#C9A84C' },
  PRAZO:        { icon: 'fa-clock',       color: '#f59e0b' },
  TAREFA:       { icon: 'fa-list-check',  color: '#60a5fa' },
  HONORARIO:    { icon: 'fa-sack-dollar', color: '#10b981' },
  SISTEMA:      { icon: 'fa-gear',        color: '#a0a0a0' },
  INFO:         { icon: 'fa-circle-info', color: '#60a5fa' },
};

export default function Notificacoes() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notificacoes-page'],
    queryFn: () => api.get('/notificacoes?limite=50').then(r => r.data),
    refetchInterval: 30000,
  });

  const lerMutation = useMutation({
    mutationFn: (id) => api.patch(`/notificacoes/${id}/ler`),
    onSuccess: () => qc.invalidateQueries(['notificacoes-page']),
  });

  const lerTodasMutation = useMutation({
    mutationFn: () => api.patch('/notificacoes/ler-todas'),
    onSuccess: () => { qc.invalidateQueries(['notificacoes-page']); qc.invalidateQueries(['notificacoes-header']); toast.success('Todas marcadas como lidas.'); },
  });

  const notificacoes = data?.notificacoes || [];
  const naoLidas = data?.naoLidas || 0;

  return (
    <div className="space-y-5 animate-fadeIn max-w-3xl">
      <div className="flex justify-between items-center">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {naoLidas > 0 ? <><strong style={{ color: 'var(--accent)' }}>{naoLidas}</strong> não lida{naoLidas !== 1 ? 's' : ''}</> : 'Tudo em dia!'}
        </p>
        {naoLidas > 0 && (
          <button onClick={() => lerTodasMutation.mutate()} className="btn btn-ghost text-sm py-2" disabled={lerTodasMutation.isPending}>
            <i className="fas fa-check-double" /> Marcar todas como lidas
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
      ) : notificacoes.length === 0 ? (
        <div className="flex flex-col items-center py-24 gap-3" style={{ color: 'var(--text-muted)' }}>
          <i className="fas fa-bell text-5xl" style={{ opacity: .2 }} />
          <p className="text-sm">Nenhuma notificação.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notificacoes.map((n, i) => {
            const { icon, color } = tipoIcon[n.tipo] || tipoIcon.INFO;
            return (
              <div
                key={n.id}
                className={`flex gap-4 rounded-xl p-4 cursor-pointer transition-all hover:border-opacity-80 animate-fadeIn ${!n.lida ? 'border-l-2' : ''}`}
                style={{
                  background: n.lida ? 'var(--bg-card)' : 'rgba(201,168,76,.04)',
                  border: `1px solid ${n.lida ? 'var(--border)' : 'rgba(201,168,76,.2)'}`,
                  borderLeftColor: n.lida ? undefined : color,
                  animationDelay: `${i * 25}ms`,
                }}
                onClick={() => {
                  if (!n.lida) lerMutation.mutate(n.id);
                  if (n.processoId) navigate(`/processos/${n.processoId}`);
                }}
              >
                <div className="rounded-xl flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, background: `${color}15` }}>
                  <i className={`fas ${icon} text-sm`} style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold">{n.titulo}</p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!n.lida && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--accent)' }} />}
                      <span className="text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{formatarTempoRelativo(n.criadoEm)}</span>
                    </div>
                  </div>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{n.mensagem}</p>
                  {n.processo && (
                    <p className="text-xs mt-1 font-mono" style={{ color: 'var(--accent)' }}>
                      <i className="fas fa-link mr-1 text-[10px]" />{n.processo.numero || n.processo.numeroCnj}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
