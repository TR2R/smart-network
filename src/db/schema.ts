import {
  bigint,
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const devices = pgTable("devices", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: varchar("type", { length: 32 }).notNull().default("switch"),
  ipAddress: varchar("ip_address", { length: 255 }).notNull().unique(),
  macAddress: varchar("mac_address", { length: 32 }).notNull().default(""),
  location: text("location").notNull().default("غير محدد"),
  model: text("model").notNull().default(""),
  status: varchar("status", { length: 20 }).notNull().default("online"),
  monitoringPort: integer("monitoring_port").notNull().default(80),
  portCount: integer("port_count").notNull().default(24),
  usedPorts: integer("used_ports").notNull().default(0),
  bandwidthUsage: integer("bandwidth_usage").notNull().default(0),
  capacityMbps: integer("capacity_mbps").notNull().default(1000),
  latency: integer("latency").notNull().default(0),
  snmpCommunity: text("snmp_community"),
  lastInOctets: bigint("last_in_octets", { mode: "bigint" }),
  lastOutOctets: bigint("last_out_octets", { mode: "bigint" }),
  lastSnmpAt: timestamp("last_snmp_at", { withTimezone: true }),
  lastChecked: timestamp("last_checked", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ports = pgTable("ports", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
  number: integer("number").notNull(),
  name: text("name").notNull().default(""),
  status: varchar("status", { length: 20 }).notNull().default("empty"),
  speed: text("speed").notNull().default("1 Gbps"),
  connectedTo: text("connected_to").notNull().default(""),
});

export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").references(() => devices.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  severity: varchar("severity", { length: 20 }).notNull().default("warning"),
  source: varchar("source", { length: 20 }).notNull().default("device"),
  acknowledged: boolean("acknowledged").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const uplinks = pgTable("uplinks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  provider: text("provider").notNull(),
  technology: text("technology").notNull().default("Fiber"),
  isPrimary: boolean("is_primary").notNull().default(false),
  address: text("address").notNull().default("1.1.1.1"),
  port: integer("port").notNull().default(443),
  sourceAddress: text("source_address").notNull().default(""),
  status: varchar("status", { length: 20 }).notNull().default("standby"),
  active: boolean("active").notNull().default(false),
  latency: integer("latency").notNull().default(0),
  lastChecked: timestamp("last_checked", { withTimezone: true }).defaultNow(),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  autoFailover: boolean("auto_failover").notNull().default(true),
  liveMonitoring: boolean("live_monitoring").notNull().default(false),
  manualOverride: boolean("manual_override").notNull().default(false),
  bandwidthThreshold: integer("bandwidth_threshold").notNull().default(80),
  alertWebhookUrl: text("alert_webhook_url").notNull().default(""),
  failoverWebhookUrl: text("failover_webhook_url").notNull().default(""),
});

export const activity = pgTable("activity", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  type: varchar("type", { length: 24 }).notNull().default("info"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usageSamples = pgTable("usage_samples", {
  id: serial("id").primaryKey(),
  inbound: integer("inbound").notNull(),
  outbound: integer("outbound").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
