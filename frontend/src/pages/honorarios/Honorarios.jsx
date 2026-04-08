import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { formatarData, formatarMoeda } from '../../utils/formatters';

const statusCor = { PENDENTE: '#f59e0b', PAGO: '#10b981', ATRASADO: '#ef4444', CANCELADO: '#666' };

export default function Honorarios() {
  const navigate = useNavigate();

  const { data: processos = [], isLoading } = useQuery({
    queryKey: ['honorarios-overview'],
    queryFn: () => api.get('/processos', { params: { limite: 100 } }).then(r => r.data.processos),
  });

  // Calcula totais globais
  const totalAReceber = 0;
  const totalRecebido  = 0;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Cards resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total a Receber', valor: formatarMoeda(totalAReceber), icon: 'fa-sack-dollar', cor: 'linear-gradient(135deg, #C9A84C, #A8873A)' },
          { label: 'Recebido este mês', valor: formatarMoeda(totalRecebido), icon: 'fa-circle-check', cor: 'linear-gradient(135deg, #10b981, #047857)' },
          { label: 'Inadimplência', valor: formatarMoeda(0), icon: 'fa-triangle-exclamation', cor: 'linear-gradient(135deg, #ef4444, #b91c1c)' },
        ].map(c => (
          <div key={c.label} className="card flex items-center gap-4">
            <div className="rounded-xl flex items-center justify-center flex-shrink-0" style={{ width: 48, height: 48, background: c.cor }}>
              <i className={`fas ${c.icon} text-white text-xl`} />
            </div>
            <div>
              <p className="text-2xl font-bold">{c.valor}</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="font-bold text-base mb-4 flex items-center gap-2">
          <i className="fas fa-sack-dollar" style={{ color: 'var(--accent)' }} />
          Honorários por Processo
        </h3>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Acesse cada processo para ver e gerenciar os honorários detalhados.
        </p>
        <button onClick={() => navigate('/processos')} className="btn btn-gold mt-4">
          <i className="fas fa-scale-balanced" /> Ver Processos
        </button>
      </div>
    </div>
  );
}
