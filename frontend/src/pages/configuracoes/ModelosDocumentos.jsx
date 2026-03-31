import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../services/api';

export const VARIAVEIS_MODELO = [
  { tag: '{{escritorio_nome}}',   desc: 'Nome do escritório'    },
  { tag: '{{escritorio_oab}}',    desc: 'OAB do escritório'     },
  { tag: '{{escritorio_email}}',  desc: 'E-mail do escritório'  },
  { tag: '{{escritorio_tel}}',    desc: 'Telefone do escritório' },
  { tag: '{{cliente_nome}}',      desc: 'Nome do cliente'       },
  { tag: '{{processo_numero}}',   desc: 'Número do processo'    },
  { tag: '{{processo_vara}}',     desc: 'Vara / Tribunal'       },
  { tag: '{{processo_classe}}',   desc: 'Classe processual'     },
  { tag: '{{advogado_nome}}',     desc: 'Nome do advogado'      },
  { tag: '{{advogado_oab}}',      desc: 'OAB do advogado'       },
  { tag: '{{data_hoje}}',         desc: 'Data de hoje'          },
  { tag: '{{cidade}}',            desc: 'Cidade do escritório'  },
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
        {modelo.conteudo.slice(0, 200)}…
      </p>
    </div>
  );
}

function ModeloForm({ modelo, onClose, onSaved }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    nome:      modelo?.nome      || '',
    categoria: modelo?.categoria || '',
    conteudo:  modelo?.conteudo  || '',
  });
  const [showVars, setShowVars] = useState(false);

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
        className="w-full max-w-3xl rounded-2xl animate-scaleIn my-8"
        style={{ background: '#131a2b', border: '1px solid rgba(255,255,255,.1)' }}
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
                <i className={`fas fa-tag text-[10px] mr-1`} style={{ color: 'var(--accent)' }} />
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

            <textarea
              className="input-base font-mono text-xs"
              rows={20}
              placeholder="Digite o conteúdo do documento..."
              value={form.conteudo}
              onChange={e => setForm(f => ({ ...f, conteudo: e.target.value }))}
              style={{ resize: 'vertical', minHeight: 360 }}
            />
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

