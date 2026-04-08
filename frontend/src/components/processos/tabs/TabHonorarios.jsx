import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { formatarData, formatarMoeda } from '../../../utils/formatters';

const statusCor = {
  PENDENTE: '#f59e0b',
  PAGO: '#10b981',
  ATRASADO: '#ef4444',
  CANCELADO: '#6b7280',
};

const statusBg = {
  PENDENTE: 'rgba(245,158,11,0.12)',
  PAGO: 'rgba(16,185,129,0.12)',
  ATRASADO: 'rgba(239,68,68,0.12)',
  CANCELADO: 'rgba(107,114,128,0.12)',
};

function addMonths(dateStr, months) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d.getTime())) return '';
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

function ModalNovoHonorario({ onClose, onSave, isPending }) {
  const [form, setForm] = useState({
    valorTotal: '',
    descricao: '',
    numParcelas: '1',
    primeiroVencimento: '',
  });

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));
  const nParcelas = parseInt(form.numParcelas, 10) || 1;
  const valorP = form.valorTotal
    ? parseFloat((parseFloat(form.valorTotal) / nParcelas).toFixed(2))
    : 0;
  const canSave = form.valorTotal && parseFloat(form.valorTotal) > 0 && form.primeiroVencimento && !isPending;
  const showPreview = form.valorTotal && form.primeiroVencimento && nParcelas > 1;

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="animate-fadeIn"
      onClick={handleBackdrop}
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
          maxWidth: 540,
          overflow: 'hidden',
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
              <i className="fas fa-sack-dollar" style={{ color: 'var(--accent)', fontSize: 16 }} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Novo Honorário
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>
                Cadastre os honorários e defina as parcelas
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
        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Valor + Descrição */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>
                Valor Total (R$) <span style={{ color: 'var(--accent)' }}>*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input-base"
                style={{ fontSize: '0.875rem' }}
                placeholder="5000.00"
                value={form.valorTotal}
                onChange={set('valorTotal')}
                autoFocus
              />
            </div>
            <div>
              <label style={labelStyle}>Descrição</label>
              <input
                className="input-base"
                style={{ fontSize: '0.875rem' }}
                placeholder="Honorários advocatícios"
                value={form.descricao}
                onChange={set('descricao')}
              />
            </div>
          </div>

          {/* Parcelas + Vencimento */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Número de Parcelas</label>
              <select
                className="input-base"
                style={{ fontSize: '0.875rem' }}
                value={form.numParcelas}
                onChange={set('numParcelas')}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                  <option key={n} value={n}>
                    {n}x{form.valorTotal && parseFloat(form.valorTotal) > 0
                      ? ` de ${formatarMoeda(parseFloat(form.valorTotal) / n)}`
                      : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>
                1º Vencimento <span style={{ color: 'var(--accent)' }}>*</span>
              </label>
              <input
                type="date"
                className="input-base"
                style={{ fontSize: '0.875rem' }}
                value={form.primeiroVencimento}
                onChange={set('primeiroVencimento')}
              />
            </div>
          </div>

          {/* Preview parcelas */}
          {showPreview && (
            <div
              style={{
                borderRadius: 'var(--radius)',
                border: '1px solid var(--accent-border)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '0.6rem 0.875rem',
                  background: 'rgba(201,168,76,0.08)',
                  borderBottom: '1px solid var(--accent-border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <i className="fas fa-list-check" style={{ color: 'var(--accent)', fontSize: 12 }} />
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase',
                    color: 'var(--accent)',
                  }}
                >
                  Prévia das Parcelas
                </span>
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto', background: 'rgba(255,255,255,.02)' }}>
                {Array.from({ length: nParcelas }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.5rem 0.875rem',
                      borderBottom: i < nParcelas - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: 'rgba(201,168,76,0.15)',
                          border: '1px solid var(--accent-border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          color: 'var(--accent)',
                          flexShrink: 0,
                        }}
                      >
                        {i + 1}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {formatarData(addMonths(form.primeiroVencimento, i))}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {formatarMoeda(valorP)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
            onClick={() => onSave(form)}
            disabled={!canSave}
            className="btn btn-gold"
            style={{ fontSize: '0.875rem', padding: '0.5rem 1.25rem' }}
          >
            {isPending
              ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Salvando...</>
              : <><i className="fas fa-floppy-disk" /> Salvar Honorário</>
            }
          </button>
        </div>
      </div>
    </div>
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

export default function TabHonorarios({ processo }) {
  const [showModal, setShowModal] = useState(false);
  const qc = useQueryClient();

  const addMutation = useMutation({
    mutationFn: (form) => {
      const total = parseFloat(form.valorTotal);
      const n = parseInt(form.numParcelas, 10);
      const valorP = parseFloat((total / n).toFixed(2));
      const parcelas = Array.from({ length: n }, (_, i) => ({
        valor: valorP,
        vencimento: addMonths(form.primeiroVencimento, i),
      }));
      return api.post('/honorarios', {
        processoId: processo.id,
        valorTotal: total,
        descricao: form.descricao,
        parcelas,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries(['processo', processo.id]);
      toast.success('Honorário cadastrado!');
      setShowModal(false);
    },
    onError: () => toast.error('Erro ao cadastrar honorário'),
  });

  const pagarParcela = useMutation({
    mutationFn: ({ hId, pId, status }) =>
      api.put(`/honorarios/${hId}/parcelas/${pId}`, {
        status: status === 'PAGO' ? 'PENDENTE' : 'PAGO',
        dataPagamento: status !== 'PAGO' ? new Date().toISOString() : null,
      }),
    onSuccess: () => qc.invalidateQueries(['processo', processo.id]),
  });

  const honorarios = processo.honorarios || [];
  const totalGeral = honorarios.reduce((a, h) => a + Number(h.valorTotal), 0);
  const totalPago = honorarios
    .flatMap(h => h.parcelas || [])
    .filter(p => p.status === 'PAGO')
    .reduce((a, p) => a + Number(p.valor), 0);
  const totalPendente = totalGeral - totalPago;

  return (
    <div>
      {/* Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.75rem',
          marginBottom: '1.25rem',
        }}
      >
        {/* Total */}
        <div
          style={{
            borderRadius: 'var(--radius)',
            padding: '0.875rem 1rem',
            background: 'rgba(201,168,76,0.08)',
            border: '1px solid var(--accent-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: 'rgba(201,168,76,0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <i className="fas fa-sack-dollar" style={{ color: 'var(--accent)', fontSize: 12 }} />
            </div>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Total
            </span>
          </div>
          <p style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>
            {formatarMoeda(totalGeral)}
          </p>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            {honorarios.length} honorário{honorarios.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Recebido */}
        <div
          style={{
            borderRadius: 'var(--radius)',
            padding: '0.875rem 1rem',
            background: 'rgba(16,185,129,0.06)',
            border: '1px solid rgba(16,185,129,0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: 'rgba(16,185,129,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <i className="fas fa-circle-check" style={{ color: '#10b981', fontSize: 12 }} />
            </div>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#10b981', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Recebido
            </span>
          </div>
          <p style={{ fontSize: '1.05rem', fontWeight: 800, color: '#10b981', lineHeight: 1 }}>
            {formatarMoeda(totalPago)}
          </p>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            {totalGeral > 0 ? Math.round((totalPago / totalGeral) * 100) : 0}% do total
          </p>
        </div>

        {/* Pendente */}
        <div
          style={{
            borderRadius: 'var(--radius)',
            padding: '0.875rem 1rem',
            background: 'rgba(245,158,11,0.06)',
            border: '1px solid rgba(245,158,11,0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: 'rgba(245,158,11,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <i className="fas fa-hourglass-half" style={{ color: '#f59e0b', fontSize: 12 }} />
            </div>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#f59e0b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Pendente
            </span>
          </div>
          <p style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f59e0b', lineHeight: 1 }}>
            {formatarMoeda(totalPendente)}
          </p>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            {totalGeral > 0 ? Math.round((totalPendente / totalGeral) * 100) : 0}% do total
          </p>
        </div>
      </div>

      {/* Empty state */}
      {honorarios.length === 0 ? (
        <div
          className="animate-fadeIn"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '2.5rem 1rem',
            gap: '0.75rem',
            color: 'var(--text-muted)',
            borderRadius: 'var(--radius)',
            border: '1px dashed var(--border)',
          }}
        >
          <i className="fas fa-sack-dollar" style={{ fontSize: '2.5rem', opacity: 0.2 }} />
          <p style={{ fontSize: '0.875rem' }}>Nenhum honorário cadastrado.</p>
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-gold"
            style={{ fontSize: '0.875rem', padding: '0.5rem 1.25rem', marginTop: '0.25rem' }}
          >
            <i className="fas fa-plus" /> Cadastrar Honorário
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {honorarios.map((h, i) => (
            <HonorarioBlock
              key={h.id}
              honorario={h}
              index={i}
              onPagar={(pId, status) => pagarParcela.mutate({ hId: h.id, pId, status })}
            />
          ))}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.25rem' }}>
            <button
              onClick={() => setShowModal(true)}
              className="btn btn-gold"
              style={{ fontSize: '0.875rem', padding: '0.5rem 1.25rem' }}
            >
              <i className="fas fa-plus" /> Cadastrar Honorário
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && createPortal(
        <ModalNovoHonorario
          onClose={() => setShowModal(false)}
          onSave={(form) => addMutation.mutate(form)}
          isPending={addMutation.isPending}
        />,
        document.body
      )}
    </div>
  );
}

function HonorarioBlock({ honorario: h, index, onPagar }) {
  const [expanded, setExpanded] = useState(true);
  const pago = (h.parcelas || []).filter(p => p.status === 'PAGO').reduce((a, p) => a + Number(p.valor), 0);
  const progresso = h.valorTotal > 0 ? Math.round((pago / Number(h.valorTotal)) * 100) : 0;

  return (
    <div
      className="animate-fadeIn"
      style={{
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
        animationDelay: `${index * 40}ms`,
      }}
    >
      {/* Block header */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.875rem 1rem',
          background: 'rgba(255,255,255,.03)',
          border: 'none',
          cursor: 'pointer',
          gap: '0.75rem',
          textAlign: 'left',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {h.descricao || 'Honorários Advocatícios'}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.3rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {(h.parcelas || []).length} parcela{(h.parcelas || []).length !== 1 ? 's' : ''}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>•</span>
            <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>
              {progresso}% recebido
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
          <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent)', margin: 0 }}>
            {formatarMoeda(h.valorTotal)}
          </p>
          <i
            className={`fas fa-chevron-${expanded ? 'up' : 'down'}`}
            style={{ fontSize: 12, color: 'var(--text-muted)', transition: 'transform 0.2s' }}
          />
        </div>
      </button>

      {/* Progress bar */}
      <div style={{ height: 3, background: 'rgba(255,255,255,.02)', position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: `${progresso}%`,
            background: 'var(--success)',
            transition: 'width 0.4s ease',
          }}
        />
      </div>

      {/* Parcelas list */}
      {expanded && (
        <div style={{ background: 'rgba(255,255,255,.03)' }}>
          {(h.parcelas || []).map((parcela, pi) => {
            const isPago = parcela.status === 'PAGO';
            const statusColor = statusCor[parcela.status] || '#6b7280';
            const statusBackground = statusBg[parcela.status] || 'rgba(107,114,128,0.12)';

            return (
              <div
                key={parcela.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderBottom: pi < (h.parcelas.length - 1) ? '1px solid var(--border)' : 'none',
                  opacity: parcela.status === 'CANCELADO' ? 0.5 : 1,
                  transition: 'background 0.15s',
                }}
              >
                {/* Toggle */}
                <button
                  onClick={() => onPagar(parcela.id, parcela.status)}
                  title={isPago ? 'Marcar como pendente' : 'Marcar como pago'}
                  style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <i
                    className={`fas fa-${isPago ? 'circle-check' : 'circle'} text-base`}
                    style={{ color: statusColor, fontSize: 17, transition: 'color 0.2s' }}
                  />
                </button>

                {/* Label */}
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', flex: 1 }}>
                  Parcela {pi + 1}
                </span>

                {/* Value */}
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0 }}>
                  {formatarMoeda(parcela.valor)}
                </span>

                {/* Date */}
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0, minWidth: 80, textAlign: 'right' }}>
                  {formatarData(parcela.vencimento)}
                </span>

                {/* Status badge */}
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.55rem',
                    borderRadius: 100,
                    background: statusBackground,
                    color: statusColor,
                    flexShrink: 0,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  {parcela.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
