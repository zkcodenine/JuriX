import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

const TERMOS = `
TERMOS DE USO — JURIX

1. ACEITAÇÃO DOS TERMOS
Ao criar uma conta no JuriX, você concorda com estes Termos de Uso e com nossa Política de Privacidade. Se não concordar, não utilize o sistema.

2. DESCRIÇÃO DO SERVIÇO
O JuriX é uma plataforma de gestão jurídica que oferece ferramentas para organização de processos, prazos, documentos, honorários e integração com bases judiciais brasileiras.

3. RESPONSABILIDADE DO USUÁRIO
O usuário é integralmente responsável pelas informações inseridas no sistema, pela veracidade dos dados cadastrais e pelo uso das funcionalidades em conformidade com a legislação vigente.

4. DADOS E PRIVACIDADE
Os dados inseridos no JuriX são de propriedade exclusiva do usuário. Não compartilhamos informações com terceiros sem autorização expressa, exceto quando exigido por lei. Consulte nossa Política de Privacidade para detalhes.

5. INTEGRAÇÕES EXTERNAS
O JuriX realiza consultas ao DataJud (CNJ) para obtenção de dados processuais. Essas consultas seguem as políticas de uso das APIs públicas do CNJ.

6. SEGURANÇA
O usuário é responsável pela guarda de suas credenciais de acesso. O JuriX adota criptografia e boas práticas de segurança, mas não se responsabiliza por acessos não autorizados decorrentes de negligência do usuário.

7. PLANOS E PAGAMENTOS
Os planos pagos são processados via Mercado Pago. Cancelamentos devem ser solicitados com antecedência mínima de 5 dias úteis antes do vencimento.

8. LIMITAÇÃO DE RESPONSABILIDADE
O JuriX não se responsabiliza por perdas de prazos processuais ou decisões judiciais desfavoráveis. O sistema é uma ferramenta de auxílio e não substitui o julgamento profissional do advogado.

9. MODIFICAÇÕES
Estes termos podem ser atualizados. O usuário será notificado sobre alterações relevantes.

10. CONTATO
Dúvidas: suporte@jurix.com.br
`;

export default function Register() {
  const [form, setForm] = useState({
    nome: '', email: '', senha: '', confirmarSenha: '', oab: '', telefone: '',
    aceitouTermos: false,
  });
  const [showSenha, setShowSenha] = useState(false);
  const [showTermos, setShowTermos] = useState(false);
  const { registrar, loading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.senha !== form.confirmarSenha) return toast.error('As senhas não coincidem.');
    if (!form.aceitouTermos) return toast.error('Você deve aceitar os Termos de Uso.');

    const res = await registrar({
      nome: form.nome,
      email: form.email,
      senha: form.senha,
      oab: form.oab || undefined,
      telefone: form.telefone || undefined,
      aceitouTermos: 'true',
    });

    if (res.ok) {
      toast.success('Conta criada com sucesso! Bem-vindo ao JuriX.');
      navigate('/dashboard');
    } else {
      toast.error(res.erro);
    }
  };

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gold-gradient">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div
            className="flex items-center justify-center rounded-xl"
            style={{ width: 48, height: 48, background: 'linear-gradient(135deg, #C9A84C, #A8873A)' }}
          >
            <i className="fas fa-scale-balanced text-xl" style={{ color: '#0a0a0a' }} />
          </div>
          <span className="text-2xl font-bold text-gold-gradient">JuriX</span>
        </div>

        <div className="card">
          <h1 className="text-2xl font-bold mb-1">Criar conta</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
            Comece gratuitamente. Sem cartão de crédito.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  Nome completo *
                </label>
                <input className="input-base" placeholder="Dr. João Silva" value={form.nome} onChange={set('nome')} required />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  E-mail *
                </label>
                <input className="input-base" type="email" placeholder="joao@escritorio.com.br" value={form.email} onChange={set('email')} required />
              </div>

              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  OAB
                </label>
                <input className="input-base" placeholder="SP 123456" value={form.oab} onChange={set('oab')} />
              </div>

              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  Telefone
                </label>
                <input className="input-base" placeholder="(11) 99999-9999" value={form.telefone} onChange={set('telefone')} />
              </div>

              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  Senha *
                </label>
                <div className="relative">
                  <input
                    className="input-base pr-10"
                    type={showSenha ? 'text' : 'password'}
                    placeholder="Mín. 8 caracteres"
                    value={form.senha}
                    onChange={set('senha')}
                    required minLength={8}
                  />
                  <button type="button" onClick={() => setShowSenha(!showSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm"
                    style={{ color: 'var(--text-muted)' }}>
                    <i className={`fas fa-eye${showSenha ? '-slash' : ''}`} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  Confirmar senha *
                </label>
                <input
                  className="input-base"
                  type="password"
                  placeholder="Repita a senha"
                  value={form.confirmarSenha}
                  onChange={set('confirmarSenha')}
                  required
                />
              </div>
            </div>

            {/* ─── Termos de Uso ────────────────────── */}
            <div className="rounded-xl p-4 border" style={{ background: 'rgba(255,255,255,.04)', borderColor: 'var(--border)' }}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.aceitouTermos}
                  onChange={e => setForm(f => ({ ...f, aceitouTermos: e.target.checked }))}
                  className="mt-0.5 flex-shrink-0"
                  style={{ accentColor: '#C9A84C' }}
                />
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Li e aceito os{' '}
                  <button
                    type="button"
                    onClick={() => setShowTermos(true)}
                    className="font-semibold underline"
                    style={{ color: 'var(--accent)' }}
                  >
                    Termos de Uso e Política de Privacidade
                  </button>{' '}
                  do JuriX.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading || !form.aceitouTermos}
              className="btn btn-gold w-full justify-center py-3 text-base rounded-xl"
              style={{ opacity: (!form.aceitouTermos || loading) ? 0.6 : 1 }}
            >
              {loading ? <span className="spinner" /> : <i className="fas fa-user-plus" />}
              {loading ? 'Criando conta...' : 'Criar conta grátis'}
            </button>
          </form>

          <p className="text-center mt-5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Já tem conta?{' '}
            <Link to="/login" className="font-semibold" style={{ color: 'var(--accent)' }}>
              Fazer login
            </Link>
          </p>
        </div>
      </div>

      {/* ─── Modal Termos de Uso ─────────────────── */}
      {showTermos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-2xl rounded-2xl overflow-hidden animate-scaleIn" style={{ background: 'rgba(10,10,10,.8)', backdropFilter: 'blur(24px) saturate(1.3)', WebkitBackdropFilter: 'blur(24px) saturate(1.3)', border: '1px solid var(--border)' }}>
            <div className="flex justify-between items-center px-6 py-4 border-b sticky top-0" style={{ borderColor: 'var(--border)', background: 'rgba(10,10,10,.8)' }}>
              <h3 className="text-lg font-bold">Termos de Uso — JuriX</h3>
              <button onClick={() => setShowTermos(false)} style={{ color: 'var(--text-secondary)' }}>
                <i className="fas fa-xmark text-xl" />
              </button>
            </div>
            <div className="p-6 max-h-96 overflow-y-auto">
              <pre className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
                {TERMOS}
              </pre>
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setShowTermos(false)} className="btn btn-ghost">Fechar</button>
              <button
                onClick={() => { setForm(f => ({ ...f, aceitouTermos: true })); setShowTermos(false); }}
                className="btn btn-gold"
              >
                <i className="fas fa-check" /> Aceitar termos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
