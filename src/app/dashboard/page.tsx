import { getServerSession } from "next-auth";
import {
  ShoppingCart,
  CheckCircle2,
  Clock3,
  PackageX,
  Users,
  PhoneCall,
} from "lucide-react";
import { authOptions } from "@/lib/auth";

function StatCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="mt-2 text-3xl font-bold text-slate-900">{value}</h3>
          <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
          {icon}
        </div>
      </div>
    </div>
  );
}

function QuickInfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <section className="rounded-3xl bg-slate-900 p-6 text-white shadow-sm sm:p-8">
        <p className="text-sm text-slate-300">Welcome back</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
          Hello, {session?.user?.name ?? "User"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-300 sm:text-base">
          This is your Order Management System dashboard. From here you will
          manage calling agents, orders, reports, manual entries, and shipping
          operations.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-slate-100">
            Username: {session?.user?.username ?? "N/A"}
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-slate-100">
            Role: {session?.user?.role ?? "N/A"}
          </span>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Orders"
          value="0"
          subtitle="All orders in system"
          icon={<ShoppingCart className="h-5 w-5" />}
        />
        <StatCard
          title="Confirmed Orders"
          value="0"
          subtitle="Ready for shipping flow"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatCard
          title="Pending Calls"
          value="0"
          subtitle="Waiting for call confirmation"
          icon={<Clock3 className="h-5 w-5" />}
        />
        <StatCard
          title="Stock Out"
          value="0"
          subtitle="Currently unavailable orders"
          icon={<PackageX className="h-5 w-5" />}
        />
      </section>

      {/* Lower Section */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <QuickInfoCard title="System Overview">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-white p-2 shadow-sm">
                    <Users className="h-5 w-5 text-slate-700" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      User Management
                    </p>
                    <p className="text-sm text-slate-500">
                      Admins and agents will be managed here.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-white p-2 shadow-sm">
                    <PhoneCall className="h-5 w-5 text-slate-700" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      Calling Workflow
                    </p>
                    <p className="text-sm text-slate-500">
                      Agents will confirm and update order status here.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <div>
                  <p className="font-semibold text-slate-900">Ready to Ship</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Confirmed orders will move into shipping and invoice export
                    flow.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <div>
                  <p className="font-semibold text-slate-900">Reports</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Daily, monthly, agent-wise and courier-wise reports will be
                    available.
                  </p>
                </div>
              </div>
            </div>
          </QuickInfoCard>
        </div>

        <div>
          <QuickInfoCard title="Logged In User">
            <div className="space-y-3">
              <div className="rounded-2xl border bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Name
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {session?.user?.name ?? "N/A"}
                </p>
              </div>

              <div className="rounded-2xl border bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Username
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {session?.user?.username ?? "N/A"}
                </p>
              </div>

              <div className="rounded-2xl border bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Role
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {session?.user?.role ?? "N/A"}
                </p>
              </div>
            </div>
          </QuickInfoCard>
        </div>
      </section>
    </div>
  );
}