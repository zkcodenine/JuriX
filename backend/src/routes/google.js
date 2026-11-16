// ══════════════════════════════════════════════════════
//  JuriX — Rotas de integração Google Agenda
// ══════════════════════════════════════════════════════
const router = require('express').Router();
const auth = require('../middlewares/auth');
const { prisma } = require('../config/database');
const logger = require('../config/logger');
const gcal = require('../services/googleCalendarService');

// ─── Status da conexão (autenticado) ───────────────
router.get('/status', auth, async (req, res, next) => {
  try {
    const u = await prisma.usuario.findUnique({
      where: { id: req.usuario.id },
      select: { googleConnected: true, googleEmail: true },
    });
    res.json({
      configurado: gcal.isConfigured(),
      conectado: Boolean(u?.googleConnected),
      email: u?.googleEmail || null,
    });
  } catch (err) { next(err); }
});

// ─── Gera URL de consentimento (autenticado) ───────
router.get('/auth-url', auth, (req, res) => {
  if (!gcal.isConfigured()) {
    return res.status(503).json({ error: 'Integração Google não configurada no servidor.' });
  }
  res.json({ url: gcal.gerarAuthUrl(req.usuario.id) });
});

// ─── Desconectar (autenticado) ─────────────────────
router.post('/disconnect', auth, async (req, res, next) => {
  try {
    await gcal.desconectar(req.usuario.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─── Sincronizar agora (autenticado) ───────────────
// Espelha na Google Agenda tudo que já está salvo no JuriX e ainda não tem
// evento lá: eventos da agenda, prazos de tarefas, prazos processuais e
// vencimentos de parcelas. Idempotente — pode ser chamado quantas vezes quiser.
router.post('/sincronizar', auth, async (req, res, next) => {
  try {
    const resumo = await gcal.sincronizarTudo(req.usuario.id, {
      incluirPassados: req.body?.incluirPassados === true,
    });
    if (resumo.ignorado) {
      return res.status(400).json({ error: `Não foi possível sincronizar: ${resumo.ignorado}.`, resumo });
    }
    res.json({ ok: true, resumo });
  } catch (err) { next(err); }
});

// ─── Callback do OAuth (SEM auth — vem do Google) ──
// O usuário é identificado pelo `state` (id do usuário JuriX).
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const paginaHtml = (titulo, msg, ok) => `<!doctype html><html lang="pt-br"><head><meta charset="utf-8">
    <title>${titulo}</title><style>
    body{font-family:system-ui,Segoe UI,Arial;background:#0a0a0a;color:#eee;display:flex;
    align-items:center;justify-content:center;height:100vh;margin:0}
    .card{background:#14141c;border:1px solid #2a2a35;border-radius:16px;padding:40px;text-align:center;max-width:420px}
    .ic{font-size:48px;margin-bottom:12px}h1{font-size:18px;margin:0 0 8px}p{color:#9a9aa5;font-size:14px;line-height:1.5}
    </style></head><body><div class="card"><div class="ic">${ok ? '✅' : '⚠️'}</div>
    <h1>${titulo}</h1><p>${msg}</p><p style="margin-top:16px;color:#666">Você já pode fechar esta janela e voltar ao JuriX.</p>
    </div></body></html>`;

  try {
    if (error) return res.status(400).send(paginaHtml('Conexão cancelada', 'A autorização foi negada no Google.', false));
    if (!code || !state) return res.status(400).send(paginaHtml('Falha na conexão', 'Parâmetros ausentes no retorno do Google.', false));

    await gcal.conectarComCodigo(code, state);
    logger.info(`Google Agenda conectada para usuário ${state}`);

    // Espelha retroativamente o que já estava salvo no JuriX. Em segundo plano
    // porque esta página é o retorno do navegador do Google — ela precisa
    // responder já, e o backfill pode levar vários segundos com muitos itens.
    gcal.sincronizarTudo(state)
      .then((r) => logger.info(`Backfill pós-conexão do usuário ${state}: ${JSON.stringify(r)}`))
      .catch((e) => logger.warn(`Backfill pós-conexão falhou: ${e.message}`));

    res.send(paginaHtml(
      'Google Agenda conectada!',
      'Estamos enviando para a sua Google Agenda os compromissos, prazos e vencimentos que já estavam no JuriX. Isso leva alguns segundos.',
      true
    ));
  } catch (err) {
    logger.error('Erro no callback Google:', err.message);
    res.status(500).send(paginaHtml('Falha na conexão', 'Não foi possível concluir a conexão com o Google. Tente novamente.', false));
  }
});

module.exports = router;
