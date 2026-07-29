"use client";

import {
  Check,
  ChevronDown,
  Package,
  Search,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type ReelProductSelectorItem = {
  id: string;
  sku: string;
  name: string;
  sellingPrice: number;
  status: boolean;
  parent: {
    id: string;
    sku: string;
    name: string;
    status: boolean;
  };
};

type ProductSelectorProps = {
  products: ReelProductSelectorItem[];
  value: string;
  onChange: (
    productId: string,
    product: ReelProductSelectorItem | null
  ) => void;
  disabled?: boolean;
  placeholder?: string;
};

export default function ProductSelector({
  products,
  value,
  onChange,
  disabled = false,
  placeholder = "Search and select a product",
}: ProductSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedProduct = useMemo(
    () =>
      products.find((product) => product.id === value) ??
      null,
    [products, value]
  );

  const filteredProducts = useMemo(() => {
    const searchValue = query.trim().toLowerCase();

    if (!searchValue) {
      return products;
    }

    return products.filter((product) =>
      [
        product.name,
        product.sku,
        product.parent.name,
        product.parent.sku,
      ]
        .join(" ")
        .toLowerCase()
        .includes(searchValue)
    );
  }, [products, query]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node
        )
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handlePointerDown
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown
      );
    };
  }, []);

  function selectProduct(
    product: ReelProductSelectorItem
  ) {
    onChange(product.id, product);
    setQuery("");
    setOpen(false);
  }

  function clearSelection() {
    onChange("", null);
    setQuery("");
    setOpen(false);
  }

  return (
    <div
      ref={containerRef}
      className="relative"
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2 text-left outline-none transition hover:border-slate-400 focus:border-slate-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60"
      >
        {selectedProduct ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">
              {selectedProduct.name}
            </p>

            <p className="mt-0.5 truncate text-xs text-slate-500">
              {selectedProduct.sku} · ৳
              {formatMoney(
                selectedProduct.sellingPrice
              )}
            </p>
          </div>
        ) : (
          <span className="text-sm text-slate-400">
            {placeholder}
          </span>
        )}

        <div className="flex shrink-0 items-center gap-1">
          {selectedProduct && !disabled ? (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear selected product"
              onClick={(event) => {
                event.stopPropagation();
                clearSelection();
              }}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" ||
                  event.key === " "
                ) {
                  event.preventDefault();
                  event.stopPropagation();
                  clearSelection();
                }
              }}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </span>
          ) : null}

          <ChevronDown
            className={`h-4 w-4 text-slate-400 transition ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {open && !disabled ? (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border bg-white shadow-xl">
          <div className="border-b p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                autoFocus
                value={query}
                onChange={(event) =>
                  setQuery(event.target.value)
                }
                placeholder="Search product name or SKU"
                className="w-full rounded-xl border bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-slate-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {filteredProducts.map((product) => {
              const isSelected = product.id === value;
              const isInactive =
                !product.status ||
                !product.parent.status;

              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() =>
                    selectProduct(product)
                  }
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                    isSelected
                      ? "bg-slate-100"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                    <Package className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {product.name}
                      </p>

                      {isInactive ? (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          Inactive
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-1 truncate text-xs text-slate-500">
                      SKU: {product.sku}
                    </p>

                    <p className="mt-1 text-xs font-semibold text-slate-700">
                      ৳
                      {formatMoney(
                        product.sellingPrice
                      )}
                    </p>
                  </div>

                  {isSelected ? (
                    <Check className="h-5 w-5 shrink-0 text-emerald-600" />
                  ) : null}
                </button>
              );
            })}

            {!filteredProducts.length ? (
              <div className="px-4 py-10 text-center">
                <Package className="mx-auto h-8 w-8 text-slate-300" />

                <p className="mt-3 text-sm font-medium text-slate-700">
                  No products found
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Try searching with another product
                  name or SKU.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}