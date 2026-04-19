const { prisma } = require('../config/database');
const { cacheGet, cacheSet, cacheDel, cacheDelPattern } = require('../config/redis');
const datajudService = require('../services/datajudService');
const notificationService = require('../services/notificationService');

// ─── Listar processos ──────────────────────────────
async function listar(req, res, next) {
  try {
    const { status, busca, pagina = 1, limite = 20, ordem = 'desc', incluirArquivados, apenasArquivados } = req.query;
    const skip = (Number(pagina) - 1) * Number(limite);

    const where = { usuarioId: req.usuario.id };
    if (status) {
      where.status = status;
    } else if (apenasArquivados === 'true' || apenasArquivados === '1') {
      // Apenas processos arquivados
      where.status = 'ARQUIVADO';
    } else if (incluirArquivados !== 'true' && incluirArquivados !== '1') {
      // Por padrão, oculta processos ARQUIVADOS da lista principal
      where.status = { not: 'ARQUIVADO' };
    }
    if (busca) {
      where.OR = [
        { numero: { contains: busca, mode: 'insensitive' } },
        { numeroCnj: { contains: busca, mode: 'insensitive' } },
        { assunto: { contains: busca, mode: 'insensitive' } },
        { partes: { some: { nome: { contains: busca, mode: 'insensitive' } } } },
      ];
    }

    const limite48h = new Date(Date.now() - 48 * 3600 * 1000);

    const [processos, total] = await Promise.all([
      prisma.processo.findMany({
        where,
        skip,
        take: Number(limite),
        orderBy: { criadoEm: ordem },
        include: {
          partes: { take: 5 },
          _count: { select: { tarefas: true, documentos: true, movimentacoes: true } },
        },
      }),
      prisma.processo.count({ where }),
    ]);

    // Contar movimentações recentes (últimas 48h) para cada processo
    const processosComRecentes = await Promise.all(
      processos.map(async (proc) => {
        const novasMovimentacoes = await prisma.movimentacao.count({
          where: { processoId: proc.id, data: { gte: limite48h }, origemApi: { in: ['datajud', 'tjmg'] } },
        });
        return { ...proc, novasMovimentacoes };
      })
    );

    res.json({ processos: processosComRecentes, total, pagina: Number(pagina), totalPaginas: Math.ceil(total / Number(limite)) });
  } catch (err) { next(err); }
}

// ─── Criar processo ────────────────────────────────
async function criar(req, res, next) {
  try {
    // Limite de 5 processos para plano GRATUITO
    const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario.id }, select: { plano: true } });
    if (usuario?.plano === 'GRATUITO') {
      const count = await prisma.processo.count({ where: { usuarioId: req.usuario.id } });
      if (count >= 5) {
        return res.status(403).json({ error: 'Limite de 5 processos atingido no plano gratuito.', upgrade: true });
      }
    }

    const { partes, ...dados } = req.body;

    // Garante que numeroCnj vazio/null não viole unique constraint
    if (!dados.numeroCnj || dados.numeroCnj.trim() === '') {
      dados.numeroCnj = null;
    }

    // Campos permitidos para evitar dados inesperados
    const camposPermitidos = ['numero', 'numeroCnj', 'tribunal', 'vara', 'classe', 'assunto', 'status', 'valor', 'observacoes', 'dataDistribuicao', 'monitoramentoAtivo', 'origemDados'];
    const dadosLimpos = {};
    for (const campo of camposPermitidos) {
      if (dados[campo] !== undefined) dadosLimpos[campo] = dados[campo];
    }

    const processo = await prisma.processo.create({
      data: {
        ...dadosLimpos,
        usuarioId: req.usuario.id,
        partes: partes?.length ? { create: partes } : undefined,
      },
      include: { partes: true },
    });
    await cacheDelPattern(`processos:${req.usuario.id}:*`);
    res.status(201).json(processo);
  } catch (err) { next(err); }
}

// ─── Obter processo ────────────────────────────────
async function obter(req, res, next) {
  try {
    const processo = await prisma.processo.findFirst({
      where: { id: req.params.id, usuarioId: req.usuario.id },
      include: {
        partes: true,
        advogados: true,
        movimentacoes: { orderBy: { data: 'desc' }, take: 20 },
        tarefas: { include: { subtarefas: true }, orderBy: { criadoEm: 'desc' } },
        prazos: { orderBy: { dataVencimento: 'asc' } },
        documentos: { orderBy: { criadoEm: 'desc' } },
        honorarios: { include: { parcelas: { orderBy: { vencimento: 'asc' } } } },
        anotacoes: { orderBy: { atualizadoEm: 'desc' } },
        _count: { select: { movimentacoes: true, tarefas: true, documentos: true } },
      },
    });
    if (!processo) return res.status(404).json({ error: 'Processo não encontrado.' });
    res.json(processo);
  } catch (err) { next(err); }
}

