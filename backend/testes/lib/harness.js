// ══════════════════════════════════════════════════════════════════
//  JuriX — infraestrutura dos testes de regressão
//
//  Os testes atacam a API pela borda (HTTP), como o app faz. Não há
//  mock do banco: cada suíte cria os próprios usuários e dados, com
//  uma marca única, e apaga tudo no fim. Assim o teste exercita o
//  Prisma, os middlewares e as regras de acesso de verdade — que é
//  onde os defeitos deste sistema moram.
//
//  Dois modos:
//    • local   — sobe o Express em memória numa porta livre (padrão)
//    • remoto  — aponta para uma API já no ar (--base https://.../api)
//                Nesse modo as suítes que precisam escrever direto no
//                banco são puladas, porque o banco é do servidor.
// ══════════════════════════════════════════════════════════════════
'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ─── Cores (desligadas quando a saída não é um terminal) ──────────
const tty = process.stdout.isTTY;
const c = {
  verde: (s) => (tty ? `\x1b[32m${s}\x1b[0m` : s),
  vermelho: (s) => (tty ? `\x1b[31m${s}\x1b[0m` : s),
  amarelo: (s) => (tty ? `\x1b[33m${s}\x1b[0m` : s),
  cinza: (s) => (tty ? `\x1b[90m${s}\x1b[0m` : s),
  negrito: (s) => (tty ? `\x1b[1m${s}\x1b[0m` : s),
};

// ─── Relatório acumulado ──────────────────────────────────────────
const relatorio = {
  suites: [],
  get passou() { return this.suites.reduce((n, s) => n + s.passou, 0); },
  get falhou() { return this.suites.reduce((n, s) => n + s.falhou, 0); },
  get pulou() { return this.suites.reduce((n, s) => n + s.pulou, 0); },
};

// ─── Um "t" por suíte: as asserções que a suíte usa ───────────────
function criarContexto(nomeSuite) {
  const resultado = { nome: nomeSuite, passou: 0, falhou: 0, pulou: 0, falhas: [] };
  relatorio.suites.push(resultado);

  const t = {
    ok(descricao) {
      resultado.passou++;
      console.log(`    ${c.verde('✓')} ${descricao}`);
    },
    falha(descricao, detalhe = '') {
      resultado.falhou++;
      resultado.falhas.push({ descricao, detalhe });
      console.log(`    ${c.vermelho('✗ ' + descricao)}`);
      if (detalhe) console.log(`        ${c.cinza(detalhe)}`);
    },
    pular(descricao, motivo = '') {
      resultado.pulou++;
      console.log(`    ${c.amarelo('–')} ${descricao} ${c.cinza(motivo ? `(${motivo})` : '')}`);
    },
    // A asserção básica: condição verdadeira = passou.
    checar(descricao, condicao, detalhe = '') {
      condicao ? t.ok(descricao) : t.falha(descricao, detalhe);
    },
    // Açúcar para o caso mais comum: conferir o status HTTP.
    status(descricao, resposta, esperado) {
      const lista = Array.isArray(esperado) ? esperado : [esperado];
      t.checar(
        descricao,
        lista.includes(resposta.status),
        `esperava ${lista.join(' ou ')}, veio ${resposta.status} — ${JSON.stringify(resposta.dados).slice(0, 160)}`
      );
    },
    igual(descricao, recebido, esperado) {
      t.checar(
        descricao,
        JSON.stringify(recebido) === JSON.stringify(esperado),
        `esperava ${JSON.stringify(esperado)}, veio ${JSON.stringify(recebido)}`
      );
    },
  };

  return t;
}

// ─── Cliente HTTP ─────────────────────────────────────────────────
function criarCliente(base) {
  return async function req(metodo, caminho, token, corpo) {
    // GET/HEAD não podem ter corpo (o fetch do Node lança TypeError), e
    // passar `null` como "sem corpo" é natural ao escrever os testes.
    const semCorpo = corpo === undefined || corpo === null
      || metodo === 'GET' || metodo === 'HEAD';

    const res = await fetch(`${base}${caminho}`, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(semCorpo ? {} : { body: JSON.stringify(corpo) }),
    });
    let dados = null;
    try { dados = await res.json(); } catch { /* resposta sem corpo */ }
    return { status: res.status, dados, headers: res.headers };
  };
}

