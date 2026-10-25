export interface Config { databaseUrl:string; authDatabaseUrl:string; secret:string; origin:string; production:boolean; poolSize?:number }
export function configFromEnvironment():Config {
  function required(name:string) { const value=process.env[name]; if(!value) throw new Error(`Missing ${name}; run npm run setup`); return value; }
  const origin=new URL(required('APP_ORIGIN')).origin;
  const production=process.env.NODE_ENV==='production';
  const secret=required('BETTER_AUTH_SECRET');
  if(secret.length<32) throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters');
  if(production && !origin.startsWith('https://')) throw new Error('Production requires an HTTPS APP_ORIGIN');
  return {databaseUrl:required('DATABASE_URL'),authDatabaseUrl:required('AUTH_DATABASE_URL'),secret,origin,production};
}
