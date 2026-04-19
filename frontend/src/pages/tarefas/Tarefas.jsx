import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { formatarData, formatarTempoRelativo, prioridadeLabel, statusTarefaLabel } from '../../utils/formatters';

const priorCor = { URGENTE: '#ef4444', ALTA: '#f59e0b', MEDIA: '#C9A84C', BAIXA: '#10b981' };
const priorIcon = { URGENTE: 'fa-fire', ALTA: 'fa-arrow-up', MEDIA: 'fa-minus', BAIXA: 'fa-arrow-down' };

/* ─── Modal genérico de confirmação de exclusão ─────── */
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

/* ─── Card de tarefa ─────────────────────────────────────── */
function TarefaCard({ tarefa, onToggle, onDelete, onEdit, onToggleSub }) {
  const navigate = useNavigate();
  const subs = tarefa.subtarefas || [];
  const [expanded, setExpanded] = useState(subs.length > 0);
  const concluidas = subs.filter(s => s.status === 'CONCLUIDA').length;
  const isDone = tarefa.status === 'CONCLUIDA';
  const isOverdue = tarefa.prazo && !isDone && new Date(tarefa.prazo) < new Date();

  return (
    <div
      className="rounded-xl overflow-hidden transition-all animate-fadeIn"
      style={{
        background: 'rgba(255,255,255,.03)', backdropFilter: 'blur(12px)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${priorCor[tarefa.prioridade]}`,
        opacity: isDone ? 0.5 : 1,
      }}
    >
      {/* Clickable banner */}
      <div
        className="flex items-start gap-2.5 px-3 py-3 cursor-pointer transition-colors hover:bg-white/[.02]"
        onClick={() => setExpanded(ex => !ex)}
      >
        {/* Check circle — stops propagation to avoid toggling actions */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(tarefa); }}
          className="flex-shrink-0 mt-0.5 transition-transform hover:scale-110"
          title={isDone ? 'Reabrir tarefa' : 'Concluir tarefa'}
        >
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: 28,
              height: 28,
              border: `2px solid ${isDone ? '#10b981' : 'rgba(255,255,255,.15)'}`,
              background: isDone ? 'rgba(16,185,129,.15)' : 'transparent',
              transition: 'all .2s',
            }}
          >
            {isDone && <i className="fas fa-check text-[11px]" style={{ color: '#10b981' }} />}
          </div>
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-base leading-snug ${isDone ? 'line-through' : ''}`}
            style={{ color: isDone ? 'var(--text-muted)' : 'var(--text-primary)' }}>
            {tarefa.titulo}
          </p>

          {tarefa.descricao && (
            <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
              {tarefa.descricao}
            </p>
          )}

          <div className="flex items-center gap-2.5 mt-2 flex-wrap">
            {/* Priority badge */}
            <span
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: `${priorCor[tarefa.prioridade]}15`,
                color: priorCor[tarefa.prioridade],
                border: `1px solid ${priorCor[tarefa.prioridade]}30`,
              }}
            >
              <i className={`fas ${priorIcon[tarefa.prioridade]} text-[9px]`} />
              {prioridadeLabel[tarefa.prioridade]}
            </span>

            {/* Status badge */}
            {tarefa.status === 'EM_ANDAMENTO' && (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(96,165,250,.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,.2)' }}
              >
                <i className="fas fa-spinner text-[9px]" />
                Em andamento
              </span>
            )}

            {/* Deadline */}
            {tarefa.prazo && (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-medium"
                style={{ color: isOverdue ? '#ef4444' : 'var(--text-muted)' }}
              >
                <i className={`fas ${isOverdue ? 'fa-triangle-exclamation' : 'fa-calendar'} text-[9px]`} />
                {formatarData(tarefa.prazo)}
                {isOverdue && <span className="font-semibold ml-0.5">Atrasada</span>}
              </span>
            )}

            {/* Linked process */}
            {tarefa.processo && (
              <button
                onClick={(e) => { e.stopPropagation(); navigate(`/processos/${tarefa.processoId}`); }}
                className="inline-flex items-center gap-1 text-[11px] font-medium hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                <i className="fas fa-scale-balanced text-[9px]" />
                {tarefa.processo.numeroCnj || tarefa.processo.numero}
              </button>
            )}
          </div>
        </div>

        {/* Right side — subtask count + edit/delete icons */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {subs.length > 0 && (
            <span
              className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg"
              style={{
                background: 'rgba(255,255,255,.05)',
                border: '1px solid var(--border)',
                color: concluidas === subs.length ? '#10b981' : 'var(--text-secondary)',
              }}
            >
              <i className="fas fa-list-check text-[10px]" />
              {concluidas}/{subs.length}
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(tarefa); }}
            className="flex items-center justify-center rounded-lg transition-all hover:bg-white/5"
            style={{ width: 30, height: 30, color: 'var(--text-secondary)' }}
            title="Editar tarefa"
          >
            <i className="fas fa-pen text-[11px]" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(tarefa); }}
            className="flex items-center justify-center rounded-lg transition-all hover:bg-red-500/10"
            style={{ width: 30, height: 30, color: 'var(--text-muted)' }}
            title="Excluir tarefa"
          >
            <i className="fas fa-trash text-[11px]" />
          </button>
        </div>
      </div>

      {/* Subtask progress bar */}
      {subs.length > 0 && (
        <div className="px-4 pb-2">
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.06)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(concluidas / subs.length) * 100}%`,
                background: concluidas === subs.length ? '#10b981' : 'var(--accent)',
              }}
            />
          </div>
        </div>
      )}

      {/* Expanded subtasks */}
      {expanded && subs.length > 0 && (
        <div className="px-4 pb-3 space-y-1" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest pt-3 mb-2" style={{ color: 'var(--text-muted)' }}>
            Subtarefas
          </p>
          {subs.map(sub => (
            <button
              key={sub.id}
              onClick={() => onToggleSub(tarefa.id, sub)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left hover:bg-white/5"
            >
              <div
                className="flex items-center justify-center rounded-full flex-shrink-0"
                style={{
                  width: 20,
                  height: 20,
                  border: `2px solid ${sub.status === 'CONCLUIDA' ? '#10b981' : 'rgba(255,255,255,.15)'}`,
                  background: sub.status === 'CONCLUIDA' ? 'rgba(16,185,129,.15)' : 'transparent',
                }}
              >
                {sub.status === 'CONCLUIDA' && <i className="fas fa-check text-[8px]" style={{ color: '#10b981' }} />}
              </div>
              <span
                className={`text-sm ${sub.status === 'CONCLUIDA' ? 'line-through' : ''}`}
                style={{ color: sub.status === 'CONCLUIDA' ? 'var(--text-muted)' : 'var(--text-primary)' }}
              >
                {sub.titulo}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Modal Nova/Editar Tarefa ──────────────────────────────── */
function NovaTarefaModal({ onClose, editTarefa }) {
  const qc = useQueryClient();
  const isEdit = !!editTarefa?.id;
  const [form, setForm] = useState({
    titulo: editTarefa?.titulo || '',
    descricao: editTarefa?.descricao || '',
    prazo: editTarefa?.prazo ? editTarefa.prazo.slice(0, 10) : '',
    prioridade: editTarefa?.prioridade || 'MEDIA',
    processoId: editTarefa?.processoId || null,
  });
  // For edit mode, keep track of existing subtask IDs so we can diff
  const [subs, setSubs] = useState(
    editTarefa?.subtarefas?.map(s => ({ id: s.id, titulo: s.titulo })) || []
  );
  const [novoSub, setNovoSub] = useState('');

  const { data: processos = [] } = useQuery({
    queryKey: ['processos-select'],
    queryFn: () => api.get('/processos', { params: { limite: 200 } }).then(r => r.data?.processos || r.data?.items || []),
    staleTime: 60000,
  });

  const addSub = () => {
    const t = novoSub.trim();
    if (!t) return;
    setSubs(s => [...s, { titulo: t }]);
    setNovoSub('');
  };

  const removeSub = (i) => setSubs(s => s.filter((_, idx) => idx !== i));

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        // 1. Update main task fields
        await api.put(`/tarefas/${editTarefa.id}`, {
          titulo: form.titulo,
          descricao: form.descricao || null,
          prazo: form.prazo || null,
          prioridade: form.prioridade,
          processoId: form.processoId || null,
        });

        // 2. Handle subtask diffs
        const originalSubs = editTarefa.subtarefas || [];
        const originalIds = originalSubs.map(s => s.id);
        const currentIds = subs.filter(s => s.id).map(s => s.id);

        // Delete removed subtasks
        const removedIds = originalIds.filter(id => !currentIds.includes(id));
        for (const subId of removedIds) {
          await api.delete(`/tarefas/${editTarefa.id}/subtarefas/${subId}`);
        }

        // Add new subtasks (those without id)
        const newSubs = subs.filter(s => !s.id);
        for (const sub of newSubs) {
          await api.post(`/tarefas/${editTarefa.id}/subtarefas`, { titulo: sub.titulo });
        }
      } else {
        await api.post('/tarefas', {
          ...form,
          prazo: form.prazo || null,
          processoId: form.processoId || null,
          status: 'PENDENTE',
          subtarefas: subs.length ? subs : undefined,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries(['tarefas']);
      qc.invalidateQueries({ queryKey: ['agenda-tarefas'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['processo'] });
      toast.success(isEdit ? 'Tarefa atualizada!' : 'Tarefa criada!');
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.error || (isEdit ? 'Erro ao atualizar tarefa' : 'Erro ao criar tarefa')),
  });

  return createPortal(
    <div
      className="animate-fadeIn"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        padding: '1rem',
        overflowY: 'auto',
      }}
    >
      <div
        className="animate-scaleIn"
        style={{
          background: 'var(--glass-bg, rgba(10,17,40,.92))', backdropFilter: 'blur(24px) saturate(1.3)', WebkitBackdropFilter: 'blur(24px) saturate(1.3)',
          border: '1px solid rgba(255,255,255,.1)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-gold)',
          width: '100%',
          maxWidth: 560,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          margin: 'auto',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem 1rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 'var(--radius)',
                background: 'rgba(201,168,76,0.12)',
                border: '1px solid var(--accent-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <i className="fas fa-list-check" style={{ color: 'var(--accent)', fontSize: 16 }} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {isEdit ? 'Editar Tarefa' : 'Nova Tarefa'}
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>
                {isEdit ? 'Atualize os dados desta tarefa' : 'Crie uma nova tarefa para acompanhamento'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost"
            style={{ padding: '0.4rem 0.5rem', flexShrink: 0 }}
            title="Fechar"
          >
            <i className="fas fa-times" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '60vh', overflowY: 'auto' }}>
          {/* Título */}
          <div>
            <label style={labelStyle}>
              Título <span style={{ color: 'var(--accent)' }}>*</span>
            </label>
            <input
              className="input-base"
              style={{ fontSize: '0.875rem' }}
              placeholder="O que precisa ser feito?"
              value={form.titulo}
              onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
              autoFocus
            />
          </div>

          {/* Prazo + Prioridade */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Prazo</label>
              <input
                type="date"
                className="input-base"
                style={{ fontSize: '0.875rem' }}
                value={form.prazo}
                onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))}
              />
            </div>
            <div>
              <label style={labelStyle}>Prioridade</label>
              <select
                className="input-base"
                style={{ fontSize: '0.875rem' }}
                value={form.prioridade}
                onChange={e => setForm(f => ({ ...f, prioridade: e.target.value }))}
              >
                {Object.entries(prioridadeLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          {/* Processo vinculado */}
          <div>
            <label style={labelStyle}>
              Processo vinculado{' '}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                (opcional)
              </span>
            </label>
            <select
              className="input-base"
              style={{ fontSize: '0.875rem' }}
              value={form.processoId || ''}
              onChange={e => setForm(f => ({ ...f, processoId: e.target.value || null }))}
            >
              <option value="">Nenhum processo</option>
              {processos.map(p => (
                <option key={p.id} value={p.id}>{p.numeroCnj || p.numero}</option>
              ))}
            </select>
          </div>

          {/* Descrição */}
          <div>
            <label style={labelStyle}>
              Descrição{' '}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                (opcional)
              </span>
            </label>
            <textarea
              className="input-base"
              style={{ fontSize: '0.875rem', resize: 'vertical', minHeight: 72 }}
              rows={2}
              placeholder="Detalhes adicionais..."
              value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
            />
          </div>

          {/* Subtarefas */}
          <div>
            <label style={labelStyle}>
              Subtarefas
              {subs.length > 0 && (
                <span style={{ marginLeft: 8, fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-muted)' }}>
                  {subs.length} item{subs.length !== 1 ? 'ns' : ''}
                </span>
              )}
            </label>

            {subs.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                {subs.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg"
                    style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)' }}
                  >
                    <i className="fas fa-grip-vertical text-[10px]" style={{ color: 'var(--text-muted)', opacity: .4 }} />
                    <span className="flex-1 text-sm">{s.titulo}</span>
                    <button onClick={() => removeSub(i)} className="text-xs" style={{ color: 'var(--danger)' }}>
                      <i className="fas fa-xmark" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                className="input-base text-sm flex-1"
                placeholder="Adicionar subtarefa..."
                value={novoSub}
                onChange={e => setNovoSub(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } }}
              />
              <button onClick={addSub} disabled={!novoSub.trim()} className="btn btn-ghost px-3" style={{ flexShrink: 0 }}>
                <i className="fas fa-plus text-sm" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.5rem',
            background: 'rgba(255,255,255,.02)',
          }}
        >
          <button onClick={onClose} className="btn btn-ghost" style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
            Cancelar
          </button>
          <button
            onClick={() => mutate()}
            disabled={!form.titulo.trim() || isPending}
            className="btn btn-gold"
            style={{ fontSize: '0.875rem', padding: '0.5rem 1.25rem' }}
          >
            {isPending
              ? <><span className="spinner" style={{ width: 14, height: 14 }} /> {isEdit ? 'Salvando...' : 'Criando...'}</>
              : <><i className={`fas ${isEdit ? 'fa-floppy-disk' : 'fa-plus'}`} /> {isEdit ? 'Salvar' : 'Criar Tarefa'}</>
            }
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

const labelStyle = {
  display: 'block',
  fontSize: '0.7rem',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-secondary)',
  marginBottom: '0.4rem',
};

/* ─── Componente principal ───────────────────────────────── */
/* ─── Modal de Conclusão com Observações ────────────────── */
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

export default function Tarefas() {
  const qc = useQueryClient();
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroPrioridade, setFiltroPrioridade] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editTarefa, setEditTarefa] = useState(null);
  const [busca, setBusca] = useState('');
  const [showFiltros, setShowFiltros] = useState(false);
  const [concluindoTarefa, setConcluindoTarefa] = useState(null);
  const [confirmDeleteTarefa, setConfirmDeleteTarefa] = useState(null);

  const { data: tarefas = [], isLoading } = useQuery({
    queryKey: ['tarefas', filtroStatus, filtroPrioridade],
    queryFn: () => api.get('/tarefas', {
      params: { status: filtroStatus || undefined, prioridade: filtroPrioridade || undefined },
    }).then(r => r.data),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status, observacaoConclusao }) => api.put(`/tarefas/${id}`, {
      status: status === 'CONCLUIDA' ? 'PENDENTE' : 'CONCLUIDA',
      ...(status !== 'CONCLUIDA' && observacaoConclusao !== undefined ? { observacaoConclusao } : {}),
      ...(status === 'CONCLUIDA' ? { observacaoConclusao: null } : {}),
    }),
    onSuccess: () => {
      qc.invalidateQueries(['tarefas']);
      qc.invalidateQueries({ queryKey: ['agenda-tarefas'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['processo'] });
      setConcluindoTarefa(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/tarefas/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(['tarefas']);
      qc.invalidateQueries({ queryKey: ['agenda-tarefas'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['processo'] });
      toast.success('Tarefa excluída.');
    },
  });

  const toggleSubMutation = useMutation({
    mutationFn: ({ tarefaId, sub }) => api.put(`/tarefas/${tarefaId}/subtarefas/${sub.id}`, {
      status: sub.status === 'CONCLUIDA' ? 'PENDENTE' : 'CONCLUIDA',
    }),
    onSuccess: () => {
      qc.invalidateQueries(['tarefas']);
      qc.invalidateQueries({ queryKey: ['agenda-tarefas'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['processo'] });
    },
  });

  // Filter by search
  const tarefasFiltradas = tarefas.filter(t => {
    if (!busca.trim()) return true;
    const q = busca.toLowerCase();
    return t.titulo.toLowerCase().includes(q) || t.descricao?.toLowerCase().includes(q);
  });

  // Stats from all tasks (unfiltered by search)
  const totalPendentes = tarefas.filter(t => t.status === 'PENDENTE').length;
  const totalAndamento = tarefas.filter(t => t.status === 'EM_ANDAMENTO').length;
  const totalConcluidas = tarefas.filter(t => t.status === 'CONCLUIDA').length;
  const totalAtrasadas = tarefas.filter(t => t.prazo && t.status !== 'CONCLUIDA' && new Date(t.prazo) < new Date()).length;

  const statusFilters = [
    { value: '', label: 'Todas', count: tarefas.length, icon: 'fa-list' },
    { value: 'PENDENTE', label: 'Pendentes', count: totalPendentes, icon: 'fa-circle', color: '#C9A84C' },
    { value: 'EM_ANDAMENTO', label: 'Em andamento', count: totalAndamento, icon: 'fa-spinner', color: '#60a5fa' },
    { value: 'CONCLUIDA', label: 'Concluídas', count: totalConcluidas, icon: 'fa-circle-check', color: '#10b981' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Tarefas
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Gerencie suas tarefas e acompanhe o progresso
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn btn-gold">
          <i className="fas fa-plus" /> Nova Tarefa
        </button>
      </div>

      {/* Collapsible Filters */}
      <div>
        <button
          onClick={() => setShowFiltros(f => !f)}
          className="flex items-center gap-2 text-xs font-medium px-3.5 py-2 rounded-lg transition-all"
          style={{
            background: showFiltros ? 'rgba(201,168,76,.06)' : 'rgba(255,255,255,.03)',
            border: '1px solid var(--border)',
            color: (filtroStatus || filtroPrioridade || busca) ? 'var(--accent)' : 'var(--text-secondary)',
          }}
        >
          <i className="fas fa-filter text-[10px]" />
          Filtros
          {(filtroStatus || filtroPrioridade || busca) && (
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
          )}
          <i className={`fas fa-chevron-${showFiltros ? 'up' : 'down'} text-[9px] ml-1`} />
        </button>

        {showFiltros && (
          <div className="flex flex-wrap gap-3 items-center mt-3 animate-fadeIn">
            {/* Status tabs */}
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              {statusFilters.map(s => (
                <button
                  key={s.value}
                  onClick={() => setFiltroStatus(s.value)}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium transition-all"
                  style={{
                    background: filtroStatus === s.value ? 'var(--accent)' : 'transparent',
                    color: filtroStatus === s.value ? '#0a0a0a' : 'var(--text-secondary)',
                    borderRight: '1px solid var(--border)',
                  }}
                >
                  {s.label}
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                    style={{
                      background: filtroStatus === s.value ? 'rgba(0,0,0,.2)' : 'rgba(255,255,255,.06)',
                      color: filtroStatus === s.value ? '#0a0a0a' : 'var(--text-muted)',
                    }}
                  >
                    {s.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Priority filter */}
            <select
              className="input-base text-xs"
              style={{ width: 'auto', padding: '0.5rem 0.75rem' }}
              value={filtroPrioridade}
              onChange={e => setFiltroPrioridade(e.target.value)}
            >
              <option value="">Todas prioridades</option>
              {Object.entries(prioridadeLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>

            {/* Search */}
            <div className="relative ml-auto">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--text-muted)' }} />
              <input
                className="input-base text-xs"
                style={{ paddingLeft: '2rem', width: 220 }}
                placeholder="Buscar tarefa..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Task list */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      ) : tarefasFiltradas.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3" style={{ color: 'var(--text-muted)' }}>
          <div
            className="flex items-center justify-center rounded-2xl mb-2"
            style={{ width: 64, height: 64, background: 'rgba(201,168,76,.08)' }}
          >
            <i className="fas fa-list-check text-2xl" style={{ color: 'var(--accent)', opacity: .4 }} />
          </div>
          <p className="text-sm font-medium">
            {busca ? 'Nenhuma tarefa encontrada para esta busca.' : 'Nenhuma tarefa encontrada.'}
          </p>
          {!busca && (
            <button onClick={() => setShowAdd(true)} className="btn btn-gold text-sm mt-2">
              <i className="fas fa-plus" /> Criar tarefa
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {tarefasFiltradas.map(tarefa => (
            <TarefaCard
              key={tarefa.id}
              tarefa={tarefa}
              onToggle={(t) => {
                if (t.status !== 'CONCLUIDA') {
                  setConcluindoTarefa(t);
                } else {
                  toggleMutation.mutate({ id: t.id, status: t.status });
                }
              }}
              onDelete={(t) => setConfirmDeleteTarefa(t)}
              onEdit={(t) => setEditTarefa(t)}
              onToggleSub={(tarefaId, sub) => toggleSubMutation.mutate({ tarefaId, sub })}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {showAdd && <NovaTarefaModal onClose={() => setShowAdd(false)} />}
      {editTarefa && <NovaTarefaModal editTarefa={editTarefa} onClose={() => setEditTarefa(null)} />}
      {concluindoTarefa && (
        <ConcluirModal
          tarefa={concluindoTarefa}
          onClose={() => setConcluindoTarefa(null)}
          onConfirm={(obs) => toggleMutation.mutate({ id: concluindoTarefa.id, status: concluindoTarefa.status, observacaoConclusao: obs || null })}
          isPending={toggleMutation.isPending}
        />
      )}
      {confirmDeleteTarefa && (
        <ConfirmDeleteModal
          title={`Excluir "${confirmDeleteTarefa.titulo}"?`}
          message="Esta ação não pode ser desfeita."
          onConfirm={() => { deleteMutation.mutate(confirmDeleteTarefa.id); setConfirmDeleteTarefa(null); }}
          onCancel={() => setConfirmDeleteTarefa(null)}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
