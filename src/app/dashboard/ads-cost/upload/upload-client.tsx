"use client";

import Papa from "papaparse";
import { useMemo, useState, useTransition } from "react";
import { deleteAdsCostUpload, saveAdsCostUpload } from "./actions";

type Parent = { id: string; sku: string; name: string };
type Source = { id: string; name: string; type: string };

type Upload = {
  id: string;
  uploadDate: string;
  fileName: string | null;
  totalAmount: number;
  createdAt: string;
  items: {
    id: string;
    campaignName: string;
    amountSpent: number;
    productParent: Parent;
    source: Source;
  }[];
};

type CsvRow = {
  campaignName: string;
  amountSpent: number;
  productParentId: string;
  productParentSearch: string;
  sourceId: string;
};

function money(value: number) {
  return `$ ${Number(value || 0).toFixed(2)}`;
}

export default function AdsCostUploadClient({
  parents,
  sources,
  uploads,
}: {
  parents: Parent[];
  sources: Source[];
  uploads: Upload[];
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [uploadDate, setUploadDate] = useState(new Date().toISOString().slice(0, 10));
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [showModal, setShowModal] = useState(false);

  const totalAmount = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.amountSpent || 0), 0),
    [rows]
  );

  function parentMatches(search: string) {
    const q = search.toLowerCase().trim();

    if (!q) return parents.slice(0, 50);

    return parents
      .filter((parent) =>
        `${parent.sku} ${parent.name}`.toLowerCase().includes(q)
      )
      .slice(0, 50);
  }

  function handleCsvUpload(file: File) {
    setFileName(file.name);

    Papa.parse(file, {
      complete(results) {
        const parsedRows = (results.data as string[][])
          .slice(1)
          .map((row) => ({
            campaignName: String(row[0] || "").trim(),
            amountSpent: Number(row[1] || 0),
            productParentId: "",
            productParentSearch: "",
            sourceId: "",
          }))
          .filter((row) => row.campaignName && row.amountSpent > 0);

        setRows(parsedRows);
        if (parsedRows.length) setShowModal(true);
      },
    });
  }

  function updateRow(index: number, patch: Partial<CsvRow>) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  }

  function handleSave() {
    setMessage("");

    startTransition(async () => {
      const result = await saveAdsCostUpload({
        uploadDate,
        fileName,
        rows: rows.map((row) => ({
          campaignName: row.campaignName,
          amountSpent: row.amountSpent,
          productParentId: row.productParentId,
          sourceId: row.sourceId,
        })),
      });

      setMessage(result.message);

      if (result.success) {
        setShowModal(false);
        window.location.reload();
      }
    });
  }

  function handleDelete(uploadId: string) {
    if (!window.confirm("Are you sure you want to delete this upload?")) return;

    startTransition(async () => {
      const result = await deleteAdsCostUpload(uploadId);
      alert(result.message);
      if (result.success) window.location.reload();
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Upload Date
            </label>
            <input
              type="date"
              value={uploadDate}
              onChange={(e) => setUploadDate(e.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Upload CSV File
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleCsvUpload(file);
              }}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            />
          </div>
        </div>

        {message && (
          <div className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm">
            {message}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Uploaded Files</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b">
                <Th>Date</Th>
                <Th>File</Th>
                <Th>Total Campaigns</Th>
                <Th>Total Amount</Th>
                <Th>Action</Th>
              </tr>
            </thead>

            <tbody>
              {uploads.map((upload) => (
                <tr key={upload.id} className="border-b">
                  <Td>{upload.uploadDate}</Td>
                  <Td>{upload.fileName || "N/A"}</Td>
                  <Td>{upload.items.length}</Td>
                  <Td>{money(upload.totalAmount)}</Td>
                  <Td>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleDelete(upload.id)}
                      className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </Td>
                </tr>
              ))}

              {!uploads.length && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">
                    No uploads found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-5">
          <div className="mx-auto max-w-7xl rounded-3xl bg-white shadow-2xl">
            <div className="border-b px-6 py-4">
              <h2 className="text-xl font-bold text-slate-900">Map Campaigns</h2>
              <p className="mt-1 text-sm text-slate-500">
                Showing all product parents. Search by parent code or name.
              </p>
            </div>

            <div className="max-h-[70vh] overflow-y-auto">
              <table className="min-w-full">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="border-b">
                    <Th>Campaign Name</Th>
                    <Th>Product Parent</Th>
                    <Th>Source</Th>
                    <Th>Amount Spent</Th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row, index) => {
                    const matchedParents = parentMatches(row.productParentSearch);

                    return (
                      <tr key={index} className="border-b align-top">
                        <Td>{row.campaignName}</Td>

                        <td className="px-5 py-4 text-sm text-slate-700">
                          <div className="relative">
                            <input
                              type="text"
                              value={row.productParentSearch}
                              onChange={(e) =>
                                updateRow(index, {
                                  productParentSearch: e.target.value,
                                  productParentId: "",
                                })
                              }
                              placeholder="Search parent code or name"
                              className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                            />

                            {!row.productParentId && (
                              <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border bg-white shadow-sm">
                                {matchedParents.map((parent) => (
                                  <button
                                    key={parent.id}
                                    type="button"
                                    onClick={() =>
                                      updateRow(index, {
                                        productParentId: parent.id,
                                        productParentSearch: `${parent.sku} - ${parent.name}`,
                                      })
                                    }
                                    className="block w-full border-b px-3 py-2 text-left text-sm hover:bg-slate-50 last:border-b-0"
                                  >
                                    <span className="font-semibold text-slate-900">
                                      {parent.sku}
                                    </span>
                                    <span className="text-slate-500"> - {parent.name}</span>
                                  </button>
                                ))}

                                {!matchedParents.length && (
                                  <div className="px-3 py-2 text-sm text-slate-500">
                                    No parent found.
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        <Td>
                          <select
                            value={row.sourceId}
                            onChange={(e) => updateRow(index, { sourceId: e.target.value })}
                            className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                          >
                            <option value="">Select Source</option>
                            {sources.map((source) => (
                              <option key={source.id} value={source.id}>
                                {source.name} ({source.type})
                              </option>
                            ))}
                          </select>
                        </Td>

                        <Td>{money(row.amountSpent)}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t px-6 py-4">
              <div>
                <p className="text-sm text-slate-500">
                  Total Campaigns:
                  <span className="ml-2 font-semibold text-slate-900">{rows.length}</span>
                </p>
                <p className="text-sm text-slate-500">
                  Total Amount:
                  <span className="ml-2 font-semibold text-slate-900">
                    {money(totalAmount)}
                  </span>
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border px-5 py-2.5 text-sm font-medium"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={pending}
                  onClick={handleSave}
                  className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  {pending ? "Saving..." : "Save Upload"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-5 py-4 text-sm text-slate-700">{children}</td>;
}