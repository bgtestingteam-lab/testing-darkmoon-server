module.exports = {
  apps: [
    {
      name: 'darkmoon-backend',
      script: './dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '450M',
      env_production: {
        NODE_ENV: 'production',
      },
      kill_timeout: 5000,
      listen_timeout: 5000,
      graceful_shutdown: true,
      wait_ready: true,
    },
  ],
};
