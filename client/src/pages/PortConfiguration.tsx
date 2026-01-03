import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  TextField,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  SettingsEthernet as PortIcon,
  PowerSettingsNew as PowerIcon,
  Router as RouterIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { portAPI } from '../services/api';
import { PortStatus, Switch as SwitchType, PortConfig, InterfaceStatistics } from '../types';

const PortConfiguration: React.FC = () => {
  const [ports, setPorts] = useState<PortStatus[]>([]);
  const [selectedSwitch, setSelectedSwitch] = useState<SwitchType | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showStatsDialog, setShowStatsDialog] = useState(false);
  const [selectedPort, setSelectedPort] = useState<PortStatus | null>(null);
  const [portStats, setPortStats] = useState<InterfaceStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [newPort, setNewPort] = useState<PortConfig>({
    interface: '',
    description: '',
    portType: 'access',
    vlan: 1,
    allowedVlans: '',
    nativeVlan: 1,
    enabled: true
  });

  const [switchCredentials, setSwitchCredentials] = useState({
    host: '',
    username: '',
    password: ''
  });

  useEffect(() => {
    if (selectedSwitch) {
      loadPortStatus();
    }
  }, [selectedSwitch]);

  const loadPortStatus = async () => {
    if (!selectedSwitch) return;

    setLoading(true);
    setError(null);

    try {
      const result = await portAPI.getPortStatus(
        selectedSwitch.host,
        selectedSwitch.username,
        selectedSwitch.password
      );
      setPorts(result.ports);
    } catch (error) {
      setError('Failed to load port status');
      console.error('Error loading port status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigurePort = async () => {
    if (!selectedSwitch || !newPort.interface) {
      setError('Please fill in all required fields');
      return;
    }

    if (newPort.portType === 'access' && !newPort.vlan) {
      setError('Access ports require a VLAN assignment');
      return;
    }

    if (newPort.portType === 'trunk' && !newPort.allowedVlans) {
      setError('Trunk ports require allowed VLANs');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await portAPI.configurePorts(selectedSwitch, [newPort]);
      setSuccess(`Port ${newPort.interface} configured successfully`);
      setShowAddDialog(false);
      setNewPort({
        interface: '',
        description: '',
        portType: 'access',
        vlan: 1,
        allowedVlans: '',
        nativeVlan: 1,
        enabled: true
      });
      loadPortStatus();
    } catch (error) {
      setError('Failed to configure port');
      console.error('Error configuring port:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePort = async (port: PortStatus) => {
    if (!selectedSwitch) return;

    setLoading(true);
    setError(null);

    try {
      await portAPI.togglePort(
        selectedSwitch.host,
        port.interface,
        selectedSwitch.username,
        selectedSwitch.password,
        !port.enabled
      );
      setSuccess(`Port ${port.interface} ${!port.enabled ? 'enabled' : 'disabled'} successfully`);
      loadPortStatus();
    } catch (error) {
      setError('Failed to toggle port');
      console.error('Error toggling port:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewStatistics = async (port: PortStatus) => {
    if (!selectedSwitch) return;

    setLoading(true);
    setError(null);

    try {
      const result = await portAPI.getInterfaceStatistics(
        selectedSwitch.host,
        port.interface,
        selectedSwitch.username,
        selectedSwitch.password
      );
      setPortStats(result.statistics);
      setSelectedPort(port);
      setShowStatsDialog(true);
    } catch (error) {
      setError('Failed to retrieve port statistics');
      console.error('Error retrieving port statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'up':
        return 'success';
      case 'down':
        return 'error';
      default:
        return 'warning';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Port Configuration
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Switch Selection
              </Typography>
              <TextField
                fullWidth
                label="Switch IP/Hostname"
                value={switchCredentials.host}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSwitchCredentials({ ...switchCredentials, host: e.target.value })}
                margin="normal"
              />
              <TextField
                fullWidth
                label="Username"
                value={switchCredentials.username}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSwitchCredentials({ ...switchCredentials, username: e.target.value })}
                margin="normal"
              />
              <TextField
                fullWidth
                type="password"
                label="Password"
                value={switchCredentials.password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSwitchCredentials({ ...switchCredentials, password: e.target.value })}
                margin="normal"
              />
              <Button
                fullWidth
                variant="contained"
                onClick={() => {
                  if (switchCredentials.host && switchCredentials.username && switchCredentials.password) {
                    setSelectedSwitch({
                      host: switchCredentials.host,
                      username: switchCredentials.username,
                      password: switchCredentials.password
                    });
                  }
                }}
                sx={{ mt: 2 }}
              >
                Connect to Switch
              </Button>

              {selectedSwitch && (
                <Box sx={{ mt: 2 }}>
                  <Chip
                    icon={<RouterIcon />}
                    label={`Connected to ${selectedSwitch.host}`}
                    color="primary"
                    variant="outlined"
                  />
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={loadPortStatus}
                    sx={{ mt: 1 }}
                    disabled={loading}
                  >
                    Refresh
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  Ports ({ports.length})
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setShowAddDialog(true)}
                  disabled={!selectedSwitch}
                >
                  Configure Port
                </Button>
              </Box>

              {loading ? (
                <Typography>Loading port status...</Typography>
              ) : !selectedSwitch ? (
                <Alert severity="info">
                  Please connect to a switch to view ports
                </Alert>
              ) : ports.length === 0 ? (
                <Alert severity="info">
                  No ports found on this switch
                </Alert>
              ) : (
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Interface</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>VLAN</TableCell>
                        <TableCell>Speed</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {ports.map((port: PortStatus, index: number) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Box display="flex" alignItems="center">
                              <PortIcon sx={{ mr: 1 }} />
                              {port.interface}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={port.status.toUpperCase()}
                              color={getStatusColor(port.status) as any}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{port.type}</TableCell>
                          <TableCell>{port.vlan || 'N/A'}</TableCell>
                          <TableCell>{port.speed}</TableCell>
                          <TableCell>
                            <IconButton
                              color={port.enabled ? 'warning' : 'success'}
                              onClick={() => handleTogglePort(port)}
                              title={port.enabled ? 'Disable' : 'Enable'}
                            >
                              <PowerIcon />
                            </IconButton>
                            <IconButton
                              color="info"
                              onClick={() => handleViewStatistics(port)}
                              title="View Statistics"
                            >
                              <RouterIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={showAddDialog} onClose={() => setShowAddDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Configure Port</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Interface Name"
                value={newPort.interface}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPort({ ...newPort, interface: e.target.value })}
                margin="normal"
                placeholder="e.g., 10GE1/0/1"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Description"
                value={newPort.description}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPort({ ...newPort, description: e.target.value })}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Port Type</InputLabel>
                <Select
                  value={newPort.portType}
                  onChange={(e: any) => setNewPort({ ...newPort, portType: e.target.value as any })}
                >
                  <MenuItem value="access">Access</MenuItem>
                  <MenuItem value="trunk">Trunk</MenuItem>
                  <MenuItem value="hybrid">Hybrid</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <FormControlLabel
                  control={
                    <Switch
                      checked={newPort.enabled}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPort({ ...newPort, enabled: e.target.checked })}
                    />
                  }
                  label="Enabled"
                />
              </FormControl>
            </Grid>
            
            {newPort.portType === 'access' && (
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="VLAN ID"
                  type="number"
                  value={newPort.vlan}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPort({ ...newPort, vlan: parseInt(e.target.value) })}
                  margin="normal"
                  inputProps={{ min: 1, max: 4094 }}
                />
              </Grid>
            )}
            
            {newPort.portType === 'trunk' && (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Allowed VLANs"
                    value={newPort.allowedVlans}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPort({ ...newPort, allowedVlans: e.target.value })}
                    margin="normal"
                    placeholder="e.g., 1,10,20-30"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Native VLAN"
                    type="number"
                    value={newPort.nativeVlan}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPort({ ...newPort, nativeVlan: parseInt(e.target.value) })}
                    margin="normal"
                    inputProps={{ min: 1, max: 4094 }}
                  />
                </Grid>
              </>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddDialog(false)}>Cancel</Button>
          <Button onClick={handleConfigurePort} variant="contained" disabled={loading}>
            {loading ? 'Configuring...' : 'Configure Port'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showStatsDialog} onClose={() => setShowStatsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Port Statistics - {selectedPort?.interface}</DialogTitle>
        <DialogContent>
            {portStats && (
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" color="primary">Input Statistics</Typography>
                      <Typography>Bytes: {formatBytes(portStats.inputBytes)}</Typography>
                      <Typography>Packets: {portStats.inputPackets.toLocaleString()}</Typography>
                      <Typography>Errors: {portStats.inputErrors}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" color="primary">Output Statistics</Typography>
                      <Typography>Bytes: {formatBytes(portStats.outputBytes)}</Typography>
                      <Typography>Packets: {portStats.outputPackets.toLocaleString()}</Typography>
                      <Typography>Errors: {portStats.outputErrors}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowStatsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PortConfiguration;
