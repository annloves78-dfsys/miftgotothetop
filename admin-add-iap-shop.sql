-- ==========================================
-- 상점 "현질" 탭: 계좌이체 확인 후 관리자가 수동으로 지급하는 구매 신청 기능.
-- Supabase SQL Editor에 붙여넣고 RUN 하세요.
-- ==========================================

-- 구매 신청 테이블. 정책 없음 -> 아래 SECURITY DEFINER 함수를 통해서만 접근 가능.
CREATE TABLE IF NOT EXISTS public.br_purchase_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.br_users(id) ON DELETE CASCADE,
  package_key text NOT NULL,
  price_krw int NOT NULL,
  depositor_name text,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  result jsonb,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.br_users(id)
);
ALTER TABLE public.br_purchase_requests ENABLE ROW LEVEL SECURITY;

-- ===== 유저: 구매 신청 =====
-- 가격은 클라이언트를 믿지 않고 여기서 package_key로 직접 매깁니다.
CREATE OR REPLACE FUNCTION public.br_submit_purchase_request(p_token text, p_package_key text, p_depositor_name text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  me br_users;
  price int;
  new_row br_purchase_requests;
BEGIN
  me := br_verify_token(p_token);

  price := CASE p_package_key
    WHEN 'iapDiamonds5000' THEN 1000
    WHEN 'iapTicketNormal100' THEN 1000
    WHEN 'iapRandomCharBox' THEN 2000
    ELSE NULL
  END;
  IF price IS NULL THEN
    RAISE EXCEPTION 'INVALID_PACKAGE';
  END IF;
  IF p_depositor_name IS NULL OR length(trim(p_depositor_name)) < 1 THEN
    RAISE EXCEPTION 'DEPOSITOR_REQUIRED';
  END IF;

  INSERT INTO br_purchase_requests (user_id, package_key, price_krw, depositor_name)
  VALUES (me.id, p_package_key, price, trim(p_depositor_name))
  RETURNING * INTO new_row;

  RETURN json_build_object(
    'id', new_row.id, 'package_key', new_row.package_key,
    'price_krw', new_row.price_krw, 'status', new_row.status, 'created_at', new_row.created_at
  );
END;
$$;

-- ===== 유저: 내 구매 신청 내역 (최근 20건) =====
CREATE OR REPLACE FUNCTION public.br_my_purchase_requests(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  me br_users;
  rows json;
BEGIN
  me := br_verify_token(p_token);
  SELECT coalesce(json_agg(t), '[]'::json) INTO rows FROM (
    SELECT id, package_key, price_krw, status, result, created_at
    FROM br_purchase_requests
    WHERE user_id = me.id
    ORDER BY created_at DESC
    LIMIT 20
  ) t;
  RETURN rows;
END;
$$;

-- ===== 관리자: 구매 신청 목록 (p_status가 빈 문자열이면 전체) =====
CREATE OR REPLACE FUNCTION public.br_admin_list_purchase_requests(p_token text, p_status text DEFAULT '')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  rows json;
BEGIN
  PERFORM br_verify_admin(p_token);
  SELECT coalesce(json_agg(t), '[]'::json) INTO rows FROM (
    SELECT r.id, r.package_key, r.price_krw, r.depositor_name, r.status, r.result,
           r.created_at, r.resolved_at, u.id AS user_id, u.nickname, u.email
    FROM br_purchase_requests r
    JOIN br_users u ON u.id = r.user_id
    WHERE p_status = '' OR r.status = p_status
    ORDER BY (r.status = 'pending') DESC, r.created_at DESC
    LIMIT 200
  ) t;
  RETURN rows;
END;
$$;

-- ===== 관리자: 구매 신청 승인/거절 =====
-- 승인하면 package_key에 따라 재화를 직접 game_data에 넣습니다. 랜덤 캐릭터
-- 상자는 여기서 등급(40/30/20/10)과 캐릭터를 굴리고, 이미 보유 중이면
-- shared.js의 DUPLICATE_CHAR_SOUL_STONES(30)만큼 영혼석으로 대신 지급합니다.
-- shared.js CHARACTERS의 등급표와 반드시 같은 목록을 유지할 것 (새 에픽/레전더리/
-- 비스트/게스트 캐릭터를 추가하면 여기 pool 배열도 같이 업데이트).
CREATE OR REPLACE FUNCTION public.br_admin_resolve_purchase_request(p_token text, p_request_id uuid, p_approve boolean)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  me br_users;
  req br_purchase_requests;
  base jsonb;
  result jsonb;
  cur_val bigint;
  new_val bigint;
  roll numeric;
  grade text;
  pool text[];
  char_key text;
  unlocked jsonb;
  is_dup boolean := false;
BEGIN
  me := br_verify_admin(p_token);

  SELECT * INTO req FROM br_purchase_requests WHERE id = p_request_id FOR UPDATE;
  IF req.id IS NULL THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND';
  END IF;
  IF req.status != 'pending' THEN
    RAISE EXCEPTION 'ALREADY_RESOLVED';
  END IF;

  IF NOT p_approve THEN
    UPDATE br_purchase_requests
    SET status = 'rejected', resolved_at = now(), resolved_by = me.id
    WHERE id = p_request_id;
    RETURN json_build_object('ok', true, 'status', 'rejected');
  END IF;

  SELECT game_data INTO base FROM br_users WHERE id = req.user_id;
  IF NOT (base ? 'currencies') THEN
    base := base || '{"currencies":{}}'::jsonb;
  END IF;

  IF req.package_key = 'iapDiamonds5000' THEN
    cur_val := COALESCE((base->'currencies'->>'diamonds')::bigint, 0);
    base := jsonb_set(base, ARRAY['currencies', 'diamonds'], to_jsonb(cur_val + 5000), true);

  ELSIF req.package_key = 'iapTicketNormal100' THEN
    cur_val := COALESCE((base->'currencies'->>'ticketNormal')::bigint, 0);
    base := jsonb_set(base, ARRAY['currencies', 'ticketNormal'], to_jsonb(cur_val + 100), true);

  ELSIF req.package_key = 'iapRandomCharBox' THEN
    roll := random() * 100;
    IF roll < 40 THEN
      grade := '에픽'; pool := ARRAY['reddragon','volcano','sugarfly','bubbletea','seaguardian'];
    ELSIF roll < 70 THEN
      grade := '레전더리'; pool := ARRAY['lightning','waterdrop','magma','windarcher'];
    ELSIF roll < 90 THEN
      grade := '비스트'; pool := ARRAY['blacksugar','lightningdevil','seapearl','hellflavor'];
    ELSE
      grade := '게스트'; pool := ARRAY['lightninghell','cheesedumpling','flamefairy','plaincookie'];
    END IF;
    char_key := pool[1 + floor(random() * array_length(pool, 1))::int];

    unlocked := COALESCE(base->'unlockedCharacters', '[]'::jsonb);
    IF unlocked @> to_jsonb(char_key) THEN
      is_dup := true;
      IF NOT (base ? 'soulStones') THEN
        base := base || '{"soulStones":{}}'::jsonb;
      END IF;
      cur_val := COALESCE((base->'soulStones'->>char_key)::bigint, 0);
      base := jsonb_set(base, ARRAY['soulStones', char_key], to_jsonb(cur_val + 30), true);
    ELSE
      base := jsonb_set(base, ARRAY['unlockedCharacters'], unlocked || to_jsonb(char_key), true);
    END IF;
    result := json_build_object('grade', grade, 'character', char_key, 'duplicate', is_dup)::jsonb;

  ELSE
    RAISE EXCEPTION 'INVALID_PACKAGE';
  END IF;

  UPDATE br_users SET game_data = base WHERE id = req.user_id;

  UPDATE br_purchase_requests
  SET status = 'approved', resolved_at = now(), resolved_by = me.id, result = result
  WHERE id = p_request_id;

  RETURN json_build_object('ok', true, 'status', 'approved', 'result', result);
END;
$$;
