-- ==========================================
-- 친구 기능(친구 목록/친구보기/우편함)에 필요한 테이블과 함수를 추가합니다.
-- Supabase SQL Editor에 붙여넣고 RUN 하세요. (IF NOT EXISTS / OR REPLACE라 안전합니다)
-- 로그인 계정끼리만 친구를 맺을 수 있습니다 (게스트는 고유 ID가 없음).
-- ==========================================

-- 수락 대기 중인 친구 신청. from -> to 한 쌍에 하나만 존재.
CREATE TABLE IF NOT EXISTS public.br_friend_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  from_id uuid NOT NULL REFERENCES public.br_users(id) ON DELETE CASCADE,
  to_id uuid NOT NULL REFERENCES public.br_users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT br_friend_requests_not_self CHECK (from_id <> to_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS br_friend_requests_pair_uniq
  ON public.br_friend_requests(from_id, to_id);

-- 성사된 친구 관계. 항상 user_a_id < user_b_id로 정렬해서 한 쌍당 한 행만 있게 한다.
CREATE TABLE IF NOT EXISTS public.br_friendships (
  user_a_id uuid NOT NULL REFERENCES public.br_users(id) ON DELETE CASCADE,
  user_b_id uuid NOT NULL REFERENCES public.br_users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_a_id, user_b_id),
  CONSTRAINT br_friendships_order CHECK (user_a_id < user_b_id)
);

ALTER TABLE public.br_friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.br_friendships ENABLE ROW LEVEL SECURITY;
-- 정책을 따로 만들지 않음 -> 아래 SECURITY DEFINER 함수를 통해서만 접근 가능

-- ===== 친구 신청 보내기 =====
-- 상대가 이미 나한테 신청을 보내둔 상태라면(둘이 동시에 눌렀거나) 새 신청을
-- 만드는 대신 그 자리에서 바로 친구로 맺어준다.
CREATE OR REPLACE FUNCTION public.br_friend_send_request(p_token text, p_to_id uuid)
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
    RAISE EXCEPTION 'CANNOT_FRIEND_SELF';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM br_users WHERE id = p_to_id) THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;

  v_a := LEAST(me.id, p_to_id);
  v_b := GREATEST(me.id, p_to_id);
  IF EXISTS (SELECT 1 FROM br_friendships WHERE user_a_id = v_a AND user_b_id = v_b) THEN
    RETURN json_build_object('ok', true, 'status', 'already_friends');
  END IF;

  IF EXISTS (SELECT 1 FROM br_friend_requests WHERE from_id = p_to_id AND to_id = me.id) THEN
    DELETE FROM br_friend_requests WHERE from_id = p_to_id AND to_id = me.id;
    INSERT INTO br_friendships (user_a_id, user_b_id) VALUES (v_a, v_b)
      ON CONFLICT DO NOTHING;
    RETURN json_build_object('ok', true, 'status', 'friends');
  END IF;

  INSERT INTO br_friend_requests (from_id, to_id) VALUES (me.id, p_to_id)
    ON CONFLICT (from_id, to_id) DO NOTHING;
  RETURN json_build_object('ok', true, 'status', 'pending');
END;
$$;

-- ===== 받은 친구 신청에 응답(수락/거절) =====
CREATE OR REPLACE FUNCTION public.br_friend_respond(p_token text, p_request_id uuid, p_accept boolean)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  me br_users;
  v_from uuid;
  v_a uuid;
  v_b uuid;
BEGIN
  me := br_verify_token(p_token);

  SELECT from_id INTO v_from FROM br_friend_requests WHERE id = p_request_id AND to_id = me.id;
  IF v_from IS NULL THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND';
  END IF;

  DELETE FROM br_friend_requests WHERE id = p_request_id;

  IF p_accept THEN
    v_a := LEAST(me.id, v_from);
    v_b := GREATEST(me.id, v_from);
    INSERT INTO br_friendships (user_a_id, user_b_id) VALUES (v_a, v_b)
      ON CONFLICT DO NOTHING;
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;

-- ===== 내 친구 목록 (닉네임 + 상대가 지금 선택 중인 캐릭터) =====
CREATE OR REPLACE FUNCTION public.br_friend_list(p_token text)
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
    'id', u.id,
    'nickname', u.nickname,
    'charType', u.game_data->>'selectedCharacter'
  ) ORDER BY u.nickname), '[]'::json) INTO result
  FROM br_friendships f
  JOIN br_users u ON u.id = (CASE WHEN f.user_a_id = me.id THEN f.user_b_id ELSE f.user_a_id END)
  WHERE f.user_a_id = me.id OR f.user_b_id = me.id;

  RETURN json_build_object('ok', true, 'friends', result);
END;
$$;

-- ===== 우편함: 나에게 온 친구 신청 목록 =====
CREATE OR REPLACE FUNCTION public.br_friend_inbox(p_token text)
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
    'requestId', r.id,
    'fromId', r.from_id,
    'nickname', u.nickname,
    'charType', u.game_data->>'selectedCharacter',
    'createdAt', r.created_at
  ) ORDER BY r.created_at DESC), '[]'::json) INTO result
  FROM br_friend_requests r
  JOIN br_users u ON u.id = r.from_id
  WHERE r.to_id = me.id;

  RETURN json_build_object('ok', true, 'requests', result);
END;
$$;
