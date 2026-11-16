// ══════════════════════════════════════════════════════
//  JuriX — Integração Google Agenda (Google Calendar API)
//  Sincronização one-way: eventos do JuriX → Google Agenda.
//
//  Requer no .env:
//    GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
//  (Redirect URI padrão: http://localhost:3001/api/google/callback)
// ══════════════════════════════════════════════════════
const { google } = require('googleapis');
const { prisma } = require('../config/database');
const logger = require('../config/logger');

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

// true se as credenciais OAuth estão configuradas no ambiente.
function isConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function redirectUri() {
  return process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/google/callback';
}

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri()
  );
}

// URL de consentimento. `state` carrega o id do usuário JuriX que está conectando.
function gerarAuthUrl(usuarioId) {
  return oauthClient().generateAuthUrl({
    access_type: 'offline',     // garante refresh_token
    prompt: 'consent',          // força emissão de refresh_token mesmo em re-conexão
    scope: SCOPES,
    state: usuarioId,
  });
}

// Troca o `code` do callback por tokens e salva o refresh_token no usuário.
async function conectarComCodigo(code, usuarioId) {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  // Descobre o e-mail Google conectado (informativo).
  let googleEmail = null;
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const me = await oauth2.userinfo.get();
    googleEmail = me.data?.email || null;
  } catch { /* opcional */ }

  await prisma.usuario.update({
    where: { id: usuarioId },
    data: {
      googleRefreshToken: tokens.refresh_token || undefined, // mantém o antigo se Google não reenviar
      googleEmail,
      googleConnected: true,
    },
  });
  return { googleEmail };
}

async function desconectar(usuarioId) {
  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { googleRefreshToken: null, googleEmail: null, googleConnected: false },
  });
}

// Cliente autenticado a partir do refresh_token salvo. null se não conectado.
async function clienteDoUsuario(usuarioId) {
  const u = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { googleRefreshToken: true, googleConnected: true },
  });
  if (!u?.googleConnected || !u.googleRefreshToken) return null;
  const client = oauthClient();
  client.setCredentials({ refresh_token: u.googleRefreshToken });
  return client;
}

// Converte um EventoAgenda do JuriX em recurso de evento do Google Calendar.
function montarEventoGoogle(evento) {
  const dataBase = new Date(evento.data);
  const yyyy = dataBase.getFullYear();
  const mm = String(dataBase.getMonth() + 1).padStart(2, '0');
  const dd = String(dataBase.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;

  const base = {
    summary: evento.titulo,
    description: evento.descricao || undefined,
  };

  if (evento.horario && /^\d{2}:\d{2}/.test(evento.horario)) {
    // Evento com horário: bloco de 1 hora no fuso de São Paulo.
    const hhmm = String(evento.horario).slice(0, 5);
    const inicio = new Date(`${dateStr}T${hhmm}:00-03:00`);
    const fim = new Date(inicio.getTime() + 60 * 60 * 1000);
    base.start = { dateTime: inicio.toISOString(), timeZone: 'America/Sao_Paulo' };
    base.end = { dateTime: fim.toISOString(), timeZone: 'America/Sao_Paulo' };
    // Lembretes obrigatórios: notificação no celular 1h antes e na hora do evento.
    base.reminders = {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 }, // 1 hora antes
        { method: 'popup', minutes: 0 },  // no horário do evento
      ],
    };
  } else {
    // Evento de dia inteiro (sem horário): lembrete popup na manhã do dia.
    base.start = { date: dateStr };
    base.end = { date: dateStr };
    base.reminders = {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 0 }, // início do dia (00:00) no app do celular
      ],
    };
  }
  return base;
}

// ─── Operações de sincronização (best-effort, nunca quebram o fluxo) ──────

// Cria o evento no Google e devolve o googleEventId (ou null se indisponível).
async function criarEventoGoogle(usuarioId, evento) {
  try {
    if (!isConfigured()) return null;
    const auth = await clienteDoUsuario(usuarioId);
    if (!auth) return null;
    const calendar = google.calendar({ version: 'v3', auth });
    const { data } = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: montarEventoGoogle(evento),
    });
    return data.id || null;
  } catch (err) {
    logger.warn(`Google Calendar (criar) falhou: ${err.message}`);
    return null;
  }
}

