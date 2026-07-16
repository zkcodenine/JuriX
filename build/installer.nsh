# ══════════════════════════════════════════════════════════════════
#  JuriX — recria os atalhos após um update
#
#  Num update o atalho da área de trabalho sumia (ícone branco, não
#  abria nada). Não é corrupção: é o atalho sendo APAGADO e nunca
#  recriado. A sequência dentro do installSection.nsh:
#
#   1. uninstallOldVersion roda o desinstalador da versão antiga,
#      que remove os atalhos.
#   2. addDesktopLink recebe keepShortcuts="true" (o valor vem do
#      registro, INSTALL_REGISTRY_KEY\KeepShortcuts) e nesse modo só
#      age se o NOME do atalho mudou — ou seja, não recria nada.
#   3. Resultado: update termina sem atalho na área de trabalho.
#
#  Confirmado com marcador em registro durante o install: $appExe
#  vinha correto, mas o .lnk já não existia (FileExists = falso).
#
#  createDesktopShortcut:"always" NÃO resolve — aquele ramo do
#  addDesktopLink é guardado por ${ifNot} ${isUpdated}, então nunca
#  dispara justamente no caso do update.
#
#  customInstall roda depois do addDesktopLink, com $appExe já
#  apontando para $INSTDIR. Recriar aqui é o conserto.
# ══════════════════════════════════════════════════════════════════
!macro customInstall
  # Sem guard de FileExists: durante o update o atalho JÁ foi apagado
  # pelo passo 1, então checar existência só pularia o conserto.
  CreateShortCut "$newDesktopLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
  ClearErrors
  WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"

  CreateShortCut "$newStartMenuLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
  ClearErrors
  WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"

  # Faz o Explorer recarregar o ícone em vez de mostrar o cache antigo.
  System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
!macroend
