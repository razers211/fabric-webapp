const express = require('express');
const Joi = require('joi');
const logger = require('../utils/logger');
const PortService = require('../services/portService');

const router = express.Router();
const portService = new PortService();

const portConfigSchema = Joi.object({
  switchInfo: Joi.object({
    host: Joi.string().ip().required(),
    username: Joi.string().required(),
    password: Joi.string().required()
  }).required(),
  portConfigurations: Joi.array().items(
    Joi.object({
      interface: Joi.string().required(),
      description: Joi.string().optional(),
      portType: Joi.string().valid('access', 'trunk', 'hybrid').required(),
      vlan: Joi.when('portType', {
        is: 'access',
        then: Joi.number().integer().min(1).max(4094).required(),
        otherwise: Joi.forbidden()
      }),
      allowedVlans: Joi.when('portType', {
        is: 'trunk',
        then: Joi.array().items(Joi.number().integer().min(1).max(4094)).required(),
        otherwise: Joi.forbidden()
      }),
      nativeVlan: Joi.when('portType', {
        is: 'trunk',
        then: Joi.number().integer().min(1).max(4094).default(1),
        otherwise: Joi.forbidden()
      }),
      taggedVlans: Joi.when('portType', {
        is: 'hybrid',
        then: Joi.array().items(Joi.number().integer().min(1).max(4094)).required(),
        otherwise: Joi.forbidden()
      }),
      untaggedVlans: Joi.when('portType', {
        is: 'hybrid',
        then: Joi.array().items(Joi.number().integer().min(1).max(4094)).required(),
        otherwise: Joi.forbidden()
      }),
      enabled: Joi.boolean().default(true)
    })
  ).min(1).required()
});

router.post('/configure', async (req, res) => {
  try {
    const { error, value } = portConfigSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details[0].message 
      });
    }

    const { switchInfo, portConfigurations } = value;
    
    logger.info('Configuring ports', { 
      switch: switchInfo.host, 
      portCount: portConfigurations.length 
    });
    
    // Get socket instance for real-time updates
    const socket = req.app.get('socket');
    
    const result = await portService.configurePorts(switchInfo, portConfigurations, socket);
    
    res.json(result);
    
  } catch (error) {
    logger.error('Port configuration failed:', error);
    res.status(500).json({ 
      error: 'Port configuration failed', 
      message: error.message 
    });
  }
});

router.get('/status/:host', async (req, res) => {
  try {
    const { host } = req.params;
    const { username, password } = req.query;
    
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Username and password are required' 
      });
    }
    
    const result = await portService.getPortStatus(host, username, password);
    
    res.json(result);
    
  } catch (error) {
    logger.error('Port status retrieval failed:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve port status', 
      message: error.message 
    });
  }
});

router.put('/toggle/:host/:interface', async (req, res) => {
  try {
    const { host, interface: interfaceName } = req.params;
    const { username, password, enabled } = req.body;
    
    if (!username || !password || typeof enabled !== 'boolean') {
      return res.status(400).json({ 
        error: 'Username, password, and enabled status are required' 
      });
    }
    
    // Get socket instance for real-time updates
    const socket = req.app.get('socket');
    
    const result = await portService.togglePort(host, username, password, interfaceName, enabled);
    
    // Emit real-time update
    if (socket) {
      socket.emit('port-toggled', {
        switch: host,
        interface: interfaceName,
        enabled,
        status: 'completed'
      });
    }
    
    res.json(result);
    
  } catch (error) {
    logger.error('Port toggle failed:', error);
    res.status(500).json({ 
      error: 'Port toggle failed', 
      message: error.message 
    });
  }
});

router.get('/statistics/:host/:interface', async (req, res) => {
  try {
    const { host, interface: interfaceName } = req.params;
    const { username, password } = req.query;
    
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Username and password are required' 
      });
    }
    
    const result = await portService.getPortStatistics(host, username, password, interfaceName);
    
    res.json(result);
    
  } catch (error) {
    logger.error('Interface statistics retrieval failed:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve interface statistics', 
      message: error.message 
    });
  }
});

module.exports = router;
