-- CreateTable
CREATE TABLE "configuracoes" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "configuracoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modelos_documento" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "conteudo" TEXT NOT NULL,
    "categoria" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modelos_documento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "configuracoes_usuarioId_idx" ON "configuracoes"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "configuracoes_usuarioId_chave_key" ON "configuracoes"("usuarioId", "chave");

-- CreateIndex
CREATE INDEX "modelos_documento_usuarioId_idx" ON "modelos_documento"("usuarioId");

-- AddForeignKey
ALTER TABLE "configuracoes" ADD CONSTRAINT "configuracoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modelos_documento" ADD CONSTRAINT "modelos_documento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
