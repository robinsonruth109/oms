"use client";

import Link from "next/link";
import {
  ArrowRightLeft,
  ExternalLink,
  Minus,
  PackagePlus,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { issueExchangeAction } from "./actions";

type ProductOption = {
  id: string;
  sku: string;
  name: string;
  parentSku: string;
  sellingPrice: number;
};

type OrderItem = {
  id: string;
  productId: string | null;
  resolvedProductId: string | null;
  productSku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
};

export type ExchangeSearchOrder = {
  id: string;
  invoiceId: string;
  customerName: string;
  phone: string;
  address: string;
  createdAt: string;
  orderStatus: string;
  sourceName: string;
  pageName: string | null;
  courierName: string | null;
  pathaoConsignmentId: string | null;
  pathaoStatus: string | null;
  pathaoStatusSlug: string | null;
  pathaoCourierName: string | null;
  items: OrderItem[];
};

type OutgoingRow = {
  rowId: string;
  productId: string;
  productLabel: string;
  search: string;
  quantity: number;
  unitPrice: number;
};

type Props = {
  searchQuery: string;
  searchResults: ExchangeSearchOrder[];
  products: ProductOption[];
};

const initialState = { success: false, message: "" };

function rowId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `row-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function emptyOutgoingRow(): OutgoingRow {
  return {
    rowId: rowId(),
    productId: "",
    productLabel: "",
    search: "",
    quantity: 1,
    unitPrice: 0,
  };
}

function normalize(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function filteredProducts(products: ProductOption[], query: string) {
  const q = normalize(query);
  if (!q) return products.slice(0, 15);

  const terms = q.split(/\s+/).filter(Boolean);
  return products
    .filter((product) => {
      const haystack = normalize(
        `${product.sku} ${product.name} ${product.parentSku}`
      );
      return terms.every((term) => haystack.includes(term));
    })
    .slice(0, 15);
}

function money(value: number) {
  return Number.isFinite(value) ? value : 0;
}

export default function ExchangePanelClient({
  searchQuery,
  searchResults,
  products,
}: Props) {
  const [state, formAction, pending] = useActionState(
    issueExchangeAction,
    initialState
  );
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const selectedOrder = useMemo(
    () => searchResults.find((order) => order.id === selectedOrderId) || null,
    [searchResults, selectedOrderId]
  );

  const [expectedQty, setExpectedQty] = useState<Record<string, number>>({});
  const [outgoingRows, setOutgoingRows] = useState<OutgoingRow[]>([]);
  const [deliveryCharge, setDeliveryCharge] = useState(0);

  useEffect(() => {
    if (!selectedOrder) {
      setExpectedQty({});
      setOutgoingRows([]);
      setDeliveryCharge(0);
      return;
    }

    setExpectedQty(
      Object.fromEntries(selectedOrder.items.map((item) => [item.id, 0]))
    );

    const initialRows = selectedOrder.items
      .filter((item) => item.resolvedProductId)
      .map((item) => ({
        rowId: rowId(),
        productId: item.resolvedProductId as string,
        productLabel: `${item.productSku} - ${item.productName}`,
        search: "",
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }));

    setOutgoingRows(initialRows.length ? initialRows : [emptyOutgoingRow()]);
    setDeliveryCharge(0);
  }, [selectedOrder]);

  const expectedPayload = useMemo(
    () =>
      selectedOrder
        ? selectedOrder.items
            .map((item) => ({
              orderItemId: item.id,
              quantity: Math.max(0, Math.trunc(expectedQty[item.id] || 0)),
            }))
            .filter((item) => item.quantity > 0)
        : [],
    [expectedQty, selectedOrder]
  );

  const outgoingPayload = useMemo(
    () =>
      outgoingRows
        .filter((row) => row.productId && row.quantity > 0)
        .map((row) => ({
          productId: row.productId,
          quantity: Math.max(1, Math.trunc(row.quantity || 1)),
          unitPrice: Math.max(0, money(row.unitPrice)),
        })),
    [outgoingRows]
  );

  const returnedCredit = selectedOrder
    ? selectedOrder.items.reduce(
        (sum, item) => sum + item.unitPrice * (expectedQty[item.id] || 0),
        0
      )
    : 0;
  const outgoingSubtotal = outgoingRows.reduce(
    (sum, row) => sum + row.unitPrice * row.quantity,
    0
  );
  const rawBalance = outgoingSubtotal + deliveryCharge - returnedCredit;
  const amountToCollect = Math.max(0, rawBalance);
  const customerCredit = Math.max(0, -rawBalance);

  function selectOrder(orderId: string) {
    setSelectedOrderId(orderId);
    setTimeout(() => {
      document
        .getElementById("exchange-editor")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 20);
  }

  function updateOutgoing(rowIdValue: string, patch: Partial<OutgoingRow>) {
    setOutgoingRows((current) =>
      current.map((row) =>
        row.rowId === rowIdValue ? { ...row, ...patch } : row
      )
    );
  }

  function pickProduct(rowIdValue: string, product: ProductOption) {
    updateOutgoing(rowIdValue, {
      productId: product.id,
      productLabel: `${product.sku} - ${product.name}`,
      search: "",
      unitPrice: product.sellingPrice,
      quantity: 1,
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3">
          <Search className="h-5 w-5 text-slate-500" />
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Find Original Order
            </h2>
            <p className="text-sm text-slate-500">
              Search by customer phone number or OMS invoice code.
            </p>
          </div>
        </div>

        <form className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            name="q"
            defaultValue={searchQuery}
            placeholder="Phone number or invoice, e.g. 017... / GS118113"
            className="min-h-11 flex-1 rounded-xl border px-4 text-sm outline-none focus:border-slate-400"
          />
          <button
            type="submit"
            className="min-h-11 rounded-xl bg-slate-900 px-6 text-sm font-semibold text-white"
          >
            Search Order
          </button>
        </form>

        {searchQuery ? (
          <div className="mt-5 space-y-3">
            {searchResults.length ? (
              searchResults.map((order) => (
                <div
                  key={order.id}
                  className={`rounded-2xl border p-4 ${
                    selectedOrderId === order.id
                      ? "border-slate-900 bg-slate-50"
                      : "bg-white"
                  }`}
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-bold text-slate-900">
                          {order.invoiceId}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {order.orderStatus}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-800">
                        {order.customerName} · {order.phone}
                      </p>
                      <p className="text-sm text-slate-500">{order.address}</p>
                      <p className="text-xs text-slate-500">
                        {order.createdAt} · {order.sourceName}
                        {order.pageName ? ` · ${order.pageName}` : ""}
                      </p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-lg bg-indigo-50 px-2.5 py-1 font-medium text-indigo-700">
                          Pathao CID: {order.pathaoConsignmentId || "Not linked"}
                        </span>
                        <span className="rounded-lg bg-amber-50 px-2.5 py-1 font-medium text-amber-800">
                          Pathao: {order.pathaoStatus || order.pathaoStatusSlug || "N/A"}
                        </span>
                        {order.pathaoCourierName ? (
                          <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                            {order.pathaoCourierName}
                          </span>
                        ) : null}
                      </div>
                      <div className="pt-1 text-sm text-slate-700">
                        {order.items.map((item) => (
                          <div key={item.id}>
                            {item.productSku} × {item.quantity} @ Tk {item.unitPrice.toFixed(2)}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      {order.pathaoConsignmentId ? (
                        <a
                          href={`https://merchant.pathao.com/courier/orders/${encodeURIComponent(
                            order.pathaoConsignmentId
                          )}?isShowingActive=1`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold text-slate-700"
                        >
                          Pathao <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => selectOrder(order.id)}
                        disabled={!order.pathaoConsignmentId}
                        className="min-h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        Select for Exchange
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-slate-500">
                No matching normal OMS order found.
              </div>
            )}
          </div>
        ) : null}
      </section>

      {selectedOrder ? (
        <section
          id="exchange-editor"
          className="scroll-mt-4 rounded-3xl border bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5" />
                <h2 className="text-xl font-bold text-slate-900">
                  Issue Exchange for {selectedOrder.invoiceId}
                </h2>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                The original order remains unchanged. OMS creates a linked exchange memo.
              </p>
            </div>
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Create the exchange in Pathao first, then enter its Exchange ID below.
            </div>
          </div>

          <form action={formAction} className="mt-6 space-y-6">
            <input type="hidden" name="originalOrderId" value={selectedOrder.id} />
            <input
              type="hidden"
              name="expectedReturns"
              value={JSON.stringify(expectedPayload)}
            />
            <input
              type="hidden"
              name="outgoingItems"
              value={JSON.stringify(outgoingPayload)}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-slate-700">
                <span>Pathao Exchange Parcel / Consignment ID *</span>
                <input
                  name="pathaoExchangeConsignmentId"
                  required
                  autoComplete="off"
                  placeholder="Scan or type Pathao Exchange ID"
                  className="min-h-11 w-full rounded-xl border px-3 outline-none"
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-slate-700">
                <span>Exchange Reason *</span>
                <input
                  name="reason"
                  required
                  placeholder="Wrong size, damaged item, customer request..."
                  className="min-h-11 w-full rounded-xl border px-3 outline-none"
                />
              </label>
            </div>

            <div className="rounded-2xl border bg-rose-50/40 p-4">
              <h3 className="font-semibold text-slate-900">
                Product(s) Expected Back From Customer
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                This does not restore stock now. Stock is restored only when the returned parcel physically reaches your office and is processed in Pathao Return Track.
              </p>
              <div className="mt-4 space-y-3">
                {selectedOrder.items.map((item) => (
                  <div
                    key={item.id}
                    className="grid gap-3 rounded-xl border bg-white p-3 sm:grid-cols-[1fr_130px] sm:items-center"
                  >
                    <div>
                      <p className="font-medium text-slate-900">
                        {item.productSku} - {item.productName}
                      </p>
                      <p className="text-xs text-slate-500">
                        Ordered {item.quantity} · Original price Tk {item.unitPrice.toFixed(2)}
                      </p>
                    </div>
                    <label className="text-xs font-medium text-slate-600">
                      Return Qty
                      <input
                        type="number"
                        min={0}
                        max={item.quantity}
                        value={expectedQty[item.id] || 0}
                        onChange={(event) =>
                          setExpectedQty((current) => ({
                            ...current,
                            [item.id]: Math.max(
                              0,
                              Math.min(
                                item.quantity,
                                Math.trunc(Number(event.target.value || 0))
                              )
                            ),
                          }))
                        }
                        className="mt-1 min-h-10 w-full rounded-lg border bg-white px-3 text-sm outline-none"
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border bg-emerald-50/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">Products To Send</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Increase/decrease quantities, remove items, or add a different SKU.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setOutgoingRows((current) => [...current, emptyOutgoingRow()])
                  }
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border bg-white px-3 text-sm font-semibold text-slate-700"
                >
                  <PackagePlus className="h-4 w-4" /> Add Product
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {outgoingRows.map((row) => {
                  const matches = filteredProducts(products, row.search);
                  return (
                    <div key={row.rowId} className="rounded-2xl border bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-slate-900">
                          {row.productLabel || "Select product"}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setOutgoingRows((current) =>
                              current.length === 1
                                ? [emptyOutgoingRow()]
                                : current.filter((item) => item.rowId !== row.rowId)
                            )
                          }
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border text-slate-500"
                          aria-label="Remove product"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="relative mt-3">
                        <input
                          value={row.search}
                          onChange={(event) =>
                            updateOutgoing(row.rowId, { search: event.target.value })
                          }
                          placeholder="Search SKU, product name or parent code"
                          className="min-h-11 w-full rounded-xl border px-3 text-sm outline-none"
                        />
                        {row.search ? (
                          <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border bg-white shadow-xl">
                            {matches.length ? (
                              matches.map((product) => (
                                <button
                                  key={product.id}
                                  type="button"
                                  onClick={() => pickProduct(row.rowId, product)}
                                  className="block w-full border-b px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-slate-50"
                                >
                                  <span className="font-semibold text-slate-900">
                                    {product.sku}
                                  </span>
                                  <span className="text-slate-600"> - {product.name}</span>
                                  <span className="block text-xs text-slate-400">
                                    Parent: {product.parentSku} · Tk {product.sellingPrice.toFixed(2)}
                                  </span>
                                </button>
                              ))
                            ) : (
                              <div className="px-3 py-3 text-sm text-slate-500">
                                No product found.
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <label className="text-xs font-medium text-slate-600">
                          Qty
                          <div className="mt-1 flex min-h-10 overflow-hidden rounded-lg border bg-white">
                            <button
                              type="button"
                              onClick={() =>
                                updateOutgoing(row.rowId, {
                                  quantity: Math.max(1, row.quantity - 1),
                                })
                              }
                              className="w-10 border-r"
                            >
                              <Minus className="mx-auto h-4 w-4" />
                            </button>
                            <input
                              type="number"
                              min={1}
                              value={row.quantity}
                              onChange={(event) =>
                                updateOutgoing(row.rowId, {
                                  quantity: Math.max(
                                    1,
                                    Math.trunc(Number(event.target.value || 1))
                                  ),
                                })
                              }
                              className="min-w-0 flex-1 px-2 text-center text-sm outline-none"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                updateOutgoing(row.rowId, {
                                  quantity: row.quantity + 1,
                                })
                              }
                              className="w-10 border-l"
                            >
                              <Plus className="mx-auto h-4 w-4" />
                            </button>
                          </div>
                        </label>
                        <label className="text-xs font-medium text-slate-600">
                          Unit Price
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={row.unitPrice}
                            onChange={(event) =>
                              updateOutgoing(row.rowId, {
                                unitPrice: Math.max(0, Number(event.target.value || 0)),
                              })
                            }
                            className="mt-1 min-h-10 w-full rounded-lg border px-3 text-sm outline-none"
                          />
                        </label>
                        <div className="text-xs font-medium text-slate-600">
                          Line Total
                          <div className="mt-1 flex min-h-10 items-center rounded-lg border bg-slate-50 px-3 text-sm font-semibold text-slate-900">
                            Tk {(row.unitPrice * row.quantity).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
              <label className="space-y-2 text-sm font-medium text-slate-700">
                <span>Exchange Note</span>
                <textarea
                  name="note"
                  rows={4}
                  placeholder="Customer complaint, color/size details, instructions for packaging..."
                  className="w-full rounded-xl border p-3 text-sm outline-none"
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-slate-700">
                <span>Exchange / Delivery Charge</span>
                <input
                  name="exchangeDeliveryCharge"
                  type="number"
                  min={0}
                  step="0.01"
                  value={deliveryCharge}
                  onChange={(event) =>
                    setDeliveryCharge(Math.max(0, Number(event.target.value || 0)))
                  }
                  className="min-h-11 w-full rounded-xl border px-3 outline-none"
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl border bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Return Credit</p>
                <p className="mt-1 text-xl font-bold">Tk {returnedCredit.toFixed(2)}</p>
              </div>
              <div className="rounded-2xl border bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Outgoing</p>
                <p className="mt-1 text-xl font-bold">Tk {outgoingSubtotal.toFixed(2)}</p>
              </div>
              <div className="rounded-2xl border bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Delivery</p>
                <p className="mt-1 text-xl font-bold">Tk {deliveryCharge.toFixed(2)}</p>
              </div>
              <div className="rounded-2xl border bg-emerald-50 p-4">
                <p className="text-xs uppercase tracking-wide text-emerald-700">Collect</p>
                <p className="mt-1 text-xl font-bold text-emerald-800">Tk {amountToCollect.toFixed(2)}</p>
              </div>
              <div className="rounded-2xl border bg-amber-50 p-4">
                <p className="text-xs uppercase tracking-wide text-amber-700">Customer Credit</p>
                <p className="mt-1 text-xl font-bold text-amber-800">Tk {customerCredit.toFixed(2)}</p>
              </div>
            </div>

            {state.message ? (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  state.success
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-rose-200 bg-rose-50 text-rose-800"
                }`}
              >
                <p>{state.message}</p>
                {state.success && state.exchangeCaseId ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={`/dashboard/exchange/${state.exchangeCaseId}`}
                      className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                    >
                      View Exchange
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={
                  pending ||
                  !expectedPayload.length ||
                  !outgoingPayload.length
                }
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-slate-900 px-6 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <ArrowRightLeft className="h-4 w-4" />
                {pending ? "Issuing Exchange..." : "Issue Exchange"}
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}
