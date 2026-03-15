const { execSync } = require('child_process');
require('dotenv').config();

async function runMigrations() {
  try {
    console.log('Запуск миграций БД...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    console.log('Миграции успешно применены.');
  } catch (error) {
    console.error('Ошибка при выполнении миграций:', error);
    process.exit(1);
  }
}

runMigrations();