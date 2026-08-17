/**
 * PM2 process list — names must match `pm2 list` on ubuntu-s-8vcpu-16gb-ams3-01.
 *
 *   ihute-dev      → /var/www/ihute-frontend-dev   (dev.ihute.rw)
 *   ihute-beta     → /var/www/ihute-frontend_beta  (beta.ihute.rw)
 *   ihute-frontend → /var/www/ihute-frontend       (ihute.rw)
 *   ihute-grandma  → /var/www/grandma-ihute        (shop.ihute.rw)
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
      name: "ihute-dev",
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
      name: "ihute-beta",
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
      name: "ihute-grandma",
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
