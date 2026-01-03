const { Client } = require('ssh2');
const logger = require('../utils/logger');

class SwitchManager {
  constructor() {
    this.connections = new Map();
  }

  async connect(switchInfo) {
    const { host, username, password } = switchInfo;
    const key = `${host}:${username}`;
    
    return new Promise((resolve, reject) => {
      const conn = new Client();
      
      conn.on('ready', () => {
        logger.info(`Connected to switch ${host}`);
        this.connections.set(key, conn);
        resolve(conn);
      });
      
      conn.on('error', (err) => {
        logger.error(`SSH connection error to ${host}:`, err);
        reject(err);
      });
      
      conn.connect({
        host,
        port: 22,
        username,
        password,
        readyTimeout: parseInt(process.env.SSH_TIMEOUT) || 30000
      });
    });
  }

  async executeCommand(host, username, command) {
    const key = `${host}:${username}`;
    const conn = this.connections.get(key);
    
    if (!conn) {
      throw new Error(`No connection found for ${key}`);
    }
    
    return new Promise((resolve, reject) => {
      conn.exec(command, (err, stream) => {
        if (err) {
          logger.error(`Command execution error on ${host}:`, err);
          reject(err);
          return;
        }
        
        let output = '';
        let error = '';
        
        stream.on('close', (code) => {
          if (code === 0) {
            resolve(output);
          } else {
            reject(new Error(`Command failed with code ${code}: ${error}`));
          }
        });
        
        stream.on('data', (data) => {
          output += data.toString();
        });
        
        stream.stderr.on('data', (data) => {
          error += data.toString();
        });
      });
    });
  }

  async configureSpineLeaf(deploymentConfig) {
    const { spineSwitches, leafSwitches, vlans, underlayProtocol } = deploymentConfig;
    const results = [];
    
    try {
      for (const spine of spineSwitches) {
        await this.connect(spine);
        const config = this.generateSpineConfig(spine, leafSwitches, vlans, underlayProtocol);
        await this.executeCommand(spine.host, spine.username, config);
        results.push({ switch: spine.host, status: 'success', type: 'spine' });
        
        if (global.io) {
          global.io.emit('deployment-progress', {
            switch: spine.host,
            type: 'spine',
            status: 'completed'
          });
        }
      }
      
      for (const leaf of leafSwitches) {
        await this.connect(leaf);
        const config = this.generateLeafConfig(leaf, spineSwitches, vlans, underlayProtocol);
        await this.executeCommand(leaf.host, leaf.username, config);
        results.push({ switch: leaf.host, status: 'success', type: 'leaf' });
        
        if (global.io) {
          global.io.emit('deployment-progress', {
            switch: leaf.host,
            type: 'leaf',
            status: 'completed'
          });
        }
      }
      
      return results;
    } catch (error) {
      logger.error('Spine-leaf deployment failed:', error);
      throw error;
    }
  }

  generateSpineConfig(spine, leafSwitches, vlans, protocol) {
    let config = 'system-view\n';
    
    config += `sysname ${spine.name || 'Spine'}\n`;
    
    leafSwitches.forEach((leaf, index) => {
      const interfaceNum = index + 1;
      config += `interface 10GE ${interfaceNum}/0/1\n`;
      config += `description Link-to-${leaf.name || `Leaf${interfaceNum}`}\n`;
      
      if (protocol === 'ospf') {
        config += 'ip address 10.0.' + (index + 1) + '.1 255.255.255.252\n';
        config += 'ospf enable 1\n';
      } else if (protocol === 'bgp') {
        config += 'ip address 10.0.' + (index + 1) + '.1 255.255.255.252\n';
      }
      
      config += 'undo shutdown\n';
      config += 'quit\n';
    });
    
    if (protocol === 'bgp') {
      config += 'bgp 65000\n';
      config += 'router-id ' + spine.host.split('.').slice(-2).join('.') + '\n';
      leafSwitches.forEach((leaf, index) => {
        config += 'peer 10.0.' + (index + 1) + '.2 as-number 65001\n';
      });
      config += 'quit\n';
    } else if (protocol === 'ospf') {
      config += 'ospf 1\n';
      config += 'area 0.0.0.0\n';
      leafSwitches.forEach((leaf, index) => {
        config += 'network 10.0.' + (index + 1) + '.0 0.0.0.3\n';
      });
      config += 'quit\n';
      config += 'quit\n';
    }
    
    config += 'commit\n';
    config += 'quit\n';
    
    return config;
  }

