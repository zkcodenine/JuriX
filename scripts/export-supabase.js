// ══════════════════════════════════════════════════════════════════
//  JuriX — Export de dados do Supabase (PostgreSQL)
//
//  Lê todas as tabelas do banco PostgreSQL antigo e gera arquivos
//  JSON em backup/supabase_dump/ que podem depois ser importados
//  no banco MySQL HostGator via import-hostgator.js.
//
//  Pré-requisitos:
//    1. Definir LEGACY_SUPABASE_URL no backend/.env apontando para
//       o banco PostgreSQL antigo.
//    2. Instalar dependência: npm install pg --save-optional
//
//  Execute: node scripts/export-supabase.js
// ══════════════════════════════════════════════════════════════════

const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });

let Client;
try {
  ({ Client } = require('pg'));
} catch {
  console.error('\n[!] Dependência "pg" não encontrada.');
  console.error('    Execute: cd backend && npm install pg --no-save\n');
  process.exit(1);
}

const LEGACY_URL = process.env.LEGACY_SUPABASE_URL || process.env.DATABASE_URL;
if (!LEGACY_URL || !LEGACY_URL.startsWith('postgres')) {
  console.error('\n[!] LEGACY_SUPABASE_URL não configurada em backend/.env');
  console.error('    Defina LEGACY_SUPABASE_URL=postgresql://... apontando para o Supabase antigo.\n');
  process.exit(1);
}

// Ordem importa: tabelas-pai antes de filhas (não obrigatório para export, mas mantém consistência)
const TABLES = [
  'usuarios',
  'processos',
  'partes',
  'advogados_processo',
  'movimentacoes',
  'tarefas',
  'subtarefas',
  'prazos',
  'documentos',
  'honorarios',
  'parcelas',
  'anotacoes',
  'notificacoes',
  'configuracoes',
  'modelos_documento',
  'etiquetas_agenda',
  'eventos_agenda',
  'audit_logs',
];

const OUT_DIR = path.join(__dirname, '..', 'backup', 'supabase_dump');

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const client = new Client({ connectionString: LEGACY_URL });
  console.log('\n→ Conectando ao Supabase (PostgreSQL)...');
  await client.connect();

  const summary = {};
  for (const table of TABLES) {
    try {
      const { rows } = await client.query(`SELECT * FROM "${table}"`);
      const file = path.join(OUT_DIR, `${table}.json`);
      fs.writeFileSync(file, JSON.stringify(rows, null, 2));
      summary[table] = rows.length;
      console.log(`  ✓ ${table.padEnd(25)} ${rows.length.toString().padStart(5)} registros → ${path.relative(process.cwd(), file)}`);
    } catch (err) {
      summary[table] = `ERRO: ${err.message}`;
      console.error(`  ✗ ${table}: ${err.message}`);
    }
  }

  await client.end();

  fs.writeFileSync(
    path.join(OUT_DIR, '_resumo.json'),
    JSON.stringify({ exportedAt: new Date().toISOString(), summary }, null, 2)
  );

  console.log('\n✓ Export concluído. Próximo passo:');
  console.log('  1. Configure DATABASE_URL no backend/.env para o MySQL HostGator');
  console.log('  2. Rode: cd backend && npx prisma db push   (cria as tabelas no MySQL)');
  console.log('  3. Rode: node scripts/import-hostgator.js   (importa os dados)\n');
})().catch(err => {
  console.error('\n[!] Erro inesperado:', err);
  process.exit(1);
});
