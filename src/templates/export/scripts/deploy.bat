@echo off
color 0A
echo ==================================================
echo       DEPLOY AUTOMATIZADO - CRM METABUILDER
echo ==================================================
echo.

:: NOME DO ARQUIVO ZIP (ajuste se seu zip tiver outro nome)
set ZIP_FILE=crm-source-code.zip
:: NOME DO PROCESSO NO PM2 (ex: meu-crm)
set PM2_APP_NAME=crm

if not exist "%ZIP_FILE%" (
    echo [ERRO] O arquivo %ZIP_FILE% nao foi encontrado nesta pasta!
    echo Copie o ZIP gerado na sua maquina para ca e tente novamente.
    echo.
    pause
    exit /b
)

echo [1/5] Apagando pasta 'src' antiga para evitar codigo zumbi...
if exist "src\" (
    rmdir /s /q "src"
)

echo [2/5] Extraindo o novo fonte do arquivo %ZIP_FILE%...
:: Usando o powershell nativo do windows para extrair por cima
powershell -command "Expand-Archive -Force -Path '%ZIP_FILE%' -DestinationPath '.'"

echo [3/5] Instalando dependencias (npm install)...
:: O comando 'call' eh essencial no windows para nao fechar o .bat
call npm install

echo [4/5] Compilando o projeto (npm run build)...
call npm run build

echo [5/5] Reiniciando a aplicacao via PM2...
:: Tenta reiniciar se ja existir, senao liga pela primeira vez da forma correta no Windows
call pm2 restart %PM2_APP_NAME% || call pm2 start node_modules\next\dist\bin\next --name "%PM2_APP_NAME%" -- start

echo.
echo ==================================================
echo        DEPLOY FINALIZADO COM SUCESSO!
echo ==================================================
echo.
pause
