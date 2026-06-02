module.exports = {
  apps: [
    {
      name: 'classroombookings',
      script: 'src/index.js',
      cwd: __dirname,
      watch: ['src'],
      ignore_watch: ['node_modules', 'local'],
      autorestart: true,
      env: {
        NODE_ENV: 'production',
        PORT: 8000
      }
    }
  ]
};
