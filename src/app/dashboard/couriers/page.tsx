import CreateCourierForm from "./create-courier-form";
import PathaoCourierCard from "./pathao-courier-card";
import CourierStatusButton from "./courier-row-actions";
import { formatBangladeshDateTime } from "@/lib/bangladesh-time";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CouriersPage() {
  const { prisma } = await import("@/lib/prisma");
  const couriers = await prisma.courier.findMany({
    orderBy: { createdAt: "desc" },
  });

  const siteUrl = (
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://glossandglows.com"
  ).replace(/\/+$/, "");

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Courier Master · Pathao API
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Every courier is a Pathao Merchant API account/store. Credentials and webhook secrets are encrypted at rest.
        </p>
      </section>

      <CreateCourierForm />

      <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Pathao Courier Connections</h2>
          <p className="mt-1 text-sm text-slate-500">
            Configure/test each courier before using it from Ready to Ship.
          </p>
        </div>

        <div className="space-y-5">
          {couriers.map((courier) => (
            <div key={courier.id}>
              <PathaoCourierCard
                courier={{
                  id: courier.id,
                  name: courier.name,
                  slug: courier.slug,
                  status: courier.status,
                  pathaoEnabled: courier.pathaoEnabled,
                  pathaoEnvironment: courier.pathaoEnvironment,
                  pathaoStoreId: courier.pathaoStoreId,
                  pathaoStoreName: courier.pathaoStoreName,
                  pathaoStoreAddress: courier.pathaoStoreAddress,
                  pathaoLastTestedAt: courier.pathaoLastTestedAt
                    ? formatBangladeshDateTime(courier.pathaoLastTestedAt)
                    : null,
                  pathaoLastTestSuccess: courier.pathaoLastTestSuccess,
                  pathaoLastTestMessage: courier.pathaoLastTestMessage,
                  credentialsConfigured: Boolean(
                    courier.pathaoCredentialsEncrypted &&
                      courier.pathaoCredentialsIv &&
                      courier.pathaoCredentialsTag
                  ),
                  webhookConfigured: Boolean(
                    courier.pathaoWebhookSecretEncrypted &&
                      courier.pathaoWebhookSecretIv &&
                      courier.pathaoWebhookSecretTag
                  ),
                  callbackUrl: `${siteUrl}/api/webhooks/pathao/${courier.id}`,
                }}
              />

              <div className="mt-2 flex justify-end">
                <CourierStatusButton
                  courierId={courier.id}
                  nextStatus={!courier.status}
                  label={courier.status ? "Deactivate Courier" : "Activate Courier"}
                />
              </div>
            </div>
          ))}

          {!couriers.length ? (
            <div className="rounded-2xl border bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
              No Pathao courier configured yet.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
