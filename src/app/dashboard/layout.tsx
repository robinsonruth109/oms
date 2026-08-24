import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import DashboardNavigation from "./dashboard-navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <DashboardNavigation
        role={session.user.role}
        name={session.user.name}
        username={session.user.username}
      />

      <main className="min-w-0 lg:pl-72">
        <div className="mx-auto w-full max-w-[1800px] p-3 sm:p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
