// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ API key controller
// └──────────────────────────────────────────────────────────────────────────┘

const ApiKey = require('../models/ApiKey');

// list keys: only the masked prefix is returned, never the key or its hash
async function getApiKeys(req, res) {
  try {
    const keys = await ApiKey.findAll();
    res.json({ success: true, data: keys });
  } catch (error) {
    console.error('Get API keys error:', error);
    res.status(500).json({ success: false, message: 'Failed to get API keys' });
  }
}

// the plaintext key is returned once, at creation
async function createApiKey(req, res) {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Key name is required' });
    }

    const { plaintextKey, keyHash, keyPrefix } = ApiKey.generateKey();
    const id = await ApiKey.create({ name: name.trim(), keyHash, keyPrefix, createdBy: req.user.id });

    res.status(201).json({
      success: true,
      message: 'API key generated. Copy it now - it will not be shown again.',
      data: {
        id,
        name: name.trim(),
        key: plaintextKey,
        keyPrefix,
        status: 'ACTIVE'
      }
    });
  } catch (error) {
    console.error('Create API key error:', error);
    res.status(500).json({ success: false, message: 'Failed to create API key' });
  }
}

async function setApiKeyStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['ACTIVE', 'DISABLED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'status must be ACTIVE or DISABLED' });
    }

    const key = await ApiKey.findById(id);
    if (!key) {
      return res.status(404).json({ success: false, message: 'API key not found' });
    }

    await ApiKey.setStatus(id, status);
    res.json({ success: true, message: `API key ${status === 'ACTIVE' ? 'enabled' : 'disabled'}` });
  } catch (error) {
    console.error('Update API key status error:', error);
    res.status(500).json({ success: false, message: 'Failed to update API key' });
  }
}

async function deleteApiKey(req, res) {
  try {
    const { id } = req.params;
    const key = await ApiKey.findById(id);
    if (!key) {
      return res.status(404).json({ success: false, message: 'API key not found' });
    }

    await ApiKey.delete(id);
    res.json({ success: true, message: 'API key deleted' });
  } catch (error) {
    console.error('Delete API key error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete API key' });
  }
}

module.exports = { getApiKeys, createApiKey, setApiKeyStatus, deleteApiKey };
