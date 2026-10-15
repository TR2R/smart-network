"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import {
  Activity, AlertCircle, AlertTriangle, ArrowDownLeft, ArrowRightLeft, ArrowUpLeft,
  ArrowUpRight, Bell, Cable, Check, CheckCheck, CheckCircle2, ChevronDown,
  ChevronLeft, CircleHelp, Clock3, Download, ExternalLink, GitBranch, Globe2,
  HardDrive, Info, LayoutDashboard, Menu, Network, Pencil, Plus, Radio,
  RefreshCw, Router, Search, Server, Settings2, Shield, ShieldCheck,
  SlidersHorizontal, Trash2, Wifi, X, Zap,
  type LucideIcon,
} from "lucide-react";
import type { ActivityEvent, DashboardData, NetworkAlert, NetworkDevice, NetworkPort, NetworkSettings, NetworkUplink, UsageSample } from "@/lib/types";

type View = "dashboard" | "devices" | "ports" | "alerts" | "backup" | "activity" | "settings";
type ActionPayload = Record<string, unknown>;

const mainNavigation: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
  { id: "devices", label: "الأجهزة المتصلة", icon: Network },
  { id: "ports", label: "المنافذ والاتصالات", icon: Cable },
  { id: "alerts", label: "التنبيهات", icon: Bell },
];
const secondaryNavigation: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "backup", label: "الاتصال الاحتياطي", icon: GitBranch },
  { id: "activity", label: "سجل النشاط", icon: Activity },
  { id: "settings", label: "الإعدادات", icon: Settings2 },
];

const deviceTypes: Record<string, string> = {
  router: "راوتر", switch: "سويتش", "access-point": "نقطة وصول", firewall: "جدار ناري", server: "خادم",
};
const statusLabels: Record<string, string> = { online: "متصل", offline: "غير متصل", warning: "تحذير", connected: "نشط", standby: "جاهز", down: "منقطع" };

function DeviceGlyph({ type, size = 19 }: { type: string; size?: number }) {
  const Icon = type === "router" ? Router : type === "access-point" ? Wifi : type === "firewall" ? Shield : type === "server" ? Server : Network;
  return <Icon size={size} strokeWidth={1.8} />;
}

