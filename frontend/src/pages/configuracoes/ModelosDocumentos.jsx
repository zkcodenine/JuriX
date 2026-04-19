import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../services/api';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

// ── Preview ao vivo do papel timbrado ────────────────────────────
function LetterheadPreview({ config = {}, logoUrl = '' }) {
  const cor = (config.corDocumento && config.corDocumento.length === 7)
    ? config.corDocumento : '#1a2544';

  const hex = (c, a) => {
    if (!c || c.length < 7) return `rgba(26,37,68,${a})`;
    const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  };

  const nomeEsc = config.nomeEscritorio || 'Seu Escritório';
  const site    = config.site || config.website || 'seusite.com.br';

  return (
    <div style={{ position: 'relative', background: '#fff', border: '1px solid #ddd', borderRadius: 4, overflow: 'hidden', width: '100%', aspectRatio: '210/297' }}>
      {/* Faixa esquerda */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '4.3%', height: '14.3%', background: cor, clipPath: 'polygon(0 0,100% 0,60% 100%,0 100%)' }} />
      <div style={{ position: 'absolute', top: '15.2%', left: 0, width: 0, height: 0, borderTop: '3.4% solid transparent', borderLeft: `3.4% solid ${cor}` }} />
      {/* Triângulo superior-direito */}
      <div style={{ position: 'absolute', top: 0, right: 0, width: '50%', height: '14.8%', background: cor, clipPath: 'polygon(100% 0,100% 100%,35% 100%,0 0)', zIndex: 2 }} />
      <div style={{ position: 'absolute', top: 0, right: 0, width: '15.2%', height: '18.9%', background: hex(cor, 0.35), clipPath: 'polygon(100% 0,100% 100%,0 100%,55% 0)', zIndex: 1 }} />
      <div style={{ position: 'absolute', top: '16.5%', right: '7.4%', width: '2.4%', height: '1.7%', borderRadius: '50%', background: cor, zIndex: 3 }} />

      {/* Logo/nome dentro do triângulo */}
      <div style={{ position: 'absolute', top: '2%', right: '7%', zIndex: 4, textAlign: 'right' }}>
        {logoUrl
          ? <img src={logoUrl} alt="logo" style={{ maxHeight: '6%', maxWidth: '16%', objectFit: 'contain', filter: 'brightness(0) invert(1)', display: 'block', marginLeft: 'auto' }} />
          : <span style={{ fontSize: '2.4%', fontWeight: 'bold', color: '#fff', lineHeight: 1.2, display: 'block' }}>{nomeEsc.slice(0, 16)}</span>
        }
      </div>

      {/* Data + info */}
      <div style={{ paddingTop: '4%', paddingLeft: '4.8%', paddingRight: '4.8%' }}>
        <div style={{ fontSize: '2%', color: '#888', marginBottom: '1.3%' }}>__ de ________ de ____</div>
        <div style={{ fontSize: '2.2%', color: '#444', lineHeight: 1.5 }}>
          {config.oabEscritorio && <div>OAB {config.oabEscritorio}</div>}
          {config.telefone && <div>{config.telefone}</div>}
          {config.email && <div>{config.email}</div>}
        </div>
      </div>

      {/* Divisor */}
      <div style={{ height: '0.13%', margin: '1.3% 4.8%', background: `linear-gradient(to right, ${cor}, ${hex(cor, 0.4)}, ${hex(cor, 0.1)})` }} />

      {/* Corpo simulado */}
      <div style={{ padding: '1.3% 4.8% 12% 4.8%' }}>
        {[100, 88, 96, 72, 85, 60].map((w, i) => (
          <div key={i} style={{ height: '1.3%', borderRadius: 2, background: '#e8e8e8', marginBottom: '1%', width: `${w}%` }} />
        ))}
        <div style={{ height: '2%' }} />
        {[92, 100, 80].map((w, i) => (
          <div key={i} style={{ height: '1.3%', borderRadius: 2, background: '#e8e8e8', marginBottom: '1%', width: `${w}%` }} />
        ))}
      </div>

      {/* Rodapé */}
      <div style={{ position: 'absolute', bottom: '6.1%', left: 0, width: 0, height: 0, borderTop: '4% solid transparent', borderLeft: `4.8% solid ${cor}` }} />
      <div style={{ position: 'absolute', bottom: '4.7%', left: 0, width: 0, height: 0, borderTop: '2.4% solid transparent', borderLeft: `2.9% solid ${hex(cor, 0.4)}` }} />
      <div style={{ position: 'absolute', bottom: '7.4%', right: '4.8%', width: '1.9%', height: '1.3%', borderRadius: '50%', background: cor }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4.7%', background: cor, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4.8%' }}>
        <span style={{ fontSize: '2%', color: '#fff', fontWeight: 'bold' }}>{site}</span>
        <span style={{ fontSize: '1.8%', color: 'rgba(255,255,255,.7)' }}>JuriX</span>
      </div>
    </div>
  );
}

