const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
    const resources = await prisma.resource.findMany();
    res.json(resources);
});

router.post('/', authenticate, authorize('ADMIN'), async (req, res) => {
    const resource = await prisma.resource.create({ data: req.body });
    res.json(resource);
});

router.get('/search', async (req, res) => {
  const { start, end } = req.query;
  const startTime = new Date(start);
  const endTime = new Date(end);

  const availableResources = await prisma.resource.findMany({
    where: {
      bookings: {
        none: {
          status: 'confirmed',
          startTime: { lt: endTime },
          endTime: { gt: startTime }
        }
      }
    }
  });
  res.json(availableResources);
});

router.post('/:id/reviews', authenticate, async (req, res) => {
  const resourceId = Number(req.params.id);
  const { rating, comment } = req.body;

  const finishedBooking = await prisma.booking.findFirst({
    where: { resourceId, userId: req.user.id, endTime: { lt: new Date() } }
  });

  if (!finishedBooking) return res.status(403).json({ error: "Сначала посетите это место" });

  const review = await prisma.review.create({
    data: { resourceId, userId: req.user.id, rating, comment }
  });
  res.json(review);
});

module.exports = router;