import express from 'express';

const router = express.Router();

/**
 * Health check endpoint.
 * Railway e i monitor esterni possono pingare questa route.
 */
router.get('/', (req, res) => {
  res.status(200).json({
    service: 'ASSOCAF Voice Agent',
    status: 'online',
    timestamp: new Date().toISOString(),
  });
});

router.get('/health', (req, res) => {
  res.status(200).send('OK');
});

export default router;