// ─── Atualizar processo ────────────────────────────
async function atualizar(req, res, next) {
  try {
    const processo = await prisma.processo.findFirst({
      where: { id: req.params.id, usuarioId: req.usuario.id },
    });
    if (!processo) return res.status(404).json({ error: 'Processo não encontrado.' });

    // Whitelist de campos escalares editáveis — evita unknown field errors do Prisma
    const camposPermitidos = [
      'numero', 'tribunal', 'vara', 'classe', 'assunto', 'status',
      'valor', 'observacoes', 'dataDistribuicao', 'monitoramentoAtivo',
    ];
    const dados = {};
    // Campos obrigatórios (não-anuláveis no DB) — ignorar se vieram vazios
    const camposObrigatorios = ['numero'];
    for (const campo of camposPermitidos) {
      if (req.body[campo] !== undefined) {
        const val = req.body[campo] === '' ? null : req.body[campo];
        if (val === null && camposObrigatorios.includes(campo)) continue;
        dados[campo] = val;
      }
    }
    // Sanitiza datas
    if (dados.dataDistribuicao !== undefined && dados.dataDistribuicao !== null) {
      dados.dataDistribuicao = new Date(dados.dataDistribuicao);
    }

    const atualizado = await prisma.processo.update({
      where: { id: req.params.id },
      data: dados,
    });
    res.json(atualizado);
  } catch (err) { next(err); }
}

// ─── Deletar processo ──────────────────────────────
async function deletar(req, res, next) {
  try {
    const processo = await prisma.processo.findFirst({
      where: { id: req.params.id, usuarioId: req.usuario.id },
    });
    if (!processo) return res.status(404).json({ error: 'Processo não encontrado.' });

    const pid = req.params.id;

    // Deletar registros filhos em sequência (interactive transaction) para evitar
    // falhas silenciosas com FK constraints em $transaction array
    await prisma.$transaction(async (tx) => {
      // Subtarefas dependem de tarefas
      await tx.subtarefa.deleteMany({ where: { tarefa: { processoId: pid } } });
      // Parcelas dependem de honorários
      await tx.parcela.deleteMany({ where: { honorario: { processoId: pid } } });
      // Agora pode deletar as tabelas diretas
      await tx.anotacao.deleteMany({ where: { processoId: pid } });
      await tx.movimentacao.deleteMany({ where: { processoId: pid } });
      await tx.documento.deleteMany({ where: { processoId: pid } });
      await tx.prazo.deleteMany({ where: { processoId: pid } });
      await tx.honorario.deleteMany({ where: { processoId: pid } });
      await tx.tarefa.deleteMany({ where: { processoId: pid } });
      await tx.advogadoProcesso.deleteMany({ where: { processoId: pid } });
      await tx.parte.deleteMany({ where: { processoId: pid } });
      await tx.notificacao.deleteMany({ where: { processoId: pid } });
      // Finalmente o processo
      await tx.processo.delete({ where: { id: pid } });
    });

    res.json({ mensagem: 'Processo excluído com sucesso.' });
  } catch (err) {
    console.error('Erro ao deletar processo:', err.message);
    next(err);
  }
}

// ─── Busca global ──────────────────────────────────
async function buscar(req, res, next) {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);
    const processos = await prisma.processo.findMany({
      where: {
        usuarioId: req.usuario.id,
        OR: [
          { numero: { contains: q, mode: 'insensitive' } },
          { numeroCnj: { contains: q, mode: 'insensitive' } },
          { assunto: { contains: q, mode: 'insensitive' } },
          { partes: { some: { nome: { contains: q, mode: 'insensitive' } } } },
        ],
      },
      take: 10,
      include: { partes: { take: 2 } },
    });
    res.json(processos);
  } catch (err) { next(err); }
}

