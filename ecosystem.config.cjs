/**
 * PM2 process list for ihute-frontend deployments on ubuntu-s-8vcpu-16gb-ams3-01.
 *
 * First-time setup on the server:
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *   pm2 startup   # follow printed instructions so PM2 survives reboot
 *
 * Each app reads PORT and secrets from its own .env in cwd (Next.js loads automatically).
 */
module.exports = {
  apps: [
    {
      name: "ihute-frontend",
      cwd: "/var/www/ihute-frontend",
      script: "npm",
      args: "start",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "1500M",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "ihute-frontend-dev",
      cwd: "/var/www/ihute-frontend-dev",
      script: "npm",
      args: "start",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "1500M",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "ihute-frontend-beta",
      cwd: "/var/www/ihute-frontend_beta",
      script: "npm",
      args: "start",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "1500M",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "grandma-ihute",
      cwd: "/var/www/grandma-ihute",
      script: "npm",
      args: "start",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "1500M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
