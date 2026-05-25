// ══════════════════════════════════════════════════════════════════
//  JuriX — Import de dados para HostGator (MySQL)
//
//  Lê os arquivos JSON gerados por export-supabase.js e insere
//  no MySQL HostGator usando o Prisma Client (que já está
//  configurado para MySQL via DATABASE_URL).
//
//  Pré-requisitos:
//    1. Ter rodado scripts/export-supabase.js antes.
//    2. DATABASE_URL no backend/.env aponta para o MySQL HostGator.
//    3. Schema já criado: cd backend && npx prisma db push
//
//  Execute: node scripts/import-hostgator.js
// ══════════════════════════════════════════════════════════════════

const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });

const { PrismaClient } = require(path.join(__dirname, '..', 'backend', 'node_modules', '@prisma', 'client'));
const prisma = new PrismaClient();

const DUMP_DIR = path.join(__dirname, '..', 'backup', 'supabase_dump');

// Ordem de importação: pai antes de filho (respeita foreign keys)
const IMPORT_ORDER = [
  { file: 'usuarios.json',           model: 'usuario',          mapper: mapUsuario },
  { file: 'processos.json',          model: 'processo',         mapper: mapProcesso },
  { file: 'partes.json',             model: 'parte',            mapper: mapParte },
  { file: 'advogados_processo.json', model: 'advogadoProcesso', mapper: mapAdvogadoProcesso },
  { file: 'movimentacoes.json',      model: 'movimentacao',     mapper: mapMovimentacao },
  { file: 'tarefas.json',            model: 'tarefa',           mapper: mapTarefa },
  { file: 'subtarefas.json',         model: 'subtarefa',        mapper: mapSubtarefa },
  { file: 'prazos.json',             model: 'prazo',            mapper: mapPrazo },
  { file: 'documentos.json',         model: 'documento',        mapper: mapDocumento },
  { file: 'honorarios.json',         model: 'honorario',        mapper: mapHonorario },
  { file: 'parcelas.json',           model: 'parcela',          mapper: mapParcela },
  { file: 'anotacoes.json',          model: 'anotacao',         mapper: mapAnotacao },
  { file: 'notificacoes.json',       model: 'notificacao',      mapper: mapNotificacao },
  { file: 'configuracoes.json',      model: 'configuracao',     mapper: mapConfiguracao },
  { file: 'modelos_documento.json',  model: 'modeloDocumento',  mapper: mapModeloDocumento },
  { file: 'etiquetas_agenda.json',   model: 'etiquetaAgenda',   mapper: mapEtiquetaAgenda },
  { file: 'eventos_agenda.json',     model: 'eventoAgenda',     mapper: mapEventoAgenda },
  { file: 'audit_logs.json',         model: 'auditLog',         mapper: mapAuditLog },
];

// ─── Mappers: snake_case (Postgres) → camelCase (Prisma) ──────────
function toDate(v) { return v ? new Date(v) : null; }
function toDateReq(v) { return v ? new Date(v) : new Date(); }

