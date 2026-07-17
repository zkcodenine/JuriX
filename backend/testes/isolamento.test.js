// ══════════════════════════════════════════════════════════════════
//  Teste de isolamento entre usuários — o mais importante do sistema.
//
//  O JuriX isola dados com `usuarioId: req.usuario.id` repetido em ~78
//  lugares. O compartilhamento troca "sou dono" por "tenho acesso" nesses
//  pontos, e um erro aqui vaza processo de um cliente para outro — o pior
//  defeito possível num sistema jurídico.
//
//  Este teste sobe a API de verdade e ataca pela borda (HTTP), com usuários
//  reais criados na hora e apagados no fim. Roda contra o banco configurado
//  em backend/.env.
//
//  Uso:  node testes/isolamento.test.js
// ══════════════════════════════════════════════════════════════════
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const PORTA = 3999;
const BASE = `http://localhost:${PORTA}/api`;

let passou = 0;
let falhou = 0;

function ok(desc) { passou++; console.log(`  \x1b[32m✓\x1b[0m ${desc}`); }
function erro(desc, detalhe) { falhou++; console.log(`  \x1b[31m✗ ${desc}\x1b[0m\n      ${detalhe}`); }

function checar(desc, condicao, detalhe = '') {
  condicao ? ok(desc) : erro(desc, detalhe);
}

async function req(metodo, caminho, token, corpo) {
  const res = await fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(corpo ? { body: JSON.stringify(corpo) } : {}),
  });
  let dados = null;
  try { dados = await res.json(); } catch { /* sem corpo */ }
  return { status: res.status, dados };
}

const marca = `iso_${Date.now()}`;
const criados = { usuarios: [], processos: [], unidades: [] };

async function criarUsuario(apelido, unidadeId) {
  const u = await prisma.usuario.create({
    data: {
      nome: `Teste ${apelido}`,
      email: `${marca}_${apelido}@teste.local`,
      senha: await bcrypt.hash('SenhaTeste123', 12),
      plano: 'VITALICIO',
      aceitouTermos: true,
      unidadeId, // compartilhar exige colegas da mesma unidade
    },
  });
  criados.usuarios.push(u.id);
  const { dados } = await req('POST', '/auth/login', null, { email: u.email, senha: 'SenhaTeste123' });
  return { id: u.id, email: u.email, token: dados.token };
}

