const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  const { type, minCapacity } = req.query;
  try {
    const resources = await prisma.resource.findMany({
      where: {
        type: type || undefined,
        capacity: minCapacity ? { gte: parseInt(minCapacity) } : undefined
      },
      include: { reviews: true }
    });

    const response = resources.map(r => ({
      ...r,
      rating: r.reviews.length ? (r.reviews.reduce((a, b) => a + b.rating, 0) / r.reviews.length).toFixed(1) : 0
    }));
    res.json(response);
  } catch (e) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.get('/search', async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: "Укажите start и end" });
  
  const availableResources = await prisma.resource.findMany({
    where: {
      bookings: {
        none: {
          status: 'confirmed',
          startTime: { lt: new Date(end) },
          endTime: { gt: new Date(start) }
        }
      }
    }
  });
  res.json(availableResources);
});

router.post('/', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const resource = await prisma.resource.create({ data: req.body });
    res.status(201).json(resource);
  } catch (e) {
    res.status(400).json({ error: "Ошибка создания" });
  }
});

router.post('/:id/reviews', authenticate, async (req, res) => {
  const resourceId = Number(req.params.id);
  const { rating, comment } = req.body;

  const finishedBooking = await prisma.booking.findFirst({
    where: { resourceId, userId: req.user.id, endTime: { lt: new Date() }, status: 'confirmed' }
  });

  if (!finishedBooking) return res.status(403).json({ error: "Нужно завершенное бронирование" });

  const review = await prisma.review.create({
    data: { resourceId, userId: req.user.id, rating, comment }
  });
  res.status(201).json(review);
});

module.exports = router;