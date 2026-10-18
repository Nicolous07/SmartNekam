-- SmartNekam SQL 040: chat group owner/admin controls, join approvals, message controls and disappearing messages.
-- Requires SQL 006, 017 and 020/021 migrations (chat_conversations, chat_participants, chat_messages, chat_group_settings).
-- Safe to re-run. Uses application tables only; does not alter Supabase-managed realtime.messages.

BEGIN;

ALTER TABLE public.chat_group_settings
  ADD COLUMN IF NOT EXISTS icon_path TEXT,
  ADD COLUMN IF NOT EXISTS send_messages_policy TEXT NOT NULL DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS edit_group_info_policy TEXT NOT NULL DEFAULT 'admins',
  ADD COLUMN IF NOT EXISTS approve_new_members BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS allow_member_adds BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS disappearing_messages_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS lock_disappearing_messages BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.chat_group_settings DROP CONSTRAINT IF EXISTS chat_group_settings_send_messages_policy_check;
ALTER TABLE public.chat_group_settings ADD CONSTRAINT chat_group_settings_send_messages_policy_check CHECK (send_messages_policy IN ('everyone','admins'));
ALTER TABLE public.chat_group_settings DROP CONSTRAINT IF EXISTS chat_group_settings_edit_group_info_policy_check;
ALTER TABLE public.chat_group_settings ADD CONSTRAINT chat_group_settings_edit_group_info_policy_check CHECK (edit_group_info_policy IN ('everyone','admins'));
ALTER TABLE public.chat_group_settings DROP CONSTRAINT IF EXISTS chat_group_settings_disappearing_seconds_check;
ALTER TABLE public.chat_group_settings ADD CONSTRAINT chat_group_settings_disappearing_seconds_check CHECK (disappearing_messages_seconds IS NULL OR disappearing_messages_seconds IN (86400,604800,7776000));
ALTER TABLE public.chat_group_settings DROP CONSTRAINT IF EXISTS chat_group_settings_icon_path_length_check;
ALTER TABLE public.chat_group_settings ADD CONSTRAINT chat_group_settings_icon_path_length_check CHECK (icon_path IS NULL OR length(icon_path) <= 500);

ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.chat_group_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  CONSTRAINT chat_group_join_requests_conversation_user_unique UNIQUE (conversation_id,user_id)
);
CREATE INDEX IF NOT EXISTS chat_group_join_requests_pending_idx ON public.chat_group_join_requests(conversation_id,requested_at DESC) WHERE status='pending';
ALTER TABLE public.chat_group_join_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.chat_group_join_requests FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_smartnekam_chat_group_admin(p_conversation_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_conversations c
    LEFT JOIN public.chat_group_settings s ON s.conversation_id=c.id
    LEFT JOIN public.chat_participants cp ON cp.conversation_id=c.id AND cp.user_id=p_user_id AND cp.left_at IS NULL
    WHERE c.id=p_conversation_id AND c.conversation_type='group'
      AND (s.created_by=p_user_id OR c.created_by=p_user_id OR cp.participant_role='admin')
  );
$function$;
REVOKE ALL ON FUNCTION public.is_smartnekam_chat_group_admin(UUID,UUID) FROM PUBLIC, anon;
-- Internal helper: callers use permission-checked management RPCs; keep it unavailable as a public oracle.

