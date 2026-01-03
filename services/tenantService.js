const SSHService = require('./sshService');
const winston = require('winston');

class TenantService {
  constructor() {
    this.sshService = new SSHService();
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/tenant.log' }),
        new winston.transports.Console()
      ]
    });
  }

  async configureTenant(switchConfig, tenantConfig, socket) {
    let connectionId;
    try {
      connectionId = await this.sshService.connect(switchConfig.host, switchConfig.username, switchConfig.password);
      
      await this.sshService.configureSystemView(connectionId);
      
      // Create VLANs for tenant
      for (const vlanId of tenantConfig.vlans) {
        await this.sshService.executeCommand(connectionId, `vlan ${vlanId}`);
        await this.sshService.executeCommand(connectionId, `description ${tenantConfig.tenantName}-VLAN-${vlanId}`);
        await this.sshService.executeCommand(connectionId, 'quit');
      }
      
      // Configure access ports
      for (const port of tenantConfig.accessPorts) {
        await this.sshService.executeCommand(connectionId, `interface ${port.interface}`);
        await this.sshService.executeCommand(connectionId, `description ${port.description || `${tenantConfig.tenantName}-Port`}`);
        await this.sshService.executeCommand(connectionId, 'port link-type access');
        await this.sshService.executeCommand(connectionId, `port default vlan ${port.vlan}`);
        await this.sshService.executeCommand(connectionId, 'undo shutdown');
        await this.sshService.executeCommand(connectionId, 'quit');
      }
      
      await this.sshService.commitConfiguration(connectionId);
      await this.sshService.exitSystemView(connectionId);
      
      // Emit real-time update
      if (socket) {
        socket.emit('tenant-configured', {
          tenant: tenantConfig.tenantName,
          switch: switchConfig.host,
          vlans: tenantConfig.vlans.length,
          ports: tenantConfig.accessPorts.length
        });
      }
      
      this.logger.info(`Tenant ${tenantConfig.tenantName} configured on ${switchConfig.host}`);
      
      return {
        success: true,
        tenant: tenantConfig.tenantName,
        switch: switchConfig.host,
        vlansConfigured: tenantConfig.vlans.length,
        portsConfigured: tenantConfig.accessPorts.length
      };
      
    } catch (error) {
      this.logger.error(`Failed to configure tenant ${tenantConfig.tenantName} on ${switchConfig.host}:`, error);
      throw error;
    } finally {
      if (connectionId) {
        await this.sshService.disconnect(connectionId);
      }
    }
  }

  async getTenants(host, username, password) {
    let connectionId;
    try {
      connectionId = await this.sshService.connect(host, username, password);
      
      // Get VLAN information
      const vlanResult = await this.sshService.executeCommand(connectionId, 'display vlan');
      const interfaceResult = await this.sshService.executeCommand(connectionId, 'display interface brief');
      
      // Parse VLAN information to extract tenant information
      const tenants = this.parseTenantInfo(vlanResult.output, interfaceResult.output);
      
      return {
        host,
        tenants,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      this.logger.error(`Failed to get tenants from ${host}:`, error);
      throw error;
    } finally {
      if (connectionId) {
        await this.sshService.disconnect(connectionId);
      }
    }
  }

  async removeTenant(host, tenantName, username, password, socket) {
    let connectionId;
    try {
      connectionId = await this.sshService.connect(host, username, password);
      
      await this.sshService.configureSystemView(connectionId);
      
      // Get current VLANs to identify which belong to this tenant
      const vlanResult = await this.sshService.executeCommand(connectionId, 'display vlan');
      const tenantVlans = this.extractTenantVlans(vlanResult.output, tenantName);
      
      // Remove tenant VLANs
      for (const vlanId of tenantVlans) {
        await this.sshService.executeCommand(connectionId, `undo vlan ${vlanId}`);
      }
      
      // Get interfaces that reference this tenant's VLANs and reset them
      const interfaceResult = await this.sshService.executeCommand(connectionId, 'display interface brief');
      const tenantInterfaces = this.extractTenantInterfaces(interfaceResult.output, tenantVlans);
      
      for (const interfaceName of tenantInterfaces) {
        await this.sshService.executeCommand(connectionId, `interface ${interfaceName}`);
        await this.sshService.executeCommand(connectionId, 'undo description');
        await this.sshService.executeCommand(connectionId, 'undo port link-type');
        await this.sshService.executeCommand(connectionId, 'undo port default vlan');
        await this.sshService.executeCommand(connectionId, 'shutdown');
        await this.sshService.executeCommand(connectionId, 'quit');
      }
      
      await this.sshService.commitConfiguration(connectionId);
      await this.sshService.exitSystemView(connectionId);
      
      // Emit real-time update
      if (socket) {
        socket.emit('tenant-removed', {
          tenant: tenantName,
          switch: host,
          vlansRemoved: tenantVlans.length,
          portsReset: tenantInterfaces.length
        });
      }
      
      this.logger.info(`Tenant ${tenantName} removed from ${host}`);
      
      return {
        success: true,
        tenant: tenantName,
        switch: host,
        vlansRemoved: tenantVlans.length,
        portsReset: tenantInterfaces.length
      };
      
    } catch (error) {
      this.logger.error(`Failed to remove tenant ${tenantName} from ${host}:`, error);
      throw error;
    } finally {
      if (connectionId) {
        await this.sshService.disconnect(connectionId);
      }
    }
  }

  parseTenantInfo(vlanOutput, interfaceOutput) {
    const tenants = [];
    const vlanLines = vlanOutput.split('\n');
    const interfaceLines = interfaceOutput.split('\n');
    
    // Parse VLAN information
    const vlans = {};
    for (const line of vlanLines) {
      if (line.includes('VLAN') && !line.includes('VID')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3) {
          const vlanId = parts[0];
          const vlanName = parts[1];
          
          if (vlanName.includes('-')) {
            const tenantName = vlanName.split('-')[0];
            if (!vlans[tenantName]) {
              vlans[tenantName] = { name: tenantName, vlans: [], ports: [] };
            }
            vlans[tenantName].vlans.push(parseInt(vlanId));
          }
        }
      }
    }
    
    // Parse interface information
    for (const line of interfaceLines) {
      if (line.includes('10GE') || line.includes('GE')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          const interfaceName = parts[0];
          const status = parts[parts.length - 1];
          
          // Get detailed interface info to find VLAN assignment
          // This would require additional commands in a real implementation
          for (const tenantName in vlans) {
            if (status === 'up') {
              vlans[tenantName].ports.push({
                interface: interfaceName,
                status: status
              });
            }
          }
        }
      }
    }
    
    return Object.values(vlans);
  }

  extractTenantVlans(vlanOutput, tenantName) {
    const vlans = [];
    const lines = vlanOutput.split('\n');
    
    for (const line of lines) {
      if (line.includes(tenantName) && line.includes('VLAN')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 1) {
          const vlanId = parts.find(part => /^\d+$/.test(part));
          if (vlanId) {
            vlans.push(parseInt(vlanId));
          }
        }
      }
    }
    
    return vlans;
  }

  extractTenantInterfaces(interfaceOutput, vlanIds) {
    const interfaces = [];
    const lines = interfaceOutput.split('\n');
    
    for (const line of lines) {
      if (line.includes('10GE') || line.includes('GE')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 1) {
          const interfaceName = parts[0];
          interfaces.push(interfaceName);
        }
      }
    }
    
    return interfaces;
  }
}

module.exports = TenantService;
