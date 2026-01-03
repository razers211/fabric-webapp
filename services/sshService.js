const { Client } = require('ssh2');
const { EventEmitter } = require('events');
const winston = require('winston');

class SSHService extends EventEmitter {
  constructor() {
    super();
    this.connections = new Map();
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/ssh.log' }),
        new winston.transports.Console()
      ]
    });
  }

  async connect(host, username, password, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const client = new Client();
      const connectionId = `${host}-${Date.now()}`;

      const timeoutId = setTimeout(() => {
        client.destroy();
        reject(new Error(`Connection timeout to ${host}`));
      }, timeout);

      client.on('ready', () => {
        clearTimeout(timeoutId);
        this.connections.set(connectionId, client);
        this.logger.info(`Connected to ${host}`);
        resolve(connectionId);
      });

      client.on('error', (err) => {
        clearTimeout(timeoutId);
        this.logger.error(`SSH connection error to ${host}:`, err);
        reject(err);
      });

      client.connect({
        host,
        port: 22,
        username,
        password,
        algorithms: {
          kex: ['diffie-hellman-group-exchange-sha256', 'diffie-hellman-group14-sha256'],
          cipher: ['aes128-ctr', 'aes192-ctr', 'aes256-ctr'],
          serverHostKey: ['ssh-rsa', 'ecdsa-sha2-nistp256']
        },
        readyTimeout: timeout
      });
    });
  }

  async executeCommand(connectionId, command, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const client = this.connections.get(connectionId);
      if (!client) {
        reject(new Error('Connection not found'));
        return;
      }

      let output = '';
      let errorOutput = '';

      const timeoutId = setTimeout(() => {
        reject(new Error(`Command timeout: ${command}`));
      }, timeout);

      client.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timeoutId);
          reject(err);
          return;
        }

        stream.on('close', (code, signal) => {
          clearTimeout(timeoutId);
          this.logger.info(`Command executed: ${command}, exit code: ${code}`);
          resolve({
            output: output.trim(),
            error: errorOutput.trim(),
            exitCode: code,
            signal
          });
        });

        stream.on('data', (data) => {
          output += data.toString();
        });

        stream.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
      });
    });
  }

  async configureSystemView(connectionId) {
    const commands = [
      'system-view',
      'undo terminal monitor'
    ];

    for (const command of commands) {
      await this.executeCommand(connectionId, command);
    }
  }

  async exitSystemView(connectionId) {
    await this.executeCommand(connectionId, 'quit');
  }

  async commitConfiguration(connectionId) {
    const result = await this.executeCommand(connectionId, 'commit');
    if (result.exitCode !== 0) {
      throw new Error(`Commit failed: ${result.error}`);
    }
    return result;
  }

  async disconnect(connectionId) {
    const client = this.connections.get(connectionId);
    if (client) {
      client.end();
      this.connections.delete(connectionId);
      this.logger.info(`Disconnected from connection: ${connectionId}`);
    }
  }

  async disconnectAll() {
    const connectionIds = Array.from(this.connections.keys());
    for (const connectionId of connectionIds) {
      await this.disconnect(connectionId);
    }
  }

  async testConnection(host, username, password) {
    try {
      const connectionId = await this.connect(host, username, password, 10000);
      const result = await this.executeCommand(connectionId, 'display version');
      await this.disconnect(connectionId);
      return { success: true, output: result.output };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = SSHService;
