const SSHService = require('./sshService');
const winston = require('winston');

class HuaweiService {
  constructor() {
    this.sshService = new SSHService();
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/huawei.log' }),
        new winston.transports.Console()
      ]
    });
  }

  async configureSpineLeaf(config, socket) {
    const results = [];
    
    try {
      // Configure spine switches
      for (const spine of config.spineSwitches) {
        try {
          const result = await this.configureSpineSwitch(spine, config.leafSwitches, config.vlans, config.underlayProtocol);
          results.push(result);
          
          if (socket) {
            socket.emit('deployment-progress', {
              switch: spine.host,
              type: 'spine',
              status: result.success ? 'success' : 'error',
              message: result.message
            });
          }
        } catch (error) {
          const errorResult = {
            switch: spine.host,
            type: 'spine',
            status: 'error',
            message: error.message
          };
          results.push(errorResult);
          
          if (socket) {
            socket.emit('deployment-progress', errorResult);
          }
        }
      }

      // Configure leaf switches
      for (const leaf of config.leafSwitches) {
        try {
          const result = await this.configureLeafSwitch(leaf, config.spineSwitches, config.vlans, config.underlayProtocol);
          results.push(result);
          
          if (socket) {
            socket.emit('deployment-progress', {
              switch: leaf.host,
              type: 'leaf',
              status: result.success ? 'success' : 'error',
              message: result.message
            });
          }
        } catch (error) {
          const errorResult = {
            switch: leaf.host,
            type: 'leaf',
            status: 'error',
            message: error.message
          };
          results.push(errorResult);
          
          if (socket) {
            socket.emit('deployment-progress', errorResult);
          }
        }
      }

    } catch (error) {
      this.logger.error('Spine-leaf deployment failed:', error);
      throw error;
    }

    return results;
  }

  async configureSpineSwitch(spine, leafSwitches, vlans, underlayProtocol) {
    let connectionId;
    try {
      connectionId = await this.sshService.connect(spine.host, spine.username, spine.password);
      
      await this.sshService.configureSystemView(connectionId);
      
      // Set hostname
      await this.sshService.executeCommand(connectionId, `sysname ${spine.name || 'Spine-1'}`);
      
      // Configure interfaces for leaf connections
      let interfaceIndex = 1;
      for (const leaf of leafSwitches) {
        const interfaceName = `10GE1/0/${interfaceIndex}`;
        const ipAddress = this.generateIpAddress('spine', interfaceIndex, leafSwitches.indexOf(leaf));
        
        await this.sshService.executeCommand(connectionId, `interface ${interfaceName}`);
        await this.sshService.executeCommand(connectionId, `description Link-to-${leaf.name || 'Leaf-' + (leafSwitches.indexOf(leaf) + 1)}`);
        await this.sshService.executeCommand(connectionId, `ip address ${ipAddress} 255.255.255.252`);
        await this.sshService.executeCommand(connectionId, `undo shutdown`);
        
        if (underlayProtocol === 'ospf') {
          await this.sshService.executeCommand(connectionId, `ospf enable 1`);
        } else if (underlayProtocol === 'bgp') {
          await this.sshService.executeCommand(connectionId, `bgp enable`);
        }
        
        await this.sshService.executeCommand(connectionId, 'quit');
        interfaceIndex++;
      }
      
      // Configure routing protocol
      if (underlayProtocol === 'ospf') {
        await this.configureOSPF(connectionId, 'spine', interfaceIndex - 1);
      } else if (underlayProtocol === 'bgp') {
        await this.configureBGP(connectionId, 'spine', spine);
      }
      
      // Configure VLANs
      for (const vlan of vlans) {
        await this.sshService.executeCommand(connectionId, `vlan ${vlan.id}`);
        await this.sshService.executeCommand(connectionId, `description ${vlan.description || `VLAN-${vlan.id}`}`);
        await this.sshService.executeCommand(connectionId, 'quit');
      }
      
      await this.sshService.commitConfiguration(connectionId);
      await this.sshService.exitSystemView(connectionId);
      
      return {
        success: true,
        switch: spine.host,
        message: 'Spine switch configured successfully'
      };
      
    } catch (error) {
      this.logger.error(`Failed to configure spine switch ${spine.host}:`, error);
      throw error;
    } finally {
      if (connectionId) {
        await this.sshService.disconnect(connectionId);
      }
    }
  }

  async configureLeafSwitch(leaf, spineSwitches, vlans, underlayProtocol) {
    let connectionId;
    try {
      connectionId = await this.sshService.connect(leaf.host, leaf.username, leaf.password);
      
      await this.sshService.configureSystemView(connectionId);
      
      // Set hostname
      await this.sshService.executeCommand(connectionId, `sysname ${leaf.name || 'Leaf-1'}`);
      
      // Configure interfaces for spine connections
      let interfaceIndex = 1;
      for (const spine of spineSwitches) {
        const interfaceName = `10GE1/0/${interfaceIndex}`;
        const ipAddress = this.generateIpAddress('leaf', interfaceIndex, spineSwitches.indexOf(spine));
        
        await this.sshService.executeCommand(connectionId, `interface ${interfaceName}`);
        await this.sshService.executeCommand(connectionId, `description Link-to-${spine.name || 'Spine-' + (spineSwitches.indexOf(spine) + 1)}`);
        await this.sshService.executeCommand(connectionId, `ip address ${ipAddress} 255.255.255.252`);
        await this.sshService.executeCommand(connectionId, `undo shutdown`);
        
        if (underlayProtocol === 'ospf') {
          await this.sshService.executeCommand(connectionId, `ospf enable 1`);
        } else if (underlayProtocol === 'bgp') {
          await this.sshService.executeCommand(connectionId, `bgp enable`);
        }
        
        await this.sshService.executeCommand(connectionId, 'quit');
        interfaceIndex++;
      }
      
      // Configure routing protocol
      if (underlayProtocol === 'ospf') {
        await this.configureOSPF(connectionId, 'leaf', interfaceIndex - 1);
      } else if (underlayProtocol === 'bgp') {
        await this.configureBGP(connectionId, 'leaf', leaf);
      }
      
      // Configure VLANs
      for (const vlan of vlans) {
        await this.sshService.executeCommand(connectionId, `vlan ${vlan.id}`);
        await this.sshService.executeCommand(connectionId, `description ${vlan.description || `VLAN-${vlan.id}`}`);
        await this.sshService.executeCommand(connectionId, 'quit');
      }
      
      await this.sshService.commitConfiguration(connectionId);
      await this.sshService.exitSystemView(connectionId);
      
      return {
        success: true,
        switch: leaf.host,
        message: 'Leaf switch configured successfully'
      };
      
    } catch (error) {
      this.logger.error(`Failed to configure leaf switch ${leaf.host}:`, error);
      throw error;
    } finally {
      if (connectionId) {
        await this.sshService.disconnect(connectionId);
      }
    }
  }

  async configureOSPF(connectionId, switchType, interfaceCount) {
    await this.sshService.executeCommand(connectionId, 'ospf 1');
    await this.sshService.executeCommand(connectionId, 'area 0.0.0.0');
    
    // Add networks for each interface
    for (let i = 1; i <= interfaceCount; i++) {
      const network = this.generateNetworkAddress(switchType, i);
      await this.sshService.executeCommand(connectionId, `network ${network} 0.0.0.3`);
    }
    
    await this.sshService.executeCommand(connectionId, 'quit');
  }

  async configureBGP(connectionId, switchType, switchConfig) {
    const asn = switchType === 'spine' ? 65001 : 65002; // Different ASNs for spine and leaf
    
    await this.sshService.executeCommand(connectionId, `bgp ${asn}`);
    await this.sshService.executeCommand(connectionId, `router-id ${switchConfig.host}`);
    
    if (switchType === 'spine') {
      // Spine switches configure peer relationships with all leaf switches
      // This would be implemented based on the actual leaf switch IPs
    } else {
      // Leaf switches configure peer relationships with spine switches
      // This would be implemented based on the actual spine switch IPs
    }
    
    await this.sshService.executeCommand(connectionId, 'quit');
  }

  generateIpAddress(switchType, interfaceIndex, peerIndex) {
    // Generate IP addresses for point-to-point links
    // Example: 10.0.1.1/30 for spine, 10.0.1.2/30 for leaf
    const subnetBase = 10 + peerIndex;
    if (switchType === 'spine') {
      return `10.${subnetBase}.1.1`;
    } else {
      return `10.${subnetBase}.1.2`;
    }
  }

  generateNetworkAddress(switchType, interfaceIndex) {
    // Generate network address for OSPF
    return `10.${interfaceIndex}.1.0`;
  }

  async validateConnectivity(switches) {
    const results = [];
    
    for (const switchConfig of switches) {
      try {
        const result = await this.sshService.testConnection(
          switchConfig.host, 
          switchConfig.username, 
          switchConfig.password
        );
        
        results.push({
          host: switchConfig.host,
          success: result.success,
          message: result.success ? 'Connection successful' : result.error
        });
      } catch (error) {
        results.push({
          host: switchConfig.host,
          success: false,
          message: error.message
        });
      }
    }
    
    return results;
  }

  async getSwitchStatus(host, username, password) {
    let connectionId;
    try {
      connectionId = await this.sshService.connect(host, username, password);
      
      // Get system status
      const versionResult = await this.sshService.executeCommand(connectionId, 'display version');
      const interfaceResult = await this.sshService.executeCommand(connectionId, 'display interface brief');
      const vlanResult = await this.sshService.executeCommand(connectionId, 'display vlan');
      
      return {
        host,
        online: true,
        version: versionResult.output,
        interfaces: interfaceResult.output,
        vlans: vlanResult.output,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        host,
        online: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    } finally {
      if (connectionId) {
        await this.sshService.disconnect(connectionId);
      }
    }
  }
}

module.exports = HuaweiService;