async function atualizarEventoGoogle(usuarioId, evento) {
  try {
    if (!isConfigured() || !evento.googleEventId) return evento.googleEventId || null;
    const auth = await clienteDoUsuario(usuarioId);
    if (!auth) return evento.googleEventId;
    const calendar = google.calendar({ version: 'v3', auth });
    await calendar.events.update({
      calendarId: 'primary',
      eventId: evento.googleEventId,
      requestBody: montarEventoGoogle(evento),
    });
    return evento.googleEventId;
  } catch (err) {
    logger.warn(`Google Calendar (atualizar) falhou: ${err.message}`);
    return evento.googleEventId || null;
  }
}

async function deletarEventoGoogle(usuarioId, googleEventId) {
  try {
    if (!isConfigured() || !googleEventId) return;
    const auth = await clienteDoUsuario(usuarioId);
    if (!auth) return;
    const calendar = google.calendar({ version: 'v3', auth });
    await calendar.events.delete({ calendarId: 'primary', eventId: googleEventId });
  } catch (err) {
    logger.warn(`Google Calendar (deletar) falhou: ${err.message}`);
  }
}

// ─── Prazos de tarefas → Google Agenda ────────────────────────────────────
// Evento às 09:00 (America/Sao_Paulo) no dia do prazo, com lembretes popup
// 1 dia antes e no próprio dia do prazo.
function montarEventoPrazo(tarefa) {
  const d = new Date(tarefa.prazo);
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const hhmm = /^\d{2}:\d{2}/.test(tarefa.horario || '') ? String(tarefa.horario).slice(0, 5) : '09:00';
  const inicio = new Date(`${dateStr}T${hhmm}:00-03:00`);
  const fim = new Date(inicio.getTime() + 30 * 60 * 1000);
  return {
    summary: `⚖️ Prazo: ${tarefa.titulo}`,
    description: tarefa.descricao || 'Prazo de tarefa do JuriX',
    start: { dateTime: inicio.toISOString(), timeZone: 'America/Sao_Paulo' },
    end: { dateTime: fim.toISOString(), timeZone: 'America/Sao_Paulo' },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 1440 }, // 1 dia antes
        { method: 'popup', minutes: 0 },    // no dia do prazo (09:00)
      ],
    },
  };
}

// Cria ou atualiza o evento de prazo no Google. Retorna o googleEventId.
async function sincronizarPrazoTarefa(usuarioId, tarefa) {
  try {
    if (!isConfigured() || !tarefa.prazo) return tarefa.googleEventId || null;
    const auth = await clienteDoUsuario(usuarioId);
    if (!auth) return tarefa.googleEventId || null;
    const calendar = google.calendar({ version: 'v3', auth });
    const requestBody = montarEventoPrazo(tarefa);

    if (tarefa.googleEventId) {
      await calendar.events.update({ calendarId: 'primary', eventId: tarefa.googleEventId, requestBody });
      return tarefa.googleEventId;
    }
    const { data } = await calendar.events.insert({ calendarId: 'primary', requestBody });
    return data.id || null;
  } catch (err) {
    logger.warn(`Google Calendar (prazo tarefa) falhou: ${err.message}`);
    return tarefa.googleEventId || null;
  }
}

// ─── Prazos de PROCESSO → Google Agenda ───────────────────────────────────
// Evento às 09:00 (America/Sao_Paulo) no dia do vencimento, lembretes 1 dia
// antes e no próprio dia. Espelha o comportamento dos prazos de tarefa.
function montarEventoPrazoProcesso(prazo) {
  const d = new Date(prazo.dataVencimento);
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const hhmm = /^\d{2}:\d{2}/.test(prazo.horario || '') ? String(prazo.horario).slice(0, 5) : '09:00';
  const inicio = new Date(`${dateStr}T${hhmm}:00-03:00`);
  const fim = new Date(inicio.getTime() + 30 * 60 * 1000);
  return {
    summary: `⚖️ Prazo: ${prazo.titulo}`,
    description: prazo.descricao || 'Prazo processual do JuriX',
    start: { dateTime: inicio.toISOString(), timeZone: 'America/Sao_Paulo' },
    end: { dateTime: fim.toISOString(), timeZone: 'America/Sao_Paulo' },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 1440 }, // 1 dia antes
        { method: 'popup', minutes: 0 },    // no dia do vencimento (09:00)
      ],
    },
  };
}

