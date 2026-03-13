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

module.exports = router;