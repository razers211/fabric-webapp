# Huawei CE6800 Spine-Leaf Automation

A comprehensive web application for automating the deployment of spine-leaf architecture on Huawei CE6800 switches, including tenant management and access port configuration.

## Features

- **Spine-Leaf Deployment**: Automated configuration of spine-leaf topology with OSPF or BGP underlay routing
- **Tenant Management**: Create, configure, and manage network tenants with VLAN isolation
- **Port Configuration**: Configure access, trunk, and hybrid ports with real-time status monitoring
- **Real-time Monitoring**: Live deployment progress and system status updates via WebSocket
- **Modern UI**: Responsive Material-UI interface with dark theme
- **Validation**: Pre-deployment connectivity validation and configuration verification

## Architecture

### Backend
- **Node.js/Express**: RESTful API server
- **SSH2**: Secure switch communication and configuration
- **Socket.IO**: Real-time progress updates
- **Winston**: Comprehensive logging
- **Joi**: Input validation

### Frontend
- **React/TypeScript**: Modern single-page application
- **Material-UI**: Professional UI components
- **React Router**: Client-side routing
- **Socket.IO Client**: Real-time updates
- **React Hook Form**: Form handling with validation

## Installation

### Prerequisites
- Node.js 16+ 
- Huawei CE6800 switches with SSH access
- Network connectivity to switches

### Setup

1. **Clone and install dependencies**:
```bash
git clone <repository-url>
cd huawei-ce6800-automation
npm run install-all
```

2. **Environment Configuration**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start the application**:
```bash
# Development mode
npm run dev

# Production mode
npm start
```

4. **Access the application**:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## Configuration

### Environment Variables

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Switch Configuration
SWITCH_USERNAME=admin
SWITCH_PASSWORD=password
SSH_TIMEOUT=30000
SNMP_TIMEOUT=5000
SNMP_COMMUNITY=public

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log

# Security
JWT_SECRET=your-jwt-secret-key
SESSION_SECRET=your-session-secret
```

## Usage

### 1. Spine-Leaf Deployment

1. Navigate to **Spine-Leaf Deployment** page
2. Add spine switches with IP, credentials, and names
3. Add leaf switches with connection details
4. Configure VLANs for the fabric
5. Choose underlay routing protocol (OSPF or BGP)
6. Validate connectivity and deploy

### 2. Tenant Management

1. Connect to a target switch
2. Click **Add Tenant** and provide:
   - Tenant name
   - VLAN assignments
   - Access ports with descriptions
3. Configure and monitor tenant deployment

### 3. Port Configuration

1. Connect to a target switch
2. View real-time port status
3. Configure new ports:
   - Access ports with VLAN assignment
   - Trunk ports with allowed VLANs
   - Hybrid ports with mixed configurations
4. Monitor port statistics and toggle port status

## API Endpoints

### Deployment
- `POST /api/deployment/spine-leaf` - Deploy spine-leaf configuration
- `POST /api/deployment/validate` - Validate switch connectivity
- `GET /api/deployment/status/:host` - Get switch status

### Tenants
- `POST /api/tenants/configure` - Configure tenant
- `GET /api/tenants/list/:host` - List tenants
- `DELETE /api/tenants/remove/:host/:tenantName` - Remove tenant

### Ports
- `POST /api/ports/configure` - Configure ports
- `GET /api/ports/status/:host` - Get port status
- `PUT /api/ports/toggle/:host/:interface` - Toggle port
- `GET /api/ports/statistics/:host/:interface` - Get port statistics

## Switch Configuration Examples

### Spine Switch Configuration
```bash
system-view
sysname Spine-1
interface 10GE 1/0/1
description Link-to-Leaf1
ip address 10.0.1.1 255.255.255.252
ospf enable 1
undo shutdown
quit
ospf 1
area 0.0.0.0
network 10.0.1.0 0.0.0.3
quit
commit
quit
```

### Leaf Switch Configuration
```bash
system-view
sysname Leaf-1
interface 10GE 1/0/1
description Link-to-Spine1
ip address 10.0.1.2 255.255.255.252
ospf enable 1
undo shutdown
quit
vlan 100
description Tenant-A-VLAN-100
quit
interface 10GE 1/0/24
description Tenant-A-Server-1
port link-type access
port default vlan 100
undo shutdown
quit
commit
quit
```

## Security Considerations

- Store switch credentials securely
- Use SSH key authentication when possible
- Implement network access controls
- Enable audit logging
- Regular security updates

## Troubleshooting

### Common Issues

1. **SSH Connection Failed**
   - Verify network connectivity
   - Check SSH credentials
   - Confirm SSH is enabled on switches

2. **Deployment Validation Failed**
   - Ensure all switches are reachable
   - Verify SNMP community strings
   - Check firewall rules

3. **Port Configuration Not Applied**
   - Verify interface names format
   - Check VLAN ID ranges (1-4094)
   - Confirm port type compatibility

### Logs

- Application logs: `logs/combined.log`
- Error logs: `logs/error.log`
- Console output for development

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Submit pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Create GitHub issue
- Check documentation
- Review logs for error details
