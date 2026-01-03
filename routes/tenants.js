const express = require('express');
const Joi = require('joi');
const logger = require('../utils/logger');
const switchManager = require('../services/switchManager');

const router = express.Router();

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
        description: Joi.string().optional()
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
    
    const result = await switchManager.configureTenantPorts(
      value.switchInfo, 
      value.tenantConfig
    );
    
    if (global.io) {
      global.io.emit('tenant-configured', {
        tenant: value.tenantConfig.tenantName,
        switch: value.switchInfo.host,
        status: 'completed'
      });
    }
    
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
    
    const switchInfo = { host, username, password };
    
    try {
      await switchManager.connect(switchInfo);
      const vlanInfo = await switchManager.executeCommand(host, username, 'display vlan');
      const interfaceInfo = await switchManager.executeCommand(host, username, 'display port vlan');
      
      switchManager.disconnect(host, username);
      
      const tenants = parseTenantInfo(vlanInfo, interfaceInfo);
      
      res.json({
        host,
        tenants
      });
      
    } catch (error) {
      res.status(500).json({
        host,
        error: 'Failed to retrieve tenant information',
        message: error.message
      });
    }
    
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
    
    const switchInfo = { host, username, password };
    
    try {
      await switchManager.connect(switchInfo);
      
      const vlanInfo = await switchManager.executeCommand(host, username, 'display vlan');
      const tenantVlans = extractTenantVlans(vlanInfo, tenantName);
      
      let config = 'system-view\n';
      
      tenantVlans.forEach(vlan => {
        config += `undo vlan ${vlan}\n`;
      });
      
      const interfaceInfo = await switchManager.executeCommand(host, username, 'display port vlan');
      const tenantPorts = extractTenantPorts(interfaceInfo, tenantVlans);
      
      tenantPorts.forEach(port => {
        config += `interface ${port}\n`;
        config += 'undo port link-type\n';
        config += 'undo port default vlan\n';
        config += 'shutdown\n';
        config += 'quit\n';
      });
      
      config += 'commit\n';
      config += 'quit\n';
      
      await switchManager.executeCommand(host, username, config);
      
      switchManager.disconnect(host, username);
      
      if (global.io) {
        global.io.emit('tenant-removed', {
          tenant: tenantName,
          switch: host,
          status: 'completed'
        });
      }
      
      res.json({
        success: true,
        message: `Tenant ${tenantName} removed successfully`,
        removedVlans: tenantVlans,
        removedPorts: tenantPorts
      });
      
    } catch (error) {
      res.status(500).json({
        error: 'Failed to remove tenant',
        message: error.message
      });
    }
    
  } catch (error) {
    logger.error('Tenant removal failed:', error);
    res.status(500).json({ 
      error: 'Tenant removal failed', 
      message: error.message 
    });
  }
});

function parseTenantInfo(vlanInfo, interfaceInfo) {
  const tenants = [];
  const vlanLines = vlanInfo.split('\n');
  const interfaceLines = interfaceInfo.split('\n');
  
  const vlans = {};
  vlanLines.forEach(line => {
    const match = line.match(/(\d+)\s+(.+?)\s+/);
    if (match) {
      const vlanId = match[1];
      const description = match[2];
      if (description.includes('Tenant-')) {
        const tenantName = description.split('Tenant-')[1].split('-VLAN')[0];
        if (!vlans[tenantName]) {
          vlans[tenantName] = { name: tenantName, vlans: [], ports: [] };
        }
        vlans[tenantName].vlans.push(parseInt(vlanId));
      }
    }
  });
  
  interfaceLines.forEach(line => {
    const match = line.match(/(\S+)\s+(\d+)/);
    if (match) {
      const port = match[1];
      const vlanId = parseInt(match[2]);
      
      Object.keys(vlans).forEach(tenantName => {
        if (vlans[tenantName].vlans.includes(vlanId)) {
          vlans[tenantName].ports.push(port);
        }
      });
    }
  });
  
  return Object.values(vlans);
}

function extractTenantVlans(vlanInfo, tenantName) {
  const vlans = [];
  const lines = vlanInfo.split('\n');
  
  lines.forEach(line => {
    const match = line.match(/(\d+)\s+Tenant-${tenantName}-VLAN-/);
    if (match) {
      vlans.push(parseInt(match[1]));
    }
  });
  
  return vlans;
}

function extractTenantPorts(interfaceInfo, tenantVlans) {
  const ports = [];
  const lines = interfaceInfo.split('\n');
  
  lines.forEach(line => {
    const match = line.match(/(\S+)\s+(\d+)/);
    if (match) {
      const port = match[1];
      const vlanId = parseInt(match[2]);
      
      if (tenantVlans.includes(vlanId)) {
        ports.push(port);
      }
    }
  });
  
  return [...new Set(ports)];
}

module.exports = router;
