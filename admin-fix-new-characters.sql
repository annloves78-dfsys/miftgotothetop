-- ==========================================
-- 바다 수호자맛/버블티맛/바람궁수맛을 관리자 콘솔에서 다룰 수 있게
-- 재화 지급, 캐릭터 지급/회수 함수를 최신 허용 목록으로 다시 실행합니다.
-- Supabase SQL Editor에 붙여넣고 RUN 하세요. (CREATE OR REPLACE라 안전합니다)
-- ==========================================

CREATE OR REPLACE FUNCTION public.br_admin_grant_currency(p_token text, p_user_id uuid, p_currency text, p_amount bigint)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  cur_val bigint;
  new_val bigint;
  base jsonb;
BEGIN
  PERFORM br_verify_admin(p_token);
  IF p_currency NOT IN (
    'coins', 'diamonds', 'ticketNormal', 'material', 'materialRare',
    'potion', 'potionRare', 'ticketDemon', 'ticketWaterdrop', 'ticketMagma', 'ticketLightning',
    'ticketWindarcher'
  ) THEN
    RAISE EXCEPTION 'INVALID_CURRENCY';
  END IF;
  IF p_amount IS NULL THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  SELECT game_data INTO base FROM br_users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;
  IF NOT (base ? 'currencies') THEN
    base := base || '{"currencies":{}}'::jsonb;
  END IF;

  cur_val := COALESCE((base->'currencies'->>p_currency)::bigint, 0);
  new_val := GREATEST(cur_val + p_amount, 0);

  UPDATE br_users
  SET game_data = jsonb_set(base, ARRAY['currencies', p_currency], to_jsonb(new_val), true)
  WHERE id = p_user_id;

  RETURN json_build_object('ok', true, 'currency', p_currency, 'value', new_val);
END;
$$;

CREATE OR REPLACE FUNCTION public.br_admin_grant_character(p_token text, p_user_id uuid, p_character text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  base jsonb;
  unlocked jsonb;
BEGIN
  PERFORM br_verify_admin(p_token);
  -- shared.js CHARACTERS의 플레이어 캐릭터 키와 같은 목록 (보스/몬스터 제외)
  IF p_character NOT IN (
    'kicker', 'sweetpotato', 'spinach', 'reddragon', 'volcano', 'greenapple', 'orangelemon',
    'board', 'electriccord', 'lightning', 'waterdrop', 'magma', 'blacksugar', 'dragonfruit',
    'sugarfly', 'lightningdevil', 'seapearl', 'lightninghell', 'cheesedumpling', 'hellflavor',
    'flamefairy', 'plaincookie', 'seaguardian', 'bubbletea', 'windarcher'
  ) THEN
    RAISE EXCEPTION 'INVALID_CHARACTER';
  END IF;

  SELECT game_data INTO base FROM br_users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;

  unlocked := COALESCE(base->'unlockedCharacters', '[]'::jsonb);
  IF NOT (unlocked @> to_jsonb(p_character)) THEN
    unlocked := unlocked || to_jsonb(p_character);
  END IF;

  UPDATE br_users
  SET game_data = jsonb_set(base, ARRAY['unlockedCharacters'], unlocked, true)
  WHERE id = p_user_id;

  RETURN json_build_object('ok', true, 'character', p_character);
END;
$$;

CREATE OR REPLACE FUNCTION public.br_admin_revoke_character(p_token text, p_user_id uuid, p_character text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  base jsonb;
BEGIN
  PERFORM br_verify_admin(p_token);
  IF p_character NOT IN (
    'kicker', 'sweetpotato', 'spinach', 'reddragon', 'volcano', 'greenapple', 'orangelemon',
    'board', 'electriccord', 'lightning', 'waterdrop', 'magma', 'blacksugar', 'dragonfruit',
    'sugarfly', 'lightningdevil', 'seapearl', 'lightninghell', 'cheesedumpling', 'hellflavor',
    'flamefairy', 'plaincookie', 'seaguardian', 'bubbletea', 'windarcher'
  ) THEN
    RAISE EXCEPTION 'INVALID_CHARACTER';
  END IF;
  IF p_character = 'kicker' THEN
    RAISE EXCEPTION 'CANNOT_REVOKE_KICKER';
  END IF;

  SELECT game_data INTO base FROM br_users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;

  base := jsonb_set(base, ARRAY['unlockedCharacters'],
    COALESCE(base->'unlockedCharacters', '[]'::jsonb) - p_character, true);
  IF base->>'selectedCharacter' = p_character THEN
    base := jsonb_set(base, ARRAY['selectedCharacter'], '"kicker"'::jsonb, true);
  END IF;

  UPDATE br_users SET game_data = base WHERE id = p_user_id;

  RETURN json_build_object('ok', true, 'character', p_character);
END;
$$;
