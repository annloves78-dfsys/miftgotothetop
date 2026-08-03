-- =============================================
-- MIFT GOTOTHETOP (boss_raid) - 로그인/자동저장용 Supabase 설정
-- Supabase SQL Editor에서 이 전체를 복사해서 실행하세요!
-- gd_forum과 같은 프로젝트를 써도 안전합니다 (테이블/함수 이름이 br_ 로 분리되어 있어요).
-- =============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 유저 테이블 (이메일 + 비밀번호 해시 + 게임 저장 데이터)
CREATE TABLE IF NOT EXISTS public.br_users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  nickname text NOT NULL,
  session_token text DEFAULT gen_random_uuid()::text,
  game_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.br_users ENABLE ROW LEVEL SECURITY;
-- 정책을 따로 만들지 않음 -> 아래 SECURITY DEFINER 함수를 통해서만 접근 가능

-- ===== 세션 토큰 검증 헬퍼 =====
CREATE OR REPLACE FUNCTION public.br_verify_token(p_token text)
RETURNS public.br_users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  found_user br_users;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RAISE EXCEPTION 'NO_TOKEN';
  END IF;
  SELECT * INTO found_user FROM br_users WHERE session_token = p_token;
  IF found_user.id IS NULL THEN
    RAISE EXCEPTION 'INVALID_TOKEN';
  END IF;
  RETURN found_user;
END;
$$;