  generateLeafConfig(leaf, spineSwitches, vlans, protocol) {
    let config = 'system-view\n';
    
    config += `sysname ${leaf.name || 'Leaf'}\n`;
    
    spineSwitches.forEach((spine, index) => {
      const interfaceNum = index + 1;
      config += `interface 10GE ${interfaceNum}/0/1\n`;
      config += `description Link-to-${spine.name || `Spine${interfaceNum}`}\n`;
      
      if (protocol === 'ospf') {
        config += 'ip address 10.0.' + (index + 1) + '.2 255.255.255.252\n';
        config += 'ospf enable 1\n';
      } else if (protocol === 'bgp') {
        config += 'ip address 10.0.' + (index + 1) + '.2 255.255.255.252\n';
      }
      
      config += 'undo shutdown\n';
      config += 'quit\n';
    });
    
    if (protocol === 'bgp') {
      config += 'bgp 65001\n';
      config += 'router-id ' + leaf.host.split('.').slice(-2).join('.') + '\n';
      spineSwitches.forEach((spine, index) => {
        config += 'peer 10.0.' + (index + 1) + '.1 as-number 65000\n';
      });
      config += 'quit\n';
    } else if (protocol === 'ospf') {
      config += 'ospf 1\n';
      config += 'area 0.0.0.0\n';
      spineSwitches.forEach((spine, index) => {
        config += 'network 10.0.' + (index + 1) + '.0 0.0.0.3\n';
      });
      config += 'quit\n';
      config += 'quit\n';
    }
    
    vlans.forEach(vlan => {
      config += `vlan ${vlan.id}\n`;
      config += `description ${vlan.description || `VLAN-${vlan.id}`}\n`;
      config += 'quit\n';
    });
    
    config += 'commit\n';
    config += 'quit\n';
    
    return config;
  }

  async configureTenantPorts(switchInfo, tenantConfig) {
    const { host, username } = switchInfo;
    const { tenantName, vlans, accessPorts } = tenantConfig;
    
    try {
      await this.connect(switchInfo);
      
      let config = 'system-view\n';
      
      vlans.forEach(vlan => {
        config += `vlan ${vlan}\n`;
        config += `description Tenant-${tenantName}-VLAN-${vlan}\n`;
        config += 'quit\n';
      });
      
      accessPorts.forEach(port => {
        config += `interface ${port.interface}\n`;
        config += `description Tenant-${tenantName}-${port.description || 'Access'}\n`;
        config += 'port link-type access\n';
        config += `port default vlan ${port.vlan}\n`;
        config += 'undo shutdown\n';
        config += 'quit\n';
      });
      
      config += 'commit\n';
      config += 'quit\n';
      
      await this.executeCommand(host, username, config);
      
      return { success: true, message: `Tenant ${tenantName} configured successfully` };
    } catch (error) {
      logger.error(`Tenant configuration failed for ${host}:`, error);
      throw error;
    }
  }

  disconnect(host, username) {
    const key = `${host}:${username}`;
    const conn = this.connections.get(key);
    
    if (conn) {
      conn.end();
      this.connections.delete(key);
      logger.info(`Disconnected from ${host}`);
    }
  }

  disconnectAll() {
    this.connections.forEach((conn, key) => {
      conn.end();
      logger.info(`Disconnected from ${key}`);
    });
    this.connections.clear();
  }
}

module.exports = new SwitchManager();
