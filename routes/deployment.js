const express = require('express');
const Joi = require('joi');
const logger = require('../utils/logger');
const HuaweiService = require('../services/huaweiService');

const router = express.Router();
const huaweiService = new HuaweiService();

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
    
    // Get socket instance for real-time updates
    const socket = req.app.get('socket');
    
    const results = await huaweiService.configureSpineLeaf(value, socket);
    
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

    const allSwitches = [...value.spineSwitches, ...value.leafSwitches];
    const connectivityResults = await huaweiService.validateConnectivity(allSwitches);
    
    const allReachable = connectivityResults.every(r => r.success);
    
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
    
    const status = await huaweiService.getSwitchStatus(host, username, password);
    
    res.json(status);
    
  } catch (error) {
    logger.error('Status check failed:', error);
    res.status(500).json({ 
      error: 'Status check failed', 
      message: error.message 
    });
  }
});

module.exports = router;
