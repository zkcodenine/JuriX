// Verifica se a migração dos anexos foi aplicada.
// Uso:  cd backend   →   node scripts/verificar-migracao.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const linhas = await prisma.$queryRawUnsafe(
      'SELECT COUNT(*) AS total FROM documentos_conteudo'
    );
    const total = Number(linhas[0].total);
    console.log('\n  ✓ Tabela documentos_conteudo EXISTE no banco.');
    console.log(`  ✓ Anexos armazenados: ${total}\n`);
    process.exit(0);
  } catch (e) {
    if (/doesn't exist|não existe|1146/i.test(e.message)) {
      console.error('\n  ✗ A tabela documentos_conteudo NÃO existe.');
      console.error('    A migração ainda não foi aplicada — rode .\\aplicar-migracao.ps1\n');
    } else {
      console.error('\n  ✗ Não consegui consultar o banco:');
      console.error('   ', e.message);
      console.error('    Verifique DATABASE_URL no backend\\.env e o Remote MySQL no cPanel.\n');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
