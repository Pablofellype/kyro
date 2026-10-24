!macro EncerrarProcessosDoKyro
  nsExec::Exec `"$SYSDIR\taskkill.exe" /F /T /IM kyro.exe`
  Pop $0
  Sleep 800
!macroend

!macro NSIS_HOOK_PREINSTALL
  !insertmacro EncerrarProcessosDoKyro
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro EncerrarProcessosDoKyro
!macroend
