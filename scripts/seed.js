const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function seed() {
  console.log('Начало заполнения БД (Seeding)...');

  try {
    const hashedPassword = await bcrypt.hash('password123', 10);

    const admin = await prisma.user.upsert({
      where: { email: 'admin@example.com' },
      update: {},
      create: {
        email: 'admin@example.com',
        password: hashedPassword,
        name: 'Demo Admin',
        role: 'ADMIN',
      },
    });

    const user = await prisma.user.upsert({
      where: { email: 'user@example.com' },
      update: {},
      create: {
        email: 'user@example.com',
        password: hashedPassword,
        name: 'Demo User',
        role: 'USER',
      },
    });

    const room = await prisma.resource.create({
      data: {
        name: 'Переговорка Альфа',
        type: 'room',
        capacity: 10,
        description: 'Проектор, флипчарт, кондиционер',
      },
    });

    const desk = await prisma.resource.create({
      data: {
        name: 'Рабочее место №5',
        type: 'desk',
        capacity: 1,
        description: 'У окна, монитор 27 дюймов',
      },
    });

    console.log('Данные успешно загружены!');
    console.log(`Админ: admin@example.com / password123`);
    console.log(`Юзер: user@example.com / password123`);
    console.log(`Создано ресурсов: 2`);
  } catch (error) {
    console.error('Ошибка при заполнении БД:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();