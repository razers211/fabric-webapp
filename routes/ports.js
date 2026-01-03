const express = require('express');
const Joi = require('joi');
const logger = require('../utils/logger');
const switchManager = require('../services/switchManager');

const router = express.Router();

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
        then: Joi.string().required(),
        otherwise: Joi.forbidden()
      }),
      nativeVlan: Joi.when('portType', {
        is: 'trunk',
        then: Joi.number().integer().min(1).max(4094).default(1),
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
    
    await switchManager.connect(switchInfo);
    
    let config = 'system-view\n';
    
    portConfigurations.forEach(port => {
      config += `interface ${port.interface}\n`;
      
      if (port.description) {
        config += `description ${port.description}\n`;
      }
      
      config += `port link-type ${port.portType}\n`;
      
      if (port.portType === 'access') {
        config += `port default vlan ${port.vlan}\n`;
      } else if (port.portType === 'trunk') {
        config += `port trunk allow-pass vlan ${port.allowedVlans}\n`;
        if (port.nativeVlan) {
          config += `port trunk pvid vlan ${port.nativeVlan}\n`;
        }
      }
      
      if (port.enabled) {
        config += 'undo shutdown\n';
      } else {
        config += 'shutdown\n';
      }
      
      config += 'quit\n';
    });
    
    config += 'commit\n';
    config += 'quit\n';
    
    await switchManager.executeCommand(switchInfo.host, switchInfo.username, config);
    
    switchManager.disconnect(switchInfo.host, switchInfo.username);
    
    if (global.io) {
      global.io.emit('ports-configured', {
        switch: switchInfo.host,
        portCount: portConfigurations.length,
        status: 'completed'
      });
    }
    
    res.json({
      success: true,
      message: `Successfully configured ${portConfigurations.length} ports`,
      configuredPorts: portConfigurations.map(p => p.interface)
    });
    
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
    
    const switchInfo = { host, username, password };
    
    try {
      await switchManager.connect(switchInfo);
      
      const interfaceStatus = await switchManager.executeCommand(
        host, 
        username, 
        'display interface brief'
      );
      
      const portVlanInfo = await switchManager.executeCommand(
        host, 
        username, 
        'display port vlan'
      );
      
      switchManager.disconnect(host, username);
      
      const ports = parsePortStatus(interfaceStatus, portVlanInfo);
      
      res.json({
        host,
        ports
      });
      
    } catch (error) {
      res.status(500).json({
        host,
        error: 'Failed to retrieve port status',
        message: error.message
      });
    }
    
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
    const { host, interface: iface } = req.params;
    const { username, password, enabled } = req.body;
    
    if (!username || !password || typeof enabled !== 'boolean') {
      return res.status(400).json({ 
        error: 'Username, password, and enabled status are required' 
      });
    }
    
    const switchInfo = { host, username, password };
    
    await switchManager.connect(switchInfo);
    
    const config = `system-view\ninterface ${iface}\n${enabled ? 'undo shutdown' : 'shutdown'}\ncommit\nquit\n`;
    
    await switchManager.executeCommand(host, username, config);
    
    switchManager.disconnect(host, username);
    
    if (global.io) {
      global.io.emit('port-toggled', {
        switch: host,
        interface: iface,
        enabled,
        status: 'completed'
      });
    }
    
    res.json({
      success: true,
      message: `Interface ${iface} ${enabled ? 'enabled' : 'disabled'} successfully`
    });
    
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
    const { host, interface: iface } = req.params;
    const { username, password } = req.query;
    
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Username and password are required' 
      });
    }
    
    const switchInfo = { host, username, password };
    
    try {
      await switchManager.connect(switchInfo);
      
      const interfaceStats = await switchManager.executeCommand(
        host, 
        username, 
        `display interface ${iface}`
      );
      
      switchManager.disconnect(host, username);
      
      const stats = parseInterfaceStatistics(interfaceStats);
      
      res.json({
        host,
        interface: iface,
        statistics: stats
      });
      
    } catch (error) {
      res.status(500).json({
        host,
        interface: iface,
        error: 'Failed to retrieve interface statistics',
        message: error.message
      });
    }
    
  } catch (error) {
    logger.error('Interface statistics retrieval failed:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve interface statistics', 
      message: error.message 
    });
  }
});

function parsePortStatus(interfaceStatus, portVlanInfo) {
  const ports = [];
  const interfaceLines = interfaceStatus.split('\n');
  const vlanLines = portVlanInfo.split('\n');
  
  const portVlans = {};
  vlanLines.forEach(line => {
    const match = line.match(/(\S+)\s+(\d+)\s+(\S+)/);
    if (match) {
      const port = match[1];
      const vlan = match[2];
      const type = match[3];
      portVlans[port] = { vlan: parseInt(vlan), type };
    }
  });
  
  interfaceLines.forEach(line => {
    const match = line.match(/(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/);
    if (match) {
      const interface = match[1];
      const status = match[2];
      const protocol = match[3];
      const speed = match[4];
      const duplex = match[5];
      
      const vlanInfo = portVlans[interface] || { vlan: null, type: 'unknown' };
      
      ports.push({
        interface,
        status: status.toLowerCase(),
        protocol: protocol.toLowerCase(),
        speed,
        duplex,
        vlan: vlanInfo.vlan,
        type: vlanInfo.type,
        enabled: status.toLowerCase() === 'up'
      });
    }
  });
  
  return ports;
}

function parseInterfaceStatistics(interfaceStats) {
  const stats = {};
  const lines = interfaceStats.split('\n');
  
  lines.forEach(line => {
    if (line.includes('Input:')) {
      const inputMatch = line.match(/Input:\s+(\d+)\s+bytes,\s+(\d+)\s+packets/);
      if (inputMatch) {
        stats.inputBytes = parseInt(inputMatch[1]);
        stats.inputPackets = parseInt(inputMatch[2]);
      }
    }
    
    if (line.includes('Output:')) {
      const outputMatch = line.match(/Output:\s+(\d+)\s+bytes,\s+(\d+)\s+packets/);
      if (outputMatch) {
        stats.outputBytes = parseInt(outputMatch[1]);
        stats.outputPackets = parseInt(outputMatch[2]);
      }
    }
    
    if (line.includes('Input errors:')) {
      const inputErrorsMatch = line.match(/Input errors:\s+(\d+)/);
      if (inputErrorsMatch) {
        stats.inputErrors = parseInt(inputErrorsMatch[1]);
      }
    }
    
    if (line.includes('Output errors:')) {
      const outputErrorsMatch = line.match(/Output errors:\s+(\d+)/);
      if (outputErrorsMatch) {
        stats.outputErrors = parseInt(outputErrorsMatch[1]);
      }
    }
  });
  
  return stats;
}

module.exports = router;
