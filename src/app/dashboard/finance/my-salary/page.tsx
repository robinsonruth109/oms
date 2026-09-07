import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";

export default async function MySalaryPage({ searchParams }: { searchParams?: Promise<{ month?: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const params = (await searchParams) || {};
  const suffix = params.month ? `?month=${encodeURIComponent(params.month)}` : "";
  redirect(`/dashboard/finance/salary/${session.user.id}${suffix}`);
}
