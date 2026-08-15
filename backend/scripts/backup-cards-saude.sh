#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════
#  Backup das tabelas do app "Cards de Saúde" (cards_*) do banco
#  compartilhado, ANTES de qualquer exclusão.
#
#  Este script SÓ FAZ BACKUP. Ele NÃO apaga nada. A exclusão fica num
#  arquivo separado (drop-cards-saude.sql) que VOCÊ revisa e roda à mão,
#  depois de conferir que o backup abriu e está íntegro.
#
#  Uso (com o mysqldump/mysql instalados — ex.: no SSH da HostGator):
#     export DATABASE_URL='mysql://usuario:senha@host:3306/nome_do_banco'
#     bash backup-cards-saude.sh
#
#  Alternativa sem terminal: no phpMyAdmin do cPanel, selecione as tabelas
#  cards_* → Exportar (formato SQL) → salvar o arquivo. Só então dropá-las.
# ══════════════════════════════════════════════════════════════════
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERRO: defina DATABASE_URL antes de rodar."
  exit 1
fi

# ─── Parse do DATABASE_URL: mysql://user:pass@host:port/db ──────────
proto_removed="${DATABASE_URL#mysql://}"
creds="${proto_removed%@*}"
hostpart="${proto_removed#*@}"
DB_USER="${creds%%:*}"
DB_PASS="${creds#*:}"
DB_HOST="${hostpart%%:*}"
rest="${hostpart#*:}"
DB_PORT="${rest%%/*}"
DB_NAME="${hostpart##*/}"
DB_NAME="${DB_NAME%%\?*}"   # remove ?params se houver

STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="cards-saude-backup_${STAMP}.sql"
DROP_FILE="drop-cards-saude.sql"

echo "Banco: ${DB_NAME} @ ${DB_HOST}:${DB_PORT}"
echo "Descobrindo tabelas cards_* ..."

TABLES=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" -N -B \
  -e "SELECT table_name FROM information_schema.tables \
      WHERE table_schema='${DB_NAME}' AND table_name LIKE 'cards\\_%';")

if [[ -z "$TABLES" ]]; then
  echo "Nenhuma tabela cards_* encontrada. Nada a fazer."
  exit 0
fi

echo "Tabelas encontradas:"
echo "$TABLES" | sed 's/^/  - /'

# ─── Backup (estrutura + dados) ─────────────────────────────────────
echo "Gerando backup em ${BACKUP_FILE} ..."
# shellcheck disable=SC2086
mysqldump -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" \
  --single-transaction --no-tablespaces \
  "$DB_NAME" $TABLES > "$BACKUP_FILE"

echo "✅ Backup salvo: ${BACKUP_FILE} ($(wc -c < "$BACKUP_FILE") bytes)"

# ─── Gera (NÃO executa) o SQL de exclusão para revisão manual ───────
{
  echo "-- Revisado e gerado em ${STAMP}."
  echo "-- Rode SOMENTE depois de conferir que ${BACKUP_FILE} abre e está íntegro."
  echo "SET FOREIGN_KEY_CHECKS=0;"
  while IFS= read -r t; do
    echo "DROP TABLE IF EXISTS \`${t}\`;"
  done <<< "$TABLES"
  echo "SET FOREIGN_KEY_CHECKS=1;"
} > "$DROP_FILE"

echo "📄 SQL de exclusão gerado (NÃO executado): ${DROP_FILE}"
echo
echo "Próximo passo, MANUAL, só depois de validar o backup:"
echo "  mysql -h${DB_HOST} -P${DB_PORT} -u${DB_USER} -p ${DB_NAME} < ${DROP_FILE}"
