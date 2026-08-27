"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Ban,
  BarChart3,
  Boxes,
  BriefcaseBusiness,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  FileSpreadsheet,
  Gauge,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Package,
  PackageCheck,
  PackageOpen,
  PackageSearch,
  PackageX,
  PanelsTopLeft,
  PhoneCall,
  ReceiptText,
  RotateCcw,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  UserRoundCog,
  Users,
  X,
  AlertTriangle,
  Megaphone,
} from "lucide-react";

type Role = "ADMIN" | "AGENT" | "NOTE_AGENT" | "PACKAGING_AGENT" | string;

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const ALL_ROLES = ["ADMIN", "AGENT", "NOTE_AGENT", "PACKAGING_AGENT"];

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN"] },
      { href: "/dashboard/attendance", label: "Attendance", icon: ClipboardCheck, roles: ALL_ROLES },
      { href: "/dashboard/attendance/report", label: "Attendance Report", icon: BarChart3, roles: ["ADMIN"] },
      { href: "/dashboard/attendance/violations", label: "Attendance Violations", icon: AlertTriangle, roles: ["ADMIN"] },
    ],
  },
  {
    label: "Order Management",
    items: [
      { href: "/dashboard/orders", label: "Orders", icon: ShoppingBag, roles: ["ADMIN", "NOTE_AGENT"] },
      { href: "/dashboard/all-orders", label: "All Orders", icon: Boxes, roles: ["ADMIN", "AGENT", "NOTE_AGENT"] },
      { href: "/dashboard/pending-orders", label: "Pending Orders", icon: PackageSearch, roles: ["ADMIN", "AGENT"] },
      { href: "/dashboard/call", label: "Calling Panel", icon: PhoneCall, roles: ["ADMIN", "AGENT"] },
      { href: "/dashboard/ready-to-ship", label: "Ready to Ship", icon: Truck, roles: ["ADMIN", "PACKAGING_AGENT"] },
      { href: "/dashboard/post-print-actions", label: "Post Print Actions", icon: ReceiptText, roles: ["ADMIN", "PACKAGING_AGENT"] },
      { href: "/dashboard/stock-out", label: "Stock Out", icon: PackageX, roles: ["ADMIN"] },
      { href: "/dashboard/cancelled", label: "Cancelled", icon: Ban, roles: ["ADMIN"] },
      { href: "/dashboard/ready-orders-download", label: "Ready Orders Download", icon: FileSpreadsheet, roles: ["ADMIN"] },
      { href: "/dashboard/sheet-sync", label: "Ready Order Sheet Sync", icon: FileSpreadsheet, roles: ["ADMIN"] },
      { href: "/dashboard/stock-out-import", label: "Stock Out Import", icon: RotateCcw, roles: ["ADMIN", "PACKAGING_AGENT"] },
    ],
  },
  {
    label: "Pathao",
    items: [
      { href: "/dashboard/pathao-orders", label: "Pathao Order Control", icon: Truck, roles: ["ADMIN", "PACKAGING_AGENT"] },
      { href: "/dashboard/pathao-daily-report", label: "Pathao Daily Report", icon: BarChart3, roles: ["ADMIN", "PACKAGING_AGENT"] },
      { href: "/dashboard/pathao-problem", label: "Pathao Problem", icon: AlertTriangle, roles: ["ADMIN", "NOTE_AGENT"] },
      { href: "/dashboard/couriers", label: "Courier Master", icon: Store, roles: ["ADMIN"] },
    ],
  },
  {
    label: "Products & Content",
    items: [
      { href: "/dashboard/products", label: "Product Master", icon: Package, roles: ["ADMIN"] },
      { href: "/dashboard/reel-categories", label: "Reel Categories", icon: PanelsTopLeft, roles: ["ADMIN"] },
      { href: "/dashboard/reel-products", label: "Reel Products", icon: PackageOpen, roles: ["ADMIN"] },
      { href: "/dashboard/products-purchases/purchase-orders", label: "Purchase Orders", icon: BriefcaseBusiness, roles: ["ADMIN"] },
      { href: "/dashboard/products-purchases/received-orders", label: "Received Orders", icon: PackageCheck, roles: ["ADMIN"] },
    ],
  },
  {
    label: "Reports & Finance",
    items: [
      { href: "/dashboard/live-call-report", label: "Live Call Report", icon: PhoneCall, roles: ["ADMIN", "AGENT"] },
      { href: "/dashboard/reports", label: "Reports", icon: BarChart3, roles: ["ADMIN"] },
      { href: "/dashboard/daily-source-status", label: "Daily Source Status", icon: Activity, roles: ["ADMIN"] },
      { href: "/dashboard/product-report", label: "Product Report", icon: ListChecks, roles: ["ADMIN"] },
      { href: "/dashboard/ads-cost/report", label: "Ads Cost Report", icon: Megaphone, roles: ["ADMIN"] },
      { href: "/dashboard/ads-cost/upload", label: "Ads Cost Upload", icon: FileSpreadsheet, roles: ["ADMIN"] },
      { href: "/dashboard/doller-rates", label: "Dollar Rates", icon: CircleDollarSign, roles: ["ADMIN"] },
    ],
  },
  {
    label: "Configuration",
    items: [
      { href: "/dashboard/pages", label: "Page Master", icon: PanelsTopLeft, roles: ["ADMIN"] },
      { href: "/dashboard/sources", label: "Source Master", icon: Gauge, roles: ["ADMIN"] },
      { href: "/dashboard/integrations", label: "Integrations", icon: Boxes, roles: ["ADMIN"] },
      { href: "/dashboard/shop-settings", label: "Shop Settings", icon: Settings, roles: ["ADMIN"] },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/dashboard/users", label: "Manage Users", icon: Users, roles: ["ADMIN"] },
      { href: "/dashboard/customer-data-retention", label: "Customer Data", icon: UserRoundCog, roles: ["ADMIN"] },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
        <ShieldCheck className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-lg font-bold text-slate-900">OMS</div>
        <div className="truncate text-xs text-slate-500">Order Management System</div>
      </div>
    </div>
  );
}

