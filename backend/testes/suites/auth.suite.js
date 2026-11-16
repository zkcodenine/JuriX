// ══════════════════════════════════════════════════════════════════
//  Autenticação — a porta de entrada.
//
//  Guarda a regressão de 16/jul/2026: uma conta criada à mão no
//  phpMyAdmin ficou com a senha em texto puro e o bcrypt.compare()
//  passou a devolver false para sempre. O app funcionava enquanto o
//  token durava e trancava todo mundo no primeiro "Sair".
// ══════════════════════════════════════════════════════════════════
'use strict';

module.exports = {
  nome: 'Autenticação',
  precisaDeBanco: true,

  async executar({ t, req, fabrica, prisma }) {
    const ana = await fabrica.usuario('auth_ana');

    // ─── Login ──────────────────────────────────────────────────
    const login = await req('POST', '/auth/login', null, { email: ana.email, senha: ana.senha });
    t.status('login com senha correta → 200', login, 200);
    t.checar('login devolve token', Boolean(login.dados?.token));
    t.checar('login NÃO devolve a senha', !JSON.stringify(login.dados).includes('senha'));

    const errado = await req('POST', '/auth/login', null, { email: ana.email, senha: 'SenhaErrada999' });
    t.status('login com senha errada → 401', errado, 401);

    const inexistente = await req('POST', '/auth/login', null, { email: 'ninguem@teste.local', senha: 'x' });
    t.status('login de e-mail inexistente → 401', inexistente, [400, 401]);

    // ─── Senha sempre com hash ──────────────────────────────────
    const noBanco = await prisma.usuario.findUnique({
      where: { id: ana.id }, select: { senha: true },
    });
    t.checar(
      'senha é gravada como hash bcrypt (nunca texto puro)',
      /^\$2[aby]\$\d{2}\$/.test(noBanco.senha),
      `valor no banco começa com: ${String(noBanco.senha).slice(0, 7)}`
    );

    // ─── Rotas protegidas ───────────────────────────────────────
    const semToken = await req('GET', '/processos', null);
    t.status('rota protegida sem token → 401', semToken, 401);

    const tokenLixo = await req('GET', '/processos', 'token.invalido.aqui');
    t.status('rota protegida com token inválido → 401', tokenLixo, 401);

    const comToken = await req('GET', '/processos', ana.token);
    t.status('rota protegida com token válido → 200', comToken, 200);

    // ─── /auth/me ───────────────────────────────────────────────
    const eu = await req('GET', '/auth/me', ana.token);
    t.status('GET /auth/me → 200', eu, 200);
    t.checar('/auth/me devolve o usuário certo', eu.dados?.email === ana.email, `veio ${eu.dados?.email}`);
    t.checar('/auth/me traz o perfil (a sidebar depende dele)', 'perfil' in (eu.dados || {}));
    t.checar('/auth/me NÃO devolve a senha', !('senha' in (eu.dados || {})));

    // ─── Conta desativada ───────────────────────────────────────
    const inativo = await fabrica.usuario('auth_inativo');
    await prisma.usuario.update({ where: { id: inativo.id }, data: { ativo: false } });
    // O middleware cacheia o usuário por 5 min; o teste confere o
    // comportamento no próximo login, que lê do banco.
    const loginInativo = await req('POST', '/auth/login', null, {
      email: inativo.email, senha: inativo.senha,
    });
    t.status('conta desativada não consegue logar → 401/403', loginInativo, [401, 403]);
  },
};