// ─── Importar via CNJ ─────────────────────────────
async function importarCNJ(req, res, next) {
  try {
    const { numeroCnj, tribunal, forcar } = req.body;

    // Limite de 5 processos para plano GRATUITO
    const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario.id }, select: { plano: true } });
    if (usuario?.plano === 'GRATUITO') {
      const count = await prisma.processo.count({ where: { usuarioId: req.usuario.id } });
      if (count >= 5) {
        return res.status(403).json({ error: 'Limite de 5 processos atingido no plano gratuito.', upgrade: true });
      }
    }

    // Consulta DataJud (com fallback manual se permitirManual=true)
    const { permitirManual } = req.body;
    let dadosCNJ = await datajudService.consultarProcesso(numeroCnj, tribunal);
    if (!dadosCNJ) {
      if (!permitirManual) {
        return res.status(404).json({
          error: 'Processo não encontrado no DataJud.',
          podeImportarManual: true,
        });
      }
      // Fallback: cria processo com dados mínimos (usuário edita depois)
      dadosCNJ = {
        numero: numeroCnj,
        numeroCnj,
        tribunal,
        vara: null, classe: null, assunto: null,
        dataDistribuicao: null,
        partes: [], advogados: [], movimentacoes: [],
      };
    }

    // Verifica se já existe — busca por numeroCnj exato OU apenas dígitos para evitar duplicatas por formatação
    const cnjDigits = numeroCnj.replace(/\D/g, '');
    const existente = await prisma.processo.findFirst({
      where: {
        OR: [
          { numeroCnj, usuarioId: req.usuario.id },
          { numeroCnj: cnjDigits, usuarioId: req.usuario.id },
        ],
      },
      select: { id: true, numero: true, numeroCnj: true, status: true, criadoEm: true },
    });
    if (existente) {
      if (forcar) {
        // Forçar reimportação: deleta o existente primeiro
        const pid = existente.id;
        await prisma.$transaction(async (tx) => {
          await tx.subtarefa.deleteMany({ where: { tarefa: { processoId: pid } } });
          await tx.parcela.deleteMany({ where: { honorario: { processoId: pid } } });
          await tx.anotacao.deleteMany({ where: { processoId: pid } });
          await tx.movimentacao.deleteMany({ where: { processoId: pid } });
          await tx.documento.deleteMany({ where: { processoId: pid } });
          await tx.prazo.deleteMany({ where: { processoId: pid } });
          await tx.honorario.deleteMany({ where: { processoId: pid } });
          await tx.tarefa.deleteMany({ where: { processoId: pid } });
          await tx.advogadoProcesso.deleteMany({ where: { processoId: pid } });
          await tx.parte.deleteMany({ where: { processoId: pid } });
          await tx.notificacao.deleteMany({ where: { processoId: pid } });
          await tx.processo.delete({ where: { id: pid } });
        });
        // Continue to create the new processo below
      } else {
        return res.status(409).json({
          error: 'Este processo já está cadastrado.',
          processoExistente: existente,
        });
      }
    }

    // Verifica também se outro usuário já tem este CNJ (unique constraint global)
    const existenteGlobal = await prisma.processo.findFirst({
      where: {
        OR: [
          { numeroCnj },
          { numeroCnj: cnjDigits },
        ],
      },
      select: { id: true },
    });
    if (existenteGlobal) {
      // Outro usuário já tem — tenta usar numeroCnj com formato diferente para evitar unique conflict
      // Usa a versão formatada se o banco tem apenas dígitos, e vice-versa
      const cnjParaSalvar = existenteGlobal ? null : numeroCnj;
      if (cnjParaSalvar === null) {
        // CNJ já existe globalmente — salvar sem numeroCnj unique, usando apenas o campo numero
        const processo = await prisma.processo.create({
          data: {
            usuarioId: req.usuario.id,
            numero: dadosCNJ.numero || numeroCnj,
            // numeroCnj omitido para evitar constraint violation
            tribunal: dadosCNJ.tribunal || tribunal,
            vara: dadosCNJ.vara,
            classe: dadosCNJ.classe,
            assunto: dadosCNJ.assunto,
            status: 'ATIVO',
            dataDistribuicao: dadosCNJ.dataDistribuicao ? new Date(dadosCNJ.dataDistribuicao) : null,
            origemDados: 'datajud',
            monitoramentoAtivo: true,
            observacoes: `CNJ: ${numeroCnj}`,
            partes: dadosCNJ.partes?.length ? {
              create: dadosCNJ.partes.map(p => ({ nome: p.nome, tipo: mapearTipoParte(p.tipo) })),
            } : undefined,
            advogados: dadosCNJ.advogados?.length ? {
              create: dadosCNJ.advogados.map(a => ({ nome: a.nome, oab: a.numeroDocumentoPrincipal })),
            } : undefined,
          },
          include: { partes: true, advogados: true },
        });

        // Salva movimentações individualmente para evitar falha por hash duplicado
        if (dadosCNJ.movimentacoes?.length) {
          await _salvarMovimentacoes(processo.id, dadosCNJ.movimentacoes, numeroCnj);
        }

        await notificationService.criarNotificacao({
          usuarioId: req.usuario.id,
          titulo: 'Processo importado do CNJ',
          mensagem: `Processo ${numeroCnj} importado com sucesso via DataJud.`,
          tipo: 'MOVIMENTACAO',
          processoId: processo.id,
        });

        return res.status(201).json({ processo });
      }
    }

    // Cria o processo com dados do CNJ (sem nested movimentacoes para evitar falha por hash duplicado)
    const processo = await prisma.processo.create({
      data: {
        usuarioId: req.usuario.id,
        numero: dadosCNJ.numero || numeroCnj,
        numeroCnj,
        tribunal: dadosCNJ.tribunal || tribunal,
        vara: dadosCNJ.vara,
        classe: dadosCNJ.classe,
        assunto: dadosCNJ.assunto,
        status: 'ATIVO',
        dataDistribuicao: dadosCNJ.dataDistribuicao ? new Date(dadosCNJ.dataDistribuicao) : null,
        origemDados: 'datajud',
        monitoramentoAtivo: true,
        partes: dadosCNJ.partes?.length ? {
          create: dadosCNJ.partes.map(p => ({ nome: p.nome, tipo: mapearTipoParte(p.tipo) })),
        } : undefined,
        advogados: dadosCNJ.advogados?.length ? {
          create: dadosCNJ.advogados.map(a => ({ nome: a.nome, oab: a.numeroDocumentoPrincipal })),
        } : undefined,
      },
      include: { partes: true, advogados: true },
    });

    // Salva movimentações individualmente para evitar falha por hash duplicado
    const movsSalvas = dadosCNJ.movimentacoes?.length
      ? await _salvarMovimentacoes(processo.id, dadosCNJ.movimentacoes, numeroCnj)
      : 0;

    // Notificação de importação
    await notificationService.criarNotificacao({
      usuarioId: req.usuario.id,
      processoId: processo.id,
      titulo: 'Processo importado do DataJud/CNJ',
      mensagem: `Processo ${dadosCNJ.numero || numeroCnj} importado com sucesso. ${movsSalvas} movimentação(ões) registrada(s). Monitoramento automático ativado.`,
      tipo: 'SISTEMA',
    });

    res.status(201).json({ processo, dadosCNJ });
  } catch (err) { next(err); }
}

