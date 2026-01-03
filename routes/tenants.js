const express = require('express');
const Joi = require('joi');
const logger = require('../utils/logger');
const TenantService = require('../services/tenantService');

const router = express.Router();
const tenantService = new TenantService();

const tenantConfigSchema = Joi.object({
  switchInfo: Joi.object({
    host: Joi.string().ip().required(),
    username: Joi.string().required(),
    password: Joi.string().required()
  }).required(),
  tenantConfig: Joi.object({
    tenantName: Joi.string().required(),
    vlans: Joi.array().items(Joi.number().integer().min(1).max(4094)).min(1).required(),
    accessPorts: Joi.array().items(
      Joi.object({
        interface: Joi.string().required(),
        vlan: Joi.number().integer().min(1).max(4094).required(),
        description: Joi.string().optional(),
        portType: Joi.string().valid('access', 'trunk', 'hybrid').default('access')
      })
    ).min(1).required()
  }).required()
});

router.post('/configure', async (req, res) => {
  try {
    const { error, value } = tenantConfigSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details[0].message 
      });
    }

    logger.info('Configuring tenant', { tenant: value.tenantConfig.tenantName });
    
    // Get socket instance for real-time updates
    const socket = req.app.get('socket');
    
    const result = await tenantService.configureTenant(
      value.switchInfo, 
      value.tenantConfig,
      socket
    );
    
    res.json(result);
    
  } catch (error) {
    logger.error('Tenant configuration failed:', error);
    res.status(500).json({ 
      error: 'Tenant configuration failed', 
      message: error.message 
    });
  }
});

router.get('/list/:host', async (req, res) => {
  try {
    const { host } = req.params;
    const { username, password } = req.query;
    
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Username and password are required' 
      });
    }
    
    const result = await tenantService.getTenants(host, username, password);
    
    res.json(result);
    
  } catch (error) {
    logger.error('Tenant list retrieval failed:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve tenant list', 
      message: error.message 
    });
  }
});

router.delete('/remove/:host/:tenantName', async (req, res) => {
  try {
    const { host, tenantName } = req.params;
    const { username, password } = req.query;
    
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Username and password are required' 
      });
    }
    
    // Get socket instance for real-time updates
    const socket = req.app.get('socket');
    
    const result = await tenantService.removeTenant(
      host, 
      tenantName, 
      username, 
      password,
      socket
    );
    
    res.json(result);
    
  } catch (error) {
    logger.error('Tenant removal failed:', error);
    res.status(500).json({ 
      error: 'Tenant removal failed', 
      message: error.message 
    });
  }
});

module.exports = router;
