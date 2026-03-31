import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { formatarDataHora, formatarTempoRelativo } from '../../../utils/formatters';

const tipoIcon = (tipo = '') => {
  const t = tipo.toLowerCase();
  if (t.includes('sentença') || t.includes('sentenca')) return { icon: 'fa-gavel', color: '#C9A84C' };
  if (t.includes('despacho') || t.includes('decisão') || t.includes('decisao')) return { icon: 'fa-file-pen', color: '#60a5fa' };
  if (t.includes('audiência') || t.includes('audiencia')) return { icon: 'fa-people-group', color: '#a78bfa' };
  if (t.includes('recurso') || t.includes('apelação')) return { icon: 'fa-arrow-up-right-from-square', color: '#f59e0b' };
  if (t.includes('citação') || t.includes('intimação')) return { icon: 'fa-envelope', color: '#10b981' };
  if (t.includes('distribuição') || t.includes('distribuicao') || t.includes('distribuíd')) return { icon: 'fa-share-nodes', color: '#8b5cf6' };
  if (t.includes('juntada') || t.includes('petição') || t.includes('peticao')) return { icon: 'fa-file-circle-plus', color: '#06b6d4' };
  if (t.includes('conclus')) return { icon: 'fa-check-double', color: '#14b8a6' };
  if (t.includes('publicação') || t.includes('publicacao')) return { icon: 'fa-bullhorn', color: '#f97316' };
  return { icon: 'fa-circle-dot', color: '#C9A84C' };
};

const origemConfig = {
  tjmg:    { label: 'TJMG',   bg: 'rgba(34,211,238,.12)', color: '#22d3ee', border: 'rgba(34,211,238,.25)', icon: 'fa-landmark' },
  datajud: { label: 'CNJ',    bg: 'rgba(201,168,76,.12)', color: '#C9A84C', border: 'rgba(201,168,76,.2)',  icon: 'fa-database' },
  manual:  { label: 'Manual', bg: 'rgba(156,163,175,.1)', color: '#9ca3af', border: 'rgba(156,163,175,.2)', icon: 'fa-pen' },
};

function OrigemBadge({ origem }) {
  const c = origemConfig[origem] || origemConfig.manual;
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}
    >
      <i className={`fas ${c.icon}`} style={{ fontSize: 8 }} />
      {c.label}
    </span>
  );
}

