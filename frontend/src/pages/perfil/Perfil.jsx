import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

function AvatarUpload({ usuario, onUpdate }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('avatar', file);
      const { data } = await api.post('/auth/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onUpdate({ avatar: data.avatar });
      toast.success('Foto atualizada!');
    } catch {
      toast.error('Erro ao enviar foto.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const initials = (usuario?.nome || 'U')
    .split(' ')
    .map(p => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center gap-6 mb-8">
      <div className="relative">
        <div
          className="flex items-center justify-center rounded-full overflow-hidden"
          style={{ width: 96, height: 96, background: 'linear-gradient(135deg,#C9A84C,#A8873A)', fontSize: 32, color: '#0a0a0a', fontWeight: 700 }}
        >
          {usuario?.avatar
            ? <img src={usuario.avatar} alt="avatar" className="w-full h-full object-cover" />
            : initials}
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="absolute bottom-0 right-0 flex items-center justify-center rounded-full"
          style={{ width: 28, height: 28, background: 'var(--accent)', color: '#0a0a0a', border: '2px solid var(--bg-primary)' }}
          title="Trocar foto"
        >
          {uploading ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> : <i className="fas fa-camera text-xs" />}
        </button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
      <div>
        <p className="font-bold text-lg">{usuario?.nome}</p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{usuario?.email}</p>
        <p className="text-xs mt-1" style={{ color: 'var(--accent)' }}>
          <i className="fas fa-crown mr-1" />
          Plano {usuario?.plano}
        </p>
      </div>
    </div>
  );
}

// ─── Integração Google Agenda ──────────────────────
function GoogleAgendaCard() {
  const qc = useQueryClient();
  const { data: status, refetch, isFetching } = useQuery({
    queryKey: ['google-status'],
    queryFn: () => api.get('/google/status').then(r => r.data),
  });

  const conectar = async () => {
    try {
      const { data } = await api.get('/google/auth-url');
      // Em Electron, window.open com http abre o navegador padrão do sistema.
      window.open(data.url, '_blank', 'noopener');
      toast('Autorize no navegador que abriu e depois clique em "Já conectei".', { icon: '🔗', duration: 6000 });
    } catch (e) {
      toast.error(e.response?.data?.error || 'Integração Google indisponível no momento.');
    }
  };

  const desconectarMut = useMutation({
    mutationFn: () => api.post('/google/disconnect'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['google-status'] }); toast.success('Google Agenda desconectada.'); },
  });

  const conectado = status?.conectado;

  return (
    <div className="card">
      <h2 className="text-sm font-semibold uppercase tracking-widest mb-5 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
        <i className="fas fa-plug" style={{ color: 'var(--accent)' }} /> Integrações
      </h2>

      <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-center rounded-lg flex-shrink-0" style={{ width: 44, height: 44, background: 'rgba(66,133,244,.12)' }}>
          <i className="fab fa-google text-xl" style={{ color: '#4285F4' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Google Agenda</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {conectado
              ? <>Conectada{status?.email ? ` como ${status.email}` : ''} — seus eventos são enviados para a Google Agenda.</>
              : status?.configurado === false
                ? 'Indisponível no momento (não configurada no servidor).'
                : 'Conecte para que os eventos criados no JuriX apareçam na sua Google Agenda.'}
          </p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
          {conectado ? (
            <button onClick={() => desconectarMut.mutate()} disabled={desconectarMut.isPending} className="btn btn-ghost text-sm" style={{ color: 'var(--danger)' }}>
              {desconectarMut.isPending ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <i className="fas fa-link-slash" />} Desconectar
            </button>
          ) : status?.configurado === false ? (
            <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(255,255,255,.05)', color: 'var(--text-muted)' }}>Em breve</span>
          ) : (
            <>
              <button onClick={conectar} className="btn btn-gold text-sm">
                <i className="fab fa-google" /> Conectar
              </button>
              <button onClick={() => refetch()} disabled={isFetching} className="btn btn-ghost text-sm" title="Já conectei — atualizar status">
                {isFetching ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <i className="fas fa-rotate" />} Já conectei
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Perfil() {
  const { usuario, atualizarUsuario } = useAuthStore();
  const queryClient = useQueryClient();

  const [dados, setDados] = useState({
    nome: usuario?.nome || '',
    oab: usuario?.oab || '',
    telefone: usuario?.telefone || '',
  });
  const [senhas, setSenhas] = useState({ senhaAtual: '', novaSenha: '', confirmar: '' });
  const [showSenhas, setShowSenhas] = useState({ atual: false, nova: false, conf: false });

  const { mutate: salvarDados, isPending: salvando } = useMutation({
    mutationFn: () => api.put('/auth/perfil', dados),
    onSuccess: ({ data }) => {
      atualizarUsuario(data);
      toast.success('Dados atualizados!');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Erro ao salvar'),
  });

  const { mutate: alterarSenha, isPending: alterando } = useMutation({
    mutationFn: () => api.post('/auth/alterar-senha', {
      senhaAtual: senhas.senhaAtual,
      novaSenha: senhas.novaSenha,
    }),
    onSuccess: () => {
      toast.success('Senha alterada com sucesso!');
      setSenhas({ senhaAtual: '', novaSenha: '', confirmar: '' });
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Erro ao alterar senha'),
  });

  const handleSenha = (e) => {
    e.preventDefault();
    if (senhas.novaSenha !== senhas.confirmar) {
      toast.error('As senhas não coincidem.');
      return;
    }
    alterarSenha();
  };

  const SectionTitle = ({ icon, title }) => (
    <h2 className="text-sm font-semibold uppercase tracking-widest mb-5 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
      <i className={`fas ${icon}`} style={{ color: 'var(--accent)' }} />
      {title}
    </h2>
  );

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6" style={{ animation: 'fadeIn .3s ease' }}>

      {/* Avatar + info */}
      <div className="card">
        <AvatarUpload usuario={usuario} onUpdate={atualizarUsuario} />

        <SectionTitle icon="fa-user" title="Dados Pessoais" />

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Nome completo</label>
            <input
              className="input-base"
              value={dados.nome}
              onChange={e => setDados(d => ({ ...d, nome: e.target.value }))}
              placeholder="Seu nome"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>OAB</label>
              <input
                className="input-base"
                value={dados.oab}
                onChange={e => setDados(d => ({ ...d, oab: e.target.value }))}
                placeholder="XX000000"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Telefone</label>
              <input
                className="input-base"
                value={dados.telefone}
                onChange={e => setDados(d => ({ ...d, telefone: e.target.value }))}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>E-mail</label>
            <input className="input-base opacity-50" value={usuario?.email || ''} disabled />
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>O e-mail não pode ser alterado.</p>
          </div>

          <button
            onClick={() => salvarDados()}
            disabled={salvando}
            className="btn btn-gold"
          >
            {salvando ? <span className="spinner" /> : <i className="fas fa-check" />}
            {salvando ? 'Salvando...' : 'Salvar dados'}
          </button>
        </div>
      </div>

      {/* Integrações */}
      <GoogleAgendaCard />

      {/* Segurança */}
      <div className="card">
        <SectionTitle icon="fa-shield-halved" title="Segurança" />

        <form onSubmit={handleSenha} className="space-y-4">
          {[
            { key: 'senhaAtual', label: 'Senha atual', show: 'atual' },
            { key: 'novaSenha', label: 'Nova senha', show: 'nova' },
            { key: 'confirmar', label: 'Confirmar nova senha', show: 'conf' },
          ].map(({ key, label, show }) => (
            <div key={key}>
              <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{label}</label>
              <div className="relative">
                <input
                  className="input-base pr-12"
                  type={showSenhas[show] ? 'text' : 'password'}
                  value={senhas[key]}
                  onChange={e => setSenhas(s => ({ ...s, [key]: e.target.value }))}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowSenhas(s => ({ ...s, [show]: !s[show] }))}
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <i className={`fas fa-eye${showSenhas[show] ? '-slash' : ''} text-sm`} />
                </button>
              </div>
            </div>
          ))}

          <button type="submit" disabled={alterando} className="btn btn-ghost">
            {alterando ? <span className="spinner" /> : <i className="fas fa-key" />}
            {alterando ? 'Alterando...' : 'Alterar senha'}
          </button>
        </form>
      </div>
    </div>
  );
}
