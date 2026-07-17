// ══════════════════════════════════════════════════════════════════
//  JuriX — cria (ou promove) o administrador global
//
//  Uso:  node scripts/criar-admin.js <email> <senha> [nome]
//  Ex.:  node scripts/criar-admin.js jurixadmin@gmail.com 'MinhaSenha'
//
//  Existe para que NINGUÉM precise inserir usuário direto no banco: em
//  16/jul/2026 uma conta criada à mão no phpMyAdmin ficou com a senha em
//  texto puro, e como o login usa bcrypt.compare() a comparação dava false
//  para sempre. O app funcionava enquanto o token durava e trancava todo
//  mundo do lado de fora no primeiro "Sair".
//
//  ADMIN_GLOBAL fica sem unidade: ele está acima de todas.
// ══════════════════════════════════════════════════════════════════
// As dependências vivem em backend/node_modules — mesmo padrão do ativar-plano.js.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });
const bcrypt = require(path.join(__dirname, '..', 'backend', 'node_modules', 'bcryptjs'));
const { PrismaClient } = require(path.join(__dirname, '..', 'backend', 'node_modules', '@prisma', 'client'));

const prisma = new PrismaClient();

async function main() {
  const [email, senha, ...restoNome] = process.argv.slice(2);
  const nome = restoNome.join(' ') || 'Administrador JuriX';

  if (!email || !senha) {
    console.error('\nUso: node scripts/criar-admin.js <email> <senha> [nome]\n');
    process.exit(1);
  }
  if (senha.length < 8) {
    console.error('\n[!] A senha precisa ter no mínimo 8 caracteres.\n');
    process.exit(1);
  }

  const hash = await bcrypt.hash(senha, 12);
  const existente = await prisma.usuario.findUnique({ where: { email } });

  const usuario = existente
    ? await prisma.usuario.update({
        where: { email },
        data: { senha: hash, perfil: 'ADMIN_GLOBAL', unidadeId: null, ativo: true },
        select: { id: true, nome: true, email: true, perfil: true },
      })
    : await prisma.usuario.create({
        data: {
          nome,
          email,
          senha: hash,
          perfil: 'ADMIN_GLOBAL',
          plano: 'VITALICIO',
          aceitouTermos: true,
          ativo: true,
        },
        select: { id: true, nome: true, email: true, perfil: true },
      });

  // Confere que a senha informada realmente entra — pega hash corrompido ou
  // senha gravada fora do formato antes de o usuário descobrir na marra.
  const conf = await prisma.usuario.findUnique({ where: { id: usuario.id }, select: { senha: true } });
  const funciona = await bcrypt.compare(senha, conf.senha);

  console.log(`\n${existente ? '✓ Conta existente promovida' : '✓ Conta criada'}: ${usuario.email}`);
  console.log(`  perfil: ${usuario.perfil}`);
  console.log(`  login com a senha informada: ${funciona ? 'OK' : 'FALHOU — não use esta conta'}`);
  if (!funciona) process.exit(1);
  console.log('');
}

main()
  .catch((e) => { console.error('\n[!] Erro:', e.message, '\n'); process.exit(1); })
  .finally(() => prisma.$disconnect());
