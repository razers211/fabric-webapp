export interface Switch {
  host: string;
  username: string;
  password: string;
  name?: string;
}

export interface VLAN {
  id: number;
  description?: string;
}

export interface SpineLeafConfig {
  spineSwitches: Switch[];
  leafSwitches: Switch[];
  vlans: VLAN[];
  underlayProtocol: 'ospf' | 'bgp';
}

export interface TenantConfig {
  tenantName: string;
  vlans: number[];
  accessPorts: PortConfig[];
}

export interface PortConfig {
  interface: string;
  description?: string;
  portType: 'access' | 'trunk' | 'hybrid';
  vlan?: number;
  allowedVlans?: string;
  nativeVlan?: number;
  enabled?: boolean;
}

export interface DeploymentResult {
  switch: string;
  status: string;
  type: 'spine' | 'leaf';
}

export interface PortStatus {
  interface: string;
  status: string;
  protocol: string;
  speed: string;
  duplex: string;
  vlan: number | null;
  type: string;
  enabled: boolean;
}

export interface Tenant {
  name: string;
  vlans: number[];
  ports: string[];
}

export interface InterfaceStatistics {
  inputBytes: number;
  inputPackets: number;
  outputBytes: number;
  outputPackets: number;
  inputErrors: number;
  outputErrors: number;
}
