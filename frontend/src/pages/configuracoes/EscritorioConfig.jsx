import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../services/api';

const BASE_URL = 'http://localhost:3001';

const camposConfig = [
  { key: 'nomeEscritorio',  label: 'Nome do Escritório',   placeholder: 'Ex: Silva & Associados Advocacia', icon: 'fa-building'     },
  { key: 'lemaEscritorio',  label: 'Lema do Escritório',   placeholder: 'Ex: Advocacia & Consultoria Jurídica', icon: 'fa-quote-right' },
  { key: 'cnpj',            label: 'CNPJ',                 placeholder: '00.000.000/0001-00',               icon: 'fa-id-card'      },
  { key: 'oabEscritorio',   label: 'OAB do Escritório',    placeholder: 'OAB/SP 0000',                      icon: 'fa-gavel'        },
  { key: 'telefone',        label: 'Telefone',             placeholder: '(00) 00000-0000',                  icon: 'fa-phone'        },
  { key: 'email',           label: 'E-mail',               placeholder: 'contato@escritorio.com.br',        icon: 'fa-envelope'     },
  { key: 'site',            label: 'Site',                 placeholder: 'www.escritorio.com.br',            icon: 'fa-globe'        },
  { key: 'endereco',        label: 'Endereço',             placeholder: 'Rua, número, bairro',              icon: 'fa-location-dot' },
  { key: 'cidade',          label: 'Cidade / Estado',      placeholder: 'São Paulo - SP',                   icon: 'fa-city'         },
  { key: 'cep',             label: 'CEP',                  placeholder: '00000-000',                        icon: 'fa-map-pin'      },
];

