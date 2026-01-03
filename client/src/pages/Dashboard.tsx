import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider
} from '@mui/material';
import {
  Router as RouterIcon,
  People as PeopleIcon,
  SettingsEthernet as PortIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { io, Socket } from 'socket.io-client';

interface DeploymentProgress {
  switch: string;
  type: 'spine' | 'leaf';
  status: 'completed' | 'failed' | 'in-progress';
}

interface SystemStatus {
  totalSwitches: number;
  onlineSwitches: number;
  totalTenants: number;
  totalPorts: number;
}

const Dashboard: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [deploymentProgress, setDeploymentProgress] = useState<DeploymentProgress[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    totalSwitches: 0,
    onlineSwitches: 0,
    totalTenants: 0,
    totalPorts: 0
  });
  const [recentActivity, setRecentActivity] = useState<string[]>([]);

  useEffect(() => {
    const newSocket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001');
    setSocket(newSocket);

    newSocket.on('deployment-progress', (data: DeploymentProgress) => {
      setDeploymentProgress((prev: DeploymentProgress[]) => [...prev, data]);
      addActivity(`Deployment ${data.status} for ${data.switch} (${data.type})`);
    });

    newSocket.on('tenant-configured', (data: any) => {
      addActivity(`Tenant ${data.tenant} configured on ${data.switch}`);
    });

    newSocket.on('ports-configured', (data: any) => {
      addActivity(`${data.portCount} ports configured on ${data.switch}`);
    });

    return () => newSocket.close();
  }, []);

  const addActivity = (activity: string) => {
    setRecentActivity((prev: string[]) => [activity, ...prev.slice(0, 4)]);
  };

  useEffect(() => {
    const mockSystemStatus = {
      totalSwitches: 8,
      onlineSwitches: 6,
      totalTenants: 12,
      totalPorts: 96
    };
    setSystemStatus(mockSystemStatus);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <SuccessIcon color="success" />;
      case 'failed':
        return <ErrorIcon color="error" />;
      case 'in-progress':
        return <WarningIcon color="warning" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'in-progress':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <RouterIcon color="primary" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Switches
                  </Typography>
                  <Typography variant="h4">
                    {systemStatus.totalSwitches}
                  </Typography>
                  <Typography variant="body2" color="success.main">
                    {systemStatus.onlineSwitches} online
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <PeopleIcon color="primary" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Tenants
                  </Typography>
                  <Typography variant="h4">
                    {systemStatus.totalTenants}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <PortIcon color="primary" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Ports
                  </Typography>
                  <Typography variant="h4">
                    {systemStatus.totalPorts}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                System Health
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <Box sx={{ width: '100%', mr: 1 }}>
                  <LinearProgress 
                    variant="determinate" 
                    value={(systemStatus.onlineSwitches / systemStatus.totalSwitches) * 100} 
                  />
                </Box>
                <Box sx={{ minWidth: 35 }}>
                  <Typography variant="body2" color="text.secondary">
                    {Math.round((systemStatus.onlineSwitches / systemStatus.totalSwitches) * 100)}%
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Deployment Progress
              </Typography>
              {deploymentProgress.length === 0 ? (
                <Alert severity="info">
                  No recent deployment activity
                </Alert>
              ) : (
                <List>
                  {deploymentProgress.slice(-5).map((progress: DeploymentProgress, index: number) => (
                    <React.Fragment key={index}>
                      <ListItem>
                        <Box display="flex" alignItems="center" width="100%">
                          {getStatusIcon(progress.status)}
                          <Box sx={{ ml: 2, flexGrow: 1 }}>
                            <Typography variant="body1">
                              {progress.switch}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                              {progress.type.toUpperCase()} - {progress.status.toUpperCase()}
                            </Typography>
                          </Box>
                          <Chip 
                            label={progress.status}
                            color={getStatusColor(progress.status) as any}
                            size="small"
                          />
                        </Box>
                      </ListItem>
                      {index < deploymentProgress.slice(-5).length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Activity
              </Typography>
              {recentActivity.length === 0 ? (
                <Alert severity="info">
                  No recent activity
                </Alert>
              ) : (
                <List>
                  {recentActivity.map((activity: string, index: number) => (
                    <React.Fragment key={index}>
                      <ListItem>
                        <ListItemText
                          primary={activity}
                          secondary={new Date().toLocaleTimeString()}
                        />
                      </ListItem>
                      {index < recentActivity.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
