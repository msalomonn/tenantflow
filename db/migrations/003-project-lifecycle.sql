-- Only lifecycle columns are writable; identity and tenant relationships stay immutable.
GRANT UPDATE (name,archived_at) ON app.projects TO tenantflow_app;
CREATE POLICY update_projects ON app.projects FOR UPDATE TO tenantflow_app
  USING (organization_id=nullif(current_setting('app.organization_id',true),'')::uuid
    AND EXISTS (SELECT 1 FROM app.memberships m WHERE m.organization_id=projects.organization_id AND m.user_id=current_setting('app.user_id',true) AND m.role IN ('owner','admin','member')))
  WITH CHECK (organization_id=nullif(current_setting('app.organization_id',true),'')::uuid
    AND EXISTS (SELECT 1 FROM app.memberships m WHERE m.organization_id=projects.organization_id AND m.user_id=current_setting('app.user_id',true) AND m.role IN ('owner','admin','member')));
GRANT UPDATE (name) ON app.organizations TO tenantflow_app;
CREATE POLICY rename_organizations ON app.organizations FOR UPDATE TO tenantflow_app
  USING (id=nullif(current_setting('app.organization_id',true),'')::uuid
    AND EXISTS (SELECT 1 FROM app.memberships m WHERE m.organization_id=organizations.id AND m.user_id=current_setting('app.user_id',true) AND m.role IN ('owner','admin')))
  WITH CHECK (id=nullif(current_setting('app.organization_id',true),'')::uuid
    AND EXISTS (SELECT 1 FROM app.memberships m WHERE m.organization_id=organizations.id AND m.user_id=current_setting('app.user_id',true) AND m.role IN ('owner','admin')));
