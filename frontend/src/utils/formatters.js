import { format, formatDistance, isValid, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const formatarData = (data) => {
  if (!data) return '—';
  try {
    const d = typeof data === 'string' ? parseISO(data) : data;
    return isValid(d) ? format(d, 'dd/MM/yyyy', { locale: ptBR }) : '—';
  } catch { return '—'; }
};

export const formatarDataHora = (data) => {
  if (!data) return '—';
  try {
    const d = typeof data === 'string' ? parseISO(data) : data;
    return isValid(d) ? format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—';
  } catch { return '—'; }
};

export const formatarTempoRelativo = (data) => {
  if (!data) return '—';
  try {
    const d = typeof data === 'string' ? parseISO(data) : data;
    return formatDistance(d, new Date(), { addSuffix: true, locale: ptBR });
  } catch { return '—'; }
};

export const formatarMoeda = (valor) => {
  if (valor === null || valor === undefined) return 'R$ —';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor));
};

export const formatarNumeroCNJ = (numero) => {
  if (!numero) return '—';
  const n = numero.replace(/\D/g, '');
  if (n.length !== 20) return numero;
  return `${n.slice(0,7)}-${n.slice(7,9)}.${n.slice(9,13)}.${n.slice(13,14)}.${n.slice(14,16)}.${n.slice(16)}`;
};

export const statusLabel = {
  ATIVO: 'Ativo',
  SUSPENSO: 'Suspenso',
  ARQUIVADO: 'Arquivado',
  ENCERRADO: 'Encerrado',
  AGUARDANDO: 'Aguardando',
  CONCLUIDO: 'Concluído',
};

export const prioridadeLabel = {
  BAIXA: 'Baixa',
  MEDIA: 'Média',
  ALTA: 'Alta',
  URGENTE: 'Urgente',
};

export const statusTarefaLabel = {
  PENDENTE: 'Pendente',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
};

export const getIniciais = (nome) => {
  if (!nome) return '?';
  return nome.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
};

export const diasAteVencer = (data) => {
  if (!data) return null;
  const d = typeof data === 'string' ? parseISO(data) : data;
  const diff = Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24));
  return diff;
};