function relativeTime(value: string, reference: string) {
  const minutes = Math.max(0, Math.floor((new Date(reference).getTime() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  return `منذ ${Math.floor(hours / 24)} يوم`;
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Riyadh" }).format(new Date(value));
}

function StatusPill({ status }: { status: string }) {
  return <span className={`status-pill status-${status}`}><span className="status-dot" />{statusLabels[status] || status}</span>;
}

function SeverityIcon({ severity }: { severity: string }) {
  return <span className={`severity-icon severity-${severity}`}>{severity === "critical" ? <AlertCircle size={19} /> : severity === "warning" ? <AlertTriangle size={19} /> : <Info size={19} />}</span>;
}

function SectionIntro({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: React.ReactNode }) {
  return <div className="page-intro">
    <div className="intro-copy"><div className="breadcrumb"><span>الرئيسية</span><ChevronLeft size={14} /><span>{eyebrow}</span></div><h1>{title}</h1><p>{description}</p></div>
    {actions && <div className="heading-actions">{actions}</div>}
  </div>;
}

function MetricCard({ label, value, caption, icon: Icon, tone, detail }: { label: string; value: string | number; caption: string; icon: LucideIcon; tone: string; detail?: string }) {
  return <div className="metric-card">
    <div className="metric-top"><span className={`metric-icon tone-${tone}`}><Icon size={21} strokeWidth={1.9} /></span><span className="metric-decoration"><span /><span /><span /></span></div>
    <div className="metric-label">{label}</div>
    <div className="metric-value">{value}</div>
    <div className="metric-footer"><span className={`metric-mini-dot tone-${tone}`} />{caption}{detail && <span className="metric-detail">{detail}</span>}</div>
  </div>;
}

function TrafficChart({ samples, range, onRange, reference }: { samples: UsageSample[]; range: number; onRange: (range: number) => void; reference: string }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const cutoff = new Date(reference).getTime() - range * 60 * 60_000;
  const shown = samples.filter((sample) => new Date(sample.createdAt).getTime() >= cutoff);
  const values = shown.length ? shown : samples.slice(-1);
  const max = Math.max(200, Math.ceil(Math.max(...values.map((item) => Math.max(item.inbound, item.outbound)), 0) / 50) * 50);
  const x = (index: number) => 59 + index * (609 / Math.max(1, values.length - 1));
  const y = (value: number) => 204 - value / max * 174;
  const makeLine = (key: "inbound" | "outbound") => values.map((item, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(item[key]).toFixed(1)}`).join(" ");
  const makeArea = (key: "inbound" | "outbound") => values.length ? `${makeLine(key)} L${x(values.length - 1)},204 L${x(0)},204 Z` : "";
  const active = hovered !== null ? values[hovered] : null;
  function handleMove(event: MouseEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const position = (event.clientX - rect.left) / rect.width * 700;
    setHovered(Math.max(0, Math.min(values.length - 1, Math.round((position - 59) / 609 * Math.max(1, values.length - 1)))));
  }
  const tickIndices = values.length > 1 ? [0, .25, .5, .75, 1].map((p) => Math.round(p * (values.length - 1))) : [0];
  return <section className="surface-card traffic-card">
    <div className="card-titlebar"><div><div className="card-heading">حركة مرور الشبكة</div><p className="card-subtitle">معدل نقل البيانات خلال آخر {range} ساعة</p></div><div className="chart-period"><select value={range} onChange={(event) => onRange(Number(event.target.value))} aria-label="الفترة الزمنية"><option value={24}>آخر 24 ساعة</option><option value={12}>آخر 12 ساعة</option><option value={6}>آخر 6 ساعات</option></select><ChevronDown size={14} /></div></div>
    <div className="chart-wrap">
      {values.length > 0 ? <><svg viewBox="0 0 700 230" preserveAspectRatio="none" className="traffic-svg" onMouseMove={handleMove} onMouseLeave={() => setHovered(null)} role="img" aria-label="رسم بياني لحركة مرور الشبكة">
        <defs><linearGradient id="inbound-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#11a88e" stopOpacity=".24" /><stop offset="100%" stopColor="#11a88e" stopOpacity="0" /></linearGradient><linearGradient id="outbound-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#7188ed" stopOpacity=".15" /><stop offset="100%" stopColor="#7188ed" stopOpacity="0" /></linearGradient></defs>
        {[0, 1, 2, 3, 4].map((index) => <g key={index}><line x1="59" x2="668" y1={30 + index * 43.5} y2={30 + index * 43.5} stroke="#edf1f4" strokeDasharray="4 5" /><text x="44" y={34 + index * 43.5} textAnchor="end" fill="#9ba6b3" fontSize="11" fontFamily="Arial">{Math.round(max - index * max / 4)}</text></g>)}
        <path d={makeArea("outbound")} fill="url(#outbound-fill)" /><path d={makeArea("inbound")} fill="url(#inbound-fill)" />
        <path d={makeLine("outbound")} fill="none" stroke="#8190ec" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /><path d={makeLine("inbound")} fill="none" stroke="#11a88e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {hovered !== null && active && <><line x1={x(hovered)} x2={x(hovered)} y1="30" y2="204" stroke="#c8d2d9" strokeDasharray="4 4" /><circle cx={x(hovered)} cy={y(active.inbound)} r="5.5" fill="#fff" stroke="#11a88e" strokeWidth="3" /><circle cx={x(hovered)} cy={y(active.outbound)} r="5" fill="#fff" stroke="#8190ec" strokeWidth="2.5" /></>}
      </svg><div className="chart-x-axis" dir="ltr">{tickIndices.map((index, i) => <span key={`${index}-${i}`}>{new Intl.DateTimeFormat("en-US", { hour: "2-digit", hour12: false, timeZone: "Asia/Riyadh" }).format(new Date(values[index].createdAt))}:00</span>)}</div>
      {active && <div className="chart-tooltip" style={{ left: `${Math.min(75, Math.max(13, x(hovered!) / 7))}%` }}><strong>{new Intl.DateTimeFormat("ar-EG", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Riyadh" }).format(new Date(active.createdAt))}</strong><span>الوارد: {active.inbound} Mbps</span><span>الصادر: {active.outbound} Mbps</span></div>}</> : <div className="empty-chart">لا تتوفر بيانات حركة مرور بعد. شغّل الفحص لبدء التسجيل.</div>}
    </div>
    <div className="chart-footer"><div className="chart-legend"><span><i className="legend-dot incoming" />حركة واردة</span><span><i className="legend-dot outgoing" />حركة صادرة</span></div><span className="chart-unit">القياس: Mbps</span></div>
  </section>;
}

function BackupCard({ primary, backup, autoFailover, onOpen }: { primary?: NetworkUplink; backup?: NetworkUplink; autoFailover: boolean; onOpen: () => void }) {
  return <section className="backup-card">
    <div className="backup-glow" /><div className="backup-card-content">
      <div className="backup-card-head"><span className="backup-card-icon"><GitBranch size={20} /></span><span className="backup-ready"><span />{backup?.status === "down" ? "غير متاح" : "جاهز للعمل"}</span></div>
      <div className="backup-card-title">الاتصال الاحتياطي</div><p className="backup-card-desc">{backup?.active ? "تم التحويل إلى المسار الاحتياطي للحفاظ على استمرارية الشبكة." : "اتصال إضافي يبقي شبكتك متصلة مهما حدث."}</p>
      <div className="connection-visual"><div className="connection-track" /><div className="connection-item"><span className={`connection-node ${primary?.active ? "node-active" : "node-muted"}`}><Globe2 size={18} /></span><div><strong>الاتصال الرئيسي</strong><small>{primary?.provider || "غير محدد"} · {primary?.technology || ""}</small></div><span className={`connection-tag ${primary?.active ? "active" : primary?.status === "down" ? "down" : ""}`}>{primary?.status === "down" ? "منقطع" : primary?.active ? "نشط" : "احتياطي"}</span></div><div className="connection-item"><span className={`connection-node ${backup?.active ? "node-active" : "node-standby"}`}><Radio size={18} /></span><div><strong>الاتصال الاحتياطي</strong><small>{backup?.provider || "غير محدد"} · {backup?.technology || ""}</small></div><span className={`connection-tag ${backup?.active ? "active" : backup?.status === "down" ? "down" : ""}`}>{backup?.status === "down" ? "منقطع" : backup?.active ? "نشط" : "جاهز"}</span></div></div>
      <div className="backup-card-foot"><span><Zap size={15} />التحويل التلقائي {autoFailover ? "مفعّل" : "متوقف"}</span><button onClick={onOpen}>إدارة الاتصال <ArrowUpLeft size={16} /></button></div>
    </div>
  </section>;
}

function DeviceTable({ devices: list, compact = false, onSelect }: { devices: NetworkDevice[]; compact?: boolean; onSelect: (id: number) => void }) {
  return <div className={`device-table ${compact ? "compact-table" : "full-table"}`}>
    <div className="device-table-head"><span>الجهاز</span><span>عنوان IP</span>{!compact && <span>الموقع</span>}<span>الحالة</span><span>المنافذ</span><span>الاستهلاك</span><span /></div>
    {list.map((device) => <button className="device-row" key={device.id} onClick={() => onSelect(device.id)}>
      <span className="device-identity"><span className={`device-type-icon device-${device.type}`}><DeviceGlyph type={device.type} /></span><span className="device-text"><strong>{device.name}</strong><small>{deviceTypes[device.type] || device.type} · {device.model || "بدون موديل"}</small></span></span>
      <span className="ip-text" dir="ltr">{device.ipAddress}</span>
      {!compact && <span className="cell-muted">{device.location}</span>}
      <span><StatusPill status={device.status} /></span>
      <span className="ports-count" dir="ltr">{device.usedPorts}/{device.portCount}</span>
      <span className="usage-cell"><span>{device.bandwidthUsage}%</span><span className="usage-track"><i style={{ width: `${device.bandwidthUsage}%` }} className={device.bandwidthUsage >= 80 ? "high" : ""} /></span></span>
      <span className="row-arrow"><ChevronLeft size={16} /></span>
    </button>)}
  </div>;
}

function Modal({ children, onClose, wide = false }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><div className={`modal-panel ${wide ? "modal-wide" : ""}`} onMouseDown={(event) => event.stopPropagation()}>{children}</div></div>;
}

function DeviceFormModal({ device, onClose, onSubmit, busy }: { device?: NetworkDevice; onClose: () => void; onSubmit: (values: ActionPayload) => Promise<boolean>; busy: boolean }) {
  const [form, setForm] = useState({ name: device?.name || "", type: device?.type || "switch", ipAddress: device?.ipAddress || "", macAddress: device?.macAddress || "", location: device?.location || "", model: device?.model || "", monitoringPort: String(device?.monitoringPort || 80), portCount: String(device?.portCount || 24), capacityMbps: String(device?.capacityMbps || 1000), snmpCommunity: "" });
  const set = (field: string, value: string) => setForm((previous) => ({ ...previous, [field]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    const success = await onSubmit({ ...form, ...(device ? { id: device.id, snmpCommunity: form.snmpCommunity || (device.snmpEnabled ? "__keep__" : "") } : {}) });
    if (success) onClose();
  }
  return <Modal onClose={onClose} wide><div className="modal-header"><div><span className="modal-eyebrow">إدارة الأجهزة</span><h2>{device ? "تعديل بيانات الجهاز" : "إضافة جهاز جديد"}</h2><p>أدخل بيانات الجهاز لبدء متابعته من لوحة الشبكة.</p></div><button className="icon-button modal-close" onClick={onClose} aria-label="إغلاق"><X size={20} /></button></div>
    <form onSubmit={submit} className="modal-form"><div className="form-grid"><label className="field"><span>اسم الجهاز <b>*</b></span><input required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="مثال: سويتش الطابق الأول" /></label><label className="field"><span>نوع الجهاز</span><select value={form.type} onChange={(e) => set("type", e.target.value)}><option value="router">راوتر</option><option value="switch">سويتش</option><option value="access-point">نقطة وصول</option><option value="firewall">جدار ناري</option><option value="server">خادم</option></select></label>
    <label className="field"><span>عنوان IP أو اسم المضيف <b>*</b></span><input required dir="ltr" value={form.ipAddress} onChange={(e) => set("ipAddress", e.target.value)} placeholder="192.168.1.10" /></label><label className="field"><span>منفذ فحص TCP</span><input type="number" min="1" max="65535" dir="ltr" value={form.monitoringPort} onChange={(e) => set("monitoringPort", e.target.value)} /></label>
    <label className="field"><span>الموقع</span><input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="غرفة السيرفرات" /></label><label className="field"><span>الموديل</span><input value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="Cisco Catalyst 9300" /></label>
    <label className="field"><span>عنوان MAC</span><input dir="ltr" value={form.macAddress} onChange={(e) => set("macAddress", e.target.value)} placeholder="AA:BB:CC:DD:EE:FF" /></label><label className="field"><span>عدد المنافذ {!device && <b>*</b>}</span><input type="number" min="1" max="96" dir="ltr" disabled={Boolean(device)} value={form.portCount} onChange={(e) => set("portCount", e.target.value)} /></label>
    <label className="field"><span>سعة الاتصال (Mbps)</span><input type="number" min="1" dir="ltr" value={form.capacityMbps} onChange={(e) => set("capacityMbps", e.target.value)} /></label><label className="field"><span>SNMP Community <em>اختياري</em></span><input dir="ltr" type="password" value={form.snmpCommunity} onChange={(e) => set("snmpCommunity", e.target.value)} placeholder={device?.snmpEnabled ? "اتركه فارغًا للإبقاء على القيمة الحالية" : "للتحقق من المنافذ والاستهلاك"} /></label></div>
    <div className="form-hint"><Info size={16} /> يتم فحص توفر الجهاز عبر TCP. عند إضافة SNMP v2c تُقرأ حالة المنافذ وحركة البيانات تلقائيًا في وضع المراقبة المباشرة.</div>
    <div className="modal-actions"><button type="button" className="button button-ghost" onClick={onClose}>إلغاء</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? "جارٍ الحفظ..." : device ? "حفظ التغييرات" : "إضافة الجهاز"}</button></div></form>
  </Modal>;
}

function DeviceDetailsModal({ device, ports: devicePorts, reference, onClose, onEdit, onDelete, onPort }: { device: NetworkDevice; ports: NetworkPort[]; reference: string; onClose: () => void; onEdit: () => void; onDelete: () => void; onPort: (id: number) => void }) {
  const [tab, setTab] = useState<"overview" | "ports">("overview");
  return <Modal onClose={onClose} wide><div className="modal-header detail-heading"><div className="detail-device-title"><span className={`device-type-icon detail-icon device-${device.type}`}><DeviceGlyph type={device.type} size={24} /></span><div><span className="modal-eyebrow">تفاصيل الجهاز · {deviceTypes[device.type]}</span><h2>{device.name}</h2><StatusPill status={device.status} /></div></div><button className="icon-button modal-close" onClick={onClose} aria-label="إغلاق"><X size={20} /></button></div>
    <div className="modal-tabs"><button className={tab === "overview" ? "selected" : ""} onClick={() => setTab("overview")}>نظرة عامة</button><button className={tab === "ports" ? "selected" : ""} onClick={() => setTab("ports")}>المنافذ ({devicePorts.length})</button></div>
    {tab === "overview" ? <div className="detail-body"><div className="detail-stat-row"><div><span>حالة الاتصال</span><strong>{statusLabels[device.status]}</strong></div><div><span>زمن الاستجابة</span><strong>{device.latency ? `${device.latency} ms` : "—"}</strong></div><div><span>المنافذ المستخدمة</span><strong>{device.usedPorts} / {device.portCount}</strong></div><div><span>الاستهلاك</span><strong>{device.bandwidthUsage}%</strong></div></div><div className="detail-info-grid"><div><span>عنوان IP</span><strong dir="ltr">{device.ipAddress}</strong></div><div><span>عنوان MAC</span><strong dir="ltr">{device.macAddress || "—"}</strong></div><div><span>الموقع</span><strong>{device.location}</strong></div><div><span>الموديل</span><strong>{device.model || "—"}</strong></div><div><span>منفذ الفحص</span><strong dir="ltr">{device.monitoringPort}</strong></div><div><span>مراقبة SNMP</span><strong>{device.snmpEnabled ? "مفعّلة" : "غير مفعّلة"}</strong></div><div><span>آخر فحص</span><strong>{device.lastChecked ? relativeTime(device.lastChecked, reference) : "لم يُفحص بعد"}</strong></div><div><span>سعة الاتصال</span><strong>{device.capacityMbps} Mbps</strong></div></div></div> : <div className="detail-body"><div className="detail-ports-heading"><strong>خريطة المنافذ</strong><span><i className="port-dot occupied" /> مستخدم <i className="port-dot" /> فارغ</span></div><div className="ports-grid modal-ports-grid">{devicePorts.map((port) => <button key={port.id} title={`منفذ ${port.number} · ${port.connectedTo || "فارغ"}`} className={`port-tile ${port.status === "active" ? "port-active" : ""}`} onClick={() => onPort(port.id)}><span className="port-tile-light" /><Cable size={15} /><strong>{String(port.number).padStart(2, "0")}</strong></button>)}</div><p className="detail-port-hint">اضغط على أي منفذ لتحديث حالته أو الجهاز المتصل به.</p></div>}
    <div className="modal-actions detail-actions"><button className="button button-danger-text" onClick={onDelete}><Trash2 size={16} />حذف الجهاز</button><div><button className="button button-ghost" onClick={onClose}>إغلاق</button><button className="button button-primary" onClick={onEdit}><Pencil size={16} />تعديل البيانات</button></div></div>
  </Modal>;
}

function PortFormModal({ port, device, onClose, onSubmit, busy }: { port: NetworkPort; device?: NetworkDevice; onClose: () => void; onSubmit: (values: ActionPayload) => Promise<boolean>; busy: boolean }) {
  const [status, setStatus] = useState(port.status);
  const [connectedTo, setConnectedTo] = useState(port.connectedTo);
  const [name, setName] = useState(port.name);
  const [speed, setSpeed] = useState(port.speed);
  async function submit(event: FormEvent) { event.preventDefault(); if (await onSubmit({ id: port.id, status, connectedTo, name, speed })) onClose(); }
  return <Modal onClose={onClose}><div className="modal-header"><div><span className="modal-eyebrow">{device?.name || "الجهاز"}</span><h2>تعديل المنفذ {port.number}</h2><p>حدّد حالة المنفذ والجهاز المتصل به.</p></div><button className="icon-button modal-close" onClick={onClose} aria-label="إغلاق"><X size={20} /></button></div><form className="modal-form" onSubmit={submit}><div className="form-grid"><label className="field"><span>حالة المنفذ</span><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="active">مستخدم / متصل</option><option value="empty">فارغ</option></select></label><label className="field"><span>اسم المنفذ</span><input value={name} onChange={(e) => setName(e.target.value)} /></label><label className="field"><span>الجهاز المتصل</span><input disabled={status !== "active"} value={connectedTo} onChange={(e) => setConnectedTo(e.target.value)} placeholder="مثال: مكتب الإدارة" /></label><label className="field"><span>سرعة المنفذ</span><select value={speed} onChange={(e) => setSpeed(e.target.value)}><option>100 Mbps</option><option>1 Gbps</option><option>2.5 Gbps</option><option>10 Gbps</option><option>40 Gbps</option></select></label></div><div className="modal-actions"><button type="button" className="button button-ghost" onClick={onClose}>إلغاء</button><button className="button button-primary" disabled={busy}>{busy ? "جارٍ الحفظ..." : "حفظ المنفذ"}</button></div></form></Modal>;
}

function UplinkFormModal({ link, onClose, onSubmit, busy }: { link: NetworkUplink; onClose: () => void; onSubmit: (values: ActionPayload) => Promise<boolean>; busy: boolean }) {
  const [form, setForm] = useState({ name: link.name, provider: link.provider, technology: link.technology, address: link.address, port: String(link.port), sourceAddress: link.sourceAddress });
  const set = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));
  async function submit(event: FormEvent) { event.preventDefault(); if (await onSubmit({ ...form, id: link.id })) onClose(); }
  return <Modal onClose={onClose}><div className="modal-header"><div><span className="modal-eyebrow">إعدادات الاتصال</span><h2>تعديل {link.name}</h2><p>خصص نقطة الفحص ومصدر الاتصال لهذا المسار.</p></div><button className="icon-button modal-close" onClick={onClose} aria-label="إغلاق"><X size={20} /></button></div><form className="modal-form" onSubmit={submit}><div className="form-grid"><label className="field"><span>اسم الاتصال</span><input required value={form.name} onChange={(e) => set("name", e.target.value)} /></label><label className="field"><span>مزود الخدمة</span><input required value={form.provider} onChange={(e) => set("provider", e.target.value)} /></label><label className="field"><span>نوع الاتصال</span><input value={form.technology} onChange={(e) => set("technology", e.target.value)} placeholder="Fiber / 5G" /></label><label className="field"><span>عنوان وجهة الفحص</span><input required dir="ltr" value={form.address} onChange={(e) => set("address", e.target.value)} /></label><label className="field"><span>منفذ الفحص</span><input type="number" min="1" max="65535" dir="ltr" value={form.port} onChange={(e) => set("port", e.target.value)} /></label><label className="field"><span>عنوان واجهة الخروج <em>اختياري</em></span><input dir="ltr" value={form.sourceAddress} onChange={(e) => set("sourceAddress", e.target.value)} placeholder="عنوان IP المحلي للواجهة" /></label></div><div className="form-hint"><Info size={16} /> لتحديد المسار بدقة، أدخل عنوان IP المحلي لواجهة الشبكة الخاصة بكل اتصال في حقل واجهة الخروج.</div><div className="modal-actions"><button type="button" className="button button-ghost" onClick={onClose}>إلغاء</button><button className="button button-primary" disabled={busy}>{busy ? "جارٍ الحفظ..." : "حفظ الاتصال"}</button></div></form></Modal>;
}

function SettingsPanel({ settings: current, onSave, busy, onNotifications }: { settings: NetworkSettings; onSave: (values: ActionPayload) => Promise<boolean>; busy: boolean; onNotifications: () => void }) {
  const [draft, setDraft] = useState({ liveMonitoring: current.liveMonitoring, autoFailover: current.autoFailover, bandwidthThreshold: current.bandwidthThreshold, alertWebhookUrl: current.alertWebhookUrl, failoverWebhookUrl: current.failoverWebhookUrl });
  const [permission, setPermission] = useState("default");
  useEffect(() => { if (typeof Notification !== "undefined") setPermission(Notification.permission); }, []);
  async function enableNotifications() { onNotifications(); if (typeof Notification !== "undefined") { const result = await Notification.requestPermission(); setPermission(result); } }
  return <div className="settings-layout"><section className="surface-card settings-card"><div className="section-card-head"><span className="section-icon green"><Activity size={20} /></span><div><h2>إعدادات المراقبة</h2><p>تحكم في طريقة فحص الشبكة والتنبيهات.</p></div></div>
    <div className="setting-row"><div><strong>المراقبة المباشرة</strong><p>فحص الأجهزة والاتصالات الحقيقية عبر الخادم بدل البيانات التجريبية.</p></div><button type="button" className={`toggle-switch ${draft.liveMonitoring ? "on" : ""}`} aria-label="تفعيل المراقبة المباشرة" aria-pressed={draft.liveMonitoring} onClick={() => setDraft({ ...draft, liveMonitoring: !draft.liveMonitoring })}><span /></button></div>
    <div className="setting-row"><div><strong>التحويل التلقائي للاتصال الاحتياطي</strong><p>تفعيل الاتصال الاحتياطي عند اكتشاف انقطاع الاتصال الرئيسي.</p></div><button type="button" className={`toggle-switch ${draft.autoFailover ? "on" : ""}`} aria-label="التحويل التلقائي" aria-pressed={draft.autoFailover} onClick={() => setDraft({ ...draft, autoFailover: !draft.autoFailover })}><span /></button></div>
    <div className="setting-row threshold-row"><div><strong>حد التنبيه للاستهلاك</strong><p>يصدر تنبيه عند تجاوز الجهاز هذه النسبة من سعته عبر SNMP.</p></div><div className="threshold-control"><input type="range" min="20" max="100" value={draft.bandwidthThreshold} onChange={(e) => setDraft({ ...draft, bandwidthThreshold: Number(e.target.value) })} /><strong>{draft.bandwidthThreshold}%</strong></div></div>
    <div className="settings-callout"><Info size={17} /><span>في الوضع المباشر، يجب أن يتمكن خادم التطبيق من الوصول إلى عناوين الأجهزة. قراءة حركة البيانات والمنافذ تتطلب تهيئة SNMP على الجهاز.</span></div>
  </section>
  <section className="surface-card settings-card"><div className="section-card-head"><span className="section-icon purple"><Bell size={20} /></span><div><h2>قنوات التنبيهات</h2><p>استقبل إشعارات الأعطال بالطريقة المناسبة لك.</p></div></div>
    <div className="setting-row"><div><strong>إشعارات المتصفح</strong><p>إشعار فوري عند ظهور تنبيه جديد أثناء فتح لوحة التحكم.</p></div><button className="button button-outline small-button" onClick={enableNotifications}>{permission === "granted" ? <><Check size={15} /> مفعّلة</> : "تفعيل الإشعارات"}</button></div>
    <div className="webhook-fields"><label className="field"><span>رابط Webhook للتنبيهات <em>اختياري</em></span><input dir="ltr" type="url" value={draft.alertWebhookUrl} onChange={(e) => setDraft({ ...draft, alertWebhookUrl: e.target.value })} placeholder="https://example.com/network-alerts" /><small>يرسل طلب POST مع تفاصيل التنبيه الجديد.</small></label><label className="field"><span>رابط Webhook للتحويل الفعلي <em>اختياري</em></span><input dir="ltr" type="url" value={draft.failoverWebhookUrl} onChange={(e) => setDraft({ ...draft, failoverWebhookUrl: e.target.value })} placeholder="https://router.example.com/failover" /><small>اربطه بأتمتة الراوتر لتغيير مسار الشبكة فعليًا.</small></label></div>
  </section>
  <div className="settings-footer"><div><ShieldCheck size={18} /><span>يتم حفظ إعداداتك بأمان على الخادم.</span></div><button className="button button-primary" disabled={busy} onClick={() => onSave(draft)}>{busy ? "جارٍ الحفظ..." : "حفظ الإعدادات"}</button></div>
  <section className="surface-card schedule-card"><div className="section-card-head"><span className="section-icon blue"><Clock3 size={20} /></span><div><h2>الفحص المستمر</h2><p>يبقى الفحص نشطًا كل 30 ثانية أثناء فتح اللوحة.</p></div></div><p>للمراقبة حتى عند إغلاق المتصفح، شغّل مهمة مجدولة تستدعي <code>GET /api/monitor</code> وأرسل الترويسة <code>Authorization: Bearer MONITOR_TOKEN</code> بعد ضبط المتغير البيئي على الخادم.</p></section>
  </div>;
}

export function NetworkDashboard({ initialData }: { initialData: DashboardData }) {
  const [data, setData] = useState(initialData);
  const [view, setView] = useState<View>("dashboard");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [deviceSearch, setDeviceSearch] = useState("");
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [deviceSort, setDeviceSort] = useState("default");
  const [alertFilter, setAlertFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState("all");
  const [chartRange, setChartRange] = useState(24);
  const [selectedDeviceId, setSelectedDeviceId] = useState(initialData.devices[1]?.id || initialData.devices[0]?.id || 0);
  const [detailDeviceId, setDetailDeviceId] = useState<number | null>(null);
  const [formDeviceId, setFormDeviceId] = useState<number | "new" | null>(null);
  const [portFormId, setPortFormId] = useState<number | null>(null);
  const [uplinkFormId, setUplinkFormId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  const knownAlerts = useRef(new Set(initialData.alerts.map((alert) => alert.id)));
  const polling = useRef(false);
  const searchInput = useRef<HTMLInputElement>(null);

  const receiveData = useCallback((next: DashboardData) => {
    const fresh = next.alerts.filter((alert) => !knownAlerts.current.has(alert.id) && !alert.acknowledged);
    next.alerts.forEach((alert) => knownAlerts.current.add(alert.id));
    setData(next);
    if (fresh.length && typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(`رَصْد: ${fresh[0].title}`, { body: fresh[0].description });
    }
  }, []);

  const action = useCallback(async (name: string, values: ActionPayload = {}, silent = false): Promise<boolean> => {
    if (!silent) setBusy(name);
    try {
      const response = await fetch("/api/dashboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: name, ...values }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذر تنفيذ العملية.");
      receiveData(result.data);
      if (!silent) setToast({ message: result.message || "تمت العملية بنجاح", error: false });
      return true;
    } catch (error) {
      if (!silent) setToast({ message: error instanceof Error ? error.message : "حدث خطأ غير متوقع", error: true });
      return false;
    } finally { if (!silent) setBusy(""); }
  }, [receiveData]);

  useEffect(() => {
    const timer = window.setInterval(async () => {
      if (document.visibilityState === "hidden" || polling.current) return;
      polling.current = true;
      try {
        if (data.settings.liveMonitoring) await action("scan", {}, true);
        else { const response = await fetch("/api/dashboard", { cache: "no-store" }); if (response.ok) receiveData(await response.json()); }
      } catch { /* Keep the last successful snapshot visible. */ }
      finally { polling.current = false; }
    }, 30000);
    return () => window.clearInterval(timer);
  }, [data.settings.liveMonitoring, action, receiveData]);

  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 4200); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => { const close = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchInput.current?.focus(); return; } if (event.key === "Escape") { setDetailDeviceId(null); setFormDeviceId(null); setPortFormId(null); setUplinkFormId(null); setDeleteId(null); setNotificationsOpen(false); } }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, []);

  function navigate(target: View) { setView(target); setMobileMenu(false); setNotificationsOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function exportDevices() {
    const headings = ["اسم الجهاز", "النوع", "عنوان IP", "عنوان MAC", "الموقع", "الموديل", "الحالة", "المنافذ المستخدمة", "إجمالي المنافذ", "الاستهلاك %"];
    const rows = data.devices.map((d) => [d.name, deviceTypes[d.type] || d.type, d.ipAddress, d.macAddress, d.location, d.model, statusLabels[d.status] || d.status, d.usedPorts, d.portCount, d.bandwidthUsage]);
    const csv = "\uFEFF" + [headings, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `rasd-network-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
    setToast({ message: "تم تصدير تقرير الأجهزة بنجاح", error: false });
  }
  const unread = data.alerts.filter((alert) => !alert.acknowledged);
  const onlineCount = data.devices.filter((device) => device.status === "online").length;
  const connectedCount = data.devices.filter((device) => device.status !== "offline").length;
  const offlineCount = data.devices.filter((device) => device.status === "offline").length;
  const primary = data.uplinks.find((link) => link.isPrimary);
  const backup = data.uplinks.find((link) => !link.isPrimary);
  const activeLink = data.uplinks.find((link) => link.active);
  const occupiedPorts = data.devices.reduce((sum, device) => sum + device.usedPorts, 0);
  const totalPorts = data.devices.reduce((sum, device) => sum + device.portCount, 0);
  const averageUsage = data.devices.length ? Math.round(data.devices.reduce((sum, device) => sum + device.bandwidthUsage, 0) / data.devices.length) : 0;
  const selectedDevice = data.devices.find((device) => device.id === selectedDeviceId) || data.devices[0];
  const detailDevice = data.devices.find((device) => device.id === detailDeviceId);
  const formDevice = data.devices.find((device) => device.id === formDeviceId);
  const editingPort = data.ports.find((port) => port.id === portFormId);
  const editingUplink = data.uplinks.find((link) => link.id === uplinkFormId);
  const deletingDevice = data.devices.find((device) => device.id === deleteId);

  function renderDashboard() {
    return <>
      <SectionIntro eyebrow="لوحة التحكم" title="لوحة التحكم" description="كل ما تحتاج لمعرفته عن شبكتك، في مكان واحد." actions={<><span className={`mode-chip ${data.settings.liveMonitoring ? "live" : ""}`}><span />{data.settings.liveMonitoring ? "مراقبة مباشرة" : "وضع العرض التجريبي"}</span><button className="button button-outline" onClick={exportDevices}><Download size={16} /> تصدير تقرير</button><button className="button button-primary" disabled={busy === "scan"} onClick={() => action("scan")}><RefreshCw size={16} className={busy === "scan" ? "spinning" : ""} />{busy === "scan" ? "جارٍ الفحص..." : "فحص الشبكة"}</button></>} />
      <div className={`overview-banner ${backup?.active ? "banner-backup" : ""}`}><div className="banner-main"><span className="banner-icon"><ShieldCheck size={23} /></span><div><strong>{backup?.active ? "الاتصال الاحتياطي يعمل الآن" : primary?.status === "down" ? "الاتصال الرئيسي منقطع" : "شبكتك تحت المراقبة"}</strong><p>{backup?.active ? "تم تحويل حركة الشبكة إلى المسار الاحتياطي للحفاظ على استمرارية الخدمة." : `الاتصال الرئيسي ${primary?.provider || ""} نشط، والاتصال الاحتياطي ${backup?.provider || ""} جاهز عند الحاجة.`}</p></div></div><button className="banner-link" onClick={() => navigate("backup")}>تفاصيل الاتصال <ArrowUpLeft size={16} /></button></div>
      <div className="stats-grid"><MetricCard label="إجمالي الأجهزة" value={data.devices.length} caption="جهاز مسجل في الشبكة" icon={Network} tone="teal" /><MetricCard label="الأجهزة المتصلة" value={connectedCount} caption={`من أصل ${data.devices.length} أجهزة`} icon={CheckCircle2} tone="green" detail={offlineCount ? `${offlineCount} غير متصل` : undefined} /><MetricCard label="التنبيهات النشطة" value={unread.length} caption="تنبيه يحتاج إلى متابعة" icon={Bell} tone="orange" /><MetricCard label="متوسط الاستهلاك" value={`${averageUsage}%`} caption="من سعة الأجهزة المسجلة" icon={Activity} tone="purple" /></div>
      <div className="dashboard-grid-top"><TrafficChart samples={data.samples} range={chartRange} onRange={setChartRange} reference={data.generatedAt} /><BackupCard primary={primary} backup={backup} autoFailover={data.settings.autoFailover} onOpen={() => navigate("backup")} /></div>
      <div className="dashboard-grid-bottom"><section className="surface-card dashboard-devices"><div className="card-titlebar"><div><div className="card-heading">الأجهزة المتصلة</div><p className="card-subtitle">نظرة سريعة على الأجهزة في شبكتك</p></div><button className="text-link" onClick={() => navigate("devices")}>عرض جميع الأجهزة <ChevronLeft size={17} /></button></div><DeviceTable devices={data.devices.slice(0, 5)} compact onSelect={setDetailDeviceId} /><button className="card-bottom-link" onClick={() => navigate("devices")}>عرض جميع الأجهزة ({data.devices.length}) <ArrowUpLeft size={15} /></button></section>
      <section className="surface-card dashboard-alerts"><div className="card-titlebar"><div><div className="card-heading">آخر التنبيهات</div><p className="card-subtitle">ابقَ على اطلاع بما يحدث</p></div><span className="alert-count">{unread.length}</span></div><div className="alert-preview-list">{data.alerts.slice(0, 3).map((alert) => <button className="alert-preview" key={alert.id} onClick={() => navigate("alerts")}><SeverityIcon severity={alert.severity} /><span className="alert-preview-text"><strong>{alert.title}</strong><small>{alert.description}</small><em>{relativeTime(alert.createdAt, data.generatedAt)}</em></span></button>)}</div><button className="card-bottom-link" onClick={() => navigate("alerts")}>عرض جميع التنبيهات <ArrowUpLeft size={15} /></button></section></div>
      <div className="dashboard-footer-line"><span><span className="live-pulse" /> آخر تحديث {relativeTime(data.generatedAt, new Date(new Date(data.generatedAt).getTime() + 1000).toISOString())}</span><span>رَصْد · نظام مراقبة الشبكة الذكي</span></div>
    </>;
  }

  function renderDevices() {
    const filtered = data.devices.filter((device) => {
      const matchesText = `${device.name} ${device.ipAddress} ${device.location} ${device.model}`.toLowerCase().includes(deviceSearch.toLowerCase());
      const matchesType = deviceFilter === "all" || (deviceFilter === "other" ? ["firewall", "server"].includes(device.type) : device.type === deviceFilter);
      return matchesText && matchesType;
    }).sort((a, b) => deviceSort === "status" ? ({ offline: 0, warning: 1, online: 2 }[a.status as "offline" | "warning" | "online"] ?? 3) - ({ offline: 0, warning: 1, online: 2 }[b.status as "offline" | "warning" | "online"] ?? 3) : deviceSort === "name" ? a.name.localeCompare(b.name, "ar") : a.id - b.id);
    return <><SectionIntro eyebrow="الأجهزة المتصلة" title="الأجهزة المتصلة" description="تابع جميع أجهزة شبكتك وحالتها من مكان واحد." actions={<><button className="button button-outline" onClick={exportDevices}><Download size={16} /> تصدير CSV</button><button className="button button-primary" onClick={() => setFormDeviceId("new")}><Plus size={18} /> إضافة جهاز</button></>} />
      <div className="mini-stats-grid"><div className="mini-stat"><span className="mini-stat-icon teal"><Network size={19} /></span><div><small>جميع الأجهزة</small><strong>{data.devices.length}</strong></div></div><div className="mini-stat"><span className="mini-stat-icon green"><CheckCircle2 size={19} /></span><div><small>تعمل بشكل طبيعي</small><strong>{onlineCount}</strong></div></div><div className="mini-stat"><span className="mini-stat-icon red"><AlertCircle size={19} /></span><div><small>تحتاج إلى انتباه</small><strong>{data.devices.length - onlineCount}</strong></div></div></div>
      <section className="surface-card list-card"><div className="list-toolbar"><div className="toolbar-search"><Search size={18} /><input value={deviceSearch} onChange={(e) => setDeviceSearch(e.target.value)} placeholder="ابحث باسم الجهاز أو عنوان IP..." /></div><div className="toolbar-right"><span className="result-count">{filtered.length} جهاز</span><div className="sort-select"><SlidersHorizontal size={16} /><select value={deviceSort} onChange={(e) => setDeviceSort(e.target.value)}><option value="default">الترتيب الافتراضي</option><option value="status">حسب الحالة</option><option value="name">حسب الاسم</option></select></div></div></div><div className="filter-tabs">{[["all", "جميع الأجهزة"], ["router", "الراوترات"], ["switch", "السويتشات"], ["access-point", "نقاط الوصول"], ["other", "أجهزة أخرى"]].map(([key, label]) => <button key={key} className={deviceFilter === key ? "selected" : ""} onClick={() => setDeviceFilter(key)}>{label}</button>)}</div>{filtered.length ? <DeviceTable devices={filtered} onSelect={setDetailDeviceId} /> : <div className="empty-state"><Search size={26} /><strong>لا توجد أجهزة مطابقة</strong><span>جرّب البحث بكلمات أخرى أو غيّر نوع الجهاز.</span></div>}</section>
    </>;
  }

  function renderPorts() {
    const devicePorts = selectedDevice ? data.ports.filter((port) => port.deviceId === selectedDevice.id) : [];
    return <><SectionIntro eyebrow="المنافذ والاتصالات" title="المنافذ والاتصالات" description="اعرف المنافذ المستخدمة والفارغة والأجهزة المتصلة بكل منفذ." actions={<button className="button button-primary" onClick={() => setFormDeviceId("new")}><Plus size={18} /> إضافة جهاز</button>} />
      <div className="mini-stats-grid"><div className="mini-stat"><span className="mini-stat-icon teal"><Cable size={19} /></span><div><small>إجمالي المنافذ</small><strong>{totalPorts}</strong></div></div><div className="mini-stat"><span className="mini-stat-icon green"><CheckCircle2 size={19} /></span><div><small>منافذ مستخدمة</small><strong>{occupiedPorts}</strong></div></div><div className="mini-stat"><span className="mini-stat-icon blue"><Radio size={19} /></span><div><small>منافذ متاحة</small><strong>{totalPorts - occupiedPorts}</strong></div></div></div>
      <div className="ports-layout"><section className="surface-card ports-devices"><div className="ports-sidebar-title"><h2>الأجهزة</h2><span>{data.devices.length}</span></div><div className="ports-device-list">{data.devices.map((device) => <button key={device.id} className={`ports-device-option ${selectedDevice?.id === device.id ? "selected" : ""}`} onClick={() => setSelectedDeviceId(device.id)}><span className={`device-type-icon device-${device.type}`}><DeviceGlyph type={device.type} size={18} /></span><span><strong>{device.name}</strong><small>{device.usedPorts} من {device.portCount} منافذ مستخدمة</small></span><ChevronLeft size={15} /></button>)}</div></section>
      <section className="surface-card port-map-card">{selectedDevice ? <><div className="port-map-header"><div><div className="port-map-eyebrow">خريطة منافذ الجهاز</div><h2>{selectedDevice.name}</h2><p><span dir="ltr">{selectedDevice.ipAddress}</span> · {selectedDevice.location}</p></div><StatusPill status={selectedDevice.status} /></div><div className="port-progress-info"><div><strong>{selectedDevice.usedPorts} منفذ مستخدم</strong><span>{selectedDevice.portCount - selectedDevice.usedPorts} منفذ متاح</span></div><span>{Math.round(selectedDevice.usedPorts / selectedDevice.portCount * 100)}% إشغال</span></div><div className="port-progress-track"><span style={{ width: `${selectedDevice.usedPorts / selectedDevice.portCount * 100}%` }} /></div><div className="port-map-divider" /><div className="port-grid-head"><strong>المنافذ ({devicePorts.length})</strong><div><span><i className="port-dot occupied" /> مستخدم</span><span><i className="port-dot" /> فارغ</span></div></div><div className="ports-grid">{devicePorts.map((port) => <button key={port.id} title={`${port.name} · ${port.connectedTo || "منفذ فارغ"}`} className={`port-tile ${port.status === "active" ? "port-active" : ""}`} onClick={() => setPortFormId(port.id)}><span className="port-tile-light" /><Cable size={18} /><strong>{String(port.number).padStart(2, "0")}</strong></button>)}</div><div className="port-map-note"><Info size={17} /><span>اضغط على أي منفذ لمعرفة تفاصيله أو تحديث الجهاز المتصل به.</span></div></> : <div className="empty-state">لا توجد أجهزة لعرض منافذها.</div>}</section></div>
    </>;
  }

  function renderAlerts() {
    const critical = data.alerts.filter((a) => a.severity === "critical" && !a.acknowledged).length;
    const warning = data.alerts.filter((a) => a.severity === "warning" && !a.acknowledged).length;
    const filtered = data.alerts.filter((a) => alertFilter === "all" || (alertFilter === "unread" && !a.acknowledged) || a.severity === alertFilter);
    return <><SectionIntro eyebrow="التنبيهات" title="التنبيهات" description="لا يفوتك أي تغيير مهم في حالة الشبكة والأجهزة." actions={<button className="button button-outline" disabled={!unread.length || busy === "ackAll"} onClick={() => action("ackAll")}><CheckCheck size={17} /> تحديد الكل كمقروء</button>} />
      <div className="mini-stats-grid"><div className="mini-stat"><span className="mini-stat-icon purple"><Bell size={19} /></span><div><small>تنبيهات غير مقروءة</small><strong>{unread.length}</strong></div></div><div className="mini-stat"><span className="mini-stat-icon red"><AlertCircle size={19} /></span><div><small>تنبيهات حرجة</small><strong>{critical}</strong></div></div><div className="mini-stat"><span className="mini-stat-icon orange"><AlertTriangle size={19} /></span><div><small>تحذيرات</small><strong>{warning}</strong></div></div></div>
      <section className="surface-card alerts-list-card"><div className="filter-tabs alerts-tabs">{[["all", "جميع التنبيهات"], ["unread", "غير مقروءة"], ["critical", "حرجة"], ["warning", "تحذيرات"], ["info", "معلومات"]].map(([key, label]) => <button key={key} className={alertFilter === key ? "selected" : ""} onClick={() => setAlertFilter(key)}>{label}</button>)}</div>{filtered.length ? <div className="full-alert-list">{filtered.map((alert) => <div key={alert.id} className={`full-alert ${!alert.acknowledged ? "unread" : ""}`}><SeverityIcon severity={alert.severity} /><div className="full-alert-copy"><div className="full-alert-title"><strong>{alert.title}</strong>{!alert.acknowledged && <span className="unread-marker" />}</div><p>{alert.description}</p><span className="alert-source">{alert.source === "uplink" ? "الاتصال بالشبكة" : alert.source === "traffic" ? "حركة البيانات" : data.devices.find((d) => d.id === alert.deviceId)?.name || "النظام"} <span>·</span> {relativeTime(alert.createdAt, data.generatedAt)}</span></div><div className="full-alert-actions"><span className={`severity-label severity-label-${alert.severity}`}>{alert.severity === "critical" ? "حرج" : alert.severity === "warning" ? "تحذير" : "معلومة"}</span>{!alert.acknowledged && <button className="mark-read" onClick={() => action("ackAlert", { id: alert.id })}><Check size={15} /> تحديد كمقروء</button>}</div></div>)}</div> : <div className="empty-state"><CheckCircle2 size={27} /><strong>لا توجد تنبيهات هنا</strong><span>كل شيء يبدو جيدًا في الوقت الحالي.</span></div>}</section>
    </>;
  }

  function renderBackup() {
    return <><SectionIntro eyebrow="الاتصال الاحتياطي" title="الاتصال الاحتياطي" description="حافظ على استمرارية أعمالك حتى عند انقطاع الاتصال الرئيسي." actions={<span className={`mode-chip ${data.settings.liveMonitoring ? "live" : ""}`}><span />{data.settings.liveMonitoring ? "فحص مباشر" : "وضع تجريبي"}</span>} />
      <div className="failover-hero"><div className="failover-hero-copy"><div className="hero-kicker"><ShieldCheck size={17} /> حماية الاتصال مفعّلة</div><h2>{backup?.active ? "شبكتك تعمل عبر الاتصال الاحتياطي" : "شبكتك دائمًا على اتصال."}</h2><p>راقب مساري اتصالك، واختبر التحويل بينهما، واضبط الأتمتة التي تبقي شبكتك متاحة عند حدوث عطل.</p><div className="hero-features"><span><Check size={16} /> فحص حالة الاتصال</span><span><Check size={16} /> تحويل تلقائي</span><span><Check size={16} /> تنبيهات فورية</span></div></div><div className="failover-illustration"><span className="orbit orbit-one" /><span className="orbit orbit-two" /><span className="orbit-center"><GitBranch size={45} strokeWidth={1.3} /></span><span className="orbit-dot dot-one" /><span className="orbit-dot dot-two" /></div></div>
      <div className="uplinks-grid">{data.uplinks.map((link) => <section className="surface-card uplink-card" key={link.id}><div className="uplink-top"><span className={`uplink-icon ${link.isPrimary ? "primary-icon" : "backup-icon"}`}>{link.isPrimary ? <Globe2 size={25} /> : <Radio size={25} />}</span><span className={`uplink-status ${link.status}`}><span />{statusLabels[link.status] || link.status}</span></div><div className="uplink-eyebrow">{link.isPrimary ? "المسار الأساسي" : "مسار الطوارئ"}</div><h2>{link.name}</h2><p className="uplink-provider">{link.provider} · {link.technology}</p><div className="uplink-divider" /><div className="uplink-properties"><div><span>حالة المسار</span><strong>{link.active ? "نشط الآن" : link.status === "down" ? "غير متاح" : "على أهبة الاستعداد"}</strong></div><div><span>زمن الاستجابة</span><strong dir="ltr">{link.latency ? `${link.latency} ms` : "—"}</strong></div><div><span>وجهة الفحص</span><strong dir="ltr">{link.address}:{link.port}</strong></div><div><span>واجهة الخروج</span><strong dir="ltr">{link.sourceAddress || "افتراضية"}</strong></div></div><button className="uplink-edit" onClick={() => setUplinkFormId(link.id)}><Pencil size={15} /> تعديل إعدادات الاتصال <ChevronLeft size={16} /></button></section>)}</div>
      <div className="backup-controls-grid"><section className="surface-card automation-card"><div className="section-card-head"><span className="section-icon green"><Zap size={20} /></span><div><h2>التحويل التلقائي</h2><p>اجعل شبكتك تتصرف بذكاء عند الانقطاع.</p></div></div><div className="setting-row"><div><strong>تفعيل التحويل التلقائي</strong><p>إذا انقطع المسار الرئيسي وكان الاحتياطي متاحًا، يتم تفعيله عند الفحص التالي.</p></div><button className={`toggle-switch ${data.settings.autoFailover ? "on" : ""}`} aria-label="التحويل التلقائي" aria-pressed={data.settings.autoFailover} onClick={() => action("saveSettings", { ...data.settings, autoFailover: !data.settings.autoFailover })}><span /></button></div><div className="automation-note"><Info size={16} /> التحويل داخل النظام يغيّر المسار النشط المعروض. التحويل الفعلي لحركة الشبكة يحتاج ربط الراوتر عبر Webhook من الإعدادات.</div></section>
      <section className="surface-card switch-card"><div className="section-card-head"><span className="section-icon blue"><ArrowRightLeft size={20} /></span><div><h2>اختبار الاتصال الاحتياطي</h2><p>جرّب سيناريو الانقطاع وتأكد من جاهزية المسار البديل.</p></div></div><p className="switch-explainer">{backup?.active ? "المسار الاحتياطي يعمل حاليًا. يمكنك العودة إلى الاتصال الرئيسي في أي وقت." : data.settings.liveMonitoring ? "يمكنك تفعيل المسار الاحتياطي يدويًا. يتطلب تحويل حركة الشبكة الفعلي إعداد Webhook." : "في وضع العرض، الاختبار يحاكي انقطاع الاتصال الرئيسي دون التأثير على شبكتك الفعلية."}</p><button className={`button ${backup?.active ? "button-outline" : "button-primary"}`} disabled={busy === "switchUplink"} onClick={() => action("switchUplink", { target: backup?.active ? "primary" : "backup" })}>{backup?.active ? <><RefreshCw size={17} /> استعادة الاتصال الرئيسي</> : <><Zap size={17} /> {data.settings.liveMonitoring ? "تفعيل الاحتياطي يدويًا" : "محاكاة انقطاع الاتصال"}</>}</button></section></div>
      <div className="backup-info-strip"><ShieldCheck size={18} /><span>للمراقبة الدقيقة لكل اتصال، اربط واجهة خروج منفصلة بكل مسار وحدد وجهة فحص يمكن الوصول إليها عبره.</span><button onClick={() => navigate("settings")}>إعداد Webhook <ArrowUpLeft size={15} /></button></div>
    </>;
  }

  function renderActivity() {
    const list = data.activity.filter((item) => activityFilter === "all" || (activityFilter === "issues" ? ["critical", "warning"].includes(item.type) : item.type === activityFilter));
    return <><SectionIntro eyebrow="سجل النشاط" title="سجل النشاط" description="تاريخ التغييرات والأحداث التي جرت على شبكتك." actions={<button className="button button-outline" onClick={() => action("scan")} disabled={busy === "scan"}><RefreshCw size={16} className={busy === "scan" ? "spinning" : ""} /> تحديث النشاط</button>} /><section className="surface-card activity-card"><div className="filter-tabs">{[["all", "جميع الأنشطة"], ["issues", "الأعطال والتحذيرات"], ["success", "عمليات ناجحة"], ["info", "النظام"]].map(([key, label]) => <button key={key} className={activityFilter === key ? "selected" : ""} onClick={() => setActivityFilter(key)}>{label}</button>)}</div>{list.length ? <div className="timeline">{list.map((item: ActivityEvent) => <div className="timeline-item" key={item.id}><span className={`timeline-icon timeline-${item.type}`}>{item.type === "critical" ? <AlertCircle size={18} /> : item.type === "warning" ? <AlertTriangle size={18} /> : item.type === "success" ? <CheckCircle2 size={18} /> : <Activity size={18} />}</span><div className="timeline-body"><strong>{item.title}</strong><p>{item.description}</p><small><Clock3 size={13} />{relativeTime(item.createdAt, data.generatedAt)} · {dateLabel(item.createdAt)}</small></div></div>)}</div> : <div className="empty-state"><Activity size={26} /><strong>لا يوجد نشاط مطابق</strong></div>}</section></>;
  }

  function renderSettings() {
    return <><SectionIntro eyebrow="الإعدادات" title="الإعدادات" description="خصص طريقة عمل رَصْد بما يناسب شبكتك." /><SettingsPanel settings={data.settings} onSave={(values) => action("saveSettings", values)} busy={busy === "saveSettings"} onNotifications={() => {}} /></>;
  }

  return <div className="app-shell" dir="rtl">
    {mobileMenu && <button className="mobile-overlay" aria-label="إغلاق القائمة" onClick={() => setMobileMenu(false)} />}
    <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}><div className="sidebar-brand"><span className="brand-mark"><Network size={24} strokeWidth={2.1} /></span><span className="brand-words"><strong>رَصْد</strong><small>NETWORK MONITOR</small></span><button className="mobile-close icon-button" onClick={() => setMobileMenu(false)} aria-label="إغلاق"><X size={20} /></button></div>
      <div className="sidebar-content"><div className="nav-label">القائمة الرئيسية</div><nav className="sidebar-nav">{mainNavigation.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${view === id ? "active" : ""}`} onClick={() => navigate(id)}><Icon size={19} strokeWidth={view === id ? 2.2 : 1.8} /><span>{label}</span>{id === "alerts" && unread.length > 0 && <em className="nav-count">{unread.length}</em>}</button>)}</nav><div className="nav-label secondary-label">إدارة الشبكة</div><nav className="sidebar-nav">{secondaryNavigation.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${view === id ? "active" : ""}`} onClick={() => navigate(id)}><Icon size={19} strokeWidth={view === id ? 2.2 : 1.8} /><span>{label}</span>{id === "backup" && <span className="nav-ready-dot" />}</button>)}</nav></div>
      <div className="sidebar-bottom"><div className="sidebar-help"><span className="help-icon"><CircleHelp size={19} /></span><strong>تحتاج إلى مساعدة؟</strong><p>اضبط إعدادات مراقبة شبكتك من مكان واحد.</p><button onClick={() => navigate("settings")}>استكشف الإعدادات <ArrowUpLeft size={14} /></button></div><div className="sidebar-profile"><span className="profile-avatar">م</span><div><strong>مدير الشبكة</strong><small>مسؤول النظام</small></div><span className="profile-online" /></div></div>
    </aside>
    <div className="workspace"><header className="topbar"><div className="topbar-start"><button className="mobile-menu-button icon-button" onClick={() => setMobileMenu(true)} aria-label="فتح القائمة"><Menu size={22} /></button><span className="topbar-date"><span className="topbar-date-icon"><Clock3 size={16} /></span>{new Intl.DateTimeFormat("ar-EG", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Riyadh" }).format(new Date(data.generatedAt))}</span></div><div className="topbar-end"><form className="topbar-search" onSubmit={(event) => { event.preventDefault(); setDeviceSearch(globalSearch); navigate("devices"); }}><Search size={18} /><input ref={searchInput} value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} placeholder="ابحث عن جهاز أو عنوان IP..." /><kbd>⌘ K</kbd></form><span className="topbar-separator" /><div className="notification-anchor"><button className={`top-icon-button ${notificationsOpen ? "active" : ""}`} onClick={() => setNotificationsOpen(!notificationsOpen)} aria-label="التنبيهات"><Bell size={20} />{unread.length > 0 && <i />}</button>{notificationsOpen && <div className="notification-popover"><div className="popover-head"><strong>التنبيهات</strong><button onClick={() => { action("ackAll"); setNotificationsOpen(false); }}>تحديد الكل كمقروء</button></div><div className="popover-list">{unread.length ? unread.slice(0, 4).map((alert) => <button key={alert.id} onClick={() => navigate("alerts")}><SeverityIcon severity={alert.severity} /><span><strong>{alert.title}</strong><small>{relativeTime(alert.createdAt, data.generatedAt)}</small></span></button>) : <div className="popover-empty">لا توجد تنبيهات جديدة</div>}</div><button className="popover-footer" onClick={() => navigate("alerts")}>عرض جميع التنبيهات <ChevronLeft size={15} /></button></div>}</div><button className="top-icon-button help-top" onClick={() => navigate("settings")} aria-label="المساعدة"><CircleHelp size={20} /></button><span className="topbar-separator" /><span className="top-avatar">م</span></div></header>
      <main className="page-container">{view === "dashboard" ? renderDashboard() : view === "devices" ? renderDevices() : view === "ports" ? renderPorts() : view === "alerts" ? renderAlerts() : view === "backup" ? renderBackup() : view === "activity" ? renderActivity() : renderSettings()}</main>
    </div>
    {detailDevice && <DeviceDetailsModal key={detailDevice.id} device={detailDevice} ports={data.ports.filter((port) => port.deviceId === detailDevice.id)} reference={data.generatedAt} onClose={() => setDetailDeviceId(null)} onEdit={() => { setFormDeviceId(detailDevice.id); setDetailDeviceId(null); }} onDelete={() => { setDeleteId(detailDevice.id); setDetailDeviceId(null); }} onPort={(id) => { setPortFormId(id); setDetailDeviceId(null); }} />}
    {formDeviceId !== null && <DeviceFormModal key={String(formDeviceId)} device={formDevice} onClose={() => setFormDeviceId(null)} onSubmit={(values) => action(formDevice ? "updateDevice" : "createDevice", values)} busy={busy === "createDevice" || busy === "updateDevice"} />}
    {editingPort && <PortFormModal key={editingPort.id} port={editingPort} device={data.devices.find((device) => device.id === editingPort.deviceId)} onClose={() => setPortFormId(null)} onSubmit={(values) => action("updatePort", values)} busy={busy === "updatePort"} />}
    {editingUplink && <UplinkFormModal key={editingUplink.id} link={editingUplink} onClose={() => setUplinkFormId(null)} onSubmit={(values) => action("saveUplink", values)} busy={busy === "saveUplink"} />}
    {deletingDevice && <Modal onClose={() => setDeleteId(null)}><div className="confirm-delete"><span className="confirm-icon"><Trash2 size={24} /></span><h2>حذف {deletingDevice.name}؟</h2><p>سيتم حذف الجهاز وجميع منافذه من قائمة المراقبة. لا يمكن التراجع عن هذا الإجراء.</p><div className="modal-actions"><button className="button button-ghost" onClick={() => setDeleteId(null)}>إلغاء</button><button className="button button-danger" disabled={busy === "deleteDevice"} onClick={async () => { if (await action("deleteDevice", { id: deletingDevice.id })) setDeleteId(null); }}>{busy === "deleteDevice" ? "جارٍ الحذف..." : "حذف الجهاز"}</button></div></div></Modal>}
    {toast && <div className={`toast ${toast.error ? "toast-error" : ""}`}><span>{toast.error ? <AlertCircle size={19} /> : <CheckCircle2 size={19} />}</span><strong>{toast.message}</strong><button onClick={() => setToast(null)} aria-label="إغلاق"><X size={16} /></button></div>}
  </div>;
}
