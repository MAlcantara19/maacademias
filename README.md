# MA Academias

Sistema para academias de luta: página pública, chamada (manual e QR na parede),
alunos, ranking, calendário, campeonatos (pesagem, checklist e ficha em PDF),
pendências, ausências, carteirinha digital e notificações.

Feito com Next.js + Supabase. Um sistema só para várias academias, cada uma
com seu link (`/slug`) ou domínio próprio.

## Rodar no computador

1. Copie `.env.example` para `.env.local` e preencha com os dados do Supabase.
2. `npm install`
3. `npm run dev` e abra http://localhost:3000

## Banco de dados

Os arquivos ficam em `supabase/`:
- `INSTALAR-TUDO.sql` — **use este**: recomeça o banco, cria tudo, coloca a
  Academia Piloto e liga os logins. Pode rodar de novo quando quiser
  (não apaga os usuários do Authentication).
- `banco-academias.sql`, `piloto-academias.sql`, `pos-instalacao.sql`,
  `recomecar.sql` — as partes separadas, caso precise.
- `consertos.sql` — consultas úteis para conferir logins.

## Publicar na Vercel

Importe o repositório na Vercel e cadastre as variáveis:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e
`NEXT_PUBLIC_DOMINIOS_PRINCIPAIS`.

## Domínio próprio de uma academia

1. Na Vercel: Settings → Domains → adicione o domínio (ex.: clubedeluta.com.br).
2. No registro do domínio, aponte o DNS como a Vercel mostrar.
3. No Supabase, na tabela `academias`, preencha a coluna `dominio` dessa academia.

## Notificações no celular (push) — opcional

1. No PC, rode `npx web-push generate-vapid-keys` e guarde as duas chaves.
2. Na Vercel (Environment Variables), cadastre:
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = Public Key
   - `VAPID_PRIVATE_KEY` = Private Key
   - `VAPID_EMAIL` = `mailto:seu-email@gmail.com`
   - `SUPABASE_SECRET_KEY` = chave **secret** do Supabase (Project Settings → API Keys)
   - `PUSH_WEBHOOK_SECRET` = uma senha que você inventar
   e faça Redeploy.
3. No Supabase: Database → Webhooks → Create a new hook
   - Tabela `notificacoes`, evento **Insert**, tipo **HTTP Request**, método POST
   - URL: `https://SEU-SITE.vercel.app/api/push`
   - HTTP Header: `x-segredo` = a mesma senha do `PUSH_WEBHOOK_SECRET`
4. No app, em Notificações, toque em “Ativar notificações”.

## Página de vendas

`/conheca` apresenta o sistema. `/demo` entra direto na Academia Piloto se
`NEXT_PUBLIC_DEMO_EMAIL` e `NEXT_PUBLIC_DEMO_SENHA` estiverem preenchidos
(use um login só de teste — a senha fica visível no navegador).
