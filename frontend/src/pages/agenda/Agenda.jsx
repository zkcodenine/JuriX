import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import api from '../../services/api';

/* ─── helpers ─────────────────────────────────────── */
const toDateOnly = (d) => format(new Date(d), 'yyyy-MM-dd');

const priorCor = { URGENTE: '#ef4444', ALTA: '#f59e0b', MEDIA: '#C9A84C', BAIXA: '#10b981' };
const priorLabel = { URGENTE: 'Urgente', ALTA: 'Alta', MEDIA: 'Média', BAIXA: 'Baixa' };

const nomeCliente = (proc) => {
  if (!proc) return '';
  const autor = proc.partes?.[0]?.nome;
  return autor || proc.numeroCnj || proc.numero || '';
};

/* ─── Modal de Evento ─────────────────────────────── */
function EventoModal({ evento, etiquetas, onClose, onSaved }) {
  const qc = useQueryClient();
  const isEdit = !!evento?.id;

  const [form, setForm] = useState({
    titulo:     evento?.titulo     || '',
    data:       evento?.data ? evento.data.substring(0, 10) : format(new Date(), 'yyyy-MM-dd'),
    horario:    evento?.horario    || '',
    descricao:  evento?.descricao  || '',
    etiquetaId: evento?.etiquetaId || '',
  });

  const { mutate, isPending } = useMutation({
    mutationFn: () => isEdit
      ? api.put(`/agenda/eventos/${evento.id}`, { ...form, etiquetaId: form.etiquetaId || null })
      : api.post('/agenda/eventos', { ...form, etiquetaId: form.etiquetaId || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agenda-eventos'], refetchType: 'all' });
      toast.success(isEdit ? 'Evento atualizado!' : 'Evento criado!');
      setTimeout(() => onSaved?.(), 100);
    },
    onError: () => toast.error('Erro ao salvar evento.'),
  });

  return createPortal(
    <div
      className="animate-fadeIn"
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(8px)',
        padding: '1rem',
      }}
    >
      <div
        className="w-full max-w-md animate-scaleIn"
        style={{
          background: 'var(--glass-bg, rgba(10,17,40,.92))', backdropFilter: 'blur(24px) saturate(1.3)', WebkitBackdropFilter: 'blur(24px) saturate(1.3)',
          border: '1px solid rgba(255,255,255,.1)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
      >
        <div className="flex justify-between items-center px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-lg" style={{ width: 36, height: 36, background: 'rgba(201,168,76,.1)' }}>
              <i className={`fas ${isEdit ? 'fa-pen' : 'fa-calendar-plus'}`} style={{ color: 'var(--accent)', fontSize: 14 }} />
            </div>
            <div>
              <h3 className="font-bold text-sm">{isEdit ? 'Editar Evento' : 'Novo Evento'}</h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Compromisso na agenda</p>
            </div>
          </div>
          <button onClick={onClose} className="text-lg" style={{ color: 'var(--text-muted)' }}>
            <i className="fas fa-xmark" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label style={labelStyle}>Título <span style={{ color: 'var(--accent)' }}>*</span></label>
            <input className="input-base text-sm" placeholder="Ex: Audiência, Reunião..." value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Data <span style={{ color: 'var(--accent)' }}>*</span></label>
              <input type="date" className="input-base text-sm" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Horário</label>
              <input type="time" className="input-base text-sm" value={form.horario} onChange={e => setForm(f => ({ ...f, horario: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Etiqueta</label>
            <select className="input-base text-sm" value={form.etiquetaId} onChange={e => setForm(f => ({ ...f, etiquetaId: e.target.value }))}>
              <option value="">Sem etiqueta</option>
              {etiquetas.map(et => <option key={et.id} value={et.id}>{et.nome}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Descrição</label>
            <textarea className="input-base text-sm" rows={2} placeholder="Detalhes..." value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} style={{ resize: 'none' }} />
          </div>
        </div>

        <div className="px-5 py-3 flex gap-2 justify-end" style={{ borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,.02)' }}>
          <button onClick={onClose} className="btn btn-ghost text-sm">Cancelar</button>
          <button onClick={() => mutate()} disabled={!form.titulo || !form.data || isPending} className="btn btn-gold text-sm">
            {isPending ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <i className="fas fa-check" />}
            {isEdit ? 'Atualizar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─── Modal genérico de confirmação de exclusão ─── */
function ConfirmDeleteModal({ title, message, onConfirm, onCancel, loading }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,.88)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden animate-scaleIn text-center"
        style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(24px) saturate(1.3)', WebkitBackdropFilter: 'blur(24px) saturate(1.3)', border: '1px solid var(--border)' }}
      >
        <div className="p-6">
          <div className="flex items-center justify-center rounded-2xl mx-auto mb-4" style={{ width: 52, height: 52, background: 'rgba(239,68,68,.1)' }}>
            <i className="fas fa-trash text-lg" style={{ color: 'var(--danger)' }} />
          </div>
          <h3 className="text-sm font-bold mb-1">{title}</h3>
          {message && <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>{message}</p>}
          <div className="flex gap-3 mt-4">
            <button onClick={onCancel} className="btn btn-ghost flex-1 text-sm">Cancelar</button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="btn flex-1 text-sm font-semibold"
              style={{ background: 'var(--danger)', color: '#fff' }}
            >
              {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <i className="fas fa-trash" />}
              {' '}Excluir
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─── Modal de Etiquetas (Correção 2: click to edit) ─── */
const CORES_PRESET = ['#C9A84C','#ef4444','#f97316','#eab308','#22c55e','#10b981','#3b82f6','#8b5cf6','#ec4899','#64748b'];

function EtiquetasModal({ onClose }) {
  const qc = useQueryClient();
  const [novoNome, setNovoNome] = useState('');
  const [novaCor, setNovaCor] = useState('#C9A84C');
  const [editando, setEditando] = useState(null);

  const { data: etiquetas = [] } = useQuery({
    queryKey: ['agenda-etiquetas'],
    queryFn: () => api.get('/agenda/etiquetas').then(r => r.data),
  });

  const criarMut = useMutation({
    mutationFn: () => api.post('/agenda/etiquetas', { nome: novoNome, cor: novaCor }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agenda-etiquetas'] }); setNovoNome(''); toast.success('Etiqueta criada!'); },
  });
  const editarMut = useMutation({
    mutationFn: ({ id, nome, cor }) => api.put(`/agenda/etiquetas/${id}`, { nome, cor }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agenda-etiquetas'] }); setEditando(null); toast.success('Atualizada!'); },
  });
  const deletarMut = useMutation({
    mutationFn: (id) => api.delete(`/agenda/etiquetas/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agenda-etiquetas'] }); toast.success('Excluída.'); },
  });

  return createPortal(
    <div
      className="animate-fadeIn"
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(8px)', padding: '1rem',
      }}
    >
      <div
        className="w-full max-w-md animate-scaleIn"
        style={{ background: 'var(--glass-bg, rgba(10,17,40,.92))', backdropFilter: 'blur(24px) saturate(1.3)', WebkitBackdropFilter: 'blur(24px) saturate(1.3)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 'var(--radius-lg)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="flex justify-between items-center px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h3 className="font-bold text-sm">Gerenciar Etiquetas</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Clique em uma etiqueta para editá-la</p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><i className="fas fa-xmark text-lg" /></button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div>
            <label style={labelStyle}>Nova Etiqueta</label>
            <div className="flex gap-2 mb-2">
              <input className="input-base text-sm flex-1" placeholder="Nome" value={novoNome} onChange={e => setNovoNome(e.target.value)} onKeyDown={e => e.key === 'Enter' && novoNome.trim() && criarMut.mutate()} />
              <button onClick={() => novoNome.trim() && criarMut.mutate()} disabled={!novoNome.trim()} className="btn btn-gold px-3 text-sm"><i className="fas fa-plus" /></button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CORES_PRESET.map(cor => (
                <button key={cor} onClick={() => setNovaCor(cor)} className="rounded-full" style={{ width: 22, height: 22, background: cor, border: novaCor === cor ? '2px solid white' : '2px solid transparent', outline: novaCor === cor ? `2px solid ${cor}` : 'none', outlineOffset: 2 }} />
              ))}
              <input type="color" value={novaCor} onChange={e => setNovaCor(e.target.value)} className="w-[22px] h-[22px] rounded-full border-0 cursor-pointer" style={{ padding: 0, background: 'none' }} />
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Cadastradas ({etiquetas.length})</p>
            {etiquetas.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>Nenhuma etiqueta.</p>
            ) : (
              <div className="space-y-1.5">
                {etiquetas.map(et => (
                  <div key={et.id}>
                    {editando?.id === et.id ? (
                      <div className="flex gap-2 items-center p-2 rounded-lg" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--accent-border)' }}>
                        <input className="input-base flex-1 py-1.5 text-sm" value={editando.nome} onChange={e => setEditando(ed => ({ ...ed, nome: e.target.value }))} autoFocus />
                        <div className="flex gap-1">{CORES_PRESET.map(cor => (<button key={cor} onClick={() => setEditando(ed => ({ ...ed, cor }))} className="rounded-full flex-shrink-0" style={{ width: 16, height: 16, background: cor, border: editando.cor === cor ? '2px solid white' : '2px solid transparent' }} />))}</div>
                        <button onClick={() => editarMut.mutate(editando)} className="btn btn-gold px-2 py-1 text-xs"><i className="fas fa-check" /></button>
                        <button onClick={() => setEditando(null)} className="btn btn-ghost px-2 py-1 text-xs"><i className="fas fa-xmark" /></button>
                      </div>
                    ) : (
                      /* Correção 2: Click to edit directly, no separate edit button */
                      <div
                        className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer group transition-all"
                        style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)' }}
                        onClick={() => setEditando({ id: et.id, nome: et.nome, cor: et.cor })}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                      >
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: et.cor }} />
                        <span className="text-sm flex-1">{et.nome}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); deletarMut.mutate(et.id); }} className="text-xs px-1.5 py-1" style={{ color: 'var(--danger)' }}><i className="fas fa-trash text-[10px]" /></button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─── Modal de Detalhe do Evento (Melhoria 5) ────── */
function EventoDetailModal({ evento, onClose, onEdit, onDelete }) {
  const cor = evento.etiqueta?.cor || '#8b5cf6';
  const [showConfirm, setShowConfirm] = useState(false);
  return createPortal(
    <div
      className="animate-fadeIn"
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(8px)', padding: '1rem',
      }}
    >
      <div
        className="w-full max-w-sm animate-scaleIn"
        style={{ background: 'var(--glass-bg, rgba(10,17,40,.92))', backdropFilter: 'blur(24px) saturate(1.3)', WebkitBackdropFilter: 'blur(24px) saturate(1.3)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}
      >
        {/* Color bar */}
        <div style={{ height: 4, background: cor }} />

        <div className="px-5 py-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-base">{evento.titulo}</h3>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                <i className="fas fa-calendar mr-1" />
                {format(new Date(evento.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                {evento.horario && <> &bull; <i className="fas fa-clock mr-1" />{evento.horario}</>}
              </p>
            </div>
            <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
              <i className="fas fa-xmark text-lg" />
            </button>
          </div>

          {evento.etiqueta && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full inline-block mb-3"
              style={{ background: `${cor}15`, color: cor, border: `1px solid ${cor}30` }}>
              {evento.etiqueta.nome}
            </span>
          )}

          {evento.descricao && (
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
              {evento.descricao}
            </p>
          )}

          <div className="flex gap-2 justify-end pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <button onClick={() => { onClose(); onEdit(evento); }} className="btn btn-ghost text-sm">
              <i className="fas fa-pen" /> Editar
            </button>
            <button
              onClick={() => setShowConfirm(true)}
              className="btn btn-ghost text-sm"
              style={{ color: 'var(--danger)' }}
            >
              <i className="fas fa-trash" /> Excluir
            </button>
          </div>
        </div>
      </div>
      {showConfirm && (
        <ConfirmDeleteModal
          title="Excluir este evento?"
          message="Esta ação não pode ser desfeita."
          onConfirm={() => { onDelete(evento.id); setShowConfirm(false); onClose(); }}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>,
    document.body
  );
}

const labelStyle = {
  display: 'block', fontSize: '0.7rem', fontWeight: 600,
  letterSpacing: '0.06em', textTransform: 'uppercase',
  color: 'var(--text-secondary)', marginBottom: '0.35rem',
};

/* ─── Modal de Conclusão com Observações ──────────── */
function ConcluirModal({ tarefa, onClose, onConfirm, isPending }) {
  const [obs, setObs] = useState('');
  return createPortal(
    <div
      className="animate-fadeIn"
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(8px)', padding: '1rem',
      }}
    >
      <div
        className="w-full max-w-md animate-scaleIn"
        style={{ background: 'var(--glass-bg, rgba(10,17,40,.92))', backdropFilter: 'blur(24px) saturate(1.3)', WebkitBackdropFilter: 'blur(24px) saturate(1.3)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}
      >
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center justify-center rounded-lg" style={{ width: 36, height: 36, background: 'rgba(16,185,129,.12)' }}>
            <i className="fas fa-check" style={{ color: '#10b981', fontSize: 14 }} />
          </div>
          <div>
            <h3 className="font-bold text-sm">Concluir Tarefa</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{tarefa.titulo}</p>
          </div>
        </div>
        <div className="p-5">
          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
            Observações da conclusão <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span>
          </label>
          <textarea
            className="input-base text-sm"
            rows={3}
            placeholder="Como foi realizado? Ficou alguma pendência?"
            value={obs}
            onChange={e => setObs(e.target.value)}
            style={{ resize: 'vertical', minHeight: 72 }}
            autoFocus
          />
        </div>
        <div className="px-5 py-3 flex gap-2 justify-end" style={{ borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,.02)' }}>
          <button onClick={onClose} className="btn btn-ghost text-sm">Cancelar</button>
          <button
            onClick={() => onConfirm(obs)}
            disabled={isPending}
            className="btn text-sm font-semibold"
            style={{ background: '#10b981', color: '#fff' }}
          >
            {isPending ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <i className="fas fa-check" />}
            Concluir
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─── Modal de Detalhe de Tarefa ──────────── */
function TarefaDetalheModal({ tarefa, onClose, navigate, onConcluir, toggleTarefaMut, toggleSubMutation, onDelete }) {
  const isDone = tarefa.status === 'CONCLUIDA';
  const cor = priorCor[tarefa.prioridade] || '#3b82f6';
  const subs = tarefa.subtarefas || [];
  const concluidas = subs.filter(s => s.status === 'CONCLUIDA').length;
  const [showConfirm, setShowConfirm] = useState(false);

  return createPortal(
    <div
      className="animate-fadeIn"
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(8px)', padding: '1rem',
      }}
    >
      <div
        className="w-full max-w-sm animate-scaleIn flex flex-col"
        style={{ background: 'var(--glass-bg, rgba(10,17,40,.92))', backdropFilter: 'blur(24px) saturate(1.3)', WebkitBackdropFilter: 'blur(24px) saturate(1.3)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', maxHeight: '85vh' }}
      >
        {/* Color bar */}
        <div style={{ height: 4, background: cor }} />

        <div className="px-5 py-4 overflow-y-auto flex-1">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h3 className={`font-bold text-base ${isDone ? 'line-through text-gray-500' : ''}`}>{tarefa.titulo}</h3>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{ background: `${cor}15`, color: cor, border: `1px solid ${cor}30` }}>
                  {priorLabel[tarefa.prioridade]}
                </span>
                {tarefa.prazo && (
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    <i className="fas fa-calendar mr-1" />
                    {format(new Date(tarefa.prazo), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
              <i className="fas fa-xmark text-lg" />
            </button>
          </div>

          {tarefa.descricao && (
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
              {tarefa.descricao}
            </p>
          )}

          {tarefa.processo && (
            <div className="mb-4">
              <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Processo Vinculado</p>
              <button
                onClick={() => { onClose(); navigate(`/processos/${tarefa.processoId}`); }}
                className="text-xs hover:underline text-left"
                style={{ color: 'var(--accent)' }}
              >
                <i className="fas fa-scale-balanced mr-1" />
                {nomeCliente(tarefa.processo)}
              </button>
            </div>
          )}

          {subs.length > 0 && (
            <div className="mb-2 mt-4 space-y-2">
               <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  <span>Subtarefas</span>
                  <span>{concluidas}/{subs.length}</span>
               </div>
               {subs.map(sub => (
                 <button
                   key={sub.id}
                   onClick={() => toggleSubMutation.mutate({ tarefaId: tarefa.id, sub })}
                   className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left hover:bg-white/5"
                   style={{ border: '1px solid var(--border)', background: 'rgba(255,255,255,.02)' }}
                 >
                   <div
                     className="flex items-center justify-center rounded-full flex-shrink-0"
                     style={{ width: 18, height: 18, border: `2px solid ${sub.status === 'CONCLUIDA' ? '#10b981' : 'rgba(255,255,255,.15)'}`, background: sub.status === 'CONCLUIDA' ? 'rgba(16,185,129,.15)' : 'transparent' }}
                   >
                     {sub.status === 'CONCLUIDA' && <i className="fas fa-check text-[8px]" style={{ color: '#10b981' }} />}
                   </div>
                   <span className={`text-xs ${sub.status === 'CONCLUIDA' ? 'line-through' : ''}`} style={{ color: sub.status === 'CONCLUIDA' ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                     {sub.titulo}
                   </span>
                 </button>
               ))}
            </div>
          )}
        </div>

        <div className="px-5 py-3 flex gap-2 justify-end" style={{ borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,.02)' }}>
          <button
            onClick={() => { onClose(); if (!isDone) { onConcluir(tarefa); } else { toggleTarefaMut.mutate({ id: tarefa.id, status: tarefa.status }); } }}
            className="btn btn-ghost text-sm"
          >
            {isDone ? <><i className="fas fa-rotate-left" style={{ color: '#f59e0b' }}/> Reabrir</> : <><i className="fas fa-check" style={{ color: '#10b981' }}/> Concluir</>}
          </button>
          <button
            onClick={() => setShowConfirm(true)}
            className="btn btn-ghost text-sm"
            style={{ color: 'var(--danger)' }}
          >
            <i className="fas fa-trash" /> Excluir
          </button>
        </div>
      </div>
      {showConfirm && (
        <ConfirmDeleteModal
          title={`Excluir "${tarefa.titulo}"?`}
          message="Esta ação não pode ser desfeita."
          onConfirm={() => { onDelete(tarefa.id); setShowConfirm(false); onClose(); }}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>,
    document.body
  );
}

/* ─── Card de tarefa na agenda (expandível) ──────── */
function AgendaTarefaCard({ t, isDone, cor, toggleTarefaMut, navigate, onConcluir, toggleSubMutation }) {
  const [open, setOpen] = useState(false);
  const subs = t.subtarefas || [];
  const concluidas = subs.filter(s => s.status === 'CONCLUIDA').length;

  return (
    <div
      className="rounded-lg overflow-hidden animate-fadeInFast transition-all"
      style={{
        background: 'rgba(255,255,255,.03)',
        border: `1px solid ${open ? 'var(--accent-border, rgba(201,168,76,.3))' : 'var(--border)'}`,
        opacity: isDone ? .55 : 1,
      }}
    >
      <div
        className="flex items-start gap-2.5 p-3 cursor-pointer transition-colors hover:bg-white/[.02]"
        onClick={() => setOpen(o => !o)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isDone) { onConcluir(t); }
            else { toggleTarefaMut.mutate({ id: t.id, status: t.status }); }
          }}
          className="flex-shrink-0 mt-0.5 transition-transform hover:scale-110"
        >
          <div
            className="flex items-center justify-center rounded-md"
            style={{
              width: 22, height: 22,
              border: `2px solid ${isDone ? '#10b981' : cor}`,
              background: isDone ? 'rgba(16,185,129,.15)' : 'transparent',
            }}
          >
            {isDone && <i className="fas fa-check text-[9px]" style={{ color: '#10b981' }} />}
          </div>
        </button>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${isDone ? 'line-through' : ''}`}
            style={{ color: isDone ? 'var(--text-muted)' : 'var(--text-primary)' }}>
            {t.titulo}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: `${cor}15`, color: cor, border: `1px solid ${cor}30` }}>
              {priorLabel[t.prioridade]}
            </span>
            {subs.length > 0 && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid var(--border)' }}>
                {concluidas}/{subs.length} subs
              </span>
            )}
            {t.processo && (
              <button
                onClick={(e) => { e.stopPropagation(); navigate(`/processos/${t.processoId}`); }}
                className="text-[10px] font-medium hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                <i className="fas fa-user mr-0.5" />
                {nomeCliente(t.processo)}
              </button>
            )}
          </div>
        </div>
        <i className={`fas fa-chevron-${open ? 'up' : 'down'} text-[9px] mt-2 flex-shrink-0`}
          style={{ color: 'var(--text-muted)' }} />
      </div>

      {open && (
        <div className="animate-fadeIn">
          {subs.length > 0 && (
            <div className="px-3 pb-3 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,.05)', paddingTop: 8 }}>
              {subs.map(sub => (
                <button
                  key={sub.id}
                  onClick={() => toggleSubMutation.mutate({ tarefaId: t.id, sub })}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded transition-all text-left hover:bg-white/5"
                >
                  <div
                    className="flex items-center justify-center rounded-full flex-shrink-0"
                    style={{ width: 14, height: 14, border: `1px solid ${sub.status === 'CONCLUIDA' ? '#10b981' : 'rgba(255,255,255,.2)'}`, background: sub.status === 'CONCLUIDA' ? 'rgba(16,185,129,.15)' : 'transparent' }}
                  >
                    {sub.status === 'CONCLUIDA' && <i className="fas fa-check text-[7px]" style={{ color: '#10b981' }} />}
                  </div>
                  <span className={`text-[11px] ${sub.status === 'CONCLUIDA' ? 'line-through text-gray-500' : 'text-gray-300'}`}>
                    {sub.titulo}
                  </span>
                </button>
              ))}
            </div>
          )}
          <div
            className="flex items-center justify-end gap-2 px-3 py-2"
            style={{ borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,.02)' }}
          >
            {t.processo && (
              <button
                onClick={() => navigate(`/processos/${t.processoId}`)}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-all hover:bg-white/5"
                style={{ color: 'var(--accent)' }}
              >
                <i className="fas fa-scale-balanced text-[9px]" />
                Ver processo
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Componente principal ────────────────────────── */
export default function Agenda() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mesAtual, setMesAtual] = useState(new Date());
  const [diaSelecionado, setDia] = useState(null);
  const [sidebarAberta, setSidebarAberta] = useState(false);
  const [showNovoEvento, setShowNE] = useState(false);
  const [novoEventoData, setNEData] = useState(null);
  const [editandoEvento, setEditEv] = useState(null);
  const [eventoDetalhe, setEventoDetalhe] = useState(null);
  const [tarefaDetalhe, setTarefaDetalhe] = useState(null);
  const [showEtiquetas, setShowEt] = useState(false);
  const [concluindoTarefa, setConcluindoTarefa] = useState(null);

  const mesStr = format(mesAtual, 'yyyy-MM');

  const { data: prazosData = [] } = useQuery({
    queryKey: ['agenda-prazos'],
    queryFn: () => api.get('/processos/prazos-agenda').then(r => r.data),
  });

  const { data: eventos = [] } = useQuery({
    queryKey: ['agenda-eventos', mesStr],
    queryFn: () => api.get(`/agenda/eventos?mes=${mesStr}`).then(r => r.data),
  });

  const { data: tarefas = [] } = useQuery({
    queryKey: ['agenda-tarefas'],
    queryFn: () => api.get('/tarefas').then(r => r.data),
  });

  const { data: etiquetas = [] } = useQuery({
    queryKey: ['agenda-etiquetas'],
    queryFn: () => api.get('/agenda/etiquetas').then(r => r.data),
  });

  const { data: movimentacoes = [] } = useQuery({
    queryKey: ['agenda-movimentacoes'],
    queryFn: () => api.get('/processos/movimentacoes-agenda').then(r => r.data),
  });

  const deletarEventoMut = useMutation({
    mutationFn: (id) => api.delete(`/agenda/eventos/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agenda-eventos'], refetchType: 'all' }); toast.success('Evento removido.'); },
  });

  const deletarTarefaMut = useMutation({
    mutationFn: (id) => api.delete(`/tarefas/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agenda-tarefas'] });
      qc.invalidateQueries({ queryKey: ['tarefas'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Tarefa excluída.');
    },
  });

  const toggleTarefaMut = useMutation({
    mutationFn: ({ id, status, observacaoConclusao }) => api.put(`/tarefas/${id}`, {
      status: status === 'CONCLUIDA' ? 'PENDENTE' : 'CONCLUIDA',
      ...(status !== 'CONCLUIDA' && observacaoConclusao !== undefined ? { observacaoConclusao } : {}),
      ...(status === 'CONCLUIDA' ? { observacaoConclusao: null } : {}),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agenda-tarefas'] });
      qc.invalidateQueries({ queryKey: ['tarefas'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['processo'] });
      setConcluindoTarefa(null);
    },
  });

  const toggleSubMutation = useMutation({
    mutationFn: ({ tarefaId, sub }) => api.put(`/tarefas/${tarefaId}/subtarefas/${sub.id}`, {
      status: sub.status === 'CONCLUIDA' ? 'PENDENTE' : 'CONCLUIDA',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agenda-tarefas'] });
      qc.invalidateQueries({ queryKey: ['tarefas'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['processo'] });
    },
  });

  // Maps by date
  const prazosPorData = useMemo(() => {
    const map = {};
    prazosData.forEach(pz => {
      const key = toDateOnly(pz.dataVencimento);
      if (!map[key]) map[key] = [];
      map[key].push({ ...pz, _type: 'prazo', _processo: pz.processo });
    });
    return map;
  }, [prazosData]);

  const eventosPorData = useMemo(() => {
    const map = {};
    eventos.forEach(ev => {
      const key = toDateOnly(ev.data);
      if (!map[key]) map[key] = [];
      map[key].push({ ...ev, _type: 'evento' });
    });
    return map;
  }, [eventos]);

  const tarefasPorData = useMemo(() => {
    const map = {};
    tarefas.filter(t => t.prazo).forEach(t => {
      const key = toDateOnly(t.prazo);
      if (!map[key]) map[key] = [];
      map[key].push({ ...t, _type: 'tarefa' });
    });
    return map;
  }, [tarefas]);

  const movsPorData = useMemo(() => {
    const map = {};
    movimentacoes.forEach(mov => {
      const key = toDateOnly(mov.data);
      if (!map[key]) map[key] = [];
      map[key].push({ ...mov, _type: 'movimentacao' });
    });
    return map;
  }, [movimentacoes]);

  // Calendar
  const inicioMes = startOfMonth(mesAtual);
  const fimMes = endOfMonth(mesAtual);
  const dias = eachDayOfInterval({ start: inicioMes, end: fimMes });
  const offsetInicio = getDay(inicioMes);
  const diasVazios = Array(offsetInicio).fill(null);
  const semanas = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

  const mesAnterior = () => setMesAtual(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const mesSeguinte = () => setMesAtual(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const hoje = new Date();

  // Selected day items
  const diaSel = diaSelecionado ? toDateOnly(diaSelecionado) : null;
  const prazosDia = diaSel ? (prazosPorData[diaSel] || []) : [];
  const eventosDia = diaSel ? (eventosPorData[diaSel] || []) : [];
  const tarefasDia = diaSel ? (tarefasPorData[diaSel] || []) : [];
  const movsDia = diaSel ? (movsPorData[diaSel] || []) : [];

  const corPrazo = (pz) => {
    const d = Math.ceil((new Date(pz.dataVencimento) - hoje) / 86400000);
    if (d < 0) return '#ef4444';
    if (d <= 3) return '#f59e0b';
    return '#C9A84C';
  };

  const getItemsForDay = (dateKey) => {
    const e = eventosPorData[dateKey] || [];
    const p = prazosPorData[dateKey] || [];
    const t = tarefasPorData[dateKey] || [];
    const m = movsPorData[dateKey] || [];
    return [...e, ...p, ...t, ...m];
  };

  const handleDayClick = (dia, temOverflow) => {
    setDia(dia);
    if (temOverflow) {
      setSidebarAberta(true);
    }
    setNEData(toDateOnly(dia));
    setShowNE(true);
  };

  return (
    <div className="flex gap-0 animate-fadeIn" style={{ minHeight: 'calc(100vh - 56px)', position: 'relative' }}>
      {/* ─── Calendar ──────────────────────────────── */}
      <div className="flex-1 flex flex-col" style={{ borderRight: sidebarAberta ? '1px solid var(--border)' : 'none' }}>
        {/* Calendar nav — clean minimal header */}
        <div className="flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <button onClick={mesAnterior} className="flex items-center justify-center rounded-lg transition-all hover:bg-white/5" style={{ width: 32, height: 32 }}>
                <i className="fas fa-chevron-left text-xs" style={{ color: 'var(--text-muted)' }} />
              </button>
              <button
                onClick={() => { setMesAtual(new Date()); setDia(new Date()); setSidebarAberta(true); }}
                className="px-3 py-1 rounded-lg text-sm font-bold capitalize transition-all hover:bg-white/5 text-gold-gradient"
              >
                {format(mesAtual, 'MMMM yyyy', { locale: ptBR })}
              </button>
              <button onClick={mesSeguinte} className="flex items-center justify-center rounded-lg transition-all hover:bg-white/5" style={{ width: 32, height: 32 }}>
                <i className="fas fa-chevron-right text-xs" style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowEt(true)} className="btn btn-ghost text-xs py-1.5 px-3">
              <i className="fas fa-tags" style={{ color: 'var(--accent)' }} /> Etiquetas
            </button>
          </div>
        </div>


        {/* Week header — refined */}
        <div className="grid grid-cols-7 mx-4" style={{ borderRadius: '24px 24px 0 0', overflow: 'hidden', background: 'rgba(255,255,255,.03)', backdropFilter: 'blur(20px) saturate(1.4)', WebkitBackdropFilter: 'blur(20px) saturate(1.4)', borderTop: '1px solid var(--border)', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
          {semanas.map((s, idx) => (
            <div key={s} className="text-center py-3 text-[10px] font-bold tracking-widest" style={{ color: idx === 0 || idx === 6 ? 'var(--text-muted)' : 'var(--text-secondary)' }}>{s}</div>
          ))}
        </div>

        {/* Calendar grid — refined cells */}
        <div className="grid grid-cols-7 flex-1 mx-4 mb-4" style={{ border: '1px solid var(--border)', borderRadius: '0 0 24px 24px', overflow: 'hidden', background: 'rgba(255,255,255,.01)', backdropFilter: 'blur(20px) saturate(1.4)', WebkitBackdropFilter: 'blur(20px) saturate(1.4)' }}>
          {diasVazios.map((_, i) => (
            <div key={`vz-${i}`} style={{ borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', minHeight: 90, background: 'rgba(255,255,255,.01)' }} />
          ))}
          {dias.map((dia, i) => {
            const key = toDateOnly(dia);
            const items = getItemsForDay(key);
            const selecionado = diaSelecionado && isSameDay(dia, diaSelecionado);
            const ehHoje = isToday(dia);
            const maxShow = 3;
            const overflow = items.length - maxShow;
            const isWeekend = getDay(dia) === 0 || getDay(dia) === 6;

            return (
              <div
                key={i}
                onClick={() => handleDayClick(dia, overflow > 0)}
                className="cursor-pointer transition-all hover:-translate-y-px"
                style={{
                  borderRight: '1px solid var(--border)',
                  borderBottom: '1px solid var(--border)',
                  minHeight: 110,
                  padding: '8px 8px',
                  background: selecionado
                    ? 'rgba(218,165,32,.08)'
                    : ehHoje ? 'rgba(218,165,32,.04)' : isWeekend ? 'rgba(255,255,255,.01)' : 'transparent',
                }}
                onMouseEnter={e => { if (!selecionado) e.currentTarget.style.background = 'rgba(218,165,32,.05)'; }}
                onMouseLeave={e => { if (!selecionado) e.currentTarget.style.background = ehHoje ? 'rgba(218,165,32,.04)' : isWeekend ? 'rgba(255,255,255,.01)' : 'transparent'; }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="inline-flex items-center justify-center rounded-xl text-xs font-bold transition-all"
                    style={{
                      width: 28, height: 28,
                      background: ehHoje ? 'var(--accent)' : selecionado ? 'rgba(218,165,32,.15)' : 'transparent',
                      color: ehHoje ? 'var(--bg-primary)' : selecionado ? 'var(--accent)' : isWeekend ? 'var(--text-muted)' : 'var(--text-primary)',
                      boxShadow: ehHoje ? '0 2px 8px rgba(218,165,32,.3)' : 'none',
                    }}
                  >
                    {dia.getDate()}
                  </span>
                  {items.length > 0 && (
                    <span className="flex items-center justify-center rounded-full text-[8px] font-bold" style={{ width: 16, height: 16, background: 'rgba(201,168,76,.12)', color: 'var(--accent)' }}>
                      {items.length}
                    </span>
                  )}
                </div>

                {/* Event pills on calendar */}
                <div className="space-y-0.5">
                  {items.slice(0, maxShow).map((item, idx) => {
                    let cor, titulo;
                    if (item._type === 'evento') {
                      cor = item.etiqueta?.cor || '#8b5cf6';
                      titulo = item.titulo;
                    } else if (item._type === 'tarefa') {
                      cor = priorCor[item.prioridade] || '#3b82f6';
                      titulo = item.titulo;
                    } else if (item._type === 'movimentacao') {
                      cor = '#22d3ee';
                      titulo = item.descricao?.slice(0, 40) || 'Atualização';
                    } else {
                      cor = corPrazo(item);
                      titulo = item.titulo;
                    }
                    return (
                      <div
                        key={`${item._type}-${item.id}-${idx}`}
                        className="truncate text-[12px] font-semibold px-2 py-1 rounded-md cursor-pointer hover:brightness-110 transition-all"
                        style={{
                          background: `${cor}28`,
                          color: cor,
                          borderLeft: `3px solid ${cor}`,
                          minHeight: 22,
                          lineHeight: 1.2,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (item._type === 'tarefa') {
                            setTarefaDetalhe(item);
                          } else if (item._type === 'evento') {
                            setEventoDetalhe(item);
                          } else if (item._type === 'prazo' && item._processo) {
                            navigate(`/processos/${item._processo.id}?tab=prazos`);
                          } else if (item._type === 'movimentacao' && item._processo) {
                            navigate(`/processos/${item._processo.id}?tab=movimentacoes`);
                          }
                        }}
                      >
                        {item.horario ? `${item.horario} ` : ''}{titulo}
                      </div>
                    );
                  })}
                  {overflow > 0 && (
                    <div
                      className="text-[9px] font-bold px-1.5 mt-0.5 cursor-pointer hover:underline"
                      style={{ color: 'var(--accent)' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDia(dia);
                        setSidebarAberta(true);
                      }}
                    >
                      +{overflow} mais
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Floating Action Button ──── */}
      {!sidebarAberta && (
        <button
          onClick={() => { setNEData(diaSel || format(new Date(), 'yyyy-MM-dd')); setShowNE(true); }}
          className="fixed bottom-8 right-8 z-50 flex items-center justify-center rounded-full btn-gold animate-bounceIn"
          style={{
            width: 56, height: 56,
            boxShadow: '0 8px 32px rgba(201,168,76,.35), 0 0 60px rgba(201,168,76,.1)',
          }}
          title="Novo Evento"
        >
          <i className="fas fa-plus text-lg" />
        </button>
      )}

      {/* ─── Side panel ──── */}
      {sidebarAberta && (
        <div className="flex flex-col animate-slideInRight" style={{ width: 360, background: 'rgba(10,17,40,.85)', backdropFilter: 'blur(20px) saturate(1.3)', WebkitBackdropFilter: 'blur(20px) saturate(1.3)' }}>
          {/* Panel header */}
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm capitalize">
                  {diaSelecionado
                    ? format(diaSelecionado, "EEEE, dd 'de' MMMM", { locale: ptBR })
                    : 'Selecione um dia'
                  }
                </h3>
                {diaSelecionado && (
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {eventosDia.length + prazosDia.length + tarefasDia.length + movsDia.length} item{(eventosDia.length + prazosDia.length + tarefasDia.length + movsDia.length) !== 1 ? 'ns' : ''}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { setNEData(diaSel || format(new Date(), 'yyyy-MM-dd')); setShowNE(true); }}
                  className="flex items-center justify-center rounded-lg transition-all hover:bg-white/5"
                  style={{ width: 32, height: 32, background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.2)', color: 'var(--accent)' }}
                  title="Criar evento neste dia"
                >
                  <i className="fas fa-plus text-xs" />
                </button>
                <button
                  onClick={() => { setSidebarAberta(false); setDia(null); }}
                  className="flex items-center justify-center rounded-lg transition-all hover:bg-white/5"
                  style={{ width: 32, height: 32, background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                  title="Fechar painel"
                >
                  <i className="fas fa-xmark text-xs" />
                </button>
              </div>
            </div>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {!diaSelecionado ? (
              <div className="flex flex-col items-center pt-12 gap-3" style={{ color: 'var(--text-muted)' }}>
                <div className="flex items-center justify-center rounded-2xl" style={{ width: 56, height: 56, background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)' }}>
                  <i className="fas fa-calendar text-xl" style={{ opacity: .3 }} />
                </div>
                <p className="text-xs">Clique em um dia no calendário</p>
              </div>
            ) : (eventosDia.length + prazosDia.length + tarefasDia.length + movsDia.length) === 0 ? (
              <div className="flex flex-col items-center pt-12 gap-3" style={{ color: 'var(--text-muted)' }}>
                <div className="flex items-center justify-center rounded-2xl" style={{ width: 56, height: 56, background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)' }}>
                  <i className="fas fa-calendar-check text-xl" style={{ opacity: .3 }} />
                </div>
                <p className="text-xs">Nenhum evento neste dia</p>
                <button onClick={() => { setNEData(diaSel); setShowNE(true); }} className="btn btn-gold text-xs mt-1">
                  <i className="fas fa-plus" /> Criar evento
                </button>
              </div>
            ) : (
              <>
                {/* Tarefas */}
                {tarefasDia.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5" style={{ color: '#3b82f6' }}>
                      <i className="fas fa-list-check" />Tarefas <span style={{ color: 'var(--text-muted)' }}>({tarefasDia.length})</span>
                    </p>
                    <div className="space-y-1.5">
                      {tarefasDia.map(t => {
                        const isDone = t.status === 'CONCLUIDA';
                        const cor = priorCor[t.prioridade];
                        return <AgendaTarefaCard key={`t-${t.id}`} t={t} isDone={isDone} cor={cor} toggleTarefaMut={toggleTarefaMut} navigate={navigate} onConcluir={(tarefa) => setConcluindoTarefa(tarefa)} toggleSubMutation={toggleSubMutation} />;
                      })}
                    </div>
                  </div>
                )}

                {/* Prazos */}
                {prazosDia.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-2 px-1 mt-1 flex items-center gap-1.5" style={{ color: '#C9A84C' }}>
                      <i className="fas fa-clock" />Prazos <span style={{ color: 'var(--text-muted)' }}>({prazosDia.length})</span>
                    </p>
                    <div className="space-y-1.5">
                      {prazosDia.map(pz => {
                        const cor = corPrazo(pz);
                        const diasR = Math.ceil((new Date(pz.dataVencimento) - hoje) / 86400000);
                        return (
                          <div
                            key={`pz-${pz.id}`}
                            className="flex items-start gap-2.5 p-3 rounded-xl cursor-pointer group animate-fadeInFast transition-all"
                            style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)' }}
                            onClick={() => pz._processo && navigate(`/processos/${pz._processo.id}?tab=prazos`)}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = `${cor}40`; e.currentTarget.style.background = `${cor}06`; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'rgba(255,255,255,.03)'; }}
                          >
                            <div className="flex-shrink-0 mt-0.5 rounded-md" style={{ width: 4, height: 32, background: cor }} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium truncate">{pz.titulo}</p>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                                  style={{ background: `${cor}15`, color: cor, border: `1px solid ${cor}30` }}>
                                  {diasR < 0 ? 'Vencido' : diasR === 0 ? 'Hoje' : `${diasR}d`}
                                </span>
                              </div>
                              {pz._processo && (
                                <p className="text-[10px] mt-1" style={{ color: 'var(--accent)' }}>
                                  <i className="fas fa-user mr-0.5" />
                                  {nomeCliente(pz._processo)}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Eventos */}
                {eventosDia.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-2 px-1 mt-1 flex items-center gap-1.5" style={{ color: '#8b5cf6' }}>
                      <i className="fas fa-calendar" />Eventos <span style={{ color: 'var(--text-muted)' }}>({eventosDia.length})</span>
                    </p>
                    <div className="space-y-1.5">
                      {eventosDia.map(ev => {
                        const cor = ev.etiqueta?.cor || '#8b5cf6';
                        return (
                          <div
                            key={`ev-${ev.id}`}
                            className="flex items-start gap-2.5 p-3 rounded-xl cursor-pointer group animate-fadeInFast transition-all"
                            style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)' }}
                            onClick={() => setEventoDetalhe(ev)}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = `${cor}40`; e.currentTarget.style.background = `${cor}06`; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'rgba(255,255,255,.03)'; }}
                          >
                            <div className="flex-shrink-0 mt-0.5 rounded-md" style={{ width: 4, height: 32, background: cor }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{ev.titulo}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {ev.horario && (
                                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                    <i className="fas fa-clock mr-0.5" />{ev.horario}
                                  </span>
                                )}
                                {ev.etiqueta && (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                                    style={{ background: `${cor}15`, color: cor, border: `1px solid ${cor}30` }}>
                                    {ev.etiqueta.nome}
                                  </span>
                                )}
                              </div>
                              {ev.descricao && (
                                <p className="text-[10px] mt-1 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{ev.descricao}</p>
                              )}
                            </div>
                            <i className="fas fa-chevron-right text-[10px] mt-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-muted)' }} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Movimentações */}
                {movsDia.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-2 px-1 mt-1 flex items-center gap-1.5" style={{ color: '#22d3ee' }}>
                      <i className="fas fa-bolt" />Atualizações <span style={{ color: 'var(--text-muted)' }}>({movsDia.length})</span>
                    </p>
                    <div className="space-y-1.5">
                      {movsDia.map((mov, idx) => (
                        <div
                          key={`mov-${mov.id}-${idx}`}
                          className="flex items-start gap-2.5 p-3 rounded-xl cursor-pointer animate-fadeInFast transition-all"
                          style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)' }}
                          onClick={() => mov.processo && navigate(`/processos/${mov.processo.id}?tab=movimentacoes`)}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(34,211,238,.3)'; e.currentTarget.style.background = 'rgba(34,211,238,.04)'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'rgba(255,255,255,.03)'; }}
                        >
                          <div className="flex-shrink-0 mt-0.5 rounded-md" style={{ width: 4, height: 32, background: '#22d3ee' }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: '#22d3ee' }}>
                              {mov.descricao?.slice(0, 60) || 'Movimentação'}
                            </p>
                            {mov.processo && (
                              <p className="text-[10px] mt-1" style={{ color: 'var(--accent)' }}>
                                <i className="fas fa-user mr-0.5" />
                                {nomeCliente(mov.processo)}
                              </p>
                            )}
                            {mov.origemApi && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-1 inline-block"
                                style={{ background: 'rgba(34,211,238,.1)', color: '#22d3ee', border: '1px solid rgba(34,211,238,.2)' }}>
                                {mov.origemApi.toUpperCase()}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {showNovoEvento && (
        <EventoModal
          evento={novoEventoData ? { data: novoEventoData } : undefined}
          etiquetas={etiquetas}
          onClose={() => { setShowNE(false); setNEData(null); }}
          onSaved={() => { setShowNE(false); setNEData(null); }}
        />
      )}
      {editandoEvento && (
        <EventoModal
          evento={editandoEvento}
          etiquetas={etiquetas}
          onClose={() => setEditEv(null)}
          onSaved={() => setEditEv(null)}
        />
      )}
      {showEtiquetas && <EtiquetasModal onClose={() => setShowEt(false)} />}
      {eventoDetalhe && (
        <EventoDetailModal
          evento={eventoDetalhe}
          onClose={() => setEventoDetalhe(null)}
          onEdit={setEditEv}
          onDelete={(id) => deletarEventoMut.mutate(id)}
        />
      )}
      {tarefaDetalhe && (() => {
        const freshTarefa = tarefas.find(t => t.id === tarefaDetalhe.id) || tarefaDetalhe;
        return (
          <TarefaDetalheModal
            tarefa={freshTarefa}
            onClose={() => setTarefaDetalhe(null)}
            navigate={navigate}
            onConcluir={(t) => setConcluindoTarefa(t)}
            toggleTarefaMut={toggleTarefaMut}
            toggleSubMutation={toggleSubMutation}
            onDelete={(id) => deletarTarefaMut.mutate(id)}
          />
        );
      })()}
      {concluindoTarefa && (
        <ConcluirModal
          tarefa={concluindoTarefa}
          onClose={() => setConcluindoTarefa(null)}
          onConfirm={(obs) => toggleTarefaMut.mutate({ id: concluindoTarefa.id, status: concluindoTarefa.status, observacaoConclusao: obs || null })}
          isPending={toggleTarefaMut.isPending}
        />
      )}
    </div>
  );
}
