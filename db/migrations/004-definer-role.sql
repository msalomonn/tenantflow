-- Managed PostgreSQL must not require a superuser-owned SECURITY DEFINER function.
-- Role/schema/ownership changes run in the migration runner's single transaction.
DO $$
DECLARE owner_role name := current_user; definer_oid oid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='tenantflow_definer') THEN
    CREATE ROLE tenantflow_definer NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  SELECT oid INTO definer_oid FROM pg_roles WHERE rolname='tenantflow_definer';
  IF EXISTS (SELECT 1 FROM pg_roles WHERE oid=definer_oid
      AND (rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication))
    OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member=definer_oid)
    OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('tenantflow_app','tenantflow_auth') AND pg_has_role(oid,definer_oid,'MEMBER')) THEN
    RAISE EXCEPTION 'Unsafe database definer role' USING ERRCODE='42501';
  END IF;
  -- The migration operator needs SET for ownership transfer, not implicit data access.
  EXECUTE format('GRANT tenantflow_definer TO %I WITH INHERIT FALSE, SET TRUE',owner_role);
END;
$$;

GRANT USAGE ON SCHEMA app,auth TO tenantflow_definer;
GRANT SELECT (id), INSERT (name), UPDATE (name) ON app.organizations TO tenantflow_definer;
GRANT SELECT,INSERT,DELETE ON app.memberships TO tenantflow_definer;
GRANT UPDATE (role) ON app.memberships TO tenantflow_definer;
GRANT SELECT (id,name,email) ON auth."user" TO tenantflow_definer;

CREATE POLICY definer_organizations_select ON app.organizations FOR SELECT TO tenantflow_definer USING (true);
CREATE POLICY definer_organizations_insert ON app.organizations FOR INSERT TO tenantflow_definer WITH CHECK (true);
-- SELECT FOR UPDATE in the existing owner guard needs an UPDATE privilege/policy.
CREATE POLICY definer_organizations_lock ON app.organizations FOR UPDATE TO tenantflow_definer USING (true) WITH CHECK (true);
CREATE POLICY definer_memberships_select ON app.memberships FOR SELECT TO tenantflow_definer USING (true);
CREATE POLICY definer_memberships_insert ON app.memberships FOR INSERT TO tenantflow_definer WITH CHECK (true);
CREATE POLICY definer_memberships_update ON app.memberships FOR UPDATE TO tenantflow_definer USING (true) WITH CHECK (true);
CREATE POLICY definer_memberships_delete ON app.memberships FOR DELETE TO tenantflow_definer USING (true);

-- PostgreSQL requires the new owner to have schema CREATE during transfer only.
GRANT CREATE ON SCHEMA app TO tenantflow_definer;
ALTER FUNCTION app.create_organization(text) OWNER TO tenantflow_definer;
ALTER FUNCTION app.require_membership_owner(uuid) OWNER TO tenantflow_definer;
ALTER FUNCTION app.list_members(uuid) OWNER TO tenantflow_definer;
ALTER FUNCTION app.mutate_member(uuid,text,text,text) OWNER TO tenantflow_definer;
REVOKE CREATE ON SCHEMA app FROM tenantflow_definer;
-- Existing PUBLIC revocations and tenantflow_app execution grants remain unchanged.