CREATE OR REPLACE FUNCTION public.get_smartnekam_chat_group_management(p_conversation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid UUID := (SELECT auth.uid());
  v_admin BOOLEAN;
  v_result JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_conversations c
    JOIN public.chat_group_settings s ON s.conversation_id=c.id
    JOIN public.chat_participants cp ON cp.conversation_id=c.id AND cp.user_id=v_uid AND cp.left_at IS NULL
    WHERE c.id=p_conversation_id AND c.conversation_type='group' AND c.status='active'
  ) THEN RAISE EXCEPTION 'active_group_membership_required'; END IF;
  v_admin := public.is_smartnekam_chat_group_admin(p_conversation_id,v_uid);

  SELECT jsonb_build_object(
    'conversation_id', c.id,
    'can_manage', v_admin,
    'is_creator', (s.created_by=v_uid OR c.created_by=v_uid),
    'settings', jsonb_build_object(
      'title', c.title,
      'description', s.description,
      'visibility', s.visibility,
      'invite_code', s.invite_code,
      'icon_path', s.icon_path,
      'send_messages_policy', s.send_messages_policy,
      'edit_group_info_policy', s.edit_group_info_policy,
      'approve_new_members', s.approve_new_members,
      'allow_member_adds', s.allow_member_adds,
      'disappearing_messages_seconds', s.disappearing_messages_seconds,
      'lock_disappearing_messages', s.lock_disappearing_messages,
      'updated_at', s.updated_at
    ),
    'members', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', cp.user_id,
        'full_name', COALESCE(p.full_name,'Mwanafunzi'),
        'username', COALESCE(p.username,''),
        'avatar_url', p.avatar_url,
        'participant_role', cp.participant_role,
        'joined_at', cp.joined_at,
        'is_creator', (cp.user_id=s.created_by OR cp.user_id=c.created_by)
      ) ORDER BY (cp.user_id=s.created_by OR cp.user_id=c.created_by) DESC, cp.joined_at ASC)
      FROM public.chat_participants cp JOIN public.profiles p ON p.id=cp.user_id
      WHERE cp.conversation_id=c.id AND cp.left_at IS NULL
    ),'[]'::jsonb),
    'requests', CASE WHEN v_admin THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id,'user_id',r.user_id,'full_name',COALESCE(p.full_name,'Mwanafunzi'),
        'username',COALESCE(p.username,''),'avatar_url',p.avatar_url,'requested_at',r.requested_at
      ) ORDER BY r.requested_at ASC)
      FROM public.chat_group_join_requests r JOIN public.profiles p ON p.id=r.user_id
      WHERE r.conversation_id=c.id AND r.status='pending'
    ),'[]'::jsonb) ELSE '[]'::jsonb END
  ) INTO v_result
  FROM public.chat_conversations c
  JOIN public.chat_group_settings s ON s.conversation_id=c.id
  WHERE c.id=p_conversation_id AND c.conversation_type='group';
  RETURN v_result;
