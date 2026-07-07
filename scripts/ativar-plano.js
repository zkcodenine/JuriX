// ══════════════════════════════════════════════════════════════════
//  JuriX — Ativação manual de plano
//
//  Sobe a conta de um usuário para um plano pago após confirmar o
//  pagamento no painel do Mercado Pago.
//
//  Uso:
//    node scripts/ativar-plano.js <email> [mensal|anual|vitalicio] [meses]
//
//  Exemplos:
//    node scripts/ativar-plano.js cliente@email.com            → Mensal (30 dias)
//    node scripts/ativar-plano.js cliente@email.com anual      → Anual (12 meses)
//    node scripts/ativar-plano.js cliente@email.com vitalicio  → Vitalício (sem expiração)
//    node scripts/ativar-plano.js cliente@email.com mensal 3   → Mensal com 3 meses
// ══════════════════════════════════════════════════════════════════

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });

const { PrismaClient } = require(path.join(__dirname, '..', 'backend', 'node_modules', '@prisma', 'client'));
const prisma = new PrismaClient();

const MAP = {
  mensal:    { plano: 'MENSAL',    mesesPadrao: 1 },
  anual:     { plano: 'ANUAL',     mesesPadrao: 12 },
  vitalicio: { plano: 'VITALICIO', mesesPadrao: null },
};

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase();
  const tipo = (process.argv[3] || 'mensal').trim().toLowerCase();
  const mesesArg = process.argv[4] ? parseInt(process.argv[4], 10) : null;

  if (!email) {
    console.error('\n[!] Informe o e-mail: node scripts/ativar-plano.js <email> [mensal|anual|vitalicio] [meses]\n');
    process.exit(1);
  }
  const cfg = MAP[tipo];
  if (!cfg) {
    console.error(`\n[!] Plano inválido: "${tipo}". Use: mensal, anual ou vitalicio.\n`);
    process.exit(1);
  }

  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario) {
    console.error(`\n[!] Usuário não encontrado: ${email}\n`);
    process.exit(1);
  }

  let planoExpiracao = null;
  if (cfg.plano !== 'VITALICIO') {
    const meses = mesesArg || cfg.mesesPadrao;
    planoExpiracao = new Date();
    planoExpiracao.setMonth(planoExpiracao.getMonth() + meses);
  }

  await prisma.usuario.update({
    where: { email },
    data: { plano: cfg.plano, planoExpiracao, ativo: true },
  });

  console.log('\n✓ Plano ativado com sucesso');
  console.log(`  Usuário : ${usuario.nome} <${email}>`);
  console.log(`  Plano   : ${cfg.plano}`);
  console.log(`  Expira  : ${planoExpiracao ? planoExpiracao.toLocaleString('pt-BR') : 'nunca (vitalício)'}`);
  console.log('\n  Obs: se o app estiver aberto, o usuário deve sair e entrar de novo para o plano atualizar.\n');
}

main()
  .catch((e) => { console.error('\n[!] Erro:', e.message, '\n'); process.exit(1); })
  .finally(() => prisma.$disconnect());
