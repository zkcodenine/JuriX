import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { formatarData, formatarTempoRelativo } from '../../../utils/formatters';
import { GerarDocumentoModal } from '../../../pages/configuracoes/ModelosDocumentos';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const quillModules = {
  toolbar: [
    [{ 'font': [] }],
    [{ 'size': ['small', false, 'large', 'huge'] }],
    ['bold', 'italic', 'underline'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'align': [] }],
    ['clean']
  ]
};

/* ─── Helpers ────────────────────────────────────────── */
const extInfo = (arquivo = '') => {
  const ext = arquivo.split('.').pop()?.toLowerCase();
  const map = {
    pdf:  { icon: 'fa-file-pdf',   color: '#ef4444', preview: 'pdf'   },
    doc:  { icon: 'fa-file-word',  color: '#3b82f6', preview: 'none'  },
    docx: { icon: 'fa-file-word',  color: '#3b82f6', preview: 'none'  },
    xlsx: { icon: 'fa-file-excel', color: '#10b981', preview: 'none'  },
    xls:  { icon: 'fa-file-excel', color: '#10b981', preview: 'none'  },
    jpg:  { icon: 'fa-file-image', color: '#f59e0b', preview: 'image' },
    jpeg: { icon: 'fa-file-image', color: '#f59e0b', preview: 'image' },
    png:  { icon: 'fa-file-image', color: '#f59e0b', preview: 'image' },
    txt:  { icon: 'fa-file-lines', color: '#a0a0a0', preview: 'none'  },
  };
  return map[ext] || { icon: 'fa-file', color: '#a0a0a0', preview: 'none' };
};


const MAX_CHARS = 4000;

