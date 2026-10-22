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
      // Restart before the 1 GiB admission circuit opens, so the process
      // cannot plateau permanently in a state where every request gets 503.
      max_memory_restart: '896M',
      env: {
        NODE_ENV: 'production',
        // Bound glibc arena growth and return freed Sharp buffers sooner.
        MALLOC_ARENA_MAX: '2',
        MALLOC_TRIM_THRESHOLD_: '131072',
      },
      error_file: '/var/log/pm2/localgo-be.error.log',
      out_file: '/var/log/pm2/localgo-be.out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
