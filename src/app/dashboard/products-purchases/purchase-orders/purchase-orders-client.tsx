"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { createPurchaseOrder } from "./actions";

type Product = {
  id: string;
  sku: string;
  name: string;
  parentSku: string;
};

type PurchaseOrder = {
  id: string;
  invoiceNo: string;
  productSku: string;
  productName: string;
  parentSku: string;
  quantity: number;
  quantityType: string;
  subtotalUsd: number;
  totalPaidBdt?: number;
  status: string;
  createdAt: string;
};

type GroupedRow = {
  parentSku: string;
  totalOrders: number;
  avgPrice: number;
  totalQty: number;
  totalPaidBdt: number;
  status: string;
  orders: PurchaseOrder[];
};

function formatMoney(value: number) {
  return `৳ ${value.toFixed(2)}`;
}

function formatUsd(value: number) {
  return `$ ${value.toFixed(2)}`;
}

function getGroupStatus(orders: PurchaseOrder[]) {
  if (orders.every((order) => order.status === "PAID")) return "PAID";
  if (orders.some((order) => order.status === "PARTIAL_PAID")) {
    return "PARTIAL_PAID";
  }
  if (orders.some((order) => order.status === "PAID")) return "PARTIAL_PAID";
  return "PENDING";
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "PAID"
      ? "bg-emerald-100 text-emerald-700"
      : status === "PARTIAL_PAID"
        ? "bg-amber-100 text-amber-700"
        : "bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${className}`}>
      {status}
    </span>
  );
}

