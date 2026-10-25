import { betterAuth } from 'better-auth';
import type { Pool } from 'pg';
import type { Config } from './config.js';
export function createAuth(pool:Pool, config:Config) {
  return betterAuth({
    appName:'TenantFlow',database:pool,baseURL:config.origin,secret:config.secret,
    trustedOrigins:[config.origin],
    emailAndPassword:{enabled:true,minPasswordLength:12,maxPasswordLength:128},
    session:{expiresIn:60*60*24,updateAge:60*60,cookieCache:{enabled:false}},
    advanced:{useSecureCookies:config.production,ipAddress:{ipAddressHeaders:['x-tenantflow-client-ip']}},
    rateLimit:{enabled:true,window:60,max:100},
    logger:{level:'error'},
  });
}
