@echo off
chcp 65001 >nul
echo ========================================================
echo   Desinstalador do Assinador Local - Sistema de Oficios
echo ========================================================
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1"
if %ERRORLEVEL% equ 0 (
    echo.
    echo [SUCESSO] Desinstalacao concluida com sucesso!
) else (
    echo.
    echo [ERRO] Houve uma falha ao remover o assinador.
)
echo.
echo Pressione qualquer tecla para fechar esta janela...
pause >nul
