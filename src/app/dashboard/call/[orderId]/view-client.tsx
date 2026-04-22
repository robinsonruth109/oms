"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveCallingOrder } from "../actions";

type PageOption = {
  id: string;
  name: string;
};

type OrderItem = {
  id: string;
  productId: string | null;
  productSku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type OrderData = {
  id: string;
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
  readyToShipAt: string;
  pageId: string | null;
  items: OrderItem[];
  source: {
    name: string;
    type: string;
  };
  integration: {
    name: string;
    slug: string;
    platform: string;
  } | null;
};

type ProductOption = {
  id: string;
  sku: string;
  name: string;
  price: number;
  parentSku: string;
};

type CourierOption = {
  id: string;
  name: string;
  slug: string;
};

type EditableItem = {
  orderItemId?: string;
  productId: string;
  productLabel: string;
  quantity: number;
};

function formatMoney(value: number) {
  return `৳ ${value.toFixed(2)}`;
}

function createEmptyItem(): EditableItem {
  return {
    orderItemId: undefined,
    productId: "",
    productLabel: "",
    quantity: 1,
  };
}

function normalizeText(value: string) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeLooseText(value: string) {
  return normalizeText(value).replace(/[^a-z0-9\u0980-\u09ff]+/g, "");
}

function getProductSearchText(product: ProductOption) {
  return [
    product.sku,
    product.name,
    product.parentSku,
    normalizeLooseText(product.sku),
    normalizeLooseText(product.name),
    normalizeLooseText(product.parentSku),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function findMatchedProduct(
  item: OrderItem,
  products: ProductOption[]
): ProductOption | null {
  if (item.productId) {
    const byId = products.find((product) => product.id === item.productId);
    if (byId) return byId;
  }

  const itemSku = normalizeText(item.productSku);
  const itemName = normalizeText(item.productName);
  const itemSkuLoose = normalizeLooseText(item.productSku);
  const itemNameLoose = normalizeLooseText(item.productName);

  const exactSku = products.find(
    (product) => normalizeText(product.sku) === itemSku
  );
  if (exactSku) return exactSku;

  const exactName = products.find(
    (product) => normalizeText(product.name) === itemName
  );
  if (exactName) return exactName;

  const exactLooseSku = products.find(
    (product) => normalizeLooseText(product.sku) === itemSkuLoose
  );
  if (exactLooseSku) return exactLooseSku;

  const exactLooseName = products.find(
    (product) => normalizeLooseText(product.name) === itemNameLoose
  );
  if (exactLooseName) return exactLooseName;

  const partial = products.find((product) => {
    const searchText = getProductSearchText(product);

    return (
      (!!itemSku && searchText.includes(itemSku)) ||
      (!!itemName && searchText.includes(itemName)) ||
      (!!itemSkuLoose && searchText.includes(itemSkuLoose)) ||
      (!!itemNameLoose && searchText.includes(itemNameLoose))
    );
  });

  return partial || null;
}

export default function CallingOrderView({
  order,
  products,
  couriers,
  pages,
}: {
  order: OrderData;
  products: ProductOption[];
  couriers: CourierOption[];
  pages: PageOption[];
}) {
  const [customerName, setCustomerName] = useState(order.customerName);
  const [phone, setPhone] = useState(order.phone);
  const [address, setAddress] = useState(order.address);
  const [discount, setDiscount] = useState(order.discount);
  const [deliveryCharge, setDeliveryCharge] = useState(order.deliveryCharge);
  const [courier, setCourier] = useState(order.courier || "");
  const [readyToShipAt, setReadyToShipAt] = useState(order.readyToShipAt);
  const [pageId, setPageId] = useState(order.pageId || "");
  const [status, setStatus] = useState<
    "READY_TO_SHIP" | "NO_ANSWER" | "PHONE_OFF" | "STOCK_OUT" | "CANCELLED"
  >("READY_TO_SHIP");
  const [note, setNote] = useState(order.note || "");
  const [items, setItems] = useState<EditableItem[]>(
    order.items.map((item) => {
      const matched = findMatchedProduct(item, products);

      return {
        orderItemId: item.id,
        productId: matched?.id || item.productId || "",
        productLabel: matched
          ? `${matched.sku} - ${matched.name}`
          : `${item.productSku} - ${item.productName}`,
        quantity: item.quantity,
      };
    })
  );
  const [message, setMessage] = useState<{
    success: boolean;
    text: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  function updateItem(index: number, patch: Partial<EditableItem>) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
  }

  function addItem() {
    setItems((prev) => [...prev, createEmptyItem()]);
  }

  function removeItem(index: number) {
    setItems((prev) => {
      if (prev.length === 1) {
        return prev;
      }
      return prev.filter((_, i) => i !== index);
    });
  }

  function selectProduct(index: number, product: ProductOption) {
    updateItem(index, {
      productId: product.id,
      productLabel: `${product.sku} - ${product.name}`,
    });
  }

  function getFilteredProducts(label: string) {
    const q = normalizeText(label);
    const qLoose = normalizeLooseText(label);

    if (!q && !qLoose) {
      return products.slice(0, 50);
    }

    const startsWithMatches: ProductOption[] = [];
    const containsMatches: ProductOption[] = [];

    for (const product of products) {
      const sku = normalizeText(product.sku);
      const name = normalizeText(product.name);
      const parentSku = normalizeText(product.parentSku);

      const skuLoose = normalizeLooseText(product.sku);
      const nameLoose = normalizeLooseText(product.name);
      const parentSkuLoose = normalizeLooseText(product.parentSku);

      const searchText = `${sku} ${name} ${parentSku}`;
      const searchLooseText = `${skuLoose} ${nameLoose} ${parentSkuLoose}`;

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
          (searchText.includes(q) ||
            sku.includes(q) ||
            name.includes(q) ||
            parentSku.includes(q))) ||
        (!!qLoose &&
          (searchLooseText.includes(qLoose) ||
            skuLoose.includes(qLoose) ||
            nameLoose.includes(qLoose) ||
            parentSkuLoose.includes(qLoose)));

      if (isStartsWith) {
        startsWithMatches.push(product);
      } else if (isContains) {
        containsMatches.push(product);
      }
    }

    return [...startsWithMatches, ...containsMatches].slice(0, 50);
  }

  const pricing = useMemo(() => {
    const lines = items.map((item, index) => {
      const product =
        products.find((p) => p.id === item.productId) ||
        findMatchedProduct(order.items[index], products);

      const unitPrice = product?.price || 0;
      const lineTotal = unitPrice * item.quantity;

      return {
        unitPrice,
        lineTotal,
      };
    });

    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const finalTotal = Math.max(
      subtotal + deliveryCharge - discount - order.advance,
      0
    );

    return {
      lines,
      subtotal,
      finalTotal,
    };
  }, [items, products, deliveryCharge, discount, order.advance, order.items]);

  function handleSave() {
    setMessage(null);

    startTransition(async () => {
      const result = await saveCallingOrder({
        orderId: order.id,
        customerName,
        phone,
        address,
        discount,
        deliveryCharge,
        courier,
        readyToShipAt,
        status,
        note,
        pageId,
        items: items.map((item) => ({
          orderItemId: item.orderItemId,
          productId: item.productId,
          quantity: item.quantity,
        })),
      });

      setMessage({
        success: result.success,
        text: result.message,
      });
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <Link href="/dashboard/call">
                <Button variant="outline" type="button">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
              </Link>
              <h1 className="text-2xl font-bold text-slate-900">
                Order View / Edit
              </h1>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              Full multi-product editing for calling panel orders.
            </p>
          </div>

          <div className="text-sm text-slate-500">
            <p>Invoice: {order.invoiceId || "N/A"}</p>
            <p>Source: {order.source.name}</p>
            <p>Platform: {order.integration?.platform || "N/A"}</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Customer Information
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Customer Name
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Ready To Ship Date
            </label>
            <input
              type="date"
              value={readyToShipAt}
              onChange={(e) => setReadyToShipAt(e.target.value)}
              className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
            />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <label className="text-sm font-medium text-slate-700">Address</label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="min-h-[100px] w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
          />
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Product Items
            </h2>
            <p className="text-sm text-slate-500">
              Add, remove or replace products and quantities.
            </p>
          </div>

          <Button type="button" variant="outline" onClick={addItem}>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </div>

        <div className="space-y-4">
          {items.map((item, index) => {
            const filteredProducts = getFilteredProducts(item.productLabel);
            const line = pricing.lines[index];

            return (
              <div
                key={item.orderItemId || `new-${index}`}
                className="rounded-2xl border bg-slate-50 p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">
                    Item {index + 1}
                  </p>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => removeItem(index)}
                    disabled={items.length === 1}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                  <div className="xl:col-span-7">
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Product
                    </label>
                    <input
                      type="text"
                      value={item.productLabel}
                      onChange={(e) =>
                        updateItem(index, {
                          productLabel: e.target.value,
                          productId: "",
                        })
                      }
                      placeholder="Search by SKU, name, parent SKU"
                      className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
                    />

                    {!item.productId && (
                      <div className="mt-2 max-h-56 overflow-y-auto rounded-2xl border bg-white">
                        {filteredProducts.length > 0 ? (
                          filteredProducts.map((product) => (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => selectProduct(index, product)}
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
                                {product.price.toFixed(2)}
                              </span>
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-sm text-slate-500">
                            No product found.
                          </div>
                        )}
                      </div>
                    )}

                    {item.productId ? (
                      <p className="mt-2 text-xs text-emerald-600">
                        Selected: {item.productLabel}
                      </p>
                    ) : null}
                  </div>

                  <div className="xl:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(index, {
                          quantity: Number(e.target.value || 1),
                        })
                      }
                      className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
                    />
                  </div>

                  <div className="xl:col-span-1">
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Price
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={formatMoney(line?.unitPrice || 0)}
                      className="w-full rounded-xl border bg-slate-100 px-3 py-2.5 text-sm outline-none"
                    />
                  </div>

                  <div className="xl:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Row Total
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={formatMoney(line?.lineTotal || 0)}
                      className="w-full rounded-xl border bg-slate-100 px-3 py-2.5 text-sm outline-none"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Delivery & Status
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Discount
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value || 0))}
              className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Delivery Charge
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={deliveryCharge}
              onChange={(e) => setDeliveryCharge(Number(e.target.value || 0))}
              className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Page</label>
            <select
              value={pageId}
              onChange={(e) => setPageId(e.target.value)}
              className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
            >
              <option value="">Select page</option>
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Courier
            </label>
            <select
              value={courier}
              onChange={(e) => setCourier(e.target.value)}
              className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
            >
              <option value="">Select courier</option>
              {couriers.map((courierItem) => (
                <option key={courierItem.id} value={courierItem.slug}>
                  {courierItem.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Status</label>
            <select
              value={status}
              onChange={(e) =>
                setStatus(
                  e.target.value as
                    | "READY_TO_SHIP"
                    | "NO_ANSWER"
                    | "PHONE_OFF"
                    | "STOCK_OUT"
                    | "CANCELLED"
                )
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
        </div>

        <div className="mt-4 space-y-2">
          <label className="text-sm font-medium text-slate-700">Note</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-[90px] w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
          />
        </div>

        <div className="mt-4 rounded-2xl bg-slate-50 p-4">
          <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-4">
            <div>
              <p className="text-slate-400">Subtotal</p>
              <p className="font-semibold text-slate-900">
                {formatMoney(pricing.subtotal)}
              </p>
            </div>

            <div>
              <p className="text-slate-400">Discount</p>
              <p className="font-semibold text-slate-900">
                {formatMoney(discount)}
              </p>
            </div>

            <div>
              <p className="text-slate-400">Advance</p>
              <p className="font-semibold text-slate-900">
                {formatMoney(order.advance)}
              </p>
            </div>

            <div>
              <p className="text-slate-400">Final Total</p>
              <p className="font-semibold text-slate-900">
                {formatMoney(pricing.finalTotal)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {message ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            message.success
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-3">
        <Link href="/dashboard/call">
          <Button type="button" variant="outline">
            Back to Calling Panel
          </Button>
        </Link>

        <Button type="button" disabled={pending} onClick={handleSave}>
          {pending ? "Saving..." : "Save Order"}
        </Button>
      </div>
    </div>
  );
}