async function main() {
  process.env.PORT = String(PORTA);
  process.env.NODE_ENV = 'test';
  const app = require('../src/app');
  const server = app.listen(PORTA);
  await new Promise((r) => server.once('listening', r));

  console.log('\n── Isolamento entre usuários ──────────────────────\n');

  // Alice e Bob são colegas do mesmo escritório. Carol é de OUTRO escritório —
  // ela existe para provar que compartilhar não atravessa unidades.
  const unidadeA = await prisma.unidade.create({ data: { nome: `${marca}_escritorio_A` } });
  const unidadeB = await prisma.unidade.create({ data: { nome: `${marca}_escritorio_B` } });
  criados.unidades.push(unidadeA.id, unidadeB.id);

  const alice = await criarUsuario('alice', unidadeA.id);
  const bob = await criarUsuario('bob', unidadeA.id);
  const carol = await criarUsuario('carol', unidadeB.id);

  // Alice cria um processo particular dela.
  const { dados: proc } = await req('POST', '/processos', alice.token, {
    numero: `${marca}-PARTICULAR`,
    classe: 'Segredo de justiça',
    partes: [{ nome: 'Cliente da Alice', tipo: 'AUTOR' }],
  });
  criados.processos.push(proc.id);

  // ─── 1. Sem compartilhamento, Bob não pode ver NADA ──
  console.log('Sem compartilhamento:');

  const listaBob = await req('GET', '/processos', bob.token);
  checar(
    'processo da Alice não aparece na lista do Bob',
    !JSON.stringify(listaBob.dados).includes(proc.id),
    `lista do Bob: ${JSON.stringify(listaBob.dados?.processos?.map((p) => p.numero))}`
  );

  const obterBob = await req('GET', `/processos/${proc.id}`, bob.token);
  checar('GET /processos/:id do processo alheio → 404', obterBob.status === 404, `veio ${obterBob.status}`);

  const editarBob = await req('PUT', `/processos/${proc.id}`, bob.token, { classe: 'Invadido' });
  checar('PUT /processos/:id alheio → 404', editarBob.status === 404, `veio ${editarBob.status}`);

  const deletarBob = await req('DELETE', `/processos/${proc.id}`, bob.token);
  checar('DELETE /processos/:id alheio → 404', deletarBob.status === 404, `veio ${deletarBob.status}`);

  const buscaBob = await req('GET', `/processos/busca?q=${marca}-PARTICULAR`, bob.token);
  checar('busca do Bob não encontra o processo da Alice', !JSON.stringify(buscaBob.dados).includes(proc.id));

  for (const sub of ['movimentacoes', 'tarefas', 'documentos', 'prazos', 'partes', 'anotacoes', 'honorarios']) {
    const r = await req('GET', `/processos/${proc.id}/${sub}`, bob.token);
    const vazio = r.status === 404 || (Array.isArray(r.dados) && r.dados.length === 0);
    checar(`sub-recurso /${sub} não vaza`, vazio, `status ${r.status}, corpo ${JSON.stringify(r.dados).slice(0, 80)}`);
  }

  const mensagensBob = await req('GET', `/processos/${proc.id}/mensagens`, bob.token);
  checar('chat do processo alheio → 404', mensagensBob.status === 404, `veio ${mensagensBob.status}`);

  const postarBob = await req('POST', `/processos/${proc.id}/mensagens`, bob.token, { texto: 'invadindo' });
  checar('postar no chat alheio → 404', postarBob.status === 404, `veio ${postarBob.status}`);

  // Bob não pode compartilhar processo que não é dele.
  const compartilharBob = await req('POST', `/processos/${proc.id}/compartilhar`, bob.token, {
    usuarioId: bob.id, nivel: 'EDICAO',
  });
  checar('Bob não consegue compartilhar processo alheio consigo mesmo',
    compartilharBob.status === 404 || compartilharBob.status === 403, `veio ${compartilharBob.status}`);

  // Compartilhar é dentro do escritório: a Carol é de outra unidade.
  const paraCarol = await req('POST', `/processos/${proc.id}/compartilhar`, alice.token, {
    usuarioId: carol.id, nivel: 'LEITURA',
  });
  checar('não dá para compartilhar com quem é de outra unidade → 403',
    paraCarol.status === 403, `veio ${paraCarol.status}`);

  const carolVe = await req('GET', `/processos/${proc.id}`, carol.token);
  checar('Carol (outra unidade) continua sem ver → 404', carolVe.status === 404, `veio ${carolVe.status}`);

  // ─── 2. Compartilhado como LEITURA ──────────────────
  console.log('\nCompartilhado como LEITURA:');
  const share = await req('POST', `/processos/${proc.id}/compartilhar`, alice.token, { usuarioId: bob.id, nivel: 'LEITURA' });
  checar('Alice compartilha com o colega Bob → 201', share.status === 201,
    `veio ${share.status}: ${JSON.stringify(share.dados)}`);

  const verBob = await req('GET', `/processos/${proc.id}`, bob.token);
  checar('Bob agora VÊ o processo', verBob.status === 200, `veio ${verBob.status}`);

  const listaBob2 = await req('GET', '/processos', bob.token);
  checar('processo aparece na lista do Bob', JSON.stringify(listaBob2.dados).includes(proc.id));

  const editarLeitura = await req('PUT', `/processos/${proc.id}`, bob.token, { classe: 'Nao deveria' });
  checar('LEITURA não pode editar → 403', editarLeitura.status === 403, `veio ${editarLeitura.status}`);

  const anotarLeitura = await req('POST', `/processos/${proc.id}/anotacoes`, bob.token, { titulo: 'x', conteudo: 'y' });
  checar('LEITURA não pode criar anotação → 403', anotarLeitura.status === 403, `veio ${anotarLeitura.status}`);

  const deletarLeitura = await req('DELETE', `/processos/${proc.id}`, bob.token);
  checar('LEITURA não pode excluir → 403', deletarLeitura.status === 403, `veio ${deletarLeitura.status}`);

  const chatLeitura = await req('POST', `/processos/${proc.id}/mensagens`, bob.token, { texto: 'oi, sou o Bob' });
  checar('LEITURA PODE participar do chat', chatLeitura.status === 201, `veio ${chatLeitura.status}`);

  // ─── 3. Compartilhado como EDICAO ───────────────────
  console.log('\nCompartilhado como EDICAO:');
  await req('POST', `/processos/${proc.id}/compartilhar`, alice.token, { usuarioId: bob.id, nivel: 'EDICAO' });

  const editarEdicao = await req('PUT', `/processos/${proc.id}`, bob.token, { classe: 'Editado pelo Bob' });
  checar('EDICAO pode editar', editarEdicao.status === 200, `veio ${editarEdicao.status}`);

  const deletarEdicao = await req('DELETE', `/processos/${proc.id}`, bob.token);
  checar('EDICAO ainda NÃO pode excluir (só o dono) → 403', deletarEdicao.status === 403, `veio ${deletarEdicao.status}`);

  const recompartilhar = await req('POST', `/processos/${proc.id}/compartilhar`, bob.token, { usuarioId: alice.id, nivel: 'EDICAO' });
  checar('EDICAO não pode recompartilhar (só o dono) → 403', recompartilhar.status === 403, `veio ${recompartilhar.status}`);

  // ─── 4. Revogado ────────────────────────────────────
  console.log('\nApós revogar:');
  await req('DELETE', `/processos/${proc.id}/compartilhar/${bob.id}`, alice.token);

  const depoisRevogar = await req('GET', `/processos/${proc.id}`, bob.token);
  checar('Bob perde o acesso → 404', depoisRevogar.status === 404, `veio ${depoisRevogar.status}`);

  const listaFinal = await req('GET', '/processos', bob.token);
  checar('processo some da lista do Bob', !JSON.stringify(listaFinal.dados).includes(proc.id));

  const chatRevogado = await req('GET', `/processos/${proc.id}/mensagens`, bob.token);
  checar('chat fecha junto → 404', chatRevogado.status === 404, `veio ${chatRevogado.status}`);

  // ─── Limpeza ────────────────────────────────────────
  server.close();
  await prisma.mensagemProcesso.deleteMany({ where: { processoId: { in: criados.processos } } });
  await prisma.processoCompartilhado.deleteMany({ where: { processoId: { in: criados.processos } } });
  await prisma.parte.deleteMany({ where: { processoId: { in: criados.processos } } });
  await prisma.anotacao.deleteMany({ where: { processoId: { in: criados.processos } } });
  await prisma.processo.deleteMany({ where: { id: { in: criados.processos } } });
  await prisma.notificacao.deleteMany({ where: { usuarioId: { in: criados.usuarios } } });
  await prisma.usuario.deleteMany({ where: { id: { in: criados.usuarios } } });
  await prisma.unidade.deleteMany({ where: { id: { in: criados.unidades } } });

  console.log(`\n── ${passou} passaram, ${falhou} falharam ──\n`);
  process.exit(falhou > 0 ? 1 : 0);
}

main().catch((e) => { console.error('\nErro no teste:', e); process.exit(1); });
