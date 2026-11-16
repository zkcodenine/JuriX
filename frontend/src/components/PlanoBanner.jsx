import { useNavigate } from 'react-router-dom';
import usePlanoStatus from '../hooks/usePlanoStatus';

/* ══════════════════════════════════════════════════════════════════
   Aviso de cota do plano gratuito.

   Três estados, do mais grave para o mais leve:
     1. bloqueado  — acima de 5 processos sem plano: só leitura
     2. no limite  — exatamente 5: não cabe mais nenhum
     3. chegando   — 4 de 5: aviso discreto

   Com plano ativo, nada aparece.
   ══════════════════════════════════════════════════════════════════ */
export default function PlanoBanner() {
  const navigate = useNavigate();
  const { status } = usePlanoStatus();

  // Só desenha com números de verdade na mão: um aviso de cota com
  // "undefined de undefined" é pior do que aviso nenhum.
  if (!status || status.ativo) return null;
  if (typeof status.processos !== 'number' || typeof status.limite !== 'number') return null;

  const { processos, limite, bloqueado, expirado } = status;
  const noLimite = processos >= limite;

  // Abaixo de 80% da cota não há motivo para ocupar espaço na tela.
  if (!bloqueado && !noLimite && processos < limite - 1) return null;

  const tema = bloqueado
    ? { cor: '#fca5a5', fundo: 'rgba(239,68,68,.15)', borda: 'rgba(239,68,68,.25)', icone: 'fa-lock' }
    : noLimite
      ? { cor: '#fbbf24', fundo: 'rgba(245,158,11,.12)', borda: 'rgba(245,158,11,.22)', icone: 'fa-triangle-exclamation' }
      : { cor: '#e7cf84', fundo: 'rgba(201,168,76,.10)', borda: 'rgba(201,168,76,.2)', icone: 'fa-circle-info' };

  const mensagem = bloqueado
    ? `Sua conta tem ${processos} processos e o plano gratuito permite ${limite}. `
      + 'O sistema está em modo somente-leitura: assine um plano para voltar a editar, '
      + `ou exclua processos até ficar com ${limite}.`
    : noLimite
      ? `Você atingiu o limite de ${limite} processos do plano gratuito. Assine para cadastrar mais.`
      : `Você está usando ${processos} de ${limite} processos do plano gratuito.`;

  return (
    <div
      className="flex items-center justify-center gap-3 px-4 py-2.5 text-sm font-medium animate-fadeIn"
      style={{
        background: tema.fundo,
        borderBottom: `1px solid ${tema.borda}`,
        color: tema.cor,
      }}
    >
      <i className={`fas ${tema.icone} text-xs`} />
      <span className="text-center">
        {expirado && <strong>Sua assinatura expirou. </strong>}
        {mensagem}
      </span>
      <button
        onClick={() => navigate('/planos')}
        className="btn btn-gold text-xs flex-shrink-0"
        style={{ padding: '0.25rem 0.75rem' }}
      >
        <i className="fas fa-crown text-[10px]" /> Ver planos
      </button>
    </div>
  );
}
