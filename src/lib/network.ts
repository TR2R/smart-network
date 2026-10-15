import { createConnection } from "node:net";
import * as snmp from "net-snmp";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { activity, alerts, devices, ports, settings, uplinks, usageSamples } from "@/db/schema";
import type { DashboardData } from "@/lib/types";

const demoDevices = [
  { name: "الراوتر الرئيسي", type: "router", ipAddress: "192.168.1.1", macAddress: "A4:5E:60:12:8B:01", location: "غرفة السيرفرات", model: "Cisco ISR 4331", status: "online", portCount: 8, usedPorts: 6, bandwidthUsage: 62, latency: 4, monitoringPort: 443 },
  { name: "سويتش التوزيع الرئيسي", type: "switch", ipAddress: "192.168.1.2", macAddress: "B8:27:EB:42:7C:19", location: "غرفة السيرفرات", model: "Cisco Catalyst 9300", status: "online", portCount: 48, usedPorts: 36, bandwidthUsage: 54, latency: 3, monitoringPort: 22 },
  { name: "الجدار الناري", type: "firewall", ipAddress: "192.168.1.254", macAddress: "00:1A:2B:3C:4D:5E", location: "غرفة السيرفرات", model: "Fortinet FortiGate 100F", status: "online", portCount: 12, usedPorts: 8, bandwidthUsage: 71, latency: 5, monitoringPort: 443 },
  { name: "سويتش الطابق الثاني", type: "switch", ipAddress: "192.168.2.10", macAddress: "DC:A6:32:11:AC:20", location: "الطابق الثاني", model: "Cisco Catalyst 2960", status: "online", portCount: 24, usedPorts: 18, bandwidthUsage: 46, latency: 7, monitoringPort: 22 },
  { name: "نقطة وصول الاستقبال", type: "access-point", ipAddress: "192.168.1.20", macAddress: "F0:9F:C2:AA:12:08", location: "الاستقبال", model: "Ubiquiti UniFi U6 Pro", status: "online", portCount: 2, usedPorts: 1, bandwidthUsage: 32, latency: 8, monitoringPort: 443 },
  { name: "سويتش الطابق الثالث", type: "switch", ipAddress: "192.168.3.10", macAddress: "DC:A6:32:11:AC:21", location: "الطابق الثالث", model: "Cisco Catalyst 2960", status: "warning", portCount: 24, usedPorts: 21, bandwidthUsage: 87, latency: 14, monitoringPort: 22 },
  { name: "نقطة وصول الاجتماعات", type: "access-point", ipAddress: "192.168.2.21", macAddress: "F0:9F:C2:AA:12:09", location: "قاعة الاجتماعات", model: "Ubiquiti UniFi U6 Lite", status: "offline", portCount: 2, usedPorts: 1, bandwidthUsage: 0, latency: 0, monitoringPort: 443 },
  { name: "خادم التخزين", type: "server", ipAddress: "192.168.1.50", macAddress: "90:E2:BA:6D:41:03", location: "غرفة السيرفرات", model: "Synology RS1221+", status: "online", portCount: 4, usedPorts: 2, bandwidthUsage: 39, latency: 5, monitoringPort: 5001 },
] as const;

const inboundHistory = [82, 70, 61, 55, 52, 59, 78, 92, 110, 98, 123, 137, 119, 102, 112, 128, 116, 146, 134, 122, 151, 138, 125, 142];
const outboundHistory = [49, 42, 39, 35, 31, 38, 48, 55, 62, 58, 71, 77, 68, 60, 66, 74, 69, 82, 76, 72, 85, 78, 73, 81];

