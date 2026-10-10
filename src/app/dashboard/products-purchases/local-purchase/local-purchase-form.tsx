"use client";

import {
  Check,
  ChevronDown,
  PackagePlus,
  Search,
  X,
} from "lucide-react";
import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
  createLocalProductPurchase,
  type LocalProductPurchaseActionState,
} from "./actions";

export type LocalPurchaseProductOption = {
  id: string;
  sku: string;
  name: string;
  parentSku: string;
  parentName: string;
  stockMode: "VARIANT_STOCK" | "PARENT_STOCK";
  unitsPerSale: number;
  currentStock: number;
  currentBuyingPrice: number;
  stockVerified: boolean;
};

type Props = {
  products: LocalPurchaseProductOption[];
  today: string;
};

const initialState: LocalProductPurchaseActionState = {
  success: false,
  message: "",
  warning: false,
};

function money(value: number) {
  return "Tk " + Number(value || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function numberInput(value: string) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export default function LocalProductPurchaseForm({
  products,
  today,
}: Props) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    createLocalProductPurchase,
    initialState
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPurchaseCost, setUnitPurchaseCost] = useState("");
  const [transportCost, setTransportCost] = useState("0");
  const [otherCost, setOtherCost] = useState("0");
  const [note, setNote] = useState("");

  const selected = useMemo(
    () => products.find((product) => product.id === productId) || null,
    [productId, products]
  );

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return products;

    return products.filter((product) =>
      [
        product.sku,
        product.name,
        product.parentSku,
        product.parentName,
      ]
        .join(" ")
        .toLowerCase()
        .includes(value)
    );
  }, [products, query]);

  const qty = Math.max(0, Math.floor(numberInput(quantity)));
  const unitCost = numberInput(unitPurchaseCost);
  const vara = numberInput(transportCost);
  const other = numberInput(otherCost);
  const unitsPerSale =
    selected?.stockMode === "PARENT_STOCK"
      ? Math.max(1, selected.unitsPerSale)
      : 1;
  const physicalUnits = qty * unitsPerSale;
  const productCost = qty * unitCost;
  const grandTotal = productCost + vara + other;
  const landedUnitCost =
    physicalUnits > 0 ? grandTotal / physicalUnits : 0;
  const stockAfter = selected
    ? selected.currentStock + physicalUnits
    : 0;

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () =>
      document.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    if (!state.success) return;

    setProductId("");
    setQuery("");
    setQuantity("1");
    setUnitPurchaseCost("");
    setTransportCost("0");
    setOtherCost("0");
    setNote("");
    setOpen(false);
    router.refresh();
  }, [router, state.success, state.message]);

  return (
    <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <PackagePlus className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Add Local Purchase
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Select the purchased SKU, enter quantity and local costs. Stock and
            the physical owner&apos;s buying price update together in one transaction.
          </p>
        </div>
      </div>

      {state.message ? (
        <div
          className={
            "mt-5 rounded-2xl border px-4 py-3 text-sm " +
            (state.success
              ? state.warning
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-800")
          }
        >
          {state.message}
        </div>
      ) : null}

      <form action={action} className="mt-6 space-y-5">
        <input type="hidden" name="productId" value={productId} />

        <div className="grid gap-4 lg:grid-cols-2">
          <div ref={containerRef} className="relative">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Product SKU
            </span>
            <button
              type="button"
              onClick={() => setOpen((current) => !current)}
              className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2 text-left outline-none transition hover:border-slate-400"
            >
              {selected ? (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {selected.sku} · {selected.name}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    Parent {selected.parentSku} ·{" "}
                    {selected.stockMode === "PARENT_STOCK"
                      ? "Shared Parent Stock"
                      : "Variation Stock"}
                  </p>
                </div>
              ) : (
                <span className="text-sm text-slate-400">
                  Search SKU / product / parent code
                </span>
              )}

              <div className="flex shrink-0 items-center gap-1">
                {selected ? (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="Clear product"
                    onClick={(event) => {
                      event.stopPropagation();
                      setProductId("");
                      setQuery("");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        setProductId("");
                        setQuery("");
                      }
                    }}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="h-4 w-4" />
                  </span>
                ) : null}
                <ChevronDown
                  className={
                    "h-4 w-4 text-slate-400 transition " +
                    (open ? "rotate-180" : "")
                  }
                />
              </div>
            </button>

            {open ? (
              <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border bg-white shadow-2xl">
                <div className="border-b p-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      autoFocus
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Type SKU, product name or parent code"
                      className="w-full rounded-xl border bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-slate-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto p-2">
                  {filtered.map((product) => {
                    const active = product.id === productId;
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => {
                          setProductId(product.id);
                          setQuery("");
                          setOpen(false);
                        }}
                        className={
                          "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition " +
                          (active ? "bg-slate-100" : "hover:bg-slate-50")
                        }
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-900">
                              {product.sku}
                            </p>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                              {product.stockMode === "PARENT_STOCK"
                                ? "PARENT STOCK"
                                : "VARIATION STOCK"}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-sm text-slate-700">
                            {product.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Parent {product.parentSku} · Stock{" "}
                            {product.currentStock} · Buying{" "}
                            {money(product.currentBuyingPrice)}
                          </p>
                        </div>
                        {active ? (
                          <Check className="h-5 w-5 shrink-0 text-emerald-600" />
                        ) : null}
                      </button>
                    );
                  })}

                  {!filtered.length ? (
                    <div className="px-4 py-10 text-center text-sm text-slate-500">
                      No physical SKU matched your search.
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">Purchase Date</span>
            <input
              type="date"
              name="purchaseDate"
              defaultValue={today}
              required
              className="min-h-12 w-full rounded-xl border px-3 outline-none"
            />
          </label>
        </div>

        {selected ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InfoCard
              label="Current Stock"
              value={String(selected.currentStock)}
              note={
                selected.stockVerified
                  ? "Verified physical balance"
                  : "Unverified / excluded from valuation"
              }
            />
            <InfoCard
              label="Current Buying Price"
              value={money(selected.currentBuyingPrice)}
              note={
                selected.stockMode === "PARENT_STOCK"
                  ? "Per physical parent unit"
                  : "Per SKU unit"
              }
            />
            <InfoCard
              label="Stock Mode"
              value={
                selected.stockMode === "PARENT_STOCK"
                  ? "Parent Stock"
                  : "Variation Stock"
              }
              note={
                selected.stockMode === "PARENT_STOCK"
                  ? "1 purchased SKU = " +
                    selected.unitsPerSale +
                    " parent unit(s)"
                  : "Stock belongs to this SKU"
              }
            />
            <InfoCard
              label="Parent"
              value={selected.parentSku}
              note={selected.parentName}
            />
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">
              Purchase Quantity
            </span>
            <input
              type="number"
              min={1}
              step={1}
              name="quantity"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              required
              className="min-h-12 w-full rounded-xl border px-3 outline-none"
            />
            <span className="block text-xs text-slate-400">
              Quantity of the selected SKU/pack purchased.
            </span>
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">
              Unit Purchase Cost
            </span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              name="unitPurchaseCost"
              value={unitPurchaseCost}
              onChange={(event) => setUnitPurchaseCost(event.target.value)}
              placeholder="0.00"
              required
              className="min-h-12 w-full rounded-xl border px-3 outline-none"
            />
            <span className="block text-xs text-slate-400">
              Supplier price per selected SKU/pack.
            </span>
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">
              Vara / Transport
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              name="transportCost"
              value={transportCost}
              onChange={(event) => setTransportCost(event.target.value)}
              className="min-h-12 w-full rounded-xl border px-3 outline-none"
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">Other Cost</span>
            <input
              type="number"
              min="0"
              step="0.01"
              name="otherCost"
              value={otherCost}
              onChange={(event) => setOtherCost(event.target.value)}
              className="min-h-12 w-full rounded-xl border px-3 outline-none"
            />
          </label>
        </div>

        <label className="block space-y-2 text-sm">
          <span className="font-medium text-slate-700">Note</span>
          <input
            type="text"
            name="note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Supplier / market / invoice / optional note"
            className="min-h-12 w-full rounded-xl border px-3 outline-none"
          />
        </label>

        <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Preview
              label="Product Cost"
              value={money(productCost)}
            />
            <Preview
              label="Vara + Other"
              value={money(vara + other)}
            />
            <Preview
              label="Grand Total"
              value={money(grandTotal)}
              strong
            />
            <Preview
              label="New Buying Price"
              value={money(landedUnitCost)}
              strong
            />
          </div>

          <div className="mt-4 rounded-2xl bg-white/80 p-4 text-sm text-slate-700">
            {selected ? (
              <>
                <p>
                  Stock will add{" "}
                  <strong>{physicalUnits.toLocaleString("en-BD")}</strong>{" "}
                  physical unit(s):{" "}
                  <strong>
                    {selected.currentStock.toLocaleString("en-BD")} →{" "}
                    {stockAfter.toLocaleString("en-BD")}
                  </strong>.
                </p>
                <p className="mt-1">
                  Buying price will update from{" "}
                  <strong>{money(selected.currentBuyingPrice)}</strong> to{" "}
                  <strong>{money(landedUnitCost)}</strong>.
                  {selected.stockMode === "PARENT_STOCK"
                    ? " The new price is stored per physical parent unit."
                    : ""}
                </p>
              </>
            ) : (
              <p>Select a SKU to see stock and buying-price impact.</p>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={
            pending ||
            !selected ||
            qty < 1 ||
            unitCost <= 0
          }
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PackagePlus className="h-4 w-4" />
          {pending ? "Saving Purchase..." : "Submit Purchase + Add Stock"}
        </button>
      </form>
    </section>
  );
}

function InfoCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </div>
  );
}

function Preview({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
        {label}
      </p>
      <p
        className={
          "mt-1 text-emerald-950 " +
          (strong ? "text-xl font-bold" : "text-lg font-semibold")
        }
      >
        {value}
      </p>
    </div>
  );
}
