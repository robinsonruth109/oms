"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { createCourier } from "./actions";

const initialState = { success: false, message: "" };

export default function CreateCourierForm() {
  const [state, action, pending] = useActionState(createCourier, initialState);

  return (
    <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          Create Pathao Courier
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Every courier must be linked to a Pathao Merchant API account/store.
        </p>
      </div>

      <form action={action} className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Courier Name</span>
          <input name="name" className="w-full rounded-xl border px-3 py-2.5" placeholder="Pathao-Gloss And Glows (ID-240015)" required />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Courier Slug</span>
          <input name="slug" className="w-full rounded-xl border px-3 py-2.5" placeholder="pathao-gloss-and-glows" />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Environment</span>
          <select name="pathaoEnvironment" defaultValue="LIVE" className="w-full rounded-xl border px-3 py-2.5">
            <option value="LIVE">Production / Live</option>
            <option value="SANDBOX">Sandbox / Test</option>
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Client ID</span>
          <input name="clientId" className="w-full rounded-xl border px-3 py-2.5" required />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Client Secret</span>
          <input name="clientSecret" type="password" className="w-full rounded-xl border px-3 py-2.5" required />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Merchant Username / Email</span>
          <input name="username" className="w-full rounded-xl border px-3 py-2.5" required />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Merchant Password</span>
          <input name="password" type="password" className="w-full rounded-xl border px-3 py-2.5" required />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Pathao Store ID (optional)</span>
          <input name="storeId" inputMode="numeric" className="w-full rounded-xl border px-3 py-2.5" placeholder="Auto-select on Test Connection" />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Webhook Secret</span>
          <input name="webhookSecret" type="password" className="w-full rounded-xl border px-3 py-2.5" required />
        </label>

        <div className="md:col-span-2 xl:col-span-3">
          {state.message ? (
            <div className={`mb-4 rounded-2xl px-4 py-3 text-sm ${state.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
              {state.message}
            </div>
          ) : null}

          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Create Pathao Courier"}
          </Button>
        </div>
      </form>
    </section>
  );
}
