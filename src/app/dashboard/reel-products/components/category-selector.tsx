"use client";

import {
  Check,
  ChevronDown,
  Layers3,
  Search,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type ReelCategorySelectorItem = {
  id: string;
  name: string;
  status: boolean;
  source: {
    id: string;
    name: string;
    status: boolean;
  };
  page: {
    id: string;
    name: string;
    status: boolean;
  };
};

type CategorySelectorProps = {
  categories: ReelCategorySelectorItem[];
  value: string;
  onChange: (
    categoryId: string,
    category: ReelCategorySelectorItem | null
  ) => void;
  disabled?: boolean;
  placeholder?: string;
};

export default function CategorySelector({
  categories,
  value,
  onChange,
  disabled = false,
  placeholder = "Search and select a reel category",
}: CategorySelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedCategory = useMemo(
    () =>
      categories.find(
        (category) => category.id === value
      ) ?? null,
    [categories, value]
  );

  const filteredCategories = useMemo(() => {
    const searchValue = query.trim().toLowerCase();

    if (!searchValue) {
      return categories;
    }

    return categories.filter((category) =>
      [
        category.name,
        category.source.name,
        category.page.name,
      ]
        .join(" ")
        .toLowerCase()
        .includes(searchValue)
    );
  }, [categories, query]);

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

  function selectCategory(
    category: ReelCategorySelectorItem
  ) {
    onChange(category.id, category);
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
        {selectedCategory ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">
              {selectedCategory.name}
            </p>

            <p className="mt-0.5 truncate text-xs text-slate-500">
              {selectedCategory.source.name} ·{" "}
              {selectedCategory.page.name}
            </p>
          </div>
        ) : (
          <span className="text-sm text-slate-400">
            {placeholder}
          </span>
        )}

        <div className="flex shrink-0 items-center gap-1">
          {selectedCategory && !disabled ? (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear selected category"
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
                placeholder="Search category, source or page"
                className="w-full rounded-xl border bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-slate-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {filteredCategories.map((category) => {
              const isSelected =
                category.id === value;

              const isInactive =
                !category.status ||
                !category.source.status ||
                !category.page.status;

              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() =>
                    selectCategory(category)
                  }
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                    isSelected
                      ? "bg-slate-100"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                    <Layers3 className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {category.name}
                      </p>

                      {isInactive ? (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          Inactive
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-1 truncate text-xs text-slate-500">
                      Source: {category.source.name}
                    </p>

                    <p className="mt-1 truncate text-xs text-slate-500">
                      Page: {category.page.name}
                    </p>
                  </div>

                  {isSelected ? (
                    <Check className="h-5 w-5 shrink-0 text-emerald-600" />
                  ) : null}
                </button>
              );
            })}

            {!filteredCategories.length ? (
              <div className="px-4 py-10 text-center">
                <Layers3 className="mx-auto h-8 w-8 text-slate-300" />

                <p className="mt-3 text-sm font-medium text-slate-700">
                  No categories found
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Try another category, source or page
                  name.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}