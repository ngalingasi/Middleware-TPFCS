// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Outbox controller
// └──────────────────────────────────────────────────────────────────────────┘

const eventService = require('../services/eventService');

async function list(req, res) {
  try {
    const result = await eventService.list({
      systemId: req.query.systemId,
      status: req.query.status,
      type: req.query.type,
      billId: req.query.billId,
      page: Math.max(parseInt(req.query.page) || 1, 1),
      limit: Math.min(parseInt(req.query.limit) || 25, 100)
    });
    res.json({ success: true, data: result.data, pagination: result.pagination, stats: await eventService.stats(), types: eventService.EVENT_TYPES });
  } catch (error) {
    console.error('List outbox error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

async function get(req, res) {
  try {
    const event = await eventService.get(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    res.json({ success: true, data: event });
  } catch (error) {
    console.error('Get outbox event error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

async function replay(req, res) {
  try {
    const result = await eventService.replay(req.params.id);
    if (!result.found) return res.status(404).json({ success: false, message: 'Event not found' });
    if (result.error) return res.status(400).json({ success: false, message: result.error });
    res.json({ success: true, message: 'Queued to be sent again' });
  } catch (error) {
    console.error('Replay event error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = { list, get, replay };
