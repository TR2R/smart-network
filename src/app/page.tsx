import { NetworkDashboard } from "@/components/network-dashboard";
import { getDashboardData } from "@/lib/network";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const initialData = await getDashboardData();
  return <NetworkDashboard initialData={initialData} />;
}
