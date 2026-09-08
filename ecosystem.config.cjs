module.exports = {
  apps: [
    {
      name: 'candidfan-api',
      cwd: './server',
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true
    },
    {
      name: 'candidfan-email',
      cwd: './server',
      script: 'dist/email-worker.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/email-err.log',
      out_file: './logs/email-out.log',
      log_file: './logs/email-combined.log',
      time: true
    }
  ]
};
