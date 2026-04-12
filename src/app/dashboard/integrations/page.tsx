import { prisma } from "@/lib/prisma";
import CreateIntegrationForm from "./create-integration-form";
import {
  CopyTextButton,
  RegenerateApiKeyButton,
  SecretField,
  ToggleIntegrationButton,
} from "./integration-row-actions";

function maskApiKey(value: string) {
  if (value.length <= 10) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function samplePayload(apiKey: string) {
  return JSON.stringify(
    {
      apiKey,
      externalOrderId: "STORE-10001",
      invoiceId: "CW140900",
      customerName: "John Doe",
      phone: "01700000000",
      address: "Dhaka, Bangladesh",
      deliveryCharge: 120,
      discount: 0,
      advance: 0,
      note: "Leave at gate",
      items: [
        {
          sku: "CODE-ABC-01",
          name: "Demo Product",
          quantity: 2,
          price: 550,
        },
      ],
    },
    null,
    2
  );
}

export default async function IntegrationsPage() {
  const [sources, integrations] = await Promise.all([
    prisma.orderSource.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        type: true,
      },
    }),
    prisma.integration.findMany({
      include: {
        source: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">Integrations</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage unlimited Shopify and Laravel stores using separate slugs and API keys.
        </p>
      </section>

      <CreateIntegrationForm sources={sources} />

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Integration List
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Each integration gets its own endpoint:
            <span className="font-medium"> /api/integrations/[slug]/orders</span>
          </p>
        </div>

        <div className="space-y-4 p-4">
          {integrations.map((integration) => {
            const endpoint = `/api/integrations/${integration.slug}/orders`;

            return (
              <div
                key={integration.id}
                className="rounded-2xl border bg-slate-50 p-4 sm:p-5"
              >
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <p className="text-lg font-semibold text-slate-900">
                        {integration.name}
                      </p>
                      <p className="text-sm text-slate-500">
                        Slug: {integration.slug}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="rounded-xl border bg-white p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          Platform
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {integration.platform}
                        </p>
                      </div>

                      <div className="rounded-xl border bg-white p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          Source
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {integration.source.name}
                        </p>
                      </div>

                      <div className="rounded-xl border bg-white p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          Status
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {integration.status ? "Active" : "Inactive"}
                        </p>
                      </div>

                      <div className="rounded-xl border bg-white p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          Short API Key View
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 break-all">
                          {maskApiKey(integration.apiKey)}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-700">
                        Endpoint
                      </p>

                      <div className="rounded-xl border bg-white px-3 py-2 text-sm text-slate-800 break-all">
                        {endpoint}
                      </div>

                      <CopyTextButton value={endpoint} label="Endpoint" />
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <p className="mb-2 text-sm font-medium text-slate-700">
                        API Key
                      </p>
                      <SecretField label="API Key" value={integration.apiKey} />
                    </div>

                    <div>
                      <p className="mb-2 text-sm font-medium text-slate-700">
                        Webhook Secret
                      </p>

                      {integration.webhookSecret ? (
                        <SecretField
                          label="Webhook Secret"
                          value={integration.webhookSecret}
                        />
                      ) : (
                        <div className="rounded-xl border bg-white px-3 py-2 text-sm text-slate-500">
                          No webhook secret set
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      <ToggleIntegrationButton
                        integrationId={integration.id}
                        nextStatus={!integration.status}
                        label={integration.status ? "Deactivate" : "Activate"}
                      />
                      <RegenerateApiKeyButton integrationId={integration.id} />
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border bg-white p-4">
                  <p className="mb-2 text-sm font-medium text-slate-700">
                    Sample JSON Payload
                  </p>
                  <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
{samplePayload(integration.apiKey)}
                  </pre>
                </div>
              </div>
            );
          })}

          {!integrations.length && (
            <div className="rounded-2xl border bg-slate-50 px-6 py-8 text-center text-sm text-slate-500">
              No integrations found.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}