export default function PurchaseOrdersClient({
  products,
  orders,
}: {
  products: Product[];
  orders: PurchaseOrder[];
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});

  const [productId, setProductId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [quantity, setQuantity] = useState(1);
  const [quantityType, setQuantityType] = useState("Pcs");
  const [productImage, setProductImage] = useState("");
  const [unitPriceUsd, setUnitPriceUsd] = useState(0);
  const [platformChargeUsd, setPlatformChargeUsd] = useState(0);
  const [shippingUsd, setShippingUsd] = useState(0);
  const [note, setNote] = useState("");

  const selectedProduct = products.find((product) => product.id === productId);
  const subtotalUsd = quantity * unitPriceUsd + platformChargeUsd + shippingUsd;

  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase().trim();
    if (!q) return [];

    return products.filter((product) =>
      `${product.sku} ${product.name} ${product.parentSku}`
        .toLowerCase()
        .includes(q)
    );
  }, [productSearch, products]);

  const groupedRows: GroupedRow[] = useMemo(() => {
    const map = new Map<string, GroupedRow>();

    for (const order of orders) {
      const paidBdt = Number(order.totalPaidBdt || 0);
      const existing = map.get(order.parentSku);

      if (existing) {
        existing.totalOrders += 1;
        existing.totalQty += order.quantity;
        existing.totalPaidBdt += paidBdt;
        existing.orders.push(order);
        existing.avgPrice =
          existing.totalQty > 0 ? existing.totalPaidBdt / existing.totalQty : 0;
        existing.status = getGroupStatus(existing.orders);
      } else {
        map.set(order.parentSku, {
          parentSku: order.parentSku,
          totalOrders: 1,
          totalQty: order.quantity,
          totalPaidBdt: paidBdt,
          avgPrice: order.quantity > 0 ? paidBdt / order.quantity : 0,
          status: order.status,
          orders: [order],
        });
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => b.totalPaidBdt - a.totalPaidBdt
    );
  }, [orders]);

  function toggleRow(key: string) {
    setOpenRows((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSubmit() {
    setMessage("");

    if (!productId) {
      setMessage("Please select product.");
      return;
    }

    startTransition(async () => {
      const result = await createPurchaseOrder({
        productId,
        orderDate,
        quantity,
        quantityType,
        productImage,
        unitPriceUsd,
        platformChargeUsd,
        shippingUsd,
        note,
      });

      setMessage(result.message);

      if (result.success) {
        window.location.reload();
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">
          Create Purchase Order
        </h2>

        <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-4">
          <div className="xl:col-span-2">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Product
            </label>

            <input
              type="text"
              value={productSearch}
              onChange={(e) => {
                setProductSearch(e.target.value);
                setProductId("");
              }}
              placeholder="Search product by SKU, name or parent code"
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            />

            {!productId && productSearch && (
              <div className="mt-2 max-h-72 overflow-y-auto rounded-2xl border bg-white">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => {
                      setProductId(product.id);
                      setProductSearch(`${product.parentSku} - ${product.name}`);
                    }}
                    className="flex w-full flex-col items-start border-b px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <span className="font-semibold text-slate-900">
                      {product.sku}
                    </span>
                    <span className="text-sm text-slate-500">
                      {product.name}
                    </span>
                    <span className="text-xs text-slate-400">
                      Parent: {product.parentSku}
                    </span>
                  </button>
                ))}

                {!filteredProducts.length && (
                  <div className="px-4 py-3 text-sm text-slate-500">
                    No products found.
                  </div>
                )}
              </div>
            )}
          </div>

          <Input label="Order Date" type="date" value={orderDate} onChange={setOrderDate} />
          <Input label="Product Image URL" value={productImage} onChange={setProductImage} />
          <NumberInput label="Order Quantity" value={quantity} onChange={setQuantity} />

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Quantity Type
            </label>
            <select
              value={quantityType}
              onChange={(e) => setQuantityType(e.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            >
              <option>Pcs</option>
              <option>Set</option>
              <option>Pair</option>
              <option>Box</option>
              <option>Dozen</option>
              <option>Foot</option>
              <option>Roll</option>
            </select>
          </div>

          <NumberInput label="Unit Price USD" value={unitPriceUsd} onChange={setUnitPriceUsd} />
          <NumberInput label="Platform Charge USD" value={platformChargeUsd} onChange={setPlatformChargeUsd} />
          <NumberInput label="Shipping Charge China USD" value={shippingUsd} onChange={setShippingUsd} />

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Subtotal USD
            </label>
            <div className="rounded-xl border bg-slate-100 px-3 py-2.5 text-sm font-semibold">
              {formatUsd(subtotalUsd)}
            </div>
          </div>

          <div className="xl:col-span-2">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Note
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-[120px] w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            />
          </div>
        </div>

        {selectedProduct && (
          <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Selected:{" "}
            <span className="font-semibold">
              {selectedProduct.parentSku} - {selectedProduct.name}
            </span>
          </div>
        )}

        {message && (
          <div className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm">
            {message}
          </div>
        )}

        <div className="mt-6">
          <button
            type="button"
            disabled={pending}
            onClick={handleSubmit}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? "Submitting..." : "Submit Purchase Order"}
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Purchase Order List
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b">
                <Th>Product Code</Th>
                <Th center>Purchase Orders</Th>
                <Th center>Average Product Price</Th>
                <Th center>Total QTY</Th>
                <Th center>Total Paid BDT</Th>
                <Th center>Status</Th>
              </tr>
            </thead>

            <tbody>
              {groupedRows.map((row) => {
                const isOpen = Boolean(openRows[row.parentSku]);

                return (
                  <Fragment key={row.parentSku}>
                    <tr className="border-b">
                      <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                        <button
                          type="button"
                          onClick={() => toggleRow(row.parentSku)}
                          className="hover:underline"
                        >
                          {isOpen ? "▼" : "▶"} {row.parentSku}
                        </button>
                      </td>

                      <Td center>{row.totalOrders}</Td>
                      <Td center>{formatMoney(row.avgPrice)}</Td>
                      <Td center>{row.totalQty}</Td>
                      <Td center>{formatMoney(row.totalPaidBdt)}</Td>
                      <td className="px-5 py-4 text-center">
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>

                    {isOpen &&
                      row.orders.map((order) => {
                        const paidBdt = Number(order.totalPaidBdt || 0);
                        const averagePrice =
                          order.quantity > 0 ? paidBdt / order.quantity : 0;

                        return (
                          <tr key={order.id} className="border-b bg-slate-50">
                            <td className="px-10 py-4 text-sm">
                              <p className="font-semibold">{order.invoiceNo}</p>
                              <p className="text-slate-500">{order.productName}</p>
                            </td>

                            <Td center>
                              {order.quantity} {order.quantityType}
                            </Td>

                            <Td center>{formatMoney(averagePrice)}</Td>
                            <Td center>{formatMoney(paidBdt)}</Td>

                            <td className="px-5 py-4 text-center">
                              <StatusBadge status={order.status} />
                            </td>

                            <td className="px-5 py-4 text-center">
                              <Link
                                href={`/dashboard/products-purchases/purchase-orders/${order.id}`}
                                target="_blank"
                                className="inline-flex rounded-xl border px-4 py-2 text-sm hover:bg-white"
                              >
                                View Invoice
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                  </Fragment>
                );
              })}

              {!groupedRows.length && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    No purchase orders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
      />
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(Number(e.target.value || 0))}
        className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
      />
    </div>
  );
}

function Th({
  children,
  center,
}: {
  children: React.ReactNode;
  center?: boolean;
}) {
  return (
    <th
      className={`px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
        center ? "text-center" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  center,
}: {
  children: React.ReactNode;
  center?: boolean;
}) {
  return (
    <td
      className={`px-5 py-4 text-sm text-slate-700 ${
        center ? "text-center" : "text-left"
      }`}
    >
      {children}
    </td>
  );
}