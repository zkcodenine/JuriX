import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import useAuthStore from '../../../store/authStore';
import { getIniciais } from '../../../utils/formatters';

// Sem servidor não há WebSocket, então a atualização é por polling. 6s é o
// meio-termo: parece conversa e não martela o banco da HostGator.
const INTERVALO_POLLING = 6000;

const horaDe = (iso) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const diaDe = (iso) => {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date(Date.now() - 86400000);
  if (d.toDateString() === hoje.toDateString()) return 'Hoje';
  if (d.toDateString() === ontem.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
};

export default function Discussao({ processoId }) {
  const qc = useQueryClient();
  const { usuario } = useAuthStore();
  const [texto, setTexto] = useState('');
  const fimRef = useRef(null);
  const primeiraCarga = useRef(true);

  const { data: mensagens = [], isLoading } = useQuery({
    queryKey: ['mensagens', processoId],
    queryFn: () => api.get(`/processos/${processoId}/mensagens`).then((r) => r.data),
    refetchInterval: INTERVALO_POLLING,
    refetchIntervalInBackground: false,
  });

  const enviar = useMutation({
    mutationFn: (t) => api.post(`/processos/${processoId}/mensagens`, { texto: t }),
    onSuccess: () => {
      setTexto('');
      qc.invalidateQueries(['mensagens', processoId]);
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Erro ao enviar'),
  });

  const remover = useMutation({
    mutationFn: (id) => api.delete(`/processos/${processoId}/mensagens/${id}`),
    onSuccess: () => qc.invalidateQueries(['mensagens', processoId]),
    onError: (e) => toast.error(e.response?.data?.error || 'Erro ao remover'),
  });

  // Rola para o fim quando chega mensagem nova. Na primeira carga vai direto,
  // sem animação, para não parecer que a tela "pulou".
  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: primeiraCarga.current ? 'auto' : 'smooth' });
    if (mensagens.length) primeiraCarga.current = false;
  }, [mensagens.length]);

  const submeter = (e) => {
    e.preventDefault();
    const t = texto.trim();
    if (!t) return;
    enviar.mutate(t);
  };

  let ultimoDia = null;

  return (
    <div className="flex flex-col" style={{ height: 'min(560px, 60vh)' }}>
      <div className="flex-1 overflow-y-auto px-1 py-2 space-y-2">
        {isLoading ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Carregando conversa...</p>
        ) : mensagens.length === 0 ? (
          <div className="text-center py-10">
            <i className="fas fa-comments text-3xl mb-3" style={{ color: 'var(--text-muted)', opacity: .5 }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nenhuma mensagem ainda.</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Comece a discussão sobre este processo com quem tem acesso a ele.
            </p>
          </div>
        ) : (
          mensagens.map((m) => {
            const meu = m.usuario.id === usuario?.id;
            const dia = diaDe(m.criadoEm);
            const mostrarDia = dia !== ultimoDia;
            ultimoDia = dia;

            return (
              <div key={m.id}>
                {mostrarDia && (
                  <div className="flex items-center gap-2 my-3">
                    <div className="flex-1" style={{ height: 1, background: 'var(--border)' }} />
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{dia}</span>
                    <div className="flex-1" style={{ height: 1, background: 'var(--border)' }} />
                  </div>
                )}

                <div className={`flex gap-2 ${meu ? 'flex-row-reverse' : ''}`}>
                  {m.usuario.avatar ? (
                    <img src={m.usuario.avatar} alt="" className="rounded-full object-cover flex-shrink-0" style={{ width: 28, height: 28 }} />
                  ) : (
                    <div className="rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                      style={{ width: 28, height: 28, background: 'rgba(250,204,21,.15)', color: 'var(--accent)' }}>
                      {getIniciais(m.usuario.nome)}
                    </div>
                  )}

                  <div className={`max-w-[75%] group ${meu ? 'items-end' : 'items-start'} flex flex-col`}>
                    {!meu && (
                      <span className="text-[10px] mb-0.5 px-1" style={{ color: 'var(--text-muted)' }}>{m.usuario.nome}</span>
                    )}
                    <div className="px-3 py-2 rounded-2xl" style={{
                      background: meu ? 'rgba(250,204,21,.12)' : 'rgba(255,255,255,.04)',
                      border: `1px solid ${meu ? 'rgba(250,204,21,.2)' : 'var(--border)'}`,
                      borderTopRightRadius: meu ? 4 : 16,
                      borderTopLeftRadius: meu ? 16 : 4,
                    }}>
                      {m.removida ? (
                        <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>Mensagem removida</p>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap break-words" style={{ color: 'var(--text-primary)' }}>{m.texto}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 px-1 mt-0.5">
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{horaDe(m.criadoEm)}</span>
                      {meu && !m.removida && (
                        <button onClick={() => remover.mutate(m.id)}
                          className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ color: '#ef4444' }}>
                          remover
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={fimRef} />
      </div>

      <form onSubmit={submeter} className="flex gap-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            // Enter envia; Shift+Enter quebra linha — como num chat.
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submeter(e); }
          }}
          placeholder="Escreva uma mensagem... (Enter envia, Shift+Enter quebra linha)"
          rows={1}
          maxLength={5000}
          className="flex-1 px-3 py-2 rounded-xl text-sm outline-none resize-none"
          style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)', color: 'var(--text-primary)', maxHeight: 120 }}
        />
        <button type="submit" disabled={!texto.trim() || enviar.isPending}
          className="px-4 rounded-xl text-sm font-bold disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#0a1128' }}>
          <i className="fas fa-paper-plane" />
        </button>
      </form>
    </div>
  );
}
