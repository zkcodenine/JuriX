import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import api from '../../services/api';

/* ─── helpers ─────────────────────────────────────── */
const toDateOnly = (d) => format(new Date(d), 'yyyy-MM-dd');

const priorCor = { URGENTE: '#ef4444', ALTA: '#f59e0b', MEDIA: '#C9A84C', BAIXA: '#10b981' };
const priorLabel = { URGENTE: 'Urgente', ALTA: 'Alta', MEDIA: 'Média', BAIXA: 'Baixa' };

const nomeCliente = (proc) => {
  if (!proc) return '';
  const autor = proc.partes?.[0]?.nome;
  return autor || proc.numeroCnj || proc.numero || '';
};

/* ─── Modal de Evento ─────────────────────────────── */
function EventoModal({ evento, etiquetas, onClose, onSaved }) {
  const qc = useQueryClient();
  const isEdit = !!evento?.id;

  const [form, setForm] = useState({
    titulo:     evento?.titulo     || '',
    data:       evento?.data ? format(new Date(evento.data), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    horario:    evento?.horario    || '',
    descricao:  evento?.descricao  || '',
    etiquetaId: evento?.etiquetaId || '',
  });

  const { mutate, isPending } = useMutation({
    mutationFn: () => isEdit
      ? api.put(`/agenda/eventos/${evento.id}`, { ...form, etiquetaId: form.etiquetaId || null })
      : api.post('/agenda/eventos', { ...form, etiquetaId: form.etiquetaId || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agenda-eventos'] });
      toast.success(isEdit ? 'Evento atualizado!' : 'Evento criado!');
      onSaved?.();
    },
    onError: () => toast.error('Erro ao salvar evento.'),
  });

  return createPortal(
    <div
      className="animate-fadeIn"
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(8px)',
        padding: '1rem',
      }}
    >
      <div
        className="w-full max-w-md animate-scaleIn"
        style={{
          background: '#131a2b',
          border: '1px solid rgba(255,255,255,.1)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
      >
        <div className="flex justify-between items-center px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-lg" style={{ width: 36, height: 36, background: 'rgba(201,168,76,.1)' }}>
              <i className={`fas ${isEdit ? 'fa-pen' : 'fa-calendar-plus'}`} style={{ color: 'var(--accent)', fontSize: 14 }} />
            </div>
            <div>
              <h3 className="font-bold text-sm">{isEdit ? 'Editar Evento' : 'Novo Evento'}</h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Compromisso na agenda</p>
            </div>
          </div>
          <button onClick={onClose} className="text-lg" style={{ color: 'var(--text-muted)' }}>
            <i className="fas fa-xmark" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label style={labelStyle}>Título <span style={{ color: 'var(--accent)' }}>*</span></label>
            <input className="input-base text-sm" placeholder="Ex: Audiência, Reunião..." value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Data <span style={{ color: 'var(--accent)' }}>*</span></label>
              <input type="date" className="input-base text-sm" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Horário</label>
              <input type="time" className="input-base text-sm" value={form.horario} onChange={e => setForm(f => ({ ...f, horario: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Etiqueta</label>
            <select className="input-base text-sm" value={form.etiquetaId} onChange={e => setForm(f => ({ ...f, etiquetaId: e.target.value }))}>
              <option value="">Sem etiqueta</option>
              {etiquetas.map(et => <option key={et.id} value={et.id}>{et.nome}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Descrição</label>
            <textarea className="input-base text-sm" rows={2} placeholder="Detalhes..." value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} style={{ resize: 'none' }} />
          </div>
        </div>

        <div className="px-5 py-3 flex gap-2 justify-end" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          <button onClick={onClose} className="btn btn-ghost text-sm">Cancelar</button>
          <button onClick={() => mutate()} disabled={!form.titulo || !form.data || isPending} className="btn btn-gold text-sm">
            {isPending ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <i className="fas fa-check" />}
            {isEdit ? 'Atualizar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─── Modal de Etiquetas (Correção 2: click to edit) ─── */
const CORES_PRESET = ['#C9A84C','#ef4444','#f97316','#eab308','#22c55e','#10b981','#3b82f6','#8b5cf6','#ec4899','#64748b'];

function EtiquetasModal({ onClose }) {
  const qc = useQueryClient();
  const [novoNome, setNovoNome] = useState('');
  const [novaCor, setNovaCor] = useState('#C9A84C');
  const [editando, setEditando] = useState(null);

  const { data: etiquetas = [] } = useQuery({
    queryKey: ['agenda-etiquetas'],
    queryFn: () => api.get('/agenda/etiquetas').then(r => r.data),
  });

  const criarMut = useMutation({
    mutationFn: () => api.post('/agenda/etiquetas', { nome: novoNome, cor: novaCor }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agenda-etiquetas'] }); setNovoNome(''); toast.success('Etiqueta criada!'); },
  });
  const editarMut = useMutation({
    mutationFn: ({ id, nome, cor }) => api.put(`/agenda/etiquetas/${id}`, { nome, cor }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agenda-etiquetas'] }); setEditando(null); toast.success('Atualizada!'); },
  });
  const deletarMut = useMutation({
    mutationFn: (id) => api.delete(`/agenda/etiquetas/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agenda-etiquetas'] }); toast.success('Excluída.'); },
  });

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
        style={{ background: '#131a2b', border: '1px solid rgba(255,255,255,.1)', borderRadius: 'var(--radius-lg)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="flex justify-between items-center px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h3 className="font-bold text-sm">Gerenciar Etiquetas</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Clique em uma etiqueta para editá-la</p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><i className="fas fa-xmark text-lg" /></button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div>
            <label style={labelStyle}>Nova Etiqueta</label>
            <div className="flex gap-2 mb-2">
              <input className="input-base text-sm flex-1" placeholder="Nome" value={novoNome} onChange={e => setNovoNome(e.target.value)} onKeyDown={e => e.key === 'Enter' && novoNome.trim() && criarMut.mutate()} />
              <button onClick={() => novoNome.trim() && criarMut.mutate()} disabled={!novoNome.trim()} className="btn btn-gold px-3 text-sm"><i className="fas fa-plus" /></button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CORES_PRESET.map(cor => (
                <button key={cor} onClick={() => setNovaCor(cor)} className="rounded-full" style={{ width: 22, height: 22, background: cor, border: novaCor === cor ? '2px solid white' : '2px solid transparent', outline: novaCor === cor ? `2px solid ${cor}` : 'none', outlineOffset: 2 }} />
              ))}
              <input type="color" value={novaCor} onChange={e => setNovaCor(e.target.value)} className="w-[22px] h-[22px] rounded-full border-0 cursor-pointer" style={{ padding: 0, background: 'none' }} />
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Cadastradas ({etiquetas.length})</p>
            {etiquetas.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>Nenhuma etiqueta.</p>
            ) : (
              <div className="space-y-1.5">
                {etiquetas.map(et => (
                  <div key={et.id}>
                    {editando?.id === et.id ? (
                      <div className="flex gap-2 items-center p-2 rounded-lg" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--accent-border)' }}>
                        <input className="input-base flex-1 py-1.5 text-sm" value={editando.nome} onChange={e => setEditando(ed => ({ ...ed, nome: e.target.value }))} autoFocus />
                        <div className="flex gap-1">{CORES_PRESET.map(cor => (<button key={cor} onClick={() => setEditando(ed => ({ ...ed, cor }))} className="rounded-full flex-shrink-0" style={{ width: 16, height: 16, background: cor, border: editando.cor === cor ? '2px solid white' : '2px solid transparent' }} />))}</div>
                        <button onClick={() => editarMut.mutate(editando)} className="btn btn-gold px-2 py-1 text-xs"><i className="fas fa-check" /></button>
                        <button onClick={() => setEditando(null)} className="btn btn-ghost px-2 py-1 text-xs"><i className="fas fa-xmark" /></button>
                      </div>
                    ) : (
                      /* Correção 2: Click to edit directly, no separate edit button */
                      <div
                        className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer group transition-all"
                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
                        onClick={() => setEditando({ id: et.id, nome: et.nome, cor: et.cor })}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                      >
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: et.cor }} />
                        <span className="text-sm flex-1">{et.nome}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); deletarMut.mutate(et.id); }} className="text-xs px-1.5 py-1" style={{ color: 'var(--danger)' }}><i className="fas fa-trash text-[10px]" /></button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─── Modal de Detalhe do Evento (Melhoria 5) ────── */
function EventoDetailModal({ evento, onClose, onEdit, onDelete }) {
  const cor = evento.etiqueta?.cor || '#8b5cf6';
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
        className="w-full max-w-sm animate-scaleIn"
        style={{ background: '#131a2b', border: '1px solid rgba(255,255,255,.1)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}
      >
        {/* Color bar */}
        <div style={{ height: 4, background: cor }} />

        <div className="px-5 py-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-base">{evento.titulo}</h3>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                <i className="fas fa-calendar mr-1" />
                {format(new Date(evento.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                {evento.horario && <> &bull; <i className="fas fa-clock mr-1" />{evento.horario}</>}
              </p>
            </div>
            <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
              <i className="fas fa-xmark text-lg" />
            </button>
          </div>

          {evento.etiqueta && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full inline-block mb-3"
              style={{ background: `${cor}15`, color: cor, border: `1px solid ${cor}30` }}>
              {evento.etiqueta.nome}
            </span>
          )}

          {evento.descricao && (
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
              {evento.descricao}
            </p>
          )}

          <div className="flex gap-2 justify-end pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <button onClick={() => { onClose(); onEdit(evento); }} className="btn btn-ghost text-sm">
              <i className="fas fa-pen" /> Editar
            </button>
            <button
              onClick={() => { if (window.confirm('Remover este evento?')) { onDelete(evento.id); onClose(); } }}
              className="btn btn-ghost text-sm"
              style={{ color: 'var(--danger)' }}
            >
              <i className="fas fa-trash" /> Excluir
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
  letterSpacing: '0.06em', textTransform: 'uppercase',
  color: 'var(--text-secondary)', marginBottom: '0.35rem',
};

/* ─── Card de tarefa na agenda (expandível) ──────── */
function AgendaTarefaCard({ t, isDone, cor, toggleTarefaMut, navigate }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="rounded-lg overflow-hidden animate-fadeInFast transition-all"
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${open ? 'var(--accent-border, rgba(201,168,76,.3))' : 'var(--border)'}`,
        opacity: isDone ? .55 : 1,
      }}
    >
      <div
        className="flex items-start gap-2.5 p-3 cursor-pointer transition-colors hover:bg-white/[.02]"
        onClick={() => setOpen(o => !o)}
      >
        <button
          onClick={(e) => { e.stopPropagation(); toggleTarefaMut.mutate({ id: t.id, status: t.status }); }}
          className="flex-shrink-0 mt-0.5 transition-transform hover:scale-110"
        >
          <div
            className="flex items-center justify-center rounded-md"
            style={{
              width: 22, height: 22,
              border: `2px solid ${isDone ? '#10b981' : cor}`,
              background: isDone ? 'rgba(16,185,129,.15)' : 'transparent',
            }}
          >
            {isDone && <i className="fas fa-check text-[9px]" style={{ color: '#10b981' }} />}
          </div>
        </button>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${isDone ? 'line-through' : ''}`}
            style={{ color: isDone ? 'var(--text-muted)' : 'var(--text-primary)' }}>
            {t.titulo}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: `${cor}15`, color: cor, border: `1px solid ${cor}30` }}>
              {priorLabel[t.prioridade]}
            </span>
            {t.processo && (
              <button
                onClick={(e) => { e.stopPropagation(); navigate(`/processos/${t.processoId}`); }}
                className="text-[10px] font-medium hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                <i className="fas fa-user mr-0.5" />
                {nomeCliente(t.processo)}
              </button>
            )}
          </div>
        </div>
        <i className={`fas fa-chevron-${open ? 'up' : 'down'} text-[9px] mt-2 flex-shrink-0`}
          style={{ color: 'var(--text-muted)' }} />
      </div>

      {open && (
        <div
          className="flex items-center gap-2 px-3 py-2 animate-fadeIn"
          style={{ borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,.02)' }}
        >
          <button
            onClick={() => toggleTarefaMut.mutate({ id: t.id, status: t.status })}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-all hover:bg-white/5"
            style={{ color: isDone ? '#f59e0b' : '#10b981' }}
          >
            <i className={`fas ${isDone ? 'fa-rotate-left' : 'fa-check'} text-[9px]`} />
            {isDone ? 'Reabrir' : 'Concluir'}
          </button>
          {t.processo && (
            <button
              onClick={() => navigate(`/processos/${t.processoId}`)}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-all hover:bg-white/5"
              style={{ color: 'var(--accent)' }}
            >
              <i className="fas fa-scale-balanced text-[9px]" />
              Ver processo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Componente principal ────────────────────────── */
export default function Agenda() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mesAtual, setMesAtual] = useState(new Date());
  const [diaSelecionado, setDia] = useState(null); // Correção 3: starts null
  const [sidebarAberta, setSidebarAberta] = useState(false); // Correção 3: sidebar closed by default
  const [showNovoEvento, setShowNE] = useState(false);
  const [novoEventoData, setNEData] = useState(null);
  const [editandoEvento, setEditEv] = useState(null);
  const [eventoDetalhe, setEventoDetalhe] = useState(null); // Melhoria 5
  const [showEtiquetas, setShowEt] = useState(false);

  const mesStr = format(mesAtual, 'yyyy-MM');

  const { data: prazosData = [] } = useQuery({
    queryKey: ['agenda-prazos'],
    queryFn: () => api.get('/processos/prazos-agenda').then(r => r.data),
  });

  const { data: eventos = [] } = useQuery({
    queryKey: ['agenda-eventos', mesStr],
    queryFn: () => api.get(`/agenda/eventos?mes=${mesStr}`).then(r => r.data),
  });

  const { data: tarefas = [] } = useQuery({
    queryKey: ['agenda-tarefas'],
    queryFn: () => api.get('/tarefas').then(r => r.data),
  });

  const { data: etiquetas = [] } = useQuery({
    queryKey: ['agenda-etiquetas'],
    queryFn: () => api.get('/agenda/etiquetas').then(r => r.data),
  });

  // Correção 1: Fetch process updates for calendar
  const { data: movimentacoes = [] } = useQuery({
    queryKey: ['agenda-movimentacoes'],
    queryFn: () => api.get('/processos/movimentacoes-agenda').then(r => r.data),
  });

  const deletarEventoMut = useMutation({
    mutationFn: (id) => api.delete(`/agenda/eventos/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agenda-eventos'] }); toast.success('Evento removido.'); },
  });

  const toggleTarefaMut = useMutation({
    mutationFn: ({ id, status }) => api.put(`/tarefas/${id}`, {
      status: status === 'CONCLUIDA' ? 'PENDENTE' : 'CONCLUIDA',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agenda-tarefas'] });
      qc.invalidateQueries({ queryKey: ['tarefas'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['processo'] });
    },
  });

  // Maps by date
  const prazosPorData = useMemo(() => {
    const map = {};
    prazosData.forEach(pz => {
      const key = toDateOnly(pz.dataVencimento);
      if (!map[key]) map[key] = [];
      map[key].push({ ...pz, _type: 'prazo', _processo: pz.processo });
    });
    return map;
  }, [prazosData]);

  const eventosPorData = useMemo(() => {
    const map = {};
    eventos.forEach(ev => {
      const key = toDateOnly(ev.data);
      if (!map[key]) map[key] = [];
      map[key].push({ ...ev, _type: 'evento' });
    });
    return map;
  }, [eventos]);

  const tarefasPorData = useMemo(() => {
    const map = {};
    tarefas.filter(t => t.prazo).forEach(t => {
      const key = toDateOnly(t.prazo);
      if (!map[key]) map[key] = [];
      map[key].push({ ...t, _type: 'tarefa' });
    });
    return map;
  }, [tarefas]);

  // Correção 1: Map movimentacoes by date
  const movsPorData = useMemo(() => {
    const map = {};
    movimentacoes.forEach(mov => {
      const key = toDateOnly(mov.data);
      if (!map[key]) map[key] = [];
      map[key].push({ ...mov, _type: 'movimentacao' });
    });
    return map;
  }, [movimentacoes]);

  // Calendar
  const inicioMes = startOfMonth(mesAtual);
  const fimMes = endOfMonth(mesAtual);
  const dias = eachDayOfInterval({ start: inicioMes, end: fimMes });
  const offsetInicio = getDay(inicioMes);
  const diasVazios = Array(offsetInicio).fill(null);
  const semanas = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

  const mesAnterior = () => setMesAtual(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const mesSeguinte = () => setMesAtual(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const hoje = new Date();

  // Selected day items
  const diaSel = diaSelecionado ? toDateOnly(diaSelecionado) : null;
  const prazosDia = diaSel ? (prazosPorData[diaSel] || []) : [];
  const eventosDia = diaSel ? (eventosPorData[diaSel] || []) : [];
  const tarefasDia = diaSel ? (tarefasPorData[diaSel] || []) : [];
  const movsDia = diaSel ? (movsPorData[diaSel] || []) : [];

  const corPrazo = (pz) => {
    const d = Math.ceil((new Date(pz.dataVencimento) - hoje) / 86400000);
    if (d < 0) return '#ef4444';
    if (d <= 3) return '#f59e0b';
    return '#C9A84C';
  };

  const getItemsForDay = (dateKey) => {
    const e = eventosPorData[dateKey] || [];
    const p = prazosPorData[dateKey] || [];
    const t = tarefasPorData[dateKey] || [];
    const m = movsPorData[dateKey] || [];
    return [...e, ...p, ...t, ...m];
  };

  // Correção 3: Click day opens sidebar
  const handleDayClick = (dia) => {
    setDia(dia);
    setSidebarAberta(true);
  };

  return (
    <div className="flex gap-0 animate-fadeIn" style={{ minHeight: 'calc(100vh - 56px)' }}>
      {/* ─── Calendar ──────────────────────────────── */}
      <div className="flex-1 flex flex-col" style={{ borderRight: sidebarAberta ? '1px solid var(--border)' : 'none' }}>
        {/* Calendar nav */}
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-lg font-bold capitalize">
            {format(mesAtual, 'MMMM yyyy', { locale: ptBR })}
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowEt(true)} className="btn btn-ghost text-xs py-1.5 px-3">
              <i className="fas fa-tags" style={{ color: 'var(--accent)' }} /> Etiquetas
            </button>
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <button onClick={mesAnterior} className="px-2.5 py-1.5 transition-colors" style={{ background: 'transparent' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <i className="fas fa-chevron-left text-xs" style={{ color: 'var(--text-muted)' }} />
              </button>
              <button
                onClick={() => { setMesAtual(new Date()); setDia(new Date()); setSidebarAberta(true); }}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={{ color: 'var(--accent)', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                Hoje
              </button>
              <button onClick={mesSeguinte} className="px-2.5 py-1.5 transition-colors" style={{ background: 'transparent' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <i className="fas fa-chevron-right text-xs" style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
            <button
              onClick={() => { setNEData(diaSel || format(new Date(), 'yyyy-MM-dd')); setShowNE(true); }}
              className="btn btn-gold text-xs py-1.5 px-3"
            >
              <i className="fas fa-plus" /> Novo Evento
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-6 pb-3">
          {[
            { cor: '#ef4444', label: 'Vencido' },
            { cor: '#f59e0b', label: 'Urgente' },
            { cor: '#C9A84C', label: 'Prazo' },
            { cor: '#3b82f6', label: 'Tarefa' },
            { cor: '#8b5cf6', label: 'Evento' },
            { cor: '#22d3ee', label: 'Atualização' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: l.cor }} />
              {l.label}
            </div>
          ))}
        </div>

        {/* Week header */}
        <div className="grid grid-cols-7" style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
          {semanas.map(s => (
            <div key={s} className="text-center py-2 text-[11px] font-bold tracking-wider" style={{ color: 'var(--text-muted)' }}>{s}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 flex-1">
          {diasVazios.map((_, i) => (
            <div key={`vz-${i}`} style={{ borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', minHeight: 90 }} />
          ))}
          {dias.map((dia, i) => {
            const key = toDateOnly(dia);
            const items = getItemsForDay(key);
            const selecionado = diaSelecionado && isSameDay(dia, diaSelecionado);
            const maxShow = 3;
            const overflow = items.length - maxShow;

            return (
              <div
                key={i}
                onClick={() => handleDayClick(dia)}
                className="cursor-pointer transition-colors"
                style={{
                  borderRight: '1px solid var(--border)',
                  borderBottom: '1px solid var(--border)',
                  minHeight: 90,
                  padding: '4px 5px',
                  background: selecionado
                    ? 'rgba(201,168,76,.08)'
                    : isToday(dia) ? 'rgba(59,130,246,.06)' : 'transparent',
                }}
              >
                {/* Day number */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="inline-flex items-center justify-center rounded-md text-xs font-semibold"
                    style={{
                      width: 24, height: 24,
                      background: isToday(dia) ? 'var(--accent)' : 'transparent',
                      color: isToday(dia) ? '#0a0a0a' : selecionado ? 'var(--accent)' : 'var(--text-primary)',
                    }}
                  >
                    {dia.getDate()}
                  </span>
                  {items.length > 0 && !selecionado && (
                    <span className="text-[9px] font-medium px-1 rounded" style={{ color: 'var(--text-muted)' }}>
                      {items.length}
                    </span>
                  )}
                </div>

                {/* Event pills on calendar */}
                <div className="space-y-0.5">
                  {items.slice(0, maxShow).map((item, idx) => {
                    let cor, titulo;
                    if (item._type === 'evento') {
                      cor = item.etiqueta?.cor || '#8b5cf6';
                      titulo = item.titulo;
                    } else if (item._type === 'tarefa') {
                      cor = priorCor[item.prioridade] || '#3b82f6';
                      titulo = item.titulo;
                    } else if (item._type === 'movimentacao') {
                      cor = '#22d3ee';
                      titulo = item.descricao?.slice(0, 40) || 'Atualização';
                    } else {
                      cor = corPrazo(item);
                      titulo = item.titulo;
                    }
                    return (
                      <div
                        key={`${item._type}-${item.id}-${idx}`}
                        className="truncate text-[10px] font-medium px-1.5 py-0.5 rounded"
                        style={{
                          background: `${cor}20`,
                          color: cor,
                          borderLeft: `2px solid ${cor}`,
                        }}
                      >
                        {item.horario ? `${item.horario} ` : ''}{titulo}
                      </div>
                    );
                  })}
                  {overflow > 0 && (
                    <div className="text-[10px] font-medium px-1.5" style={{ color: 'var(--accent)' }}>
                      +{overflow} mais
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Side panel (Correção 3: only when open) ──── */}
      {sidebarAberta && (
        <div className="flex flex-col animate-slideInRight" style={{ width: 340, background: 'var(--bg-secondary)' }}>
          {/* Panel header */}
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">
                  {diaSelecionado
                    ? format(diaSelecionado, "EEEE, dd 'de' MMMM", { locale: ptBR })
                    : 'Selecione um dia'
                  }
                </h3>
                {diaSelecionado && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {eventosDia.length + prazosDia.length + tarefasDia.length + movsDia.length} item{(eventosDia.length + prazosDia.length + tarefasDia.length + movsDia.length) !== 1 ? 'ns' : ''}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { setNEData(diaSel || format(new Date(), 'yyyy-MM-dd')); setShowNE(true); }}
                  className="flex items-center justify-center rounded-lg"
                  style={{ width: 30, height: 30, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                  title="Criar evento neste dia"
                >
                  <i className="fas fa-plus text-xs" />
                </button>
                {/* Correção 3: X button to close sidebar */}
                <button
                  onClick={() => { setSidebarAberta(false); setDia(null); }}
                  className="flex items-center justify-center rounded-lg"
                  style={{ width: 30, height: 30, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                  title="Fechar painel"
                >
                  <i className="fas fa-xmark text-xs" />
                </button>
              </div>
            </div>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {!diaSelecionado ? (
              <div className="flex flex-col items-center pt-12 gap-2" style={{ color: 'var(--text-muted)' }}>
                <i className="fas fa-calendar text-3xl" style={{ opacity: .2 }} />
                <p className="text-xs">Clique em um dia no calendário</p>
              </div>
            ) : (eventosDia.length + prazosDia.length + tarefasDia.length + movsDia.length) === 0 ? (
              <div className="flex flex-col items-center pt-12 gap-2" style={{ color: 'var(--text-muted)' }}>
                <i className="fas fa-calendar-check text-3xl" style={{ opacity: .2 }} />
                <p className="text-xs">Nenhum evento neste dia</p>
                <button
                  onClick={() => { setNEData(diaSel); setShowNE(true); }}
                  className="btn btn-ghost text-xs mt-2"
                >
                  <i className="fas fa-plus" /> Criar evento
                </button>
              </div>
            ) : (
              <>
                {/* Tarefas */}
                {tarefasDia.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5 px-1" style={{ color: 'var(--text-muted)' }}>
                      <i className="fas fa-list-check mr-1" />Tarefas ({tarefasDia.length})
                    </p>
                    <div className="space-y-1.5">
                      {tarefasDia.map(t => {
                        const isDone = t.status === 'CONCLUIDA';
                        const cor = priorCor[t.prioridade];
                        return <AgendaTarefaCard key={`t-${t.id}`} t={t} isDone={isDone} cor={cor} toggleTarefaMut={toggleTarefaMut} navigate={navigate} />;
                      })}
                    </div>
                  </div>
                )}

                {/* Prazos */}
                {prazosDia.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5 px-1 mt-2" style={{ color: 'var(--text-muted)' }}>
                      <i className="fas fa-clock mr-1" />Prazos ({prazosDia.length})
                    </p>
                    <div className="space-y-1.5">
                      {prazosDia.map(pz => {
                        const cor = corPrazo(pz);
                        const diasR = Math.ceil((new Date(pz.dataVencimento) - hoje) / 86400000);
                        return (
                          <div
                            key={`pz-${pz.id}`}
                            className="flex items-start gap-2.5 p-3 rounded-lg cursor-pointer group animate-fadeInFast"
                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                            onClick={() => pz._processo && navigate(`/processos/${pz._processo.id}?tab=prazos`)}
                          >
                            <div className="flex-shrink-0 mt-0.5 rounded-md" style={{ width: 4, height: 32, background: cor }} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium truncate">{pz.titulo}</p>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                                  style={{ background: `${cor}15`, color: cor, border: `1px solid ${cor}30` }}>
                                  {diasR < 0 ? 'Vencido' : diasR === 0 ? 'Hoje' : `${diasR}d`}
                                </span>
                              </div>
                              {pz._processo && (
                                <p className="text-[10px] mt-1" style={{ color: 'var(--accent)' }}>
                                  <i className="fas fa-user mr-0.5" />
                                  {nomeCliente(pz._processo)}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Eventos — Melhoria 5: click to view detail, no inline edit/delete */}
                {eventosDia.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5 px-1 mt-2" style={{ color: 'var(--text-muted)' }}>
                      <i className="fas fa-calendar mr-1" />Eventos ({eventosDia.length})
                    </p>
                    <div className="space-y-1.5">
                      {eventosDia.map(ev => {
                        const cor = ev.etiqueta?.cor || '#8b5cf6';
                        return (
                          <div
                            key={`ev-${ev.id}`}
                            className="flex items-start gap-2.5 p-3 rounded-lg cursor-pointer group animate-fadeInFast transition-all"
                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                            onClick={() => setEventoDetalhe(ev)}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                          >
                            <div className="flex-shrink-0 mt-0.5 rounded-md" style={{ width: 4, height: 32, background: cor }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{ev.titulo}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {ev.horario && (
                                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                    <i className="fas fa-clock mr-0.5" />{ev.horario}
                                  </span>
                                )}
                                {ev.etiqueta && (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                                    style={{ background: `${cor}15`, color: cor, border: `1px solid ${cor}30` }}>
                                    {ev.etiqueta.nome}
                                  </span>
                                )}
                              </div>
                              {ev.descricao && (
                                <p className="text-[10px] mt-1 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{ev.descricao}</p>
                              )}
                            </div>
                            <i className="fas fa-chevron-right text-[10px] mt-2 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Correção 1: Movimentações (atualizações de processos) */}
                {movsDia.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5 px-1 mt-2" style={{ color: 'var(--text-muted)' }}>
                      <i className="fas fa-bolt mr-1" />Atualizações de Processos ({movsDia.length})
                    </p>
                    <div className="space-y-1.5">
                      {movsDia.map((mov, idx) => (
                        <div
                          key={`mov-${mov.id}-${idx}`}
                          className="flex items-start gap-2.5 p-3 rounded-lg cursor-pointer animate-fadeInFast transition-all"
                          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                          onClick={() => mov.processo && navigate(`/processos/${mov.processo.id}?tab=movimentacoes`)}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                        >
                          <div className="flex-shrink-0 mt-0.5 rounded-md" style={{ width: 4, height: 32, background: '#22d3ee' }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: '#22d3ee' }}>
                              {mov.descricao?.slice(0, 60) || 'Movimentação'}
                            </p>
                            {mov.processo && (
                              <p className="text-[10px] mt-1" style={{ color: 'var(--accent)' }}>
                                <i className="fas fa-user mr-0.5" />
                                {nomeCliente(mov.processo)}
                              </p>
                            )}
                            {mov.origemApi && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-1 inline-block"
                                style={{ background: 'rgba(34,211,238,.1)', color: '#22d3ee', border: '1px solid rgba(34,211,238,.2)' }}>
                                {mov.origemApi.toUpperCase()}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {showNovoEvento && (
        <EventoModal
          evento={novoEventoData ? { data: novoEventoData } : undefined}
          etiquetas={etiquetas}
          onClose={() => { setShowNE(false); setNEData(null); }}
          onSaved={() => { setShowNE(false); setNEData(null); }}
        />
      )}
      {editandoEvento && (
        <EventoModal
          evento={editandoEvento}
          etiquetas={etiquetas}
          onClose={() => setEditEv(null)}
          onSaved={() => setEditEv(null)}
        />
      )}
      {showEtiquetas && <EtiquetasModal onClose={() => setShowEt(false)} />}
      {/* Melhoria 5: Event detail modal */}
      {eventoDetalhe && (
        <EventoDetailModal
          evento={eventoDetalhe}
          onClose={() => setEventoDetalhe(null)}
          onEdit={setEditEv}
          onDelete={(id) => deletarEventoMut.mutate(id)}
        />
      )}
    </div>
  );
}
