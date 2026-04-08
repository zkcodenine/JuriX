// ══════════════════════════════════════════════════
//  JuriX — Seed do banco de dados
//  Cria um usuário demo para teste
//  Execute: npm run db:seed
// ══════════════════════════════════════════════════
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do JuriX...');

  // Usuário demo
  const senhaHash = await bcrypt.hash('jurix123', 12);
  const usuario = await prisma.usuario.upsert({
    where: { email: 'demo@jurix.com.br' },
    update: {},
    create: {
      nome: 'Dr. Demo Silva',
      email: 'demo@jurix.com.br',
      senha: senhaHash,
      oab: 'SP 123456',
      aceitouTermos: true,
    },
  });
  console.log(`✅ Usuário demo criado: ${usuario.email}`);

  // Processo de exemplo
  const processo = await prisma.processo.upsert({
    where: { numeroCnj: '0001234-56.2024.8.26.0100' },
    update: {},
    create: {
      usuarioId: usuario.id,
      numero: '1234/2024',
      numeroCnj: '0001234-56.2024.8.26.0100',
      tribunal: 'TJSP',
      vara: '1ª Vara Cível',
      classe: 'Procedimento Comum',
      assunto: 'Indenização por Danos Morais',
      status: 'ATIVO',
      origemDados: 'manual',
      partes: {
        create: [
          { nome: 'João da Silva',     tipo: 'AUTOR' },
          { nome: 'Empresa ABC Ltda.', tipo: 'REU' },
        ],
      },
      movimentacoes: {
        create: [
          { data: new Date('2024-03-01'), descricao: 'Distribuição do processo', origemApi: 'manual' },
          { data: new Date('2024-03-10'), descricao: 'Despacho: cite-se a parte ré', origemApi: 'manual' },
          { data: new Date('2024-03-20'), descricao: 'Juntada de contestação', origemApi: 'manual' },
        ],
      },
      prazos: {
        create: [
          {
            titulo: 'Prazo para réplica',
            dataVencimento: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // +5 dias
            tipo: 'PROCESSUAL',
          },
        ],
      },
    },
  });
  console.log(`✅ Processo demo criado: ${processo.numero}`);

  console.log('\n🏛️  JuriX seed concluído!');
  console.log('\n  Login de teste:');
  console.log('  E-mail: demo@jurix.com.br');
  console.log('  Senha:  jurix123\n');
}

main()
  .catch(e => { console.error('❌ Erro no seed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
