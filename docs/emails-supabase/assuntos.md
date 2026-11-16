# Assuntos dos e-mails do Supabase (GERADO por scripts/gerar-modelos-email-supabase.mjs)

Cole cada bloco no campo **Subject** do modelo de mesmo nome. Cada um escolhe o idioma pelo cadastro do usuário. O Supabase aceita no máximo 255 caracteres neste campo (todos os blocos abaixo cabem).

## confirm-signup

```
{{ $l := "pt" }}{{ if .Data }}{{ if .Data.lang }}{{ $l = .Data.lang }}{{ end }}{{ end }}MetaBuilder PRO: {{ if eq $l "en" }}Confirm your sign-up{{ else if eq $l "es" }}Confirme su registro{{ else }}Confirme o seu cadastro{{ end }}
```

## invite-user

```
{{ $l := "pt" }}{{ if .Data }}{{ if .Data.lang }}{{ $l = .Data.lang }}{{ end }}{{ end }}MetaBuilder PRO: {{ if eq $l "en" }}You have been invited{{ else if eq $l "es" }}Lo invitaron{{ else }}Você foi convidado{{ end }}
```

## magic-link

```
{{ $l := "pt" }}{{ if .Data }}{{ if .Data.lang }}{{ $l = .Data.lang }}{{ end }}{{ end }}MetaBuilder PRO: {{ if eq $l "en" }}Your sign-in link{{ else if eq $l "es" }}Su enlace de acceso{{ else }}Seu link de acesso{{ end }}
```

## change-email

```
{{ $l := "pt" }}{{ if .Data }}{{ if .Data.lang }}{{ $l = .Data.lang }}{{ end }}{{ end }}MetaBuilder PRO: {{ if eq $l "en" }}Confirm your e-mail change{{ else if eq $l "es" }}Confirme el cambio de e-mail{{ else }}Confirme a troca de e-mail{{ end }}
```

## reset-password

```
{{ $l := "pt" }}{{ if .Data }}{{ if .Data.lang }}{{ $l = .Data.lang }}{{ end }}{{ end }}MetaBuilder PRO: {{ if eq $l "en" }}Reset your password{{ else if eq $l "es" }}Restablezca su contraseña{{ else }}Redefina a sua senha{{ end }}
```

## reauthentication

```
{{ $l := "pt" }}{{ if .Data }}{{ if .Data.lang }}{{ $l = .Data.lang }}{{ end }}{{ end }}MetaBuilder PRO: {{ if eq $l "en" }}Your confirmation code{{ else if eq $l "es" }}Su código de confirmación{{ else }}Seu código de confirmação{{ end }}
```
