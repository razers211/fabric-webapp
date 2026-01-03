const SSHService = require('./sshService');
const winston = require('winston');

class PortService {
  constructor() {
    this.sshService = new SSHService();
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/port.log' }),
        new winston.transports.Console()
      ]
    });
  }

  async configurePorts(switchConfig, portConfigs, socket) {
    let connectionId;
    try {
      connectionId = await this.sshService.connect(switchConfig.host, switchConfig.username, switchConfig.password);
      
      await this.sshService.configureSystemView(connectionId);
      
      const results = [];
      
      for (const portConfig of portConfigs) {
        try {
          await this.configureSinglePort(connectionId, portConfig);
          
          results.push({
            interface: portConfig.interface,
            status: 'success',
            message: 'Port configured successfully'
          });
          
          // Emit real-time update
          if (socket) {
            socket.emit('port-configured', {
              switch: switchConfig.host,
              interface: portConfig.interface,
              status: 'success'
            });
          }
          
        } catch (error) {
          results.push({
            interface: portConfig.interface,
            status: 'error',
            message: error.message
          });
          
          if (socket) {
            socket.emit('port-configured', {
              switch: switchConfig.host,
              interface: portConfig.interface,
              status: 'error',
              error: error.message
            });
          }
        }
      }
      
      await this.sshService.commitConfiguration(connectionId);
      await this.sshService.exitSystemView(connectionId);
      
      // Emit batch completion
      if (socket) {
        socket.emit('ports-configured', {
          switch: switchConfig.host,
          portCount: portConfigs.length,
          successCount: results.filter(r => r.status === 'success').length
        });
      }
      
      this.logger.info(`Configured ${portConfigs.length} ports on ${switchConfig.host}`);
      
      return {
        success: true,
        switch: switchConfig.host,
        totalPorts: portConfigs.length,
        results
      };
      
    } catch (error) {
      this.logger.error(`Failed to configure ports on ${switchConfig.host}:`, error);
      throw error;
    } finally {
      if (connectionId) {
        await this.sshService.disconnect(connectionId);
      }
    }
  }

  async configureSinglePort(connectionId, portConfig) {
    await this.sshService.executeCommand(connectionId, `interface ${portConfig.interface}`);
    
    // Set description
    if (portConfig.description) {
      await this.sshService.executeCommand(connectionId, `description ${portConfig.description}`);
    }
    
    // Configure based on port type
    switch (portConfig.portType) {
      case 'access':
        await this.configureAccessPort(connectionId, portConfig);
        break;
      case 'trunk':
        await this.configureTrunkPort(connectionId, portConfig);
        break;
      case 'hybrid':
        await this.configureHybridPort(connectionId, portConfig);
        break;
    }
    
    // Enable/disable port
    if (portConfig.enabled !== false) {
      await this.sshService.executeCommand(connectionId, 'undo shutdown');
    } else {
      await this.sshService.executeCommand(connectionId, 'shutdown');
    }
    
    await this.sshService.executeCommand(connectionId, 'quit');
  }

  async configureAccessPort(connectionId, portConfig) {
    await this.sshService.executeCommand(connectionId, 'port link-type access');
    await this.sshService.executeCommand(connectionId, `port default vlan ${portConfig.vlan}`);
  }

  async configureTrunkPort(connectionId, portConfig) {
    await this.sshService.executeCommand(connectionId, 'port link-type trunk');
    
    if (portConfig.allowedVlans && portConfig.allowedVlans.length > 0) {
      const vlanList = portConfig.allowedVlans.join(',');
      await this.sshService.executeCommand(connectionId, `port trunk allow-pass vlan ${vlanList}`);
    }
    
    if (portConfig.nativeVlan) {
      await this.sshService.executeCommand(connectionId, `port trunk pvid vlan ${portConfig.nativeVlan}`);
    }
  }

  async configureHybridPort(connectionId, portConfig) {
    await this.sshService.executeCommand(connectionId, 'port link-type hybrid');
    
    if (portConfig.taggedVlans && portConfig.taggedVlans.length > 0) {
      const vlanList = portConfig.taggedVlans.join(',');
      await this.sshService.executeCommand(connectionId, `port hybrid tagged vlan ${vlanList}`);
    }
    
    if (portConfig.untaggedVlans && portConfig.untaggedVlans.length > 0) {
      const vlanList = portConfig.untaggedVlans.join(',');
      await this.sshService.executeCommand(connectionId, `port hybrid untagged vlan ${vlanList}`);
    }
    
    if (portConfig.nativeVlan) {
      await this.sshService.executeCommand(connectionId, `port hybrid pvid vlan ${portConfig.nativeVlan}`);
    }
  }

  async getPortStatus(host, username, password) {
    let connectionId;
    try {
      connectionId = await this.sshService.connect(host, username, password);
      
      // Get interface brief information
      const interfaceResult = await this.sshService.executeCommand(connectionId, 'display interface brief');
      const portResult = await this.sshService.executeCommand(connectionId, 'display port vlan');
      
      const ports = this.parsePortStatus(interfaceResult.output, portResult.output);
      
      return {
        host,
        ports,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      this.logger.error(`Failed to get port status from ${host}:`, error);
      throw error;
    } finally {
      if (connectionId) {
        await this.sshService.disconnect(connectionId);
      }
    }
  }

  async togglePort(host, username, password, interfaceName, enabled) {
    let connectionId;
    try {
      connectionId = await this.sshService.connect(host, username, password);
      
      await this.sshService.configureSystemView(connectionId);
      
      await this.sshService.executeCommand(connectionId, `interface ${interfaceName}`);
      
      if (enabled) {
        await this.sshService.executeCommand(connectionId, 'undo shutdown');
      } else {
        await this.sshService.executeCommand(connectionId, 'shutdown');
      }
      
      await this.sshService.executeCommand(connectionId, 'quit');
      await this.sshService.commitConfiguration(connectionId);
      await this.sshService.exitSystemView(connectionId);
      
      this.logger.info(`Port ${interfaceName} ${enabled ? 'enabled' : 'disabled'} on ${host}`);
      
      return {
        success: true,
        host,
        interface: interfaceName,
        status: enabled ? 'up' : 'down'
      };
      
    } catch (error) {
      this.logger.error(`Failed to toggle port ${interfaceName} on ${host}:`, error);
      throw error;
    } finally {
      if (connectionId) {
        await this.sshService.disconnect(connectionId);
      }
    }
  }

  async getPortStatistics(host, username, password, interfaceName) {
    let connectionId;
    try {
      connectionId = await this.sshService.connect(host, username, password);
      
      const statsResult = await this.sshService.executeCommand(connectionId, `display interface ${interfaceName}`);
      
      const statistics = this.parseInterfaceStatistics(statsResult.output);
      
      return {
        host,
        interface: interfaceName,
        statistics,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      this.logger.error(`Failed to get port statistics for ${interfaceName} on ${host}:`, error);
      throw error;
    } finally {
      if (connectionId) {
        await this.sshService.disconnect(connectionId);
      }
    }
  }

  parsePortStatus(interfaceOutput, portVlanOutput) {
    const ports = [];
    const interfaceLines = interfaceOutput.split('\n');
    const portVlanLines = portVlanOutput.split('\n');
    
    // Parse interface information
    const interfaceMap = new Map();
    
    for (const line of interfaceLines) {
      if (line.includes('10GE') || line.includes('GE') || line.includes('XGigabitEthernet')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3) {
          const interfaceName = parts[0];
          const physicalStatus = parts[1];
          const protocolStatus = parts[2];
          
          interfaceMap.set(interfaceName, {
            interface: interfaceName,
            physicalStatus,
            protocolStatus,
            portType: 'unknown',
            vlan: null,
            description: ''
          });
        }
      }
    }
    
    // Parse VLAN information
    for (const line of portVlanLines) {
      if (line.includes('10GE') || line.includes('GE') || line.includes('XGigabitEthernet')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          const interfaceName = parts[0];
          const vlanInfo = parts.slice(1);
          
          const portInfo = interfaceMap.get(interfaceName);
          if (portInfo) {
            // Determine port type and VLAN assignment
            if (vlanInfo.includes('access')) {
              portInfo.portType = 'access';
              const vlanMatch = vlanInfo.find(part => /^\d+$/.test(part));
              if (vlanMatch) {
                portInfo.vlan = parseInt(vlanMatch);
              }
            } else if (vlanInfo.includes('trunk')) {
              portInfo.portType = 'trunk';
              portInfo.allowedVlans = vlanInfo.filter(part => /^\d+$/.test(part)).map(v => parseInt(v));
            }
          }
        }
      }
    }
    
    return Array.from(interfaceMap.values());
  }

  parseInterfaceStatistics(statsOutput) {
    const statistics = {
      input: {
        bytes: 0,
        packets: 0,
        errors: 0,
        drops: 0
      },
      output: {
        bytes: 0,
        packets: 0,
        errors: 0,
        drops: 0
      },
      utilization: 0
    };
    
    const lines = statsOutput.split('\n');
    
    for (const line of lines) {
      if (line.includes('Input')) {
        const inputMatch = line.match(/Input:\s*(\d+)\s*bytes,\s*(\d+)\s*packets/);
        if (inputMatch) {
          statistics.input.bytes = parseInt(inputMatch[1]);
          statistics.input.packets = parseInt(inputMatch[2]);
        }
        
        const errorMatch = line.match(/(\d+)\s*input errors/);
        if (errorMatch) {
          statistics.input.errors = parseInt(errorMatch[1]);
        }
      }
      
      if (line.includes('Output')) {
        const outputMatch = line.match(/Output:\s*(\d+)\s*bytes,\s*(\d+)\s*packets/);
        if (outputMatch) {
          statistics.output.bytes = parseInt(outputMatch[1]);
          statistics.output.packets = parseInt(outputMatch[2]);
        }
        
        const errorMatch = line.match(/(\d+)\s*output errors/);
        if (errorMatch) {
          statistics.output.errors = parseInt(errorMatch[1]);
        }
      }
      
      if (line.includes('Utilization')) {
        const utilMatch = line.match(/Utilization:\s*(\d+)%/);
        if (utilMatch) {
          statistics.utilization = parseInt(utilMatch[1]);
        }
      }
    }
    
    return statistics;
  }
}

module.exports = PortService;
