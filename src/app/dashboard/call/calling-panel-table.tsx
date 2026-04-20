"use client";

import { useMemo, useState, useTransition } from "react";
import { Eye, Search, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { directCancelCallingOrder, saveCallingOrder } from "./actions";
import { Page } from "@prisma/client";

type CallingOrderItem = {
  id: string;
  orderId: string;
  productId: string | null;
  productSku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  createdAt: string;
  updatedAt: string;
};

type CallingOrder = {
  id: string;
  orderId: string | null;
  invoiceId: string | null;
  externalOrderId: string | null;
  customerName: string;
  phone: string;
  address: string;
  subtotal: number;
  discount: number;
  advance: number;
  deliveryCharge: number;
  totalAmount: number;
  orderStatus: string;
  courier: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  readyToShipAt: string;
  calledAt: string | null;
  pageId: string | null;
  source: {
    id: string;
    name: string;
    type: string;
  };
  integration: {
    id: string;
    name: string;
    slug: string;
    platform: string;
  } | null;
  calledByUser: {
    id: string;
    name: string;
    username: string;
  } | null;
  items: CallingOrderItem[];
};

type CourierOption = {
  id: string;
  name: string;
  slug: string;
};

type ProductOption = {
  id: string;
  sku: string;
  name: string;
  sellingPrice: number;
  parentSku: string;
};

type PageOption = {
  id: string;
  name: string;
};

type EditableRowState = {
  customerName: string;
  phone: string;
  address: string;
  discount: number;
  deliveryCharge: number;
  courier: string;
  readyToShipAt: string;
  status: "READY_TO_SHIP" | "NO_ANSWER" | "PHONE_OFF" | "STOCK_OUT" | "CANCELLED";
  note: string;
  productSearch: string;
  selectedProductId: string;
  selectedProductLabel: string;
  quantity: number;
  pageId?: string;
};

function formatDate(value: string | null) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString();
}

function formatMoney(value: number) {
  return `৳ ${value.toFixed(2)}`;
}

function getDefaultState(order: CallingOrder): EditableRowState {
  const firstItem = order.items[0];

  return {
    customerName: order.customerName,
    phone: order.phone,
    address: order.address,
    discount: order.discount,
    deliveryCharge: order.deliveryCharge,
    courier: order.courier || "",
    readyToShipAt: order.readyToShipAt || new Date().toISOString().slice(0, 10),
    status:
      order.orderStatus === "NO_ANSWER" || order.orderStatus === "PHONE_OFF"
        ? (order.orderStatus as "NO_ANSWER" | "PHONE_OFF")
        : "READY_TO_SHIP",
    note: order.note || "",
    productSearch: "",
    selectedProductId: firstItem?.productId || "",
    selectedProductLabel: firstItem
      ? `${firstItem.productSku} - ${firstItem.productName}`
      : "",
    quantity: firstItem?.quantity || 1,
    pageId: order.pageId || "",
  };
}

