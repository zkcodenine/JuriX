import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { formatarNumeroCNJ, formatarData } from '../../utils/formatters';

const TRIBUNAIS = [
  // Estaduais
  'TJAC', 'TJAL', 'TJAM', 'TJAP', 'TJBA', 'TJCE', 'TJDF', 'TJES', 'TJGO', 'TJMA',
  'TJMG', 'TJMS', 'TJMT', 'TJPA', 'TJPB', 'TJPE', 'TJPI', 'TJPR', 'TJRJ', 'TJRN',
  'TJRO', 'TJRR', 'TJRS', 'TJSC', 'TJSE', 'TJSP', 'TJTO',
  // Superiores
  'STF', 'STJ', 'STM', 'TST', 'TSE',
  // Federal
  'TRF1', 'TRF2', 'TRF3', 'TRF4', 'TRF5', 'TRF6',
  // Trabalho
  'TRT1', 'TRT2', 'TRT3', 'TRT4', 'TRT5', 'TRT6', 'TRT7', 'TRT8', 'TRT9', 'TRT10',
  'TRT11', 'TRT12', 'TRT13', 'TRT14', 'TRT15', 'TRT16', 'TRT17', 'TRT18', 'TRT19',
  'TRT20', 'TRT21', 'TRT22', 'TRT23', 'TRT24',
  // Eleitoral
  'TREAC', 'TREAL', 'TREAM', 'TREAP', 'TREBA', 'TRECE', 'TREDF', 'TREES', 'TREGO',
  'TREMA', 'TREMG', 'TREMS', 'TREMT', 'TREPA', 'TREPB', 'TREPE', 'TREPI', 'TREPR',
  'TRERJ', 'TRERN', 'TRERO', 'TRERR', 'TRERS', 'TRESC', 'TRESE', 'TRESP', 'TRETO',
  // Militar Estadual
  'TJMMG', 'TJMRS', 'TJMSP',
];

// Detecta o tribunal automaticamente pelo código CNJ (J.TT)
// Formato: NNNNNNN-DD.AAAA.J.TT.OOOO
function detectarTribunal(numeroCnj) {
  const digits = numeroCnj.replace(/\D/g, '');
  if (digits.length < 16) return null;
  const j = digits[13];           // segmento de justiça
  const tt = digits.slice(14, 16); // código do tribunal (dois dígitos)
  const code = parseInt(tt, 10);

  if (j === '8') { // Justiça Estadual
    const map = {
      1: 'TJAC', 2: 'TJAL', 3: 'TJAP', 4: 'TJAM', 5: 'TJBA', 6: 'TJCE', 7: 'TJDF',
      8: 'TJES', 9: 'TJGO', 10: 'TJMA', 11: 'TJMT', 12: 'TJMS', 13: 'TJMG',
      14: 'TJPA', 15: 'TJPB', 16: 'TJPR', 17: 'TJPE', 18: 'TJPI', 19: 'TJRJ',
      20: 'TJRN', 21: 'TJRS', 22: 'TJRO', 23: 'TJRR', 24: 'TJSC', 25: 'TJSE',
      26: 'TJSP', 27: 'TJTO'
    };
    return map[code] || null;
  }
  if (j === '4') { // Justiça Federal
    const map = { 1: 'TRF1', 2: 'TRF2', 3: 'TRF3', 4: 'TRF4', 5: 'TRF5', 6: 'TRF6' };
    return map[code] || null;
  }
  if (j === '5') { // Justiça do Trabalho
    return code >= 1 && code <= 24 ? `TRT${code}` : 'TST';
  }
  if (j === '6') { // Justiça Eleitoral
    const map = {
      1: 'TREAC', 2: 'TREAL', 3: 'TREAM', 4: 'TREAP', 5: 'TREBA', 6: 'TRECE',
      7: 'TREDF', 8: 'TREES', 9: 'TREGO', 10: 'TREMA', 11: 'TREMG', 12: 'TREMS',
      13: 'TREMT', 14: 'TREPA', 15: 'TREPB', 16: 'TREPE', 17: 'TREPI', 18: 'TREPR',
      19: 'TRERJ', 20: 'TRERN', 21: 'TRERS', 22: 'TRERO', 23: 'TRERR', 24: 'TRESC',
      25: 'TRESE', 26: 'TRESP', 27: 'TRETO'
    };
    return map[code] || 'TSE';
  }
  if (j === '9') { // Justiça Militar
    const map = { 1: 'STM', 13: 'TJMMG', 21: 'TJMRS', 26: 'TJMSP' };
    return map[code] || 'STM';
  }
  if (j === '3') return 'STJ';
  if (j === '1') { if (code === 1) return 'STF'; if (code === 2) return 'STJ'; }
  return null;
}