// ─── Fábrica de dados descartáveis ────────────────────────────────
// Tudo criado leva a mesma marca, então a limpeza acha o que apagar
// mesmo se um teste quebrar no meio.
function criarFabrica(marca, req) {
  const criados = { usuarios: [], processos: [], unidades: [] };

  async function usuario(apelido, extras = {}) {
    const email = `${marca}_${apelido}@teste.local`;
    const senha = 'SenhaTeste123';
    const u = await prisma.usuario.create({
      data: {
        nome: `Teste ${apelido}`,
        email,
        senha: await bcrypt.hash(senha, 12),
        plano: 'VITALICIO',
        aceitouTermos: true,
        ...extras,
      },
    });
    criados.usuarios.push(u.id);
    const { dados } = await req('POST', '/auth/login', null, { email, senha });
    if (!dados?.token) {
      throw new Error(`Login do usuário de teste "${apelido}" falhou: ${JSON.stringify(dados)}`);
    }
    return { id: u.id, email, senha, token: dados.token, perfil: u.perfil };
  }

  async function unidade(nome) {
    const u = await prisma.unidade.create({ data: { nome: `${marca}_${nome}` } });
    criados.unidades.push(u.id);
    return u;
  }

  // Cria processo pela API (passa pelas regras de cota e acesso).
  async function processo(token, dados = {}) {
    const r = await req('POST', '/processos', token, {
      numero: `${marca}-${Math.random().toString(36).slice(2, 8)}`,
      classe: 'Procedimento Comum',
      ...dados,
    });
    if (r.dados?.id) criados.processos.push(r.dados.id);
    return r;
  }

  async function limpar() {
    const { usuarios, processos, unidades } = criados;

    // Também varre pela marca: pega o que foi criado por rotas que o
    // teste não registrou (parcelas, prazos, eventos...).
    const processosDaMarca = await prisma.processo.findMany({
      where: { OR: [{ usuarioId: { in: usuarios } }, { numero: { contains: marca } }] },
      select: { id: true },
    });
    const ids = [...new Set([...processos, ...processosDaMarca.map((p) => p.id)])];

    if (ids.length) {
      await prisma.subtarefa.deleteMany({ where: { tarefa: { processoId: { in: ids } } } });
      await prisma.parcela.deleteMany({ where: { honorario: { processoId: { in: ids } } } });
      await prisma.honorario.deleteMany({ where: { processoId: { in: ids } } });
      await prisma.mensagemProcesso.deleteMany({ where: { processoId: { in: ids } } });
      await prisma.processoCompartilhado.deleteMany({ where: { processoId: { in: ids } } });
      await prisma.anotacao.deleteMany({ where: { processoId: { in: ids } } });
      await prisma.movimentacao.deleteMany({ where: { processoId: { in: ids } } });
      await prisma.documento.deleteMany({ where: { processoId: { in: ids } } });
      await prisma.prazo.deleteMany({ where: { processoId: { in: ids } } });
      await prisma.advogadoProcesso.deleteMany({ where: { processoId: { in: ids } } });
      await prisma.parte.deleteMany({ where: { processoId: { in: ids } } });
      await prisma.notificacao.deleteMany({ where: { processoId: { in: ids } } });
      await prisma.tarefa.deleteMany({ where: { processoId: { in: ids } } });
      await prisma.processo.deleteMany({ where: { id: { in: ids } } });
    }

    if (usuarios.length) {
      await prisma.subtarefa.deleteMany({ where: { tarefa: { usuarioId: { in: usuarios } } } });
      await prisma.tarefa.deleteMany({ where: { usuarioId: { in: usuarios } } });
      await prisma.eventoAgenda.deleteMany({ where: { usuarioId: { in: usuarios } } });
      await prisma.etiquetaAgenda.deleteMany({ where: { usuarioId: { in: usuarios } } });
      await prisma.tipoPrazoUsuario.deleteMany({ where: { usuarioId: { in: usuarios } } });
      await prisma.modeloDocumento.deleteMany({ where: { usuarioId: { in: usuarios } } });
      await prisma.configuracao.deleteMany({ where: { usuarioId: { in: usuarios } } });
      await prisma.notificacao.deleteMany({ where: { usuarioId: { in: usuarios } } });
      await prisma.auditLog.deleteMany({ where: { usuarioId: { in: usuarios } } });
      await prisma.usuario.deleteMany({ where: { id: { in: usuarios } } });
    }

    if (unidades.length) {
      await prisma.unidade.deleteMany({ where: { id: { in: unidades } } });
    }
  }

  return { usuario, unidade, processo, limpar, criados };
}

// ─── Servidor de teste ────────────────────────────────────────────
// Sobe o Express em memória. Porta 0 = o SO escolhe uma livre, então
// dois testes em paralelo (ou um dev com o app aberto) não colidem.
async function subirServidor() {
  process.env.NODE_ENV = 'test';
  const app = require('../../src/app');
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const { port } = server.address();
  return { server, base: `http://127.0.0.1:${port}/api` };
}

module.exports = {
  prisma,
  cores: c,
  relatorio,
  criarContexto,
  criarCliente,
  criarFabrica,
  subirServidor,
};
