-- ==========================================
-- 친구 대결(PvP) 신청을 우편함에 보내기 위한 테이블/함수.
-- Supabase SQL Editor에 붙여넣고 RUN 하세요. (IF NOT EXISTS / OR REPLACE라 안전합니다)
-- 이미 친구인 사람에게만 대결 신청을 보낼 수 있습니다.
-- ==========================================

CREATE TABLE IF NOT EXISTS public.br_battle_challenges (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  from_id uuid NOT NULL REFERENCES public.br_users(id) ON DELETE CASCADE,
  to_id uuid NOT NULL REFERENCES public.br_users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT br_battle_challenges_not_self CHECK (from_id <> to_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS br_battle_challenges_pair_uniq
  ON public.br_battle_challenges(from_id, to_id);

ALTER TABLE public.br_battle_challenges ENABLE ROW LEVEL SECURITY;
-- 정책을 따로 만들지 않음 -> 아래 SECURITY DEFINER 함수를 통해서만 접근 가능

-- ===== 대결 신청 보내기 (이미 친구여야 함) =====
CREATE OR REPLACE FUNCTION public.br_battle_challenge_send(p_token text, p_to_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  me br_users;
  v_a uuid;
  v_b uuid;
BEGIN
  me := br_verify_token(p_token);
  IF p_to_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_TARGET';
  END IF;
  IF me.id = p_to_id THEN
    RAISE EXCEPTION 'CANNOT_CHALLENGE_SELF';
  END IF;

  v_a := LEAST(me.id, p_to_id);
  v_b := GREATEST(me.id, p_to_id);
  IF NOT EXISTS (SELECT 1 FROM br_friendships WHERE user_a_id = v_a AND user_b_id = v_b) THEN
    RAISE EXCEPTION 'NOT_FRIENDS';
  END IF;

  INSERT INTO br_battle_challenges (from_id, to_id) VALUES (me.id, p_to_id)
    ON CONFLICT (from_id, to_id) DO NOTHING;
  RETURN json_build_object('ok', true);
END;
$$;

-- ===== 받은 대결 신청에 응답 =====
-- 실제 대결 시작(소켓 매칭)은 클라이언트가 이 함수의 결과(from_id)를 받아
-- 서버(Socket.IO)에 따로 알린다. 이 함수는 신청 행을 지우기만 한다.
CREATE OR REPLACE FUNCTION public.br_battle_challenge_respond(p_token text, p_challenge_id uuid, p_accept boolean)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  me br_users;
  v_from uuid;
BEGIN
  me := br_verify_token(p_token);

  SELECT from_id INTO v_from FROM br_battle_challenges WHERE id = p_challenge_id AND to_id = me.id;
  IF v_from IS NULL THEN
    RAISE EXCEPTION 'CHALLENGE_NOT_FOUND';
  END IF;

  DELETE FROM br_battle_challenges WHERE id = p_challenge_id;

  RETURN json_build_object('ok', true, 'accepted', COALESCE(p_accept, false), 'fromId', v_from);
END;
$$;

-- ===== 우편함: 나에게 온 대결 신청 목록 =====
CREATE OR REPLACE FUNCTION public.br_battle_inbox(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  me br_users;
  result json;
BEGIN
  me := br_verify_token(p_token);

  SELECT COALESCE(json_agg(json_build_object(
    'challengeId', c.id,
    'fromId', c.from_id,
    'nickname', u.nickname,
    'charType', u.game_data->>'selectedCharacter',
    'createdAt', c.created_at
  ) ORDER BY c.created_at DESC), '[]'::json) INTO result
  FROM br_battle_challenges c
  JOIN br_users u ON u.id = c.from_id
  WHERE c.to_id = me.id;

  RETURN json_build_object('ok', true, 'challenges', result);
END;
$$;
