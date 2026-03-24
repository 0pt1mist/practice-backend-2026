const request = require('supertest');
const app = require('../src/server');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

describe('Комплексное тестирование Booking API с проверкой данных', () => {
  let adminToken, userToken;
  let testUserId, testResourceId, testBookingId;

  const mockUser = {
    email: `user_${Date.now()}@test.com`,
    password: 'password123',
    name: 'Иван Иванов'
  };

  const mockResource = {
    name: 'Переговорка Квант',
    type: 'room',
    capacity: 12,
    description: '4K Монитор и кофемашина'
  };

  beforeAll(async () => {
    await prisma.review.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.resource.deleteMany();
    await prisma.user.deleteMany();

    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.create({
      data: {
        email: 'admin@test.com',
        password: adminPassword,
        name: 'Администратор системы',
        role: 'ADMIN'
      }
    });

    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@test.com',
      password: 'admin123'
    });
    adminToken = adminLogin.body.token;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('1. Регистрация и проверка созданного профиля', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send(mockUser);
    
    expect(regRes.statusCode).toBe(200);
    testUserId = regRes.body.userId;

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: mockUser.email, password: mockUser.password });
    
    userToken = loginRes.body.token;

    const usersList = await request(app)
      .get('/api/auth/users')
      .set('Authorization', `Bearer ${adminToken}`);
    
    const foundUser = usersList.body.find(u => u.email === mockUser.email);
    expect(foundUser).toMatchObject({
      email: mockUser.email,
      name: mockUser.name,
      role: 'USER'
    });
  });

  test('2. Создание ресурса и сравнение характеристик', async () => {
    const res = await request(app)
      .post('/api/resources')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(mockResource);
    
    expect(res.statusCode).toBe(201);
    testResourceId = res.body.id;

    const getRes = await request(app).get('/api/resources');
    const createdResource = getRes.body.find(r => r.id === testResourceId);

    expect(createdResource.name).toBe(mockResource.name);
    expect(createdResource.type).toBe(mockResource.type);
    expect(createdResource.capacity).toBe(mockResource.capacity);
    expect(createdResource.description).toBe(mockResource.description);
  });

  test('3. Создание бронирования и проверка статуса', async () => {
    const bookingData = {
      resourceId: testResourceId,
      startTime: '2026-12-01T10:00:00.000Z',
      endTime: '2026-12-01T12:00:00.000Z'
    };

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${userToken}`)
      .send(bookingData);
    
    expect(res.statusCode).toBe(201);
    testBookingId = res.body.id;

    const myBookings = await request(app)
      .get('/api/bookings/my')
      .set('Authorization', `Bearer ${userToken}`);
    
    const booking = myBookings.body.find(b => b.id === testBookingId);
    expect(new Date(booking.startTime).toISOString()).toBe(bookingData.startTime);
    expect(booking.status).toBe('confirmed');
    expect(booking.resource.name).toBe(mockResource.name);
  });

  test('4. Проверка логики конфликта (Overlap)', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        resourceId: testResourceId,
        startTime: '2026-12-01T11:00:00.000Z',
        endTime: '2026-12-01T13:00:00.000Z'
      });
    
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('Это время уже занято');
  });

  test('5. Поиск свободных ресурсов на свободное время', async () => {
    const res = await request(app)
      .get('/api/resources/search?start=2026-12-15T10:00:00Z&end=2026-12-15T12:00:00Z');
    
    const found = res.body.some(r => r.id === testResourceId);
    expect(found).toBe(true);
  });

  test('6. Отмена бронирования и проверка статуса', async () => {
    const res = await request(app)
      .patch(`/api/bookings/${testBookingId}/cancel`)
      .set('Authorization', `Bearer ${userToken}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('cancelled');


    const searchRes = await request(app)
      .get('/api/resources/search?start=2026-12-01T10:30:00Z&end=2026-12-01T11:30:00Z');
    expect(searchRes.body.some(r => r.id === testResourceId)).toBe(true);
  });



  test('7. Проверка расчета среднего рейтинга', async () => {

    await prisma.booking.create({
      data: {
        resourceId: testResourceId,
        userId: testUserId,
        startTime: new Date('2020-01-01T10:00:00Z'),
        endTime: new Date('2020-01-01T12:00:00Z'),
        status: 'confirmed'
      }
    });

    await request(app)
      .post(`/api/resources/${testResourceId}/reviews`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ rating: 5, comment: 'Супер!' });

    await request(app)
      .post(`/api/resources/${testResourceId}/reviews`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ rating: 4, comment: 'Хорошо' });

    const res = await request(app).get('/api/resources');
    const resource = res.body.find(r => r.id === testResourceId);
    
    expect(Number(resource.rating)).toBe(4.5);
  });
});