const quillModules = {
  toolbar: [
    [{ 'font': [] }],
    [{ 'size': ['small', false, 'large', 'huge'] }],
    ['bold', 'italic', 'underline'],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
    [{ 'align': [] }],
    ['clean']
  ]
};

const ensureHtml = (txt) => {
  if (!txt) return '';
  if (txt.includes('<p>') || txt.includes('<br>') || txt.includes('<div>')) return txt;
  return txt.split('\n').map(l => `<p>${l || '<br>'}</p>`).join('');
};

export const VARIAVEIS_MODELO = [
  { tag: '{{escritorio_nome}}',   desc: 'Nome do escritório'     },
  { tag: '{{escritorio_oab}}',    desc: 'OAB do escritório'      },
  { tag: '{{escritorio_email}}',  desc: 'E-mail do escritório'   },
  { tag: '{{escritorio_tel}}',    desc: 'Telefone do escritório'  },
  { tag: '{{cliente_nome}}',      desc: 'Nome do cliente'        },
  { tag: '{{processo_numero}}',   desc: 'Número do processo'     },
  { tag: '{{processo_vara}}',     desc: 'Vara / Tribunal'        },
  { tag: '{{processo_classe}}',   desc: 'Classe processual'      },
  { tag: '{{advogado_nome}}',     desc: 'Nome do advogado'       },
  { tag: '{{advogado_oab}}',      desc: 'OAB do advogado'        },
  { tag: '{{data_hoje}}',         desc: 'Data de hoje'           },
  { tag: '{{cidade}}',            desc: 'Cidade do escritório'   },
];

