import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { formatarData } from '../../../utils/formatters';
import { GerarDocumentoModal } from '../../../pages/configuracoes/ModelosDocumentos';

const BASE_URL = 'http://localhost:3001';

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

function EscolherModeloModal({ processo, onClose }) {
  const [modeloSelecionado, setModeloSelecionado] = useState(null);

  const { data: modelos = [], isLoading } = useQuery({
    queryKey: ['modelos-documento'],
    queryFn: () => api.get('/configuracoes/modelos').then(r => r.data),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  if (modeloSelecionado) {
    return (
      <GerarDocumentoModal
        modelo={modeloSelecionado}
        processoPreSelecionado={processo}
        onClose={onClose}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-2xl animate-scaleIn"
        style={{ background: '#131a2b', border: '1px solid rgba(255,255,255,.1)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="flex justify-between items-center px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <div>
            <h3 className="font-bold">Gerar com Modelo</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Escolha um modelo para preencher automaticamente</p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-secondary)' }}>
            <i className="fas fa-xmark text-xl" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="skeleton rounded-xl h-16" />)}
            </div>
          ) : modelos.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-3" style={{ color: 'var(--text-muted)' }}>
              <i className="fas fa-file-signature text-4xl" style={{ opacity: .2 }} />
              <p className="text-sm text-center">Nenhum modelo cadastrado.</p>
              <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                Crie modelos em <strong>Configurações → Modelos de Documentos</strong>
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {modelos.map(m => (
                <button
                  key={m.id}
                  onClick={() => setModeloSelecionado(m)}
                  className="w-full card card-hover flex items-center gap-3 text-left"
                >
                  <div
                    className="flex items-center justify-center rounded-xl flex-shrink-0"
                    style={{ width: 40, height: 40, background: 'var(--accent-light)', border: '1px solid var(--accent-border)' }}
                  >
                    <i className="fas fa-file-signature text-sm" style={{ color: 'var(--accent)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{m.nome}</p>
                    {m.categoria && (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(201,168,76,.1)', color: '#C9A84C', border: '1px solid rgba(201,168,76,.2)' }}
                      >
                        {m.categoria}
                      </span>
                    )}
                  </div>
                  <i className="fas fa-chevron-right text-xs" style={{ color: 'var(--text-muted)' }} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TabDocumentos({ processo }) {
  const [uploading, setUploading]       = useState(false);
  const [docAberto, setDocAberto]       = useState(null);
  const [showModelos, setShowModelos]   = useState(false);
  const inputRef = useRef();
  const qc = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: (file) => {
      const fd = new FormData();
      fd.append('arquivo', file);
      fd.append('processoId', processo.id);
      fd.append('nome', file.name);
      return api.post('/documentos/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess:  () => { qc.invalidateQueries(['processo', processo.id]); toast.success('Documento enviado!'); },
    onError:    () => toast.error('Erro ao enviar documento'),
    onSettled:  () => setUploading(false),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/documentos/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(['processo', processo.id]);
      toast.success('Documento excluído.');
      setDocAberto(null);
    },
  });

  const handleFiles = (files) => {
    Array.from(files).forEach(f => { setUploading(true); uploadMutation.mutate(f); });
  };

  const docs = processo.documentos || [];

  return (
    <div>
      {/* Toolbar */}
      <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {docs.length} documento{docs.length !== 1 ? 's' : ''}
        </span>
        <div className="flex gap-2">
          <button onClick={() => setShowModelos(true)} className="btn btn-ghost text-sm py-2">
            <i className="fas fa-wand-magic-sparkles" style={{ color: 'var(--accent)' }} /> Gerar com Modelo
          </button>
          <button onClick={() => inputRef.current?.click()} className="btn btn-gold text-sm py-2">
            <i className="fas fa-upload" /> Enviar arquivo
          </button>
        </div>
        <input
          ref={inputRef} type="file" multiple className="hidden"
          onChange={e => handleFiles(e.target.files)}
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.txt"
        />
      </div>

      {/* Drag & drop */}
      <div
        className="rounded-xl border-2 border-dashed p-6 mb-5 text-center cursor-pointer transition-all"
        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#C9A84C'; }}
        onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        onDrop={e => {
          e.preventDefault();
          e.currentTarget.style.borderColor = 'var(--border)';
          handleFiles(e.dataTransfer.files);
        }}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2">
            <span className="spinner" style={{ width: 18, height: 18 }} />
            <span className="text-sm">Enviando...</span>
          </div>
        ) : (
          <>
            <i className="fas fa-cloud-arrow-up text-3xl mb-2 block" style={{ color: 'var(--accent)' }} />
            <p className="text-sm">
              Arraste arquivos aqui ou <span style={{ color: 'var(--accent)' }}>clique para selecionar</span>
            </p>
            <p className="text-xs mt-1">PDF, DOC, XLSX, JPG, PNG — máx. 50MB</p>
          </>
        )}
      </div>

      {/* Lista */}
      {docs.length === 0 ? (
        <div className="flex flex-col items-center py-8 gap-2" style={{ color: 'var(--text-muted)' }}>
          <i className="fas fa-folder-open text-3xl" style={{ opacity: .2 }} />
          <p className="text-sm">Nenhum documento enviado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc, i) => {
            const { icon, color } = extInfo(doc.arquivo);
            const tamanhoMB = doc.tamanho ? (doc.tamanho / 1024 / 1024).toFixed(1) : null;
            const ativo = docAberto?.id === doc.id;
            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 rounded-xl p-3.5 cursor-pointer transition-all animate-fadeIn"
                style={{
                  background: 'var(--bg-tertiary)',
                  border: `1px solid ${ativo ? 'rgba(201,168,76,.5)' : 'var(--border)'}`,
                  animationDelay: `${i * 30}ms`,
                }}
                onClick={() => setDocAberto(ativo ? null : doc)}
              >
                <div
                  className="rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ width: 40, height: 40, background: `${color}18` }}
                >
                  <i className={`fas ${icon} text-sm`} style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.nome}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {tamanhoMB ? `${tamanhoMB} MB • ` : ''}{formatarData(doc.criadoEm)}
                  </p>
                </div>
                <i
                  className={`fas fa-chevron-${ativo ? 'up' : 'down'} text-xs`}
                  style={{ color: 'var(--text-muted)', transition: 'transform .2s' }}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de visualização */}
      {docAberto && createPortal((() => {
        const { preview, color, icon } = extInfo(docAberto.arquivo);
        const url = `${BASE_URL}${docAberto.arquivo}`;
        return (
          <div
            className="fixed inset-0 z-[9999] flex flex-col"
            style={{ background: 'rgba(0,0,0,.93)', backdropFilter: 'blur(8px)' }}
          >
            <div
              className="flex items-center gap-3 px-6 py-4 flex-shrink-0"
              style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}
            >
              <div
                className="rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ width: 36, height: 36, background: `${color}18` }}
              >
                <i className={`fas ${icon} text-sm`} style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{docAberto.nome}</p>
                {docAberto.tamanho && (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {(docAberto.tamanho / 1024 / 1024).toFixed(1)} MB
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <a href={url} download={docAberto.nome} className="btn btn-ghost text-sm py-2">
                  <i className="fas fa-download" /> Baixar
                </a>
                <button
                  onClick={() => window.confirm(`Excluir "${docAberto.nome}"?`) && deleteMutation.mutate(docAberto.id)}
                  disabled={deleteMutation.isPending}
                  className="btn btn-ghost text-sm py-2"
                  style={{ color: 'var(--danger)' }}
                >
                  <i className="fas fa-trash" /> Excluir
                </button>
                <button
                  onClick={() => setDocAberto(null)}
                  className="flex items-center justify-center rounded-xl hover:opacity-70 transition-opacity"
                  style={{ width: 36, height: 36, background: 'var(--bg-tertiary)' }}
                >
                  <i className="fas fa-xmark" style={{ color: 'var(--text-secondary)' }} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto flex items-center justify-center p-4">
              {preview === 'pdf' && (
                <iframe
                  src={url}
                  title={docAberto.nome}
                  style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8 }}
                />
              )}
              {preview === 'image' && (
                <img
                  src={url}
                  alt={docAberto.nome}
                  style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, objectFit: 'contain' }}
                />
              )}
              {preview === 'none' && (
                <div className="flex flex-col items-center gap-4 text-center" style={{ color: 'var(--text-muted)' }}>
                  <i className={`fas ${icon} text-6xl`} style={{ color, opacity: .4 }} />
                  <p className="text-sm">
                    Prévia indisponível para este formato.<br />
                    Baixe o arquivo para abrir no seu computador.
                  </p>
                  <a href={url} download={docAberto.nome} className="btn btn-gold mt-2">
                    <i className="fas fa-download" /> Baixar arquivo
                  </a>
                </div>
              )}
            </div>
          </div>
        );
      })(), document.body)}

      {/* Modal Gerar com Modelo */}
      {showModelos && createPortal(
        <EscolherModeloModal
          processo={processo}
          onClose={() => setShowModelos(false)}
        />,
        document.body
      )}
    </div>
  );
}