function buildInitialMap(orders: CallingOrder[]) {
  return orders.reduce<Record<string, EditableRowState>>((acc, order) => {
    acc[order.id] = getDefaultState(order);
    return acc;
  }, {});
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING_CONFIRMATION: "bg-amber-100 text-amber-700",
    NO_ANSWER: "bg-slate-200 text-slate-700",
    PHONE_OFF: "bg-slate-200 text-slate-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
        styles[status] || "bg-slate-100 text-slate-700"
      }`}
    >
      {status}
    </span>
  );
}

export default function CallingPanelTable({
  orders,
  couriers,
  products,
  pages,
}: {
  orders: CallingOrder[];
  couriers: CourierOption[];
  products: ProductOption[];
  pages: PageOption[];
}) {
  const [rowMap, setRowMap] = useState<Record<string, EditableRowState>>(
    buildInitialMap(orders)
  );
  const [messageMap, setMessageMap] = useState<Record<string, { success: boolean; message: string }>>({});
  const [pendingRowId, setPendingRowId] = useState<string | null>(null);
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function updateRow(orderId: string, patch: Partial<EditableRowState>) {
    setRowMap((prev) => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        ...patch,
      },
    }));
  }

  function getFilteredProducts(orderId: string) {
    const row = rowMap[orderId];
    const q = (row.selectedProductLabel || row.productSearch || "").trim().toLowerCase();

    if (!q) {
      return products.slice(0, 8);
    }

    return products
      .filter((product) => {
        return (
          product.sku.toLowerCase().includes(q) ||
          product.name.toLowerCase().includes(q) ||
          product.parentSku.toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }

  function selectProduct(orderId: string, product: ProductOption) {
    updateRow(orderId, {
      selectedProductId: product.id,
      selectedProductLabel: `${product.sku} - ${product.name}`,
      productSearch: "",
    });
  }

  function clearMessage(orderId: string) {
    setMessageMap((prev) => {
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
  }

  function setRowMessage(orderId: string, success: boolean, message: string) {
    setMessageMap((prev) => ({
      ...prev,
      [orderId]: { success, message },
    }));
  }

  function handleSave(order: CallingOrder) {
    const row = rowMap[order.id];
    const isSingleItem = order.items.length === 1;

    clearMessage(order.id);
    setPendingRowId(order.id);

    startTransition(async () => {
      const result = await saveCallingOrder({
        orderId: order.id,
        customerName: row.customerName,
        phone: row.phone,
        address: row.address,
        discount: row.discount,
        deliveryCharge: row.deliveryCharge,
        courier: row.courier,
        readyToShipAt: row.readyToShipAt,
        status: row.status,
        note: row.note,
        pageId: row.pageId,
        singleItem: isSingleItem
          ? {
              orderItemId: order.items[0].id,
              productId: row.selectedProductId,
              quantity: row.quantity,
            }
          : null,
      });

      setPendingRowId(null);
      setRowMessage(order.id, result.success, result.message);
    });
  }

  function handleDirectCancel(orderId: string) {
    clearMessage(orderId);
    setPendingCancelId(orderId);

    startTransition(async () => {
      const result = await directCancelCallingOrder(orderId);
      setPendingCancelId(null);
      setRowMessage(orderId, result.success, result.message);
    });
  }

  const summary = useMemo(() => {
    return {
      total: orders.length,
      alreadyCalled: orders.filter((order) => order.calledAt).length,
      notCalled: orders.filter((order) => !order.calledAt).length,
      singleItemOrders: orders.filter((order) => order.items.length === 1).length,
    };
  }, [orders]);

  return (
    <div className="rounded-3xl border bg-white shadow-sm">
      <div className="border-b px-5 py-4 sm:px-6">
        <h2 className="text-lg font-semibold text-slate-900">
          Pending Calling Queue
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Inline edit is enabled for customer fields and single-item orders. Multi-product editing will come in View next.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 border-b bg-slate-50 px-5 py-4 sm:px-6 xl:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-sm font-medium text-slate-500">Total Queue</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {summary.total}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <p className="text-sm font-medium text-slate-500">Already Called</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {summary.alreadyCalled}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <p className="text-sm font-medium text-slate-500">Not Called</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {summary.notCalled}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <p className="text-sm font-medium text-slate-500">Single Item Orders</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {summary.singleItemOrders}
          </p>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {orders.map((order) => {
          const row = rowMap[order.id];
          const isSingleItem = order.items.length === 1;
          const filteredProducts = getFilteredProducts(order.id);
          const selectedProduct = products.find((product) => product.id === row.selectedProductId);
          const currentUnitPrice = selectedProduct
            ? selectedProduct.sellingPrice
            : order.items[0]?.unitPrice || 0;
          const currentSubtotal = isSingleItem
            ? currentUnitPrice * row.quantity
            : order.items.reduce((sum, item) => sum + item.lineTotal, 0);
          const currentTotal = Math.max(
            currentSubtotal + row.deliveryCharge - row.discount - order.advance,
            0
          );
          const rowMessage = messageMap[order.id];

          return (
            <div key={order.id} className="rounded-2xl border bg-slate-50 p-4">
              <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {order.invoiceId || "N/A"}
                    </h3>
                    <StatusBadge status={order.orderStatus} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Source: {order.source.name} · Platform: {order.integration?.platform || "N/A"} · External ID: {order.externalOrderId || "N/A"}
                  </p>
                </div>

                <div className="text-sm text-slate-500">
                  <p>Imported: {formatDate(order.createdAt)}</p>
                  <p>Called by: {order.calledByUser?.name || "N/A"}</p>
                  <p>Called at: {formatDate(order.calledAt)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                <div className="xl:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={row.customerName}
                    onChange={(e) =>
                      updateRow(order.id, { customerName: e.target.value })
                    }
                    className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
                  />
                </div>

                <div className="xl:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={row.phone}
                    onChange={(e) =>
                      updateRow(order.id, { phone: e.target.value })
                    }
                    className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
                  />
                </div>

                <div className="xl:col-span-3">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Address
                  </label>
                  <textarea
                    value={row.address}
                    onChange={(e) =>
                      updateRow(order.id, { address: e.target.value })
                    }
                    className="min-h-[92px] w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
                  />
                </div>

                <div className="xl:col-span-3">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Product
                  </label>

                  {isSingleItem ? (
                    <div className="space-y-2">
                      <div className="flex items-center rounded-xl border bg-white px-3">
                        <Search className="h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          value={row.selectedProductLabel || row.productSearch}
                          onChange={(e) =>
                            updateRow(order.id, {
                              productSearch: e.target.value,
                              selectedProductLabel: "",
                              selectedProductId: "",
                            })
                          }
                          placeholder="Search by SKU, name, parent SKU"
                          className="w-full px-2 py-2.5 text-sm outline-none"
                        />
                      </div>

                      {!row.selectedProductId && (
                        <div className="max-h-52 overflow-y-auto rounded-2xl border bg-white">
                          {filteredProducts.map((product) => (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => selectProduct(order.id, product)}
                              className="flex w-full flex-col items-start border-b px-4 py-3 text-left last:border-b-0 hover:bg-slate-50"
                            >
                              <span className="text-sm font-semibold text-slate-900">
                                {product.sku}
                              </span>
                              <span className="text-xs text-slate-500">
                                {product.name}
                              </span>
                              <span className="text-xs text-slate-400">
                                Parent: {product.parentSku} | Sell: ৳ {product.sellingPrice.toFixed(2)}
                              </span>
                            </button>
                          ))}

                          {!filteredProducts.length && (
                            <div className="px-4 py-3 text-sm text-slate-500">
                              No product found.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border bg-white p-3 text-sm text-slate-600">
                      <p className="font-medium text-slate-900">Multiple products found.</p>
                      <div className="mt-2 space-y-1">
                        {order.items.map((item) => (
                          <p key={item.id}>
                            {item.productSku ? `${item.productSku} - ` : ""}
                            {item.productName} × {item.quantity}
                          </p>
                        ))}
                      </div>
                      <p className="mt-3 text-xs text-slate-500">
                        Use View for full multi-product edit.
                      </p>
                    </div>
                  )}
                </div>

                <div className="xl:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={row.quantity}
                    disabled={!isSingleItem}
                    onChange={(e) =>
                      updateRow(order.id, {
                        quantity: Number(e.target.value || 1),
                      })
                    }
                    className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none disabled:bg-slate-100"
                  />
                </div>

                <div className="xl:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Discount
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.discount}
                    onChange={(e) =>
                      updateRow(order.id, {
                        discount: Number(e.target.value || 0),
                      })
                    }
                    className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
                  />
                </div>

                <div className="xl:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Delivery Charge
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.deliveryCharge}
                    onChange={(e) =>
                      updateRow(order.id, {
                        deliveryCharge: Number(e.target.value || 0),
                      })
                    }
                    className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
                  />
                </div>

                <div className="xl:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Page
                  </label>
                  <select
                    value={row.pageId}
                    onChange={(e) =>
                      updateRow(order.id, { pageId: e.target.value })
                    }
                    className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
                  >
                    <option value="">Select page</option>
                    {pages.map((page) => (
                      <option key={page.id} value={page.id}>
                        {page.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="xl:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Courier
                  </label>
                  <select
                    value={row.courier}
                    onChange={(e) =>
                      updateRow(order.id, { courier: e.target.value })
                    }
                    className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
                  >
                    <option value="">Select courier</option>
                    {couriers.map((courier) => (
                      <option key={courier.id} value={courier.slug}>
                        {courier.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="xl:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Ready To Ship Date
                  </label>
                  <input
                    type="date"
                    value={row.readyToShipAt}
                    onChange={(e) =>
                      updateRow(order.id, { readyToShipAt: e.target.value })
                    }
                    className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
                  />
                </div>

                <div className="xl:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Status
                  </label>
                  <select
                    value={row.status}
                    onChange={(e) =>
                      updateRow(order.id, {
                        status: e.target.value as EditableRowState["status"],
                      })
                    }
                    className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
                  >
                    <option value="READY_TO_SHIP">Confirm</option>
                    <option value="NO_ANSWER">No Answer</option>
                    <option value="PHONE_OFF">Phone Off</option>
                    <option value="STOCK_OUT">Stock Out</option>
                    <option value="CANCELLED">Cancel</option>
                  </select>
                </div>

                <div className="xl:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Row Total
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={formatMoney(currentTotal)}
                    className="w-full rounded-xl border bg-slate-100 px-3 py-2.5 text-sm outline-none"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-slate-500">
                  <p>Subtotal: {formatMoney(currentSubtotal)}</p>
                  <p>Advance: {formatMoney(order.advance)}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      window.location.href = `/dashboard/call/${order.id}`;
                    }}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={pendingCancelId === order.id}
                    onClick={() => handleDirectCancel(order.id)}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    {pendingCancelId === order.id ? "Cancelling..." : "Direct Cancel"}
                  </Button>

                  <Button
                    type="button"
                    disabled={pendingRowId === order.id}
                    onClick={() => handleSave(order)}
                  >
                    {pendingRowId === order.id ? "Saving..." : "Submit"}
                  </Button>
                </div>
              </div>

              {rowMessage ? (
                <div
                  className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
                    rowMessage.success
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {rowMessage.message}
                </div>
              ) : null}
            </div>
          );
        })}

        {!orders.length && (
          <div className="rounded-2xl border bg-slate-50 px-6 py-8 text-center text-sm text-slate-500">
            No calling orders found.
          </div>
        )}
      </div>
    </div>
  );
}