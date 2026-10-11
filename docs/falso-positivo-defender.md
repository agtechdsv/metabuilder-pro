# Falso positivo do Defender no instalador Windows

Detecção observada (2026-10-11): `Trojan:Win32/Phonzy.A!ml` (motor de machine learning), no
`MetaBuilder.PRO.-.IDE_1.0.0_x64-setup.exe`. O instalador não tem assinatura de código.

A correção definitiva é assinar o instalador e o `bin/cli` (Azure Trusted Signing ou certificado OV/EV).
Enquanto isso, enviar cada release à Microsoft.

## Passo a passo do envio

1. Abrir https://www.microsoft.com/wdsi/filesubmission e entrar com conta Microsoft.
2. Escolher **Software developer**.
3. Anexar o `.exe` baixado do release (zip com senha `infected` é aceito se o arquivo for bloqueado).
4. Em "Detection name", informar `Trojan:Win32/Phonzy.A!ml`.
5. Colar o texto abaixo e o SHA-256 (aparece no resumo do job "Build Tauri" no GitHub Actions).

## Texto sugerido (inglês)

> This is the Windows installer (NSIS, built with Tauri) of MetaBuilder PRO, a legitimate desktop IDE
> published at https://metabuilderpro.com. The installer is not yet code-signed. It was flagged as
> Trojan:Win32/Phonzy.A!ml by the machine-learning engine, which we believe is a false positive.
> The app bundles a local CLI agent (Node-based, packaged with pkg) that connects to databases and
> an optional tunnel chosen by the user. It contains no malicious behavior. Please review and
> remove the detection. SHA-256: <HASH>

## Observações

- O hash muda a cada build; é preciso reenviar a cada release até a assinatura estar ativa.
- Não distribuir o instalador em zip para fugir da varredura: piora a reputação do domínio.
