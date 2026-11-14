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
combinações/contragolpes, contrato, despesas, indicações, painel master e backup) 04 (permissões
por papel, temporadas, tema minimalista e logins de teste por modalidade) e 05 (planos comerciais:
Essencial, Profissional, Completo, Fundador, Social e Exclusivo). Preços e o que cada plano inclui: `lib/planos.ts`.
O `piloto-academias.sql` pode ser rodado de novo a qualquer momento: ele recria só a Academia Piloto.


## Atualização 06 (planos Base, Intermediário e Completo)

- Planos e preços: `lib/planos.ts` (o que cada plano libera e quanto custa).
- Três academias piloto com os mesmos alunos: `/piloto-base`, `/piloto-intermediario`, `/piloto-completo`.
  Recrie quando quiser rodando `supabase/piloto-academias.sql` (não mexe nas outras academias).
- Demonstração por plano: `/demo?plano=base` (usa NEXT_PUBLIC_DEMO_EMAIL e NEXT_PUBLIC_DEMO_SENHA;
  sugestão: prof.piloto@example.com, que está nas 3 pilotos).
- Termos de Uso (`/termos`) e Política de Privacidade (`/privacidade`): texto-base para revisar.
  Ao mudar o texto, troque `VERSAO_TERMOS` em `lib/termos.ts` e todos aceitam de novo.
  Troque também o e-mail de contato em `lib/termos.ts`.
- Painel master: `/master/calendario` (todas as datas) e `/master/atividade` (o que foi feito + erros).
- Limpeza diária das fotos do feed: `vercel.json` chama `/api/limpar-feed`.
  Precisa das variáveis `SUPABASE_SECRET_KEY` e `CRON_SECRET` (qualquer senha longa) na Vercel.

## Atualização 07

- Página "Minhas turmas" (`/turmas`) e página de cada turma (horários, professor, próxima aula com "vou nessa aula" e colegas).
- Feed: Base e Intermediário só fotos (até 4 por post); Completo aceita vídeo de até 30 segundos (máx. 25 MB).
- Demonstração (`/demo?plano=...`) mostra o motivo exato quando não abre.

## Atualização 08 (velocidade)

- Índices no banco para as buscas mais usadas.
- O app abre com uma consulta só (`contexto_app`) em vez de nove.
- O proxy só confere o login nas páginas que precisam (as públicas abrem direto).
- `vercel.json` coloca o servidor em São Paulo (`gru1`), perto do Supabase.
- Telas de carregamento instantâneas e páginas visitadas guardadas por alguns segundos.
- Link do grupo de WhatsApp em cada turma (Turmas e equipe → editar turma).

## Atualização 09

- Feed com miniaturas (a foto grande só abre ao tocar).
- Pilotos sem técnicas, exames e estudo (conteúdo exclusivo de cada academia).
- Chamada por voz sem repetir nomes; chamada funciona sem internet (envia quando voltar).
- Botão de modo claro/escuro para cada pessoa (no menu).
- Demonstração com escolha de perfil: admin, professor (4 lutas), aluno (4 lutas) e responsável.
  Todos usam a mesma senha (NEXT_PUBLIC_DEMO_SENHA). Para igualar as senhas, use `supabase/senhas-demo.sql`.

## Atualização 10

- O que o plano não inclui some para todo mundo (aluno, professor e admin) e fica desligado também no banco
  (lembrete de peso, mensalidades automáticas, aviso de débito no check-in, QR no Base, facial fora do Completo).
- Piloto Base sem dados de mensalidade.
- Tablet (a partir de 768 px) já usa o menu lateral completo.
- Demonstração em dois aparelhos: o QR em `/demo` abre o celular já como o perfil escolhido.

## Atualização 11

- Menu novo "QR Codes" (check-in da parede, cadastro e página da academia); Personalizar academia só para o admin.
- Professores: o admin escolhe se podem VER e se podem MEXER nas mensalidades dos alunos deles.
- Técnicas progressivas e meta de estudo só aparecem quando o estudo está ligado.
- Cronômetro com 4 estilos (Placar, Anel, Painel LED, Minimalista), na tela normal com botão de tela cheia.
- Cabeçalhos de segurança (next.config.ts), só no site publicado.

## Atualização 12

- Carteirinha personalizável (Carteirinha → 🎨 Personalizar modelo, só admin):
  Base = clássica com logo e frase; Intermediário = 4 modelos, cor e campos; Completo = foto de fundo e verso.
- QR Codes: plaquinha do Pix (Intermediário em diante), download em SVG e guia da placa 3D.
- Cronômetro: som bipe, apito, gongo ou mudo, com volume, e voz opcional.

## Atualização 13 (correção)

- Corrige "infinite recursion detected in policy for relation perfis" ao cadastrar aluno/professor.
- Menu "Mais" do celular com rolagem e botão de fechar.

## Atualização 14

- Equipe: editar dados, permissões (admin/professor) e modalidades de cada pessoa (Turmas e equipe).
- Cronômetro → "Luta com placar": yuko, waza-ari, ippon, shido, osaekomi e Golden Score (regras IJF 2025),
  azul à esquerda e branco à direita (visão do árbitro), tela de vitória.