// ─── Vincular CNJ a processo existente (preview) ──
async function vincularCNJ(req, res, next) {
  try {
    const { numeroCnj, tribunal } = req.body;
    const processo = await prisma.processo.findFirst({
      where: { id: req.params.id, usuarioId: req.usuario.id },
    });
    if (!processo) return res.status(404).json({ error: 'Processo não encontrado.' });

    const dadosCNJ = await datajudService.consultarProcesso(numeroCnj, tribunal);
    if (!dadosCNJ) {
      return res.status(404).json({ error: 'Processo não encontrado no DataJud.' });
    }

    // Retorna prévia dos dados para o usuário confirmar
    res.json({ preview: dadosCNJ, processoId: processo.id });
  } catch (err) { next(err); }
}

// ─── Confirmar vinculação CNJ (persiste dados) ─────
async function confirmarVinculacaoCNJ(req, res, next) {
  try {
    const { numeroCnj, tribunal } = req.body;
    const processo = await prisma.processo.findFirst({
      where: { id: req.params.id, usuarioId: req.usuario.id },
    });
    if (!processo) return res.status(404).json({ error: 'Processo não encontrado.' });

    const dadosCNJ = await datajudService.consultarProcesso(numeroCnj, tribunal);
    if (!dadosCNJ) {
      return res.status(404).json({ error: 'Processo não encontrado no DataJud.' });
    }

    // Atualiza o processo com dados do CNJ
    const atualizado = await prisma.processo.update({
      where: { id: req.params.id },
      data: {
        numeroCnj,
        tribunal: dadosCNJ.tribunal || tribunal,
        vara: dadosCNJ.vara || processo.vara,
        classe: dadosCNJ.classe || processo.classe,
        assunto: dadosCNJ.assunto || processo.assunto,
        origemDados: 'datajud',
        monitoramentoAtivo: true,
        dataDistribuicao: dadosCNJ.dataDistribuicao ? new Date(dadosCNJ.dataDistribuicao) : processo.dataDistribuicao,
      },
    });

    // Adiciona partes novas (sem duplicar)
    if (dadosCNJ.partes?.length) {
      for (const p of dadosCNJ.partes) {
        const existe = await prisma.parte.findFirst({ where: { processoId: req.params.id, nome: p.nome } });
        if (!existe) {
          await prisma.parte.create({ data: { processoId: req.params.id, nome: p.nome, tipo: mapearTipoParte(p.tipo) } });
        }
      }
    }

    // Adiciona movimentações novas (dedup por hash scoped por processoId)
    if (dadosCNJ.movimentacoes?.length) {
      await _salvarMovimentacoes(req.params.id, dadosCNJ.movimentacoes, numeroCnj);
    }

    // Notificação de vinculação
    await notificationService.criarNotificacao({
      usuarioId: req.usuario.id,
      processoId: req.params.id,
      titulo: 'Processo vinculado ao DataJud/CNJ',
      mensagem: `Processo vinculado com sucesso ao DataJud. ${dadosCNJ.movimentacoes?.length || 0} movimentação(ões) importada(s). Monitoramento automático ativado.`,
      tipo: 'SISTEMA',
    });

    res.json({ mensagem: 'Processo vinculado ao CNJ com sucesso!', processo: atualizado });
  } catch (err) { next(err); }
}

