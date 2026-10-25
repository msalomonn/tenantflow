CREATE SCHEMA app;
REVOKE ALL ON SCHEMA app FROM PUBLIC;
GRANT USAGE ON SCHEMA app TO tenantflow_app;

CREATE TABLE app.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.memberships (
  organization_id uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES auth."user"(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','admin','member','viewer')),
  PRIMARY KEY (organization_id, user_id)
);
CREATE INDEX memberships_user ON app.memberships(user_id,organization_id);
CREATE TABLE app.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 120),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id)
);
CREATE INDEX projects_tenant ON app.projects(organization_id,created_at);

ALTER TABLE app.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE app.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE app.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.projects FORCE ROW LEVEL SECURITY;

CREATE POLICY own_memberships ON app.memberships FOR SELECT TO tenantflow_app
  USING (user_id = current_setting('app.user_id',true));
CREATE POLICY member_organizations ON app.organizations FOR SELECT TO tenantflow_app
  USING (EXISTS (SELECT 1 FROM app.memberships m WHERE m.organization_id=id AND m.user_id=current_setting('app.user_id',true)));
CREATE POLICY member_projects ON app.projects FOR SELECT TO tenantflow_app
  USING (organization_id=nullif(current_setting('app.organization_id',true),'')::uuid
    AND EXISTS (SELECT 1 FROM app.memberships m WHERE m.organization_id=projects.organization_id AND m.user_id=current_setting('app.user_id',true)));
CREATE POLICY writer_projects ON app.projects FOR INSERT TO tenantflow_app
  WITH CHECK (organization_id=nullif(current_setting('app.organization_id',true),'')::uuid
    AND EXISTS (SELECT 1 FROM app.memberships m WHERE m.organization_id=projects.organization_id AND m.user_id=current_setting('app.user_id',true) AND m.role IN ('owner','admin','member')));

GRANT SELECT ON app.organizations,app.memberships,app.projects TO tenantflow_app;
GRANT INSERT (organization_id,name) ON app.projects TO tenantflow_app;

-- Narrow bootstrap operation: a new organization and its first owner are inseparable.
-- The caller cannot choose another owner; the API sets identity from the verified session.
CREATE FUNCTION app.create_organization(p_name text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE new_id uuid; actor text := current_setting('app.user_id',true);
BEGIN
  IF actor IS NULL OR actor='' THEN RAISE EXCEPTION 'Identity required' USING ERRCODE='42501'; END IF;
  INSERT INTO app.organizations(name) VALUES(p_name) RETURNING id INTO new_id;
  INSERT INTO app.memberships(organization_id,user_id,role) VALUES(new_id,actor,'owner');
  RETURN new_id;
END;
$$;
REVOKE ALL ON FUNCTION app.create_organization(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.create_organization(text) TO tenantflow_app;
