// ══════════════════════════════════════════════════════
//  JuriX — Limite do plano gratuito
//
//  Regra de negócio: a conta gratuita vai até 5 processos. Acima disso é
//  preciso assinar. Até aqui o limite existia em UM lugar só (criar processo)
//  e tinha dois furos:
//
//    1. olhava `plano === 'GRATUITO'`, então quem assinou o MENSAL e deixou
//       vencer continuava com processos ilimitados para sempre;
//    2. quem já estava acima do limite quando o plano venceu seguia usando o
//       sistema inteiro normalmente.
//
//  Aqui a checagem passa a usar `planoAtivo()` (que respeita a expiração) e
//  vale para toda escrita enquanto a conta estiver acima da cota.
//
//  O que NUNCA é bloqueado, de propósito:
//    • leitura (GET) — os dados são do cliente, não ficam reféns;
//    • exclusão (DELETE) — é justamente como ele volta para dentro da cota;
//    • login, perfil, planos e pagamento — senão não haveria como assinar.
// ══════════════════════════════════════════════════════
const { prisma } = require('../config/database');
const { planoAtivo } = require('./requerPlanoPago');

const LIMITE_GRATUITO = Number(process.env.LIMITE_PROCESSOS_GRATUITO || 5);

// ADMIN_GLOBAL administra o sistema — nunca é barrado por cota.
function isentoDeCota(usuario) {
  return usuario?.perfil === 'ADMIN_GLOBAL';
}

async function contarProcessos(usuarioId) {
  return prisma.processo.count({ where: { usuarioId } });
}

// Fotografia do plano do usuário — usada pelo gate e pela rota de status que
// alimenta o aviso no frontend.
async function situacaoPlano(usuario) {
  const ativo = planoAtivo(usuario) || isentoDeCota(usuario);
  const processos = await contarProcessos(usuario.id);

  return {
    plano: usuario.plano,
    planoExpiracao: usuario.planoExpiracao || null,
    expirado: Boolean(
      !ativo && usuario.plano !== 'GRATUITO' && usuario.planoExpiracao
    ),
    ativo,
    processos,
    limite: LIMITE_GRATUITO,
    restantes: ativo ? null : Math.max(0, LIMITE_GRATUITO - processos),
    podeCriarProcesso: ativo || processos < LIMITE_GRATUITO,
    // Acima da cota: o sistema entra em modo somente-leitura até assinar ou
    // excluir processos.
    bloqueado: !ativo && processos > LIMITE_GRATUITO,
  };
}

const METODOS_LIVRES = ['GET', 'HEAD', 'OPTIONS', 'DELETE'];

// Gate de escrita. Usar logo depois do `auth` nas rotas de conteúdo.
async function bloqueiaEscritaSemPlano(req, res, next) {
  try {
    if (METODOS_LIVRES.includes(req.method)) return next();
    if (isentoDeCota(req.usuario)) return next();
    if (planoAtivo(req.usuario)) return next();

    const processos = await contarProcessos(req.usuario.id);
    if (processos <= LIMITE_GRATUITO) return next();

    return res.status(403).json({
      error: `Sua conta tem ${processos} processos e o plano gratuito permite até ${LIMITE_GRATUITO}. `
           + 'Assine um plano para voltar a editar, ou exclua processos até ficar dentro do limite.',
      upgrade: true,
      limiteExcedido: true,
      processos,
      limite: LIMITE_GRATUITO,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  LIMITE_GRATUITO,
  contarProcessos,
  situacaoPlano,
  bloqueiaEscritaSemPlano,
  isentoDeCota,
};