export function GerarDocumentoModal({ modelo, processoPreSelecionado, onClose }) {
  const [processoId, setProcessoId] = useState(processoPreSelecionado?.id || '');
  const [gerado, setGerado] = useState('');

  const { data: processos = [] } = useQuery({
    queryKey: ['processos-select'],
    queryFn: () => api.get('/processos', { params: { limite: 100 } }).then(r => r.data.processos || []),
    enabled: !processoPreSelecionado,
  });

  const { data: config = {} } = useQuery({
    queryKey: ['configuracoes-escritorio'],
    queryFn: () => api.get('/configuracoes/escritorio').then(r => r.data),
  });

  const gerar = async () => {
    let conteudo = modelo.conteudo;
    const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

    conteudo = conteudo
      .replace(/\{\{escritorio_nome\}\}/g, config.nomeEscritorio || '')
      .replace(/\{\{escritorio_oab\}\}/g,  config.oabEscritorio  || '')
      .replace(/\{\{escritorio_email\}\}/g, config.email          || '')
      .replace(/\{\{escritorio_tel\}\}/g,   config.telefone       || '')
      .replace(/\{\{cidade\}\}/g,           config.cidade         || '')
      .replace(/\{\{data_hoje\}\}/g,        hoje);

    const idParaUsar = processoPreSelecionado?.id || processoId;
    if (idParaUsar) {
      try {
        const proc = processoPreSelecionado || (await api.get(`/processos/${idParaUsar}`)).data;
        const cliente = proc.partes?.find(p => p.tipo === 'AUTOR') || proc.partes?.[0];
        const adv     = proc.advogados?.[0];
        conteudo = conteudo
          .replace(/\{\{cliente_nome\}\}/g,   cliente?.nome   || '')
          .replace(/\{\{processo_numero\}\}/g, proc.numeroCnj  || proc.numero || '')
          .replace(/\{\{processo_vara\}\}/g,   proc.vara       || '')
          .replace(/\{\{processo_classe\}\}/g, proc.classe     || '')
          .replace(/\{\{advogado_nome\}\}/g,   adv?.nome       || '')
          .replace(/\{\{advogado_oab\}\}/g,    adv?.oab        || '');
      } catch {
        toast.error('Erro ao carregar dados do processo.');
        return;
      }
    }
    setGerado(conteudo);
  };

  const copiar = () => {
    navigator.clipboard.writeText(gerado);
    toast.success('Copiado para a área de transferência!');
  };

  const imprimirPDF = () => {
    const janela = window.open('', '_blank');
    if (!janela) { toast.error('Permita pop-ups para imprimir.'); return; }

    const baseUrl = window.location.origin.replace(':3000', ':3001');
    const logoUrl = config.logoEscritorio ? `${baseUrl}${config.logoEscritorio}` : '';
    const nomeEsc = config.nomeEscritorio || '';
    const oab = config.oabEscritorio || '';
    const endereco = config.endereco || '';
    const cidade = config.cidade || '';
    const telefone = config.telefone || '';
    const email = config.email || '';
    const rodape = config.rodapeDocumento || `${nomeEsc}${oab ? ' — ' + oab : ''}${telefone ? ' — ' + telefone : ''}`;

    const headerHtml = `
      <table class="header-table" width="100%">
        <tr>
          ${logoUrl ? `<td style="width:80px;vertical-align:middle;padding-right:16px;">
            <img src="${logoUrl}" style="max-height:60px;max-width:80px;object-fit:contain;" />
          </td>` : ''}
          <td style="vertical-align:middle;${!logoUrl ? 'text-align:center;' : ''}">
            ${nomeEsc ? `<div style="font-size:14pt;font-weight:bold;color:#1a1a1a;letter-spacing:0.5px;margin-bottom:2px;">${nomeEsc}</div>` : ''}
            ${oab ? `<div style="font-size:9pt;color:#555;font-weight:600;">${oab}</div>` : ''}
            ${endereco || cidade ? `<div style="font-size:8pt;color:#777;margin-top:1px;">${endereco}${endereco && cidade ? ' — ' : ''}${cidade}</div>` : ''}
            ${telefone || email ? `<div style="font-size:8pt;color:#777;">${[telefone, email].filter(Boolean).join(' | ')}</div>` : ''}
          </td>
        </tr>
      </table>
      <div style="border-bottom:2px solid #C9A84C;margin:12px 0 28px 0;"></div>`;

    const footerHtml = rodape ? `<div class="footer">${rodape}</div>` : '';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${modelo.nome}</title>
    <style>
      @page {
        size: A4;
        margin: 2.5cm 2cm 3cm 2cm;
      }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: 'Times New Roman', 'Georgia', serif;
        font-size: 12pt;
        line-height: 1.8;
        color: #1a1a1a;
      }
      .header-table {
        border-collapse: collapse;
      }
      .header-table td {
        border: none;
      }
      .content {
        white-space: pre-wrap;
        word-wrap: break-word;
        text-align: justify;
      }
      .footer {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        text-align: center;
        font-size: 7.5pt;
        color: #999;
        border-top: 1px solid #ddd;
        padding-top: 6px;
        padding-bottom: 4px;
      }
      @media screen {
        body { padding: 2.5cm 2cm; max-width: 21cm; margin: 0 auto; background: #f5f5f5; }
        body > .page-wrapper { background: #fff; padding: 2cm; box-shadow: 0 2px 20px rgba(0,0,0,.1); min-height: 29.7cm; }
      }
    </style></head>
    <body>
      <div class="page-wrapper">
        ${headerHtml}
        <div class="content">${gerado.replace(/\n/g, '<br>')}</div>
      </div>
      ${footerHtml}
    </body></html>`;

    janela.document.write(html);
    janela.document.close();
    // Use setTimeout instead of onload — onload doesn't fire reliably for dynamically written documents
    setTimeout(() => { janela.focus(); janela.print(); }, 400);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-3xl rounded-2xl animate-scaleIn my-8"
        style={{ background: '#131a2b', border: '1px solid rgba(255,255,255,.1)' }}
      >
        <div className="flex justify-between items-center px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <div>
            <h3 className="text-base font-bold">Gerar Documento</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--accent)' }}>{modelo.nome}</p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-secondary)' }}>
            <i className="fas fa-xmark text-xl" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {!processoPreSelecionado && (
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                Vincular processo (opcional)
              </label>
              <select
                className="input-base"
                value={processoId}
                onChange={e => { setProcessoId(e.target.value); setGerado(''); }}
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
          )}

          {processoPreSelecionado && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(201,168,76,.06)', border: '1px solid rgba(201,168,76,.15)' }}
            >
              <i className="fas fa-scale-balanced text-sm" style={{ color: 'var(--accent)' }} />
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>Processo vinculado</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {processoPreSelecionado.numeroCnj || processoPreSelecionado.numero}
                </p>
              </div>
            </div>
          )}

          {!gerado ? (
            <div className="flex flex-col items-center py-10 gap-3" style={{ color: 'var(--text-muted)' }}>
              <i className="fas fa-wand-magic-sparkles text-4xl" style={{ opacity: .3 }} />
              <p className="text-sm">Clique em "Gerar Documento" para preencher automaticamente</p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  Documento gerado
                </label>
                <div className="flex gap-2">
                  <button onClick={copiar} className="btn btn-ghost text-xs py-1.5 px-3">
                    <i className="fas fa-copy" /> Copiar
                  </button>
                  <button onClick={imprimirPDF} className="btn btn-gold text-xs py-1.5 px-3">
                    <i className="fas fa-file-pdf" /> Imprimir PDF
                  </button>
                </div>
              </div>
              <textarea
                className="input-base font-mono text-xs"
                rows={20}
                value={gerado}
                onChange={e => setGerado(e.target.value)}
                style={{ resize: 'vertical', minHeight: 360 }}
              />
            </div>
          )}
        </div>

        <div className="px-6 py-4 flex gap-3 justify-end" style={{ borderTop: '1px solid rgba(255,255,255,.07)' }}>
          <button onClick={onClose} className="btn btn-ghost">Fechar</button>
          <button onClick={gerar} className="btn btn-gold">
            <i className="fas fa-wand-magic-sparkles" /> Gerar Documento
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

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
            style={{ background: '#131a2b', border: '1px solid rgba(255,255,255,.1)' }}
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