export default function TabMovimentacoes({ processo }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ data: '', descricao: '', tipo: '' });
  const [filtroOrigem, setFiltroOrigem] = useState('todas');
  const qc = useQueryClient();

  const { data: movData, isLoading: loadingMovs } = useQuery({
    queryKey: ['movimentacoes', processo.id],
    queryFn: () => api.get(`/processos/${processo.id}/movimentacoes?limite=9999`).then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (movId) => api.delete(`/processos/${processo.id}/movimentacoes/${movId}`),
    onSuccess: () => {
      qc.invalidateQueries(['movimentacoes', processo.id]);
      qc.invalidateQueries(['processo', processo.id]);
      toast.success('Movimentacao excluida!');
    },
    onError: () => toast.error('Erro ao excluir movimentacao'),
  });

  const addMutation = useMutation({
    mutationFn: () => api.post(`/processos/${processo.id}/movimentacoes`, {
      ...form,
      data: form.data || new Date().toISOString(),
    }),
    onSuccess: () => {
      qc.invalidateQueries(['movimentacoes', processo.id]);
      qc.invalidateQueries(['processo', processo.id]);
      toast.success('Movimentacao adicionada!');
      setShowAdd(false);
      setForm({ data: '', descricao: '', tipo: '' });
    },
    onError: () => toast.error('Erro ao adicionar movimentacao'),
  });

  // Sincronizar movimentacoes com o tribunal
  const syncMutation = useMutation({
    mutationFn: () => api.post(`/processos/${processo.id}/sincronizar`, {}, { timeout: 120000 }),
    onSuccess: (res) => {
      qc.invalidateQueries(['movimentacoes', processo.id]);
      qc.invalidateQueries(['processo', processo.id]);
      qc.invalidateQueries(['dashboard']);
      const d = res.data;
      toast.success(
        `Sincronizado! ${d.encontradas} encontrada(s), ${d.salvasNovas} nova(s). Total: ${d.totalNoProcesso}`,
        { duration: 5000 }
      );
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Erro ao sincronizar'),
  });

  const allMovs = [...(movData?.items || [])].sort((a, b) => new Date(b.data) - new Date(a.data));
  const totalReal = movData?.total ?? processo._count?.movimentacoes ?? 0;

  // Mark as viewed: save timestamp to localStorage when tab is opened
  const viewedKey = `mov_viewed_${processo.id}`;
  useEffect(() => {
    // Save the current time as "last viewed" when component mounts
    localStorage.setItem(viewedKey, Date.now().toString());
    // Also invalidate processos list so sidebar badge updates
    return () => {
      qc.invalidateQueries({ queryKey: ['processos'] });
      qc.invalidateQueries({ queryKey: ['processos-alertas'] });
    };
  }, [viewedKey, qc]);

  // Filtro por origem
  const movs = filtroOrigem === 'todas'
    ? allMovs
    : allMovs.filter(m => (m.origemApi || 'manual') === filtroOrigem);

  // Contagens por origem
  const countByOrigem = allMovs.reduce((acc, m) => {
    const o = m.origemApi || 'manual';
    acc[o] = (acc[o] || 0) + 1;
    return acc;
  }, {});

  // Detecta movimentacoes recentes — only show as "new" if added AFTER the user last viewed this tab
  const agora = Date.now();
  const LIMITE_RECENTE = 48 * 60 * 60 * 1000;
  const lastViewed = parseInt(localStorage.getItem(viewedKey) || '0', 10);

  if (loadingMovs) return (
    <div className="flex flex-col gap-3 py-8">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="skeleton rounded-full flex-shrink-0" style={{ width: 40, height: 40 }} />
          <div className="flex-1 skeleton rounded-xl" style={{ height: 56 }} />
        </div>
      ))}
    </div>
  );

  // Only count as "recent" if within 48h AND the movement was created after last view
  const recentCount = allMovs.filter(m => {
    const movTime = new Date(m.data).getTime();
    return (agora - movTime) < LIMITE_RECENTE && movTime > lastViewed;
  }).length;

  return (
    <div>
      {/* Header com contador, filtros e botoes */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-sm" style={{ color: 'var(--text-secondary)' }}>
              {totalReal} movimentacao{totalReal !== 1 ? 'es' : ''}
            </h3>
            {recentCount > 0 && (
              <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full animate-pulse-subtle"
                style={{ background: 'rgba(34,211,238,.12)', color: '#22d3ee', border: '1px solid rgba(34,211,238,.2)' }}
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#22d3ee' }} />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: '#22d3ee' }} />
                </span>
                {recentCount} nova{recentCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Botao Sincronizar */}
            {processo.numeroCnj && (
              <button
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                className="btn btn-ghost text-sm py-2 group"
                title="Sincronizar movimentacoes com o tribunal"
              >
                {syncMutation.isPending ? (
                  <span className="spinner" style={{ width: 14, height: 14 }} />
                ) : (
                  <i className="fas fa-rotate group-hover:animate-spin" />
                )}
                {syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar'}
              </button>
            )}
            <button onClick={() => setShowAdd(!showAdd)} className="btn btn-ghost text-sm py-2">
              <i className="fas fa-plus" /> Adicionar
            </button>
          </div>
        </div>

        {/* Filtros por origem */}
        {Object.keys(countByOrigem).length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Filtrar:
            </span>
            <button
              onClick={() => setFiltroOrigem('todas')}
              className="text-[10px] font-bold px-2.5 py-1 rounded-full transition-all"
              style={{
                background: filtroOrigem === 'todas' ? 'var(--accent-light)' : 'transparent',
                color: filtroOrigem === 'todas' ? 'var(--accent)' : 'var(--text-muted)',
                border: `1px solid ${filtroOrigem === 'todas' ? 'var(--accent)' : 'var(--border)'}`,
              }}
            >
              Todas ({totalReal})
            </button>
            {Object.entries(countByOrigem).map(([origem, count]) => {
              const c = origemConfig[origem] || origemConfig.manual;
              const isActive = filtroOrigem === origem;
              return (
                <button
                  key={origem}
                  onClick={() => setFiltroOrigem(origem)}
                  className="text-[10px] font-bold px-2.5 py-1 rounded-full transition-all inline-flex items-center gap-1"
                  style={{
                    background: isActive ? c.bg : 'transparent',
                    color: isActive ? c.color : 'var(--text-muted)',
                    border: `1px solid ${isActive ? c.border : 'var(--border)'}`,
                  }}
                >
                  <i className={`fas ${c.icon}`} style={{ fontSize: 8 }} />
                  {c.label} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Form adicionar */}
      {showAdd && (
        <div className="rounded-xl p-4 mb-6 space-y-3 animate-fadeIn" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Data</label>
              <input type="datetime-local" className="input-base text-sm" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Tipo</label>
              <input className="input-base text-sm" placeholder="Ex: Despacho" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Descricao *</label>
            <textarea className="input-base text-sm" rows={3} placeholder="Descreva a movimentacao..." value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAdd(false)} className="btn btn-ghost text-sm py-2">Cancelar</button>
            <button onClick={() => addMutation.mutate()} disabled={!form.descricao || addMutation.isPending} className="btn btn-gold text-sm py-2">
              {addMutation.isPending ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <i className="fas fa-plus" />}
              Salvar
            </button>
          </div>
        </div>
      )}

      {movs.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3" style={{ color: 'var(--text-muted)' }}>
          <i className="fas fa-bolt text-4xl" style={{ opacity: .2 }} />
          <p className="text-sm">
            {filtroOrigem !== 'todas'
              ? `Nenhuma movimentacao de origem "${origemConfig[filtroOrigem]?.label || filtroOrigem}".`
              : 'Nenhuma movimentacao registrada.'
            }
          </p>
          {processo.numeroCnj && filtroOrigem === 'todas' && (
            <button onClick={() => syncMutation.mutate()} className="btn btn-gold text-sm mt-2" disabled={syncMutation.isPending}>
              <i className="fas fa-rotate" /> Buscar do tribunal
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          {/* Linha vertical da timeline */}
          <div className="absolute left-5 top-5 bottom-0 w-px" style={{ background: 'var(--border)' }} />

          <div className="space-y-0">
            {movs.map((mov, i) => {
              const { icon, color } = tipoIcon(mov.tipo || mov.descricao);
              const isApi = mov.origemApi === 'datajud' || mov.origemApi === 'tjmg';
              const movTime = new Date(mov.data).getTime();
              const isRecent = (agora - movTime) < LIMITE_RECENTE && movTime > lastViewed;
              const isTjmg = mov.origemApi === 'tjmg';

              // Cor do icone/borda para movimentacoes recentes
              const accentColor = isRecent ? '#22d3ee' : color;

              return (
                <div
                  key={mov.id}
                  className={`flex gap-4 pb-6 relative animate-fadeIn ${isRecent ? 'recent-mov' : ''}`}
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  {/* Icone na timeline */}
                  <div
                    className={`flex items-center justify-center rounded-full flex-shrink-0 z-10 ${isRecent ? 'shadow-lg' : ''}`}
                    style={{
                      width: 40, height: 40,
                      background: isRecent ? 'rgba(34,211,238,.12)' : 'var(--bg-card)',
                      border: `2px solid ${accentColor}`,
                      boxShadow: isRecent ? '0 0 12px rgba(34,211,238,.3)' : 'none',
                    }}
                  >
                    <i className={`fas ${isRecent ? 'fa-bolt' : icon} text-xs`} style={{ color: accentColor }} />
                  </div>

                  <div
                    className={`flex-1 rounded-xl p-4 hover:border-opacity-60 transition-all group ${isRecent ? 'shadow-md' : ''}`}
                    style={{
                      background: isRecent
                        ? 'linear-gradient(135deg, rgba(34,211,238,.06), rgba(34,211,238,.02))'
                        : 'var(--bg-tertiary)',
                      border: `1px solid ${isRecent ? 'rgba(34,211,238,.2)' : 'var(--border)'}`,
                      borderLeft: isRecent ? '3px solid #22d3ee' : isTjmg ? '3px solid rgba(34,211,238,.4)' : '1px solid var(--border)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <p className="text-sm font-semibold leading-snug" style={{ wordBreak: 'break-word' }}>{mov.descricao}</p>
                        {isRecent && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 animate-pulse"
                            style={{ background: 'rgba(34,211,238,.2)', color: '#22d3ee', boxShadow: '0 0 8px rgba(34,211,238,.2)' }}
                          >
                            NOVO
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <OrigemBadge origem={mov.origemApi || 'manual'} />
                        {!isApi && (
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(mov.id); }}
                            className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ color: 'var(--danger)' }}
                            title="Excluir movimentacao"
                          >
                            <i className="fas fa-trash text-[11px]" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: 'var(--text-muted)' }}>
                      {mov.tipo && <span className="font-medium" style={{ color: accentColor }}>{mov.tipo}</span>}
                      <span><i className="fas fa-calendar mr-1" />{formatarDataHora(mov.data)}</span>
                      <span className="ml-auto">{formatarTempoRelativo(mov.data)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