// ─── Confirmar vinculação CNJ ──────────────────────
async function ativarMonitoramento(req, res, next) {
  try {
    const processo = await prisma.processo.findFirst({
      where: { id: req.params.id, usuarioId: req.usuario.id },
    });
    if (!processo) return res.status(404).json({ error: 'Processo não encontrado.' });

    await prisma.processo.update({
      where: { id: req.params.id },
      data: { monitoramentoAtivo: true },
    });
    res.json({ mensagem: 'Monitoramento automático ativado.' });
  } catch (err) { next(err); }
}

async function desativarMonitoramento(req, res, next) {
  try {
    await prisma.processo.updateMany({
      where: { id: req.params.id, usuarioId: req.usuario.id },
      data: { monitoramentoAtivo: false },
    });
    res.json({ mensagem: 'Monitoramento automático desativado.' });
  } catch (err) { next(err); }
}

// ─── Sub-recursos ──────────────────────────────────
async function movimentacoes(req, res, next) {
  try {
    const { pagina = 1, limite = 30 } = req.query;
    const [items, total] = await Promise.all([
      prisma.movimentacao.findMany({
        where: { processoId: req.params.id, processo: { usuarioId: req.usuario.id } },
        orderBy: { data: 'desc' },
        skip: (Number(pagina) - 1) * Number(limite),
        take: Number(limite),
      }),
      prisma.movimentacao.count({
        where: { processoId: req.params.id, processo: { usuarioId: req.usuario.id } },
      }),
    ]);
    res.json({ items, total });
  } catch (err) { next(err); }
}

async function tarefas(req, res, next) {
  try {
    const items = await prisma.tarefa.findMany({
      where: { processoId: req.params.id, usuarioId: req.usuario.id },
      include: { subtarefas: true },
      orderBy: { criadoEm: 'desc' },
    });
    res.json(items);
  } catch (err) { next(err); }
}

async function documentos(req, res, next) {
  try {
    const items = await prisma.documento.findMany({
      where: { processoId: req.params.id, processo: { usuarioId: req.usuario.id } },
      orderBy: { criadoEm: 'desc' },
    });
    res.json(items);
  } catch (err) { next(err); }
}

async function honorarios(req, res, next) {
  try {
    const items = await prisma.honorario.findMany({
      where: { processoId: req.params.id, processo: { usuarioId: req.usuario.id } },
      include: { parcelas: { orderBy: { vencimento: 'asc' } } },
    });
    res.json(items);
  } catch (err) { next(err); }
}

async function prazos(req, res, next) {
  try {
    const items = await prisma.prazo.findMany({
      where: { processoId: req.params.id, processo: { usuarioId: req.usuario.id } },
      orderBy: { dataVencimento: 'asc' },
    });
    res.json(items);
  } catch (err) { next(err); }
}

async function partes(req, res, next) {
  try {
    const items = await prisma.parte.findMany({
      where: { processoId: req.params.id, processo: { usuarioId: req.usuario.id } },
    });
    res.json(items);
  } catch (err) { next(err); }
}

async function anotacoes(req, res, next) {
  try {
    const items = await prisma.anotacao.findMany({
      where: { processoId: req.params.id, processo: { usuarioId: req.usuario.id } },
      orderBy: { atualizadoEm: 'desc' },
    });
    res.json(items);
  } catch (err) { next(err); }
}

async function adicionarParte(req, res, next) {
  try {
    const processo = await prisma.processo.findFirst({ where: { id: req.params.id, usuarioId: req.usuario.id } });
    if (!processo) return res.status(404).json({ error: 'Processo não encontrado.' });

    const parte = await prisma.parte.create({
      data: { ...req.body, processoId: req.params.id },
    });
    res.status(201).json(parte);
  } catch (err) { next(err); }
}

async function removerParte(req, res, next) {
  try {
    const parte = await prisma.parte.findFirst({
      where: { id: req.params.parteId, processo: { id: req.params.id, usuarioId: req.usuario.id } },
    });
    if (!parte) return res.status(404).json({ error: 'Parte não encontrada.' });

    await prisma.parte.delete({ where: { id: req.params.parteId } });
    res.json({ mensagem: 'Parte removida.' });
  } catch (err) { next(err); }
}

async function adicionarMovimentacao(req, res, next) {
  try {
    const processo = await prisma.processo.findFirst({ where: { id: req.params.id, usuarioId: req.usuario.id } });
    if (!processo) return res.status(404).json({ error: 'Processo não encontrado.' });

    const mov = await prisma.movimentacao.create({
      data: { ...req.body, processoId: req.params.id, origemApi: 'manual' },
    });
    res.status(201).json(mov);
  } catch (err) { next(err); }
}