// Cria ou atualiza o evento de prazo de processo no Google. Retorna googleEventId.
async function sincronizarPrazoProcesso(usuarioId, prazo) {
  try {
    if (!isConfigured() || !prazo.dataVencimento) return prazo.googleEventId || null;
    const auth = await clienteDoUsuario(usuarioId);
    if (!auth) return prazo.googleEventId || null;
    const calendar = google.calendar({ version: 'v3', auth });
    const requestBody = montarEventoPrazoProcesso(prazo);

    if (prazo.googleEventId) {
      await calendar.events.update({ calendarId: 'primary', eventId: prazo.googleEventId, requestBody });
      return prazo.googleEventId;
    }
    const { data } = await calendar.events.insert({ calendarId: 'primary', requestBody });
    return data.id || null;
  } catch (err) {
    logger.warn(`Google Calendar (prazo processo) falhou: ${err.message}`);
    return prazo.googleEventId || null;
  }
}

// ─── Vencimento de PARCELA de honorário → Google Agenda ───────────────────
// Evento no dia do vencimento com lembrete popup no dia e `diasAntes` antes,
// conforme o usuário definiu ao cadastrar o honorário.
function montarEventoParcela({ vencimento, cliente, valor, diasAntes }) {
  const d = new Date(vencimento);
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const inicio = new Date(`${dateStr}T09:00:00-03:00`);
  const fim = new Date(inicio.getTime() + 30 * 60 * 1000);
  const overrides = [{ method: 'popup', minutes: 0 }];
  if (diasAntes > 0) overrides.unshift({ method: 'popup', minutes: diasAntes * 1440 });
  return {
    summary: `💰 Honorário: ${cliente} — ${valor}`,
    description: 'Vencimento de parcela de honorário (JuriX)',
    start: { dateTime: inicio.toISOString(), timeZone: 'America/Sao_Paulo' },
    end: { dateTime: fim.toISOString(), timeZone: 'America/Sao_Paulo' },
    reminders: { useDefault: false, overrides },
  };
}

async function sincronizarParcela(usuarioId, parcela, info) {
  try {
    if (!isConfigured() || !parcela.vencimento) return parcela.googleEventId || null;
    const auth = await clienteDoUsuario(usuarioId);
    if (!auth) return parcela.googleEventId || null;
    const calendar = google.calendar({ version: 'v3', auth });
    const requestBody = montarEventoParcela({ vencimento: parcela.vencimento, ...info });
    if (parcela.googleEventId) {
      await calendar.events.update({ calendarId: 'primary', eventId: parcela.googleEventId, requestBody });
      return parcela.googleEventId;
    }
    const { data } = await calendar.events.insert({ calendarId: 'primary', requestBody });
    return data.id || null;
  } catch (err) {
    logger.warn(`Google Calendar (parcela) falhou: ${err.message}`);
    return parcela.googleEventId || null;
  }
}

// ─── Sincronização completa (backfill) ────────────────────────────────────
// Espelha na Google Agenda TUDO que já estava salvo no JuriX e ainda não tem
// evento lá. Sem isto, só o que fosse criado DEPOIS de conectar a conta ia
// para o Google — os compromissos já cadastrados ficavam de fora, que é
// exatamente o que o usuário espera ver sincronizado.
//
// Roda em três situações:
//   1. logo após conectar a conta Google (automático, em segundo plano)
//   2. quando o usuário clica em "Sincronizar agora"
//   3. no job periódico, para recuperar o que falhou por rede/quota
//
// Idempotente: só toca em registros SEM googleEventId. O que já foi espelhado
// é mantido como está.
const LIMITE_RETROATIVO_DIAS = 30; // compromissos antigos demais não viram lembrete

