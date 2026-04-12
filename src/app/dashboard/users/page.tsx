import { prisma } from "@/lib/prisma";
import { BadgeCheck, UserCog, UserRound } from "lucide-react";
import CreateUserForm from "./create-user-form";

function RoleBadge({ role }: { role: string }) {
  if (role === "ADMIN") {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
        ADMIN
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
      AGENT
    </span>
  );
}

export default async function UsersPage() {
  const users = await prisma.user.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manage Users</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create and manage admins and calling agents.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3">
          <UserCog className="h-5 w-5 text-slate-600" />
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Total Users
            </p>
            <p className="text-sm font-semibold text-slate-900">
              {users.length}
            </p>
          </div>
        </div>
      </section>

      <CreateUserForm />

      <section className="grid grid-cols-1 gap-4 lg:hidden">
        {users.map((user) => (
          <div
            key={user.id}
            className="rounded-2xl border bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-slate-100 p-3">
                  <UserRound className="h-5 w-5 text-slate-700" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">{user.name}</h2>
                  <p className="text-sm text-slate-500">@{user.username}</p>
                </div>
              </div>

              <RoleBadge role={user.role} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Status
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {user.status ? "Active" : "Inactive"}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Created
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="hidden overflow-hidden rounded-3xl border bg-white shadow-sm lg:block">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b">
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  User
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Username
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Role
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Created
                </th>
              </tr>
            </thead>

            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b last:border-b-0">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-slate-100 p-3">
                        <UserRound className="h-4 w-4 text-slate-700" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">
                          {user.name}
                        </p>
                        <p className="text-sm text-slate-500">
                          User record in OMS
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-700">
                    @{user.username}
                  </td>

                  <td className="px-6 py-4">
                    <RoleBadge role={user.role} />
                  </td>

                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                      <BadgeCheck className="h-4 w-4 text-emerald-600" />
                      {user.status ? "Active" : "Inactive"}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-700">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}