async function deletarMovimentacao(req, res, next) {
  try {
    const mov = await prisma.movimentacao.findFirst({
      where: { id: req.params.movId, processoId: req.params.id, processo: { usuarioId: req.usuario.id } },
    });
    if (!mov) return res.status(404).json({ error: 'Movimentação não encontrada.' });
    await prisma.movimentacao.delete({ where: { id: req.params.movId } });
    res.json({ mensagem: 'Movimentação excluída.' });
  } catch (err) { next(err); }
}

async function adicionarPrazo(req, res, next) {
  try {
    const processo = await prisma.processo.findFirst({ where: { id: req.params.id, usuarioId: req.usuario.id } });
    if (!processo) return res.status(404).json({ error: 'Processo não encontrado.' });

    const b = req.body;
    if (!b.dataVencimento) {
      return res.status(400).json({ error: 'Data de vencimento é obrigatória.' });
    }
    // Whitelist explícita — evita campos desconhecidos no Prisma
    const dados = {
      titulo:          b.titulo,
      descricao:       b.descricao || null,
      dataVencimento:  new Date(b.dataVencimento),
      tipo:            b.tipo      || 'PROCESSUAL',
      status:          b.status    || 'PENDENTE',
      alertaDias:      b.alertaDias != null ? Number(b.alertaDias) : 3,
    };
    const prazo = await prisma.prazo.create({
      data: { ...dados, processoId: req.params.id },
    });
    res.status(201).json(prazo);
  } catch (err) { next(err); }
}

async function atualizarPrazo(req, res, next) {
  try {
    const existe = await prisma.prazo.findFirst({
      where: { id: req.params.prazoId, processo: { id: req.params.id, usuarioId: req.usuario.id } },
    });
    if (!existe) return res.status(404).json({ error: 'Prazo não encontrado.' });

    const prazo = await prisma.prazo.update({
      where: { id: req.params.prazoId },
      data: req.body,
    });
    res.json(prazo);
  } catch (err) { next(err); }
}

async function deletarPrazo(req, res, next) {
  try {
    const existe = await prisma.prazo.findFirst({
      where: { id: req.params.prazoId, processo: { id: req.params.id, usuarioId: req.usuario.id } },
    });
    if (!existe) return res.status(404).json({ error: 'Prazo não encontrado.' });

    await prisma.prazo.delete({ where: { id: req.params.prazoId } });
    res.json({ mensagem: 'Prazo removido.' });
  } catch (err) { next(err); }
}

async function adicionarAnotacao(req, res, next) {
  try {
    const processo = await prisma.processo.findFirst({ where: { id: req.params.id, usuarioId: req.usuario.id } });
    if (!processo) return res.status(404).json({ error: 'Processo não encontrado.' });

    const anotacao = await prisma.anotacao.create({
      data: { ...req.body, processoId: req.params.id },
    });
    res.status(201).json(anotacao);
  } catch (err) { next(err); }
}

async function atualizarAnotacao(req, res, next) {
  try {
    const existe = await prisma.anotacao.findFirst({
      where: { id: req.params.anotacaoId, processo: { id: req.params.id, usuarioId: req.usuario.id } },
    });
    if (!existe) return res.status(404).json({ error: 'Anotação não encontrada.' });

    const anotacao = await prisma.anotacao.update({
      where: { id: req.params.anotacaoId },
      data: req.body,
    });
    res.json(anotacao);
  } catch (err) { next(err); }
}

async function deletarAnotacao(req, res, next) {
  try {
    const existe = await prisma.anotacao.findFirst({
      where: { id: req.params.anotacaoId, processo: { id: req.params.id, usuarioId: req.usuario.id } },
    });
    if (!existe) return res.status(404).json({ error: 'Anotação não encontrada.' });

    await prisma.anotacao.delete({ where: { id: req.params.anotacaoId } });
    res.json({ mensagem: 'Anotação removida.' });
  } catch (err) { next(err); }
}

function mapearTipoParte(tipo) {
  const mapa = {
    'AUTOR': 'AUTOR', 'autor': 'AUTOR',
    'RÉU': 'REU', 'REU': 'REU', 'réu': 'REU', 'reu': 'REU',
    'TERCEIRO': 'TERCEIRO',
  };
  return mapa[tipo] || 'TERCEIRO';
}

