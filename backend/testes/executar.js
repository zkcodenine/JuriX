#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════
//  JuriX — testes de regressão
//
//  Roda todas as suítes de backend/testes/suites contra a API de
//  verdade e imprime um relatório com veredito de liberação.
//
//  Uso:
//    node backend/testes/executar.js                 todas as suítes
//    node backend/testes/executar.js agenda planos   só essas
//    node backend/testes/executar.js --listar        mostra as suítes
//    node backend/testes/executar.js --base https://nossosflows.com.br/jurix/api
//
//  Sai com código 1 se algo falhar — serve direto em CI ou num hook
//  de pré-build.
// ══════════════════════════════════════════════════════════════════
'use strict';

const fs = require('fs');
const path = require('path');

const {
  prisma, cores: c, relatorio,
  criarContexto, criarCliente, criarFabrica, subirServidor,
} = require('./lib/harness');

const PASTA_SUITES = path.join(__dirname, 'suites');

// ─── Argumentos ───────────────────────────────────────────────────
const args = process.argv.slice(2);
const idxBase = args.indexOf('--base');
const baseRemota = idxBase >= 0 ? args[idxBase + 1] : null;
const soListar = args.includes('--listar');
// Tudo que não é flag nem o valor de --base é nome (ou pedaço do nome)
// de suíte. `idxBase < 0` significa que --base nem foi passado, então
// nenhum índice deve ser descartado.
const filtros = args.filter((a, i) =>
  !a.startsWith('--') && !(idxBase >= 0 && i === idxBase + 1)
);

function carregarSuites() {
  return fs.readdirSync(PASTA_SUITES)
    .filter((f) => f.endsWith('.suite.js'))
    .sort()
    .map((arquivo) => {
      const suite = require(path.join(PASTA_SUITES, arquivo));
      return { arquivo, chave: arquivo.replace('.suite.js', ''), ...suite };
    });
}

function cabecalho(texto) {
  const linha = '─'.repeat(Math.max(0, 64 - texto.length));
  console.log(`\n${c.negrito(texto)} ${c.cinza(linha)}`);
}

async function main() {
  const todas = carregarSuites();

  if (soListar) {
    console.log('\nSuítes disponíveis:\n');
    for (const s of todas) console.log(`  ${s.chave.padEnd(18)} ${c.cinza(s.nome)}`);
    console.log('');
    process.exit(0);
  }

  const suites = filtros.length
    ? todas.filter((s) => filtros.some((f) => s.chave.includes(f)))
    : todas;

  if (!suites.length) {
    console.error(`\nNenhuma suíte casa com: ${filtros.join(', ')}\n`);
    process.exit(1);
  }

  console.log(c.negrito('\n╔════════════════════════════════════════════════════════════════╗'));
  console.log(c.negrito('║  JuriX — Testes de regressão                                   ║'));
  console.log(c.negrito('╚════════════════════════════════════════════════════════════════╝'));

  // ─── Onde testar ────────────────────────────────────────────────
  let server = null;
  let base = baseRemota;

  if (baseRemota) {
    console.log(`\nAlvo: ${c.amarelo(baseRemota)} (servidor remoto)`);
    console.log(c.cinza('Suítes que escrevem direto no banco serão puladas.'));
  } else {
    const subido = await subirServidor();
    server = subido.server;
    base = subido.base;
    console.log(`\nAlvo: ${c.cinza(base)} (instância local em memória)`);
    console.log(c.cinza(`Banco: ${String(process.env.DATABASE_URL || '').replace(/:\/\/([^:]+):[^@]+@/, '://$1:***@')}`));
  }

  const req = criarCliente(base);

  // Conferência de fumaça antes de tudo: se o banco não responde, o
  // relatório viraria 200 falhas sem sentido.
  const saude = await req('GET', '/auth/health', null).catch(() => ({ status: 0 }));
  if (saude.status !== 200) {
    console.error(c.vermelho(`\n[!] A API não respondeu em ${base} (status ${saude.status}).`));
    console.error(c.cinza('    Verifique a DATABASE_URL em backend/.env ou o endereço passado em --base.\n'));
    server?.close();
    await prisma.$disconnect();
    process.exit(1);
  }

  const comeco = Date.now();

  for (const suite of suites) {
    cabecalho(suite.nome);

    if (baseRemota && suite.precisaDeBanco) {
      const t = criarContexto(suite.nome);
      t.pular(suite.nome, 'precisa de acesso direto ao banco');
      continue;
    }

    const t = criarContexto(suite.nome);
    const marca = `reg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const fabrica = criarFabrica(marca, req);

    try {
      await suite.executar({ t, req, fabrica, prisma, marca, base });
    } catch (erro) {
      t.falha(`a suíte parou no meio: ${erro.message}`, erro.stack?.split('\n')[1]?.trim());
    } finally {
      // A limpeza roda mesmo se a suíte explodir — senão o banco do
      // usuário vai juntando lixo a cada execução.
      try {
        await fabrica.limpar();
      } catch (erro) {
        console.log(`    ${c.amarelo('!')} ${c.cinza(`limpeza parcial: ${erro.message}`)}`);
      }
    }
  }

  server?.close();

  // ─── Relatório ──────────────────────────────────────────────────
  const segundos = ((Date.now() - comeco) / 1000).toFixed(1);
  const { passou, falhou, pulou } = relatorio;

  cabecalho('Resumo');
  for (const s of relatorio.suites) {
    const sinal = s.falhou ? c.vermelho('FALHOU') : c.verde('ok');
    console.log(
      `  ${String(s.nome).padEnd(34)} ${String(s.passou).padStart(3)} ok` +
      `${s.falhou ? c.vermelho(`  ${s.falhou} falha(s)`) : ''}` +
      `${s.pulou ? c.amarelo(`  ${s.pulou} pulado(s)`) : ''}` +
      `   ${sinal}`
    );
  }

  if (falhou) {
    cabecalho('Falhas');
    for (const s of relatorio.suites) {
      for (const f of s.falhas) {
        console.log(`  ${c.vermelho('✗')} [${s.nome}] ${f.descricao}`);
        if (f.detalhe) console.log(`      ${c.cinza(f.detalhe)}`);
      }
    }
  }

  console.log('');
  console.log(`  ${c.verde(`${passou} passaram`)}  ${falhou ? c.vermelho(`${falhou} falharam`) : '0 falharam'}` +
              `  ${pulou ? c.amarelo(`${pulou} pulados`) : '0 pulados'}  ${c.cinza(`em ${segundos}s`)}`);

  console.log('');
  if (falhou === 0) {
    console.log(c.verde(c.negrito('  ✓ LIBERADO — nenhuma regressão encontrada.')));
  } else {
    console.log(c.vermelho(c.negrito(`  ✗ NÃO LIBERAR — ${falhou} verificação(ões) falharam.`)));
  }
  console.log('');

  await prisma.$disconnect();
  process.exit(falhou > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(c.vermelho('\n[!] Erro ao executar os testes:'), e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
