import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { formatarData, formatarNumeroCNJ, formatarTempoRelativo, formatarMoeda, statusLabel, getIniciais } from '../../utils/formatters';
import VincularCNJModal from '../../components/processos/VincularCNJModal';

import TabPrazos        from '../../components/processos/tabs/Prazos';
import TabDocumentos    from '../../components/processos/tabs/Documentos';
import TabHonorarios    from '../../components/processos/tabs/TabHonorarios';
import TabMovimentacoes from '../../components/processos/tabs/Movimentacoes';

const STATUS_CORES = {
  ATIVO:      { bg: 'rgba(16,185,129,.12)',  color: '#10b981', border: 'rgba(16,185,129,.3)'  },
  SUSPENSO:   { bg: 'rgba(245,158,11,.12)',  color: '#f59e0b', border: 'rgba(245,158,11,.3)'  },
  ARQUIVADO:  { bg: 'rgba(156,163,175,.12)', color: '#9ca3af', border: 'rgba(156,163,175,.3)' },
  ENCERRADO:  { bg: 'rgba(239,68,68,.12)',   color: '#ef4444', border: 'rgba(239,68,68,.3)'   },
  AGUARDANDO: { bg: 'rgba(96,165,250,.12)',  color: '#60a5fa', border: 'rgba(96,165,250,.3)'  },
  CONCLUIDO:  { bg: 'rgba(167,139,250,.12)', color: '#a78bfa', border: 'rgba(167,139,250,.3)' },
};

function StatusBadge({ status }) {
  if (!status) return null;
  const c = STATUS_CORES[status] || { bg: 'rgba(255,255,255,.06)', color: '#9ca3af', border: 'rgba(255,255,255,.15)' };
  return (
    <span
      className="text-xs font-bold px-3 py-1 rounded-full"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}
    >
      <i className="fas fa-circle text-[7px] mr-1.5" />
      {statusLabel[status] || status}
    </span>
  );
}

const TABS = [
  { id: 'movimentacoes', label: 'Movimentações',          icon: 'fa-bolt'        },
  { id: 'documentos',   label: 'Documentos & Notas',     icon: 'fa-folder-open' },
  { id: 'prazos',       label: 'Prazos',                  icon: 'fa-clock'       },
  { id: 'honorarios',   label: 'Honorários',              icon: 'fa-sack-dollar' },
];