function NavigationFooter({
  role,
  name,
  username,
}: {
  role: string;
  name?: string | null;
  username?: string | null;
}) {
  return (
    <>
      <div className="rounded-2xl border bg-slate-50 p-3">
        <p className="truncate text-sm font-semibold text-slate-900">
          {name || "OMS User"}
        </p>
        {username ? (
          <p className="mt-0.5 truncate text-xs text-slate-500">{username}</p>
        ) : null}
        <span className="mt-2 inline-flex rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
          {role}
        </span>
      </div>

      <Link
        href="/login"
        className="mt-3 flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        <LogOut className="h-4 w-4" />
        Logout
      </Link>
    </>
  );
}

function NavigationGroups({
  groups,
  pathname,
  onNavigate,
}: {
  groups: NavGroup[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    groups.forEach((group, index) => {
      initial[group.label] =
        group.items.some((item) => isActive(pathname, item.href)) || index < 2;
    });
    return initial;
  });

  useEffect(() => {
    const activeGroup = groups.find((group) =>
      group.items.some((item) => isActive(pathname, item.href))
    );

    if (activeGroup) {
      setOpenGroups((current) => ({
        ...current,
        [activeGroup.label]: true,
      }));
    }
  }, [groups, pathname]);

  return (
    <nav className="space-y-2">
      {groups.map((group) => {
        const open = Boolean(openGroups[group.label]);

        return (
          <section
            key={group.label}
            className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white"
          >
            <button
              type="button"
              onClick={() =>
                setOpenGroups((current) => ({
                  ...current,
                  [group.label]: !current[group.label],
                }))
              }
              className="flex w-full items-center justify-between px-3 py-2.5 text-left"
              aria-expanded={open}
            >
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                {group.label}
              </span>
              <ChevronDown
                className={`h-4 w-4 text-slate-400 transition-transform ${
                  open ? "rotate-180" : ""
                }`}
              />
            </button>

            {open ? (
              <div className="space-y-1 px-1.5 pb-2">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                        active
                          ? "bg-slate-900 text-white shadow-sm"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          active ? "text-white" : "text-slate-500"
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </section>
        );
      })}
    </nav>
  );
}

export default function DashboardNavigation({
  role,
  name,
  username,
}: {
  role: string;
  name?: string | null;
  username?: string | null;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const groups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => item.roles.includes(role)),
      })).filter((group) => group.items.length > 0),
    [role]
  );

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur lg:hidden">
        <div className="flex h-16 items-center justify-between px-4">
          <Brand />
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
            className="flex h-11 w-11 items-center justify-center rounded-xl border bg-white shadow-sm"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px]"
            onClick={() => setMobileOpen(false)}
          />

          <aside className="absolute inset-y-0 left-0 flex w-[min(88vw,360px)] flex-col bg-slate-50 shadow-2xl">
            <div className="flex items-center justify-between border-b bg-white p-4">
              <Brand />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation menu"
                className="flex h-10 w-10 items-center justify-center rounded-xl border bg-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              <NavigationGroups
                groups={groups}
                pathname={pathname}
                onNavigate={() => setMobileOpen(false)}
              />
            </div>

            <div className="border-t bg-white p-3">
              <NavigationFooter
                role={role}
                name={name}
                username={username}
              />
            </div>
          </aside>
        </div>
      ) : null}

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r bg-slate-50 lg:flex">
        <div className="border-b bg-white px-5 py-5">
          <Brand />
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <NavigationGroups groups={groups} pathname={pathname} />
        </div>

        <div className="border-t bg-white p-3">
          <NavigationFooter role={role} name={name} username={username} />
        </div>
      </aside>
    </>
  );
}
