import type {Pool,PoolClient} from 'pg';

// Shared by startup and migration preflight; never silently adopt an unsafe role.
export async function assertDefinerRole(connection:Pool|PoolClient,required=true) {
  const result=await connection.query("SELECT oid,rolcanlogin,rolinherit,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication FROM pg_roles WHERE rolname='tenantflow_definer'");
  const role=result.rows[0];
  if(!role){if(required)throw new Error('Unsafe database definer role: migrations required');return;}
  if(['rolcanlogin','rolinherit','rolsuper','rolbypassrls','rolcreatedb','rolcreaterole','rolreplication'].some(flag=>role[flag]))throw new Error('Unsafe database definer role attributes');
  const membership=await connection.query(`SELECT
    EXISTS(SELECT 1 FROM pg_auth_members WHERE member=$1::oid) AS parent_role,
    EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('tenantflow_app','tenantflow_auth')
      AND pg_has_role(oid,$1::oid,'MEMBER')) AS runtime_member`,[role.oid]);
  if(membership.rows[0].parent_role||membership.rows[0].runtime_member)throw new Error('Unsafe database definer role membership');
}