export async function ensureSeeded() {
  const existing = await db.select({ id: settings.id }).from(settings).limit(1);
  if (existing.length) return;

  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(88324019)`);
    const again = await tx.select({ id: settings.id }).from(settings).limit(1);
    if (again.length) return;
    const now = Date.now();
    const inserted = await tx.insert(devices).values(demoDevices.map((item) => ({ ...item, lastChecked: new Date(now - 35_000) }))).returning();
    const portRows = inserted.flatMap((device) => Array.from({ length: device.portCount }, (_, index) => ({
      deviceId: device.id,
      number: index + 1,
      name: `Gi${Math.floor(index / 24) + 1}/0/${(index % 24) + 1}`,
      status: index < device.usedPorts ? "active" : "empty",
      speed: device.type === "access-point" ? "1 Gbps" : "1 Gbps",
      connectedTo: index < device.usedPorts ? ["مكتب العمل", "هاتف IP", "نقطة وصول", "كاميرا الشبكة", "خادم داخلي", "طابعة الشبكة"][index % 6] : "",
    })));
    await tx.insert(ports).values(portRows);
    await tx.insert(uplinks).values([
      { name: "الاتصال الرئيسي", provider: "STC Business", technology: "Fiber Optic", isPrimary: true, address: "1.1.1.1", port: 443, status: "connected", active: true, latency: 12 },
      { name: "الاتصال الاحتياطي", provider: "Mobily 5G", technology: "5G Backup", isPrimary: false, address: "8.8.8.8", port: 443, status: "standby", active: false, latency: 24 },
    ]);
    await tx.insert(settings).values({ autoFailover: true, liveMonitoring: false, bandwidthThreshold: 80 });
    await tx.insert(alerts).values([
      { deviceId: inserted[6].id, title: "نقطة وصول الاجتماعات غير متصلة", description: "لم يستجب الجهاز لآخر محاولة اتصال. تحقق من مصدر الطاقة والاتصال.", severity: "critical", source: "device", createdAt: new Date(now - 12 * 60_000) },
      { deviceId: inserted[5].id, title: "استهلاك مرتفع للشبكة", description: "بلغ استهلاك سويتش الطابق الثالث 87% من السعة المتاحة.", severity: "warning", source: "traffic", createdAt: new Date(now - 28 * 60_000) },
      { deviceId: null, title: "الاتصال الاحتياطي جاهز", description: "تم التحقق من جاهزية اتصال Mobily 5G للاستخدام عند الحاجة.", severity: "info", source: "uplink", createdAt: new Date(now - 2 * 60 * 60_000) },
    ]);
    await tx.insert(activity).values([
      { title: "تم اكتشاف انقطاع جهاز", description: "نقطة وصول الاجتماعات · 192.168.2.21", type: "critical", createdAt: new Date(now - 12 * 60_000) },
      { title: "تنبيه باستهلاك مرتفع", description: "سويتش الطابق الثالث تجاوز حد 80%", type: "warning", createdAt: new Date(now - 28 * 60_000) },
      { title: "تم فحص الاتصال الاحتياطي", description: "اتصال Mobily 5G جاهز للعمل", type: "success", createdAt: new Date(now - 2 * 60 * 60_000) },
      { title: "النظام يعمل بصورة طبيعية", description: "بدء مراقبة الشبكة والأجهزة", type: "info", createdAt: new Date(now - 5 * 60 * 60_000) },
    ]);
    await tx.insert(usageSamples).values(inboundHistory.map((inbound, index) => ({
      inbound,
      outbound: outboundHistory[index],
      createdAt: new Date(now - (23 - index) * 60 * 60_000),
    })));
  });
}

export async function getDashboardData(): Promise<DashboardData> {
  await ensureSeeded();
  const [deviceRows, portRows, alertRows, uplinkRows, settingRows, sampleRows, activityRows] = await Promise.all([
    db.select().from(devices).orderBy(devices.id),
    db.select().from(ports).orderBy(ports.deviceId, ports.number),
    db.select().from(alerts).orderBy(desc(alerts.createdAt)).limit(100),
    db.select().from(uplinks).orderBy(desc(uplinks.isPrimary)),
    db.select().from(settings).limit(1),
    db.select().from(usageSamples).where(gte(usageSamples.createdAt, new Date(Date.now() - 25 * 60 * 60_000))).orderBy(usageSamples.createdAt).limit(200),
    db.select().from(activity).orderBy(desc(activity.createdAt)).limit(50),
  ]);
  return {
    devices: deviceRows.map((d) => ({
      id: d.id, name: d.name, type: d.type, ipAddress: d.ipAddress, macAddress: d.macAddress,
      location: d.location, model: d.model, status: d.status, monitoringPort: d.monitoringPort,
      portCount: d.portCount, usedPorts: d.usedPorts, bandwidthUsage: d.bandwidthUsage,
      capacityMbps: d.capacityMbps, latency: d.latency, snmpEnabled: Boolean(d.snmpCommunity),
      lastChecked: d.lastChecked?.toISOString() ?? null, createdAt: d.createdAt.toISOString(),
    })),
    ports: portRows.map((p) => ({ ...p })),
    alerts: alertRows.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    uplinks: uplinkRows.map((u) => ({ ...u, lastChecked: u.lastChecked?.toISOString() ?? null })),
    settings: { ...settingRows[0] },
    samples: sampleRows.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })),
    activity: activityRows.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    generatedAt: new Date().toISOString(),
  };
}

async function postWebhook(url: string, payload: Record<string, unknown>) {
  if (!url || !/^https?:\/\//i.test(url)) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4000),
    });
  } catch (error) {
    console.error("Network monitoring webhook failed:", error);
  }
}

async function addAlert(input: typeof alerts.$inferInsert, webhookUrl: string) {
  const [created] = await db.insert(alerts).values(input).returning();
  await postWebhook(webhookUrl, {
    event: "network.alert", id: created.id, title: created.title, description: created.description,
    severity: created.severity, source: created.source, createdAt: created.createdAt.toISOString(),
  });
}

async function addActivity(title: string, description: string, type = "info") {
  await db.insert(activity).values({ title, description, type });
}

function checkHost(host: string) {
  return /^[a-zA-Z0-9][a-zA-Z0-9.:-]{0,253}$/.test(host) && !host.includes("..");
}

function textValue(value: unknown, max = 255) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function numericValue(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

export async function createDevice(input: Record<string, unknown>) {
  await ensureSeeded();
  const name = textValue(input.name, 120);
  const ipAddress = textValue(input.ipAddress, 255);
  if (!name || !checkHost(ipAddress)) throw new Error("أدخل اسم الجهاز وعنوان IP صالحًا.");
  const portCount = numericValue(input.portCount, 24, 1, 96);
  const type = ["router", "switch", "access-point", "firewall", "server"].includes(String(input.type)) ? String(input.type) : "switch";
  const [device] = await db.insert(devices).values({
    name, ipAddress, type, portCount,
    location: textValue(input.location, 120) || "غير محدد",
    model: textValue(input.model, 120),
    macAddress: textValue(input.macAddress, 32),
    monitoringPort: numericValue(input.monitoringPort, 80, 1, 65535),
    capacityMbps: numericValue(input.capacityMbps, 1000, 1, 100000),
    snmpCommunity: textValue(input.snmpCommunity, 120) || null,
    status: "online",
    lastChecked: new Date(),
  }).returning();
  await db.insert(ports).values(Array.from({ length: portCount }, (_, index) => ({
    deviceId: device.id, number: index + 1, name: `Port ${index + 1}`, status: "empty", connectedTo: "",
  })));
  await addActivity("تمت إضافة جهاز جديد", `${name} · ${ipAddress}`, "success");
  return device.id;
}

export async function updateDevice(input: Record<string, unknown>) {
  const id = numericValue(input.id, 0, 1, 100000000);
  const [current] = await db.select().from(devices).where(eq(devices.id, id)).limit(1);
  if (!current) throw new Error("الجهاز غير موجود.");
  const name = textValue(input.name, 120);
  const ipAddress = textValue(input.ipAddress, 255);
  if (!name || !checkHost(ipAddress)) throw new Error("أدخل اسم الجهاز وعنوان IP صالحًا.");
  await db.update(devices).set({
    name, ipAddress,
    type: ["router", "switch", "access-point", "firewall", "server"].includes(String(input.type)) ? String(input.type) : current.type,
    location: textValue(input.location, 120) || "غير محدد",
    model: textValue(input.model, 120), macAddress: textValue(input.macAddress, 32),
    monitoringPort: numericValue(input.monitoringPort, current.monitoringPort, 1, 65535),
    capacityMbps: numericValue(input.capacityMbps, current.capacityMbps, 1, 100000),
    snmpCommunity: input.snmpCommunity === "__keep__" ? current.snmpCommunity : textValue(input.snmpCommunity, 120) || null,
  }).where(eq(devices.id, id));
  await addActivity("تم تحديث بيانات جهاز", `${name} · ${ipAddress}`, "info");
}

export async function deleteDevice(id: number) {
  const [device] = await db.select().from(devices).where(eq(devices.id, id)).limit(1);
  if (!device) throw new Error("الجهاز غير موجود.");
  await db.delete(devices).where(eq(devices.id, id));
  await addActivity("تم حذف جهاز من الشبكة", device.name, "warning");
}

export async function updatePort(input: Record<string, unknown>) {
  const id = numericValue(input.id, 0, 1, 100000000);
  const [port] = await db.select().from(ports).where(eq(ports.id, id)).limit(1);
  if (!port) throw new Error("المنفذ غير موجود.");
  const status = input.status === "active" ? "active" : "empty";
  await db.update(ports).set({
    status, connectedTo: status === "active" ? textValue(input.connectedTo, 120) : "",
    name: textValue(input.name, 80) || port.name,
    speed: textValue(input.speed, 30) || port.speed,
  }).where(eq(ports.id, id));
  const used = await db.select({ id: ports.id }).from(ports).where(and(eq(ports.deviceId, port.deviceId), eq(ports.status, "active")));
  await db.update(devices).set({ usedPorts: used.length }).where(eq(devices.id, port.deviceId));
}

export async function acknowledgeAlert(id: number) {
  await db.update(alerts).set({ acknowledged: true }).where(eq(alerts.id, id));
}

export async function acknowledgeAllAlerts() {
  await db.update(alerts).set({ acknowledged: true }).where(eq(alerts.acknowledged, false));
}

export async function saveSettings(input: Record<string, unknown>) {
  await ensureSeeded();
  const [current] = await db.select().from(settings).limit(1);
  const liveMonitoring = input.liveMonitoring === true;
  await db.update(settings).set({
    autoFailover: input.autoFailover === true,
    liveMonitoring,
    bandwidthThreshold: numericValue(input.bandwidthThreshold, current.bandwidthThreshold, 1, 100),
    alertWebhookUrl: textValue(input.alertWebhookUrl, 1000),
    failoverWebhookUrl: textValue(input.failoverWebhookUrl, 1000),
  }).where(eq(settings.id, current.id));
  if (liveMonitoring && !current.liveMonitoring) {
    await db.delete(usageSamples);
    await db.update(devices).set({ bandwidthUsage: 0 });
  }
  if (liveMonitoring !== current.liveMonitoring) {
    await addActivity(liveMonitoring ? "تم تفعيل المراقبة المباشرة" : "تم تفعيل وضع العرض التجريبي", liveMonitoring ? "ستُفحص الأجهزة من الخادم كل 30 ثانية عند فتح اللوحة" : "تم إيقاف الفحص المباشر للأجهزة", "info");
  }
}

export async function saveUplink(input: Record<string, unknown>) {
  const id = numericValue(input.id, 0, 1, 100000000);
  const [link] = await db.select().from(uplinks).where(eq(uplinks.id, id)).limit(1);
  if (!link) throw new Error("الاتصال غير موجود.");
  const address = textValue(input.address, 255);
  const sourceAddress = textValue(input.sourceAddress, 255);
  if (!checkHost(address) || (sourceAddress && !checkHost(sourceAddress))) throw new Error("عنوان الفحص أو عنوان واجهة الشبكة غير صالح.");
  await db.update(uplinks).set({
    name: textValue(input.name, 120) || link.name,
    provider: textValue(input.provider, 120) || link.provider,
    technology: textValue(input.technology, 80) || link.technology,
    address, sourceAddress,
    port: numericValue(input.port, link.port, 1, 65535),
  }).where(eq(uplinks.id, id));
  await addActivity("تم تحديث إعدادات الاتصال", link.name, "info");
}

export async function switchUplink(target: "primary" | "backup") {
  await ensureSeeded();
  const [setting] = await db.select().from(settings).limit(1);
  const links = await db.select().from(uplinks);
  const primary = links.find((link) => link.isPrimary);
  const backup = links.find((link) => !link.isPrimary);
  if (!primary || !backup) throw new Error("إعدادات الاتصالات غير مكتملة.");
  if (target === "backup" && backup.active) return;
  if (target === "primary" && primary.active) return;
  if (setting.liveMonitoring && target === "backup" && backup.status === "down") throw new Error("الاتصال الاحتياطي غير متاح حاليًا.");
  if (setting.liveMonitoring && target === "primary" && primary.status === "down") throw new Error("الاتصال الرئيسي لا يزال متوقفًا.");

  await db.update(uplinks).set({ active: target === "primary", status: target === "primary" ? "connected" : setting.liveMonitoring ? "standby" : "down", lastChecked: new Date() }).where(eq(uplinks.id, primary.id));
  await db.update(uplinks).set({ active: target === "backup", status: target === "backup" ? "connected" : "standby", lastChecked: new Date() }).where(eq(uplinks.id, backup.id));
  await db.update(settings).set({ manualOverride: target === "backup" }).where(eq(settings.id, setting.id));
  const title = target === "backup" ? "تم تفعيل الاتصال الاحتياطي" : "تمت استعادة الاتصال الرئيسي";
  await addActivity(title, target === "backup" ? `${backup.provider} يعمل الآن كمسار نشط` : `${primary.provider} عاد للعمل كمسار نشط`, target === "backup" ? "warning" : "success");
  await addAlert({ title, description: target === "backup" ? `تم التحويل إلى ${backup.provider} لضمان استمرارية الاتصال.` : `عاد الاتصال عبر ${primary.provider} وتم إبقاء الاحتياطي في وضع الاستعداد.`, severity: "info", source: "uplink" }, setting.alertWebhookUrl);
  await postWebhook(setting.failoverWebhookUrl, { event: "network.failover", active: target, reason: "manual", primary: primary.provider, backup: backup.provider, timestamp: new Date().toISOString() });
}

function probeTcp(host: string, port: number, sourceAddress = ""): Promise<{ online: boolean; latency: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    let settled = false;
    const finish = (online: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ online, latency: online ? Math.max(1, Date.now() - start) : 0 });
    };
    const socket = createConnection({ host, port, ...(sourceAddress ? { localAddress: sourceAddress } : {}) });
    socket.setTimeout(1800);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

type WalkValue = { index: number; value: snmp.VarbindValue };
function walkOid(session: snmp.Session, oid: string): Promise<WalkValue[]> {
  return new Promise((resolve, reject) => {
    const results: WalkValue[] = [];
    session.walk(oid, 16, (varbinds) => {
      for (const item of varbinds) {
        if (!snmp.isVarbindError(item)) results.push({ index: Number(item.oid.split(".").pop()), value: item.value });
      }
      if (results.length >= 128) return true;
    }, (error) => error ? reject(error) : resolve(results));
  });
}

function asBigInt(value: snmp.VarbindValue): bigint {
  try {
    if (typeof value === "bigint") return value;
    if (Buffer.isBuffer(value)) return BigInt(`0x${value.toString("hex") || "0"}`);
    return BigInt(String(value ?? 0));
  } catch { return BigInt(0); }
}

async function readSnmp(device: typeof devices.$inferSelect) {
  const session = snmp.createSession(device.ipAddress, device.snmpCommunity || "public", { version: snmp.Version2c, retries: 0, timeout: 1500 });
  try {
    const [names, states, inbound, outbound] = await Promise.all([
      walkOid(session, "1.3.6.1.2.1.2.2.1.2"),
      walkOid(session, "1.3.6.1.2.1.2.2.1.8"),
      walkOid(session, "1.3.6.1.2.1.31.1.1.1.6").catch(() => [] as WalkValue[]),
      walkOid(session, "1.3.6.1.2.1.31.1.1.1.10").catch(() => [] as WalkValue[]),
    ]);
    if (!states.length) throw new Error("No SNMP interfaces returned");
    const namesByIndex = new Map(names.map((row) => [row.index, String(row.value ?? "")]));
    const interfaces = states.slice(0, device.portCount).map((row, index) => ({
      number: index + 1, name: namesByIndex.get(row.index) || `Port ${index + 1}`, active: Number(row.value) === 1,
    }));
    const totalIn = inbound.reduce((sum, row) => sum + asBigInt(row.value), BigInt(0));
    const totalOut = outbound.reduce((sum, row) => sum + asBigInt(row.value), BigInt(0));
    const seconds = device.lastSnmpAt ? Math.max(1, (Date.now() - device.lastSnmpAt.getTime()) / 1000) : 0;
    const inMbps = seconds && device.lastInOctets != null && totalIn >= device.lastInOctets ? Math.round(Number(totalIn - device.lastInOctets) * 8 / seconds / 1_000_000) : 0;
    const outMbps = seconds && device.lastOutOctets != null && totalOut >= device.lastOutOctets ? Math.round(Number(totalOut - device.lastOutOctets) * 8 / seconds / 1_000_000) : 0;
    return { interfaces, totalIn, totalOut, inMbps, outMbps, usage: Math.min(100, Math.round((inMbps + outMbps) / device.capacityMbps * 100)) };
  } finally {
    session.close();
  }
}

async function runDemoScan() {
  await db.update(devices).set({ lastChecked: new Date() });
  const [latest] = await db.select().from(usageSamples).orderBy(desc(usageSamples.createdAt)).limit(1);
  await db.insert(usageSamples).values({ inbound: Math.max(55, Math.min(165, (latest?.inbound ?? 130) + 7)), outbound: Math.max(35, Math.min(95, (latest?.outbound ?? 75) + 4)) });
  await addActivity("اكتمل فحص الشبكة التجريبي", "تم تحديث حالة الأجهزة والاتصالات بنجاح", "success");
  return "اكتمل فحص الشبكة التجريبي بنجاح";
}

async function runLiveScan() {
  const [deviceRows, linkRows, settingRows] = await Promise.all([db.select().from(devices), db.select().from(uplinks), db.select().from(settings).limit(1)]);
  const setting = settingRows[0];
  let totalInbound = 0;
  let totalOutbound = 0;

  await Promise.all(deviceRows.map(async (device) => {
    const tcp = await probeTcp(device.ipAddress, device.monitoringPort);
    let telemetry: Awaited<ReturnType<typeof readSnmp>> | null = null;
    if (device.snmpCommunity) {
      try { telemetry = await readSnmp(device); } catch { /* TCP reachability remains available without SNMP. */ }
    }
    const online = tcp.online || Boolean(telemetry);
    const usage = telemetry?.usage ?? 0;
    const status = !online ? "offline" : usage >= setting.bandwidthThreshold ? "warning" : "online";
    await db.update(devices).set({
      status, latency: tcp.latency, bandwidthUsage: usage, lastChecked: new Date(),
      ...(telemetry ? { lastInOctets: telemetry.totalIn, lastOutOctets: telemetry.totalOut, lastSnmpAt: new Date(), usedPorts: telemetry.interfaces.filter((item) => item.active).length } : {}),
    }).where(eq(devices.id, device.id));
    if (telemetry) {
      totalInbound += telemetry.inMbps;
      totalOutbound += telemetry.outMbps;
      await Promise.all(telemetry.interfaces.map((item) => db.update(ports).set({ name: item.name, status: item.active ? "active" : "empty" }).where(and(eq(ports.deviceId, device.id), eq(ports.number, item.number)))));
    }
    if (status === "offline" && device.status !== "offline") {
      await addAlert({ deviceId: device.id, title: `${device.name} غير متصل`, description: `تعذر الوصول إلى ${device.ipAddress}:${device.monitoringPort}. تحقق من الجهاز والاتصال.`, severity: "critical", source: "device" }, setting.alertWebhookUrl);
      await addActivity("تم اكتشاف انقطاع جهاز", `${device.name} · ${device.ipAddress}`, "critical");
    } else if (online && device.status === "offline") {
      await addAlert({ deviceId: device.id, title: `${device.name} عاد للاتصال`, description: `تمت استعادة الاتصال بالجهاز ${device.ipAddress}.`, severity: "info", source: "device" }, setting.alertWebhookUrl);
      await addActivity("تمت استعادة اتصال جهاز", device.name, "success");
    }
    if (status === "warning" && device.bandwidthUsage < setting.bandwidthThreshold) {
      await addAlert({ deviceId: device.id, title: `استهلاك مرتفع: ${device.name}`, description: `وصل استهلاك الجهاز إلى ${usage}% متجاوزًا الحد المحدد (${setting.bandwidthThreshold}%).`, severity: "warning", source: "traffic" }, setting.alertWebhookUrl);
      await addActivity("تم رصد استهلاك مرتفع", `${device.name} · ${usage}%`, "warning");
    }
  }));

  const checkedLinks = await Promise.all(linkRows.map(async (link) => ({ link, result: await probeTcp(link.address, link.port, link.sourceAddress) })));
  const primary = checkedLinks.find(({ link }) => link.isPrimary);
  const backup = checkedLinks.find(({ link }) => !link.isPrimary);
  const primaryOnline = Boolean(primary?.result.online);
  const backupOnline = Boolean(backup?.result.online);
  const nextActive = setting.manualOverride && backupOnline ? "backup" : primaryOnline ? "primary" : setting.autoFailover && backupOnline ? "backup" : "none";
  const previousActive = linkRows.find((link) => link.active);
  for (const { link, result } of checkedLinks) {
    const shouldBeActive = nextActive === (link.isPrimary ? "primary" : "backup");
    await db.update(uplinks).set({
      active: shouldBeActive,
      status: !result.online ? "down" : shouldBeActive ? "connected" : "standby",
      latency: result.latency,
      lastChecked: new Date(),
    }).where(eq(uplinks.id, link.id));
  }
  if (primary && !primaryOnline && primary.link.status !== "down") {
    await addAlert({ title: "انقطاع الاتصال الرئيسي", description: `تعذر الوصول إلى وجهة الفحص عبر ${primary.link.provider}.`, severity: "critical", source: "uplink" }, setting.alertWebhookUrl);
    await addActivity("انقطاع الاتصال الرئيسي", primary.link.provider, "critical");
  }
  if (previousActive?.id !== (nextActive === "backup" ? backup?.link.id : nextActive === "primary" ? primary?.link.id : undefined)) {
    const title = nextActive === "backup" ? "تحويل تلقائي إلى الاتصال الاحتياطي" : nextActive === "primary" ? "تمت استعادة الاتصال الرئيسي" : "جميع الاتصالات غير متاحة";
    await addAlert({ title, description: nextActive === "backup" ? "تم تفعيل المسار الاحتياطي لضمان استمرارية الخدمة." : nextActive === "primary" ? "عاد المسار الرئيسي للعمل بشكل طبيعي." : "تعذر الوصول إلى الاتصال الرئيسي والاحتياطي.", severity: nextActive === "none" ? "critical" : "info", source: "uplink" }, setting.alertWebhookUrl);
    await addActivity(title, "تم تحديث حالة مسارات الشبكة", nextActive === "none" ? "critical" : "success");
    await postWebhook(setting.failoverWebhookUrl, { event: "network.failover", active: nextActive, reason: "automatic", primaryOnline, backupOnline, timestamp: new Date().toISOString() });
  }
  await db.insert(usageSamples).values({ inbound: totalInbound, outbound: totalOutbound });
  return "اكتمل فحص الأجهزة والاتصالات بنجاح";
}

let pendingScan: Promise<string> | null = null;
export async function scanNetwork() {
  if (pendingScan) return pendingScan;
  pendingScan = (async () => {
    await ensureSeeded();
    const [setting] = await db.select().from(settings).limit(1);
    return setting.liveMonitoring ? runLiveScan() : runDemoScan();
  })().finally(() => { pendingScan = null; });
  return pendingScan;
}
