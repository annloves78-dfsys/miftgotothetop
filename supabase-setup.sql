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
