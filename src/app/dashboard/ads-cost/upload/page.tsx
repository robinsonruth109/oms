import AdsCostUploadClient from "./upload-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;
function getLocalDateInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export default async function AdsCostUploadPage() {
  const { prisma } = await import("@/lib/prisma");

  const [parents, sources, uploads] = await Promise.all([
    prisma.productParent.findMany({
      orderBy: {
        sku: "asc",
      },
      select: {
        id: true,
        sku: true,
        name: true,
      },
    }),

    prisma.orderSource.findMany({
      where: {
        status: true,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        type: true,
      },
    }),

    prisma.adsCostUpload.findMany({
      include: {
        items: {
          include: {
            productParent: true,
            source: true,
          },
        },
      },
      orderBy: {
        uploadDate: "desc",
      },
    }),
  ]);

  const serializedUploads = uploads.map((upload) => ({
    id: upload.id,

    uploadDate: getLocalDateInputValue(upload.uploadDate),

    fileName: upload.fileName,

    totalAmount: Number(upload.totalAmount),

    createdAt: upload.createdAt.toISOString(),

    items: upload.items.map((item) => ({
      id: item.id,

      campaignName: item.campaignName,

      amountSpent: Number(item.amountSpent),

      productParent: {
        id: item.productParent.id,
        sku: item.productParent.sku,
        name: item.productParent.name,
      },

      source: {
        id: item.source.id,
        name: item.source.name,
        type: item.source.type,
      },
    })),
  }));

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Upload Ads Cost
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Upload CSV file and map campaigns with product parent code and source.
        </p>
      </section>

      <AdsCostUploadClient
        parents={parents.map((parent) => ({
          id: parent.id,
          sku: parent.sku,
          name: parent.name,
        }))}
        sources={sources.map((source) => ({
          id: source.id,
          name: source.name,
          type: source.type,
        }))}
        uploads={serializedUploads}
      />
    </div>
  );
}