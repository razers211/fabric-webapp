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
  TableRow
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  People as PeopleIcon,
  Router as RouterIcon
} from '@mui/icons-material';
import { tenantAPI } from '../services/api';
import { Tenant, Switch, TenantConfig } from '../types';

const TenantManagement: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedSwitch, setSelectedSwitch] = useState<Switch | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [newTenant, setNewTenant] = useState<TenantConfig>({
    tenantName: '',
    vlans: [],
    accessPorts: []
  });

  const [switchCredentials, setSwitchCredentials] = useState({
    host: '',
    username: '',
    password: ''
  });

  useEffect(() => {
    if (selectedSwitch) {
      loadTenants();
    }
  }, [selectedSwitch]);

  const loadTenants = async () => {
    if (!selectedSwitch) return;

    setLoading(true);
    setError(null);

    try {
      const result = await tenantAPI.getTenants(
        selectedSwitch.host,
        selectedSwitch.username,
        selectedSwitch.password
      );
      setTenants(result.tenants);
    } catch (error) {
      setError('Failed to load tenants');
      console.error('Error loading tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTenant = async () => {
    if (!selectedSwitch || !newTenant.tenantName || newTenant.vlans.length === 0 || newTenant.accessPorts.length === 0) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await tenantAPI.configureTenant(selectedSwitch, newTenant);
      setSuccess(`Tenant ${newTenant.tenantName} configured successfully`);
      setShowAddDialog(false);
      setNewTenant({ tenantName: '', vlans: [], accessPorts: [] });
      loadTenants();
    } catch (error) {
      setError('Failed to configure tenant');
      console.error('Error configuring tenant:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTenant = async (tenantName: string) => {
    if (!selectedSwitch) return;

    if (!window.confirm(`Are you sure you want to remove tenant ${tenantName}?`)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await tenantAPI.removeTenant(
        selectedSwitch.host,
        tenantName,
        selectedSwitch.username,
        selectedSwitch.password
      );
      setSuccess(`Tenant ${tenantName} removed successfully`);
      loadTenants();
    } catch (error) {
      setError('Failed to remove tenant');
      console.error('Error removing tenant:', error);
    } finally {
      setLoading(false);
    }
  };

  const addVlanToTenant = () => {
    const vlanId = prompt('Enter VLAN ID (1-4094):');
    if (vlanId && !isNaN(parseInt(vlanId))) {
      const vlan = parseInt(vlanId);
      if (vlan >= 1 && vlan <= 4094 && !newTenant.vlans.includes(vlan)) {
        setNewTenant({
          ...newTenant,
          vlans: [...newTenant.vlans, vlan]
        });
      }
    }
  };

  const removeVlanFromTenant = (vlanId: number) => {
    setNewTenant({
      ...newTenant,
      vlans: newTenant.vlans.filter(v => v !== vlanId)
    });
  };

  const addPortToTenant = () => {
    const interfaceName = prompt('Enter interface name (e.g., 10GE1/0/1):');
    const vlanId = prompt('Enter VLAN ID for this port:');
    const description = prompt('Enter port description (optional):') || '';

    if (interfaceName && vlanId && !isNaN(parseInt(vlanId))) {
      const vlan = parseInt(vlanId);
      if (vlan >= 1 && vlan <= 4094) {
        setNewTenant({
          ...newTenant,
          accessPorts: [...newTenant.accessPorts, {
            interface: interfaceName,
            vlan: vlan,
            description: description,
            portType: 'access' as const
          }]
        });
      }
    }
  };

  const removePortFromTenant = (index: number) => {
    setNewTenant({
      ...newTenant,
      accessPorts: newTenant.accessPorts.filter((_, i) => i !== index)
    });
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Tenant Management
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
                  Tenants ({tenants.length})
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setShowAddDialog(true)}
                  disabled={!selectedSwitch}
                >
                  Add Tenant
                </Button>
              </Box>

              {loading ? (
                <Typography>Loading tenants...</Typography>
              ) : !selectedSwitch ? (
                <Alert severity="info">
                  Please connect to a switch to view tenants
                </Alert>
              ) : tenants.length === 0 ? (
                <Alert severity="info">
                  No tenants configured on this switch
                </Alert>
              ) : (
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Tenant Name</TableCell>
                        <TableCell>VLANs</TableCell>
                        <TableCell>Ports</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {tenants.map((tenant: Tenant, index: number) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Box display="flex" alignItems="center">
                              <PeopleIcon sx={{ mr: 1 }} />
                              {tenant.name}
                            </Box>
                          </TableCell>
                          <TableCell>
                            {tenant.vlans.map(vlan => (
                              <Chip key={vlan} label={vlan} size="small" sx={{ mr: 0.5 }} />
                            ))}
                          </TableCell>
                          <TableCell>
                            {tenant.ports.length} ports
                          </TableCell>
                          <TableCell>
                            <IconButton
                              color="error"
                              onClick={() => handleRemoveTenant(tenant.name)}
                            >
                              <DeleteIcon />
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
        <DialogTitle>Add New Tenant</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Tenant Name"
            value={newTenant.tenantName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTenant({ ...newTenant, tenantName: e.target.value })}
            margin="normal"
          />

          <Box sx={{ mt: 2, mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              VLANs
            </Typography>
            <Button
              variant="outlined"
              onClick={addVlanToTenant}
              sx={{ mb: 1 }}
            >
              Add VLAN
            </Button>
            <Box>
              {newTenant.vlans.map((vlan: number, index: number) => (
                <Chip
                  key={index}
                  label={`VLAN ${vlan}`}
                  onDelete={() => removeVlanFromTenant(vlan)}
                  sx={{ mr: 0.5, mb: 0.5 }}
                />
              ))}
            </Box>
          </Box>

          <Box sx={{ mt: 2, mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Access Ports
            </Typography>
            <Button
              variant="outlined"
              onClick={addPortToTenant}
              sx={{ mb: 1 }}
            >
              Add Port
            </Button>
            <List>
              {newTenant.accessPorts.map((port: any, index: number) => (
                <ListItem key={index}>
                  <ListItemText
                    primary={port.interface}
                    secondary={`VLAN ${port.vlan}${port.description ? ` - ${port.description}` : ''}`}
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={() => removePortFromTenant(index)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddDialog(false)}>Cancel</Button>
          <Button onClick={handleAddTenant} variant="contained" disabled={loading}>
            {loading ? 'Adding...' : 'Add Tenant'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TenantManagement;
