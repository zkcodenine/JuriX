const router = require('express').Router();
const auth = require('../middlewares/auth');
const { prisma } = require('../config/database');
const logger = require('../config/logger');

router.use(auth);

// ─── Planos disponíveis ────────────────────────────
router.get('/planos', (req, res) => {
  res.json({
    planos: [
      {
        id: 'mensal',
        nome: 'Mensal',
        preco: 79.90,
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
    // Integração real com Mercado Pago SDK aqui
    // Por ora retorna estrutura de preferência
    const preco = plano === 'anual' ? 718.80 : 79.90;
    const titulo = plano === 'anual' ? 'JuriX Plano Anual' : 'JuriX Plano Mensal';

    res.json({
      preferencia: {
        id: `jurix_${req.usuario.id}_${Date.now()}`,
        plano,
        titulo,
        preco,
        init_point: `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=DEMO`,
      },
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
