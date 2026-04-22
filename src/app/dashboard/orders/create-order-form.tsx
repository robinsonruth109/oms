"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createManualOrder } from "./actions";

const initialState = {
  success: false,
  message: "",
};

type PageOption = {
  id: string;
  name: string;
  prefixCode: string;
};

type SourceOption = {
  id: string;
  name: string;
  type: string;
};

type ProductOption = {
  id: string;
  sku: string;
  name: string;
  sellingPrice: number;
  parentSku: string;
};

type CourierOption = {
  id: string;
  name: string;
  slug: string;
};

type ProductRow = {
  rowId: string;
  search: string;
  productId: string;
  productLabel: string;
  unitPrice: number;
  quantity: number;
};

type CreateOrderFormProps = {
  pages: PageOption[];
  sources: SourceOption[];
  products: ProductOption[];
  couriers: CourierOption[];
};

function makeRowId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createEmptyRow(): ProductRow {
  return {
    rowId: makeRowId(),
    search: "",
    productId: "",
    productLabel: "",
    unitPrice: 0,
    quantity: 1,
  };
}

function normalizeText(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLoose(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]/g, "");
}

function getProductSearchText(row: ProductRow) {
  return row.search.trim();
}

function filterProducts(products: ProductOption[], rawQuery: string) {
  const q = normalizeText(rawQuery);
  const qLoose = normalizeLoose(rawQuery);

  if (!q && !qLoose) {
    return products.slice(0, 20);
  }

  const startsWithMatches: ProductOption[] = [];
  const containsMatches: ProductOption[] = [];

  for (const product of products) {
    const sku = normalizeText(product.sku);
    const name = normalizeText(product.name);
    const parentSku = normalizeText(product.parentSku);

    const skuLoose = normalizeLoose(product.sku);
    const nameLoose = normalizeLoose(product.name);
    const parentLoose = normalizeLoose(product.parentSku);

    const starts =
      (q &&
        (sku.startsWith(q) ||
          name.startsWith(q) ||
          parentSku.startsWith(q))) ||
      (qLoose &&
        (skuLoose.startsWith(qLoose) ||
          nameLoose.startsWith(qLoose) ||
          parentLoose.startsWith(qLoose)));

    const contains =
      (q &&
        (sku.includes(q) ||
          name.includes(q) ||
          parentSku.includes(q))) ||
      (qLoose &&
        (skuLoose.includes(qLoose) ||
          nameLoose.includes(qLoose) ||
          parentLoose.includes(qLoose)));

    if (starts) {
      startsWithMatches.push(product);
    } else if (contains) {
      containsMatches.push(product);
    }
  }

  return [...startsWithMatches, ...containsMatches].slice(0, 20);
}