export default function EscritorioConfig() {
  const [form, setForm] = useState({});
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['configuracoes-escritorio'],
    queryFn: () => api.get('/configuracoes/escritorio').then(r => r.data),
    staleTime: 0,
  });

  useEffect(() => {
    if (data) {
      const initialForm = {};
      camposConfig.forEach(c => { initialForm[c.key] = data[c.key] || ''; });
      initialForm.rodapeDocumento = data.rodapeDocumento || '';
      initialForm.corDocumento    = data.corDocumento    || '#1a2544';
      setForm(initialForm);
    }
  }, [data]);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      await api.post('/configuracoes/escritorio/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      qc.invalidateQueries(['configuracoes-escritorio']);
      toast.success('Logo atualizada!');
    } catch {
      toast.error('Erro ao enviar logo.');
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  };

  const { mutate: salvar, isPending: salvando } = useMutation({
    mutationFn: () => api.put('/configuracoes/escritorio', form),
    onSuccess: () => {
      qc.invalidateQueries(['configuracoes-escritorio']);
      toast.success('Dados do escritório salvos!');
    },
    onError: () => toast.error('Erro ao salvar dados.'),
  });

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <div
          className="flex items-center justify-center rounded-2xl flex-shrink-0"
          style={{ width: 52, height: 52, background: 'var(--accent-light)', border: '1px solid var(--accent-border)' }}
        >
          <i className="fas fa-building text-xl" style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold">Dados do Escritório</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Informações usadas para gerar documentos e cabeçalhos
          </p>
        </div>
      </div>

      <div className="card space-y-5">
        <h2 className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
          <i className="fas fa-info-circle mr-2" style={{ color: 'var(--accent)' }} />
          Identificação
        </h2>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {camposConfig.slice(0, 3).map(({ key, label, placeholder, icon }) => (
              <div key={key}>
                <label className="flex items-center gap-2 text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  <i className={`fas ${icon} text-[10px]`} style={{ color: 'var(--accent)' }} />
                  {label}
                </label>
                <input
                  className="input-base"
                  placeholder={placeholder}
                  value={form[key] || ''}
                  onChange={set(key)}
                />
              </div>
            ))}

            <div className="grid grid-cols-2 gap-4">
              {camposConfig.slice(3, 5).map(({ key, label, placeholder, icon }) => (
                <div key={key}>
                  <label className="flex items-center gap-2 text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                    <i className={`fas ${icon} text-[10px]`} style={{ color: 'var(--accent)' }} />
                    {label}
                  </label>
                  <input
                    className="input-base"
                    placeholder={placeholder}
                    value={form[key] || ''}
                    onChange={set(key)}
                  />
                </div>
              ))}
            </div>

            <div key="site">
              <label className="flex items-center gap-2 text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                <i className="fas fa-globe text-[10px]" style={{ color: 'var(--accent)' }} />
                Site
              </label>
              <input
                className="input-base"
                placeholder="www.escritorio.com.br"
                value={form.site || ''}
                onChange={set('site')}
              />
            </div>
          </div>
        )}
      </div>

      {/* Localização */}
      <div className="card space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
          <i className="fas fa-location-dot mr-2" style={{ color: 'var(--accent)' }} />
          Localização
        </h2>
        {[camposConfig[6], camposConfig[7], camposConfig[8]].map(({ key, label, placeholder, icon }) => (
          <div key={key}>
            <label className="flex items-center gap-2 text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              <i className={`fas ${icon} text-[10px]`} style={{ color: 'var(--accent)' }} />
              {label}
            </label>
            <input
              className="input-base"
              placeholder={placeholder}
              value={form[key] || ''}
              onChange={set(key)}
            />
          </div>
        ))}
      </div>

      {/* Logo e Rodapé do Documento */}
      <div className="card space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
          <i className="fas fa-file-lines mr-2" style={{ color: 'var(--accent)' }} />
          Personalização de Documentos
        </h2>

        {/* Logo */}
        <div>
          <label className="flex items-center gap-2 text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            <i className="fas fa-image text-[10px]" style={{ color: 'var(--accent)' }} />
            Logo do Escritório (cabeçalho)
          </label>
          <div className="flex items-center gap-4">
            {data?.logoEscritorio && (
              <div className="rounded-xl overflow-hidden flex-shrink-0" style={{ width: 120, height: 60, background: '#fff', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
                <img src={`${BASE_URL}${data.logoEscritorio}`} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              </div>
            )}
            <button onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo} className="btn btn-ghost text-sm">
              {uploadingLogo ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <i className="fas fa-upload" />}
              {data?.logoEscritorio ? 'Trocar logo' : 'Enviar logo'}
            </button>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          </div>
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
            A logo aparecerá no cabeçalho dos documentos gerados em PDF.
          </p>
        </div>

        {/* Cor do documento */}
        <div>
          <label className="flex items-center gap-2 text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            <i className="fas fa-palette text-[10px]" style={{ color: 'var(--accent)' }} />
            Cor das bordas do documento
          </label>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="color"
                value={form.corDocumento || '#1a2544'}
                onChange={e => setForm(f => ({ ...f, corDocumento: e.target.value }))}
                style={{ width: 48, height: 48, borderRadius: 10, border: '2px solid var(--border)', cursor: 'pointer', padding: 2, background: 'transparent' }}
              />
            </div>
            <div className="flex-1">
              <input
                className="input-base text-sm font-mono"
                placeholder="#1a2544"
                value={form.corDocumento || '#1a2544'}
                onChange={e => {
                  const v = e.target.value;
                  if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setForm(f => ({ ...f, corDocumento: v }));
                }}
              />
            </div>
            {/* Presets rápidos */}
            <div className="flex gap-1.5">
              {['#1a2544','#1a3a2a','#2a1a1a','#111111','#b8893d'].map(c => (
                <button
                  key={c}
                  title={c}
                  onClick={() => setForm(f => ({ ...f, corDocumento: c }))}
                  style={{
                    width: 22, height: 22, borderRadius: 6, background: c, cursor: 'pointer',
                    border: form.corDocumento === c ? '2px solid var(--accent)' : '2px solid transparent',
                    transition: 'border .15s',
                  }}
                />
              ))}
            </div>
          </div>
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
            Cor utilizada nas bordas decorativas do cabeçalho e rodapé do PDF.
          </p>
        </div>

        {/* Rodapé */}
        <div>
          <label className="flex items-center gap-2 text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            <i className="fas fa-shoe-prints text-[10px]" style={{ color: 'var(--accent)' }} />
            Rodapé personalizado
          </label>
          <textarea
            className="input-base text-sm"
            rows={2}
            placeholder="Ex: Rua Exemplo, 123 - Centro - São Paulo/SP | Tel: (11) 1234-5678 | contato@escritorio.com.br"
            value={form.rodapeDocumento || ''}
            onChange={e => setForm(f => ({ ...f, rodapeDocumento: e.target.value }))}
            style={{ resize: 'none' }}
          />
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
            Texto exibido no rodapé de todas as páginas do PDF gerado.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={() => salvar()} disabled={salvando} className="btn btn-gold px-8">
          {salvando ? <span className="spinner" /> : <i className="fas fa-check" />}
          {salvando ? 'Salvando...' : 'Salvar dados'}
        </button>
      </div>
    </div>
  );
}