function mapUsuario(r) {
  return {
    id: r.id, nome: r.nome, email: r.email, senha: r.senha,
    oab: r.oab, telefone: r.telefone, avatar: r.avatar,
    tema: r.tema, plano: r.plano,
    planoExpiracao: toDate(r.planoExpiracao || r.plano_expiracao),
    aceitouTermos: r.aceitouTermos ?? r.aceitou_termos ?? false,
    ativo: r.ativo ?? true,
    criadoEm: toDateReq(r.criadoEm || r.criado_em),
    atualizadoEm: toDateReq(r.atualizadoEm || r.atualizado_em),
  };
}
function mapProcesso(r) {
  return {
    id: r.id, usuarioId: r.usuarioId || r.usuario_id,
    numero: r.numero, numeroCnj: r.numeroCnj || r.numero_cnj,
    tribunal: r.tribunal, vara: r.vara, classe: r.classe, assunto: r.assunto,
    status: r.status, valor: r.valor,
    dataDistribuicao: toDate(r.dataDistribuicao || r.data_distribuicao),
    dataUltimaAtualizacao: toDate(r.dataUltimaAtualizacao || r.data_ultima_atualizacao),
    origemDados: r.origemDados || r.origem_dados || 'manual',
    monitoramentoAtivo: r.monitoramentoAtivo ?? r.monitoramento_ativo ?? false,
    observacoes: r.observacoes,
    criadoEm: toDateReq(r.criadoEm || r.criado_em),
    atualizadoEm: toDateReq(r.atualizadoEm || r.atualizado_em),
  };
}
function mapParte(r) {
  return {
    id: r.id, processoId: r.processoId || r.processo_id,
    nome: r.nome, tipo: r.tipo, cpfCnpj: r.cpfCnpj || r.cpf_cnpj,
    email: r.email, telefone: r.telefone,
    criadoEm: toDateReq(r.criadoEm || r.criado_em),
  };
}
function mapAdvogadoProcesso(r) {
  return {
    id: r.id, processoId: r.processoId || r.processo_id,
    nome: r.nome, oab: r.oab, email: r.email, polo: r.polo,
    criadoEm: toDateReq(r.criadoEm || r.criado_em),
  };
}
function mapMovimentacao(r) {
  return {
    id: r.id, processoId: r.processoId || r.processo_id,
    data: toDateReq(r.data), descricao: r.descricao, tipo: r.tipo,
    origemApi: r.origemApi || r.origem_api || 'manual',
    hashExterno: r.hashExterno || r.hash_externo,
    criadoEm: toDateReq(r.criadoEm || r.criado_em),
  };
}
function mapTarefa(r) {
  return {
    id: r.id, processoId: r.processoId || r.processo_id,
    usuarioId: r.usuarioId || r.usuario_id,
    titulo: r.titulo, descricao: r.descricao,
    prazo: toDate(r.prazo), prioridade: r.prioridade, status: r.status,
    observacaoConclusao: r.observacaoConclusao || r.observacao_conclusao,
    criadoEm: toDateReq(r.criadoEm || r.criado_em),
    atualizadoEm: toDateReq(r.atualizadoEm || r.atualizado_em),
  };
}
function mapSubtarefa(r) {
  return {
    id: r.id, tarefaId: r.tarefaId || r.tarefa_id,
    titulo: r.titulo, status: r.status,
    criadoEm: toDateReq(r.criadoEm || r.criado_em),
  };
}
function mapPrazo(r) {
  return {
    id: r.id, processoId: r.processoId || r.processo_id,
    titulo: r.titulo, descricao: r.descricao,
    dataVencimento: toDateReq(r.dataVencimento || r.data_vencimento),
    tipo: r.tipo, status: r.status,
    alertaDias: r.alertaDias ?? r.alerta_dias ?? 3,
    criadoEm: toDateReq(r.criadoEm || r.criado_em),
  };
}
function mapDocumento(r) {
  return {
    id: r.id, processoId: r.processoId || r.processo_id,
    nome: r.nome, arquivo: r.arquivo,
    tamanho: r.tamanho, mimeType: r.mimeType || r.mime_type,
    descricao: r.descricao,
    criadoEm: toDateReq(r.criadoEm || r.criado_em),
  };
}
function mapHonorario(r) {
  return {
    id: r.id, processoId: r.processoId || r.processo_id,
    valorTotal: r.valorTotal || r.valor_total,
    descricao: r.descricao, status: r.status || 'pendente',
    criadoEm: toDateReq(r.criadoEm || r.criado_em),
    atualizadoEm: toDateReq(r.atualizadoEm || r.atualizado_em),
  };
}
function mapParcela(r) {
  return {
    id: r.id, honorarioId: r.honorarioId || r.honorario_id,
    valor: r.valor, vencimento: toDateReq(r.vencimento),
    status: r.status,
    dataPagamento: toDate(r.dataPagamento || r.data_pagamento),
    observacao: r.observacao,
    criadoEm: toDateReq(r.criadoEm || r.criado_em),
  };
}
function mapAnotacao(r) {
  return {
    id: r.id, processoId: r.processoId || r.processo_id,
    titulo: r.titulo, conteudo: r.conteudo,
    criadoEm: toDateReq(r.criadoEm || r.criado_em),
    atualizadoEm: toDateReq(r.atualizadoEm || r.atualizado_em),
  };
}
function mapNotificacao(r) {
  return {
    id: r.id, usuarioId: r.usuarioId || r.usuario_id,
    processoId: r.processoId || r.processo_id,
    titulo: r.titulo, mensagem: r.mensagem, tipo: r.tipo,
    lida: r.lida ?? false,
    criadoEm: toDateReq(r.criadoEm || r.criado_em),
  };
}
function mapConfiguracao(r) {
  return {
    id: r.id, usuarioId: r.usuarioId || r.usuario_id,
    chave: r.chave, valor: r.valor,
    criadoEm: toDateReq(r.criadoEm || r.criado_em),
  };
}
function mapModeloDocumento(r) {
  return {
    id: r.id, usuarioId: r.usuarioId || r.usuario_id,
    nome: r.nome, descricao: r.descricao,
    conteudo: r.conteudo, categoria: r.categoria,
    criadoEm: toDateReq(r.criadoEm || r.criado_em),
    atualizadoEm: toDateReq(r.atualizadoEm || r.atualizado_em),
  };
}
function mapEtiquetaAgenda(r) {
  return {
    id: r.id, usuarioId: r.usuarioId || r.usuario_id,
    nome: r.nome, cor: r.cor || '#C9A84C',
    criadoEm: toDateReq(r.criadoEm || r.criado_em),
  };
}
function mapEventoAgenda(r) {
  return {
    id: r.id, usuarioId: r.usuarioId || r.usuario_id,
    etiquetaId: r.etiquetaId || r.etiqueta_id,
    titulo: r.titulo, data: toDateReq(r.data),
    horario: r.horario, descricao: r.descricao,
    criadoEm: toDateReq(r.criadoEm || r.criado_em),
    atualizadoEm: toDateReq(r.atualizadoEm || r.atualizado_em),
  };
}
function mapAuditLog(r) {
  return {
    id: r.id, usuarioId: r.usuarioId || r.usuario_id,
    acao: r.acao, entidade: r.entidade,
    entidadeId: r.entidadeId || r.entidade_id,
    dados: r.dados, ip: r.ip,
    criadoEm: toDateReq(r.criadoEm || r.criado_em),
  };
}