// ─── Salvar movimentações individualmente (dedup via hash + processoId) ──
async function _salvarMovimentacoes(processoId, movimentacoes, numeroCnj) {
  const cnjDigits = (numeroCnj || '').replace(/\D/g, '');
  let salvas = 0;
  const seen = new Set();
  for (let idx = 0; idx < movimentacoes.length; idx++) {
    const m = movimentacoes[idx];
    if (!m.data) continue;
    // Hash inclui processoId para evitar colisão entre processos de usuários diferentes
    let base = m.hashExterno || `cnj_${cnjDigits}_${m.data}`;
    let hash = `${processoId}_${base}`;
    // Garante unicidade dentro do próprio lote
    if (seen.has(hash)) hash = `${hash}_${idx}`;
    seen.add(hash);
    try {
      await prisma.movimentacao.upsert({
        where: { hashExterno: hash },
        update: {},
        create: {
          processoId,
          data: new Date(m.data),
          descricao: String(m.descricao || 'Movimentação').slice(0, 500),
          tipo: m.tipo ? String(m.tipo).slice(0, 255) : null,
          origemApi: m.origemApi || 'datajud',
          hashExterno: hash,
        },
      });
      salvas++;
    } catch (e) {
      if (e.code !== 'P2002') {
        const logger = require('../config/logger');
        logger.warn(`_salvarMovimentacoes: erro ignorado - ${e.message}`);
      }
    }
  }
  return salvas;
}

// ─── Sincronizar movimentações de um processo (sync completo) ──
async function sincronizarMovimentacoes(req, res, next) {
  try {
    const processo = await prisma.processo.findFirst({
      where: { id: req.params.id, usuarioId: req.usuario.id },
      select: { id: true, numeroCnj: true, tribunal: true, numero: true, usuarioId: true },
    });
    if (!processo) return res.status(404).json({ error: 'Processo não encontrado.' });
    if (!processo.numeroCnj) return res.status(400).json({ error: 'Processo não está vinculado ao CNJ.' });

    const tribunalRegistry = require('../services/tribunalRegistry');
    const tribunal = processo.tribunal?.toUpperCase() || '';

    // Busca TODAS as movimentações (sem filtro de data)
    let movimentacoes = [];
    if (tribunalRegistry.temProviderEspecifico(tribunal)) {
      movimentacoes = await tribunalRegistry.verificarMovimentacoes(processo.numeroCnj, tribunal, null);
    } else {
      const datajudService = require('../services/datajudService');
      movimentacoes = await datajudService.verificarMovimentacoes(processo.numeroCnj, tribunal, null);
    }

    // Salva com dedup via hash scoped por processoId
    const salvas = await _salvarMovimentacoes(processo.id, movimentacoes, processo.numeroCnj);

    // Atualiza timestamp e gera notificação se houve novas movimentações
    if (salvas > 0) {
      await prisma.processo.update({
        where: { id: processo.id },
        data: { dataUltimaAtualizacao: new Date() },
      });

      // Notifica o usuário sobre as novas movimentações capturadas na sync manual
      try {
        const notificationService = require('../services/notificationService');
        const maisRecente = [...movimentacoes]
          .filter(m => m.data)
          .sort((a, b) => new Date(b.data) - new Date(a.data))[0];
        const descricaoPrincipal = maisRecente?.descricao || 'Atualização detectada';
        const fonte = maisRecente?.origemApi === 'tjmg'
          ? ' (TJMG)'
          : maisRecente?.origemApi === 'datajud'
            ? ' (DataJud)'
            : '';
        await notificationService.criarNotificacao({
          usuarioId: processo.usuarioId,
          processoId: processo.id,
          titulo: `${salvas} nova${salvas > 1 ? 's' : ''} movimentação${salvas > 1 ? 'ões' : ''}${fonte}`,
          mensagem: salvas > 1
            ? `${salvas} novas movimentações sincronizadas no processo ${processo.numero || processo.numeroCnj}. Mais recente: ${String(descricaoPrincipal).slice(0, 200)}`
            : `Nova movimentação sincronizada no processo ${processo.numero || processo.numeroCnj}: ${String(descricaoPrincipal).slice(0, 200)}`,
          tipo: 'MOVIMENTACAO',
        });
      } catch (notifErr) {
        const logger = require('../config/logger');
        logger.warn(`sincronizarMovimentacoes: falha ao criar notificação - ${notifErr.message}`);
      }
    }

    const totalDb = await prisma.movimentacao.count({ where: { processoId: processo.id } });

    res.json({
      mensagem: `Sincronização concluída.`,
      encontradas: movimentacoes.length,
      salvasNovas: salvas,
      totalNoProcesso: totalDb,
    });
  } catch (err) { next(err); }
}

// ─── Movimentações de todos os processos (para Agenda) ────
async function movimentacoesAgenda(req, res, next) {
  try {
    const movimentacoes = await prisma.movimentacao.findMany({
      where: { processo: { usuarioId: req.usuario.id } },
      include: {
        processo: {
          select: {
            id: true,
            numero: true,
            numeroCnj: true,
            partes: { take: 1, where: { tipo: 'AUTOR' }, select: { nome: true } },
          },
        },
      },
      orderBy: { data: 'desc' },
      take: 2000,
    });
    res.json(movimentacoes);
  } catch (err) { next(err); }
}

