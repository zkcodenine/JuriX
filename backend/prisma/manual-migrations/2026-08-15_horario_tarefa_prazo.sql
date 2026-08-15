-- Aditivo: coluna de horário (HH:MM) em tarefas e prazos para o lembrete do
-- Google cair no horário informado. Apenas ADD COLUMN. Não toca cards_*.
ALTER TABLE `tarefas` ADD COLUMN `horario` VARCHAR(191) NULL;
ALTER TABLE `prazos`  ADD COLUMN `horario` VARCHAR(191) NULL;
