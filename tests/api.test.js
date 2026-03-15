const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const app = require('../src/server'); 

describe('Booking API Tests', () => {
  let token;

  beforeAll(async () => {
    await prisma.review.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.resource.deleteMany();
    await prisma.user.deleteMany();
  });

  test('1. Регистрация пользователя', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'test@test.com',
      password: 'password123',
      name: 'Test User'
    });
    expect(res.statusCode).toEqual(200);
  });

  test('2. Логин и получение токена', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'test@test.com',
      password: 'password123'
    });
    token = res.body.token;
    expect(token).toBeDefined();
  });

  test('3. Создание ресурса админом (ошибка без прав)', async () => {
    const res = await request(app)
      .post('/api/resources')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Room 1', type: 'room', capacity: 10 });
    expect(res.statusCode).toEqual(403);
  });

  test('4. Получение списка ресурсов', async () => {
    const res = await request(app).get('/api/resources');
    expect(Array.isArray(res.body)).toBeTruthy();
  });

  test('5. Поиск свободных ресурсов (пустой список)', async () => {
    const res = await request(app).get('/api/resources/search?start=2026-01-01T10:00:00Z&end=2026-01-01T12:00:00Z');
    expect(res.statusCode).toEqual(200);
  });
});