// ─── Prazos de todos os processos (para Agenda) ────
async function prazosAgenda(req, res, next) {
  try {
    const prazos = await prisma.prazo.findMany({
      where: { processo: { usuarioId: req.usuario.id } },
      include: {
        processo: {
          select: {
            id: true,
            numero: true,
            numeroCnj: true,
            partes: { take: 1, where: { tipo: 'AUTOR' } },
          },
        },
      },
      orderBy: { dataVencimento: 'asc' },
    });
    res.json(prazos);
  } catch (err) { next(err); }
}

// ─── Sincronizar TODOS os processos monitorados do usuário ──
async function sincronizarTodos(req, res, next) {
  try {
    const processos = await prisma.processo.findMany({
      where: {
        usuarioId: req.usuario.id,
        monitoramentoAtivo: true,
        numeroCnj: { not: null },
      },
      select: { id: true, numeroCnj: true, tribunal: true },
    });

    if (processos.length === 0) {
      return res.json({ mensagem: 'Nenhum processo monitorado.', total: 0, atualizados: 0 });
    }

    const tribunalRegistry = require('../services/tribunalRegistry');
    const notificationService = require('../services/notificationService');
    const logger = require('../config/logger');
    let totalNovas = 0;
    let processosAtualizados = 0;

    for (const processo of processos) {
      try {
        const tribunal = processo.tribunal?.toUpperCase() || '';
        let movimentacoes = [];

        if (tribunalRegistry.temProviderEspecifico(tribunal)) {
          movimentacoes = await tribunalRegistry.verificarMovimentacoes(processo.numeroCnj, tribunal, null);
        } else {
          const datajudService = require('../services/datajudService');
          movimentacoes = await datajudService.verificarMovimentacoes(processo.numeroCnj, tribunal, null);
        }

        const novasDesteProcesso = await _salvarMovimentacoes(processo.id, movimentacoes, processo.numeroCnj);
        totalNovas += novasDesteProcesso;

        // Atualiza timestamp e notifica se houve novas movimentações neste processo
        if (novasDesteProcesso > 0) {
          processosAtualizados++;
          await prisma.processo.update({
            where: { id: processo.id },
            data: { dataUltimaAtualizacao: new Date() },
          });

          try {
            const procInfo = await prisma.processo.findUnique({
              where: { id: processo.id },
              select: { numero: true, numeroCnj: true },
            });
            const maisRecente = [...movimentacoes]
              .filter(m => m.data)
              .sort((a, b) => new Date(b.data) - new Date(a.data))[0];
            const descricaoPrincipal = maisRecente?.descricao || 'Atualização detectada';
            const fonte = maisRecente?.origemApi === 'tjmg'
              ? ' (TJMG)'
              : maisRecente?.origemApi === 'datajud'
                ? ' (DataJud)'
                : '';
            await notificationService.criarNotificacao({
              usuarioId: req.usuario.id,
              processoId: processo.id,
              titulo: `${novasDesteProcesso} nova${novasDesteProcesso > 1 ? 's' : ''} movimentação${novasDesteProcesso > 1 ? 'ões' : ''}${fonte}`,
              mensagem: novasDesteProcesso > 1
                ? `${novasDesteProcesso} novas movimentações sincronizadas no processo ${procInfo?.numero || procInfo?.numeroCnj}. Mais recente: ${String(descricaoPrincipal).slice(0, 200)}`
                : `Nova movimentação sincronizada no processo ${procInfo?.numero || procInfo?.numeroCnj}: ${String(descricaoPrincipal).slice(0, 200)}`,
              tipo: 'MOVIMENTACAO',
            });
          } catch (notifErr) {
            logger.warn(`sincronizarTodos: falha ao notificar processo ${processo.id} - ${notifErr.message}`);
          }
        }

        // Rate limit between processes
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        logger.warn(`sincronizarTodos: erro no processo ${processo.id} - ${err.message}`);
        continue;
      }
    }

    res.json({
      mensagem: 'Sincronização concluída.',
      total: processos.length,
      processosAtualizados,
      atualizados: totalNovas,
    });
  } catch (err) { next(err); }
}

module.exports = {
  listar, criar, obter, atualizar, deletar, buscar, prazosAgenda, movimentacoesAgenda,
  importarCNJ, vincularCNJ, confirmarVinculacaoCNJ,
  ativarMonitoramento, desativarMonitoramento,
  sincronizarMovimentacoes, sincronizarTodos,
  movimentacoes, tarefas, documentos, honorarios, prazos, partes, anotacoes,
  adicionarParte, removerParte, adicionarMovimentacao, deletarMovimentacao,
  adicionarPrazo, atualizarPrazo, deletarPrazo,
  adicionarAnotacao, atualizarAnotacao, deletarAnotacao,
};
