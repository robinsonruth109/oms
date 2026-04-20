import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  LayoutDashboard,
  Users,
  Package,
  PhoneCall,
  LogOut,
  ShieldCheck,
  FileStack,
  Boxes,
  Shapes,
  Truck,
  Ban,
  PackageX,
  Plug,
  ClipboardList,
  Send,
  BarChart3,
} from "lucide-react";
import { authOptions } from "@/lib/auth";
import { Button } from "@/components/ui/button";

type DashboardLayoutProps = {
  children: ReactNode;
};

function NavLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
    >
      <span className="text-slate-500">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const isAdmin = session.user.role === "ADMIN";
  const isAgent = session.user.role === "AGENT";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <header className="border-b bg-white lg:hidden">
          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <h1 className="text-lg font-bold text-slate-900">OMS</h1>
              <p className="text-xs text-slate-500">Order Management System</p>
            </div>

            <div className="text-right">
              <p className="text-sm font-semibold text-slate-800">
                {session.user.name}
              </p>
              <p className="text-xs text-slate-500">{session.user.role}</p>
            </div>
          </div>

          <div className="overflow-x-auto px-4 pb-4">
            <div className="flex min-w-max gap-2">
              <Link href="/dashboard">
                <Button variant="outline" size="sm">
                  Dashboard
                </Button>
              </Link>

              {isAdmin && (
                <>
                  <Link href="/dashboard/users">
                    <Button variant="outline" size="sm">
                      Users
                    </Button>
                  </Link>
                  <Link href="/dashboard/pages">
                    <Button variant="outline" size="sm">
                      Pages
                    </Button>
                  </Link>
                  <Link href="/dashboard/sources">
                    <Button variant="outline" size="sm">
                      Sources
                    </Button>
                  </Link>
                  <Link href="/dashboard/integrations">
                    <Button variant="outline" size="sm">
                      Integrations
                    </Button>
                  </Link>
                  <Link href="/dashboard/couriers">
                    <Button variant="outline" size="sm">
                      Couriers
                    </Button>
                  </Link>
                  <Link href="/dashboard/products">
                    <Button variant="outline" size="sm">
                      Products
                    </Button>
                  </Link>
                  <Link href="/dashboard/all-orders">
                    <Button variant="outline" size="sm">
                      All Orders
                    </Button>
                  </Link>
                  <Link href="/dashboard/orders">
                    <Button variant="outline" size="sm">
                      Orders
                    </Button>
                  </Link>
                  <Link href="/dashboard/pending-orders">
                    <Button variant="outline" size="sm">
                      Pending Orders
                    </Button>
                  </Link>
                  <Link href="/dashboard/call">
                    <Button variant="outline" size="sm">
                      Calling Panel
                    </Button>
                  </Link>
                  <Link href="/dashboard/ready-to-ship">
                    <Button variant="outline" size="sm">
                      Ready to Ship
                    </Button>
                  </Link>
                  <Link href="/dashboard/post-print-actions">
                    <Button variant="outline" size="sm">
                      Post Print
                    </Button>
                  </Link>
                  <Link href="/dashboard/stock-out">
                    <Button variant="outline" size="sm">
                      Stock Out
                    </Button>
                  </Link>
                  <Link href="/dashboard/cancelled">
                    <Button variant="outline" size="sm">
                      Cancelled
                    </Button>
                  </Link>
                  <Link href="/dashboard/reports">
                    <Button variant="outline" size="sm">
                      Reports
                    </Button>
                  </Link>
                  <Link href="/dashboard/product-report">
                    <Button variant="outline" size="sm">
                      Product Report
                    </Button>
                  </Link>
                </>
              )}

              {isAgent && (
                <>
                  <Link href="/dashboard/pending-orders">
                    <Button variant="outline" size="sm">
                      Pending Orders
                    </Button>
                  </Link>
                  <Link href="/dashboard/call">
                    <Button variant="outline" size="sm">
                      Calling Panel
                    </Button>
                  </Link>
                  <Link href="/dashboard/reports">
                    <Button variant="outline" size="sm">
                      Reports
                    </Button>
                  </Link>
                </>
              )}

              <Link href="/login">
                <Button variant="outline" size="sm">
                  Logout
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <aside className="hidden w-72 border-r bg-white lg:flex lg:flex-col">
          <div className="border-b px-6 py-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">OMS</h2>
                <p className="text-sm text-slate-500">
                  Order Management System
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 px-4 py-6">
            <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Main Menu
            </p>

            <nav className="space-y-1">
              <NavLink
                href="/dashboard"
                icon={<LayoutDashboard className="h-4 w-4" />}
                label="Dashboard"
              />

              {isAdmin && (
                <>
                  <NavLink
                    href="/dashboard/users"
                    icon={<Users className="h-4 w-4" />}
                    label="Manage Users"
                  />
                  <NavLink
                    href="/dashboard/pages"
                    icon={<FileStack className="h-4 w-4" />}
                    label="Page Master"
                  />
                  <NavLink
                    href="/dashboard/sources"
                    icon={<Boxes className="h-4 w-4" />}
                    label="Source Master"
                  />
                  <NavLink
                    href="/dashboard/integrations"
                    icon={<Plug className="h-4 w-4" />}
                    label="Integrations"
                  />
                  <NavLink
                    href="/dashboard/couriers"
                    icon={<Send className="h-4 w-4" />}
                    label="Courier Master"
                  />
                  <NavLink
                    href="/dashboard/products"
                    icon={<Shapes className="h-4 w-4" />}
                    label="Product Master"
                  />
                  <NavLink
                    href="/dashboard/orders"
                    icon={<Package className="h-4 w-4" />}
                    label="Orders"
                  />
                  <NavLink
                    href="/dashboard/all-orders"
                    icon={<Package className="h-4 w-4" />}
                    label="All Orders"
                  />
                  <NavLink
                    href="/dashboard/pending-orders"
                    icon={<ClipboardList className="h-4 w-4" />}
                    label="Pending Orders"
                  />
                  <NavLink
                    href="/dashboard/call"
                    icon={<PhoneCall className="h-4 w-4" />}
                    label="Calling Panel"
                  />
                  <NavLink
                    href="/dashboard/ready-to-ship"
                    icon={<Truck className="h-4 w-4" />}
                    label="Ready to Ship"
                  />
                  <NavLink
                    href="/dashboard/post-print-actions"
                    icon={<Ban className="h-4 w-4" />}
                    label="Post Print Actions"
                  />
                  <NavLink
                    href="/dashboard/stock-out"
                    icon={<PackageX className="h-4 w-4" />}
                    label="Stock Out"
                  />
                  <NavLink
                    href="/dashboard/cancelled"
                    icon={<Ban className="h-4 w-4" />}
                    label="Cancelled"
                  />
                  <NavLink
                    href="/dashboard/reports"
                    icon={<BarChart3 className="h-4 w-4" />}
                    label="Reports"
                  />
                  <NavLink
                    href="/dashboard/product-report"
                    icon={<BarChart3 className="h-4 w-4" />}
                    label="Product Report"
                  />
                </>
              )}

              {isAgent && (
                <>
                  <NavLink
                    href="/dashboard/pending-orders"
                    icon={<ClipboardList className="h-4 w-4" />}
                    label="Pending Orders"
                  />
                  <NavLink
                    href="/dashboard/call"
                    icon={<PhoneCall className="h-4 w-4" />}
                    label="Calling Panel"
                  />
                  <NavLink
                    href="/dashboard/reports"
                    icon={<BarChart3 className="h-4 w-4" />}
                    label="Reports"
                  />
                </>
              )}
            </nav>
          </div>

          <div className="border-t p-4">
            <div className="mb-4 rounded-2xl border bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">
                {session.user.name}
              </p>
              <p className="text-sm text-slate-500">{session.user.username}</p>
              <p className="mt-2 inline-flex rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">
                {session.user.role}
              </p>
            </div>

            <Link href="/login" className="block">
              <Button variant="outline" className="w-full justify-start gap-2">
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </Link>
          </div>
        </aside>

        <div className="flex-1">
          <div className="hidden border-b bg-white px-6 py-4 lg:flex lg:items-center lg:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                OMS Dashboard Panel
              </h1>
              <p className="text-sm text-slate-500">
                Manage orders, stores, shipping, products, reports and
                operations
              </p>
            </div>

            <div className="text-right">
              <p className="text-sm font-semibold text-slate-900">
                {session.user.name}
              </p>
              <p className="text-sm text-slate-500">{session.user.role}</p>
            </div>
          </div>

          <main className="p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}