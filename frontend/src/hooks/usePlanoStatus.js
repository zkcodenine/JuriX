import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

/* ══════════════════════════════════════════════════════════════════
   Situação do plano do usuário logado.

   Vem do backend (`/pagamentos/status-plano`), não do objeto salvo no
   localStorage: o plano pode ter vencido, ou uma assinatura pode ter
   sido ativada, sem que o usuário tenha feito login de novo.

   Campos:
     ativo             — tem plano pago vigente (ou é ADMIN_GLOBAL)
     processos/limite  — quantos processos tem e qual a cota gratuita
     podeCriarProcesso — ainda cabe cadastrar mais um
     bloqueado         — acima da cota: só leitura até assinar
   ══════════════════════════════════════════════════════════════════ */
export default function usePlanoStatus() {
  // Só os campos que interessam. Espalhar o retorno do React Query aqui
  // sobrescreveria `status` pelo status DELE ('success'), e o aviso de
  // plano passava a ler `'success'.ativo` — undefined — e aparecia para
  // todo mundo dizendo "undefined de undefined processos".
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['status-plano'],
    queryFn: () => api.get('/pagamentos/status-plano').then((r) => r.data),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  return {
    status: data,
    isLoading,
    isError,
    refetch,
    // Enquanto carrega, o padrão é permissivo: o backend é quem barra de
    // verdade, e travar a interface por falta de resposta só atrapalharia.
    ativo: data?.ativo ?? true,
    bloqueado: data?.bloqueado ?? false,
    podeCriarProcesso: data?.podeCriarProcesso ?? true,
    processos: data?.processos ?? 0,
    limite: data?.limite ?? 5,
  };
}