async function sincronizarTudo(usuarioId, { incluirPassados = false } = {}) {
  const resumo = { eventos: 0, tarefas: 0, prazos: 0, parcelas: 0, falhas: 0, ignorado: null };

  if (!isConfigured()) { resumo.ignorado = 'credenciais Google não configuradas no servidor'; return resumo; }
  const auth = await clienteDoUsuario(usuarioId);
  if (!auth) { resumo.ignorado = 'conta Google não conectada'; return resumo; }

  const corte = incluirPassados
    ? new Date(0)
    : new Date(Date.now() - LIMITE_RETROATIVO_DIAS * 24 * 3600 * 1000);

  // 1. Eventos da agenda
  try {
    const eventos = await prisma.eventoAgenda.findMany({
      where: { usuarioId, googleEventId: null, data: { gte: corte } },
      orderBy: { data: 'asc' },
    });
    for (const evento of eventos) {
      const id = await criarEventoGoogle(usuarioId, evento);
      if (id) {
        await prisma.eventoAgenda.update({ where: { id: evento.id }, data: { googleEventId: id } });
        resumo.eventos++;
      } else resumo.falhas++;
    }
  } catch (err) { logger.warn(`Backfill eventos falhou: ${err.message}`); }

  // 2. Prazos de tarefas (só as não concluídas e com opt-in ligado)
  try {
    const tarefas = await prisma.tarefa.findMany({
      where: {
        usuarioId, googleEventId: null, googleSync: true,
        status: { in: ['PENDENTE', 'EM_ANDAMENTO'] }, prazo: { gte: corte },
      },
      orderBy: { prazo: 'asc' },
    });
    for (const tarefa of tarefas) {
      const id = await sincronizarPrazoTarefa(usuarioId, tarefa);
      if (id) {
        await prisma.tarefa.update({ where: { id: tarefa.id }, data: { googleEventId: id } });
        resumo.tarefas++;
      } else resumo.falhas++;
    }
  } catch (err) { logger.warn(`Backfill tarefas falhou: ${err.message}`); }

  // 3. Prazos processuais dos processos do usuário
  try {
    const prazos = await prisma.prazo.findMany({
      where: {
        googleEventId: null, googleSync: true,
        status: { not: 'CUMPRIDO' },
        dataVencimento: { gte: corte },
        processo: { usuarioId },
      },
      orderBy: { dataVencimento: 'asc' },
    });
    for (const prazo of prazos) {
      const id = await sincronizarPrazoProcesso(usuarioId, prazo);
      if (id) {
        await prisma.prazo.update({ where: { id: prazo.id }, data: { googleEventId: id } });
        resumo.prazos++;
      } else resumo.falhas++;
    }
  } catch (err) { logger.warn(`Backfill prazos falhou: ${err.message}`); }

  // 4. Parcelas de honorário em aberto
  try {
    const parcelas = await prisma.parcela.findMany({
      where: {
        googleEventId: null,
        status: { in: ['PENDENTE', 'ATRASADO'] },
        vencimento: { gte: corte },
        honorario: { googleSync: true, processo: { usuarioId } },
      },
      include: {
        honorario: {
          select: {
            notificarVencimento: true, notificarDiasAntes: true,
            processo: { select: { numero: true, cobrancaNome: true } },
          },
        },
      },
      orderBy: { vencimento: 'asc' },
    });
    for (const parcela of parcelas) {
      const h = parcela.honorario;
      const id = await sincronizarParcela(usuarioId, parcela, {
        cliente: h.processo?.cobrancaNome || h.processo?.numero || 'cliente',
        valor: Number(parcela.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        diasAntes: h.notificarVencimento ? (h.notificarDiasAntes ?? 3) : 0,
      });
      if (id) {
        await prisma.parcela.update({ where: { id: parcela.id }, data: { googleEventId: id } });
        resumo.parcelas++;
      } else resumo.falhas++;
    }
  } catch (err) { logger.warn(`Backfill parcelas falhou: ${err.message}`); }

  logger.info(`Google Agenda — backfill do usuário ${usuarioId}: ${JSON.stringify(resumo)}`);
  return resumo;
}

// Remove do Google todos os eventos espelhados de um processo que está sendo
// excluído. Sem isto, apagar o processo deixava lembretes órfãos na agenda do
// advogado — prazos de um caso que não existe mais.
async function limparEventosDoProcesso(usuarioId, processoId) {
  try {
    if (!isConfigured()) return;
    const auth = await clienteDoUsuario(usuarioId);
    if (!auth) return;

    const [prazos, tarefas, parcelas] = await Promise.all([
      prisma.prazo.findMany({ where: { processoId, googleEventId: { not: null } }, select: { googleEventId: true } }),
      prisma.tarefa.findMany({ where: { processoId, googleEventId: { not: null } }, select: { googleEventId: true } }),
      prisma.parcela.findMany({ where: { honorario: { processoId }, googleEventId: { not: null } }, select: { googleEventId: true } }),
    ]);

    for (const { googleEventId } of [...prazos, ...tarefas, ...parcelas]) {
      await deletarEventoGoogle(usuarioId, googleEventId);
    }
  } catch (err) {
    logger.warn(`Limpeza de eventos do processo falhou: ${err.message}`);
  }
}

module.exports = {
  isConfigured,
  gerarAuthUrl,
  conectarComCodigo,
  desconectar,
  criarEventoGoogle,
  atualizarEventoGoogle,
  deletarEventoGoogle,
  sincronizarPrazoTarefa,
  sincronizarPrazoProcesso,
  sincronizarParcela,
  sincronizarTudo,
  limparEventosDoProcesso,
};
