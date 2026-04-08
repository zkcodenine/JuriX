import { formatarData, formatarNumeroCNJ, formatarMoeda, statusLabel, statusTarefaLabel, prioridadeLabel } from '../../../utils/formatters';

const prioridadeColor = { URGENTE: '#ef4444', ALTA: '#f59e0b', MEDIA: '#C9A84C', BAIXA: '#10b981' };

export default function TabVisaoGeral({ processo }) {
  const partes = processo.partes || [];
  const autores = partes.filter(p => p.tipo === 'AUTOR');
  const reus    = partes.filter(p => p.tipo === 'REU');
  const outros  = partes.filter(p => !['AUTOR','REU'].includes(p.tipo));
  const advogados = processo.advogados || [];
  const tarefas = (processo.tarefas || []).filter(t => t.status !== 'CONCLUIDA').slice(0, 3);
  const prazos  = (processo.prazos  || []).filter(p => p.status === 'PENDENTE').slice(0, 3);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* ─── Dados do processo ─────────────────── */}
      <div className="space-y-4">
        <h4 className="font-bold text-sm flex items-center gap-2">
          <i className="fas fa-circle-info" style={{ color: 'var(--accent)' }} />
          Dados do processo
        </h4>
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {[
            { label: 'Número CNJ',    valor: formatarNumeroCNJ(processo.numeroCnj || processo.numero) },
            { label: 'Tribunal',      valor: processo.tribunal },
            { label: 'Vara',          valor: processo.vara },
            { label: 'Classe',        valor: processo.classe },
            { label: 'Assunto',       valor: processo.assunto },
            { label: 'Status',        valor: statusLabel[processo.status] || processo.status },
            { label: 'Distribuído',   valor: formatarData(processo.dataDistribuicao) },
            { label: 'Origem dos dados', valor: processo.origemDados === 'datajud' ? '📡 DataJud (CNJ)' : 'Manual' },
          ].map((item, i) => (
            <div
              key={item.label}
              className="flex gap-3 px-4 py-3 text-sm"
              style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.02)', borderBottom: '1px solid var(--border)' }}
            >
              <span className="flex-shrink-0 w-36 font-medium" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
              <span className="font-medium">{item.valor || '—'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Coluna direita ────────────────────── */}
      <div className="space-y-5">

        {/* Partes */}
        <div>
          <h4 className="font-bold text-sm flex items-center gap-2 mb-3">
            <i className="fas fa-users" style={{ color: 'var(--accent)' }} />
            Partes
          </h4>
          <div className="space-y-2">
            {autores.length === 0 && reus.length === 0 && outros.length === 0 && (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nenhuma parte cadastrada.</p>
            )}
            {autores.map(p => <ParteBadge key={p.id} parte={p} cor="#10b981" label="Autor" />)}
            {reus.map(p => <ParteBadge key={p.id} parte={p} cor="#ef4444" label="Réu" />)}
            {outros.map(p => <ParteBadge key={p.id} parte={p} cor="#a0a0a0" label={p.tipo} />)}
          </div>
        </div>

        {/* Advogados */}
        {advogados.length > 0 && (
          <div>
            <h4 className="font-bold text-sm flex items-center gap-2 mb-3">
              <i className="fas fa-scale-balanced" style={{ color: 'var(--accent)' }} />
              Advogados
            </h4>
            <div className="space-y-2">
              {advogados.map(adv => (
                <div key={adv.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)' }}>
                  <i className="fas fa-user-tie text-sm" style={{ color: 'var(--accent)' }} />
                  <div>
                    <p className="text-sm font-medium">{adv.nome}</p>
                    {adv.oab && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>OAB {adv.oab} {adv.polo ? `• ${adv.polo}` : ''}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tarefas pendentes */}
        {tarefas.length > 0 && (
          <div>
            <h4 className="font-bold text-sm flex items-center gap-2 mb-3">
              <i className="fas fa-list-check" style={{ color: 'var(--accent)' }} />
              Tarefas pendentes
            </h4>
            <div className="space-y-2">
              {tarefas.map(t => (
                <div key={t.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)', borderLeft: `3px solid ${prioridadeColor[t.prioridade]}` }}>
                  <i className="fas fa-circle-half-stroke text-xs" style={{ color: prioridadeColor[t.prioridade] }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.titulo}</p>
                    {t.prazo && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Prazo: {formatarData(t.prazo)}</p>}
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${prioridadeColor[t.prioridade]}20`, color: prioridadeColor[t.prioridade] }}>
                    {prioridadeLabel[t.prioridade]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Prazos */}
        {prazos.length > 0 && (
          <div>
            <h4 className="font-bold text-sm flex items-center gap-2 mb-3">
              <i className="fas fa-clock" style={{ color: '#f59e0b' }} />
              Prazos próximos
            </h4>
            <div className="space-y-2">
              {prazos.map(p => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)' }}>
                  <i className="fas fa-calendar text-xs" style={{ color: '#f59e0b' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.titulo}</p>
                    <p className="text-xs" style={{ color: '#f59e0b' }}>{formatarData(p.dataVencimento)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ParteBadge({ parte, cor, label }) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)', borderLeft: `3px solid ${cor}` }}>
      <div>
        <p className="text-sm font-medium">{parte.nome}</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}{parte.cpfCnpj ? ` • ${parte.cpfCnpj}` : ''}</p>
      </div>
    </div>
  );
}