/* ═══════════════════════════════════════════════════════════
   DocPreviewModal — Full-screen authenticated preview
═══════════════════════════════════════════════════════════ */
function DocPreviewModal({ doc, onClose, onDelete, onRequestDelete, deleteLoading }) {
  const { preview, color, icon } = extInfo(doc.arquivo);
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let revoked = false;
    const fetchFile = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get(`/documentos/${doc.id}/arquivo`, { responseType: 'blob', timeout: 60000 });
        if (revoked) return;
        setBlobUrl(URL.createObjectURL(res.data));
      } catch (err) {
        if (!revoked) setError(err.response?.status === 404 ? 'Arquivo não encontrado.' : 'Erro ao carregar arquivo.');
      } finally {
        if (!revoked) setLoading(false);
      }
    };
    fetchFile();
    return () => { revoked = true; if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [doc.id]);

  const handleDownload = useCallback(() => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = doc.nome;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [blobUrl, doc.nome]);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: 'rgba(0,0,0,.93)', backdropFilter: 'blur(8px)' }}>
      <div className="flex items-center gap-3 px-6 py-4 flex-shrink-0" style={{ background: 'rgba(255,255,255,.02)', borderBottom: '1px solid var(--border)' }}>
        <div className="rounded-lg flex items-center justify-center flex-shrink-0" style={{ width: 36, height: 36, background: `${color}18` }}>
          <i className={`fas ${icon} text-sm`} style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{doc.nome}</p>
          {doc.tamanho && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{(doc.tamanho / 1024 / 1024).toFixed(1)} MB</p>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleDownload} disabled={!blobUrl} className="btn btn-ghost text-sm py-2"><i className="fas fa-download" /> Baixar</button>
          <button onClick={() => onRequestDelete(doc)} disabled={deleteLoading} className="btn btn-ghost text-sm py-2" style={{ color: 'var(--danger)' }}><i className="fas fa-trash" /> Excluir</button>
          <button onClick={onClose} className="flex items-center justify-center rounded-xl hover:opacity-70 transition-opacity" style={{ width: 36, height: 36, background: 'rgba(255,255,255,.03)' }}><i className="fas fa-xmark" style={{ color: 'var(--text-secondary)' }} /></button>
        </div>
      </div>
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        {loading && <div className="flex flex-col items-center gap-3" style={{ color: 'var(--text-muted)' }}><span className="spinner" style={{ width: 32, height: 32 }} /><p className="text-sm">Carregando arquivo...</p></div>}
        {error && <div className="flex flex-col items-center gap-3" style={{ color: 'var(--danger)' }}><i className="fas fa-exclamation-triangle text-3xl" /><p className="text-sm">{error}</p></div>}
        {!loading && !error && blobUrl && preview === 'pdf' && <iframe src={blobUrl} title={doc.nome} style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8 }} />}
        {!loading && !error && blobUrl && preview === 'image' && <img src={blobUrl} alt={doc.nome} style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, objectFit: 'contain' }} />}
        {!loading && !error && preview === 'none' && (
          <div className="flex flex-col items-center gap-4 text-center" style={{ color: 'var(--text-muted)' }}>
            <i className={`fas ${icon} text-6xl`} style={{ color, opacity: .4 }} />
            <p className="text-sm">Prévia indisponível para este formato.<br />Baixe o arquivo para abrir no seu computador.</p>
            <button onClick={handleDownload} disabled={!blobUrl} className="btn btn-gold mt-2"><i className="fas fa-download" /> Baixar arquivo</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   EscolherModeloModal
═══════════════════════════════════════════════════════════ */
function EscolherModeloModal({ processo, onClose }) {
  const [modeloSelecionado, setModeloSelecionado] = useState(null);
  const { data: modelos = [], isLoading } = useQuery({
    queryKey: ['modelos-documento'],
    queryFn: () => api.get('/configuracoes/modelos').then(r => r.data),
    staleTime: 0, refetchOnMount: 'always',
  });

  if (modeloSelecionado) return <GerarDocumentoModal modelo={modeloSelecionado} processoPreSelecionado={processo} onClose={onClose} />;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(8px)' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-2xl animate-scaleIn" style={{ background: 'var(--glass-bg, rgba(10,17,40,.92))', backdropFilter: 'blur(24px) saturate(1.3)', WebkitBackdropFilter: 'blur(24px) saturate(1.3)', border: '1px solid rgba(255,255,255,.1)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div className="flex justify-between items-center px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <div>
            <h3 className="font-bold">Gerar com Modelo</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Escolha um modelo para preencher automaticamente</p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-secondary)' }}><i className="fas fa-xmark text-xl" /></button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="skeleton rounded-xl h-16" />)}</div>
          ) : modelos.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-3" style={{ color: 'var(--text-muted)' }}>
              <i className="fas fa-file-signature text-4xl" style={{ opacity: .2 }} />
              <p className="text-sm text-center">Nenhum modelo cadastrado.</p>
              <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>Crie modelos em <strong>Configurações → Modelos de Documentos</strong></p>
            </div>
          ) : (
            <div className="space-y-2">
              {modelos.map(m => (
                <button key={m.id} onClick={() => setModeloSelecionado(m)} className="w-full card card-hover flex items-center gap-3 text-left">
                  <div className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: 40, height: 40, background: 'var(--accent-light)', border: '1px solid var(--accent-border)' }}>
                    <i className="fas fa-file-signature text-sm" style={{ color: 'var(--accent)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{m.nome}</p>
                    {m.categoria && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(201,168,76,.1)', color: '#C9A84C', border: '1px solid rgba(201,168,76,.2)' }}>{m.categoria}</span>}
                  </div>
                  <i className="fas fa-chevron-right text-xs" style={{ color: 'var(--text-muted)' }} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════
   AdicionarMaterialModal — Unified Add modal (files + notes)
═══════════════════════════════════════════════════════════ */
function AdicionarMaterialModal({ processo, onClose, editNota, onRefresh }) {
  const [abaModal, setAbaModal] = useState(editNota ? 'nota' : 'arquivo');
  const [titulo, setTitulo] = useState(editNota?.titulo || '');
  const [conteudo, setConteudo] = useState(editNota?.conteudo || '');
  const [nomeDocumento, setNomeDocumento] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showDeleteNota, setShowDeleteNota] = useState(false);
  const inputRef = useRef();
  const qc = useQueryClient();

  const charCount = conteudo.length;
  const nearLimit = charCount > MAX_CHARS * 0.85;

  const uploadMutation = useMutation({
    mutationFn: ({ file, displayName }) => {
      const fd = new FormData();
      fd.append('arquivo', file);
      fd.append('processoId', processo.id);
      // nome é apenas metadado de exibição — arquivo físico permanece inalterado
      fd.append('nome', displayName || file.name);
      return api.post('/documentos/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => { qc.invalidateQueries(['processo', processo.id]); },
    onError: () => toast.error('Erro ao enviar documento'),
  });

  const notaMutation = useMutation({
    mutationFn: (form) =>
      editNota?.id
        ? api.put(`/processos/${processo.id}/anotacoes/${editNota.id}`, form)
        : api.post(`/processos/${processo.id}/anotacoes`, form),
    onSuccess: () => {
      qc.invalidateQueries(['processo', processo.id]);
      toast.success(editNota?.id ? 'Nota atualizada!' : 'Nota salva!');
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Erro ao salvar nota.'),
  });

  const deleteNotaMutation = useMutation({
    mutationFn: (id) => api.delete(`/processos/${processo.id}/anotacoes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(['processo', processo.id]);
      toast.success('Nota excluída.');
      onClose();
    },
    onError: () => toast.error('Erro ao excluir nota.'),
  });

  const handleFiles = (files) => {
    const fileList = Array.from(files);
    if (fileList.length > 0) setPendingFile(fileList[0]);
  };

  const removePendingFile = () => {
    setPendingFile(null);
  };

  const handleUploadAll = async () => {
    if (!pendingFile || !nomeDocumento.trim()) return;
    setUploading(true);
    try {
      const ext = '.' + pendingFile.name.split('.').pop();
      const displayName = nomeDocumento.trim().endsWith(ext)
        ? nomeDocumento.trim()
        : nomeDocumento.trim() + ext;
      await uploadMutation.mutateAsync({ file: pendingFile, displayName });
      toast.success('Arquivo enviado!');
      onClose();
    } catch {
      // individual errors handled by mutation
    } finally {
      setUploading(false);
    }
  };

  const handleSaveNota = () => {
    if (!conteudo.trim()) return;
    notaMutation.mutate({ titulo: titulo.trim(), conteudo: conteudo.trim() });
  };

  const baixarNotaPDF = async () => {
    const { exportarPDFComCabecalho } = await import('../../../utils/pdfExport');
    const cleanTitle = (titulo || 'Nota').replace(/[^a-zA-Z0-9 -]/g, '').trim();
    await exportarPDFComCabecalho(conteudo, cleanTitle, { toast });
  };

  const tabs = [
    { id: 'arquivo', label: 'Arquivo', icon: 'fa-file-arrow-up' },
    { id: 'nota', label: 'Anotação', icon: 'fa-pen-nib' },
  ];

  return createPortal(
    <div
      className="animate-fadeIn"
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(8px)', padding: '1rem' }}
    >
      <div
        className="w-full max-w-4xl animate-scaleIn"
        style={{
          background: 'var(--glass-bg, rgba(10,17,40,.92))', backdropFilter: 'blur(24px) saturate(1.3)', WebkitBackdropFilter: 'blur(24px) saturate(1.3)',
          border: '1px solid rgba(255,255,255,.1)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-gold)',
          maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: 'rgba(201,168,76,.12)', border: '1px solid var(--accent-border)' }}>
              <i className="fas fa-plus" style={{ color: 'var(--accent)', fontSize: 16 }} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>
                {editNota?.id ? 'Editar Nota' : 'Adicionar Material'}
              </h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {editNota?.id ? 'Atualize o conteúdo desta nota' : 'Envie arquivos ou crie notas jurídicas'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '0.4rem 0.5rem' }}><i className="fas fa-xmark" /></button>
        </div>

        {/* Tab switcher */}
        {!editNota?.id && (
          <div className="flex gap-1 mx-6 mt-4 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,.04)' }}>
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setAbaModal(t.id)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: abaModal === t.id ? 'rgba(201,168,76,.12)' : 'transparent',
                  color: abaModal === t.id ? 'var(--accent)' : 'var(--text-secondary)',
                  border: abaModal === t.id ? '1px solid rgba(201,168,76,.2)' : '1px solid transparent',
                }}
              >
                <i className={`fas ${t.icon} text-xs`} />
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* ── Arquivo Tab ── */}
          {abaModal === 'arquivo' && (
            <>
              {/* Passo 1 — Nome do documento (antes do anexo) */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  <span
                    className="inline-flex items-center justify-center rounded-full mr-1.5"
                    style={{ width: 16, height: 16, background: 'rgba(201,168,76,.15)', color: 'var(--accent)', fontSize: 9, fontWeight: 800 }}
                  >1</span>
                  Nome do documento <span style={{ color: 'var(--accent)' }}>*</span>
                </label>
                <input
                  className="input-base"
                  style={{ fontSize: '0.875rem' }}
                  placeholder="Ex: Contrato de Prestação de Serviços"
                  value={nomeDocumento}
                  onChange={e => setNomeDocumento(e.target.value)}
                  autoFocus
                />
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  Este será o nome exibido no sistema. O arquivo original não será renomeado.
                </p>
              </div>

              {/* Passo 2 — Anexar arquivo */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  <span
                    className="inline-flex items-center justify-center rounded-full mr-1.5"
                    style={{
                      width: 16, height: 16,
                      background: nomeDocumento.trim() ? 'rgba(201,168,76,.15)' : 'rgba(255,255,255,.05)',
                      color: nomeDocumento.trim() ? 'var(--accent)' : 'var(--text-muted)',
                      fontSize: 9, fontWeight: 800,
                    }}
                  >2</span>
                  Anexar arquivo <span style={{ color: 'var(--accent)' }}>*</span>
                </label>

                {!pendingFile ? (
                  <div
                    className="rounded-xl border-2 border-dashed p-8 text-center transition-all"
                    style={{
                      borderColor: 'var(--border)',
                      color: 'var(--text-muted)',
                      cursor: nomeDocumento.trim() ? 'pointer' : 'not-allowed',
                      opacity: nomeDocumento.trim() ? 1 : 0.5,
                    }}
                    onClick={() => { if (nomeDocumento.trim()) inputRef.current?.click(); }}
                    onDragOver={e => { if (!nomeDocumento.trim()) return; e.preventDefault(); e.currentTarget.style.borderColor = '#C9A84C'; e.currentTarget.style.background = 'rgba(201,168,76,.04)'; }}
                    onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'transparent'; }}
                    onDrop={e => {
                      e.preventDefault();
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.background = 'transparent';
                      if (nomeDocumento.trim()) handleFiles(e.dataTransfer.files);
                    }}
                  >
                    <i className="fas fa-cloud-arrow-up text-3xl mb-3 block" style={{ color: nomeDocumento.trim() ? 'var(--accent)' : 'var(--text-muted)' }} />
                    <p className="text-sm font-medium">
                      {nomeDocumento.trim()
                        ? <>Arraste o arquivo aqui ou <span style={{ color: 'var(--accent)' }}>clique para selecionar</span></>
                        : <>Informe o nome do documento acima para anexar o arquivo</>}
                    </p>
                    <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>PDF, DOC, XLSX, JPG, PNG — máx. 50MB</p>
                  </div>
                ) : (
                  (() => {
                    const { icon, color } = extInfo(pendingFile.name);
                    const sizeMB = (pendingFile.size / 1024 / 1024).toFixed(1);
                    return (
                      <div className="rounded-xl p-3 animate-fadeIn" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)' }}>
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, background: `${color}18` }}>
                            <i className={`fas ${icon} text-base`} style={{ color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{pendingFile.name}</p>
                            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{sizeMB} MB · arquivo original preservado</p>
                          </div>
                          <button onClick={removePendingFile} className="text-xs hover:opacity-70 transition-opacity p-1.5 rounded-lg" style={{ color: 'var(--danger)' }} title="Remover">
                            <i className="fas fa-xmark" />
                          </button>
                        </div>
                      </div>
                    );
                  })()
                )}

                <input
                  ref={inputRef}
                  type="file"
                  className="hidden"
                  onChange={e => handleFiles(e.target.files)}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.txt"
                />
              </div>
            </>
          )}

          {/* ── Nota Tab ── */}
          {abaModal === 'nota' && (
            <>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Título <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>(opcional)</span>
                </label>
                <input
                  className="input-base"
                  style={{ fontSize: '0.875rem' }}
                  placeholder="Título da nota jurídica..."
                  value={titulo}
                  onChange={e => setTitulo(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                    Conteúdo <span style={{ color: 'var(--accent)' }}>*</span>
                  </label>
                  <span className="text-[10px]" style={{ color: nearLimit ? (charCount >= MAX_CHARS ? '#ef4444' : '#f59e0b') : 'var(--text-muted)', fontWeight: nearLimit ? 600 : 400 }}>
                    {charCount.toLocaleString('pt-BR')} / {MAX_CHARS.toLocaleString('pt-BR')}
                  </span>
                </div>
                <div className="ql-themed rounded-lg overflow-hidden mt-1 pb-10" style={{ minHeight: 280 }}>
                  <ReactQuill
                    theme="snow"
                    value={conteudo}
                    onChange={val => setConteudo(val)}
                    modules={quillModules}
                    style={{ height: 238 }}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,.02)' }}>
          <div>
            {editNota?.id && (
              <button
                onClick={() => setShowDeleteNota(true)}
                disabled={deleteNotaMutation.isPending}
                className="btn btn-danger text-xs"
              >
                <i className="fas fa-trash" /> Excluir
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-ghost text-sm">Cancelar</button>
            {abaModal === 'arquivo' ? (
              <button
                onClick={handleUploadAll}
                disabled={!pendingFile || !nomeDocumento.trim() || uploading}
                className="btn btn-gold text-sm"
              >
                {uploading
                  ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Enviando...</>
                  : <><i className="fas fa-upload" /> Enviar arquivo</>}
              </button>
            ) : (
              <>
                {editNota?.id && (
                  <button onClick={baixarNotaPDF} className="btn btn-ghost text-sm mr-1">
                    <i className="fas fa-download" /> Baixar PDF
                  </button>
                )}
                <button onClick={handleSaveNota} disabled={!conteudo.trim() || notaMutation.isPending} className="btn btn-gold text-sm">
                  {notaMutation.isPending ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Salvando...</> : <><i className="fas fa-floppy-disk" /> {editNota?.id ? 'Atualizar' : 'Salvar'}</>}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Confirm delete nota */}
      {showDeleteNota && (
        <ConfirmDeleteModal
          title="Excluir esta nota?"
          message="Esta ação não pode ser desfeita."
          onConfirm={() => deleteNotaMutation.mutate(editNota.id)}
          onCancel={() => setShowDeleteNota(false)}
          loading={deleteNotaMutation.isPending}
        />
      )}
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════
   RenameDocModal — Inline rename popup
═══════════════════════════════════════════════════════════ */
function RenameDocModal({ doc, onClose }) {
  const [nome, setNome] = useState(doc.nome.replace(/\.[^.]+$/, ''));
  const ext = '.' + doc.nome.split('.').pop();
  const qc = useQueryClient();

  const renameMutation = useMutation({
    mutationFn: () => api.put(`/documentos/${doc.id}`, { nome: nome.trim() + ext }),
    onSuccess: () => {
      qc.invalidateQueries(['processo']);
      toast.success('Nome atualizado!');
      onClose();
    },
    onError: () => toast.error('Erro ao renomear.'),
  });

  return createPortal(
    <div className="animate-fadeIn" onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(8px)', padding: '1rem' }}>
      <div className="w-full max-w-sm animate-scaleIn rounded-2xl" style={{ background: 'var(--glass-bg, rgba(10,17,40,.92))', backdropFilter: 'blur(24px) saturate(1.3)', WebkitBackdropFilter: 'blur(24px) saturate(1.3)', border: '1px solid rgba(255,255,255,.1)', overflow: 'hidden' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 className="font-bold text-sm">Renomear arquivo</h3>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-1">
            <input
              className="input-base text-sm flex-1"
              value={nome}
              onChange={e => setNome(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && nome.trim() && renameMutation.mutate()}
              autoFocus
            />
            <span className="text-xs flex-shrink-0 px-1" style={{ color: 'var(--text-muted)' }}>{ext}</span>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3" style={{ borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,.02)' }}>
          <button onClick={onClose} className="btn btn-ghost text-sm">Cancelar</button>
          <button onClick={() => renameMutation.mutate()} disabled={!nome.trim() || renameMutation.isPending} className="btn btn-gold text-sm">
            {renameMutation.isPending ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <><i className="fas fa-check" /> Salvar</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════
   TabDocumentos — Main unified tab (Docs + Notes)
═══════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════
   NotaViewModal — Read-only view with Edit button
═══════════════════════════════════════════════════════════ */
function NotaViewModal({ nota, onClose, onEdit, onDelete, onRequestDelete, deleteLoading }) {
  const baixarPDF = async () => {
    const { exportarPDFComCabecalho } = await import('../../../utils/pdfExport');
    const cleanTitle = (nota.titulo || 'Nota').replace(/[^a-zA-Z0-9 -]/g, '').trim();
    await exportarPDFComCabecalho(nota.conteudo, cleanTitle, { toast });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex flex-col"
      style={{ background: 'rgba(0,0,0,.93)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="flex items-center gap-3 px-6 py-4 flex-shrink-0" style={{ background: 'rgba(255,255,255,.02)', borderBottom: '1px solid var(--border)' }}>
        <div className="rounded-lg flex items-center justify-center flex-shrink-0" style={{ width: 36, height: 36, background: 'rgba(201,168,76,.1)' }}>
          <i className="fas fa-pen-nib text-sm" style={{ color: 'var(--accent)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{nota.titulo || 'Nota sem título'}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatarTempoRelativo(nota.atualizadoEm)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { onClose(); onEdit(nota); }} className="btn btn-ghost text-sm py-2"><i className="fas fa-pen" /> Editar</button>
          <button onClick={baixarPDF} className="btn btn-ghost text-sm py-2"><i className="fas fa-download" /> PDF</button>
          <button
            onClick={() => onRequestDelete(nota)}
            disabled={deleteLoading}
            className="btn btn-ghost text-sm py-2"
            style={{ color: 'var(--danger)' }}
          >
            <i className="fas fa-trash" /> Excluir
          </button>
          <button onClick={onClose} className="flex items-center justify-center rounded-xl hover:opacity-70 transition-opacity" style={{ width: 36, height: 36, background: 'rgba(255,255,255,.03)' }}>
            <i className="fas fa-xmark" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto flex justify-center p-6">
        <div
          className="w-full max-w-3xl rounded-2xl p-8"
          style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', minHeight: 400, border: '1px solid var(--border)' }}
        >
          <div
            className="prose prose-sm max-w-none"
            style={{ fontFamily: 'inherit', fontSize: '14px', lineHeight: 1.7 }}
            dangerouslySetInnerHTML={{ __html: nota.conteudo || '<p style="color:#999">Nota vazia</p>' }}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─── ConfirmDeleteModal ─────────────────────────── */
function ConfirmDeleteModal({ title, message, onConfirm, onCancel, loading }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,.88)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden animate-scaleIn text-center"
        style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(24px) saturate(1.3)', WebkitBackdropFilter: 'blur(24px) saturate(1.3)', border: '1px solid var(--border)' }}
      >
        <div className="p-6">
          <div className="flex items-center justify-center rounded-2xl mx-auto mb-4" style={{ width: 52, height: 52, background: 'rgba(239,68,68,.1)' }}>
            <i className="fas fa-trash text-lg" style={{ color: 'var(--danger)' }} />
          </div>
          <h3 className="text-sm font-bold mb-1">{title}</h3>
          {message && <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>{message}</p>}
          <div className="flex gap-3 mt-4">
            <button onClick={onCancel} className="btn btn-ghost flex-1 text-sm">Cancelar</button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="btn flex-1 text-sm font-semibold"
              style={{ background: 'var(--danger)', color: '#fff' }}
            >
              {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <i className="fas fa-trash" />}
              Excluir
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function TabDocumentos({ processo }) {
  const [docAberto, setDocAberto] = useState(null);
  const [showModelos, setShowModelos] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editNota, setEditNota] = useState(null);
  const [viewNota, setViewNota] = useState(null);
  const [renameDoc, setRenameDoc] = useState(null);
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState(null); // doc object
  const [confirmDeleteNota, setConfirmDeleteNota] = useState(null); // nota object
  const qc = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/documentos/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(['processo', processo.id]);
      toast.success('Documento excluído.');
      setDocAberto(null);
      setConfirmDeleteDoc(null);
    },
  });

  const deleteNotaMut = useMutation({
    mutationFn: (id) => api.delete(`/processos/${processo.id}/anotacoes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(['processo', processo.id]);
      toast.success('Nota excluída.');
      setViewNota(null);
      setConfirmDeleteNota(null);
    },
    onError: () => toast.error('Erro ao excluir nota.'),
  });

  const docs = processo.documentos || [];
  const anotacoes = processo.anotacoes || [];

  // Build unified list (sem filtro — exibe todos)
  const items = [];
  docs.forEach(d => items.push({ type: 'doc', data: d, date: new Date(d.criadoEm) }));
  anotacoes.forEach(a => {
    if (a.titulo && a.titulo.endsWith('\u200B')) {
      items.push({ type: 'doc_gerado', data: a, date: new Date(a.criadoEm) });
    } else {
      items.push({ type: 'nota', data: a, date: new Date(a.criadoEm) });
    }
  });
  items.sort((a, b) => b.date - a.date);

  return (
    <div>
      {/* ── Toolbar ── */}
      <div className="flex justify-between items-center mb-5 gap-3 flex-wrap">
        <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
          {items.length} {items.length === 1 ? 'item' : 'itens'}
        </span>
        <div className="flex gap-2">
          <button onClick={() => setShowModelos(true)} className="btn btn-ghost text-xs py-2">
            <i className="fas fa-wand-magic-sparkles" style={{ color: 'var(--accent)' }} /> Modelo
          </button>
          <button onClick={() => { setEditNota(null); setShowAddModal(true); }} className="btn btn-gold text-xs py-2">
            <i className="fas fa-plus" /> Adicionar
          </button>
        </div>
      </div>

      {/* ── Empty ── */}
      {items.length === 0 && (
        <div className="flex flex-col items-center py-12 gap-3 animate-fadeIn" style={{ color: 'var(--text-muted)' }}>
          <div className="flex items-center justify-center rounded-2xl" style={{ width: 64, height: 64, background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)' }}>
            <i className="fas fa-folder-open text-2xl" style={{ opacity: .3 }} />
          </div>
          <p className="text-sm">Nenhum material encontrado.</p>
          <button onClick={() => setShowAddModal(true)} className="btn btn-gold text-sm mt-1">
            <i className="fas fa-plus" /> Adicionar Material
          </button>
        </div>
      )}

      {/* ── Unified list ── */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item, i) => {
            if (item.type === 'doc' || item.type === 'doc_gerado') {
              const isGerado = item.type === 'doc_gerado';
              const doc = item.data;
              const { icon, color } = isGerado 
                ? { icon: 'fa-file-signature', color: '#10b981' } 
                : extInfo(doc.arquivo);
              const tamanhoMB = doc.tamanho ? (doc.tamanho / 1024 / 1024).toFixed(1) : null;
              
              const displayNome = isGerado ? doc.titulo.replace('\u200B', '') : doc.nome;

              return (
                <div
                  key={`${item.type}-${doc.id}`}
                  className="flex items-center gap-3 rounded-xl p-3.5 transition-all animate-fadeIn group"
                  style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)', animationDelay: `${i * 25}ms`, cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,.2)'; e.currentTarget.style.background = 'rgba(201,168,76,.03)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'rgba(255,255,255,.03)'; }}
                  onClick={() => isGerado ? (setEditNota(doc), setShowAddModal(true)) : setDocAberto(doc)}
                >
                  <div className="rounded-lg flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, background: `${color}15` }}>
                    <i className={`fas ${icon} text-sm`} style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{displayNome}</p>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {tamanhoMB ? `${tamanhoMB} MB · ` : ''}{formatarData(doc.criadoEm)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!isGerado && (
                      <button
                        onClick={e => { e.stopPropagation(); setRenameDoc(doc); }}
                        className="p-1.5 rounded-lg transition-all hover:bg-white/5"
                        title="Renomear"
                      >
                        <i className="fas fa-pen text-[10px]" style={{ color: 'var(--text-muted)' }} />
                      </button>
                    )}
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: `${color}12`, color, border: `1px solid ${color}25`, flexShrink: 0 }}>
                    {isGerado ? 'GERADO' : doc.arquivo?.split('.').pop()?.toUpperCase()}
                  </span>
                </div>
              );
            } else {
              const nota = item.data;
              return (
                <div
                  key={`nota-${nota.id}`}
                  className="rounded-xl p-3.5 cursor-pointer transition-all animate-fadeIn group"
                  style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)', animationDelay: `${i * 25}ms`, position: 'relative' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,.2)'; e.currentTarget.style.background = 'rgba(201,168,76,.03)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'rgba(255,255,255,.03)'; }}
                  onClick={() => setViewNota(nota)}
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, background: 'rgba(201,168,76,.1)' }}>
                      <i className="fas fa-pen-nib text-sm" style={{ color: 'var(--accent)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: nota.titulo ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {nota.titulo || 'Nota sem título'}
                      </p>
                      <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                        {nota.conteudo?.replace(/<[^>]+>/g, '').slice(0, 80)}{nota.conteudo?.replace(/<[^>]+>/g, '').length > 80 ? '...' : ''}
                      </p>
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(201,168,76,.08)', color: 'var(--accent)', border: '1px solid rgba(201,168,76,.15)' }}>
                      NOTA
                    </span>
                  </div>
                  <div className="flex items-center mt-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      <i className="fas fa-clock mr-1" />{formatarTempoRelativo(nota.atualizadoEm)}
                    </span>
                  </div>
                </div>
              );
            }
          })}
        </div>
      )}

      {/* ── Modals ── */}
      {docAberto && createPortal(
        <DocPreviewModal
          doc={docAberto}
          onClose={() => setDocAberto(null)}
          onDelete={(id) => deleteMutation.mutate(id)}
          onRequestDelete={(doc) => setConfirmDeleteDoc(doc)}
          deleteLoading={deleteMutation.isPending}
        />,
        document.body
      )}
      {confirmDeleteDoc && (
        <ConfirmDeleteModal
          title={`Excluir "${confirmDeleteDoc.nome}"?`}
          message="O arquivo será removido permanentemente."
          onConfirm={() => deleteMutation.mutate(confirmDeleteDoc.id)}
          onCancel={() => setConfirmDeleteDoc(null)}
          loading={deleteMutation.isPending}
        />
      )}
      {confirmDeleteNota && (
        <ConfirmDeleteModal
          title={`Excluir "${confirmDeleteNota.titulo || 'esta nota'}"?`}
          message="A nota será removida permanentemente."
          onConfirm={() => deleteNotaMut.mutate(confirmDeleteNota.id)}
          onCancel={() => setConfirmDeleteNota(null)}
          loading={deleteNotaMut.isPending}
        />
      )}
      {showModelos && <EscolherModeloModal processo={processo} onClose={() => setShowModelos(false)} />}
      {showAddModal && (
        <AdicionarMaterialModal
          processo={processo}
          onClose={() => { setShowAddModal(false); setEditNota(null); }}
          editNota={editNota}
        />
      )}
      {renameDoc && <RenameDocModal doc={renameDoc} onClose={() => setRenameDoc(null)} />}
      {viewNota && (
        <NotaViewModal
          nota={viewNota}
          onClose={() => setViewNota(null)}
          onEdit={(nota) => { setViewNota(null); setEditNota(nota); setShowAddModal(true); }}
          onDelete={(id) => deleteNotaMut.mutate(id)}
          onRequestDelete={(nota) => { setViewNota(null); setConfirmDeleteNota(nota); }}
          deleteLoading={deleteNotaMut.isPending}
        />
      )}
    </div>
  );
}
