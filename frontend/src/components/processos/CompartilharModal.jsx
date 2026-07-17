import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { getIniciais } from '../../utils/formatters';

const NIVEIS = [
  { valor: 'LEITURA', label: 'Leitura',  desc: 'Vê o processo e participa do chat' },
  { valor: 'EDICAO',  label: 'Edição',   desc: 'Também edita dados, prazos e anotações' },
];

function Avatar({ usuario, tam = 32 }) {
  return usuario.avatar ? (
    <img src={usuario.avatar} alt="" className="rounded-full object-cover" style={{ width: tam, height: tam }} />
  ) : (
    <div className="rounded-full flex items-center justify-center text-[11px] font-bold"
      style={{ width: tam, height: tam, background: 'rgba(250,204,21,.15)', color: 'var(--accent)' }}>
      {getIniciais(usuario.nome)}
    </div>
  );
}

export default function CompartilharModal({ processoId, onClose }) {
  const qc = useQueryClient();
  const [nivel, setNivel] = useState('LEITURA');

  const { data: acesso, isLoading } = useQuery({
    queryKey: ['compartilhamentos', processoId],
    queryFn: () => api.get(`/processos/${processoId}/compartilhamentos`).then((r) => r.data),
  });

  const { data: candidatos } = useQuery({
    queryKey: ['compartilhar-com', processoId],
    queryFn: () => api.get(`/processos/${processoId}/compartilhar-com`).then((r) => r.data),
    enabled: Boolean(acesso?.souDono),
  });

  const invalidar = () => {
    qc.invalidateQueries(['compartilhamentos', processoId]);
    qc.invalidateQueries(['compartilhar-com', processoId]);
  };

  const compartilhar = useMutation({
    mutationFn: (usuarioId) => api.post(`/processos/${processoId}/compartilhar`, { usuarioId, nivel }),
    onSuccess: () => { invalidar(); toast.success('Processo compartilhado!'); },
    onError: (e) => toast.error(e.response?.data?.error || 'Erro ao compartilhar'),
  });

  const alterarNivel = useMutation({
    mutationFn: ({ usuarioId, novoNivel }) => api.post(`/processos/${processoId}/compartilhar`, { usuarioId, nivel: novoNivel }),
    onSuccess: () => { invalidar(); toast.success('Nível alterado.'); },
    onError: (e) => toast.error(e.response?.data?.error || 'Erro ao alterar'),
  });

  const revogar = useMutation({
    mutationFn: (usuarioId) => api.delete(`/processos/${processoId}/compartilhar/${usuarioId}`),
    onSuccess: () => { invalidar(); toast.success('Acesso removido.'); },
    onError: (e) => toast.error(e.response?.data?.error || 'Erro ao remover'),
  });

  const souDono = acesso?.souDono;

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.6)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-6 max-h-[85vh] overflow-y-auto"
        style={{ background: 'var(--bg-card, #0f1b3d)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Compartilhar processo</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
          Com colegas do seu escritório
        </p>

        {isLoading ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Carregando...</p>
        ) : (
          <>
            {/* Quem já tem acesso */}
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
              Com acesso
            </p>
            <div className="space-y-2 mb-5">
              <div className="flex items-center gap-3 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,.03)' }}>
                <Avatar usuario={acesso.dono} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{acesso.dono.nome}</p>
                  <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{acesso.dono.email}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-1 rounded-md" style={{ background: 'rgba(16,185,129,.1)', color: '#34d399' }}>DONO</span>
              </div>

              {acesso.compartilhamentos.map((c) => (
                <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,.03)' }}>
                  <Avatar usuario={c.usuario} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{c.usuario.nome}</p>
                    <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{c.usuario.email}</p>
                  </div>
                  {souDono ? (
                    <>
                      <select
                        value={c.nivel}
                        onChange={(e) => alterarNivel.mutate({ usuarioId: c.usuario.id, novoNivel: e.target.value })}
                        className="text-[11px] px-2 py-1 rounded-md outline-none"
                        style={{ background: 'rgba(255,255,255,.05)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                      >
                        {NIVEIS.map((n) => <option key={n.valor} value={n.valor} style={{ background: '#0f1b3d' }}>{n.label}</option>)}
                      </select>
                      <button onClick={() => revogar.mutate(c.usuario.id)} title="Remover acesso"
                        className="px-2 py-1 rounded-md text-xs" style={{ color: '#ef4444' }}>
                        <i className="fas fa-xmark" />
                      </button>
                    </>
                  ) : (
                    <span className="text-[10px] px-2 py-1 rounded-md" style={{ background: 'rgba(255,255,255,.05)', color: 'var(--text-muted)' }}>
                      {c.nivel === 'EDICAO' ? 'Edição' : 'Leitura'}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Adicionar — só o dono compartilha */}
            {souDono && (
              <>
                {candidatos?.semUnidade ? (
                  <div className="rounded-xl p-4 text-center" style={{ border: '1px dashed var(--border)' }}>
                    <i className="fas fa-building mb-2" style={{ color: 'var(--text-muted)' }} />
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Você não está vinculado a nenhuma unidade. Peça ao administrador para vincular
                      você a um escritório — o compartilhamento é entre colegas da mesma unidade.
                    </p>
                  </div>
                ) : candidatos?.usuarios?.length === 0 ? (
                  <p className="text-xs text-center py-3" style={{ color: 'var(--text-muted)' }}>
                    Todos os colegas da sua unidade já têm acesso.
                  </p>
                ) : (
                  <>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
                      Compartilhar com
                    </p>

                    <div className="flex gap-1.5 mb-3">
                      {NIVEIS.map((n) => (
                        <button key={n.valor} onClick={() => setNivel(n.valor)} title={n.desc}
                          className="flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                          style={nivel === n.valor
                            ? { background: 'var(--accent)', color: '#0a1128' }
                            : { border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                          {n.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] mb-3" style={{ color: 'var(--text-muted)' }}>
                      {NIVEIS.find((n) => n.valor === nivel)?.desc}
                    </p>

                    <div className="space-y-1.5">
                      {candidatos?.usuarios?.map((u) => (
                        <button key={u.id} onClick={() => compartilhar.mutate(u.id)} disabled={compartilhar.isPending}
                          className="w-full flex items-center gap-3 p-2 rounded-lg text-left transition-all hover:opacity-80"
                          style={{ border: '1px solid var(--border)' }}>
                          <Avatar usuario={u} tam={28} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{u.nome}</p>
                            <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{u.email}</p>
                          </div>
                          <i className="fas fa-plus text-xs" style={{ color: 'var(--accent)' }} />
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            <button onClick={onClose} className="w-full mt-5 py-2 rounded-lg text-sm font-medium"
              style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              Fechar
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
