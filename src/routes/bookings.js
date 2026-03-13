const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();
const prisma = new PrismaClient();

router.post('/', authenticate, async (req, res) => {
  const { resourceId, startTime, endTime } = req.body;
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (start >= end) return res.status(400).json({ error: "Конец должен быть после начала" });

  const conflict = await prisma.booking.findFirst({
    where: {
      resourceId,
      status: 'confirmed',
      NOT: [
        { OR: [ { startTime: { gte: end } }, { endTime: { lte: start } } ] }
      ]
    }
  });

  if (conflict) return res.status(409).json({ error: "Это время уже занято" });

  const booking = await prisma.booking.create({
    data: { resourceId, userId: req.user.id, startTime: start, endTime: end }
  });
  res.status(201).json(booking);
});

router.patch('/:id/cancel', authenticate, async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: Number(req.params.id) } });
  
  if (!booking) return res.status(404).json({ error: "Не найдено" });
  if (booking.userId !== req.user.id && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: "Чужое бронирование" });
  }

  const updated = await prisma.booking.update({
    where: { id: Number(req.params.id) },
    data: { status: 'cancelled' }
  });
  res.json(updated);
});

module.exports = router;