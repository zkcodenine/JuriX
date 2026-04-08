import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { formatarData, formatarNumeroCNJ, getIniciais, statusLabel } from '../../utils/formatters';
import VincularCNJModal from '../../components/processos/VincularCNJModal';

const badgeClass = {
  ATIVO:      'badge-ativo',
  SUSPENSO:   'badge-suspenso',
  ENCERRADO:  'badge-encerrado',
  ARQUIVADO:  'badge-arquivado',
  AGUARDANDO: 'badge-aguardando',
};

const formVazio = { clienteNome: '', numero: '', vara: '', classe: '' };

/* ─── Modal Novo Processo ────────────────────────────────── */
function ProcessoModal({ form, onChange, onSave, onClose, saving }) {
  const set = (f) => (e) => onChange(prev => ({ ...prev, [f]: e.target.value }));
  const campos = [
    { key: 'clienteNome', label: 'Cliente',            required: true,  placeholder: 'Nome completo do cliente',        mono: false },
    { key: 'numero',      label: 'Número do processo', required: false, placeholder: '0000000-00.0000.0.00.0000',       mono: true  },
    { key: 'vara',        label: 'Vara / Tribunal',    required: false, placeholder: 'Ex: 1ª Vara Cível — TJSP',       mono: false },
    { key: 'classe',      label: 'Tipo de ação',       required: false, placeholder: 'Ex: Ação de Cobrança, Divórcio', mono: false },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden animate-scaleIn my-auto"
        style={{ background: 'rgba(10,10,10,.9)', backdropFilter: 'blur(20px) saturate(1.3)', WebkitBackdropFilter: 'blur(20px) saturate(1.3)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}
      >
        <div className="flex justify-between items-center px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h3 className="text-base font-bold">Novo Processo</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Preencha os dados do processo</p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-xl transition-all hover:opacity-70"
            style={{ width: 34, height: 34, background: 'var(--bg-tertiary)' }}
          >
            <i className="fas fa-xmark" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {campos.map(({ key, label, required, placeholder, mono }) => (
            <div key={key}>
              <label
                className="flex items-center gap-1 text-xs font-semibold mb-2 uppercase tracking-wider"
                style={{ color: 'var(--text-secondary)' }}
              >
                {label}
                {required && <span style={{ color: 'var(--accent)' }}>*</span>}
              </label>
              <input
                className="input-base"
                placeholder={placeholder}
                value={form[key]}
                onChange={set(key)}
                style={mono ? { fontFamily: 'monospace' } : {}}
                autoFocus={key === 'clienteNome'}
              />
            </div>
          ))}
        </div>

        <div className="px-6 pb-6 flex gap-3 justify-end" style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <button onClick={onClose} className="btn btn-ghost">Cancelar</button>
          <button
            onClick={onSave}
            disabled={!form.clienteNome?.trim() || saving}
            className="btn btn-gold"
          >
            {saving ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <i className="fas fa-floppy-disk" />}
            Criar Processo
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─── Modal de confirmação de exclusão ───────────────────── */
function ConfirmDelete({ processo, onConfirm, onClose, loading }) {
  const cliente = processo?.partes?.find(p => p.tipo === 'AUTOR') || processo?.partes?.[0];
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden animate-scaleIn"
        style={{ background: 'rgba(10,10,10,.9)', backdropFilter: 'blur(20px) saturate(1.3)', WebkitBackdropFilter: 'blur(20px) saturate(1.3)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}
      >
        <div className="p-6 text-center">
          <div
            className="flex items-center justify-center rounded-2xl mx-auto mb-4"
            style={{ width: 56, height: 56, background: 'rgba(239,68,68,.1)' }}
          >
            <i className="fas fa-trash text-xl" style={{ color: 'var(--danger)' }} />
          </div>
          <h3 className="text-base font-bold mb-2">Excluir processo?</h3>
          <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
            <strong>{cliente?.nome || 'Processo'}</strong>
          </p>
          <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
            Todos os dados, tarefas, documentos e honorários vinculados serão removidos permanentemente. Esta ação não pode ser desfeita.
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn btn-ghost flex-1">Cancelar</button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="btn flex-1 font-semibold"
              style={{ background: 'var(--danger)', color: '#fff' }}
            >
              {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <i className="fas fa-trash" />}
              Excluir
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─── Card de processo ───────────────────────────────────── */
function ProcessCard({ proc, index, onDelete }) {
  const navigate = useNavigate();
  const cliente = proc.partes?.find(p => p.tipo === 'AUTOR') || proc.partes?.[0];

  // Nome completo: Autor(es) x Réu(s)
  const autores = (proc.partes || []).filter(p => p.tipo === 'AUTOR').map(p => p.nome);
  const reus = (proc.partes || []).filter(p => p.tipo === 'REU').map(p => p.nome);
  const nomeExibicao = autores.length > 0 && reus.length > 0
    ? `${autores.join(', ')} x ${reus.join(', ')}`
    : autores.length > 0
      ? autores.join(', ')
      : cliente?.nome || proc.classe || 'Processo';

  // Detecta atualização recente (< 48h) — only show if user hasn't viewed the movimentações tab since
  const lastViewed = parseInt(localStorage.getItem(`mov_viewed_${proc.id}`) || '0', 10);
  const temAtualizacao = proc.dataUltimaAtualizacao &&
    (Date.now() - new Date(proc.dataUltimaAtualizacao).getTime()) < 48 * 3600 * 1000 &&
    new Date(proc.dataUltimaAtualizacao).getTime() > lastViewed;
  const novasMovimentacoes = temAtualizacao ? (proc.novasMovimentacoes || 0) : 0;

  return (
    <div
      className={`card card-hover card-glow group animate-fadeIn relative overflow-hidden cursor-pointer ${temAtualizacao ? 'card-nova-atualizacao' : ''}`}
      style={{
        animationDelay: `${index * 45}ms`,
        ...(temAtualizacao ? {
          boxShadow: '0 0 0 1.5px rgba(201,168,76,.5), 0 4px 24px rgba(201,168,76,.15)',
        } : {}),
      }}
      onClick={() => navigate(`/processos/${proc.id}`)}
    >
      {/* Barra dourada no topo — sempre visível se tem atualização, hover nos demais */}
      <div
        className={`absolute top-0 left-0 right-0 h-0.5 origin-left transition-transform duration-300 ${temAtualizacao ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`}
        style={{ background: 'linear-gradient(90deg, #C9A84C, #A8873A)' }}
      />

      {/* Glow de fundo — sempre visível se tem atualização */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${temAtualizacao ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        style={{ background: temAtualizacao
          ? 'radial-gradient(ellipse at 50% 0%, rgba(201,168,76,.08) 0%, transparent 70%)'
          : 'radial-gradient(ellipse at 50% 0%, rgba(201,168,76,.05) 0%, transparent 70%)'
        }}
      />

      {/* Badge de novas movimentações no canto superior direito */}
      {temAtualizacao && novasMovimentacoes > 0 && (
        <div
          className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full animate-bounceIn z-10"
          style={{
            background: 'linear-gradient(135deg, #C9A84C, #A8873A)',
            color: '#0a0a0a',
            fontSize: 10,
            fontWeight: 800,
            boxShadow: '0 2px 8px rgba(201,168,76,.4)',
          }}
        >
          <i className="fas fa-bell text-[8px]" />
          {novasMovimentacoes} nova{novasMovimentacoes > 1 ? 's' : ''}
        </div>
      )}

      {/* ── Cabeçalho: avatar + info ── */}
      <div className="flex items-start gap-3 mb-4 relative">
        {/* Avatar com inicial */}
        <div
          className="rounded-2xl flex items-center justify-center font-bold text-lg flex-shrink-0 transition-transform duration-300 group-hover:scale-105"
          style={{
            width: 52, height: 52,
            background: 'linear-gradient(135deg, #C9A84C, #A8873A)',
            color: '#0c0c0e',
            boxShadow: '0 4px 14px rgba(201,168,76,.22)',
          }}
        >
          {getIniciais(cliente?.nome || 'P')}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold text-sm leading-tight truncate flex-1 group-hover:text-white transition-colors" style={{ maxWidth: temAtualizacao && novasMovimentacoes > 0 ? 'calc(100% - 70px)' : undefined }}>
              {nomeExibicao}
            </p>
            {/* Seta indicando que é clicável */}
            <i
              className="fas fa-arrow-right text-[10px] flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0.5"
              style={{ color: 'var(--accent)' }}
            />
          </div>
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {formatarNumeroCNJ(proc.numeroCnj || proc.numero) || '—'}
          </p>
          {(proc.classe || proc.vara) && (
            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {proc.classe || proc.vara}
            </p>
          )}
        </div>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badgeClass[proc.status] || 'badge-aguardando'}`}>
          {statusLabel[proc.status] || proc.status}
        </span>
        {proc.monitoramentoAtivo && (
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(201,168,76,.1)', color: '#C9A84C', border: '1px solid rgba(201,168,76,.25)' }}
          >
            <i className="fas fa-satellite-dish text-[9px] mr-1" />CNJ
          </span>
        )}
        {proc.tribunal && (
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full truncate max-w-[100px]"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            {proc.tribunal}
          </span>
        )}
      </div>

      {/* Rodapé */}
      <div className="flex items-center gap-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3 text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>
          <span className="flex items-center gap-1.5" title="Tarefas">
            <i className="fas fa-list-check text-[10px]" style={{ color: 'var(--accent)' }} />
            <span className="font-semibold">{proc._count?.tarefas || 0}</span>
          </span>
          <span className="flex items-center gap-1.5" title="Documentos">
            <i className="fas fa-file text-[10px]" style={{ color: 'var(--accent)' }} />
            <span className="font-semibold">{proc._count?.documentos || 0}</span>
          </span>
          <span className="flex items-center gap-1 ml-auto" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
            <i className="fas fa-calendar text-[9px]" />
            {formatarData(proc.criadoEm)}
          </span>
        </div>
        <span className="flex items-center gap-1.5" title="Movimentações">
          <i className="fas fa-bolt text-[10px]" style={{ color: 'var(--accent)' }} />
          <span className="font-semibold">{proc._count?.movimentacoes || 0}</span>
        </span>
        {temAtualizacao && (
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse-gold flex-shrink-0"
            style={{ background: 'rgba(201,168,76,.15)', color: '#C9A84C', border: '1px solid rgba(201,168,76,.35)' }}
          >
            <i className="fas fa-satellite-dish text-[8px] mr-1" />atualizado
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Componente principal ───────────────────────────────── */
function UpgradeModal({ onClose }) {
  const navigate = useNavigate();
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden animate-scaleIn text-center"
        style={{ background: 'var(--glass-bg, rgba(10,17,40,.92))', backdropFilter: 'blur(20px) saturate(1.3)', WebkitBackdropFilter: 'blur(20px) saturate(1.3)', border: '1px solid rgba(201,168,76,.3)', boxShadow: '0 20px 60px rgba(201,168,76,.15)' }}
      >
        <div className="p-8">
          <div
            className="flex items-center justify-center rounded-3xl mx-auto mb-5"
            style={{ width: 70, height: 70, background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.25)' }}
          >
            <i className="fas fa-crown text-3xl" style={{ color: '#C9A84C' }} />
          </div>
          <h3 className="text-xl font-bold mb-2">Limite atingido</h3>
          <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
            O plano <strong style={{ color: '#818cf8' }}>Gratuito</strong> permite até <strong>5 processos</strong>.
          </p>
          <p className="text-sm mb-7" style={{ color: 'var(--text-muted)' }}>
            Faça upgrade para adicionar processos ilimitados e ter acesso a todos os recursos premium.
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn btn-ghost flex-1">Cancelar</button>
            <button
              onClick={() => { onClose(); navigate('/planos'); }}
              className="btn btn-gold flex-1"
            >
              <i className="fas fa-crown" /> Ver Planos
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function ProcessosList() {
  const navigate = useNavigate();
  const qc       = useQueryClient();

  const [busca,        setBusca]        = useState('');
  const [pagina,       setPagina]       = useState(1);
  const [showNovo,     setShowNovo]     = useState(false);
  const [showVincular, setShowVincular] = useState(false);
  const [novoForm,     setNovoForm]     = useState(formVazio);
  const [deletando,    setDeletando]    = useState(null);
  const [showUpgrade,  setShowUpgrade]  = useState(false);

  /* ─── Queries / Mutations ─────────────────────── */
  const { data, isLoading } = useQuery({
    queryKey: ['processos', busca, pagina],
    queryFn: () => api.get('/processos', { params: { busca: busca || undefined, pagina, limite: 12 } }).then(r => r.data),
    keepPreviousData: true,
  });

  const processos    = data?.processos    || [];
  const total        = data?.total        || 0;
  const totalPaginas = data?.totalPaginas || 1;

  const criarMutation = useMutation({
    mutationFn: (form) => {
      const cnjDigits = (form.numero || '').replace(/\D/g, '');
      if (cnjDigits.length >= 16) {
         return api.post('/processos/importar-cnj', { numeroCnj: form.numero, tribunal: form.vara || 'TJSP' });
      }
      return api.post('/processos', {
        numero: form.numero || '—', vara: form.vara, classe: form.classe, status: 'ATIVO',
        partes: form.clienteNome ? [{ nome: form.clienteNome, tipo: 'AUTOR' }] : [],
      });
    },
    onSuccess: (res) => {
      qc.invalidateQueries(['processos']);
      toast.success('Processo criado!');
      setShowNovo(false);
      setNovoForm(formVazio);
      navigate(`/processos/${res.data.id}`);
    },
    onError: (e) => {
      if (e.response?.status === 403 && e.response?.data?.upgrade) {
        setShowNovo(false);
        setShowUpgrade(true);
      } else {
        toast.error(e.response?.data?.error || 'Erro ao criar processo');
      }
    },
  });

  const excluirMutation = useMutation({
    mutationFn: (id) => api.delete(`/processos/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(['processos']);
      toast.success('Processo excluído.');
      setDeletando(null);
    },
    onError: () => toast.error('Erro ao excluir processo'),
  });

  return (
    <div className="space-y-6 animate-fadeIn">

      {/* ─── Toolbar ─────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-center" style={{ position: 'relative', zIndex: 10 }}>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--text-muted)' }} />
          <input
            className="input-base pl-10"
            placeholder="Buscar processos ou partes..."
            value={busca}
            onChange={e => { setBusca(e.target.value); setPagina(1); }}
          />
        </div>
        <div className="flex gap-2 ml-auto flex-shrink-0">
          <button onClick={() => setShowVincular(true)} className="btn btn-ghost">
            <i className="fas fa-link" /> Importar CNJ
          </button>
          <button onClick={() => setShowNovo(true)} className="btn btn-gold">
            <i className="fas fa-plus" /> Novo Processo
          </button>
        </div>
      </div>

      {/* Contagem e Sincronização */}
      <div className="flex justify-between items-center" style={{ position: 'relative', zIndex: 1 }}>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {isLoading ? 'Carregando...' : `${total} processo${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`}
        </p>
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          <i className="fas fa-rotate animate-spin-slow" />
          <span>Próxima atualização automática em ~30 min</span>
        </div>
      </div>

      {/* ─── Grid ───────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton rounded-2xl" style={{ height: 180, animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      ) : processos.length === 0 ? (
        <div className="flex flex-col items-center py-24 gap-4 animate-fadeIn" style={{ color: 'var(--text-muted)' }}>
          <div
            className="flex items-center justify-center rounded-3xl"
            style={{ width: 80, height: 80, background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <i className="fas fa-scale-balanced text-4xl" style={{ opacity: .3 }} />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              Nenhum processo encontrado
            </h3>
            <p className="text-sm">Crie seu primeiro processo ou importe via CNJ.</p>
          </div>
          <div className="flex gap-3 mt-2">
            <button onClick={() => setShowVincular(true)} className="btn btn-ghost">
              <i className="fas fa-link" /> Importar CNJ
            </button>
            <button onClick={() => setShowNovo(true)} className="btn btn-gold">
              <i className="fas fa-plus" /> Criar processo
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {processos.map((proc, i) => (
            <ProcessCard
              key={proc.id}
              proc={proc}
              index={i}
              onDelete={(p) => setDeletando(p)}
            />
          ))}
        </div>
      )}

      {/* ─── Paginação ───────────────────────────── */}
      {totalPaginas > 1 && (
        <div className="flex justify-center gap-2">
          <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1} className="btn btn-ghost px-4">
            <i className="fas fa-chevron-left" />
          </button>
          <span className="flex items-center text-sm px-4" style={{ color: 'var(--text-secondary)' }}>
            {pagina} / {totalPaginas}
          </span>
          <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas} className="btn btn-ghost px-4">
            <i className="fas fa-chevron-right" />
          </button>
        </div>
      )}

      {/* ─── Modal Novo Processo ─────────────────── */}
      {showNovo && (
        <ProcessoModal
          form={novoForm}
          onChange={setNovoForm}
          onSave={() => criarMutation.mutate(novoForm)}
          onClose={() => { setShowNovo(false); setNovoForm(formVazio); }}
          saving={criarMutation.isPending}
        />
      )}

      {/* ─── Confirmar Exclusão ──────────────────── */}
      {deletando && (
        <ConfirmDelete
          processo={deletando}
          onConfirm={() => excluirMutation.mutate(deletando.id)}
          onClose={() => setDeletando(null)}
          loading={excluirMutation.isPending}
        />
      )}

      {/* ─── Modal Vincular CNJ ──────────────────── */}
      {showVincular && (
        <VincularCNJModal
          onClose={() => setShowVincular(false)}
          onSuccess={(proc) => {
            if (proc?.upgrade) { setShowVincular(false); setShowUpgrade(true); return; }
            qc.invalidateQueries(['processos']);
            setShowVincular(false);
            navigate(`/processos/${proc.id}`);
          }}
        />
      )}

      {/* ─── Modal Upgrade ───────────────────────── */}
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </div>
  );
}