const EXEMPLOS = [
  {
    nome: 'Petição Inicial — Modelo',
    categoria: 'Petição',
    conteudo: `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA {{processo_vara}}

Processo nº: {{processo_numero}}

{{cliente_nome}}, já qualificado(a) nos autos, por meio de seu(sua) advogado(a) {{advogado_nome}}, OAB {{advogado_oab}}, vem, respeitosamente, à presença de Vossa Excelência, com fundamento no artigo [...] do Código de Processo Civil, apresentar

PETIÇÃO

[Corpo da petição]

Ante o exposto, requer-se:
a) [...];
b) [...].

Termos em que pede deferimento.

{{cidade}}, {{data_hoje}}

{{advogado_nome}}
OAB {{advogado_oab}}
{{escritorio_nome}}`,
  },
  {
    nome: 'Procuração Ad Judicia — Modelo',
    categoria: 'Procuração',
    conteudo: `PROCURAÇÃO AD JUDICIA ET EXTRA

Pelo presente instrumento particular, {{cliente_nome}}, nomeia e constitui como seu(sua) bastante procurador(a) o(a) advogado(a) {{advogado_nome}}, inscrito(a) na OAB sob nº {{advogado_oab}}, a quem confere amplos poderes para o foro em geral, com poderes especiais para [...].

{{cidade}}, {{data_hoje}}

_______________________________
{{cliente_nome}}
Outorgante`,
  },
  {
    nome: 'Contrato de Honorários — Modelo',
    categoria: 'Contrato',
    conteudo: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS

CONTRATANTE: {{cliente_nome}}
CONTRATADO: {{escritorio_nome}} — OAB {{escritorio_oab}}

Pelo presente instrumento, as partes acima identificadas firmam o presente contrato de prestação de serviços advocatícios referente ao processo {{processo_numero}}, perante {{processo_vara}}.

CLÁUSULA PRIMEIRA — DOS SERVIÇOS
[Descrição dos serviços...]

CLÁUSULA SEGUNDA — DOS HONORÁRIOS
[Valores e formas de pagamento...]

{{cidade}}, {{data_hoje}}

_______________________________        _______________________________
{{cliente_nome}}                       {{advogado_nome}}
Contratante                            Contratado — OAB {{advogado_oab}}`,
  },
];

// ── ModeloCard ───────────────────────────────────────────────────
function ModeloCard({ modelo, onEdit, onDelete, onGerar }) {
  return (
    <div className="card card-hover card-glow group animate-fadeIn" style={{ cursor: 'default' }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ width: 40, height: 40, background: 'var(--accent-light)', border: '1px solid var(--accent-border)' }}
          >
            <i className="fas fa-file-signature text-sm" style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <p className="font-semibold text-sm">{modelo.nome}</p>
            {modelo.categoria && (
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(201,168,76,.1)', color: '#C9A84C', border: '1px solid rgba(201,168,76,.2)' }}
              >
                {modelo.categoria}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onGerar(modelo)} className="btn btn-gold text-xs py-1.5 px-3" title="Gerar documento">
            <i className="fas fa-wand-magic-sparkles text-[11px]" /> Gerar
          </button>
          <button onClick={() => onEdit(modelo)} className="btn btn-ghost text-xs py-1.5 px-3" title="Editar">
            <i className="fas fa-pen text-[11px]" />
          </button>
          <button onClick={() => onDelete(modelo.id)} className="btn btn-danger text-xs py-1.5 px-3" title="Excluir">
            <i className="fas fa-trash text-[11px]" />
          </button>
        </div>
      </div>
      <p className="text-xs leading-relaxed line-clamp-3" style={{ color: 'var(--text-muted)', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
        {modelo.conteudo.replace(/<[^>]+>/g, '').slice(0, 200)}…
      </p>
    </div>
  );
}

// ── ModeloForm (criar / editar) ──────────────────────────────────
function ModeloForm({ modelo, onClose, onSaved }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    nome:      modelo?.nome      || '',
    categoria: modelo?.categoria || '',
    conteudo:  ensureHtml(modelo?.conteudo || ''),
  });
  const [showVars, setShowVars] = useState(false);

  const { data: config = {} } = useQuery({
    queryKey: ['configuracoes-escritorio'],
    queryFn: () => api.get('/configuracoes/escritorio').then(r => r.data),
    staleTime: 60000,
  });

  const logoUrl = config.logoEscritorio
    ? `${window.location.port === '3000' ? window.location.origin.replace(':3000', ':3001') : window.location.origin}${config.logoEscritorio}`
    : '';

  const { mutate, isPending } = useMutation({
    mutationFn: () => modelo?.id
      ? api.put(`/configuracoes/modelos/${modelo.id}`, form)
      : api.post('/configuracoes/modelos', form),
    onSuccess: () => {
      qc.invalidateQueries(['modelos-documento']);
      toast.success(modelo?.id ? 'Modelo atualizado!' : 'Modelo criado!');
      onSaved?.();
    },
    onError: () => toast.error('Erro ao salvar modelo.'),
  });

  const inserirVariavel = (tag) => {
    setForm(f => ({ ...f, conteudo: f.conteudo + tag }));
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-5xl rounded-2xl animate-scaleIn my-8"
        style={{ background: 'var(--glass-bg, rgba(10,17,40,.92))', backdropFilter: 'blur(24px) saturate(1.3)', WebkitBackdropFilter: 'blur(24px) saturate(1.3)', border: '1px solid rgba(255,255,255,.1)' }}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <div>
            <h3 className="text-base font-bold">{modelo?.id ? 'Editar Modelo' : 'Novo Modelo de Documento'}</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Use variáveis para personalizar o documento</p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-secondary)' }}>
            <i className="fas fa-xmark text-xl" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                Nome do Modelo *
              </label>
              <input
                className="input-base"
                placeholder="Ex: Petição Inicial"
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                Categoria
              </label>
              <input
                className="input-base"
                placeholder="Ex: Petição, Contrato, Recurso"
                value={form.categoria}
                onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                Conteúdo *
              </label>
              <button
                type="button"
                onClick={() => setShowVars(v => !v)}
                className="btn btn-ghost text-xs py-1 px-3"
              >
                <i className="fas fa-tag text-[10px] mr-1" style={{ color: 'var(--accent)' }} />
                {showVars ? 'Ocultar variáveis' : 'Inserir variável'}
              </button>
            </div>

            {showVars && (
              <div className="flex flex-wrap gap-1.5 mb-3 p-3 rounded-xl" style={{ background: 'rgba(201,168,76,.04)', border: '1px solid rgba(201,168,76,.12)' }}>
                {VARIAVEIS_MODELO.map(v => (
                  <button
                    key={v.tag}
                    type="button"
                    onClick={() => inserirVariavel(v.tag)}
                    className="text-[10px] font-bold px-2 py-1 rounded-lg transition-all hover:opacity-80"
                    style={{ background: 'rgba(201,168,76,.12)', color: '#C9A84C', border: '1px solid rgba(201,168,76,.25)' }}
                    title={v.desc}
                  >
                    {v.tag}
                  </button>
                ))}
              </div>
            )}

            {/* Editor + Preview lado a lado */}
            <div className="flex gap-4 items-start">
              {/* Preview do papel timbrado */}
              <div className="flex-shrink-0" style={{ width: 140 }}>
                <p className="text-[10px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                  <i className="fas fa-eye mr-1" />Prévia PDF
                </p>
                <LetterheadPreview config={config} logoUrl={logoUrl} />
                <div className="mt-2 space-y-1">
                  <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                    Cor: <span className="font-mono font-bold" style={{ color: config.corDocumento || '#1a2544' }}>{config.corDocumento || '#1a2544'}</span>
                  </p>
                  <p className="text-[9px] italic" style={{ color: 'var(--text-muted)' }}>Altere em Dados do Escritório</p>
                </div>
              </div>

              {/* Quill editor */}
              <div className="flex-1 min-w-0">
                <div className="ql-themed rounded-lg overflow-hidden" style={{ minHeight: 500 }}>
                  <ReactQuill
                    theme="snow"
                    value={form.conteudo}
                    onChange={val => setForm(f => ({ ...f, conteudo: val }))}
                    modules={quillModules}
                    style={{ height: 458 }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex gap-3 justify-end" style={{ borderTop: '1px solid rgba(255,255,255,.07)' }}>
          <button onClick={onClose} className="btn btn-ghost">Cancelar</button>
          <button
            onClick={() => mutate()}
            disabled={!form.nome || !form.conteudo || isPending}
            className="btn btn-gold"
          >
            {isPending ? <span className="spinner" /> : <i className="fas fa-floppy-disk" />}
            {modelo?.id ? 'Atualizar' : 'Criar Modelo'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── GerarDocumentoModal ──────────────────────────────────────────
export function GerarDocumentoModal({ modelo, processoPreSelecionado, onClose }) {
  const [processoId, setProcessoId] = useState(processoPreSelecionado?.id || '');
  // Template carregado imediatamente — sem tela de espera
  const [gerado, setGerado] = useState(ensureHtml(modelo.conteudo));
  const [clienteNomeState, setClienteNomeState] = useState('');
  const [notaIdGerada, setNotaIdGerada] = useState(null);
  const [preenchendo, setPreenchendo] = useState(false);
  const filledRef = useRef(false);
  const qc = useQueryClient();

  const notaSalvaMutation = useMutation({
    mutationFn: ({ processoId: pid, titulo, conteudo }) =>
      notaIdGerada
        ? api.put(`/processos/${pid}/anotacoes/${notaIdGerada}`, { titulo, conteudo })
        : api.post(`/processos/${pid}/anotacoes`, { titulo, conteudo }),
    onSuccess: (res) => {
      if (res?.data?.id) setNotaIdGerada(res.data.id);
      qc.invalidateQueries(['processo']);
    }
  });

  const { data: processos = [] } = useQuery({
    queryKey: ['processos-select'],
    queryFn: () => api.get('/processos', { params: { limite: 100 } }).then(r => r.data.processos || []),
    enabled: !processoPreSelecionado,
  });

  const { data: config = {} } = useQuery({
    queryKey: ['configuracoes-escritorio'],
    queryFn: () => api.get('/configuracoes/escritorio').then(r => r.data),
  });

  // Preenche variáveis com dados do escritório + processo opcional
  const preencher = async (idProcesso) => {
    const idParaUsar = idProcesso !== undefined ? idProcesso : (processoPreSelecionado?.id || processoId || '');
    setPreenchendo(true);

    let conteudo = modelo.conteudo;
    const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

    conteudo = conteudo
      .replace(/\{\{escritorio_nome\}\}/g, config.nomeEscritorio || '')
      .replace(/\{\{escritorio_oab\}\}/g,  config.oabEscritorio  || '')
      .replace(/\{\{escritorio_email\}\}/g, config.email          || '')
      .replace(/\{\{escritorio_tel\}\}/g,   config.telefone       || '')
      .replace(/\{\{cidade\}\}/g,           config.cidade         || '')
      .replace(/\{\{data_hoje\}\}/g,        hoje);

    let tempClientName = '';

    if (idParaUsar) {
      try {
        const proc = processoPreSelecionado || (await api.get(`/processos/${idParaUsar}`)).data;
        const cliente = proc.partes?.find(p => p.tipo === 'AUTOR') || proc.partes?.[0];
        const adv     = proc.advogados?.[0];
        if (cliente) { setClienteNomeState(cliente.nome); tempClientName = cliente.nome; }

        conteudo = conteudo
          .replace(/\{\{cliente_nome\}\}/g,   cliente?.nome   || '')
          .replace(/\{\{processo_numero\}\}/g, proc.numeroCnj  || proc.numero || '')
          .replace(/\{\{processo_vara\}\}/g,   proc.vara       || '')
          .replace(/\{\{processo_classe\}\}/g, proc.classe     || '')
          .replace(/\{\{advogado_nome\}\}/g,   adv?.nome       || '')
          .replace(/\{\{advogado_oab\}\}/g,    adv?.oab        || '');

        const cleanClient = tempClientName.replace(/[^a-zA-Z0-9 -]/g, '').trim();
        const titulo = cleanClient ? `${modelo.nome} - ${cleanClient}` : modelo.nome;
        notaSalvaMutation.mutate({ processoId: idParaUsar, titulo: `${titulo}\u200B`, conteudo: ensureHtml(conteudo) });
      } catch {
        toast.error('Erro ao carregar dados do processo.');
      }
    }

    setGerado(ensureHtml(conteudo));
    setPreenchendo(false);
  };

  // Preenche automaticamente com dados do escritório quando config carrega (uma vez)
  useEffect(() => {
    if (filledRef.current || !config || !Object.keys(config).length) return;
    filledRef.current = true;
    preencher(processoPreSelecionado?.id || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const exportarPDF = async () => {
    const { exportarPDFComCabecalho } = await import('../../utils/pdfExport');
    const cleanModelName = modelo.nome.replace(/[^a-zA-Z0-9 -]/g, '').trim();
    const cleanClientName = clienteNomeState ? clienteNomeState.replace(/[^a-zA-Z0-9 -]/g, '').trim() : '';
    const filename = cleanClientName ? `${cleanModelName} - ${cleanClientName}` : cleanModelName;
    await exportarPDFComCabecalho(gerado, filename, { toast });
  };

  const copiar = () => {
    navigator.clipboard.writeText(gerado.replace(/<[^>]+>/g, ''));
    toast.success('Copiado para a área de transferência!');
  };

  const logoUrl = config.logoEscritorio
    ? `${window.location.port === '3000' ? window.location.origin.replace(':3000', ':3001') : window.location.origin}${config.logoEscritorio}`
    : '';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-5xl rounded-2xl animate-scaleIn my-8"
        style={{ background: 'var(--glass-bg, rgba(10,17,40,.92))', backdropFilter: 'blur(24px) saturate(1.3)', WebkitBackdropFilter: 'blur(24px) saturate(1.3)', border: '1px solid rgba(255,255,255,.1)' }}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <div>
            <h3 className="text-base font-bold">Gerar Documento</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--accent)' }}>{modelo.nome}</p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-secondary)' }}>
            <i className="fas fa-xmark text-xl" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Seletor de processo / processo vinculado */}
          {!processoPreSelecionado ? (
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  Vincular processo (opcional)
                </label>
                <select
                  className="input-base"
                  value={processoId}
                  onChange={e => setProcessoId(e.target.value)}
                >
                  <option value="">Nenhum — apenas dados do escritório</option>
                  {processos.map(p => {
                    const cliente = p.partes?.find(x => x.tipo === 'AUTOR') || p.partes?.[0];
                    return (
                      <option key={p.id} value={p.id}>
                        {cliente?.nome || '—'} — {p.numeroCnj || p.numero}
                      </option>
                    );
                  })}
                </select>
              </div>
              <button
                onClick={() => preencher(processoId)}
                disabled={preenchendo}
                className="btn btn-gold flex-shrink-0"
              >
                {preenchendo ? <span className="spinner" /> : <i className="fas fa-wand-magic-sparkles" />}
                Preencher dados
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(201,168,76,.06)', border: '1px solid rgba(201,168,76,.15)' }}>
              <i className="fas fa-scale-balanced text-sm" style={{ color: 'var(--accent)' }} />
              <div className="flex-1">
                <p className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>Processo vinculado</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {processoPreSelecionado.numeroCnj || processoPreSelecionado.numero}
                </p>
              </div>
              <button
                onClick={() => preencher(processoPreSelecionado.id)}
                disabled={preenchendo}
                className="btn btn-ghost text-xs"
              >
                {preenchendo ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <i className="fas fa-rotate" />}
                Repreencher
              </button>
            </div>
          )}

          {/* Editor + Preview lado a lado */}
          <div className="flex gap-4 items-start">
            {/* Preview */}
            <div className="flex-shrink-0" style={{ width: 148 }}>
              <p className="text-[10px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                <i className="fas fa-eye mr-1" />Prévia do PDF
              </p>
              <LetterheadPreview config={config} logoUrl={logoUrl} />
              <div className="mt-2 space-y-1">
                <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                  Cor das bordas:{' '}
                  <span className="font-mono font-bold" style={{ color: config.corDocumento || '#1a2544' }}>
                    {config.corDocumento || '#1a2544'}
                  </span>
                </p>
                <p className="text-[9px] italic" style={{ color: 'var(--text-muted)' }}>Altere em Dados do Escritório</p>
                <div className="flex items-center gap-1 mt-1">
                  <i className="fas fa-check-circle text-[8px]" style={{ color: 'var(--accent)' }} />
                  <span className="text-[8px]" style={{ color: 'var(--text-muted)' }}>Cabeçalho + bordas decorativas</span>
                </div>
                <div className="flex items-center gap-1">
                  <i className="fas fa-check-circle text-[8px]" style={{ color: 'var(--accent)' }} />
                  <span className="text-[8px]" style={{ color: 'var(--text-muted)' }}>Rodapé com barra e site</span>
                </div>
              </div>
            </div>

            {/* Quill editor */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  Conteúdo do documento
                  {preenchendo && (
                    <span className="ml-2 text-[10px] font-normal" style={{ color: 'var(--accent)' }}>
                      <span className="spinner inline-block mr-1" style={{ width: 10, height: 10 }} />
                      Preenchendo...
                    </span>
                  )}
                </label>
                <button onClick={copiar} className="btn btn-ghost text-xs py-1 px-2">
                  <i className="fas fa-copy text-[10px]" /> Copiar texto
                </button>
              </div>
              <div className="ql-themed rounded-lg overflow-hidden" style={{ minHeight: 500 }}>
                <ReactQuill
                  theme="snow"
                  value={gerado}
                  onChange={val => setGerado(val)}
                  modules={quillModules}
                  style={{ height: 458 }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 flex gap-3 justify-end" style={{ borderTop: '1px solid rgba(255,255,255,.07)' }}>
          <button onClick={onClose} className="btn btn-ghost">Fechar</button>
          <button onClick={exportarPDF} className="btn btn-gold">
            <i className="fas fa-download" /> Baixar PDF
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Página principal ─────────────────────────────────────────────
export default function ModelosDocumentos() {
  const qc = useQueryClient();
  const [editando, setEditando] = useState(null);
  const [showNovo, setShowNovo] = useState(false);
  const [gerando, setGerando]   = useState(null);

  const { data: modelos = [], isLoading } = useQuery({
    queryKey: ['modelos-documento'],
    queryFn: () => api.get('/configuracoes/modelos').then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/configuracoes/modelos/${id}`),
    onSuccess: () => { qc.invalidateQueries(['modelos-documento']); toast.success('Modelo excluído.'); },
  });

  const adicionarExemplo = (ex) => {
    setShowNovo(false);
    setEditando({ ...ex, _isExemplo: true });
  };

  return (
    <div className="py-8 px-4 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div
            className="flex items-center justify-center rounded-2xl flex-shrink-0"
            style={{ width: 52, height: 52, background: 'var(--accent-light)', border: '1px solid var(--accent-border)' }}
          >
            <i className="fas fa-file-signature text-xl" style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold">Modelos de Documentos</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {modelos.length} modelo{modelos.length !== 1 ? 's' : ''} cadastrado{modelos.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button onClick={() => setShowNovo(true)} className="btn btn-gold">
          <i className="fas fa-plus" /> Novo Modelo
        </button>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton rounded-2xl h-48" />)}
        </div>
      ) : modelos.length === 0 ? (
        <div className="space-y-6">
          <div className="flex flex-col items-center py-12 gap-3" style={{ color: 'var(--text-muted)' }}>
            <i className="fas fa-file-signature text-5xl" style={{ opacity: .2 }} />
            <p className="text-sm">Nenhum modelo cadastrado.</p>
          </div>
          <div>
            <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
              <i className="fas fa-lightbulb mr-2" style={{ color: 'var(--accent)' }} />
              Comece com um exemplo:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {EXEMPLOS.map(ex => (
                <button key={ex.nome} onClick={() => adicionarExemplo(ex)} className="card card-hover text-left">
                  <div className="flex items-center gap-3 mb-3">
                    <i className="fas fa-file-alt text-xl" style={{ color: 'var(--accent)', opacity: .7 }} />
                    <div>
                      <p className="font-semibold text-sm">{ex.nome}</p>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(201,168,76,.1)', color: '#C9A84C', border: '1px solid rgba(201,168,76,.2)' }}
                      >
                        {ex.categoria}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Clique para usar como base</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {modelos.map(m => (
            <ModeloCard
              key={m.id}
              modelo={m}
              onEdit={setEditando}
              onDelete={id => deleteMutation.mutate(id)}
              onGerar={setGerando}
            />
          ))}
        </div>
      )}

      {/* Modal Novo/Escolher */}
      {showNovo && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className="w-full max-w-lg rounded-2xl animate-scaleIn"
            style={{ background: 'var(--glass-bg, rgba(10,17,40,.92))', backdropFilter: 'blur(24px) saturate(1.3)', WebkitBackdropFilter: 'blur(24px) saturate(1.3)', border: '1px solid rgba(255,255,255,.1)' }}
          >
            <div className="flex justify-between items-center px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
              <h3 className="font-bold">Novo Modelo</h3>
              <button onClick={() => setShowNovo(false)} style={{ color: 'var(--text-secondary)' }}>
                <i className="fas fa-xmark text-xl" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <button
                onClick={() => { setShowNovo(false); setEditando({}); }}
                className="w-full card card-hover flex items-center gap-4 text-left"
              >
                <div className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: 44, height: 44, background: 'var(--accent-light)', border: '1px solid var(--accent-border)' }}>
                  <i className="fas fa-plus" style={{ color: 'var(--accent)' }} />
                </div>
                <div>
                  <p className="font-semibold text-sm">Criar do zero</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Escreva seu próprio modelo</p>
                </div>
              </button>
              <p className="text-xs font-bold uppercase tracking-wider pt-1" style={{ color: 'var(--text-muted)' }}>Ou usar exemplo:</p>
              {EXEMPLOS.map(ex => (
                <button
                  key={ex.nome}
                  onClick={() => adicionarExemplo(ex)}
                  className="w-full card card-hover flex items-center gap-4 text-left"
                >
                  <div className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: 44, height: 44, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)' }}>
                    <i className="fas fa-file-alt" style={{ color: 'var(--text-secondary)' }} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{ex.nome}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{ex.categoria}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Editar/Criar */}
      {editando !== null && (
        <ModeloForm
          modelo={editando?.id ? editando : (editando?._isExemplo ? editando : null)}
          onClose={() => setEditando(null)}
          onSaved={() => setEditando(null)}
        />
      )}

      {/* Modal Gerar Documento */}
      {gerando && (
        <GerarDocumentoModal modelo={gerando} onClose={() => setGerando(null)} />
      )}
    </div>
  );
}