export default function ProcessoDetail() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const qc        = useQueryClient();
  const [abaAtiva,     setAbaAtiva]    = useState('movimentacoes');
  const [showVincular,  setShowVincular]  = useState(false);
  const [showEdit,      setShowEdit]      = useState(false);
  const [editForm,      setEditForm]      = useState(null);
  const [showDelete,    setShowDelete]    = useState(false);
  const [showInfoExtra, setShowInfoExtra] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showConfirmArquivar, setShowConfirmArquivar] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const actionsBtnRef = useRef(null);

  // Fecha o menu de ações ao clicar fora ou rolar a página
  useEffect(() => {
    if (!showActionsMenu) return;
    const close = () => setShowActionsMenu(false);
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [showActionsMenu]);

  const openActionsMenu = () => {
    if (!actionsBtnRef.current) return;
    const rect = actionsBtnRef.current.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right,
    });
    setShowActionsMenu(v => !v);
  };

  const { data: processo, isLoading } = useQuery({
    queryKey: ['processo', id],
    queryFn: () => api.get(`/processos/${id}`).then(r => r.data),
  });

  const excluirMutation = useMutation({
    mutationFn: () => api.delete(`/processos/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(['processos']);
      toast.success('Processo excluído.');
      navigate('/processos');
    },
    onError: () => toast.error('Erro ao excluir processo.'),
  });

  const arquivarMutation = useMutation({
    mutationFn: () => api.put(`/processos/${id}`, { status: 'ARQUIVADO' }),
    onSuccess: () => {
      qc.invalidateQueries(['processo', id]);
      qc.invalidateQueries(['processos']);
      toast.success('Processo arquivado.');
    },
    onError: () => toast.error('Erro ao arquivar processo.'),
  });

  const restaurarMutation = useMutation({
    mutationFn: () => api.put(`/processos/${id}`, { status: 'ATIVO' }),
    onSuccess: () => {
      qc.invalidateQueries(['processo', id]);
      qc.invalidateQueries(['processos']);
      toast.success('Processo reativado.');
    },
    onError: () => toast.error('Erro ao reativar processo.'),
  });

  const monitorarMutation = useMutation({
    mutationFn: (ativo) => api.post(`/processos/${id}/monitoramento/${ativo ? 'ativar' : 'desativar'}`),
    onSuccess: (_, ativo) => {
      qc.invalidateQueries(['processo', id]);
      toast.success(ativo ? 'Monitoramento ativado!' : 'Monitoramento desativado.');
    },
  });

  const editarMutation = useMutation({
    mutationFn: async (dados) => {
      const { clienteNome, ...campos } = dados;
      // Atualiza dados escalares do processo
      await api.put(`/processos/${id}`, campos);
      // Só atualiza parte se o nome realmente mudou
      const parteAutor = processo.partes?.find(p => p.tipo === 'AUTOR') || processo.partes?.[0];
      const nomeOriginal = parteAutor?.nome || '';
      if (clienteNome && clienteNome.trim() !== nomeOriginal.trim()) {
        if (parteAutor) {
          await api.delete(`/processos/${id}/partes/${parteAutor.id}`);
        }
        await api.post(`/processos/${id}/partes`, { nome: clienteNome.trim(), tipo: 'AUTOR' });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries(['processo', id]);
      qc.invalidateQueries(['processos']);
      toast.success('Processo atualizado!');
      setShowEdit(false);
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Erro ao salvar alterações'),
  });

  const abrirEdit = () => {
    const cliente = processo.partes?.find(p => p.tipo === 'AUTOR') || processo.partes?.[0];
    setEditForm({
      clienteNome: cliente?.nome || '',
      numero:   processo.numero  || '',
      vara:     processo.vara    || '',
      classe:   processo.classe  || '',
      tribunal: processo.tribunal || '',
      status:   processo.status   || 'ATIVO',
    });
    setShowEdit(true);
  };

  const setEF = (f) => (e) => setEditForm(prev => ({ ...prev, [f]: e.target.value }));

  if (isLoading) return (
    <div className="space-y-4">
      <div className="skeleton h-8 w-32 rounded-lg" />
      <div className="skeleton h-28 rounded-2xl" />
      <div className="skeleton h-96 rounded-2xl" />
    </div>
  );

  if (!processo) return (
    <div className="text-center py-24" style={{ color: 'var(--text-muted)' }}>
      <i className="fas fa-scale-balanced text-5xl mb-4 block" style={{ opacity: .2 }} />
      <p>Processo não encontrado.</p>
      <button onClick={() => navigate('/processos')} className="btn btn-ghost mt-4">
        <i className="fas fa-arrow-left" /> Voltar
      </button>
    </div>
  );

  const cliente = processo.partes?.find(p => p.tipo === 'AUTOR') || processo.partes?.[0];

  // Nome completo do processo: Autor(es) x Réu(s)
  const autores = (processo.partes || []).filter(p => p.tipo === 'AUTOR').map(p => p.nome);
  const reus    = (processo.partes || []).filter(p => p.tipo === 'REU').map(p => p.nome);
  const nomeProcesso = autores.length > 0 && reus.length > 0
    ? `${autores.join(', ')} x ${reus.join(', ')}`
    : autores.length > 0
      ? autores.join(', ')
      : cliente?.nome || 'Processo';

  const refresh = () => qc.invalidateQueries(['processo', id]);
  const tabContent = {
    movimentacoes: <TabMovimentacoes processo={processo} />,
    documentos: <TabDocumentos processo={processo} onRefresh={refresh} />,
    prazos:        <TabPrazos        processo={processo} onRefresh={refresh} />,
    honorarios:    <TabHonorarios    processo={processo} onRefresh={refresh} />,
  };

  return (
    <>
    <div className="space-y-6 animate-fadeIn">
      {/* ─── Voltar ─────────────────────────────── */}
      <button
        onClick={() => navigate('/processos')}
        className="flex items-center gap-2 text-sm transition-all hover:-translate-x-1"
        style={{ color: 'var(--text-secondary)' }}
      >
        <i className="fas fa-arrow-left" /> Voltar para Processos
      </button>

      {/* ─── Header do processo ──────────────────── */}
      <div className="card" style={{ position: 'relative', zIndex: 30 }}>
        <div className="flex items-start gap-4 flex-wrap">
          <div
            className="rounded-2xl flex items-center justify-center font-bold text-2xl flex-shrink-0"
            style={{ width: 72, height: 72, background: 'linear-gradient(135deg, #C9A84C, #A8873A)', color: '#0a0a0a' }}
          >
            {getIniciais(cliente?.nome || 'P')}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h2 className="text-xl font-bold">{nomeProcesso}</h2>
              {processo.monitoramentoAtivo && (
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full animate-pulse-gold"
                  style={{ background: 'rgba(201,168,76,.12)', color: '#C9A84C', border: '1px solid rgba(201,168,76,.25)' }}
                >
                  <i className="fas fa-satellite-dish text-[10px] mr-1" />Monitoramento ativo
                </span>
              )}
              {/* Editar inline */}
              {processo.status !== 'CONCLUIDO' && (
              <button
                onClick={abrirEdit}
                className="flex items-center justify-center rounded-xl hover:opacity-70 transition-opacity"
                style={{ width: 28, height: 28, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)' }}
                title="Editar processo"
              >
                <i className="fas fa-pen text-[11px]" style={{ color: 'var(--text-secondary)' }} />
              </button>
              )}
            </div>
            <p className="text-sm font-mono mb-1" style={{ color: 'var(--text-muted)' }}>
              {formatarNumeroCNJ(processo.numeroCnj || processo.numero)}
            </p>
            <div className="flex flex-wrap gap-4 text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
              {processo.tribunal && (
                <span><i className="fas fa-building-columns mr-1" style={{ color: 'var(--accent)' }} />{processo.tribunal}</span>
              )}
              {processo.vara && (
                <span><i className="fas fa-gavel mr-1" style={{ color: 'var(--accent)' }} />{processo.vara}</span>
              )}
              {processo.classe && (
                <span><i className="fas fa-tag mr-1" style={{ color: 'var(--accent)' }} />{processo.classe}</span>
              )}
              {processo.dataDistribuicao && (
                <span><i className="fas fa-calendar mr-1" style={{ color: 'var(--accent)' }} />Distribuído em {formatarData(processo.dataDistribuicao)}</span>
              )}
              {processo.dataUltimaAtualizacao && (
                <span><i className="fas fa-clock-rotate-left mr-1" style={{ color: 'var(--accent)' }} />Atualizado {formatarTempoRelativo(processo.dataUltimaAtualizacao)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Stats + ações secundárias */}
        <div className="flex gap-6 mt-5 pt-5 border-t flex-wrap items-center" style={{ borderColor: 'var(--border)' }}>
          {[
            { icon: 'fa-file',  val: processo._count?.documentos, label: 'Documentos' },
            { icon: 'fa-clock', val: processo.prazos?.filter(p => p.status === 'PENDENTE').length, label: 'Prazos pendentes' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2 text-sm">
              <i className={`fas ${s.icon} text-xs`} style={{ color: 'var(--accent)' }} />
              <span className="font-bold">{s.val || 0}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
            </div>
          ))}
          <div className="ml-auto flex gap-2">
            {/* Vincular CNJ: só para processos manuais que ainda não foram vinculados */}
            {!processo.numeroCnj && processo.origemDados !== 'datajud' && (
              <button onClick={() => setShowVincular(true)} className="btn btn-ghost text-xs py-1.5 px-3">
                <i className="fas fa-link text-[11px]" /> Vincular CNJ
              </button>
            )}
            {/* Processos importados via CNJ: monitoramento é sempre ativo — mostra indicador fixo */}
            {processo.numeroCnj && processo.origemDados === 'datajud' && (
              <div
                className="flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-xl"
                style={{
                  background: 'rgba(201,168,76,.1)',
                  border: '1px solid rgba(201,168,76,.25)',
                  color: 'var(--accent)',
                }}
                title="Processos importados do CNJ são monitorados automaticamente e não podem ter o monitoramento desativado."
              >
                <i className="fas fa-satellite-dish text-[11px]" />
                <span className="font-medium">Monitorado (CNJ)</span>
                <i className="fas fa-lock text-[9px] ml-0.5" style={{ opacity: .6 }} />
              </div>
            )}
            {/* Processo manual mas com CNJ vinculado: toggle mantido */}
            {processo.numeroCnj && processo.origemDados !== 'datajud' && (
              <button
                onClick={() => monitorarMutation.mutate(!processo.monitoramentoAtivo)}
                disabled={monitorarMutation.isPending}
                className="btn btn-ghost text-xs py-1.5 px-3"
              >
                <i className="fas fa-satellite-dish text-[11px]" style={{ color: processo.monitoramentoAtivo ? 'var(--accent)' : undefined }} />
                {processo.monitoramentoAtivo ? 'Desativar monitor' : 'Monitoramento'}
              </button>
            )}
            {processo.status === 'ARQUIVADO' && (
              <button
                onClick={() => restaurarMutation.mutate()}
                disabled={restaurarMutation.isPending}
                className="btn btn-ghost text-xs py-1.5 px-3"
                title="Reativar processo"
                style={{ color: 'var(--success)' }}
              >
                {restaurarMutation.isPending
                  ? <span className="spinner" style={{ width: 12, height: 12 }} />
                  : <i className="fas fa-rotate-left text-[11px]" />
                }
                <span className="hidden sm:inline ml-1">Reativar</span>
              </button>
            )}
            {/* ─── Menu de Ações (dropdown via portal) ─── */}
            <div>
              <button
                ref={actionsBtnRef}
                onClick={openActionsMenu}
                className="btn btn-ghost text-xs py-1.5 px-3"
                title="Ações"
                style={{ color: 'var(--text-secondary)' }}
              >
                <i className="fas fa-ellipsis-vertical text-[12px]" />
                <span className="hidden sm:inline ml-1">Ações</span>
                <i className={`fas fa-chevron-${showActionsMenu ? 'up' : 'down'} text-[9px] ml-1`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Abas ────────────────────────────────── */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div className="flex gap-1 overflow-x-auto pb-px border-b" style={{ borderColor: 'var(--border)' }}>
          {TABS.map(tab => {
            const count = tab.id === 'movimentacoes' ? (processo._count?.movimentacoes || processo.movimentacoes?.length || null)
                        : tab.id === 'documentos'   ? processo._count?.documentos
                        : tab.id === 'prazos'       ? (processo.prazos?.filter(p => p.status === 'PENDENTE').length || null)
                        : null;
            return (
              <button
                key={tab.id}
                onClick={() => setAbaAtiva(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap rounded-t-xl transition-all border border-b-0
                  ${abaAtiva === tab.id
                    ? 'tab-active bg-[var(--bg-card)]'
                    : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-tertiary)] border-transparent'
                  }`}
                style={{ borderColor: abaAtiva === tab.id ? 'var(--border)' : 'transparent' }}
              >
                <i className={`fas ${tab.icon} text-xs`} />
                {tab.label}
                {count > 0 && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{
                      background: abaAtiva === tab.id ? 'var(--accent)' : 'rgba(255,255,255,.03)',
                      color:      abaAtiva === tab.id ? '#0a0a0a'       : 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="card rounded-t-none" style={{ borderTop: 'none' }}>
          {tabContent[abaAtiva]}
        </div>
      </div>

    </div>
    {/* ─── Dropdown Ações (portal — escapa do overflow:hidden do card) ── */}
    {showActionsMenu && createPortal(
      <div
        className="fixed"
        style={{ top: menuPos.top, right: menuPos.right, zIndex: 9990 }}
        onMouseDown={e => e.stopPropagation()}
      >
        <div
          className="rounded-xl overflow-hidden animate-fadeIn"
          style={{
            minWidth: 230,
            background: 'var(--glass-bg, rgba(10,10,10,.96))',
            backdropFilter: 'blur(20px) saturate(1.3)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 32px rgba(0,0,0,.25)',
          }}
        >
          <button
            onClick={() => { setShowInfoExtra(true); setShowActionsMenu(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors hover:bg-white/5"
            style={{ color: 'var(--text-primary)' }}
          >
            <i className="fas fa-eye text-xs w-4" style={{ color: 'var(--accent)' }} />
            Visualizar dados do processo
          </button>
          {processo.status !== 'CONCLUIDO' && processo.status !== 'ARQUIVADO' && (
            <button
              onClick={() => { setShowConfirmArquivar(true); setShowActionsMenu(false); }}
              disabled={arquivarMutation.isPending}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors hover:bg-white/5"
              style={{ color: 'var(--text-primary)', borderTop: '1px solid var(--border)' }}
            >
              <i className="fas fa-box-archive text-xs w-4" style={{ color: 'var(--text-secondary)' }} />
              Arquivar processo
            </button>
          )}
          {processo.status !== 'CONCLUIDO' && processo.status !== 'ARQUIVADO' && (
            <button
              onClick={() => { setShowDelete(true); setShowActionsMenu(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors hover:bg-red-500/10"
              style={{ color: 'var(--danger)', borderTop: '1px solid var(--border)' }}
            >
              <i className="fas fa-trash text-xs w-4" />
              Excluir processo
            </button>
          )}
        </div>
      </div>,
      document.body
    )}

    {/* ═══ Modais — via portal para não ser afetado por transform do Layout ══ */}

      {/* ─── Modal Dados do Processo ────────────────── */}
      {showInfoExtra && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,.88)', backdropFilter: 'blur(8px)' }}
          onClick={e => e.target === e.currentTarget && setShowInfoExtra(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl overflow-hidden animate-scaleIn my-auto"
            style={{ background: 'var(--glass-bg, rgba(10,17,40,.92))', backdropFilter: 'blur(24px) saturate(1.3)', WebkitBackdropFilter: 'blur(24px) saturate(1.3)', border: '1px solid rgba(255,255,255,.1)' }}
          >
            <div className="flex justify-between items-center px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center rounded-xl" style={{ width: 36, height: 36, background: 'rgba(201,168,76,.12)' }}>
                  <i className="fas fa-circle-info" style={{ color: '#C9A84C' }} />
                </div>
                <div>
                  <h3 className="text-base font-bold">Dados do Processo</h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Informações completas do processo</p>
                </div>
              </div>
              <button onClick={() => setShowInfoExtra(false)} className="flex items-center justify-center rounded-xl hover:opacity-70 transition-opacity" style={{ width: 34, height: 34, background: 'rgba(255,255,255,.03)' }}>
                <i className="fas fa-xmark" style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Nome completo */}
              {autores.length > 0 && reus.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Nome do Processo</p>
                  <p className="text-sm font-semibold">{nomeProcesso}</p>
                </div>
              )}

              {/* Badges */}
              <div className="flex flex-wrap gap-3 items-center">
                <StatusBadge status={processo.status} />
                {processo.origemDados && (
                  <span className="text-xs px-3 py-1 rounded-full" style={{ background: 'rgba(255,255,255,.05)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                    <i className="fas fa-database text-[10px] mr-1.5" style={{ color: 'var(--accent)' }} />
                    {processo.origemDados === 'datajud' ? 'DataJud / CNJ' : 'Cadastro manual'}
                  </span>
                )}
                {processo.monitoramentoAtivo && (
                  <span className="text-xs px-3 py-1 rounded-full" style={{ background: 'rgba(201,168,76,.08)', color: '#C9A84C', border: '1px solid rgba(201,168,76,.2)' }}>
                    <i className="fas fa-satellite-dish text-[10px] mr-1.5" />Monitoramento ativo
                  </span>
                )}
                {processo.valor != null && (
                  <span className="text-xs px-3 py-1 rounded-full font-semibold" style={{ background: 'rgba(201,168,76,.08)', color: '#C9A84C', border: '1px solid rgba(201,168,76,.2)' }}>
                    <i className="fas fa-sack-dollar text-[10px] mr-1.5" />{formatarMoeda(processo.valor)}
                  </span>
                )}
              </div>

              {/* Dados gerais em grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: 'Número CNJ', value: formatarNumeroCNJ(processo.numeroCnj), icon: 'fa-hashtag', show: !!processo.numeroCnj },
                  { label: 'Número', value: processo.numero, icon: 'fa-hashtag', show: !processo.numeroCnj && !!processo.numero && processo.numero !== '—' },
                  { label: 'Tribunal', value: processo.tribunal, icon: 'fa-building-columns', show: !!processo.tribunal },
                  { label: 'Vara', value: processo.vara, icon: 'fa-gavel', show: !!processo.vara },
                  { label: 'Classe / Ação', value: processo.classe, icon: 'fa-tag', show: !!processo.classe },
                  { label: 'Assunto', value: processo.assunto, icon: 'fa-book', show: !!processo.assunto },
                ].filter(f => f.show).map(f => (
                  <div key={f.label} className="flex items-start gap-3 rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center justify-center rounded-lg flex-shrink-0" style={{ width: 28, height: 28, background: 'rgba(201,168,76,.1)' }}>
                      <i className={`fas ${f.icon} text-[11px]`} style={{ color: 'var(--accent)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{f.label}</p>
                      <p className="text-sm font-medium mt-0.5" style={{ wordBreak: 'break-word' }}>{f.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Partes */}
              {processo.partes?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Partes ({processo.partes.length})</p>
                  <div className="flex flex-col gap-2">
                    {processo.partes.map(parte => {
                      const tipoConfig = {
                        AUTOR: { label: 'Autor', bg: 'rgba(96,165,250,.12)', color: '#60a5fa' },
                        REU: { label: 'Réu', bg: 'rgba(239,68,68,.1)', color: '#ef4444' },
                        TERCEIRO: { label: 'Terceiro', bg: 'rgba(156,163,175,.1)', color: '#9ca3af' },
                        INTERESSADO: { label: 'Interessado', bg: 'rgba(167,139,250,.1)', color: '#a78bfa' },
                        TESTEMUNHA: { label: 'Testemunha', bg: 'rgba(245,158,11,.1)', color: '#f59e0b' },
                      };
                      const tc = tipoConfig[parte.tipo] || tipoConfig.TERCEIRO;
                      return (
                        <div key={parte.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)' }}>
                          <div className="flex items-center justify-center rounded-lg flex-shrink-0 font-bold text-xs" style={{ width: 32, height: 32, background: tc.bg, color: tc.color }}>
                            {getIniciais(parte.nome)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{parte.nome}</p>
                            {(parte.cpfCnpj || parte.email || parte.telefone) && (
                              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                {[parte.cpfCnpj, parte.email, parte.telefone].filter(Boolean).join(' · ')}
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: tc.bg, color: tc.color }}>{tc.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Advogados */}
              {processo.advogados?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Advogados ({processo.advogados.length})</p>
                  <div className="flex flex-col gap-2">
                    {processo.advogados.map(adv => (
                      <div key={adv.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)' }}>
                        <div className="flex items-center justify-center rounded-lg flex-shrink-0" style={{ width: 32, height: 32, background: 'rgba(201,168,76,.1)' }}>
                          <i className="fas fa-user-tie text-xs" style={{ color: 'var(--accent)' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{adv.nome}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {[adv.oab && `OAB ${adv.oab}`, adv.polo && `Polo: ${adv.polo}`, adv.email].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Observações */}
              {processo.observacoes && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Observações</p>
                  <p className="text-sm leading-relaxed p-3 rounded-xl" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{processo.observacoes}</p>
                </div>
              )}

              {/* Datas */}
              <div className="flex flex-wrap gap-6 text-xs pt-2 border-t" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                {processo.dataDistribuicao && (
                  <span><i className="fas fa-calendar-plus mr-1.5" style={{ color: 'var(--accent)' }} />Distribuído em <strong className="text-white">{formatarData(processo.dataDistribuicao)}</strong></span>
                )}
                <span><i className="fas fa-calendar-check mr-1.5" style={{ color: 'var(--accent)' }} />Cadastrado em <strong className="text-white">{formatarData(processo.criadoEm)}</strong></span>
                {processo.dataUltimaAtualizacao && (
                  <span><i className="fas fa-clock-rotate-left mr-1.5" style={{ color: 'var(--accent)' }} />Última atualização CNJ <strong className="text-white">{formatarTempoRelativo(processo.dataUltimaAtualizacao)}</strong></span>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── Modal confirmar exclusão ─────────────── */}
      {showDelete && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,.88)', backdropFilter: 'blur(8px)' }}
          onClick={e => e.target === e.currentTarget && setShowDelete(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl overflow-hidden animate-scaleIn text-center my-auto"
            style={{ background: 'var(--glass-bg, rgba(10,17,40,.92))', backdropFilter: 'blur(24px) saturate(1.3)', WebkitBackdropFilter: 'blur(24px) saturate(1.3)', border: '1px solid rgba(255,255,255,.1)' }}
          >
            <div className="p-7">
              <div className="flex items-center justify-center rounded-2xl mx-auto mb-4"
                style={{ width: 54, height: 54, background: 'rgba(239,68,68,.1)' }}>
                <i className="fas fa-trash text-xl" style={{ color: 'var(--danger)' }} />
              </div>
              <h3 className="text-base font-bold mb-2">Excluir processo?</h3>
              <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}><strong>{cliente?.nome}</strong></p>
              <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
                Todos os dados vinculados serão removidos permanentemente.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowDelete(false)} className="btn btn-ghost flex-1">Cancelar</button>
                <button
                  onClick={() => excluirMutation.mutate()}
                  disabled={excluirMutation.isPending}
                  className="btn flex-1 font-semibold"
                  style={{ background: 'var(--danger)', color: '#fff' }}
                >
                  {excluirMutation.isPending ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <i className="fas fa-trash" />}
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── Modal confirmar arquivamento ────────── */}
      {showConfirmArquivar && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,.88)', backdropFilter: 'blur(8px)' }}
          onClick={e => e.target === e.currentTarget && setShowConfirmArquivar(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl overflow-hidden animate-scaleIn text-center"
            style={{ background: 'var(--glass-bg, rgba(10,17,40,.92))', backdropFilter: 'blur(24px) saturate(1.3)', WebkitBackdropFilter: 'blur(24px) saturate(1.3)', border: '1px solid rgba(255,255,255,.1)' }}
          >
            <div className="p-7">
              <div className="flex items-center justify-center rounded-2xl mx-auto mb-4"
                style={{ width: 54, height: 54, background: 'rgba(156,163,175,.12)' }}>
                <i className="fas fa-box-archive text-xl" style={{ color: 'var(--text-secondary)' }} />
              </div>
              <h3 className="text-base font-bold mb-2">Arquivar processo?</h3>
              <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}><strong>{cliente?.nome}</strong></p>
              <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
                O processo será movido para a lista de arquivados. Você pode reativá-lo a qualquer momento.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowConfirmArquivar(false)} className="btn btn-ghost flex-1">Cancelar</button>
                <button
                  onClick={() => { arquivarMutation.mutate(); setShowConfirmArquivar(false); }}
                  disabled={arquivarMutation.isPending}
                  className="btn btn-gold flex-1 font-semibold"
                >
                  {arquivarMutation.isPending ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <i className="fas fa-box-archive" />}
                  {' '}Arquivar
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── Modal vincular CNJ ───────────────────── */}
      {showVincular && (
        <VincularCNJModal
          processoId={processo.id}
          numeroPreExistente={processo.numero || processo.numeroCnj}
          onClose={() => setShowVincular(false)}
          onSuccess={() => { setShowVincular(false); qc.invalidateQueries(['processo', id]); }}
        />
      )}

      {/* ─── Modal editar processo ────────────────── */}
      {showEdit && editForm && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,.88)', backdropFilter: 'blur(8px)' }}
          onClick={e => e.target === e.currentTarget && setShowEdit(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl overflow-hidden animate-scaleIn my-auto"
            style={{ background: 'var(--glass-bg, rgba(10,17,40,.92))', backdropFilter: 'blur(24px) saturate(1.3)', WebkitBackdropFilter: 'blur(24px) saturate(1.3)', border: '1px solid rgba(255,255,255,.1)' }}
          >
            <div
              className="flex justify-between items-center px-6 py-4"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div>
                <h3 className="text-lg font-bold">Editar Processo</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Altere os dados do processo
                </p>
              </div>
              <button
                onClick={() => setShowEdit(false)}
                className="flex items-center justify-center rounded-xl hover:opacity-70 transition-opacity"
                style={{ width: 34, height: 34, background: 'rgba(255,255,255,.03)' }}
              >
                <i className="fas fa-xmark" style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Cliente / Nome do Processo */}
              <div>
                <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  Nome do Processo (Cliente/Autor)
                </label>
                <input
                  className="input-base"
                  placeholder="Nome do cliente principal"
                  value={editForm.clienteNome}
                  onChange={setEF('clienteNome')}
                />
              </div>

              {processo.numeroCnj && (
                <div
                  className="flex items-start gap-3 px-3 py-3 rounded-xl text-xs mt-3"
                  style={{ background: 'rgba(201,168,76,.06)', border: '1px solid rgba(201,168,76,.18)', color: 'var(--text-secondary)' }}
                >
                  <i className="fas fa-satellite-dish flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
                  <span>
                    Processo vinculado ao CNJ. <br />
                    <span style={{ color: 'var(--text-muted)' }}>O nome alterado será salvo localmente. Partes oficiais não são alteradas no CNJ.</span>
                  </span>
                </div>
              )}

              {/* Número — read-only se CNJ */}
              {!processo.numeroCnj && (
                <div>
                  <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                    Número do processo
                  </label>
                  <input
                    className="input-base"
                    placeholder="0000000-00.0000.0.00.0000"
                    value={editForm.numero}
                    onChange={setEF('numero')}
                    style={{ fontFamily: 'monospace' }}
                  />
                </div>
              )}

              {/* Vara, Classe */}
              {[
                { f: 'vara',    label: 'Vara / Tribunal', placeholder: '1ª Vara Cível — TJSP'  },
                { f: 'classe',  label: 'Tipo de ação',    placeholder: 'Ex: Ação de Cobrança'  },
                { f: 'tribunal',label: 'Tribunal',        placeholder: 'Ex: TJSP'               },
              ].map(({ f, label, placeholder }) => (
                <div key={f}>
                  <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                    {label}
                  </label>
                  <input
                    className="input-base"
                    placeholder={placeholder}
                    value={editForm[f]}
                    onChange={setEF(f)}
                  />
                </div>
              ))}
              
              <div>
                <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  Status
                </label>
                <select className="input-base" value={editForm.status} onChange={setEF('status')}>
                  <option value="ATIVO">Ativo</option>
                  <option value="AGUARDANDO">Aguardando</option>
                  <option value="SUSPENSO">Suspenso</option>
                  <option value="CONCLUIDO">Concluído</option>
                  <option value="ENCERRADO">Encerrado</option>
                  <option value="ARQUIVADO">Arquivado</option>
                </select>
              </div>
            </div>

            <div
              className="px-6 pb-6 flex gap-3 justify-end"
              style={{ borderTop: '1px solid var(--border)', paddingTop: 16, background: 'rgba(255,255,255,.02)' }}
            >
              <button onClick={() => setShowEdit(false)} className="btn btn-ghost">Cancelar</button>
              <button
                onClick={() => editarMutation.mutate(editForm)}
                disabled={editarMutation.isPending}
                className="btn btn-gold"
              >
                {editarMutation.isPending
                  ? <span className="spinner" style={{ width: 16, height: 16 }} />
                  : <i className="fas fa-floppy-disk" />}
                {' '}Salvar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
