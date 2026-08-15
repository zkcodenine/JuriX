-- Aditivo: coluna JSON de múltiplos contatos de cobrança + tabela de tipos de
-- prazo personalizados. Apenas ADD COLUMN / CREATE TABLE. Não toca cards_*.
ALTER TABLE `processos` ADD COLUMN `cobrancaContatos` JSON NULL;

CREATE TABLE IF NOT EXISTS `tipos_prazo_usuario` (
  `id`        VARCHAR(191) NOT NULL,
  `usuarioId` VARCHAR(191) NOT NULL,
  `nome`      VARCHAR(191) NOT NULL,
  `criadoEm`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `tipos_prazo_usuario_usuarioId_nome_key` (`usuarioId`, `nome`),
  KEY `tipos_prazo_usuario_usuarioId_idx` (`usuarioId`),
  CONSTRAINT `tipos_prazo_usuario_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
