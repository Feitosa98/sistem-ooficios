@echo off
chcp 65001 >nul
echo ========================================================
echo   Instalador do Assinador Local - Sistema de Oficios
echo ========================================================
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
if %ERRORLEVEL% equ 0 (
    echo.
    echo [SUCESSO] Instalacao concluida com sucesso!
) else (
    echo.
    echo [ERRO] Houve uma falha ao registrar o assinador.
)
echo.
echo Pressione qualquer tecla para fechar esta janela...
pause >nul
