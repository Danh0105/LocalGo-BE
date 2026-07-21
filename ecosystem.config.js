// PM2 config. cwd must stay /var/www/LocalGo-BE: ConfigModule resolves .env and
// main.ts resolves the uploads dir relative to the working directory.
module.exports = {
  apps: [
    {
      name: 'localgo-be',
      script: 'dist/src/main.js',
      cwd: '/var/www/LocalGo-BE',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/var/log/pm2/localgo-be.error.log',
      out_file: '/var/log/pm2/localgo-be.out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
