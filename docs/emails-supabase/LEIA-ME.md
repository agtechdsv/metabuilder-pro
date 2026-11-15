# Modelos de e-mail do Supabase em 3 idiomas

Os e-mails de **cadastro, convite, link de acesso, troca de e-mail, recuperação de senha e reautenticação** saem pelo Supabase (Authentication > Emails). Estes modelos
escolhem o idioma (português, inglês ou espanhol) pelo cadastro do usuário e seguem o visual da marca.

## Como o idioma é escolhido
O sistema grava `lang` (`pt`, `en` ou `es`) nos dados do usuário (`user_metadata`):
- no **cadastro** com e-mail e senha (idioma da tela naquele momento);
- no **convite** (idioma de quem convida);
- a cada **login** e na página de retorno do login (Google, confirmação, recuperação), se o idioma da tela mudou.

Quem não tem idioma gravado recebe **português**. Para quem já tem conta há o script opcional `scripts/idioma-emails.sql`, que usa o idioma de cobrança do perfil.

## Como instalar (uma vez)
Os arquivos são **gerados**: não edite os `.html` à mão. Para mudar uma frase, edite `scripts/gerar-modelos-email-supabase.mjs` e gere de novo:

```bash
node scripts/gerar-modelos-email-supabase.mjs
```

No painel do Supabase, **Authentication > Emails > Templates**, abra cada modelo, apague o corpo, cole o conteúdo do arquivo de mesmo nome e cole o **assunto** de `assuntos.md`. Clique em **Save changes**.

| Modelo no Supabase | Arquivo |
|---|---|
| Confirm sign up | `confirm-signup.html` |
| Invite user | `invite-user.html` |
| Magic link or OTP | `magic-link.html` |
| Change email address | `change-email.html` |
| Reset password | `reset-password.html` |
| Reauthentication | `reauthentication.html` |

## Teste (obrigatório depois de colar)
A sintaxe dos modelos (Go template) só o Supabase valida de verdade. Se algum tiver erro, o e-mail **não sai** e a tela mostra erro. Teste cada um com um envio real:

1. **Reset password:** na tela de login, digite um e-mail seu e clique em **Esqueceu?**. Para ver outro idioma, troque o idioma da tela (PT/EN/ES), entre uma vez e peça de novo.
2. **Confirm sign up:** crie uma conta de teste com a tela em inglês e confira o e-mail em inglês.
3. **Invite user:** convide alguém para um workspace pelo painel e confira.
4. Os outros (magic link, troca de e-mail, reautenticação) só são enviados quando esses recursos são usados; teste-os quando puder.

Se um e-mail falhar ao enviar, volte o modelo para o texto anterior (botão **Reset template**) e me diga qual foi.

## Observações
- O link do e-mail de recuperação vale por 1 hora (padrão do Supabase). Se mudar a validade em Authentication, ajuste a frase em `reset-password` no gerador.
- O remetente e o endereço de resposta desses e-mails são os do **SMTP do Supabase** (Authentication > SMTP), não os do Gerenciador de e-mails do sistema.
