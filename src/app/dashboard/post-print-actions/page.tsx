import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import {
  BulkCancelCsvForm,
  BulkStockOutCsvForm,
  SingleCancelForm,
  SingleStockOutForm,
} from "./forms";

export default async function PostPrintActionsPage() {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "PACKAGING_AGENT"].includes(session.user.role)) {
    redirect("/dashboard");
  }
  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">Post Print Actions</h1>
        <p className="mt-1 text-sm text-slate-500">
          After invoice print, mark orders as stock out or cancelled using single entry or bulk CSV upload.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SingleStockOutForm />
        <SingleCancelForm />
        <BulkStockOutCsvForm />
        <BulkCancelCsvForm />
      </div>
    </div>
  );
}