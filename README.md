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

## Galeria pelo Google Drive — opcional

1. Acesse https://console.cloud.google.com → crie um projeto (pode ser o mesmo do Dojô).
2. Em "APIs e serviços → Biblioteca", ative a **Google Drive API**.
3. Em "APIs e serviços → Credenciais", crie uma **Chave de API** e restrinja à Google Drive API.
4. Cadastre na Vercel e no `.env.local`: `GOOGLE_API_KEY=...`
5. No Drive, compartilhe a pasta como "Qualquer pessoa com o link (leitor)" e cole o link em Feed → Galeria.

## ⚠️ Sobre o INSTALAR-TUDO.sql

Ele APAGA todos os dados do app e recria do zero. Use enquanto for teste.
Quando tiver alunos de verdade, as próximas atualizações virão como
arquivos `ATUALIZAR-xx.sql`, que só acrescentam coisas sem apagar nada.

## Como atualizar daqui pra frente (sem apagar nada)

1. **Banco:** rode no SQL Editor só os `supabase/ATUALIZAR-xx.sql` que você ainda não rodou,
   em ordem. Eles podem ser rodados duas vezes sem problema. Anote o último que rodou.
2. **Código:** extraia o zip novo **por cima** da pasta (substituir tudo). Não precisa apagar
   nada, só se a mensagem da versão pedir.
3. `npm install` (só se o package.json mudou) e `npm run dev` para testar.
4. `git add .` → `git commit -m "..."` → `git push`. A Vercel publica sozinha.

Atualizações do banco: 01 (vocabulário, quiz, Judô Clube Denis), 02 (meta de estudo,
placar, lembrete de sexta e pronúncia) e 03 (desafio do dia, flashcards, simulado, títulos,
combinações/contragolpes, contrato, despesas, indicações, painel master e backup) e 04 (permissões
por papel, temporadas, tema minimalista e logins de teste por modalidade).
O `piloto-academias.sql` pode ser rodado de novo a qualquer momento: ele recria só a Academia Piloto.
