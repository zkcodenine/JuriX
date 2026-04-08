import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { formatarTempoRelativo } from '../../../utils/formatters';

const MAX_CHARS = 4000;

function ModalNota({ onClose, onSave, onDelete, isPending, isDeleting, editId, initialForm }) {
  const [form, setForm] = useState(initialForm || { titulo: '', conteudo: '' });
  const isEdit = Boolean(editId);
  const canSave = form.conteudo.trim() && !isPending;
  const charCount = form.conteudo.length;
  const nearLimit = charCount > MAX_CHARS * 0.85;

  return createPortal(
    <div
      className="animate-fadeIn"
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
        padding: '1rem', overflowY: 'auto',
      }}
    >
      <div
        className="animate-scaleIn"
        style={{
          background: 'var(--glass-bg, rgba(10,17,40,.92))', backdropFilter: 'blur(24px) saturate(1.3)', WebkitBackdropFilter: 'blur(24px) saturate(1.3)', border: '1px solid rgba(255,255,255,.1)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-gold)',
          width: '100%', maxWidth: 560, overflow: 'hidden',
          display: 'flex', flexDirection: 'column', margin: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius)', background: 'rgba(201,168,76,0.12)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className={`fas ${isEdit ? 'fa-pen-to-square' : 'fa-file-pen'}`} style={{ color: 'var(--accent)', fontSize: 16 }} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {isEdit ? 'Editar Nota' : 'Nova Nota Jurídica'}
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>
                {isEdit ? 'Atualize o conteúdo desta nota' : 'Registre informações jurídicas relevantes'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '0.4rem 0.5rem', flexShrink: 0 }} title="Fechar">
            <i className="fas fa-times" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>
              Título <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span>
            </label>
            <input className="input-base" style={{ fontSize: '0.875rem' }} placeholder="Título da nota jurídica..." value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} autoFocus />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                Conteúdo <span style={{ color: 'var(--accent)' }}>*</span>
              </label>
              <span style={{ fontSize: '0.7rem', color: nearLimit ? (charCount >= MAX_CHARS ? '#ef4444' : '#f59e0b') : 'var(--text-muted)', fontWeight: nearLimit ? 600 : 400 }}>
                {charCount.toLocaleString('pt-BR')} / {MAX_CHARS.toLocaleString('pt-BR')}
              </span>
            </div>
            <textarea className="input-base" style={{ fontSize: '0.875rem', resize: 'vertical', minHeight: 160, lineHeight: 1.6 }} rows={6} placeholder="Escreva sua nota jurídica aqui..." value={form.conteudo} maxLength={MAX_CHARS} onChange={e => setForm(f => ({ ...f, conteudo: e.target.value }))} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,.02)' }}>
          <div>
            {isEdit && (
              <button
                onClick={() => { if (window.confirm('Deseja excluir esta nota?')) onDelete(editId); }}
                disabled={isDeleting}
                className="btn btn-danger"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
              >
                <i className="fas fa-trash" /> Excluir
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={onClose} className="btn btn-ghost" style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}>Cancelar</button>
            <button onClick={() => onSave(form)} disabled={!canSave} className="btn btn-gold" style={{ fontSize: '0.875rem', padding: '0.5rem 1.25rem' }}>
              {isPending
                ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Salvando...</>
                : <><i className="fas fa-floppy-disk" /> {isEdit ? 'Atualizar' : 'Salvar'}</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

const labelStyle = {
  display: 'block', fontSize: '0.7rem', fontWeight: 600,
  letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'var(--text-secondary)', marginBottom: '0.4rem',
};

export default function TabAnotacoes({ processo, onRefresh }) {
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editInitial, setEditInitial] = useState(null);
  const qc = useQueryClient();

  const addMutation = useMutation({
    mutationFn: (form) =>
      editId
        ? api.put(`/processos/${processo.id}/anotacoes/${editId}`, form)
        : api.post(`/processos/${processo.id}/anotacoes`, form),
    onSuccess: () => {
      qc.invalidateQueries(['processo', processo.id]);
      toast.success(editId ? 'Nota atualizada!' : 'Nota salva!');
      setShowModal(false);
      setEditId(null);
      setEditInitial(null);
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Erro ao salvar nota.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/processos/${processo.id}/anotacoes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(['processo', processo.id]);
      toast.success('Nota excluída.');
      setShowModal(false);
      setEditId(null);
      setEditInitial(null);
    },
    onError: () => toast.error('Erro ao excluir nota.'),
  });

  const iniciarEdicao = (an) => {
    setEditInitial({ titulo: an.titulo || '', conteudo: an.conteudo });
    setEditId(an.id);
    setShowModal(true);
  };

  const abrirNova = () => {
    setEditId(null);
    setEditInitial(null);
    setShowModal(true);
  };

  const anotacoes = processo.anotacoes || [];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          {anotacoes.length} nota{anotacoes.length !== 1 ? 's jurídicas' : ' jurídica'}
        </span>
        <button onClick={abrirNova} className="btn btn-ghost" style={{ fontSize: '0.875rem', padding: '0.4rem 0.875rem' }}>
          <i className="fas fa-plus" /> Nova Nota Jurídica
        </button>
      </div>

      {/* Empty state */}
      {anotacoes.length === 0 ? (
        <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem 1rem', gap: '0.75rem', color: 'var(--text-muted)' }}>
          <i className="fas fa-file-pen" style={{ fontSize: '2.5rem', opacity: 0.2 }} />
          <p style={{ fontSize: '0.875rem' }}>Nenhuma nota jurídica registrada.</p>
          <button onClick={abrirNova} className="btn btn-gold" style={{ fontSize: '0.875rem', padding: '0.5rem 1.25rem', marginTop: '0.5rem' }}>
            <i className="fas fa-plus" /> Criar Nota Jurídica
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {anotacoes.map((an, i) => (
            <div
              key={an.id}
              className="animate-fadeIn cursor-pointer"
              onClick={() => iniciarEdicao(an)}
              style={{
                padding: '1rem 1.125rem',
                borderRadius: 'var(--radius)',
                background: 'rgba(255,255,255,.03)',
                border: '1px solid var(--border)',
                position: 'relative',
                animationDelay: `${i * 30}ms`,
                transition: 'var(--transition)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              {/* Accent bar */}
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderRadius: 'var(--radius) 0 0 var(--radius)', background: 'var(--accent)', opacity: 0.6 }} />

              {/* Title */}
              {an.titulo && (
                <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--accent)', marginBottom: '0.5rem', paddingLeft: '0.5rem' }}>
                  {an.titulo}
                </p>
              )}

              {/* Content preview */}
              <p style={{ fontSize: '0.875rem', lineHeight: 1.65, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', paddingLeft: '0.5rem', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {an.conteudo}
              </p>

              {/* Footer */}
              <div style={{ display: 'flex', alignItems: 'center', marginTop: '0.75rem', paddingTop: '0.625rem', borderTop: '1px solid var(--border)', paddingLeft: '0.5rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <i className="fas fa-clock" style={{ marginRight: '0.3rem' }} />
                  {formatarTempoRelativo(an.atualizadoEm)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <ModalNota
          onClose={() => { setShowModal(false); setEditId(null); setEditInitial(null); }}
          onSave={(form) => addMutation.mutate(form)}
          onDelete={(id) => deleteMutation.mutate(id)}
          isPending={addMutation.isPending}
          isDeleting={deleteMutation.isPending}
          editId={editId}
          initialForm={editInitial}
        />
      )}
    </div>
  );
}
