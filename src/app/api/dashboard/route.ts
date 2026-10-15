import { NextRequest } from "next/server";
import {
  acknowledgeAlert,
  acknowledgeAllAlerts,
  createDevice,
  deleteDevice,
  getDashboardData,
  saveSettings,
  saveUplink,
  scanNetwork,
  switchUplink,
  updateDevice,
  updatePort,
} from "@/lib/network";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    return Response.json(await getDashboardData(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Dashboard load failed:", error);
    return Response.json({ error: "تعذر تحميل بيانات الشبكة." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || "");
    let message = "تم حفظ التغييرات بنجاح";

    switch (action) {
      case "scan":
        message = await scanNetwork();
        break;
      case "createDevice":
        await createDevice(body);
        message = "تمت إضافة الجهاز بنجاح";
        break;
      case "updateDevice":
        await updateDevice(body);
        message = "تم تحديث الجهاز بنجاح";
        break;
      case "deleteDevice":
        await deleteDevice(Number(body.id));
        message = "تم حذف الجهاز بنجاح";
        break;
      case "updatePort":
        await updatePort(body);
        message = "تم تحديث المنفذ بنجاح";
        break;
      case "ackAlert":
        await acknowledgeAlert(Number(body.id));
        message = "تم تحديد التنبيه كمقروء";
        break;
      case "ackAll":
        await acknowledgeAllAlerts();
        message = "تمت قراءة جميع التنبيهات";
        break;
      case "saveSettings":
        await saveSettings(body);
        message = "تم حفظ إعدادات المراقبة";
        break;
      case "saveUplink":
        await saveUplink(body);
        message = "تم حفظ إعدادات الاتصال";
        break;
      case "switchUplink":
        if (body.target !== "primary" && body.target !== "backup") throw new Error("اتصال غير صالح.");
        await switchUplink(body.target);
        message = body.target === "backup" ? "تم تفعيل الاتصال الاحتياطي" : "تمت استعادة الاتصال الرئيسي";
        break;
      default:
        return Response.json({ error: "إجراء غير معروف." }, { status: 400 });
    }

    return Response.json({ ok: true, message, data: await getDashboardData() });
  } catch (error) {
    console.error("Dashboard action failed:", error);
    const message = error instanceof Error ? error.message : "حدث خطأ غير متوقع.";
    return Response.json({ error: message.includes("duplicate key") ? "عنوان IP مستخدم بالفعل لجهاز آخر." : message }, { status: 400 });
  }
}
