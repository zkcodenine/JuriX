import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

export default function Planos() {
  const { usuario, atualizarUsuario } = useAuthStore();
  const [periodo,   setPeriodo]   = useState('anual');
  const [devCodigo, setDevCodigo] = useState('');
  const [showDev,   setShowDev]   = useState(false);

  const { data } = useQuery({
    queryKey: ['planos'],
    queryFn: () => api.get('/pagamentos/planos').then(r => r.data),
  });

  const devMutation = useMutation({
    mutationFn: () => api.post('/auth/dev-activate', { codigo: devCodigo }),
    onSuccess: (res) => {
      if (res.data.usuario) atualizarUsuario(res.data.usuario);
      toast.success('Plano vitalício ativado!');
      setDevCodigo('');
      setShowDev(false);
    },
    onError: () => toast.error('Código inválido.'),
  });

  const assinarMutation = useMutation({
    mutationFn: (plano) => api.post('/pagamentos/criar-preferencia', { plano }),
    onSuccess: (res) => {
      // Redireciona para o Mercado Pago
      if (res.data.preferencia?.init_point) {
        window.location.href = res.data.preferencia.init_point;
      }
    },
    onError: () => toast.error('Erro ao processar pagamento. Tente novamente.'),
  });

  const planos = data?.planos || [];

  return (
    <div className="animate-fadeIn max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 text-xs font-bold" style={{ background: 'rgba(201,168,76,.12)', color: '#C9A84C', border: '1px solid rgba(201,168,76,.25)' }}>
          <i className="fas fa-crown" /> Planos JuriX
        </div>
        <h1 className="text-3xl font-bold mb-3">
          Escolha o plano <span className="text-gold-gradient">ideal para você</span>
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Sem surpresas. Cancele quando quiser.
        </p>

        {/* Toggle mensal/anual */}
        <div className="inline-flex rounded-xl p-1 mt-6 gap-1" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          {['mensal', 'anual'].map(p => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all capitalize"
              style={{
                background: periodo === p ? 'var(--accent)' : 'transparent',
                color: periodo === p ? '#0a0a0a' : 'var(--text-secondary)',
              }}
            >
              {p === 'anual' ? 'Anual (25% OFF)' : 'Mensal'}
            </button>
          ))}
        </div>
      </div>

      {/* Cards de planos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Plano Gratuito */}
        <div className="card">
          <div className="mb-6">
            <h3 className="text-xl font-bold mb-1">Gratuito</h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Para começar a organizar</p>
          </div>
          <div className="mb-6">
            <span className="text-4xl font-bold">R$ 0</span>
            <span className="text-sm ml-2" style={{ color: 'var(--text-secondary)' }}>/mês</span>
          </div>
          <ul className="space-y-3 mb-8">
            {['Até 5 processos', 'Tarefas e prazos', 'Upload de documentos (500MB)', 'Suporte por e-mail'].map(r => (
              <li key={r} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <i className="fas fa-check text-xs" style={{ color: '#10b981' }} /> {r}
              </li>
            ))}
            {['Integração DataJud/CNJ', 'Monitoramento automático'].map(r => (
              <li key={r} className="flex items-center gap-2 text-sm opacity-40" style={{ color: 'var(--text-secondary)' }}>
                <i className="fas fa-xmark text-xs" style={{ color: '#ef4444' }} /> {r}
              </li>
            ))}
          </ul>
          <div className="mt-auto">
            {usuario?.plano === 'GRATUITO' ? (
              <div className="btn btn-ghost w-full justify-center py-3 cursor-default text-sm">
                <i className="fas fa-circle-check" style={{ color: '#10b981' }} /> Plano atual
              </div>
            ) : (
              <div className="btn btn-ghost w-full justify-center py-3 opacity-50 text-sm cursor-default">Plano gratuito</div>
            )}
          </div>
        </div>

        {/* Plano Pago */}
        <div className="card relative overflow-hidden" style={{ border: '1px solid rgba(201,168,76,.4)', background: 'rgba(201,168,76,.04)' }}>
          {/* Badge destaque */}
          <div className="absolute top-4 right-4 text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: 'var(--accent)', color: '#0a0a0a' }}>
            {periodo === 'anual' ? '25% OFF' : 'POPULAR'}
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <i className="fas fa-crown text-sm" style={{ color: 'var(--accent)' }} />
              <h3 className="text-xl font-bold">{periodo === 'anual' ? 'Anual' : 'Mensal'}</h3>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Tudo ilimitado, sem restrições</p>
          </div>

          <div className="mb-6">
            <span className="text-4xl font-bold" style={{ color: 'var(--accent)' }}>
              {periodo === 'anual' ? 'R$ 59,90' : 'R$ 79,90'}
            </span>
            <span className="text-sm ml-2" style={{ color: 'var(--text-secondary)' }}>/mês</span>
            {periodo === 'anual' && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                R$ 718,80/ano • Economia de R$ 240,00
              </p>
            )}
          </div>

          <ul className="space-y-3 mb-8">
            {[
              'Processos ilimitados',
              'Integração DataJud/CNJ',
              'Monitoramento automático 24/7',
              'Notificações em tempo real',
              'Upload ilimitado de documentos',
              'Suporte prioritário',
              periodo === 'anual' ? 'Relatórios avançados' : '',
            ].filter(Boolean).map(r => (
              <li key={r} className="flex items-center gap-2 text-sm">
                <i className="fas fa-check text-xs" style={{ color: '#C9A84C' }} />
                <span>{r}</span>
              </li>
            ))}
          </ul>

          <button
            onClick={() => assinarMutation.mutate(periodo)}
            disabled={assinarMutation.isPending || usuario?.plano !== 'GRATUITO'}
            className="btn btn-gold w-full justify-center py-3 text-base"
          >
            {assinarMutation.isPending
              ? <><span className="spinner" style={{ width: 18, height: 18 }} /> Processando...</>
              : usuario?.plano !== 'GRATUITO'
                ? <><i className="fas fa-circle-check" /> Plano ativo</>
                : <><i className="fas fa-crown" /> Assinar agora</>
            }
          </button>

          <p className="text-xs text-center mt-3" style={{ color: 'var(--text-muted)' }}>
            <i className="fas fa-lock text-[10px] mr-1" />Pagamento seguro via Mercado Pago
          </p>
        </div>
      </div>

      {/* ─── Código de acesso especial ─────────── */}
      <div className="mt-10 flex justify-center">
        {!showDev ? (
          <button
            onClick={() => setShowDev(true)}
            className="text-xs transition-opacity hover:opacity-60"
            style={{ color: 'var(--text-muted)' }}
          >
            <i className="fas fa-key mr-1" />Possui um código de acesso?
          </button>
        ) : (
          <div
            className="w-full max-w-sm rounded-2xl p-5 space-y-3 animate-scaleIn"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <p className="text-sm font-semibold text-center">Código de acesso</p>
            <input
              className="input-base text-sm text-center tracking-widest"
              placeholder="XXXX-XXXX-XXXX"
              value={devCodigo}
              onChange={e => setDevCodigo(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && devCodigo && devMutation.mutate()}
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => { setShowDev(false); setDevCodigo(''); }} className="btn btn-ghost text-sm py-2 flex-1">
                Cancelar
              </button>
              <button
                onClick={() => devMutation.mutate()}
                disabled={!devCodigo || devMutation.isPending}
                className="btn btn-gold text-sm py-2 flex-1"
              >
                {devMutation.isPending ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Ativar'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* FAQ */}
      <div className="mt-12">
        <h3 className="text-lg font-bold text-center mb-6">Perguntas frequentes</h3>
        <div className="space-y-3">
          {[
            { p: 'Posso cancelar a qualquer momento?', r: 'Sim. Você pode cancelar quando quiser, sem multas ou taxas. O acesso continua até o fim do período pago.' },
            { p: 'Meus dados ficam salvos se eu cancelar?', r: 'Sim. Seus dados ficam armazenados por 60 dias após o cancelamento, permitindo reativação.' },
            { p: 'Como funciona a integração com o DataJud?', r: 'Utilizamos a API pública do CNJ para buscar e monitorar seus processos automaticamente a cada 3 horas.' },
          ].map(({ p, r }) => (
            <div key={p} className="card">
              <p className="font-semibold text-sm mb-2">{p}</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{r}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
