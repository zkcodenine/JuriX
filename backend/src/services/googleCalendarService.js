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
  const inicio = new Date(`${dateStr}T09:00:00-03:00`);
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

module.exports = {
  isConfigured,
  gerarAuthUrl,
  conectarComCodigo,
  desconectar,
  criarEventoGoogle,
  atualizarEventoGoogle,
  deletarEventoGoogle,
  sincronizarPrazoTarefa,
};
