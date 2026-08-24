-- Comptes QA techniques pour les tests multi-utilisateurs (autorisé
-- explicitement par Kenams — 3 comptes, mots de passe aléatoires générés
-- côté serveur, jamais exposés au client/Git, e-mails non personnels,
-- auto-confirmés). Idempotent : ne recrée rien si les comptes existent déjà.
--
-- Stockage temporaire du mot de passe en clair dans une table dédiée,
-- accessible uniquement à service_role (aucun grant anon/authenticated),
-- pour permettre la connexion automatisée pendant les tests et la
-- régénération/nettoyage ultérieur sans jamais les afficher ailleurs.

create table if not exists public.qa_test_accounts (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  email          text not null unique,
  password_plain text not null,
  label          text not null,
  created_at     timestamptz not null default now()
);

alter table public.qa_test_accounts enable row level security;
revoke all on public.qa_test_accounts from anon, authenticated;
-- Aucune policy créée : RLS activée + aucun grant = inaccessible à quiconque
-- sauf service_role (qui bypass RLS par défaut). C'est intentionnel.

do $$
declare
  qa record;
  v_uid uuid;
  v_pass text;
begin
  for qa in
    select * from (values
      ('qa-a@mylife-qa.internal', 'QA-A'),
      ('qa-b@mylife-qa.internal', 'QA-B'),
      ('qa-c@mylife-qa.internal', 'QA-C')
    ) as t(email, label)
  loop
    select id into v_uid from auth.users where email = qa.email;

    if v_uid is null then
      v_uid := gen_random_uuid();
      v_pass := encode(extensions.gen_random_bytes(18), 'base64');

      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) values (
        '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
        qa.email, extensions.crypt(v_pass, extensions.gen_salt('bf')),
        now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('qa_account', true, 'qa_label', qa.label, 'username', lower(qa.label)),
        '', '', '', ''
      );

      insert into auth.identities (
        id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(), v_uid, v_uid::text,
        jsonb_build_object('sub', v_uid::text, 'email', qa.email),
        'email', now(), now(), now()
      );

      insert into public.qa_test_accounts (user_id, email, password_plain, label)
      values (v_uid, qa.email, v_pass, qa.label);
    end if;
  end loop;
end $$;

-- Les comptes QA ne doivent jamais gonfler les métriques publiques (compteur
-- "en live", classements). On les traite comme des NPC pour toute lecture
-- publique côté life_map_players tout en gardant une vraie session Supabase
-- authentifiée (contrairement aux vrais PNJ, is_npc ici sert uniquement à
-- les exclure des compteurs, pas à simuler un comportement scripté).
-- Trigger plutôt qu'un simple UPDATE ponctuel : reste vrai même pour les
-- futures lignes créées quand un compte QA publie sa position pour la
-- première fois (pas seulement au moment de cette migration).
create or replace function public.qa_account_force_npc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.qa_test_accounts where user_id = new.user_id) then
    new.is_npc := true;
  end if;
  return new;
end;
$$;

drop trigger if exists life_map_qa_force_npc on public.life_map_players;
create trigger life_map_qa_force_npc
  before insert or update on public.life_map_players
  for each row execute function public.qa_account_force_npc();

update public.life_map_players
   set is_npc = true
 where user_id in (select user_id from public.qa_test_accounts);
