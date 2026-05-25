-- CreateEnum
CREATE TYPE "Plano" AS ENUM ('GRATUITO', 'MENSAL', 'ANUAL');

-- CreateEnum
CREATE TYPE "StatusProcesso" AS ENUM ('ATIVO', 'SUSPENSO', 'ARQUIVADO', 'ENCERRADO', 'AGUARDANDO');

-- CreateEnum
CREATE TYPE "TipoParte" AS ENUM ('AUTOR', 'REU', 'TERCEIRO', 'INTERESSADO', 'TESTEMUNHA');

-- CreateEnum
CREATE TYPE "Prioridade" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE');

-- CreateEnum
CREATE TYPE "StatusTarefa" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoPrazo" AS ENUM ('PROCESSUAL', 'RECURSAL', 'PRESCRICIONAL', 'DECADENCIAL', 'OUTRO');

-- CreateEnum
CREATE TYPE "StatusPrazo" AS ENUM ('PENDENTE', 'CUMPRIDO', 'PERDIDO');

-- CreateEnum
CREATE TYPE "StatusParcela" AS ENUM ('PENDENTE', 'PAGO', 'ATRASADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoNotificacao" AS ENUM ('MOVIMENTACAO', 'PRAZO', 'TAREFA', 'HONORARIO', 'SISTEMA', 'INFO');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "oab" TEXT,
    "telefone" TEXT,
    "avatar" TEXT,
    "plano" "Plano" NOT NULL DEFAULT 'GRATUITO',
    "planoExpiracao" TIMESTAMP(3),
    "aceitouTermos" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processos" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "numeroCnj" TEXT,
    "tribunal" TEXT,
    "vara" TEXT,
    "classe" TEXT,
    "assunto" TEXT,
    "status" "StatusProcesso" NOT NULL DEFAULT 'ATIVO',
    "valor" DECIMAL(15,2),
    "dataDistribuicao" TIMESTAMP(3),
    "dataUltimaAtualizacao" TIMESTAMP(3),
    "origemDados" TEXT DEFAULT 'manual',
    "monitoramentoAtivo" BOOLEAN NOT NULL DEFAULT false,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partes" (
    "id" TEXT NOT NULL,
    "processoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoParte" NOT NULL,
    "cpfCnpj" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advogados_processo" (
    "id" TEXT NOT NULL,
    "processoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "oab" TEXT,
    "email" TEXT,
    "polo" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advogados_processo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentacoes" (
    "id" TEXT NOT NULL,
    "processoId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo" TEXT,
    "origemApi" TEXT DEFAULT 'manual',
    "hashExterno" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarefas" (
    "id" TEXT NOT NULL,
    "processoId" TEXT,
    "usuarioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "prazo" TIMESTAMP(3),
    "prioridade" "Prioridade" NOT NULL DEFAULT 'MEDIA',
    "status" "StatusTarefa" NOT NULL DEFAULT 'PENDENTE',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tarefas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subtarefas" (
    "id" TEXT NOT NULL,
    "tarefaId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "status" "StatusTarefa" NOT NULL DEFAULT 'PENDENTE',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subtarefas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prazos" (
    "id" TEXT NOT NULL,
    "processoId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "dataVencimento" TIMESTAMP(3) NOT NULL,
    "tipo" "TipoPrazo" NOT NULL DEFAULT 'PROCESSUAL',
    "status" "StatusPrazo" NOT NULL DEFAULT 'PENDENTE',
    "alertaDias" INTEGER NOT NULL DEFAULT 3,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prazos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos" (
    "id" TEXT NOT NULL,
    "processoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "arquivo" TEXT NOT NULL,
    "tamanho" INTEGER,
    "mimeType" TEXT,
    "descricao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "honorarios" (
    "id" TEXT NOT NULL,
    "processoId" TEXT NOT NULL,
    "valorTotal" DECIMAL(15,2) NOT NULL,
    "descricao" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "honorarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parcelas" (
    "id" TEXT NOT NULL,
    "honorarioId" TEXT NOT NULL,
    "valor" DECIMAL(15,2) NOT NULL,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "status" "StatusParcela" NOT NULL DEFAULT 'PENDENTE',
    "dataPagamento" TIMESTAMP(3),
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parcelas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anotacoes" (
    "id" TEXT NOT NULL,
    "processoId" TEXT NOT NULL,
    "titulo" TEXT,
    "conteudo" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anotacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacoes" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "processoId" TEXT,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "tipo" "TipoNotificacao" NOT NULL DEFAULT 'INFO',
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "dados" JSONB,
    "ip" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "processos_numeroCnj_key" ON "processos"("numeroCnj");

-- CreateIndex
CREATE INDEX "processos_usuarioId_idx" ON "processos"("usuarioId");

-- CreateIndex
CREATE INDEX "processos_numeroCnj_idx" ON "processos"("numeroCnj");

-- CreateIndex
CREATE INDEX "processos_status_idx" ON "processos"("status");

-- CreateIndex
CREATE INDEX "partes_processoId_idx" ON "partes"("processoId");

-- CreateIndex
CREATE INDEX "advogados_processo_processoId_idx" ON "advogados_processo"("processoId");

-- CreateIndex
CREATE UNIQUE INDEX "movimentacoes_hashExterno_key" ON "movimentacoes"("hashExterno");

-- CreateIndex
CREATE INDEX "movimentacoes_processoId_idx" ON "movimentacoes"("processoId");

-- CreateIndex
CREATE INDEX "movimentacoes_data_idx" ON "movimentacoes"("data");

-- CreateIndex
CREATE INDEX "tarefas_processoId_idx" ON "tarefas"("processoId");

-- CreateIndex
CREATE INDEX "tarefas_usuarioId_idx" ON "tarefas"("usuarioId");

-- CreateIndex
CREATE INDEX "tarefas_status_idx" ON "tarefas"("status");

-- CreateIndex
CREATE INDEX "subtarefas_tarefaId_idx" ON "subtarefas"("tarefaId");

-- CreateIndex
CREATE INDEX "prazos_processoId_idx" ON "prazos"("processoId");

-- CreateIndex
CREATE INDEX "prazos_dataVencimento_idx" ON "prazos"("dataVencimento");

-- CreateIndex
CREATE INDEX "documentos_processoId_idx" ON "documentos"("processoId");

-- CreateIndex
CREATE INDEX "honorarios_processoId_idx" ON "honorarios"("processoId");

-- CreateIndex
CREATE INDEX "parcelas_honorarioId_idx" ON "parcelas"("honorarioId");

-- CreateIndex
CREATE INDEX "anotacoes_processoId_idx" ON "anotacoes"("processoId");

-- CreateIndex
CREATE INDEX "notificacoes_usuarioId_idx" ON "notificacoes"("usuarioId");

-- CreateIndex
CREATE INDEX "notificacoes_lida_idx" ON "notificacoes"("lida");

-- CreateIndex
CREATE INDEX "audit_logs_usuarioId_idx" ON "audit_logs"("usuarioId");

-- CreateIndex
CREATE INDEX "audit_logs_criadoEm_idx" ON "audit_logs"("criadoEm");

-- AddForeignKey
ALTER TABLE "processos" ADD CONSTRAINT "processos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partes" ADD CONSTRAINT "partes_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "processos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advogados_processo" ADD CONSTRAINT "advogados_processo_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "processos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "processos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "processos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subtarefas" ADD CONSTRAINT "subtarefas_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES "tarefas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prazos" ADD CONSTRAINT "prazos_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "processos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "processos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "honorarios" ADD CONSTRAINT "honorarios_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "processos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcelas" ADD CONSTRAINT "parcelas_honorarioId_fkey" FOREIGN KEY ("honorarioId") REFERENCES "honorarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anotacoes" ADD CONSTRAINT "anotacoes_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "processos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "processos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
