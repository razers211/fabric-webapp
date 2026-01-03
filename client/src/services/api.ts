import axios from 'axios';
import { SpineLeafConfig, TenantConfig, PortConfig, DeploymentResult, PortStatus, Tenant, InterfaceStatistics } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

export const deploymentAPI = {
  deploySpineLeaf: async (config: SpineLeafConfig): Promise<{ success: boolean; message: string; results: DeploymentResult[] }> => {
    const response = await api.post('/deployment/spine-leaf', config);
    return response.data;
  },

  validateDeployment: async (config: SpineLeafConfig): Promise<{ valid: boolean; connectivity: any[] }> => {
    const response = await api.post('/deployment/validate', config);
    return response.data;
  },

  getSwitchStatus: async (host: string, username: string, password: string): Promise<any> => {
    const response = await api.get(`/deployment/status/${host}`, {
      params: { username, password }
    });
    return response.data;
  },
};

export const tenantAPI = {
  configureTenant: async (switchInfo: any, tenantConfig: TenantConfig): Promise<any> => {
    const response = await api.post('/tenants/configure', { switchInfo, tenantConfig });
    return response.data;
  },

  getTenants: async (host: string, username: string, password: string): Promise<{ host: string; tenants: Tenant[] }> => {
    const response = await api.get(`/tenants/list/${host}`, {
      params: { username, password }
    });
    return response.data;
  },

  removeTenant: async (host: string, tenantName: string, username: string, password: string): Promise<any> => {
    const response = await api.delete(`/tenants/remove/${host}/${tenantName}`, {
      params: { username, password }
    });
    return response.data;
  },
};

export const portAPI = {
  configurePorts: async (switchInfo: any, portConfigurations: PortConfig[]): Promise<any> => {
    const response = await api.post('/ports/configure', { switchInfo, portConfigurations });
    return response.data;
  },

  getPortStatus: async (host: string, username: string, password: string): Promise<{ host: string; ports: PortStatus[] }> => {
    const response = await api.get(`/ports/status/${host}`, {
      params: { username, password }
    });
    return response.data;
  },

  togglePort: async (host: string, interfaceName: string, username: string, password: string, enabled: boolean): Promise<any> => {
    const response = await api.put(`/ports/toggle/${host}/${interfaceName}`, {
      username,
      password,
      enabled
    });
    return response.data;
  },

  getInterfaceStatistics: async (host: string, interfaceName: string, username: string, password: string): Promise<{ host: string; interface: string; statistics: InterfaceStatistics }> => {
    const response = await api.get(`/ports/statistics/${host}/${interfaceName}`, {
      params: { username, password }
    });
    return response.data;
  },
};
