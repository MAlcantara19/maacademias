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
- `banco-academias.sql` — estrutura completa (rode uma vez num projeto novo)
- `piloto-academias.sql` — Academia Piloto de demonstração (pode rodar de novo
  para recriar os dados)

## Publicar na Vercel

Importe o repositório na Vercel e cadastre as variáveis:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e
`NEXT_PUBLIC_DOMINIOS_PRINCIPAIS`.

## Domínio próprio de uma academia

1. Na Vercel: Settings → Domains → adicione o domínio (ex.: clubedeluta.com.br).
2. No registro do domínio, aponte o DNS como a Vercel mostrar.
3. No Supabase, na tabela `academias`, preencha a coluna `dominio` dessa academia.
