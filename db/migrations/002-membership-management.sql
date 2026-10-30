-- Owner-only operations. Runtime callers cannot write memberships or read auth users directly.
CREATE FUNCTION app.require_membership_owner(p_org uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor text := current_setting('app.user_id',true); actor_role text;
BEGIN
  IF p_org IS DISTINCT FROM nullif(current_setting('app.organization_id',true),'')::uuid THEN
    RAISE EXCEPTION 'Organization not found' USING ERRCODE='PT404';
  END IF;
  SELECT role INTO actor_role FROM app.memberships WHERE organization_id=p_org AND user_id=actor;
  IF actor_role IS NULL THEN RAISE EXCEPTION 'Organization not found' USING ERRCODE='PT404'; END IF;
  IF actor_role <> 'owner' THEN RAISE EXCEPTION 'Owner access required' USING ERRCODE='PT403'; END IF;
  -- All membership operations take the same organization lock before checking/mutating owners.
  PERFORM id FROM app.organizations WHERE id=p_org FOR UPDATE;
  -- A competing owner may have changed this actor while the lock was awaited.
  SELECT role INTO actor_role FROM app.memberships WHERE organization_id=p_org AND user_id=actor;
  IF actor_role IS NULL THEN RAISE EXCEPTION 'Organization not found' USING ERRCODE='PT404'; END IF;
  IF actor_role <> 'owner' THEN RAISE EXCEPTION 'Owner access required' USING ERRCODE='PT403'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION app.require_membership_owner(uuid) FROM PUBLIC;

CREATE FUNCTION app.list_members(p_org uuid)
RETURNS TABLE(user_id text,name text,email text,role text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM app.require_membership_owner(p_org);
  RETURN QUERY SELECT m.user_id,u.name::text,u.email::text,m.role
    FROM app.memberships m JOIN auth."user" u ON u.id=m.user_id
    WHERE m.organization_id=p_org ORDER BY lower(u.name),m.user_id;
END;
$$;
REVOKE ALL ON FUNCTION app.list_members(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.list_members(uuid) TO tenantflow_app;

CREATE FUNCTION app.mutate_member(p_org uuid,p_action text,p_target text,p_role text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target_id text; old_role text; result jsonb;
BEGIN
  PERFORM app.require_membership_owner(p_org);
  IF p_action IS NULL OR p_action NOT IN ('add','update','remove') THEN
    RAISE EXCEPTION 'Invalid membership operation' USING ERRCODE='PT400';
  END IF;
  IF p_action IN ('add','update') AND (p_role IS NULL OR p_role NOT IN ('owner','admin','member','viewer')) THEN
    RAISE EXCEPTION 'Invalid membership role' USING ERRCODE='PT400';
  END IF;
  IF p_action='add' THEN
    SELECT id INTO target_id FROM auth."user" WHERE lower(email)=lower(btrim(p_target));
    IF target_id IS NULL THEN RAISE EXCEPTION 'Registered user not found' USING ERRCODE='PT404'; END IF;
    INSERT INTO app.memberships(organization_id,user_id,role) VALUES(p_org,target_id,p_role);
  ELSE
    target_id := p_target;
    SELECT role INTO old_role FROM app.memberships WHERE organization_id=p_org AND user_id=target_id;
    IF old_role IS NULL THEN RAISE EXCEPTION 'Membership not found' USING ERRCODE='PT404'; END IF;
    IF old_role='owner' AND (p_action='remove' OR p_role<>'owner') THEN
      IF (SELECT count(*) FROM app.memberships WHERE organization_id=p_org AND role='owner')<=1 THEN
        RAISE EXCEPTION 'Keep at least one owner' USING ERRCODE='PT409';
      END IF;
    END IF;
    IF p_action='remove' THEN
      DELETE FROM app.memberships WHERE organization_id=p_org AND user_id=target_id;
      RETURN jsonb_build_object('removed',true);
    END IF;
    UPDATE app.memberships SET role=p_role WHERE organization_id=p_org AND user_id=target_id;
  END IF;
  SELECT jsonb_build_object('member',jsonb_build_object('user_id',m.user_id,'name',u.name,'email',u.email,'role',m.role))
    INTO result FROM app.memberships m JOIN auth."user" u ON u.id=m.user_id
    WHERE m.organization_id=p_org AND m.user_id=target_id;
  RETURN result;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'User is already a member' USING ERRCODE='PT409';
END;
$$;
REVOKE ALL ON FUNCTION app.mutate_member(uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.mutate_member(uuid,text,text,text) TO tenantflow_app;
