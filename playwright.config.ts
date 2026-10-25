import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
  testDir:'tests/e2e',fullyParallel:false,workers:1,timeout:30000,
  reporter:'list',use:{baseURL:'http://localhost:4310',trace:'retain-on-failure'},
  projects:[{name:'desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:980}}},{name:'mobile',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}}],
  webServer:{command:'npm run dev',url:'http://localhost:4310/api/health',reuseExistingServer:false,timeout:30000},
});
