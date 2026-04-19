import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { formatarData, prioridadeLabel, statusTarefaLabel } from '../../../utils/formatters';

const priorCor = { URGENTE: '#ef4444', ALTA: '#f59e0b', MEDIA: '#C9A84C', BAIXA: '#10b981' };
const priorIcon = { URGENTE: 'fa-fire', ALTA: 'fa-arrow-up', MEDIA: 'fa-minus', BAIXA: 'fa-arrow-down' };
const statusCor = { PENDENTE: '#a0a0a0', EM_ANDAMENTO: '#60a5fa', CONCLUIDA: '#10b981', CANCELADA: '#ef4444' };

function TarefaItem({ tarefa, isDone, isOverdue, index, onToggle, onDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="rounded-xl overflow-hidden transition-all animate-fadeIn"
      style={{
        background: 'rgba(255,255,255,.03)',
        border: `1px solid ${open ? 'var(--accent-border, rgba(201,168,76,.3))' : 'var(--border)'}`,
        borderLeft: `3px solid ${priorCor[tarefa.prioridade]}`,
        animationDelay: `${index * 30}ms`,
        opacity: isDone ? 0.6 : 1,
      }}
    >
      <div
        className="flex items-start gap-3 p-3.5 cursor-pointer transition-colors hover:bg-white/[.02]"
        onClick={() => setOpen(o => !o)}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="mt-0.5 flex-shrink-0 transition-transform hover:scale-110"
          title={isDone ? 'Reabrir tarefa' : 'Concluir tarefa'}
        >
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: 24, height: 24,
              border: `2px solid ${isDone ? '#10b981' : 'rgba(255,255,255,.15)'}`,
              background: isDone ? 'rgba(16,185,129,.15)' : 'transparent',
              transition: 'all .2s',
            }}
          >
            {isDone && <i className="fas fa-check text-[9px]" style={{ color: '#10b981' }} />}
          </div>
        </button>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${isDone ? 'line-through' : ''}`}
            style={{ color: isDone ? 'var(--text-muted)' : 'var(--text-primary)' }}>
            {tarefa.titulo}
          </p>
          {tarefa.descricao && <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>{tarefa.descricao}</p>}
          <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
            <span
              className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: `${priorCor[tarefa.prioridade]}15`, color: priorCor[tarefa.prioridade], border: `1px solid ${priorCor[tarefa.prioridade]}30` }}
            >
              <i className={`fas ${priorIcon[tarefa.prioridade]} text-[8px]`} />
              {prioridadeLabel[tarefa.prioridade]}
            </span>
            {tarefa.prazo && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium"
                style={{ color: isOverdue ? '#ef4444' : 'var(--text-muted)' }}>
                <i className={`fas ${isOverdue ? 'fa-triangle-exclamation' : 'fa-calendar'} text-[9px]`} />
                {formatarData(tarefa.prazo)}
                {isOverdue && <span className="font-semibold ml-0.5">Atrasada</span>}
              </span>
            )}
            {tarefa.subtarefas?.length > 0 && (
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                <i className="fas fa-list text-[9px] mr-1" />{tarefa.subtarefas.filter(s => s.status === 'CONCLUIDA').length}/{tarefa.subtarefas.length}
              </span>
            )}
          </div>
        </div>

        <i className={`fas fa-chevron-${open ? 'up' : 'down'} text-[10px] mt-2 flex-shrink-0`}
          style={{ color: 'var(--text-muted)' }} />
      </div>

      {open && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 animate-fadeIn"
          style={{ borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,.02)' }}
        >
          <button
            onClick={onToggle}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all hover:bg-white/5"
            style={{ color: isDone ? '#f59e0b' : '#10b981' }}
          >
            <i className={`fas ${isDone ? 'fa-rotate-left' : 'fa-check'} text-[10px]`} />
            {isDone ? 'Reabrir' : 'Concluir'}
          </button>
          <div className="flex-1" />
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all hover:bg-red-500/10"
            style={{ color: 'var(--danger)' }}
          >
            <i className="fas fa-trash text-[10px]" />
            Excluir
          </button>
        </div>
      )}
    </div>
  );
}

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

export default function TabTarefas({ processo, onRefresh }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ titulo: '', descricao: '', prazo: '', prioridade: 'MEDIA' });
  const [concluindoTarefa, setConcluindoTarefa] = useState(null);
  const [confirmDeleteTarefa, setConfirmDeleteTarefa] = useState(null);
  const qc = useQueryClient();

  const invalidateAll = () => {
    qc.invalidateQueries(['processo', processo.id]);
    qc.invalidateQueries({ queryKey: ['tarefas'] });
    qc.invalidateQueries({ queryKey: ['agenda-tarefas'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const addMutation = useMutation({
    mutationFn: () => api.post('/tarefas', { ...form, prazo: form.prazo || null, processoId: processo.id, status: 'PENDENTE' }),
    onSuccess: () => { invalidateAll(); toast.success('Tarefa criada!'); setShowAdd(false); setForm({ titulo: '', descricao: '', prazo: '', prioridade: 'MEDIA' }); },
    onError: (e) => toast.error(e.response?.data?.error || 'Erro ao criar tarefa'),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status, observacaoConclusao }) => api.put(`/tarefas/${id}`, {
      status: status === 'CONCLUIDA' ? 'PENDENTE' : 'CONCLUIDA',
      ...(status !== 'CONCLUIDA' && observacaoConclusao !== undefined ? { observacaoConclusao } : {}),
      ...(status === 'CONCLUIDA' ? { observacaoConclusao: null } : {}),
    }),
    onSuccess: () => { invalidateAll(); setConcluindoTarefa(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/tarefas/${id}`),
    onSuccess: () => { invalidateAll(); toast.success('Tarefa excluída.'); },
  });

  const tarefas = processo.tarefas || [];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{tarefas.length} tarefa{tarefas.length !== 1 ? 's' : ''}</span>
        <button onClick={() => setShowAdd(!showAdd)} className="btn btn-ghost text-sm py-2">
          <i className="fas fa-plus" /> Nova Tarefa
        </button>
      </div>

      {showAdd && (
        <div className="rounded-xl p-4 mb-5 space-y-3 animate-fadeIn" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)' }}>
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Título *</label>
            <input className="input-base text-sm" placeholder="O que precisa ser feito?" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Prazo</label>
              <input type="date" className="input-base text-sm" value={form.prazo} onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Prioridade</label>
              <select className="input-base text-sm" value={form.prioridade} onChange={e => setForm(f => ({ ...f, prioridade: e.target.value }))}>
                {Object.entries(prioridadeLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Descrição</label>
            <textarea className="input-base text-sm" rows={2} placeholder="Detalhes opcionais..." value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAdd(false)} className="btn btn-ghost text-sm py-2">Cancelar</button>
            <button onClick={() => addMutation.mutate()} disabled={!form.titulo || addMutation.isPending} className="btn btn-gold text-sm py-2">
              {addMutation.isPending ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <i className="fas fa-plus" />} Salvar
            </button>
          </div>
        </div>
      )}

      {tarefas.length === 0 ? (
        <div className="flex flex-col items-center py-12 gap-3" style={{ color: 'var(--text-muted)' }}>
          <i className="fas fa-list-check text-4xl" style={{ opacity: .2 }} />
          <p className="text-sm">Nenhuma tarefa criada.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tarefas.map((tarefa, i) => {
            const isDone = tarefa.status === 'CONCLUIDA';
            const isOverdue = tarefa.prazo && !isDone && new Date(tarefa.prazo) < new Date();
            return (
              <TarefaItem
                key={tarefa.id}
                tarefa={tarefa}
                isDone={isDone}
                isOverdue={isOverdue}
                index={i}
                onToggle={() => {
                  if (tarefa.status !== 'CONCLUIDA') {
                    setConcluindoTarefa(tarefa);
                  } else {
                    toggleStatus.mutate({ id: tarefa.id, status: tarefa.status });
                  }
                }}
                onDelete={() => setConfirmDeleteTarefa(tarefa)}
              />
            );
          })}
        </div>
      )}

      {concluindoTarefa && (
        <ConcluirModal
          tarefa={concluindoTarefa}
          onClose={() => setConcluindoTarefa(null)}
          onConfirm={(obs) => toggleStatus.mutate({ id: concluindoTarefa.id, status: concluindoTarefa.status, observacaoConclusao: obs || null })}
          isPending={toggleStatus.isPending}
        />
      )}

      {confirmDeleteTarefa && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: 10000, background: 'rgba(0,0,0,.88)', backdropFilter: 'blur(8px)' }}
          onClick={e => e.target === e.currentTarget && setConfirmDeleteTarefa(null)}
        >
          <div className="w-full max-w-sm rounded-2xl overflow-hidden animate-scaleIn text-center" style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(24px)', border: '1px solid var(--border)' }}>
            <div className="p-6">
              <div className="flex items-center justify-center rounded-2xl mx-auto mb-4" style={{ width: 52, height: 52, background: 'rgba(239,68,68,.1)' }}>
                <i className="fas fa-trash text-lg" style={{ color: 'var(--danger)' }} />
              </div>
              <h3 className="text-sm font-bold mb-1">Excluir tarefa?</h3>
              <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>Esta ação não pode ser desfeita.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDeleteTarefa(null)} className="btn btn-ghost flex-1 text-sm">Cancelar</button>
                <button
                  onClick={() => { deleteMutation.mutate(confirmDeleteTarefa.id); setConfirmDeleteTarefa(null); }}
                  disabled={deleteMutation.isPending}
                  className="btn flex-1 text-sm font-semibold"
                  style={{ background: 'var(--danger)', color: '#fff' }}
                >
                  {deleteMutation.isPending ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <i className="fas fa-trash" />}
                  {' '}Excluir
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
