// ══════════════════════════════════════════════════════════════════
//  Cota do plano gratuito — 5 processos.
//
//  Três furos que este teste existe para não deixar voltar:
//
//    1. a checagem era `plano === 'GRATUITO'`, então quem assinou o
//       MENSAL e deixou vencer ficava com processos ilimitados;
//    2. só a criação era barrada — quem já estava acima da cota
//       quando o plano venceu seguia usando o sistema inteiro;
//    3. bloquear DELETE prenderia o usuário acima da cota para
//       sempre, sem como voltar ao limite a não ser pagando.
// ══════════════════════════════════════════════════════════════════
'use strict';

const LIMITE = Number(process.env.LIMITE_PROCESSOS_GRATUITO || 5);
const ontem = () => new Date(Date.now() - 864e5);

module.exports = {
  nome: 'Planos e cota de processos',
  precisaDeBanco: true,

  async executar({ t, req, fabrica, prisma, marca }) {
    // ─── Conta gratuita: até 5 processos ────────────────────────
    const gratuito = await fabrica.usuario('plano_gratuito', { plano: 'GRATUITO' });

    for (let i = 1; i <= LIMITE; i++) {
      const r = await fabrica.processo(gratuito.token, { numero: `${marca}-G${i}` });
      t.checar(`conta gratuita cria o processo ${i} de ${LIMITE}`, r.status === 201,
        `veio ${r.status} — ${JSON.stringify(r.dados).slice(0, 120)}`);
    }

    const excedente = await fabrica.processo(gratuito.token, { numero: `${marca}-G6` });
    t.status(`processo ${LIMITE + 1} é barrado → 403`, excedente, 403);
    t.checar('a resposta pede upgrade (o app abre o modal de planos)',
      excedente.dados?.upgrade === true, `veio ${JSON.stringify(excedente.dados)}`);

    // ─── Status do plano alimenta o aviso da interface ──────────
    const status = await req('GET', '/pagamentos/status-plano', gratuito.token);
    t.status('GET /pagamentos/status-plano → 200', status, 200);
    t.checar('informa que o plano não está ativo', status.dados?.ativo === false);
    t.checar('conta os processos certos', status.dados?.processos === LIMITE,
      `veio ${status.dados?.processos}`);
    t.checar('diz que não pode criar mais', status.dados?.podeCriarProcesso === false);
    t.checar('ainda não está bloqueado (está NO limite, não acima)',
      status.dados?.bloqueado === false, `veio ${status.dados?.bloqueado}`);

    // ─── Plano pago VENCIDO vale como gratuito ──────────────────
    const vencido = await fabrica.usuario('plano_vencido', {
      plano: 'MENSAL', planoExpiracao: ontem(),
    });
    for (let i = 1; i <= LIMITE; i++) {
      await fabrica.processo(vencido.token, { numero: `${marca}-V${i}` });
    }
    const vencidoExcede = await fabrica.processo(vencido.token, { numero: `${marca}-V6` });
    t.status('MENSAL vencido é barrado no 6º processo → 403', vencidoExcede, 403);

    const statusVencido = await req('GET', '/pagamentos/status-plano', vencido.token);
    t.checar('status marca o plano como expirado', statusVencido.dados?.expirado === true,
      `veio ${JSON.stringify(statusVencido.dados)}`);

    // ─── Plano pago VIGENTE não tem cota ────────────────────────
    const pago = await fabrica.usuario('plano_pago', {
      plano: 'MENSAL', planoExpiracao: new Date(Date.now() + 30 * 864e5),
    });
    for (let i = 1; i <= LIMITE + 1; i++) {
      const r = await fabrica.processo(pago.token, { numero: `${marca}-P${i}` });
      if (i === LIMITE + 1) {
        t.status(`plano vigente cria o processo ${LIMITE + 1} sem problema → 201`, r, 201);
      }
    }
    const statusPago = await req('GET', '/pagamentos/status-plano', pago.token);
    t.checar('status do plano pago vem ativo', statusPago.dados?.ativo === true);

    // ─── Acima da cota: somente leitura ─────────────────────────
    // Simula o cenário real: o usuário tinha plano, cadastrou 7
    // processos e a assinatura venceu. Os 2 extras entram direto pelo
    // banco porque a API (corretamente) não deixaria criá-los.
    const acima = await fabrica.usuario('plano_acima', { plano: 'GRATUITO' });
    for (let i = 1; i <= LIMITE; i++) {
      await fabrica.processo(acima.token, { numero: `${marca}-A${i}` });
    }
    for (let i = 1; i <= 2; i++) {
      await prisma.processo.create({
        data: { usuarioId: acima.id, numero: `${marca}-A-extra${i}`, classe: 'Herdado' },
      });
    }

    const statusAcima = await req('GET', '/pagamentos/status-plano', acima.token);
    t.checar('status reconhece a conta acima da cota',
      statusAcima.dados?.bloqueado === true && statusAcima.dados?.processos === LIMITE + 2,
      `veio ${JSON.stringify(statusAcima.dados)}`);

    // Leitura continua liberada — os dados são do cliente.
    const leitura = await req('GET', '/processos', acima.token);
    t.status('acima da cota, LER processos continua funcionando → 200', leitura, 200);

    const leituraTarefas = await req('GET', '/tarefas', acima.token);
    t.status('acima da cota, LER tarefas continua funcionando → 200', leituraTarefas, 200);

    // Escrita barrada em todas as áreas de conteúdo.
    const escritas = [
      ['criar tarefa',   'POST', '/tarefas',          { titulo: 'x' }],
      ['criar evento',   'POST', '/agenda/eventos',   { titulo: 'x', data: '2026-01-10' }],
      ['criar etiqueta', 'POST', '/agenda/etiquetas', { nome: 'x' }],
    ];
    for (const [descricao, metodo, caminho, corpo] of escritas) {
      const r = await req(metodo, caminho, acima.token, corpo);
      t.status(`acima da cota, ${descricao} é barrado → 403`, r, 403);
      t.checar(`${descricao}: resposta marca limiteExcedido`, r.dados?.limiteExcedido === true,
        `veio ${JSON.stringify(r.dados).slice(0, 140)}`);
    }

    // Excluir precisa continuar funcionando: é a saída sem pagar.
    const paraExcluir = await req('GET', '/processos', acima.token);
    const alvo = paraExcluir.dados?.processos?.[0];
    const excluiu = await req('DELETE', `/processos/${alvo.id}`, acima.token);
    t.status('acima da cota, EXCLUIR processo continua liberado → 200', excluiu, 200);

    // ─── Admin global não tem cota ──────────────────────────────
    const admin = await fabrica.usuario('plano_admin', { plano: 'GRATUITO', perfil: 'ADMIN_GLOBAL' });
    for (let i = 1; i <= LIMITE + 1; i++) {
      const r = await fabrica.processo(admin.token, { numero: `${marca}-ADM${i}` });
      if (i === LIMITE + 1) {
        t.status('ADMIN_GLOBAL passa da cota sem ser barrado → 201', r, 201);
      }
    }
  },
};
