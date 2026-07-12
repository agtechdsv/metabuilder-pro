# Manual Prático de Deploy - CRM (Ambiente Windows)

Este manual descreve o passo a passo exato para implantar a aplicação CRM em um servidor Windows, desde a primeira instalação (do zero) até a rotina de atualizações futuras.

---

## 🚀 PARTE 1: A Primeira Instalação (Instalando do Zero)

Estes passos devem ser executados **apenas uma vez** na vida útil do servidor, logo após descompactar o arquivo `.zip` pela primeira vez na pasta de destino (ex: `C:\crm`).

### 1. Preparando o Terreno (Instalar o PM2)
**Comando:**
```bash
npm install -g pm2
```
> **Por que fazer isso?** O PM2 é o nosso "Guardião". Ele garante que a aplicação rode em segundo plano (background) e religue sozinha caso o servidor reinicie ou ocorra algum erro inesperado. Sem ele, a aplicação cairia assim que você fechasse a janela preta do terminal.

### 2. Instalando as Dependências do Projeto
**Comando:**
```bash
npm install
```
> **Por que fazer isso?** O código exportado no `.zip` vem "seco", apenas com a inteligência do sistema. Este comando faz o Node.js baixar todas as bibliotecas externas necessárias (React, Next.js, etc.) para dentro da pasta `node_modules`.

### 3. Compilando o Projeto para Produção
**Comando:**
```bash
npm run build
```
> **Por que fazer isso?** Este comando pega todo o código fonte e converte para uma versão hiper-otimizada e super rápida, pronta para ser servida aos usuários finais. Ele cria a pasta invisível `.next` com o projeto finalizado.

### 4. Iniciando a Aplicação de Forma Segura no Windows
**Comando:**
```bash
pm2 start node_modules\next\dist\bin\next --name "crm" -- start
```
> **Por que fazer isso?** Aqui estamos mandando o PM2 ligar o CRM. Usamos o caminho longo (`node_modules/.../next`) em vez de simplesmente `npm` porque o Windows tem um pequeno conflito interno com o PM2. Dessa forma, garantimos que o processo suba 100% verde (online) e sem _crashes_.

### 5. Salvando a Configuração na Memória
**Comando:**
```bash
pm2 save
```
> **Por que fazer isso?** O PM2 liga a aplicação, mas se o servidor (máquina física ou VM) for reiniciado, ele esquece o que estava rodando. O comando `save` "tira uma foto" do estado atual para que o PM2 saiba exatamente quem ele deve religar caso a energia caia.

---

## 🔄 PARTE 2: Atualizações Futuras (Deploy Contínuo)

Depois que o servidor já passou pela **PARTE 1**, a sua vida e a do seu cliente ficam muito mais fáceis. Você **não precisará** mais digitar todos aqueles comandos.

### Como atualizar o sistema em segundos:

1. Gere o novo arquivo `.zip` (ex: `crm-source-code.zip`) na IDE do MetaBuilder.
2. Jogue esse arquivo ZIP dentro da pasta do servidor (junto de onde está o código antigo).
3. Dê **dois cliques** no arquivo `deploy.bat`.

> **O que o arquivo `deploy.bat` faz por trás dos panos?**
> - Ele apaga a pasta `src` antiga (evitando que telas apagadas na IDE fiquem sobrando como "código zumbi").
> - Ele extrai o ZIP novo sobrescrevendo tudo rapidamente.
> - Ele roda o `npm install` e o `npm run build` (que agora serão quase instantâneos, pois vão reaproveitar o cache da vez anterior).
> - E no final, ele tenta rodar `pm2 restart crm` para reiniciar a aplicação em frações de segundo, já com o código novo rodando para os usuários. (Se for a primeira vez, ele ligará de forma segura via bypass do Next.js).
