"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Eye, Search, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBangladeshDateTime, getBangladeshDateInputValue } from "@/lib/bangladesh-time";
import { normalizeBangladeshPhone } from "@/lib/phone-normalization";
import {
  claimCallingOrder,
  directCancelCallingOrder,
  saveCallingOrder,
} from "./actions";
import CourierRiskPanel from "./courier-risk-panel";

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

type UserRef = {
  id: string;
  name: string;
  username: string;
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
  holdAt: string | null;
  holdUntil: string | null;
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
  calledByUser: UserRef | null;
  holdByUser: UserRef | null;
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
  status:
    | "READY_TO_SHIP"
    | "NO_ANSWER"
    | "PHONE_OFF"
    | "STOCK_OUT"
    | "CANCELLED";
  note: string;
  productSearch: string;
  selectedProductId: string;
  selectedProductLabel: string;
  quantity: number;
  pageId?: string;
};

type HoldState = {
  userId: string | null;
  name: string | null;
  holdAt: string | null;
  holdUntil: string | null;
};

function formatDate(value: string | null) {
  return formatBangladeshDateTime(value);
}

function formatMoney(value: number) {
  return `৳ ${value.toFixed(2)}`;
}

function normalizeText(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhone(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeLooseText(value: string) {
  return normalizeText(value).replace(/[^a-z0-9\u0980-\u09ff]+/g, "");
}

function isLikelyIncompleteAddress(value: string) {
  const original = String(value || "").trim();

  if (!original) return true;

  const cleaned = original
    .replace(/\bbangladesh\b/gi, " ")
    .replace(/বাংলাদেশ/gi, " ")
    .replace(/\b(n\/a|na|null|undefined)\b/gi, " ")
    .replace(/(^|[\s,;|])-(?=$|[\s,;|])/g, " ")
    .replace(/[,\-_/;|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return true;

  const words = cleaned.split(/\s+/).filter(Boolean);

  return cleaned.length < 18 || words.length < 3;
}

function findMatchedProduct(
  order: CallingOrder,
  products: ProductOption[]
): ProductOption | null {
  const firstItem = order.items[0];
  if (!firstItem) return null;

  if (firstItem.productId) {
    const byId = products.find(
      (product) => product.id === firstItem.productId
    );
    if (byId) return byId;
  }

  const itemSku = normalizeText(firstItem.productSku);
  const itemName = normalizeText(firstItem.productName);
  const itemSkuLoose = normalizeLooseText(firstItem.productSku);
  const itemNameLoose = normalizeLooseText(firstItem.productName);

  const exactSku = products.find(
    (product) => normalizeText(product.sku) === itemSku
  );
  if (exactSku) return exactSku;

  const exactName = products.find(
    (product) => normalizeText(product.name) === itemName
  );
  if (exactName) return exactName;

  const looseSku = products.find(
    (product) => normalizeLooseText(product.sku) === itemSkuLoose
  );
  if (looseSku) return looseSku;

  const looseName = products.find(
    (product) => normalizeLooseText(product.name) === itemNameLoose
  );
  if (looseName) return looseName;

  const partial = products.find((product) => {
    const sku = normalizeText(product.sku);
    const name = normalizeText(product.name);
    const skuLoose = normalizeLooseText(product.sku);
    const nameLoose = normalizeLooseText(product.name);

    return (
      (!!itemSku && (sku.includes(itemSku) || itemSku.includes(sku))) ||
      (!!itemName && (name.includes(itemName) || itemName.includes(name))) ||
      (!!itemSkuLoose &&
        (skuLoose.includes(itemSkuLoose) ||
          itemSkuLoose.includes(skuLoose))) ||
      (!!itemNameLoose &&
        (nameLoose.includes(itemNameLoose) ||
          itemNameLoose.includes(nameLoose)))
    );
  });

  return partial || null;
}

function getDefaultState(
  order: CallingOrder,
  products: ProductOption[]
): EditableRowState {
  const firstItem = order.items[0];
  const matchedProduct = findMatchedProduct(order, products);

  return {
    customerName: order.customerName,
    phone: order.phone,
    address: order.address,
    discount: order.discount,
    deliveryCharge: order.deliveryCharge,
    courier: order.courier || "",
    readyToShipAt:
      order.readyToShipAt || getBangladeshDateInputValue(),
    status:
      order.orderStatus === "NO_ANSWER" ||
      order.orderStatus === "PHONE_OFF"
        ? (order.orderStatus as "NO_ANSWER" | "PHONE_OFF")
        : "READY_TO_SHIP",
    note: order.note || "",
    productSearch: "",
    selectedProductId: matchedProduct?.id || "",
    selectedProductLabel: matchedProduct
      ? `${matchedProduct.sku} - ${matchedProduct.name}`
      : firstItem
        ? `${firstItem.productSku} - ${firstItem.productName}`
        : "",
    quantity: firstItem?.quantity || 1,
    pageId: order.pageId || "",
  };
}

function buildInitialMap(
  orders: CallingOrder[],
  products: ProductOption[]
) {
  return orders.reduce<Record<string, EditableRowState>>((acc, order) => {
    acc[order.id] = getDefaultState(order, products);
    return acc;
  }, {});
}

function buildInitialHoldMap(orders: CallingOrder[]) {
  return orders.reduce<Record<string, HoldState>>((acc, order) => {
    acc[order.id] = {
      userId: order.holdByUser?.id || null,
      name: order.holdByUser?.name || null,
      holdAt: order.holdAt,
      holdUntil: order.holdUntil,
    };
    return acc;
  }, {});
}

function isHoldActive(hold: HoldState | undefined) {
  if (!hold?.userId || !hold.holdUntil) return false;
  return new Date(hold.holdUntil).getTime() > Date.now();
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
  queueSummary,
  currentUser,
}: {
  orders: CallingOrder[];
  couriers: CourierOption[];
  products: ProductOption[];
  pages: PageOption[];
  queueSummary: {
    total: number;
    alreadyCalled: number;
    notCalled: number;
    singleItemOrders: number;
  };
  currentUser: {
    id: string;
    name: string;
  };
}) {
  const [rowMap, setRowMap] = useState<Record<string, EditableRowState>>(
    buildInitialMap(orders, products)
  );
  const [holdMap, setHoldMap] = useState<Record<string, HoldState>>(
    buildInitialHoldMap(orders)
  );
  const [messageMap, setMessageMap] = useState<
    Record<string, { success: boolean; message: string }>
  >({});
  const [pendingRowId, setPendingRowId] = useState<string | null>(null);
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [claimingRowId, setClaimingRowId] = useState<string | null>(null);
  const [lockModal, setLockModal] = useState<{
    agentName: string;
    invoice: string;
  } | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setRowMap(buildInitialMap(orders, products));
    setHoldMap(buildInitialHoldMap(orders));
  }, [orders, products]);

  function getRow(order: CallingOrder) {
    return rowMap[order.id] || getDefaultState(order, products);
  }

  function getHold(order: CallingOrder) {
    return (
      holdMap[order.id] || {
        userId: order.holdByUser?.id || null,
        name: order.holdByUser?.name || null,
        holdAt: order.holdAt,
        holdUntil: order.holdUntil,
      }
    );
  }

  function updateRow(
    orderId: string,
    patch: Partial<EditableRowState>
  ) {
    const order = orders.find((item) => item.id === orderId);
    if (!order) return;

    setRowMap((prev) => ({
      ...prev,
      [orderId]: {
        ...(prev[orderId] || getDefaultState(order, products)),
        ...patch,
      },
    }));
  }

  function showLocked(order: CallingOrder, agentName?: string | null) {
    setLockModal({
      agentName: agentName || "Another agent",
      invoice: order.invoiceId || order.orderId || "this order",
    });
  }

  async function ensureClaim(order: CallingOrder) {
    const currentHold = getHold(order);

    if (
      isHoldActive(currentHold) &&
      currentHold.userId === currentUser.id
    ) {
      return true;
    }

    if (
      isHoldActive(currentHold) &&
      currentHold.userId !== currentUser.id
    ) {
      showLocked(order, currentHold.name);
      return false;
    }

    if (!currentUser.id) {
      setRowMessage(order.id, false, "Your session is not available.");
      return false;
    }

    setClaimingRowId(order.id);

    try {
      const result = await claimCallingOrder(order.id);

      if (result.success && result.holder) {
        setHoldMap((prev) => ({
          ...prev,
          [order.id]: {
            userId: result.holder?.id || currentUser.id,
            name: result.holder?.name || currentUser.name,
            holdAt: new Date().toISOString(),
            holdUntil: result.holdUntil || null,
          },
        }));
        return true;
      }

      if (result.holder) {
        setHoldMap((prev) => ({
          ...prev,
          [order.id]: {
            userId: result.holder?.id || null,
            name: result.holder?.name || null,
            holdAt: null,
            holdUntil: result.holdUntil || null,
          },
        }));
      }

      showLocked(order, result.holder?.name || "Another agent");
      return false;
    } finally {
      setClaimingRowId(null);
    }
  }

  function clearLocalHold(orderId: string) {
    setHoldMap((prev) => ({
      ...prev,
      [orderId]: {
        userId: null,
        name: null,
        holdAt: null,
        holdUntil: null,
      },
    }));
  }

  function getFilteredProducts(order: CallingOrder) {
    const row = getRow(order);
    const raw =
      row.productSearch !== ""
        ? row.productSearch
        : row.selectedProductLabel;
    const q = normalizeText(raw);
    const qLoose = normalizeLooseText(raw);

    if (!q && !qLoose) {
      return products;
    }

    const startsWithMatches: ProductOption[] = [];
    const containsMatches: ProductOption[] = [];

    for (const product of products) {
      const sku = normalizeText(product.sku);
      const name = normalizeText(product.name);
      const parentSku = normalizeText(product.parentSku);
      const combined = normalizeText(
        `${product.sku} ${product.name} ${product.parentSku}`
      );

      const skuLoose = normalizeLooseText(product.sku);
      const nameLoose = normalizeLooseText(product.name);
      const parentSkuLoose = normalizeLooseText(product.parentSku);
      const combinedLoose = normalizeLooseText(
        `${product.sku} ${product.name} ${product.parentSku}`
      );

      const isStartsWith =
        (!!q &&
          (sku.startsWith(q) ||
            name.startsWith(q) ||
            parentSku.startsWith(q))) ||
        (!!qLoose &&
          (skuLoose.startsWith(qLoose) ||
            nameLoose.startsWith(qLoose) ||
            parentSkuLoose.startsWith(qLoose)));

      const isContains =
        (!!q &&
          (sku.includes(q) ||
            name.includes(q) ||
            parentSku.includes(q) ||
            combined.includes(q))) ||
        (!!qLoose &&
          (skuLoose.includes(qLoose) ||
            nameLoose.includes(qLoose) ||
            parentSkuLoose.includes(qLoose) ||
            combinedLoose.includes(qLoose)));

      if (isStartsWith) {
        startsWithMatches.push(product);
      } else if (isContains) {
        containsMatches.push(product);
      }
    }

    return [...startsWithMatches, ...containsMatches];
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

  function setRowMessage(
    orderId: string,
    success: boolean,
    message: string
  ) {
    setMessageMap((prev) => ({
      ...prev,
      [orderId]: { success, message },
    }));
  }

  async function handleSave(order: CallingOrder) {
    const claimed = await ensureClaim(order);
    if (!claimed) return;

    const row = getRow(order);
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

      if (result.success) {
        clearLocalHold(order.id);
      }
    });
  }

  async function handleDirectCancel(order: CallingOrder) {
    const claimed = await ensureClaim(order);
    if (!claimed) return;

    clearMessage(order.id);
    setPendingCancelId(order.id);

    startTransition(async () => {
      const result = await directCancelCallingOrder(order.id);
      setPendingCancelId(null);
      setRowMessage(order.id, result.success, result.message);

      if (result.success) {
        clearLocalHold(order.id);
      }
    });
  }

  const summary = queueSummary;

  const duplicateKeyMap = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const order of orders) {
      const row =
        rowMap[order.id] || getDefaultState(order, products);
      const phone = normalizePhone(row.phone || order.phone || "");

      let productKey = "";

      if (order.items.length === 1) {
        productKey = row.selectedProductId
          ? `id:${row.selectedProductId}`
          : normalizeText(
              row.selectedProductLabel ||
                `${order.items[0]?.productSku || ""} ${
                  order.items[0]?.productName || ""
                }`
            );
      } else {
        productKey = normalizeText(
          order.items
            .map(
              (item) => `${item.productSku} ${item.productName}`
            )
            .join(" | ")
        );
      }

      const key = `${phone}__${productKey}`;

      if (!phone || !productKey) continue;
      counts[key] = (counts[key] || 0) + 1;
    }

    return counts;
  }, [orders, rowMap, products]);

  return (
    <>
      <div className="rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Pending Calling Queue
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Clicking an order card temporarily holds it for the current
            agent. Submit or Direct Cancel releases the hold automatically.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 border-b bg-slate-50 px-5 py-4 sm:px-6 xl:grid-cols-4">
          <div className="rounded-2xl border bg-white p-4">
            <p className="text-sm font-medium text-slate-500">
              Total Queue
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {summary.total}
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-4">
            <p className="text-sm font-medium text-slate-500">
              Already Called
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {summary.alreadyCalled}
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-4">
            <p className="text-sm font-medium text-slate-500">
              Not Called
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {summary.notCalled}
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-4">
            <p className="text-sm font-medium text-slate-500">
              Single Item Orders
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {summary.singleItemOrders}
            </p>
          </div>
        </div>

        <div className="space-y-4 p-4">
          {orders.map((order) => {
            const row = getRow(order);
            const hold = getHold(order);
            const activeHold = isHoldActive(hold);
            const heldByMe =
              activeHold && hold.userId === currentUser.id;
            const heldByOther =
              activeHold &&
              !!hold.userId &&
              hold.userId !== currentUser.id;

            const isSingleItem = order.items.length === 1;
            const filteredProducts = getFilteredProducts(order);
            const selectedProduct = products.find(
              (product) => product.id === row.selectedProductId
            );
            const currentUnitPrice = selectedProduct
              ? selectedProduct.sellingPrice
              : order.items[0]?.unitPrice || 0;
            const currentSubtotal = isSingleItem
              ? currentUnitPrice * row.quantity
              : order.items.reduce(
                  (sum, item) => sum + item.lineTotal,
                  0
                );
            const currentTotal = Math.max(
              currentSubtotal +
                row.deliveryCharge -
                row.discount -
                order.advance,
              0
            );
            const rowMessage = messageMap[order.id];
            const incompleteAddress =
              isLikelyIncompleteAddress(row.address);

            const duplicatePhone = normalizePhone(
              row.phone || order.phone || ""
            );
            const duplicateProductKey = isSingleItem
              ? row.selectedProductId
                ? `id:${row.selectedProductId}`
                : normalizeText(
                    row.selectedProductLabel ||
                      `${order.items[0]?.productSku || ""} ${
                        order.items[0]?.productName || ""
                      }`
                  )
              : normalizeText(
                  order.items
                    .map(
                      (item) =>
                        `${item.productSku} ${item.productName}`
                    )
                    .join(" | ")
                );

            const duplicateKey = `${duplicatePhone}__${duplicateProductKey}`;
            const hasDuplicateMemo =
              !!duplicatePhone &&
              !!duplicateProductKey &&
              (duplicateKeyMap[duplicateKey] || 0) > 1;

            const cardClass = heldByOther
              ? "border-red-400 bg-red-50"
              : heldByMe
                ? "border-emerald-400 bg-emerald-50/40"
                : hasDuplicateMemo
                  ? "border-red-300 bg-red-50"
                  : "bg-slate-50";

            return (
              <div
                key={order.id}
                className={`relative rounded-2xl border p-4 transition ${cardClass}`}
                onPointerDownCapture={() => {
                  if (!heldByOther) {
                    void ensureClaim(order);
                  }
                }}
              >
                {heldByOther ? (
                  <button
                    type="button"
                    aria-label="Order is held by another agent"
                    className="absolute inset-0 z-30 cursor-not-allowed rounded-2xl bg-transparent"
                    onClick={() => showLocked(order, hold.name)}
                  />
                ) : null}

                <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {order.invoiceId || "N/A"}
                      </h3>
                      <StatusBadge status={order.orderStatus} />

                      {heldByMe ? (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                          Held by you
                        </span>
                      ) : null}

                      {heldByOther ? (
                        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                          Agent calling
                        </span>
                      ) : null}

                      {claimingRowId === order.id ? (
                        <span className="text-xs font-medium text-slate-500">
                          Locking...
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-1 text-sm text-slate-500">
                      Source: {order.source.name} · Platform:{" "}
                      {order.integration?.platform || "N/A"} · External ID:{" "}
                      {order.externalOrderId || "N/A"}
                    </p>
                  </div>

                  <div className="text-sm text-slate-500">
                    <p>Imported: {formatDate(order.createdAt)}</p>
                    <p
                      className={
                        heldByMe
                          ? "font-semibold text-emerald-700"
                          : heldByOther
                            ? "font-semibold text-red-700"
                            : ""
                      }
                    >
                      Hold by:{" "}
                      {activeHold
                        ? hold.name || "Agent"
                        : "N/A"}
                    </p>
                    <p>
                      Called by:{" "}
                      {order.calledByUser?.name || "N/A"}
                    </p>
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
                        updateRow(order.id, {
                          customerName: e.target.value,
                        })
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
                        updateRow(order.id, {
                          phone: normalizeBangladeshPhone(e.target.value),
                        })
                      }
                      className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
                    />
                  </div>

                  <div className="xl:col-span-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <label className="block text-sm font-medium text-slate-700">
                        Address
                      </label>

                      {incompleteAddress ? (
                        <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                          Incomplete address
                        </span>
                      ) : null}
                    </div>

                    <textarea
                      value={row.address}
                      onChange={(e) =>
                        updateRow(order.id, {
                          address: e.target.value,
                        })
                      }
                      className={`min-h-[92px] w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition ${
                        incompleteAddress
                          ? "border-red-500 bg-red-50 text-red-900 ring-2 ring-red-100 focus:border-red-600 focus:ring-red-200"
                          : "border-slate-200 bg-white focus:border-slate-400"
                      }`}
                    />

                    {incompleteAddress ? (
                      <p className="mt-1.5 text-xs font-medium text-red-600">
                        ⚠ ঠিকানাটি অসম্পূর্ণ মনে হচ্ছে। কাস্টমারের কাছ
                        থেকে সম্পূর্ণ ঠিকানা নিন।
                      </p>
                    ) : null}
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
                            value={
                              row.productSearch !== ""
                                ? row.productSearch
                                : row.selectedProductLabel
                            }
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
                                onClick={() =>
                                  selectProduct(order.id, product)
                                }
                                className="flex w-full flex-col items-start border-b px-4 py-3 text-left last:border-b-0 hover:bg-slate-50"
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

                            {!filteredProducts.length && (
                              <div className="px-4 py-3 text-sm text-slate-500">
                                No product found.
                              </div>
                            )}
                          </div>
                        )}

                        {row.selectedProductId ? (
                          <p className="text-xs text-emerald-600">
                            Selected: {row.selectedProductLabel}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="rounded-xl border bg-white p-3 text-sm text-slate-600">
                        <p className="font-medium text-slate-900">
                          Multiple products found.
                        </p>
                        <div className="mt-2 space-y-1">
                          {order.items.map((item) => (
                            <p key={item.id}>
                              {item.productSku
                                ? `${item.productSku} - `
                                : ""}
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
                          deliveryCharge: Number(
                            e.target.value || 0
                          ),
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
                        updateRow(order.id, {
                          pageId: e.target.value,
                        })
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
                        updateRow(order.id, {
                          courier: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
                    >
                      <option value="">Select courier</option>
                      {couriers.map((courier) => (
                        <option
                          key={courier.id}
                          value={courier.slug}
                        >
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
                        updateRow(order.id, {
                          readyToShipAt: e.target.value,
                        })
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
                          status:
                            e.target
                              .value as EditableRowState["status"],
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

                {hasDuplicateMemo ? (
                  <div className="mt-4 rounded-2xl bg-red-100 px-4 py-3 text-sm font-medium text-red-700">
                    Duplicate detected: same phone and same product
                    found in another row.
                  </div>
                ) : null}

                <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
                  <div className="space-y-3">
                    <div className="text-sm text-slate-500">
                      <p>
                        Subtotal: {formatMoney(currentSubtotal)}
                      </p>
                      <p>Advance: {formatMoney(order.advance)}</p>
                    </div>

                    <CourierRiskPanel phone={row.phone} />
                  </div>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        const claimed = await ensureClaim(order);
                        if (!claimed) return;

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
                      onClick={() => void handleDirectCancel(order)}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      {pendingCancelId === order.id
                        ? "Cancelling..."
                        : "Direct Cancel"}
                    </Button>

                    <Button
                      type="button"
                      disabled={pendingRowId === order.id}
                      onClick={() => void handleSave(order)}
                    >
                      {pendingRowId === order.id
                        ? "Saving..."
                        : "Submit"}
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

      {lockModal ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-xl">
              📞
            </div>

            <h3 className="text-xl font-bold text-slate-900">
              This order is being called
            </h3>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              <span className="font-semibold text-red-700">
                {lockModal.agentName}
              </span>{" "}
              is calling {lockModal.invoice}. Try another one.
            </p>

            <Button
              type="button"
              className="mt-6 w-full"
              onClick={() => setLockModal(null)}
            >
              Try Another One
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
