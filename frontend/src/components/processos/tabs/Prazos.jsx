import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { formatarData, diasAteVencer } from '../../../utils/formatters';

const TIPOS = ['PROCESSUAL', 'RECURSAL', 'PRESCRICIONAL', 'DECADENCIAL', 'OUTRO'];

const labelStyle = {
  display: 'block', fontSize: '0.7rem', fontWeight: 600,
  letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'var(--text-secondary)', marginBottom: '0.4rem',
};

function ModalNovoPrazo({ onClose, onSave, isPending }) {
  const [form, setForm] = useState({ titulo: '', descricao: '', dataVencimento: '', tipo: '' });
  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));
  const canSave = form.titulo.trim() && form.dataVencimento && !isPending;

  return createPortal(
    <div
      className="animate-fadeIn"
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', padding: '1rem', overflowY: 'auto' }}
    >
      <div className="animate-scaleIn" style={{ background: 'var(--glass-bg, rgba(10,17,40,.92))', backdropFilter: 'blur(24px) saturate(1.3)', WebkitBackdropFilter: 'blur(24px) saturate(1.3)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-gold)', width: '100%', maxWidth: 520, overflow: 'hidden', margin: 'auto' }}>
        <div style={{ padding: '1.25rem 1.5rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius)', background: 'rgba(201,168,76,0.12)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="fas fa-clock" style={{ color: 'var(--accent)', fontSize: 16 }} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Novo Prazo</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>Adicione um prazo ao processo</p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '0.4rem 0.5rem', flexShrink: 0 }}><i className="fas fa-times" /></button>
        </div>

        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Título <span style={{ color: 'var(--accent)' }}>*</span></label>
            <input className="input-base" style={{ fontSize: '0.875rem' }} placeholder="Ex: Prazo para contestação" value={form.titulo} onChange={set('titulo')} autoFocus />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Data de Vencimento <span style={{ color: 'var(--accent)' }}>*</span></label>
              <input type="date" className="input-base" style={{ fontSize: '0.875rem' }} value={form.dataVencimento} onChange={set('dataVencimento')} />
            </div>
            <div>
              <label style={labelStyle}>Tipo <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span></label>
              <input className="input-base" style={{ fontSize: '0.875rem' }} placeholder="Ex: Processual, Recursal..." value={form.tipo} onChange={set('tipo')} list="tipos-prazo" />
              <datalist id="tipos-prazo">
                {TIPOS.map(t => <option key={t} value={t} />)}
              </datalist>
            </div>
          </div>

          {form.dataVencimento && (() => {
            const dias = diasAteVencer(form.dataVencimento);
            if (dias === null) return null;
            const vencido = dias < 0;
            const urgente = dias >= 0 && dias <= 3;
            const color = vencido ? '#ef4444' : urgente ? '#f59e0b' : 'var(--accent)';
            const icon = vencido ? 'fa-triangle-exclamation' : urgente ? 'fa-fire' : 'fa-calendar-check';
            const msg = vencido ? `Vencido há ${Math.abs(dias)} dia${Math.abs(dias) !== 1 ? 's' : ''}` : dias === 0 ? 'Vence hoje!' : urgente ? `Urgente — vence em ${dias} dia${dias !== 1 ? 's' : ''}` : `Vence em ${dias} dia${dias !== 1 ? 's' : ''}`;
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius)', background: `${color}15`, border: `1px solid ${color}40`, fontSize: '0.78rem', color, fontWeight: 600 }}>
                <i className={`fas ${icon}`} style={{ fontSize: 13 }} />{msg}
              </div>
            );
          })()}

          <div>
            <label style={labelStyle}>Descrição <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span></label>
            <textarea className="input-base" style={{ fontSize: '0.875rem', resize: 'vertical', minHeight: 72 }} rows={3} placeholder="Observações adicionais..." value={form.descricao} onChange={set('descricao')} />
          </div>
        </div>

        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', background: 'rgba(255,255,255,.02)' }}>
          <button onClick={onClose} className="btn btn-ghost" style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}>Cancelar</button>
          <button onClick={() => onSave(form)} disabled={!canSave} className="btn btn-gold" style={{ fontSize: '0.875rem', padding: '0.5rem 1.25rem' }}>
            {isPending ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Salvando...</> : <><i className="fas fa-floppy-disk" /> Salvar Prazo</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ModalDetalhe({ prazo, onClose, onCumprir, onDelete, isCumprindo, isDeletando }) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const dias = diasAteVencer(prazo.dataVencimento);
  const vencido = dias !== null && dias < 0;
  const urgente = dias !== null && dias >= 0 && dias <= 3;
  const isDone = prazo.status !== 'PENDENTE';
  const statusColor = isDone ? '#10b981' : vencido ? '#ef4444' : urgente ? '#f59e0b' : 'var(--accent)';

  return createPortal(
    <div
      className="animate-fadeIn"
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', padding: '1rem' }}
    >
      <div className="animate-scaleIn" style={{ background: 'var(--glass-bg, rgba(10,17,40,.92))', backdropFilter: 'blur(24px) saturate(1.3)', WebkitBackdropFilter: 'blur(24px) saturate(1.3)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 480, overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius)', background: `${statusColor}15`, border: `1px solid ${statusColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className={`fas ${isDone ? 'fa-circle-check' : 'fa-clock'}`} style={{ color: statusColor, fontSize: 16 }} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{prazo.titulo}</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>
                {isDone ? 'Prazo cumprido' : 'Detalhes do prazo'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '0.4rem 0.5rem', flexShrink: 0 }}><i className="fas fa-times" /></button>
        </div>

        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ ...labelStyle, marginBottom: '0.25rem' }}>Vencimento</label>
              <p className="text-sm font-medium">{formatarData(prazo.dataVencimento)}</p>
            </div>
            <div>
              <label style={{ ...labelStyle, marginBottom: '0.25rem' }}>Tipo</label>
              <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: 4, background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600 }}>
                {prazo.tipo}
              </span>
            </div>
          </div>
          {prazo.descricao && (
            <div>
              <label style={{ ...labelStyle, marginBottom: '0.25rem' }}>Descrição</label>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{prazo.descricao}</p>
            </div>
          )}
          {!isDone && dias !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius)', background: `${statusColor}15`, border: `1px solid ${statusColor}40`, fontSize: '0.78rem', color: statusColor, fontWeight: 600 }}>
              <i className={`fas ${vencido ? 'fa-triangle-exclamation' : urgente ? 'fa-fire' : 'fa-calendar-check'}`} style={{ fontSize: 13 }} />
              {vencido ? `Vencido há ${Math.abs(dias)} dia${Math.abs(dias) !== 1 ? 's' : ''}` : dias === 0 ? 'Vence hoje!' : `${dias} dia${dias !== 1 ? 's' : ''} restante${dias !== 1 ? 's' : ''}`}
            </div>
          )}
        </div>

        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,.02)' }}>
          <button
            onClick={() => setShowConfirmDelete(true)}
            disabled={isDeletando}
            className="btn btn-danger"
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
          >
            <i className="fas fa-trash" /> Excluir
          </button>
          <button
            onClick={() => onCumprir(prazo.id, prazo.status)}
            disabled={isCumprindo}
            className="btn btn-gold"
            style={{ fontSize: '0.875rem', padding: '0.5rem 1.25rem' }}
          >
            <i className={`fas ${isDone ? 'fa-rotate-left' : 'fa-check'}`} />
            {isDone ? 'Reabrir' : 'Marcar como Cumprido'}
          </button>
        </div>
      </div>

      {/* Confirm delete */}
      {showConfirmDelete && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: 10000, background: 'rgba(0,0,0,.88)', backdropFilter: 'blur(8px)' }}
          onClick={e => e.target === e.currentTarget && setShowConfirmDelete(false)}
        >
          <div className="w-full max-w-sm rounded-2xl overflow-hidden animate-scaleIn text-center" style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(24px)', border: '1px solid var(--border)' }}>
            <div className="p-6">
              <div className="flex items-center justify-center rounded-2xl mx-auto mb-4" style={{ width: 52, height: 52, background: 'rgba(239,68,68,.1)' }}>
                <i className="fas fa-trash text-lg" style={{ color: 'var(--danger)' }} />
              </div>
              <h3 className="text-sm font-bold mb-1">Excluir prazo?</h3>
              <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>Esta ação não pode ser desfeita.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowConfirmDelete(false)} className="btn btn-ghost flex-1 text-sm">Cancelar</button>
                <button
                  onClick={() => { onDelete(prazo.id); setShowConfirmDelete(false); }}
                  disabled={isDeletando}
                  className="btn flex-1 text-sm font-semibold"
                  style={{ background: 'var(--danger)', color: '#fff' }}
                >
                  {isDeletando ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <i className="fas fa-trash" />}
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>,
    document.body
  );
}

export default function TabPrazos({ processo, onRefresh }) {
  const [showModal, setShowModal] = useState(false);
  const [prazoDetalhe, setPrazoDetalhe] = useState(null);
  const qc = useQueryClient();

  const addMutation = useMutation({
    mutationFn: (form) => api.post(`/processos/${processo.id}/prazos`, form),
    onSuccess: () => {
      qc.invalidateQueries(['processo', processo.id]);
      toast.success('Prazo adicionado!');
      setShowModal(false);
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Erro ao adicionar prazo'),
  });

  const cumprir = useMutation({
    mutationFn: ({ id, status }) =>
      api.put(`/processos/${processo.id}/prazos/${id}`, {
        status: status === 'CUMPRIDO' ? 'PENDENTE' : 'CUMPRIDO',
      }),
    onSuccess: () => {
      qc.invalidateQueries(['processo', processo.id]);
      qc.invalidateQueries({ queryKey: ['agenda-prazos'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setPrazoDetalhe(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/processos/${processo.id}/prazos/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(['processo', processo.id]);
      qc.invalidateQueries({ queryKey: ['agenda-prazos'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Prazo removido.');
      setPrazoDetalhe(null);
    },
  });

  const prazos = processo.prazos || [];
  const pendentes = prazos
    .filter(p => p.status === 'PENDENTE')
    .sort((a, b) => new Date(a.dataVencimento) - new Date(b.dataVencimento));
  const cumpridos = prazos.filter(p => p.status !== 'PENDENTE');

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          {prazos.length} prazo{prazos.length !== 1 ? 's' : ''}
        </span>
        <button onClick={() => setShowModal(true)} className="btn btn-ghost" style={{ fontSize: '0.875rem', padding: '0.4rem 0.875rem' }}>
          <i className="fas fa-plus" /> Cadastrar Prazo
        </button>
      </div>

      {prazos.length === 0 ? (
        <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem 1rem', gap: '0.75rem', color: 'var(--text-muted)' }}>
          <i className="fas fa-clock" style={{ fontSize: '2.5rem', opacity: 0.2 }} />
          <p style={{ fontSize: '0.875rem' }}>Nenhum prazo cadastrado.</p>
          <button onClick={() => setShowModal(true)} className="btn btn-gold" style={{ fontSize: '0.875rem', padding: '0.5rem 1.25rem', marginTop: '0.5rem' }}>
            <i className="fas fa-plus" /> Cadastrar Prazo
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {/* Pendentes */}
          {pendentes.map((prazo, i) => {
            const dias = diasAteVencer(prazo.dataVencimento);
            const vencido = dias !== null && dias < 0;
            const urgente = dias !== null && dias >= 0 && dias <= 3;
            const borderColor = vencido ? '#ef4444' : urgente ? '#f59e0b' : 'var(--accent)';
            const bgColor = vencido ? 'rgba(239,68,68,0.05)' : urgente ? 'rgba(245,158,11,0.05)' : 'rgba(255,255,255,.03)';
            const borderWeak = vencido ? 'rgba(239,68,68,0.25)' : urgente ? 'rgba(245,158,11,0.2)' : 'var(--border)';
            const statusColor = vencido ? '#ef4444' : urgente ? '#f59e0b' : 'var(--accent)';
            const statusText = vencido ? `Vencido há ${Math.abs(dias)} dia${Math.abs(dias) !== 1 ? 's' : ''}` : dias === 0 ? 'Vence hoje!' : `${dias} dia${dias !== 1 ? 's' : ''}`;

            return (
              <div
                key={prazo.id}
                className="animate-fadeIn cursor-pointer"
                onClick={() => setPrazoDetalhe(prazo)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.875rem 1rem', borderRadius: 'var(--radius)',
                  background: bgColor, border: `1px solid ${borderWeak}`,
                  borderLeft: `3px solid ${borderColor}`,
                  animationDelay: `${i * 30}ms`, transition: 'var(--transition)',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = borderColor; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = borderWeak; e.currentTarget.style.borderLeftColor = borderColor; }}
              >
                {/* Icon */}
                <i className="fas fa-circle" style={{ color: borderColor, fontSize: 13, flexShrink: 0 }} />

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {prazo.titulo}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', fontSize: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, color: statusColor }}>{statusText}</span>
                    <span style={{ color: 'var(--text-muted)' }}>•</span>
                    <span style={{ color: 'var(--text-muted)' }}>{formatarData(prazo.dataVencimento)}</span>
                    <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.45rem', borderRadius: 4, background: 'rgba(255,255,255,.02)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em' }}>
                      {prazo.tipo}
                    </span>
                  </div>
                </div>

                <i className="fas fa-chevron-right text-xs" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              </div>
            );
          })}

          {/* Cumpridos */}
          {cumpridos.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.875rem', marginTop: '0.5rem' }}>
              <p style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.625rem' }}>
                Cumpridos ({cumpridos.length})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {cumpridos.map(prazo => (
                  <div
                    key={prazo.id}
                    className="cursor-pointer"
                    onClick={() => setPrazoDetalhe(prazo)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.625rem 0.875rem', borderRadius: 'var(--radius)',
                      background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)',
                      opacity: 0.55, transition: 'var(--transition)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '0.55'; }}
                  >
                    <i className="fas fa-circle-check" style={{ color: '#10b981', fontSize: 13, flexShrink: 0 }} />
                    <p style={{ fontSize: '0.875rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'line-through', color: 'var(--text-secondary)' }}>
                      {prazo.titulo}
                    </p>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>{formatarData(prazo.dataVencimento)}</span>
                    <i className="fas fa-chevron-right text-xs" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Novo */}
      {showModal && (
        <ModalNovoPrazo
          onClose={() => setShowModal(false)}
          onSave={(form) => addMutation.mutate(form)}
          isPending={addMutation.isPending}
        />
      )}

      {/* Modal Detalhe */}
      {prazoDetalhe && (
        <ModalDetalhe
          prazo={prazoDetalhe}
          onClose={() => setPrazoDetalhe(null)}
          onCumprir={(id, status) => cumprir.mutate({ id, status })}
          onDelete={(id) => deleteMutation.mutate(id)}
          isCumprindo={cumprir.isPending}
          isDeletando={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