- Botão "Instalar aplicativo" (PWA). O app instalado abre direto na última academia usada (/abrir).

## Atualização 14 (banco) / pacote 15

- Cadastro de aluno: só o nome é obrigatório; ficha pelo WhatsApp (mandar modelo e colar a resposta);
  endereço; faixa + graus (ou dan) no cadastro; login com senha provisória (troca no 1º acesso).
- "Cadastro incompleto" na ficha e filtro na lista de alunos.
- Graduação do professor por listas (faixa + graus / 1º a 10º dan). Graus por faixa (0 a 6) na modalidade.
- Graus na faixa: ponteira preta (jiu-jitsu), brancos ou na cor da próxima faixa (judô) — Personalizar academia.
- Ficha: "Campeonatos" do aluno (resultado, adversários, até 3 fotos).
- Ícone e nome do app = logo e nome da academia quando instalado dentro dela.
- Placar de judô: escolher o que a voz fala; modo "Olímpico (telão)".
- Aviso "Hoje tem aniversário!" com parabéns no WhatsApp; recibo no WhatsApp depois de dar baixa.

## Atualização 15 (banco) / pacote 16

- Placar transmitido em tempo real: o celular comanda e o tablet/TV mostra (Cronômetro → Luta → 📡 Transmitir; a tela abre /placar/SALA).
- Personalização: 5 letras para os títulos, efeitos de tela (neve, confete, estrelas, folhas, logo, temporadas)
  e abertura com a logo; cada pessoa pode desligar os efeitos no menu.
- Importar alunos de planilha (.xlsx, .csv ou colar do Excel/Google Planilhas), com modelo.
- Ficha de saúde (anamnese) na ficha do aluno.
- Mural de recordes com exercícios criados pela academia (tempo, quantidade, pontos).
- Turma: recado para a próxima aula + aviso na véspera (18h) + gráfico de presença.
- Carteirinha como papel de parede da tela de bloqueio; atalhos ao segurar o ícone do app.
- Master: liberar/desligar o conteúdo de judô do Dojô (técnicas, palavras, roletas, quiz) por academia.
- Curiosidades do judô nas roletas do Dojô.

## Atualização 16 (cadastro completo + placar olímpico)
- Rode `supabase/ATUALIZAR-16.sql` (pode rodar de novo sem problema; não apaga nada — a saúde que já existia é copiada para a nova tabela protegida).
- Ficha do aluno → **📋 Completar cadastro**: dados pessoais (CPF, CEP que preenche sozinho), responsável legal (obrigatório para menor), ficha de saúde (acesso restrito, vence em 1 ano), termos com assinatura no dedo (uso de imagem separado e opcional), documentos, ocorrências.
- O banco calcula as pendências e só deixa **concluir** o cadastro quando tudo que é obrigatório estiver pronto. Toda segunda o sistema reabre os cadastros com ficha de saúde vencida.
- Placar: pontos em 3 dígitos (I W Y), cartões amarelo/vermelho, relógio verde/vermelho/amarelo, categoria e fase, menu **✏️ Corrigir pontos**, voz fala "Ippon" e voz **grave**. Trocar de aba no cronômetro com o relógio correndo pergunta o que fazer.

## Atualização 17 (pré-matrícula, pendências, PDF e lutas)
- Rode `supabase/ATUALIZAR-17.sql`. Os logins de demonstração passam a ser `...@example.com` (ex.: `prof.piloto@example.com`, mesma senha). Se na Vercel existir `NEXT_PUBLIC_DEMO_EMAIL`, troque o final para `@example.com`.
- **Pré-matrícula:** o link `/<academia>/cadastro` agora é a ficha completa (dados, responsável, saúde, termos com assinatura e documentos). Em Alunos → Cadastrar aluno → **📲 Mandar link de pré-matrícula**. A aprovação cria o aluno com tudo pronto.
- **Pendências:** a lista de alunos mostra o que falta em cada um, tem o filtro **📋 Cadastro pendente** e o botão **📲 Avisar** (WhatsApp). O aluno/responsável vê o aviso na tela inicial.
- **PDF da ficha completa:** no cadastro do aluno, “Gerar e guardar na ficha” (fica em Documentos).
- **Lutas:** no placar, escolha os atletas da lista; ao terminar, a luta vai para a ficha de cada um (🥋 Lutas no placar).
- **Efeitos novos:** logo passeando pela tela, chuva de logos, logos em órbita e logo que explode ao tocar (Personalizar academia → Efeitos).

## Atualização 18 (chamada e colar imagem)
- Chamada: ✅ Marcar todos / ↩️ Desmarcar todos, busca, filtro Faltando/Presentes, % de presença, 🧒 aviso de menor, 🚨 cadastro pendente URGENTE (com botão Resolver), ⚕️ alerta de saúde, 📄 Baixar PDF e 🖨️ Imprimir.
- 📋 Colar imagem: foto do aluno, carteirinha, rosto, logo, capa e banners aceitam imagem copiada (ex.: foto de perfil do WhatsApp Web → Copiar imagem). Não precisa rodar SQL novo.