END;
$function$;
REVOKE ALL ON FUNCTION public.get_smartnekam_chat_group_management(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_smartnekam_chat_group_management(UUID) TO authenticated;

-- Any active member may add people while the setting allows it; admins always retain this ability.
CREATE OR REPLACE FUNCTION public.add_smartnekam_chat_group_members(p_conversation_id UUID,p_user_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid UUID := (SELECT auth.uid());
  v_added INTEGER := 0;
  v_is_admin BOOLEAN;
  v_allowed BOOLEAN;
  v_count INTEGER := COALESCE(cardinality(p_user_ids),0);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF v_count<1 OR v_count>50 THEN RAISE EXCEPTION 'group_invite_limit_1_to_50'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.chat_participants cp JOIN public.chat_conversations c ON c.id=cp.conversation_id WHERE cp.conversation_id=p_conversation_id AND cp.user_id=v_uid AND cp.left_at IS NULL AND c.conversation_type='group' AND c.status='active') THEN
    RAISE EXCEPTION 'active_group_membership_required';
  END IF;
  v_is_admin := public.is_smartnekam_chat_group_admin(p_conversation_id,v_uid);
  SELECT s.allow_member_adds INTO v_allowed FROM public.chat_group_settings s WHERE s.conversation_id=p_conversation_id;
  IF NOT v_is_admin AND NOT COALESCE(v_allowed,FALSE) THEN RAISE EXCEPTION 'only_group_admins_can_add_members'; END IF;

  INSERT INTO public.chat_participants AS existing_member(conversation_id,user_id,participant_role,left_at)
  SELECT p_conversation_id,p.id,'member',NULL FROM public.profiles p
  WHERE p.id=ANY(COALESCE(p_user_ids,ARRAY[]::UUID[])) AND p.status='active' AND p.id<>v_uid
  ON CONFLICT ON CONSTRAINT chat_participants_unique DO UPDATE SET left_at=NULL
  WHERE existing_member.left_at IS NOT NULL;
  GET DIAGNOSTICS v_added=ROW_COUNT;
  RETURN v_added;
END;
$function$;
REVOKE ALL ON FUNCTION public.add_smartnekam_chat_group_members(UUID,UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_smartnekam_chat_group_members(UUID,UUID[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_smartnekam_chat_group_settings(
  p_conversation_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_visibility TEXT,
  p_icon_path TEXT,
  p_send_messages_policy TEXT,
  p_edit_group_info_policy TEXT,
  p_approve_new_members BOOLEAN,
  p_allow_member_adds BOOLEAN,
  p_disappearing_messages_seconds INTEGER,
  p_lock_disappearing_messages BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid UUID := (SELECT auth.uid());
  v_admin BOOLEAN;
  v_info_policy TEXT;
  v_lock_timer BOOLEAN;
  v_member BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.chat_participants cp WHERE cp.conversation_id=p_conversation_id AND cp.user_id=v_uid AND cp.left_at IS NULL)
  INTO v_member;
  IF NOT v_member THEN RAISE EXCEPTION 'active_group_membership_required'; END IF;
  v_admin := public.is_smartnekam_chat_group_admin(p_conversation_id,v_uid);
  SELECT s.edit_group_info_policy,s.lock_disappearing_messages INTO v_info_policy,v_lock_timer
  FROM public.chat_group_settings s JOIN public.chat_conversations c ON c.id=s.conversation_id
  WHERE s.conversation_id=p_conversation_id AND c.conversation_type='group' AND c.status='active';
  IF NOT FOUND THEN RAISE EXCEPTION 'active_group_not_found'; END IF;
  IF length(btrim(COALESCE(p_title,'')))<3 OR length(p_title)>100 THEN RAISE EXCEPTION 'group_title_invalid'; END IF;
  IF length(COALESCE(p_description,''))>1000 THEN RAISE EXCEPTION 'group_description_too_long'; END IF;
  IF p_icon_path IS NOT NULL AND length(p_icon_path)>500 THEN RAISE EXCEPTION 'group_icon_path_invalid'; END IF;
  IF p_disappearing_messages_seconds IS NOT NULL AND p_disappearing_messages_seconds NOT IN (86400,604800,7776000) THEN RAISE EXCEPTION 'invalid_disappearing_duration'; END IF;

  IF v_admin THEN
    IF p_visibility NOT IN ('public','private') OR p_send_messages_policy NOT IN ('everyone','admins') OR p_edit_group_info_policy NOT IN ('everyone','admins') THEN RAISE EXCEPTION 'invalid_group_setting'; END IF;
    UPDATE public.chat_conversations SET title=btrim(p_title) WHERE id=p_conversation_id AND conversation_type='group' AND status='active';
    UPDATE public.chat_group_settings SET
      description=btrim(COALESCE(p_description,'')), visibility=p_visibility, icon_path=p_icon_path,
      send_messages_policy=p_send_messages_policy, edit_group_info_policy=p_edit_group_info_policy,
      approve_new_members=COALESCE(p_approve_new_members,FALSE), allow_member_adds=COALESCE(p_allow_member_adds,TRUE),
      disappearing_messages_seconds=p_disappearing_messages_seconds,
      lock_disappearing_messages=COALESCE(p_lock_disappearing_messages,TRUE), updated_at=now()
    WHERE conversation_id=p_conversation_id;
  ELSE
    IF v_info_policy<>'everyone' AND v_lock_timer THEN RAISE EXCEPTION 'only_group_admins_can_edit_settings'; END IF;
    IF v_info_policy='everyone' THEN
      UPDATE public.chat_conversations SET title=btrim(p_title) WHERE id=p_conversation_id AND conversation_type='group' AND status='active';
      UPDATE public.chat_group_settings SET description=btrim(COALESCE(p_description,'')),icon_path=p_icon_path,updated_at=now()
      WHERE conversation_id=p_conversation_id;
    END IF;
    IF NOT v_lock_timer THEN
      UPDATE public.chat_group_settings SET disappearing_messages_seconds=p_disappearing_messages_seconds,updated_at=now()
      WHERE conversation_id=p_conversation_id;
    END IF;
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public.update_smartnekam_chat_group_settings(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,BOOLEAN,BOOLEAN,INTEGER,BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_smartnekam_chat_group_settings(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,BOOLEAN,BOOLEAN,INTEGER,BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_smartnekam_chat_group_member(p_conversation_id UUID,p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_uid UUID := (SELECT auth.uid()); v_creator UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT s.created_by INTO v_creator FROM public.chat_group_settings s JOIN public.chat_conversations c ON c.id=s.conversation_id WHERE s.conversation_id=p_conversation_id AND c.conversation_type='group' AND c.status='active';
  IF NOT FOUND THEN RAISE EXCEPTION 'active_group_not_found'; END IF;
  IF p_user_id<>v_uid AND NOT public.is_smartnekam_chat_group_admin(p_conversation_id,v_uid) THEN RAISE EXCEPTION 'only_group_admins_can_remove_members'; END IF;
  IF p_user_id=v_creator THEN RAISE EXCEPTION 'group_creator_cannot_leave_or_be_removed'; END IF;
  UPDATE public.chat_participants SET left_at=now(),last_read_at=now()
  WHERE conversation_id=p_conversation_id AND user_id=p_user_id AND left_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'active_group_member_not_found'; END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public.remove_smartnekam_chat_group_member(UUID,UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_smartnekam_chat_group_member(UUID,UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_smartnekam_chat_group_admin(p_conversation_id UUID,p_user_id UUID,p_make_admin BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_uid UUID := (SELECT auth.uid()); v_creator UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.is_smartnekam_chat_group_admin(p_conversation_id,v_uid) THEN RAISE EXCEPTION 'only_group_admins_can_manage_admins'; END IF;
  SELECT s.created_by INTO v_creator FROM public.chat_group_settings s WHERE s.conversation_id=p_conversation_id;
  IF v_creator IS NULL THEN RAISE EXCEPTION 'group_not_found'; END IF;
  IF p_user_id=v_creator AND NOT COALESCE(p_make_admin,FALSE) THEN RAISE EXCEPTION 'cannot_demote_group_creator'; END IF;
  UPDATE public.chat_participants SET participant_role=CASE WHEN p_make_admin THEN 'admin' ELSE 'member' END
  WHERE conversation_id=p_conversation_id AND user_id=p_user_id AND left_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'active_group_member_not_found'; END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public.set_smartnekam_chat_group_admin(UUID,UUID,BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_smartnekam_chat_group_admin(UUID,UUID,BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.reset_smartnekam_chat_group_invite_link(p_conversation_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_code TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.is_smartnekam_chat_group_admin(p_conversation_id,auth.uid()) THEN RAISE EXCEPTION 'only_group_admins_can_reset_invite'; END IF;
  UPDATE public.chat_group_settings SET invite_code=upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),updated_at=now()
  WHERE conversation_id=p_conversation_id RETURNING invite_code INTO v_code;
  IF v_code IS NULL THEN RAISE EXCEPTION 'group_not_found'; END IF;
  RETURN v_code;
END;
$function$;
REVOKE ALL ON FUNCTION public.reset_smartnekam_chat_group_invite_link(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_smartnekam_chat_group_invite_link(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_smartnekam_chat_group(p_conversation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.is_smartnekam_chat_group_admin(p_conversation_id,auth.uid()) THEN RAISE EXCEPTION 'only_group_admins_can_delete_group'; END IF;
  UPDATE public.chat_conversations SET status='removed',updated_at=now() WHERE id=p_conversation_id AND conversation_type='group' AND status='active';
  IF NOT FOUND THEN RAISE EXCEPTION 'active_group_not_found'; END IF;
  UPDATE public.chat_group_settings SET invite_code=upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),updated_at=now() WHERE conversation_id=p_conversation_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.delete_smartnekam_chat_group(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_smartnekam_chat_group(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_smartnekam_chat_group_join_request(p_request_id UUID,p_decision TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_uid UUID := (SELECT auth.uid()); v_request public.chat_group_join_requests%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF lower(COALESCE(p_decision,'')) NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'invalid_review_decision'; END IF;
  SELECT * INTO v_request FROM public.chat_group_join_requests WHERE id=p_request_id AND status='pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pending_request_not_found'; END IF;
  IF NOT public.is_smartnekam_chat_group_admin(v_request.conversation_id,v_uid) THEN RAISE EXCEPTION 'only_group_admins_can_review_requests'; END IF;
  IF lower(p_decision)='approved' THEN
    INSERT INTO public.chat_participants(conversation_id,user_id,participant_role,left_at)
    VALUES(v_request.conversation_id,v_request.user_id,'member',NULL)
    ON CONFLICT ON CONSTRAINT chat_participants_unique DO UPDATE SET left_at=NULL;
  END IF;
  UPDATE public.chat_group_join_requests SET status=lower(p_decision),reviewed_by=v_uid,reviewed_at=now() WHERE id=p_request_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.review_smartnekam_chat_group_join_request(UUID,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_smartnekam_chat_group_join_request(UUID,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_smartnekam_public_chat_group_join(p_conversation_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_uid UUID := (SELECT auth.uid()); v_approve BOOLEAN; v_visibility TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT s.approve_new_members,s.visibility INTO v_approve,v_visibility
  FROM public.chat_group_settings s JOIN public.chat_conversations c ON c.id=s.conversation_id
  WHERE s.conversation_id=p_conversation_id AND c.conversation_type='group' AND c.status='active';
  IF NOT FOUND OR v_visibility<>'public' THEN RAISE EXCEPTION 'public_group_not_found'; END IF;
  IF EXISTS(SELECT 1 FROM public.chat_participants cp WHERE cp.conversation_id=p_conversation_id AND cp.user_id=v_uid AND cp.left_at IS NULL) THEN RETURN 'member'; END IF;
  IF v_approve THEN
    INSERT INTO public.chat_group_join_requests(conversation_id,user_id,status,requested_at,reviewed_by,reviewed_at)
    VALUES(p_conversation_id,v_uid,'pending',now(),NULL,NULL)
    ON CONFLICT ON CONSTRAINT chat_group_join_requests_conversation_user_unique DO UPDATE SET status='pending',requested_at=now(),reviewed_by=NULL,reviewed_at=NULL,review_note=NULL;
    RETURN 'pending';
  END IF;
  INSERT INTO public.chat_participants(conversation_id,user_id,participant_role,left_at)
  VALUES(p_conversation_id,v_uid,'member',NULL)
  ON CONFLICT ON CONSTRAINT chat_participants_unique DO UPDATE SET left_at=NULL;
  RETURN 'joined';
END;
$function$;
REVOKE ALL ON FUNCTION public.request_smartnekam_public_chat_group_join(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_smartnekam_public_chat_group_join(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_smartnekam_private_chat_group_join(p_invite_code TEXT)
RETURNS TABLE(conversation_id UUID,request_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_uid UUID := (SELECT auth.uid()); v_conversation UUID; v_approve BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT s.conversation_id,s.approve_new_members INTO v_conversation,v_approve
  FROM public.chat_group_settings s JOIN public.chat_conversations c ON c.id=s.conversation_id
  WHERE upper(s.invite_code)=upper(btrim(COALESCE(p_invite_code,''))) AND s.visibility='private' AND c.conversation_type='group' AND c.status='active';
  IF v_conversation IS NULL THEN RAISE EXCEPTION 'invite_code_invalid'; END IF;
  IF EXISTS(SELECT 1 FROM public.chat_participants cp WHERE cp.conversation_id=v_conversation AND cp.user_id=v_uid AND cp.left_at IS NULL) THEN
    RETURN QUERY SELECT v_conversation,'member'::TEXT; RETURN;
  END IF;
  IF v_approve THEN
    INSERT INTO public.chat_group_join_requests(conversation_id,user_id,status,requested_at,reviewed_by,reviewed_at)
    VALUES(v_conversation,v_uid,'pending',now(),NULL,NULL)
    ON CONFLICT ON CONSTRAINT chat_group_join_requests_conversation_user_unique DO UPDATE SET status='pending',requested_at=now(),reviewed_by=NULL,reviewed_at=NULL,review_note=NULL;
    RETURN QUERY SELECT v_conversation,'pending'::TEXT; RETURN;
  END IF;
  INSERT INTO public.chat_participants(conversation_id,user_id,participant_role,left_at)
  VALUES(v_conversation,v_uid,'member',NULL)
  ON CONFLICT ON CONSTRAINT chat_participants_unique DO UPDATE SET left_at=NULL;
  RETURN QUERY SELECT v_conversation,'joined'::TEXT;
END;
$function$;
REVOKE ALL ON FUNCTION public.request_smartnekam_private_chat_group_join(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_smartnekam_private_chat_group_join(TEXT) TO authenticated;

-- Keep older RPC clients from bypassing join-approval settings.
CREATE OR REPLACE FUNCTION public.join_smartnekam_public_chat_group(p_conversation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  PERFORM public.request_smartnekam_public_chat_group_join(p_conversation_id);
END;
$function$;
REVOKE ALL ON FUNCTION public.join_smartnekam_public_chat_group(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_smartnekam_public_chat_group(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.join_smartnekam_private_chat_group(p_invite_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_conversation UUID; v_status TEXT;
BEGIN
  SELECT r.conversation_id,r.request_status INTO v_conversation,v_status
  FROM public.request_smartnekam_private_chat_group_join(p_invite_code) r;
  IF v_status='pending' THEN RETURN NULL; END IF;
  RETURN v_conversation;
END;
$function$;
REVOKE ALL ON FUNCTION public.join_smartnekam_private_chat_group(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_smartnekam_private_chat_group(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_smartnekam_group_message(p_message_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_uid UUID := (SELECT auth.uid()); v_conversation UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT m.conversation_id INTO v_conversation FROM public.chat_messages m WHERE m.id=p_message_id AND m.deleted_at IS NULL;
  IF v_conversation IS NULL THEN RAISE EXCEPTION 'message_not_found'; END IF;
  IF NOT public.is_smartnekam_chat_group_admin(v_conversation,v_uid) THEN RAISE EXCEPTION 'only_group_admins_can_delete_messages'; END IF;
  UPDATE public.chat_messages SET body='This message was deleted by admin',attachment_path=NULL,message_type='text',deleted_at=now(),deleted_by=v_uid,edited_at=NULL WHERE id=p_message_id;
  DELETE FROM public.chat_message_reactions WHERE message_id=p_message_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.admin_delete_smartnekam_group_message(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_smartnekam_group_message(UUID) TO authenticated;

-- Enforce admin-only announcements at the database boundary, not only in the UI.
CREATE OR REPLACE FUNCTION public.smartnekam_enforce_group_message_policy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_type TEXT; v_status TEXT; v_policy TEXT;
BEGIN
  SELECT c.conversation_type,c.status,s.send_messages_policy INTO v_type,v_status,v_policy
  FROM public.chat_conversations c LEFT JOIN public.chat_group_settings s ON s.conversation_id=c.id
  WHERE c.id=NEW.conversation_id;
  IF v_status IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'conversation_not_active'; END IF;
  IF v_type='group' AND v_policy='admins' AND NOT public.is_smartnekam_chat_group_admin(NEW.conversation_id,NEW.sender_id) THEN
    RAISE EXCEPTION 'only_group_admins_can_send_messages';
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS smartnekam_enforce_group_message_policy ON public.chat_messages;
CREATE TRIGGER smartnekam_enforce_group_message_policy BEFORE INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.smartnekam_enforce_group_message_policy();

-- Expire messages and clean up their message rows. Private storage paths become unreachable once the rows are removed.
CREATE OR REPLACE FUNCTION public.purge_smartnekam_expired_group_messages(p_conversation_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_uid UUID := (SELECT auth.uid()); v_deleted INTEGER:=0; v_seconds INTEGER;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.chat_participants cp WHERE cp.conversation_id=p_conversation_id AND cp.user_id=v_uid AND cp.left_at IS NULL) THEN RAISE EXCEPTION 'active_group_membership_required'; END IF;
  SELECT s.disappearing_messages_seconds INTO v_seconds FROM public.chat_group_settings s JOIN public.chat_conversations c ON c.id=s.conversation_id WHERE s.conversation_id=p_conversation_id AND c.conversation_type='group' AND c.status='active';
  IF v_seconds IS NULL THEN RETURN 0; END IF;
  DELETE FROM public.chat_messages WHERE conversation_id=p_conversation_id AND created_at < now() - make_interval(secs=>v_seconds);
  GET DIAGNOSTICS v_deleted=ROW_COUNT;
  RETURN v_deleted;
END;
$function$;
REVOKE ALL ON FUNCTION public.purge_smartnekam_expired_group_messages(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_smartnekam_expired_group_messages(UUID) TO authenticated;

-- Trigger to remove expired posts whenever a new group message is inserted.
CREATE OR REPLACE FUNCTION public.smartnekam_purge_expired_group_messages_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_seconds INTEGER;
BEGIN
  SELECT s.disappearing_messages_seconds INTO v_seconds FROM public.chat_group_settings s WHERE s.conversation_id=NEW.conversation_id;
  IF v_seconds IS NOT NULL THEN
    DELETE FROM public.chat_messages WHERE conversation_id=NEW.conversation_id AND id<>NEW.id AND created_at < now() - make_interval(secs=>v_seconds);
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS smartnekam_purge_expired_group_messages_after_insert ON public.chat_messages;
CREATE TRIGGER smartnekam_purge_expired_group_messages_after_insert AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.smartnekam_purge_expired_group_messages_on_insert();

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Verify after installation:
-- SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='chat_group_settings' ORDER BY ordinal_position;
-- SELECT to_regprocedure('public.get_smartnekam_chat_group_management(uuid)'), to_regprocedure('public.update_smartnekam_chat_group_settings(uuid,text,text,text,text,text,text,boolean,boolean,integer,boolean)');
