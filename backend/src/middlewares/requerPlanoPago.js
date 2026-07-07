// ══════════════════════════════════════════════════════
//  JuriX — Gate de plano pago
//  Bloqueia recursos exclusivos dos planos pagos para
//  contas GRATUITO. Usado nas rotas de DataJud/CNJ e
//  monitoramento automático.
// ══════════════════════════════════════════════════════

const PLANOS_PAGOS = ['MENSAL', 'ANUAL', 'VITALICIO'];

// Retorna true se o usuário tem um plano pago vigente.
// VITALICIO nunca expira. Demais planos respeitam planoExpiracao (se definida).
function planoAtivo(usuario) {
  if (!usuario || !PLANOS_PAGOS.includes(usuario.plano)) return false;
  if (usuario.plano === 'VITALICIO') return true;
  if (usuario.planoExpiracao && new Date(usuario.planoExpiracao) < new Date()) return false;
  return true;
}

// Middleware factory: bloqueia GRATUITO com 403 + upgrade:true.
function requerPlanoPago(recurso = 'Este recurso') {
  return (req, res, next) => {
    if (planoAtivo(req.usuario)) return next();
    return res.status(403).json({
      error: `${recurso} está disponível apenas nos planos pagos. Faça upgrade para desbloquear.`,
      upgrade: true,
    });
  };
}

module.exports = requerPlanoPago;
module.exports.planoAtivo = planoAtivo;
module.exports.PLANOS_PAGOS = PLANOS_PAGOS;
