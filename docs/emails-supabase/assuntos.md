# Assuntos dos e-mails do Supabase (GERADO por scripts/gerar-modelos-email-supabase.mjs)

Cole cada bloco no campo **Subject** do modelo de mesmo nome. Cada um escolhe o idioma pelo cadastro do usuário.

## confirm-signup

```
{{ $l := "pt" }}{{ if .Data }}{{ if .Data.lang }}{{ $l = .Data.lang }}{{ end }}{{ end }}{{ if eq $l "en" }}Confirm your MetaBuilder PRO sign-up{{ else if eq $l "es" }}Confirme su registro en MetaBuilder PRO{{ else }}Confirme o seu cadastro no MetaBuilder PRO{{ end }}
```

## invite-user

```
{{ $l := "pt" }}{{ if .Data }}{{ if .Data.lang }}{{ $l = .Data.lang }}{{ end }}{{ end }}{{ if eq $l "en" }}You have been invited to MetaBuilder PRO{{ else if eq $l "es" }}Lo invitaron a MetaBuilder PRO{{ else }}Você foi convidado para o MetaBuilder PRO{{ end }}
```

## magic-link

```
{{ $l := "pt" }}{{ if .Data }}{{ if .Data.lang }}{{ $l = .Data.lang }}{{ end }}{{ end }}{{ if eq $l "en" }}Your MetaBuilder PRO sign-in link{{ else if eq $l "es" }}Su enlace de acceso a MetaBuilder PRO{{ else }}Seu link de acesso ao MetaBuilder PRO{{ end }}
```

## change-email

```
{{ $l := "pt" }}{{ if .Data }}{{ if .Data.lang }}{{ $l = .Data.lang }}{{ end }}{{ end }}{{ if eq $l "en" }}Confirm your MetaBuilder PRO e-mail change{{ else if eq $l "es" }}Confirme el cambio de su e-mail en MetaBuilder PRO{{ else }}Confirme a troca do seu e-mail no MetaBuilder PRO{{ end }}
```

## reset-password

```
{{ $l := "pt" }}{{ if .Data }}{{ if .Data.lang }}{{ $l = .Data.lang }}{{ end }}{{ end }}{{ if eq $l "en" }}Reset your MetaBuilder PRO password{{ else if eq $l "es" }}Restablezca su contraseña de MetaBuilder PRO{{ else }}Redefina a sua senha do MetaBuilder PRO{{ end }}
```

## reauthentication

```
{{ $l := "pt" }}{{ if .Data }}{{ if .Data.lang }}{{ $l = .Data.lang }}{{ end }}{{ end }}{{ if eq $l "en" }}Your MetaBuilder PRO confirmation code{{ else if eq $l "es" }}Su código de confirmación de MetaBuilder PRO{{ else }}Seu código de confirmação do MetaBuilder PRO{{ end }}
```
