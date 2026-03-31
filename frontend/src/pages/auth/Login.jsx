import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

export default function Login() {
  const [form, setForm] = useState({ email: '', senha: '' });
  const [showSenha, setShowSenha] = useState(false);
  const { login, loading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await login(form.email, form.senha);
    if (res.ok) {
      toast.success('Bem-vindo de volta!');
      navigate('/dashboard');
    } else {
      toast.error(res.erro);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-primary)' }}>
      {/* ─── Painel esquerdo (decorativo) ─────────── */}
      <div
        className="hidden lg:flex flex-col justify-between p-12 w-1/2"
        style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center rounded-xl"
            style={{ width: 48, height: 48, background: 'linear-gradient(135deg, #C9A84C, #A8873A)' }}
          >
            <i className="fas fa-scale-balanced text-xl" style={{ color: '#0a0a0a' }} />
          </div>
          <span className="text-2xl font-bold text-gold-gradient">JuriX</span>
        </div>

        <div>
          <h2 className="text-4xl font-bold mb-6 leading-tight">
            Gestão jurídica<br />
            <span className="text-gold-gradient">inteligente e moderna.</span>
          </h2>
          <div className="space-y-4">
            {[
              { icon: 'fa-link', text: 'Integração automática com o DataJud/CNJ' },
              { icon: 'fa-bell', text: 'Monitoramento em tempo real de processos' },
              { icon: 'fa-list-check', text: 'Gestão de prazos, tarefas e honorários' },
              { icon: 'fa-shield-halved', text: 'Segurança e controle total dos seus dados' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center rounded-lg flex-shrink-0"
                  style={{ width: 36, height: 36, background: 'rgba(201,168,76,.12)' }}
                >
                  <i className={`fas ${item.icon} text-sm`} style={{ color: '#C9A84C' }} />
                </div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          © {new Date().getFullYear()} JuriX. Todos os direitos reservados.
        </p>
      </div>

      {/* ─── Formulário ───────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden justify-center">
            <div
              className="flex items-center justify-center rounded-xl"
              style={{ width: 44, height: 44, background: 'linear-gradient(135deg, #C9A84C, #A8873A)' }}
            >
              <i className="fas fa-scale-balanced text-lg" style={{ color: '#0a0a0a' }} />
            </div>
            <span className="text-2xl font-bold text-gold-gradient">JuriX</span>
          </div>

          <h1 className="text-3xl font-bold mb-2">Entrar</h1>
          <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
            Acesse sua conta para continuar
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                E-mail
              </label>
              <input
                className="input-base"
                type="email"
                placeholder="seu@email.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                Senha
              </label>
              <div className="relative">
                <input
                  className="input-base pr-12"
                  type={showSenha ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.senha}
                  onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowSenha(!showSenha)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-sm"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <i className={`fas fa-eye${showSenha ? '-slash' : ''}`} />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-gold w-full justify-center py-3 text-base rounded-xl"
            >
              {loading ? <span className="spinner" /> : <i className="fas fa-right-to-bracket" />}
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="text-center mt-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Não tem uma conta?{' '}
            <Link to="/registrar" className="font-semibold" style={{ color: 'var(--accent)' }}>
              Criar conta grátis
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