export default function CreateOrderForm({
  pages,
  sources,
  products,
  couriers,
}: CreateOrderFormProps) {
  const [state, formAction, pending] = useActionState(
    createManualOrder,
    initialState
  );

  const [rows, setRows] = useState<ProductRow[]>([createEmptyRow()]);
  const [discount, setDiscount] = useState(0);
  const [advance, setAdvance] = useState(0);
  const [deliveryCharge, setDeliveryCharge] = useState(0);
  const [itemsJson, setItemsJson] = useState("[]");
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    const payload = rows
      .filter((row) => row.productId && row.quantity > 0)
      .map((row) => ({
        productId: row.productId,
        quantity: row.quantity,
      }));

    setItemsJson(JSON.stringify(payload));
  }, [rows]);

  useEffect(() => {
    if (state.success) {
      setRows([createEmptyRow()]);
      setDiscount(0);
      setAdvance(0);
      setDeliveryCharge(0);
      setResetKey((prev) => prev + 1);
    }
  }, [state.success]);

  const subtotal = rows.reduce((sum, row) => {
    return sum + row.unitPrice * row.quantity;
  }, 0);

  const totalAmount = Math.max(
    subtotal + deliveryCharge - discount - advance,
    0
  );

  function addRow() {
    setRows((prev) => [...prev, createEmptyRow()]);
  }

  function removeRow(rowId: string) {
    setRows((prev) => {
      if (prev.length === 1) {
        return prev;
      }

      return prev.filter((row) => row.rowId !== rowId);
    });
  }

  function updateRow(rowId: string, patch: Partial<ProductRow>) {
    setRows((prev) =>
      prev.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row))
    );
  }

  function selectProduct(rowId: string, product: ProductOption) {
    updateRow(rowId, {
      productId: product.id,
      productLabel: `${product.sku} - ${product.name}`,
      search: "",
      unitPrice: product.sellingPrice,
      quantity: 1,
    });
  }

  const filteredMap = useMemo(() => {
    const map: Record<string, ProductOption[]> = {};

    for (const row of rows) {
      map[row.rowId] = filterProducts(products, getProductSearchText(row));
    }

    return map;
  }, [rows, products]);

  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900">
          Manual Order Entry
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Manual orders go directly to the selected courier and enter
          ready-to-ship flow.
        </p>
      </div>

      <form key={resetKey} action={formAction} className="space-y-6">
        <input type="hidden" name="items" value={itemsJson} />
        <input type="hidden" name="discount" value={discount} />
        <input type="hidden" name="advance" value={advance} />
        <input type="hidden" name="deliveryCharge" value={deliveryCharge} />

        <div className="rounded-2xl border bg-slate-50 p-4">
          <h3 className="mb-4 text-base font-semibold text-slate-900">
            Order Header
          </h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label
                htmlFor="pageId"
                className="text-sm font-medium text-slate-700"
              >
                Page
              </label>
              <select
                id="pageId"
                name="pageId"
                className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Select page
                </option>
                {pages.map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.name} ({page.prefixCode})
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                Invoice prefix comes from this page, like GL63527.
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="sourceId"
                className="text-sm font-medium text-slate-700"
              >
                Source
              </label>
              <select
                id="sourceId"
                name="sourceId"
                className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Select source
                </option>
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name} ({source.type})
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                Choose where this manual order belongs.
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="courier"
                className="text-sm font-medium text-slate-700"
              >
                Courier
              </label>
              <select
                id="courier"
                name="courier"
                className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Select courier
                </option>
                {couriers.map((courier) => (
                  <option key={courier.id} value={courier.slug}>
                    {courier.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                Order will go directly to this courier.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-slate-50 p-4">
          <h3 className="mb-4 text-base font-semibold text-slate-900">
            Customer Information
          </h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor="customerName"
                className="text-sm font-medium text-slate-700"
              >
                Customer Name
              </label>
              <input
                id="customerName"
                name="customerName"
                type="text"
                placeholder="Enter customer name"
                className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
                required
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="phone"
                className="text-sm font-medium text-slate-700"
              >
                Phone Number
              </label>
              <input
                id="phone"
                name="phone"
                type="text"
                placeholder="Enter phone number"
                className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
                required
              />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <label
              htmlFor="address"
              className="text-sm font-medium text-slate-700"
            >
              Address
            </label>
            <textarea
              id="address"
              name="address"
              placeholder="Enter customer address"
              className="min-h-[100px] w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
              required
            />
          </div>
        </div>

        <div className="rounded-2xl border bg-slate-50 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Product Items
              </h3>
              <p className="text-sm text-slate-500">
                You can add multiple products in one order.
              </p>
            </div>

            <Button type="button" variant="outline" onClick={addRow}>
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Button>
          </div>

          <div className="space-y-4">
            {rows.map((row, index) => (
              <div
                key={row.rowId}
                className="rounded-2xl border bg-white p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">
                    Item {index + 1}
                  </p>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => removeRow(row.rowId)}
                    disabled={rows.length === 1}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Search Product
                  </label>

                  <div className="relative">
                    <div className="flex items-center rounded-xl border bg-white px-3">
                      <Search className="h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={row.productLabel || row.search}
                        onChange={(e) =>
                          updateRow(row.rowId, {
                            search: e.target.value,
                            productLabel: "",
                            productId: "",
                            unitPrice: 0,
                          })
                        }
                        placeholder="Search by SKU, product name, parent SKU"
                        className="w-full px-2 py-2.5 text-sm outline-none"
                      />
                    </div>

                    {!row.productId && (
                      <div className="mt-2 max-h-56 overflow-y-auto rounded-2xl border bg-slate-50">
                        {filteredMap[row.rowId]?.map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => selectProduct(row.rowId, product)}
                            className="flex w-full flex-col items-start border-b px-4 py-3 text-left last:border-b-0 hover:bg-slate-100"
                          >
                            <span className="text-sm font-semibold text-slate-900">
                              {product.sku}
                            </span>
                            <span className="text-xs text-slate-500">
                              {product.name}
                            </span>
                            <span className="text-xs text-slate-400">
                              Parent: {product.parentSku} | Sell: ৳{" "}
                              {product.sellingPrice.toFixed(2)}
                            </span>
                          </button>
                        ))}

                        {!filteredMap[row.rowId]?.length && (
                          <div className="px-4 py-3 text-sm text-slate-500">
                            No product found.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">
                      Unit Price
                    </label>
                    <input
                      type="text"
                      value={row.unitPrice.toFixed(2)}
                      readOnly
                      className="w-full rounded-xl border bg-slate-50 px-3 py-2.5 text-sm outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={row.quantity}
                      onChange={(e) =>
                        updateRow(row.rowId, {
                          quantity: Number(e.target.value || 1),
                        })
                      }
                      className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">
                      Row Total
                    </label>
                    <input
                      type="text"
                      value={(row.unitPrice * row.quantity).toFixed(2)}
                      readOnly
                      className="w-full rounded-xl border bg-slate-50 px-3 py-2.5 text-sm outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border bg-slate-50 p-4">
          <h3 className="mb-4 text-base font-semibold text-slate-900">
            Totals & Adjustments
          </h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label
                htmlFor="discountVisible"
                className="text-sm font-medium text-slate-700"
              >
                Discount
              </label>
              <input
                id="discountVisible"
                type="number"
                min="0"
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value || 0))}
                className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
              />
              <p className="text-xs text-slate-500">
                Total discount on this whole order.
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="advanceVisible"
                className="text-sm font-medium text-slate-700"
              >
                Advance
              </label>
              <input
                id="advanceVisible"
                type="number"
                min="0"
                step="0.01"
                value={advance}
                onChange={(e) => setAdvance(Number(e.target.value || 0))}
                className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
              />
              <p className="text-xs text-slate-500">
                Advance payment already received from customer.
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="deliveryChargeVisible"
                className="text-sm font-medium text-slate-700"
              >
                Delivery Charge
              </label>
              <input
                id="deliveryChargeVisible"
                type="number"
                min="0"
                step="0.01"
                value={deliveryCharge}
                onChange={(e) =>
                  setDeliveryCharge(Number(e.target.value || 0))
                }
                className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
              />
              <p className="text-xs text-slate-500">
                Courier or shipping charge for this order.
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-white p-4">
            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-4">
              <div>
                <p className="text-slate-400">Subtotal</p>
                <p className="font-semibold text-slate-900">
                  ৳ {subtotal.toFixed(2)}
                </p>
              </div>

              <div>
                <p className="text-slate-400">Discount</p>
                <p className="font-semibold text-slate-900">
                  ৳ {discount.toFixed(2)}
                </p>
              </div>

              <div>
                <p className="text-slate-400">Advance</p>
                <p className="font-semibold text-slate-900">
                  ৳ {advance.toFixed(2)}
                </p>
              </div>

              <div>
                <p className="text-slate-400">Final Payable</p>
                <p className="font-semibold text-slate-900">
                  ৳ {totalAmount.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <label
              htmlFor="note"
              className="text-sm font-medium text-slate-700"
            >
              Note
            </label>
            <input
              id="note"
              name="note"
              type="text"
              placeholder="Optional note"
              className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
            />
          </div>
        </div>

        {state.message ? (
          <div
            className={`rounded-2xl px-4 py-3 text-sm ${
              state.success
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {state.message}
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={pending || !rows.some((row) => row.productId)}
          >
            {pending ? "Creating Order..." : "Create Order"}
          </Button>
        </div>
      </form>
    </div>
  );
}