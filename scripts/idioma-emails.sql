-- Idioma dos e-mails do Supabase para quem JÁ tem conta (OPCIONAL).
--
-- Os modelos de e-mail escolhem o idioma por auth.users.raw_user_meta_data->>'lang'. Daqui para a frente o idioma é gravado no cadastro, no convite e
-- a cada login (quem ainda não tem, recebe em português). Este script só adianta isso para quem já existe, usando o idioma de cobrança do perfil
-- (profiles.billing_language, gravado no checkout). Quem não tem esse dado continua sem idioma = português, e passa a ter no próximo login.
--
-- Rodar no SQL Editor do Supabase. Seguro repetir: só preenche quem ainda NÃO tem idioma e nunca sobrescreve.

-- 1) Quantos seriam atualizados (rode primeiro e confira)
select count(*) as a_atualizar
from auth.users u
join public.profiles p on p.id = u.id
where p.billing_language in ('pt', 'en', 'es')
  and coalesce(u.raw_user_meta_data->>'lang', '') = '';

-- 2) Atualiza
update auth.users u
set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('lang', p.billing_language)
from public.profiles p
where p.id = u.id
  and p.billing_language in ('pt', 'en', 'es')
  and coalesce(u.raw_user_meta_data->>'lang', '') = '';
