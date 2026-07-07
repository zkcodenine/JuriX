const router = require('express').Router();
const auth = require('../middlewares/auth');
const { prisma } = require('../config/database');
const logger = require('../config/logger');

router.use(auth);

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
