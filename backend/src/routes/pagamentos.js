const router = require('express').Router();
const auth = require('../middlewares/auth');
const { prisma } = require('../config/database');
const logger = require('../config/logger');
const { situacaoPlano } = require('../middlewares/limitePlano');

router.use(auth);

// ─── Situação do plano do usuário ──────────────────
// Alimenta o aviso de limite no frontend: quantos processos a conta tem, se
// ainda pode criar outro e se já está acima da cota (modo somente-leitura).
// Lê do banco, não do cache de 5 min do auth, para refletir uma assinatura
// ativada agora mesmo.
router.get('/status-plano', async (req, res, next) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.usuario.id },
      select: { id: true, plano: true, planoExpiracao: true, perfil: true },
    });
    if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado.' });
    res.json(await situacaoPlano(usuario));
  } catch (err) { next(err); }
});

// Link de pagamento fixo do Mercado Pago (checkout do plano Mensal — R$80).
// Pode ser sobrescrito via env MERCADOPAGO_LINK_MENSAL.
const LINK_MENSAL = process.env.MERCADOPAGO_LINK_MENSAL || 'https://mpago.la/31StmvJ';

// ─── Planos disponíveis ────────────────────────────
router.get('/planos', (req, res) => {
  res.json({
    planos: [
      {
        id: 'mensal',
        nome: 'Mensal',
        preco: 80.00,
        descricao: 'Acesso completo ao JuriX por 1 mês',
        recursos: [
          'Processos ilimitados',
          'Integração DataJud CNJ',
          'Monitoramento automático',
          'Notificações em tempo real',
          'Suporte por e-mail',
        ],
      },
      {
        id: 'anual',
        nome: 'Anual',
        preco: 59.90,
        precoTotal: 718.80,
        descricao: 'Acesso completo ao JuriX por 12 meses — 25% OFF',
        recursos: [
          'Tudo do plano Mensal',
          '25% de desconto',
          'Suporte prioritário',
          'Relatórios avançados',
          'Backup automático de documentos',
        ],
        destaque: true,
      },
    ],
  });
});

// ─── Criar preferência Mercado Pago ────────────────
router.post('/criar-preferencia', async (req, res, next) => {
  try {
    const { plano } = req.body;

    // Plano Mensal: usa o link de pagamento fixo do Mercado Pago (R$80).
    if (plano !== 'anual') {
      return res.json({
        preferencia: {
          id: `jurix_${req.usuario.id}_${Date.now()}`,
          plano: 'mensal',
          titulo: 'JuriX Plano Mensal',
          preco: 80.00,
          init_point: LINK_MENSAL,
        },
      });
    }

    // Plano Anual ainda não possui link de pagamento configurado.
    return res.status(503).json({
      indisponivel: true,
      error: 'O plano Anual ainda não está disponível para compra online. Fale com o suporte.',
    });
  } catch (err) { next(err); }
});

// ─── Webhook Mercado Pago ──────────────────────────
router.post('/webhook', async (req, res, next) => {
  try {
    const { type, data } = req.body;
    if (type === 'payment') {
      logger.info(`Webhook MP: pagamento ${data?.id}`);
      // Processar pagamento e atualizar plano do usuário
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
