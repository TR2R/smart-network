export type NetworkDevice = {
  id: number;
  name: string;
  type: string;
  ipAddress: string;
  macAddress: string;
  location: string;
  model: string;
  status: string;
  monitoringPort: number;
  portCount: number;
  usedPorts: number;
  bandwidthUsage: number;
  capacityMbps: number;
  latency: number;
  snmpEnabled: boolean;
  lastChecked: string | null;
  createdAt: string;
};

export type NetworkPort = {
  id: number;
  deviceId: number;
  number: number;
  name: string;
  status: string;
  speed: string;
  connectedTo: string;
};

export type NetworkAlert = {
  id: number;
  deviceId: number | null;
  title: string;
  description: string;
  severity: string;
  source: string;
  acknowledged: boolean;
  createdAt: string;
};

export type NetworkUplink = {
  id: number;
  name: string;
  provider: string;
  technology: string;
  isPrimary: boolean;
  address: string;
  port: number;
  sourceAddress: string;
  status: string;
  active: boolean;
  latency: number;
  lastChecked: string | null;
};

export type NetworkSettings = {
  id: number;
  autoFailover: boolean;
  liveMonitoring: boolean;
  manualOverride: boolean;
  bandwidthThreshold: number;
  alertWebhookUrl: string;
  failoverWebhookUrl: string;
};

export type UsageSample = {
  id: number;
  inbound: number;
  outbound: number;
  createdAt: string;
};

export type ActivityEvent = {
  id: number;
  title: string;
  description: string;
  type: string;
  createdAt: string;
};

export type DashboardData = {
  devices: NetworkDevice[];
  ports: NetworkPort[];
  alerts: NetworkAlert[];
  uplinks: NetworkUplink[];
  settings: NetworkSettings;
  samples: UsageSample[];
  activity: ActivityEvent[];
  generatedAt: string;
};