(async () => {
  if (!fs.existsSync(DUMP_DIR)) {
    console.error(`\n[!] Pasta de dump não encontrada: ${DUMP_DIR}`);
    console.error('    Rode primeiro: node scripts/export-supabase.js\n');
    process.exit(1);
  }

  console.log('\n→ Importando dados para o MySQL HostGator...');
  console.log(`  Origem: ${DUMP_DIR}\n`);

  const summary = {};
  for (const { file, model, mapper } of IMPORT_ORDER) {
    const filepath = path.join(DUMP_DIR, file);
    if (!fs.existsSync(filepath)) {
      console.log(`  - ${file.padEnd(28)} (arquivo não encontrado, pulando)`);
      continue;
    }
    const rows = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    if (!Array.isArray(rows) || rows.length === 0) {
      console.log(`  - ${file.padEnd(28)} 0 registros (pulando)`);
      summary[model] = 0;
      continue;
    }

    let inserted = 0;
    let skipped = 0;
    for (const r of rows) {
      try {
        await prisma[model].create({ data: mapper(r) });
        inserted++;
      } catch (err) {
        if (err.code === 'P2002') { skipped++; continue; }      // duplicate
        if (err.code === 'P2003') { skipped++; continue; }      // FK não encontrada (registro órfão)
        console.error(`    ✗ ${model} id=${r.id}: ${err.message}`);
        skipped++;
      }
    }
    console.log(`  ✓ ${file.padEnd(28)} ${inserted} inseridos, ${skipped} pulados`);
    summary[model] = { inserted, skipped, total: rows.length };
  }

  await prisma.$disconnect();

  fs.writeFileSync(
    path.join(DUMP_DIR, '_import_summary.json'),
    JSON.stringify({ importedAt: new Date().toISOString(), summary }, null, 2)
  );

  console.log('\n✓ Importação concluída.');
  console.log('  Resumo salvo em: backup/supabase_dump/_import_summary.json\n');
})().catch(err => {
  console.error('\n[!] Erro inesperado:', err);
  prisma.$disconnect().finally(() => process.exit(1));
});
