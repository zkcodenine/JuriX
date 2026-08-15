-- Aditivo: coluna que guarda quando o sistema CONFEROU o tribunal (mesmo sem
-- movimento novo), para o card mostrar "verificado em ...". Não toca cards_*.
ALTER TABLE `processos` ADD COLUMN `ultimaVerificacao` DATETIME(3) NULL;
