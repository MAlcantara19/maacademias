-- =====================================================================
-- DOJÔ ALCÂNTARA (sua academia) E PROJETO SOCIAL
-- O conteúdo de técnicas fica só aqui: quem não é da academia não vê.
-- PROGRAMA DE TÉCNICAS: proposta inicial pelo Gokyo do Kodokan (5 grupos)
-- e katame-waza — ajuste à vontade no app (Técnicas e exames).
-- =====================================================================
delete from academias where slug in ('dojo-alcantara', 'projeto-social-michel');

do $$
declare
  dj uuid; mj uuid; pj uuid; mpj uuid;
  eu uuid; m_admin uuid; m_prof uuid;
  faixas text[] := array['Branca','Azul','Amarela','Laranja','Verde','Roxa','Marrom','Preta'];
  cores  text[] := array['#f5f5f5','#1d4ed8','#facc15','#f97316','#16a34a','#7c3aed','#78350f','#111111'];
begin
  -- Seu cadastro (o login judo.matheus.alcantara@gmail.com se liga sozinho)
  select id into eu from perfis where lower(email) = 'judo.matheus.alcantara@gmail.com' limit 1;
  if eu is null then
    insert into perfis (nome, apelido, email, telefone, sexo, nascimento, trocar_senha, boas_vindas_em)
    values ('Matheus Alcântara', 'Sensei Alcântara', 'judo.matheus.alcantara@gmail.com', '5524992924519', 'M', '1998-01-01', false, now())
    returning id into eu;
  end if;

  -- ---------- Dojô Alcântara ----------
  insert into academias (slug, nome, slogan, sobre, cidade, whatsapp, cores, no_diretorio, tipo, modulos)
  values ('dojo-alcantara', 'Dojô Alcântara', 'Judô com técnica, respeito e evolução.',
          'Espaço do sensei Alcântara para os alunos aprofundarem o judô: técnicas por faixa, vídeos, exames e carteirinha.',
          'Três Rios - RJ', '5524992924519', '{"primaria":"#6d28d9","secundaria":"#0b0b12"}', true, 'academia',
          '{"sobre":true,"propaganda":false,"calendario":true,"avisos":true,"ranking":true,"feed":true,
            "materiais":true,"mensalidades":false,"carteirinha":true,"campeonatos":true,"aula_experimental":false,
            "feedback":true,"ia":false,"tecnicas":true,"galeria":true}')
  returning id into dj;

  insert into modalidades (academia_id, nome, descricao, cor, icone, graduacoes, cores_graduacoes, ordem)
  values (dj, 'Judô', 'Programa por faixa baseado no Kodokan.', '#6d28d9', '🥋', faixas, cores, 1)
  returning id into mj;

  insert into membros (academia_id, perfil_id, papel) values (dj, eu, 'admin') returning id into m_admin;
  insert into membros (academia_id, perfil_id, papel) values (dj, eu, 'professor') returning id into m_prof;
  insert into professores_modalidades (membro_id, modalidade_id, whatsapp_publico, graduacao, bio)
  values (m_prof, mj, '5524992924519', 'Faixa preta 2º dan', 'Sensei do Dojô Alcântara.');

  insert into turmas (academia_id, modalidade_id, professor_id, nome, publico) values
    (dj, mj, m_prof, 'Judô Três Rios', 'todas as idades'),
    (dj, mj, m_prof, 'Judô Juiz de Fora', 'todas as idades');

  insert into regras_graduacao (modalidade_id, faixa, min_aulas, min_meses) values
    (mj, 'Branca', 54, 6), (mj, 'Azul', 54, 6), (mj, 'Amarela', 54, 8), (mj, 'Laranja', 54, 10),
    (mj, 'Verde', 54, 12), (mj, 'Roxa', 54, 12), (mj, 'Marrom', 54, 18);

  insert into tecnicas (academia_id, modalidade_id, faixa, grupo, nome, nome_original, descricao, classificacao, conjunto, ordem) values
    (dj, mj, null, 'taiso', 'Aquecimento e ginástica', 'Taiso', 'Deslocamentos (tai-sabaki), polichinelo, flexões, abdominais.', null, null, 1),
    (dj, mj, null, 'ukemi', 'Queda para trás', 'Ushiro-ukemi', null, null, null, 1),
    (dj, mj, null, 'ukemi', 'Queda lateral', 'Yoko-ukemi', null, null, null, 2),
    (dj, mj, null, 'ukemi', 'Queda para frente', 'Mae-ukemi', null, null, null, 3),
    (dj, mj, null, 'ukemi', 'Rolamento para frente', 'Mae-mawari-ukemi', null, null, null, 4),
    (dj, mj, 'Azul', 'nage-waza', 'Varrida no pé que avança', 'De-ashi-harai', null, 'ashi-waza', '1º grupo', 1),
    (dj, mj, 'Azul', 'nage-waza', 'Roda no joelho', 'Hiza-guruma', null, 'ashi-waza', '1º grupo', 2),
    (dj, mj, 'Azul', 'nage-waza', 'Calço no pé puxando', 'Sasae-tsurikomi-ashi', null, 'ashi-waza', '1º grupo', 3),
    (dj, mj, 'Azul', 'nage-waza', 'Quadril flutuante', 'Uki-goshi', null, 'koshi-waza', '1º grupo', 4),
    (dj, mj, 'Azul', 'nage-waza', 'Grande ceifada externa', 'O-soto-gari', null, 'ashi-waza', '1º grupo', 5),
    (dj, mj, 'Azul', 'nage-waza', 'Grande quadril', 'O-goshi', null, 'koshi-waza', '1º grupo', 6),
    (dj, mj, 'Azul', 'nage-waza', 'Grande ceifada interna', 'O-uchi-gari', null, 'ashi-waza', '1º grupo', 7),
    (dj, mj, 'Azul', 'nage-waza', 'Projeção pelas costas', 'Seoi-nage', null, 'te-waza', '1º grupo', 8),
    (dj, mj, 'Amarela', 'nage-waza', 'Pequena ceifada externa', 'Ko-soto-gari', null, 'ashi-waza', '2º grupo', 1),
    (dj, mj, 'Amarela', 'nage-waza', 'Pequena ceifada interna', 'Ko-uchi-gari', null, 'ashi-waza', '2º grupo', 2),
    (dj, mj, 'Amarela', 'nage-waza', 'Roda no quadril', 'Koshi-guruma', null, 'koshi-waza', '2º grupo', 3),
    (dj, mj, 'Amarela', 'nage-waza', 'Quadril puxando e levantando', 'Tsurikomi-goshi', null, 'koshi-waza', '2º grupo', 4),
    (dj, mj, 'Amarela', 'nage-waza', 'Varrida nos dois pés', 'Okuri-ashi-harai', null, 'ashi-waza', '2º grupo', 5),
    (dj, mj, 'Amarela', 'nage-waza', 'Queda do corpo', 'Tai-otoshi', null, 'te-waza', '2º grupo', 6),
    (dj, mj, 'Amarela', 'nage-waza', 'Quadril varrendo', 'Harai-goshi', null, 'koshi-waza', '2º grupo', 7),
    (dj, mj, 'Amarela', 'nage-waza', 'Por dentro da coxa', 'Uchi-mata', null, 'ashi-waza', '2º grupo', 8),
    (dj, mj, 'Laranja', 'nage-waza', 'Pequeno gancho externo', 'Ko-soto-gake', null, 'ashi-waza', '3º grupo', 1),
    (dj, mj, 'Laranja', 'nage-waza', 'Quadril levantando', 'Tsuri-goshi', null, 'koshi-waza', '3º grupo', 2),
    (dj, mj, 'Laranja', 'nage-waza', 'Queda lateral', 'Yoko-otoshi', null, 'yoko-sutemi', '3º grupo', 3),
    (dj, mj, 'Laranja', 'nage-waza', 'Roda na perna', 'Ashi-guruma', null, 'ashi-waza', '3º grupo', 4),
    (dj, mj, 'Laranja', 'nage-waza', 'Quadril com impulso', 'Hane-goshi', null, 'koshi-waza', '3º grupo', 5),
    (dj, mj, 'Laranja', 'nage-waza', 'Varrida no pé puxando', 'Harai-tsurikomi-ashi', null, 'ashi-waza', '3º grupo', 6),
    (dj, mj, 'Laranja', 'nage-waza', 'Projeção em círculo', 'Tomoe-nage', null, 'ma-sutemi', '3º grupo', 7),
    (dj, mj, 'Laranja', 'nage-waza', 'Roda nos ombros', 'Kata-guruma', null, 'te-waza', '3º grupo', 8),
    (dj, mj, 'Verde', 'nage-waza', 'Reversão pelo canto', 'Sumi-gaeshi', null, 'ma-sutemi', '4º grupo', 1),
    (dj, mj, 'Verde', 'nage-waza', 'Queda no vale', 'Tani-otoshi', null, 'yoko-sutemi', '4º grupo', 2),
    (dj, mj, 'Verde', 'nage-waza', 'Enrolando com impulso', 'Hane-makikomi', null, 'yoko-sutemi', '4º grupo', 3),
    (dj, mj, 'Verde', 'nage-waza', 'Projeção recolhendo', 'Sukui-nage', null, 'te-waza', '4º grupo', 4),
    (dj, mj, 'Verde', 'nage-waza', 'Mudança de quadril', 'Utsuri-goshi', null, 'koshi-waza', '4º grupo', 5),
    (dj, mj, 'Verde', 'nage-waza', 'Grande roda', 'O-guruma', null, 'ashi-waza', '4º grupo', 6),
    (dj, mj, 'Verde', 'nage-waza', 'Enrolando por fora', 'Soto-makikomi', null, 'yoko-sutemi', '4º grupo', 7),
    (dj, mj, 'Verde', 'nage-waza', 'Queda flutuante', 'Uki-otoshi', null, 'te-waza', '4º grupo', 8),
    (dj, mj, 'Roxa', 'nage-waza', 'Grande roda externa', 'O-soto-guruma', null, 'ashi-waza', '5º grupo', 1),
    (dj, mj, 'Roxa', 'nage-waza', 'Técnica flutuante', 'Uki-waza', null, 'yoko-sutemi', '5º grupo', 2),
    (dj, mj, 'Roxa', 'nage-waza', 'Separação lateral', 'Yoko-wakare', null, 'yoko-sutemi', '5º grupo', 3),
    (dj, mj, 'Roxa', 'nage-waza', 'Roda lateral', 'Yoko-guruma', null, 'yoko-sutemi', '5º grupo', 4),
    (dj, mj, 'Roxa', 'nage-waza', 'Quadril por trás', 'Ushiro-goshi', null, 'koshi-waza', '5º grupo', 5),
    (dj, mj, 'Roxa', 'nage-waza', 'Projeção para trás', 'Ura-nage', null, 'ma-sutemi', '5º grupo', 6),
    (dj, mj, 'Roxa', 'nage-waza', 'Queda pelo canto', 'Sumi-otoshi', null, 'te-waza', '5º grupo', 7),
    (dj, mj, 'Roxa', 'nage-waza', 'Gancho lateral', 'Yoko-gake', null, 'yoko-sutemi', '5º grupo', 8),
    (dj, mj, 'Azul', 'osaekomi-waza', 'Imobilização lateral pela gola', 'Kesa-gatame', null, 'osaekomi-waza', 'Katame-waza', 1),
    (dj, mj, 'Azul', 'osaekomi-waza', 'Variação do kesa-gatame', 'Kuzure-kesa-gatame', null, 'osaekomi-waza', 'Katame-waza', 2),
    (dj, mj, 'Azul', 'osaekomi-waza', 'Kesa-gatame invertido', 'Ushiro-kesa-gatame', 'Nome em desuso no dojô (*)', 'osaekomi-waza', 'Katame-waza', 3),
    (dj, mj, 'Amarela', 'osaekomi-waza', 'Imobilização pelo ombro', 'Kata-gatame', null, 'osaekomi-waza', 'Katame-waza', 1),
    (dj, mj, 'Amarela', 'osaekomi-waza', 'Imobilização pela cabeça', 'Kami-shiho-gatame', null, 'osaekomi-waza', 'Katame-waza', 2),
    (dj, mj, 'Amarela', 'osaekomi-waza', 'Variação do kami-shiho', 'Kuzure-kami-shiho-gatame', null, 'osaekomi-waza', 'Katame-waza', 3),
    (dj, mj, 'Laranja', 'osaekomi-waza', 'Imobilização lateral', 'Yoko-shiho-gatame', null, 'osaekomi-waza', 'Katame-waza', 1),
    (dj, mj, 'Laranja', 'osaekomi-waza', 'Imobilização montada', 'Tate-shiho-gatame', null, 'osaekomi-waza', 'Katame-waza', 2),
    (dj, mj, 'Laranja', 'osaekomi-waza', 'Imobilização flutuante', 'Uki-gatame', null, 'osaekomi-waza', 'Katame-waza', 3),
    (dj, mj, 'Laranja', 'osaekomi-waza', 'Imobilização invertida', 'Ura-gatame', null, 'osaekomi-waza', 'Katame-waza', 4),
    (dj, mj, 'Laranja', 'shime-waza', 'Estrangulamento cruzado normal', 'Nami-juji-jime', null, 'shime-waza', 'Katame-waza', 1),
    (dj, mj, 'Laranja', 'shime-waza', 'Estrangulamento cruzado invertido', 'Gyaku-juji-jime', null, 'shime-waza', 'Katame-waza', 2),
    (dj, mj, 'Laranja', 'shime-waza', 'Estrangulamento meio cruzado', 'Kata-juji-jime', null, 'shime-waza', 'Katame-waza', 3),
    (dj, mj, 'Verde', 'shime-waza', 'Estrangulamento sem a gola', 'Hadaka-jime', null, 'shime-waza', 'Katame-waza', 1),
    (dj, mj, 'Verde', 'shime-waza', 'Estrangulamento pela gola deslizante', 'Okuri-eri-jime', null, 'shime-waza', 'Katame-waza', 2),
    (dj, mj, 'Verde', 'shime-waza', 'Estrangulamento com uma asa', 'Kataha-jime', null, 'shime-waza', 'Katame-waza', 3),
    (dj, mj, 'Verde', 'shime-waza', 'Estrangulamento com uma mão', 'Katate-jime', null, 'shime-waza', 'Katame-waza', 4),
    (dj, mj, 'Verde', 'shime-waza', 'Estrangulamento com as duas mãos', 'Ryote-jime', null, 'shime-waza', 'Katame-waza', 5),
    (dj, mj, 'Verde', 'shime-waza', 'Estrangulamento em roda com a manga', 'Sode-guruma-jime', null, 'shime-waza', 'Katame-waza', 6),
    (dj, mj, 'Verde', 'shime-waza', 'Estrangulamento empurrando', 'Tsukkomi-jime', null, 'shime-waza', 'Katame-waza', 7),
    (dj, mj, 'Verde', 'shime-waza', 'Estrangulamento em triângulo', 'Sankaku-jime', null, 'shime-waza', 'Katame-waza', 8),
    (dj, mj, 'Verde', 'kansetsu-waza', 'Chave de braço enroscada', 'Ude-garami', null, 'kansetsu-waza', 'Katame-waza', 1),
    (dj, mj, 'Verde', 'kansetsu-waza', 'Chave de braço em cruz', 'Ude-hishigi-juji-gatame', null, 'kansetsu-waza', 'Katame-waza', 2),
    (dj, mj, 'Roxa', 'kansetsu-waza', 'Chave de braço com o braço', 'Ude-hishigi-ude-gatame', null, 'kansetsu-waza', 'Katame-waza', 1),
    (dj, mj, 'Roxa', 'kansetsu-waza', 'Chave de braço com o joelho', 'Ude-hishigi-hiza-gatame', null, 'kansetsu-waza', 'Katame-waza', 2),
    (dj, mj, 'Roxa', 'kansetsu-waza', 'Chave de braço com a axila', 'Ude-hishigi-waki-gatame', null, 'kansetsu-waza', 'Katame-waza', 3),
    (dj, mj, 'Roxa', 'kansetsu-waza', 'Chave de braço com o abdômen', 'Ude-hishigi-hara-gatame', null, 'kansetsu-waza', 'Katame-waza', 4),
    (dj, mj, 'Roxa', 'kansetsu-waza', 'Chave de braço com a perna', 'Ude-hishigi-ashi-gatame', null, 'kansetsu-waza', 'Katame-waza', 5),
    (dj, mj, 'Roxa', 'kansetsu-waza', 'Chave de braço com a mão', 'Ude-hishigi-te-gatame', null, 'kansetsu-waza', 'Katame-waza', 6),
    (dj, mj, 'Roxa', 'kansetsu-waza', 'Chave de braço em triângulo', 'Ude-hishigi-sankaku-gatame', null, 'kansetsu-waza', 'Katame-waza', 7),
    (dj, mj, 'Marrom', 'kata', 'Formas de projeção', 'Nage-no-kata', 'Exigido do marrom para o 1º dan.', null, 'Kata', 1),
    (dj, mj, 'Preta', 'kata', 'Formas de controle no solo', 'Katame-no-kata', 'Exigido para o 2º dan.', null, 'Kata', 1);

  -- ---------- Projeto social (sem mensalidades) ----------
  insert into academias (slug, nome, slogan, sobre, cidade, cores, no_diretorio, tipo, modulos)
  values ('projeto-social-michel', 'Projeto Social de Judô', 'Judô para todos.',
          'Projeto social do sensei Michel nas comunidades de Minas Gerais. (Troque o nome e o texto em QR e ajustes.)',
          'Minas Gerais', '{"primaria":"#0f766e","secundaria":"#0b0b12"}', false, 'projeto_social',
          '{"sobre":true,"propaganda":false,"calendario":true,"avisos":true,"ranking":true,"feed":true,
            "materiais":true,"mensalidades":false,"carteirinha":true,"campeonatos":true,"aula_experimental":false,
            "feedback":false,"ia":false,"tecnicas":true,"galeria":true}')
  returning id into pj;
  insert into modalidades (academia_id, nome, cor, icone, graduacoes, cores_graduacoes, ordem)
  values (pj, 'Judô', '#0f766e', '🥋', faixas, cores, 1) returning id into mpj;
  insert into membros (academia_id, perfil_id, papel) values (pj, eu, 'admin');
  insert into turmas (academia_id, modalidade_id, nome, publico) values
    (pj, mpj, 'Chiador', 'infantil'), (pj, mpj, 'Parada Braga', 'infantil'), (pj, mpj, 'Penhalonga', 'infantil');
end $$;
