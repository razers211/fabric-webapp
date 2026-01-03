const express = require('express');
const Joi = require('joi');
const logger = require('../utils/logger');
const switchManager = require('../services/switchManager');

const router = express.Router();

const deploymentSchema = Joi.object({
  spineSwitches: Joi.array().items(
    Joi.object({
      host: Joi.string().ip().required(),
      username: Joi.string().required(),
      password: Joi.string().required(),
      name: Joi.string().optional()
    })
  ).min(1).required(),
  leafSwitches: Joi.array().items(
    Joi.object({
      host: Joi.string().ip().required(),
      username: Joi.string().required(),
      password: Joi.string().required(),
      name: Joi.string().optional()
    })
  ).min(1).required(),
  vlans: Joi.array().items(
    Joi.object({
      id: Joi.number().integer().min(1).max(4094).required(),
      description: Joi.string().optional()
    })
  ).min(1).required(),
  underlayProtocol: Joi.string().valid('ospf', 'bgp').required()
});

router.post('/spine-leaf', async (req, res) => {
  try {
    const { error, value } = deploymentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details[0].message 
      });
    }

    logger.info('Starting spine-leaf deployment', { deployment: value });
    
    const results = await switchManager.configureSpineLeaf(value);
    
    res.json({ 
      success: true, 
      message: 'Spine-leaf deployment completed successfully',
      results 
    });
    
  } catch (error) {
    logger.error('Spine-leaf deployment failed:', error);
    res.status(500).json({ 
      error: 'Deployment failed', 
      message: error.message 
    });
  }
});

router.post('/validate', async (req, res) => {
  try {
    const { error, value } = deploymentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        valid: false, 
        error: error.details[0].message 
      });
    }

    const connectivityResults = [];
    
    for (const spine of value.spineSwitches) {
      try {
        await switchManager.connect(spine);
        connectivityResults.push({ 
          host: spine.host, 
          type: 'spine', 
          status: 'reachable' 
        });
        switchManager.disconnect(spine.host, spine.username);
      } catch (error) {
        connectivityResults.push({ 
          host: spine.host, 
          type: 'spine', 
          status: 'unreachable', 
          error: error.message 
        });
      }
    }
    
    for (const leaf of value.leafSwitches) {
      try {
        await switchManager.connect(leaf);
        connectivityResults.push({ 
          host: leaf.host, 
          type: 'leaf', 
          status: 'reachable' 
        });
        switchManager.disconnect(leaf.host, leaf.username);
      } catch (error) {
        connectivityResults.push({ 
          host: leaf.host, 
          type: 'leaf', 
          status: 'unreachable', 
          error: error.message 
        });
      }
    }
    
    const allReachable = connectivityResults.every(r => r.status === 'reachable');
    
    res.json({ 
      valid: allReachable, 
      connectivity: connectivityResults 
    });
    
  } catch (error) {
    logger.error('Validation failed:', error);
    res.status(500).json({ 
      error: 'Validation failed', 
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
    
    const switchInfo = { host, username, password };
    
    try {
      await switchManager.connect(switchInfo);
      const version = await switchManager.executeCommand(host, username, 'display version');
      const interfaces = await switchManager.executeCommand(host, username, 'display interface brief');
      
      switchManager.disconnect(host, username);
      
      res.json({
        host,
        status: 'online',
        version: version.trim(),
        interfaces: interfaces.trim()
      });
      
    } catch (error) {
      res.json({
        host,
        status: 'offline',
        error: error.message
      });
    }
    
  } catch (error) {
    logger.error('Status check failed:', error);
    res.status(500).json({ 
      error: 'Status check failed', 
      message: error.message 
    });
  }
});

module.exports = router;