-- ===== 회원가입 =====
CREATE OR REPLACE FUNCTION public.br_signup(p_email text, p_password text, p_nickname text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_user br_users;
BEGIN
  IF p_email IS NULL OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'INVALID_EMAIL';
  END IF;
  IF p_nickname IS NULL OR length(trim(p_nickname)) < 1 THEN
    RAISE EXCEPTION 'NICKNAME_REQUIRED';
  END IF;
  IF p_password IS NULL OR length(p_password) < 10
     OR p_password !~ '[A-Za-z]' OR p_password !~ '[0-9]' OR p_password ~ '^[A-Za-z0-9]*$' THEN
    RAISE EXCEPTION 'PASSWORD_WEAK';
  END IF;
  IF EXISTS (SELECT 1 FROM br_users WHERE email = lower(trim(p_email))) THEN
    RAISE EXCEPTION 'EMAIL_EXISTS';
  END IF;

  INSERT INTO br_users (email, password_hash, nickname)
  VALUES (lower(trim(p_email)), crypt(p_password, gen_salt('bf')), trim(p_nickname))
  RETURNING * INTO new_user;

  RETURN json_build_object(
    'id', new_user.id, 'email', new_user.email, 'nickname', new_user.nickname,
    'game_data', new_user.game_data, 'session_token', new_user.session_token
  );
END;
$$;

-- ===== 로그인 =====
CREATE OR REPLACE FUNCTION public.br_login(p_email text, p_password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  found_user br_users;
  new_token text;
BEGIN
  SELECT * INTO found_user FROM br_users WHERE email = lower(trim(p_email));
  IF found_user.id IS NULL OR found_user.password_hash != crypt(p_password, found_user.password_hash) THEN
    RAISE EXCEPTION 'INVALID_CREDENTIALS';
  END IF;

  new_token := gen_random_uuid()::text;
  UPDATE br_users SET session_token = new_token WHERE id = found_user.id;

  RETURN json_build_object(
    'id', found_user.id, 'email', found_user.email, 'nickname', found_user.nickname,
    'game_data', found_user.game_data, 'session_token', new_token
  );
END;
$$;

-- ===== 세션 복원 (같은 기기에서 자동 로그인) =====
CREATE OR REPLACE FUNCTION public.br_get_me(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me br_users;
BEGIN
  me := br_verify_token(p_token);
  RETURN json_build_object(
    'id', me.id, 'email', me.email, 'nickname', me.nickname, 'game_data', me.game_data
  );
END;
$$;

-- ===== 게임 데이터 자동저장 =====
CREATE OR REPLACE FUNCTION public.br_save_data(p_token text, p_data jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me br_users;
BEGIN
  me := br_verify_token(p_token);
  UPDATE br_users SET game_data = p_data WHERE id = me.id;
  RETURN json_build_object('ok', true);
END;
$$;

-- =============================================
-- 관리자 콘솔 (/admin) 용 함수들
-- 모든 br_admin_* 함수는 is_admin = true 인 계정의 토큰만 받습니다.
-- =============================================

ALTER TABLE public.br_users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- ===== 관리자 토큰 검증 헬퍼 =====
CREATE OR REPLACE FUNCTION public.br_verify_admin(p_token text)
RETURNS public.br_users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me br_users;
BEGIN
  me := br_verify_token(p_token);
  IF NOT COALESCE(me.is_admin, false) THEN
    RAISE EXCEPTION 'NOT_ADMIN';
  END IF;
  RETURN me;
END;
$$;

-- ===== 관리자 로그인 =====
-- br_login과 달리 세션 토큰을 새로 발급하지 않습니다. 관리자 콘솔에 로그인해도
-- 같은 계정으로 켜둔 게임 세션이 끊기지 않게 하려는 의도입니다.
CREATE OR REPLACE FUNCTION public.br_admin_login(p_email text, p_password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  found_user br_users;
BEGIN
  SELECT * INTO found_user FROM br_users WHERE email = lower(trim(p_email));
  IF found_user.id IS NULL OR found_user.password_hash != crypt(p_password, found_user.password_hash) THEN
    RAISE EXCEPTION 'INVALID_CREDENTIALS';
  END IF;
  IF NOT COALESCE(found_user.is_admin, false) THEN
    RAISE EXCEPTION 'NOT_ADMIN';
  END IF;

  IF found_user.session_token IS NULL OR found_user.session_token = '' THEN
    UPDATE br_users SET session_token = gen_random_uuid()::text WHERE id = found_user.id
    RETURNING * INTO found_user;
  END IF;

  RETURN json_build_object(
    'id', found_user.id, 'email', found_user.email,
    'nickname', found_user.nickname, 'session_token', found_user.session_token
  );
END;
$$;

-- ===== 관리자 세션 복원 =====
CREATE OR REPLACE FUNCTION public.br_admin_me(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me br_users;
BEGIN
  me := br_verify_admin(p_token);
  RETURN json_build_object('id', me.id, 'email', me.email, 'nickname', me.nickname);
END;
$$;

-- ===== 요약 통계 =====
CREATE OR REPLACE FUNCTION public.br_admin_stats(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM br_verify_admin(p_token);
  RETURN (
    SELECT json_build_object(
      'total_users', count(*),
      'admins', count(*) FILTER (WHERE is_admin),
      'new_today', count(*) FILTER (WHERE created_at >= date_trunc('day', now())),
      'new_week', count(*) FILTER (WHERE created_at >= now() - interval '7 days'),
      'with_save', count(*) FILTER (WHERE game_data IS NOT NULL AND game_data != '{}'::jsonb)
    )
    FROM br_users
  );
END;
$$;

-- ===== 유저 목록 (이메일/닉네임 검색 + 페이지네이션) =====
-- 비밀번호 해시와 세션 토큰은 절대 내보내지 않습니다.
CREATE OR REPLACE FUNCTION public.br_admin_list_users(
  p_token text, p_search text DEFAULT '', p_limit int DEFAULT 25, p_offset int DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q text := '%' || lower(trim(coalesce(p_search, ''))) || '%';
  lim int := least(greatest(coalesce(p_limit, 25), 1), 100);
  off int := greatest(coalesce(p_offset, 0), 0);
  total int;
  rows json;
BEGIN
  PERFORM br_verify_admin(p_token);

  SELECT count(*) INTO total FROM br_users
  WHERE lower(email) LIKE q OR lower(nickname) LIKE q;

  SELECT coalesce(json_agg(u), '[]'::json) INTO rows FROM (
    SELECT
      id, email, nickname, is_admin, created_at,
      CASE WHEN jsonb_typeof(game_data->'clearedBosses') = 'array'
           THEN jsonb_array_length(game_data->'clearedBosses') ELSE 0 END AS cleared_bosses,
      CASE WHEN jsonb_typeof(game_data->'clearedStoryFloors') = 'array'
           THEN jsonb_array_length(game_data->'clearedStoryFloors') ELSE 0 END AS cleared_floors,
      coalesce(game_data->>'selectedCharacter', '-') AS selected_character
    FROM br_users
    WHERE lower(email) LIKE q OR lower(nickname) LIKE q
    ORDER BY created_at DESC
    LIMIT lim OFFSET off
  ) u;

  RETURN json_build_object('total', total, 'limit', lim, 'offset', off, 'users', rows);
END;
$$;

-- ===== 유저 한 명 상세 (세이브 데이터 포함) =====
CREATE OR REPLACE FUNCTION public.br_admin_get_user(p_token text, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target br_users;
BEGIN
  PERFORM br_verify_admin(p_token);
  SELECT * INTO target FROM br_users WHERE id = p_user_id;
  IF target.id IS NULL THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;
  RETURN json_build_object(
    'id', target.id, 'email', target.email, 'nickname', target.nickname,
    'is_admin', target.is_admin, 'created_at', target.created_at,
    'game_data', target.game_data
  );
END;
$$;

-- ===== 닉네임 변경 =====
CREATE OR REPLACE FUNCTION public.br_admin_set_nickname(p_token text, p_user_id uuid, p_nickname text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM br_verify_admin(p_token);
  IF p_nickname IS NULL OR length(trim(p_nickname)) < 1 THEN
    RAISE EXCEPTION 'NICKNAME_REQUIRED';
  END IF;
  UPDATE br_users SET nickname = trim(p_nickname) WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;
  RETURN json_build_object('ok', true);
END;
$$;

-- ===== 세이브 데이터 직접 수정 =====
CREATE OR REPLACE FUNCTION public.br_admin_set_game_data(p_token text, p_user_id uuid, p_data jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM br_verify_admin(p_token);
  IF p_data IS NULL OR jsonb_typeof(p_data) != 'object' THEN
    RAISE EXCEPTION 'INVALID_DATA';
  END IF;
  UPDATE br_users SET game_data = p_data WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;
  RETURN json_build_object('ok', true);
END;
$$;

-- ===== 세이브 데이터 초기화 =====
CREATE OR REPLACE FUNCTION public.br_admin_reset_data(p_token text, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM br_verify_admin(p_token);
  UPDATE br_users SET game_data = '{}'::jsonb WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;
  RETURN json_build_object('ok', true);
END;
$$;

-- ===== 비밀번호 재설정 (해당 유저는 로그아웃됨) =====
CREATE OR REPLACE FUNCTION public.br_admin_reset_password(p_token text, p_user_id uuid, p_password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM br_verify_admin(p_token);
  IF p_password IS NULL OR length(p_password) < 10
     OR p_password !~ '[A-Za-z]' OR p_password !~ '[0-9]' OR p_password ~ '^[A-Za-z0-9]*$' THEN
    RAISE EXCEPTION 'PASSWORD_WEAK';
  END IF;
  UPDATE br_users
  SET password_hash = crypt(p_password, gen_salt('bf')),
      session_token = gen_random_uuid()::text
  WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;
  RETURN json_build_object('ok', true);
END;
$$;

-- ===== 관리자 권한 부여/해제 =====
CREATE OR REPLACE FUNCTION public.br_admin_set_admin(p_token text, p_user_id uuid, p_is_admin boolean)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me br_users;
BEGIN
  me := br_verify_admin(p_token);
  -- 마지막 관리자가 실수로 자기 권한을 내려서 콘솔에 못 들어가는 일을 막습니다.
  IF me.id = p_user_id AND p_is_admin = false THEN
    RAISE EXCEPTION 'CANNOT_DEMOTE_SELF';
  END IF;
  UPDATE br_users SET is_admin = coalesce(p_is_admin, false) WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;
  RETURN json_build_object('ok', true);
END;
$$;

-- ===== 계정 삭제 =====
CREATE OR REPLACE FUNCTION public.br_admin_delete_user(p_token text, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me br_users;
BEGIN
  me := br_verify_admin(p_token);
  IF me.id = p_user_id THEN
    RAISE EXCEPTION 'CANNOT_DELETE_SELF';
  END IF;
  DELETE FROM br_users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;
  RETURN json_build_object('ok', true);
END;
$$;

-- =============================================
-- 첫 관리자 지정 (필수!)
-- 아래 줄의 이메일을 본인 계정 이메일로 바꾼 뒤 실행하세요.
-- 이걸 실행하지 않으면 /admin 에서 아무도 로그인할 수 없습니다.
-- =============================================
-- UPDATE public.br_users SET is_admin = true WHERE email = 'annloves78@gmail.com';