export default function VincularCNJModal({ onClose, onSuccess, processoId, numeroPreExistente }) {
  const formatarCNJ = (val) => {
    const n = val.replace(/\D/g, '').slice(0, 20);
    let r = n;
    if (n.length > 7) r = `${n.slice(0, 7)}-${n.slice(7)}`;
    if (n.length > 9) r = `${n.slice(0, 7)}-${n.slice(7, 9)}.${n.slice(9)}`;
    if (n.length > 13) r = `${n.slice(0, 7)}-${n.slice(7, 9)}.${n.slice(9, 13)}.${n.slice(13)}`;
    if (n.length > 14) r = `${n.slice(0, 7)}-${n.slice(7, 9)}.${n.slice(9, 13)}.${n.slice(13, 14)}.${n.slice(14)}`;
    if (n.length > 16) r = `${n.slice(0, 7)}-${n.slice(7, 9)}.${n.slice(9, 13)}.${n.slice(13, 14)}.${n.slice(14, 16)}.${n.slice(16)}`;
    return r;
  };

  const initialNumero = numeroPreExistente ? formatarCNJ(numeroPreExistente) : '';
  const initialTribunal = initialNumero ? detectarTribunal(initialNumero) : '';

  const [step, setStep] = useState(1); // 1: busca, 2: preview, 3: sucesso, 4: conflito
  const [form, setForm] = useState({ numeroCnj: initialNumero, tribunal: initialTribunal || '' });
  const [tribunalDetectado, setTribunalDetectado] = useState(initialTribunal);
  const [preview, setPreview] = useState(null);
  const [processoExistente, setProcessoExistente] = useState(null);
  const navigate = useNavigate();

  // Modo importar: cria novo processo via CNJ
  // Modo vincular (processoId definido): retorna preview para confirmação
  const buscarMutation = useMutation({
    mutationFn: (dados) => processoId
      ? api.post(`/processos/${processoId}/vincular-cnj`, dados)
      : api.post('/processos/importar-cnj', dados),
    onSuccess: (res) => {
      if (processoId) {
        setPreview(res.data.preview);
        setStep(2);
      } else {
        setStep(3);
        setPreview(res.data.processo);
        toast.success('Processo importado com sucesso!');
      }
    },
    onError: (e) => {
      if (e.response?.status === 409 && e.response?.data?.processoExistente) {
        setProcessoExistente(e.response.data.processoExistente);
        setStep(4); // Show conflict screen
      } else {
        toast.error(e.response?.data?.error || 'Processo não encontrado no DataJud.');
      }
    },
  });

  // Força reimportação — deleta o existente e importa de novo
  const reimportarMutation = useMutation({
    mutationFn: () => api.post('/processos/importar-cnj', { numeroCnj: form.numeroCnj, tribunal: form.tribunal, forcar: true }),
    onSuccess: (res) => {
      setStep(3);
      setPreview(res.data.processo);
      setProcessoExistente(null);
      toast.success('Processo reimportado com sucesso!');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Erro ao reimportar processo.'),
  });

  const confirmarMutation = useMutation({
    mutationFn: () => api.post(`/processos/${processoId}/confirmar-cnj`, form),
    onSuccess: () => {
      toast.success('Processo vinculado ao CNJ com sucesso!');
      onSuccess?.();
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Erro ao vincular'),
  });



  const handleCNJChange = (val) => {
    const formatted = formatarCNJ(val);
    const detectado = detectarTribunal(formatted);
    setTribunalDetectado(detectado);
    setForm(f => ({ ...f, numeroCnj: formatted, tribunal: detectado || f.tribunal || 'TJSP' }));
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(6px)' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-xl rounded-2xl overflow-hidden animate-scaleIn my-auto" style={{ background: 'var(--glass-bg, rgba(10,17,40,.92))', backdropFilter: 'blur(24px) saturate(1.3)', WebkitBackdropFilter: 'blur(24px) saturate(1.3)', border: '1px solid var(--border)' }}>

        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="rounded-lg flex items-center justify-center" style={{ width: 36, height: 36, background: 'rgba(201,168,76,.12)' }}>
              <i className="fas fa-link" style={{ color: '#C9A84C' }} />
            </div>
            <div>
              <h3 className="text-base font-bold">Vincular ao DataJud/CNJ</h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {step === 1 ? 'Informe o número CNJ para consultar' : step === 2 ? 'Confirme os dados encontrados' : step === 4 ? 'Processo já existe no sistema' : 'Importado com sucesso!'}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-secondary)' }}><i className="fas fa-xmark text-xl" /></button>
        </div>

        <div className="p-6">

          {/* ─── STEP 1: Busca ────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  Número CNJ *
                </label>
                <input
                  className="input-base font-mono text-sm"
                  placeholder="0000000-00.0000.0.00.0000"
                  value={form.numeroCnj}
                  onChange={e => handleCNJChange(e.target.value)}
                  autoFocus
                />
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Formato: NNNNNNN-DD.AAAA.J.TT.OOOO (20 dígitos)
                </p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                    Tribunal *
                  </label>
                  {tribunalDetectado && (
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full animate-fadeIn"
                      style={{ background: 'rgba(201,168,76,.12)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}
                    >
                      <i className="fas fa-wand-magic-sparkles mr-1" />
                      Detectado automaticamente
                    </span>
                  )}
                </div>
                <select className="input-base" value={form.tribunal} onChange={e => setForm(f => ({ ...f, tribunal: e.target.value }))}>
                  {!form.tribunal && <option value="">Selecione o tribunal...</option>}
                  {TRIBUNAIS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="rounded-xl p-4" style={{ background: 'rgba(201,168,76,.06)', border: '1px solid rgba(201,168,76,.2)' }}>
                <div className="flex items-start gap-3">
                  <i className="fas fa-circle-info text-sm mt-0.5" style={{ color: '#C9A84C' }} />
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    O sistema consultará o <strong style={{ color: '#C9A84C' }}>DataJud (CNJ)</strong> em tempo real e importará automaticamente as partes, movimentações, advogados e dados do processo. O monitoramento automático será ativado após a importação.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button onClick={onClose} className="btn btn-ghost">Cancelar</button>
                <button
                  onClick={() => buscarMutation.mutate({ numeroCnj: form.numeroCnj, tribunal: form.tribunal })}
                  disabled={form.numeroCnj.replace(/\D/g, '').length < 20 || !form.tribunal || buscarMutation.isPending}
                  className="btn btn-gold"
                >
                  {buscarMutation.isPending
                    ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Consultando DataJud...</>
                    : <><i className="fas fa-magnifying-glass" /> Consultar CNJ</>
                  }
                </button>
              </div>
            </div>
          )}

          {/* ─── STEP 2: Preview ──────────────────── */}
          {step === 2 && preview && (
            <div className="space-y-4">
              <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)' }}>
                <h4 className="font-bold text-sm" style={{ color: 'var(--accent)' }}>Dados encontrados no DataJud:</h4>
                {[
                  { label: 'Número CNJ', valor: formatarNumeroCNJ(form.numeroCnj) },
                  { label: 'Tribunal', valor: preview.tribunal || form.tribunal },
                  { label: 'Vara', valor: preview.vara || '—' },
                  { label: 'Classe', valor: preview.classe || '—' },
                  { label: 'Assunto', valor: preview.assunto || '—' },
                  { label: 'Partes', valor: preview.partes?.map(p => p.nome).join(', ') || '—' },
                  { label: 'Movimentações', valor: `${preview.movimentacoes?.length || 0} encontradas` },
                ].map(item => (
                  <div key={item.label} className="flex gap-3 text-sm">
                    <span className="flex-shrink-0 font-medium w-28" style={{ color: 'var(--text-secondary)' }}>{item.label}:</span>
                    <span className="font-medium truncate">{item.valor}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 justify-end">
                <button onClick={() => setStep(1)} className="btn btn-ghost"><i className="fas fa-arrow-left" /> Voltar</button>
                <button
                  onClick={() => processoId ? confirmarMutation.mutate() : onSuccess?.(preview)}
                  disabled={confirmarMutation.isPending}
                  className="btn btn-gold"
                >
                  {confirmarMutation.isPending ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <i className="fas fa-check" />}
                  Confirmar importação
                </button>
              </div>
            </div>
          )}

          {/* ─── STEP 3: Sucesso ──────────────────── */}
          {step === 3 && (
            <div className="text-center py-6 space-y-4">
              <div className="flex items-center justify-center rounded-full mx-auto" style={{ width: 64, height: 64, background: 'rgba(16,185,129,.12)' }}>
                <i className="fas fa-check text-2xl" style={{ color: '#10b981' }} />
              </div>
              <h4 className="text-lg font-bold">Processo importado!</h4>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                O processo foi importado do DataJud e o monitoramento automático foi ativado.
              </p>
              <button onClick={() => { onSuccess?.(preview); }} className="btn btn-gold mx-auto">
                <i className="fas fa-eye" /> Ver processo
              </button>
            </div>
          )}

          {/* ─── STEP 4: Conflito (409) ──────────────── */}
          {step === 4 && processoExistente && (
            <div className="space-y-4">
              <div className="text-center py-2">
                <div className="flex items-center justify-center rounded-full mx-auto mb-4" style={{ width: 64, height: 64, background: 'rgba(245,158,11,.12)' }}>
                  <i className="fas fa-exclamation-triangle text-2xl" style={{ color: '#f59e0b' }} />
                </div>
                <h4 className="text-lg font-bold">Processo ja cadastrado</h4>
                <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                  Este numero CNJ ja esta vinculado a um processo no seu sistema.
                </p>
              </div>

              <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(245,158,11,.2)' }}>
                <div className="flex gap-3 text-sm">
                  <span className="flex-shrink-0 font-medium w-28" style={{ color: 'var(--text-secondary)' }}>Numero:</span>
                  <span className="font-bold">{processoExistente.numero || processoExistente.numeroCnj}</span>
                </div>
                <div className="flex gap-3 text-sm">
                  <span className="flex-shrink-0 font-medium w-28" style={{ color: 'var(--text-secondary)' }}>Status:</span>
                  <span className="font-medium">{processoExistente.status}</span>
                </div>
                {processoExistente.criadoEm && (
                  <div className="flex gap-3 text-sm">
                    <span className="flex-shrink-0 font-medium w-28" style={{ color: 'var(--text-secondary)' }}>Cadastrado em:</span>
                    <span className="font-medium">{formatarData(processoExistente.criadoEm)}</span>
                  </div>
                )}
              </div>

              <div className="rounded-xl p-3" style={{ background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.15)' }}>
                <div className="flex items-start gap-2">
                  <i className="fas fa-rotate text-xs mt-0.5" style={{ color: '#ef4444' }} />
                  <div>
                    <p className="text-xs font-medium" style={{ color: '#fca5a5' }}>
                      Se o processo nao aparece na sua lista, ele pode ter sido apagado incorretamente.
                      Clique em "Reimportar" para substituir o registro antigo.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2 flex-wrap">
                <button onClick={() => { setStep(1); setProcessoExistente(null); }} className="btn btn-ghost">
                  <i className="fas fa-arrow-left" /> Tentar outro
                </button>
                <button
                  onClick={() => { onClose(); navigate(`/processos/${processoExistente.id}`); }}
                  className="btn btn-gold"
                >
                  <i className="fas fa-eye" /> Ver processo existente
                </button>
                <button
                  onClick={() => reimportarMutation.mutate()}
                  disabled={reimportarMutation.isPending}
                  className="btn"
                  style={{
                    background: 'rgba(239,68,68,.12)', color: '#fca5a5',
                    border: '1px solid rgba(239,68,68,.25)', borderRadius: 12,
                    padding: '8px 16px', fontSize: 13, fontWeight: 600,
                  }}
                >
                  {reimportarMutation.isPending
                    ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Reimportando...</>
                    : <><i className="fas fa-rotate" /> Reimportar</>
                  }
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
