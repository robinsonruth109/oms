"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  ExternalLink,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createReelCategory,
  deleteReelCategory,
  toggleReelCategory,
  updateReelCategory,
} from "./actions";

type ActionState = {
  success: boolean;
  message: string;
};

type LookupItem = {
  id: string;
  name: string;
  status: boolean;
};

type ReelCategoryRow = {
  id: string;
  name: string;
  slug: string | null;
  sourceId: string;
  pageId: string;
  status: boolean;
  createdAt: string;
  source: {
    id: string;
    name: string;
  };
  page: {
    id: string;
    name: string;
  };
};

type Props = {
  categories: ReelCategoryRow[];
  sources: LookupItem[];
  pages: LookupItem[];
};

const initialState: ActionState = {
  success: false,
  message: "",
};

function getPublicPath(slug: string | null): string | null {
  if (!slug) {
    return null;
  }

  return `/reels/${slug}`;
}

export default function ReelCategoryManager({
  categories,
  sources,
  pages,
}: Props) {
  const router = useRouter();

  const [createState, createAction, creating] = useActionState(
    createReelCategory,
    initialState
  );

  const createFormRef = useRef<HTMLFormElement>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<ReelCategoryRow | null>(null);
  const [feedback, setFeedback] = useState<ActionState>(initialState);
  const [copiedCategoryId, setCopiedCategoryId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
  if (!createState.success) {
    return;
  }

  createFormRef.current?.reset();
  router.refresh();
}, [createState.success, router]);

  useEffect(() => {
    if (!copiedCategoryId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopiedCategoryId(null);
    }, 2000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copiedCategoryId]);

  const filteredCategories = useMemo(() => {
    const value = query.trim().toLowerCase();

    if (!value) {
      return categories;
    }

    return categories.filter((category) => {
      const publicPath = getPublicPath(category.slug) ?? "";

      return [
        category.name,
        category.source.name,
        category.page.name,
        category.slug ?? "",
        publicPath,
      ]
        .join(" ")
        .toLowerCase()
        .includes(value);
    });
  }, [categories, query]);

  function runAction(
    action: () => Promise<ActionState>
  ) {
    setFeedback(initialState);

    startTransition(async () => {
      const result = await action();

      setFeedback(result);

      if (result.success) {
        setEditing(null);
        router.refresh();
      }
    });
  }

  function submitEdit(formData: FormData) {
    runAction(() => updateReelCategory(formData));
  }

  function removeCategory(category: ReelCategoryRow) {
    const confirmed = window.confirm(
      `Delete “${category.name}”?`
    );

    if (!confirmed) {
      return;
    }

    runAction(() =>
      deleteReelCategory(category.id)
    );
  }

  async function copyPublicLink(
    category: ReelCategoryRow
  ) {
    const publicPath = getPublicPath(category.slug);

    if (!publicPath) {
      setFeedback({
        success: false,
        message:
          "This category does not have a public slug yet.",
      });

      return;
    }

    const publicUrl = `${window.location.origin}${publicPath}`;

    try {
      await navigator.clipboard.writeText(publicUrl);

      setCopiedCategoryId(category.id);
      setFeedback({
        success: true,
        message: `Public link copied: ${publicUrl}`,
      });
    } catch {
      const textArea = document.createElement("textarea");

      textArea.value = publicUrl;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";

      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      const copied = document.execCommand("copy");

      document.body.removeChild(textArea);

      if (copied) {
        setCopiedCategoryId(category.id);
        setFeedback({
          success: true,
          message: `Public link copied: ${publicUrl}`,
        });

        return;
      }

      setFeedback({
        success: false,
        message:
          "The public link could not be copied. Please copy it manually.",
      });
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Reel Categories
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Create public reel pages and connect each category with an OMS
          source and page.
        </p>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
            <Plus className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Add Category
            </h2>

            <p className="text-sm text-slate-500">
              A unique public reel page will be generated automatically.
            </p>
          </div>
        </div>

        <form
            ref={createFormRef}
            action={createAction}
            className="space-y-4"
          >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Category Name">
              <input
                name="name"
                required
                placeholder="Enter category name"
                className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              />
            </Field>

            <Field label="Source">
              <select
                name="sourceId"
                required
                defaultValue=""
                className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              >
                <option value="" disabled>
                  Select source
                </option>

                {sources.map((source) => (
                  <option
                    key={source.id}
                    value={source.id}
                  >
                    {source.name}
                    {source.status
                      ? ""
                      : " (Inactive)"}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Page">
              <select
                name="pageId"
                required
                defaultValue=""
                className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              >
                <option value="" disabled>
                  Select page
                </option>

                {pages.map((page) => (
                  <option
                    key={page.id}
                    value={page.id}
                  >
                    {page.name}
                    {page.status
                      ? ""
                      : " (Inactive)"}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Status">
              <select
                name="status"
                defaultValue="true"
                className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              >
                <option value="true">
                  Active
                </option>

                <option value="false">
                  Inactive
                </option>
              </select>
            </Field>
          </div>

          {createState.message ? (
            <Message
              success={createState.success}
              text={createState.message}
            />
          ) : null}

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={
                creating ||
                !sources.length ||
                !pages.length
              }
            >
              {creating
                ? "Saving..."
                : "Save Category"}
            </Button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Category List
            </h2>

            <p className="text-sm text-slate-500">
              {categories.length} total categories
            </p>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder="Search category, source, page or link"
              className="w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm outline-none focus:border-slate-500"
            />
          </div>
        </div>

        {feedback.message ? (
          <div className="px-5 pt-5 sm:px-6">
            <Message
              success={feedback.success}
              text={feedback.message}
            />
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b">
                {[
                  "Category Name",
                  "Source",
                  "Page",
                  "Public Page",
                  "Status",
                  "Created",
                  "Actions",
                ].map((label) => (
                  <th
                    key={label}
                    className="whitespace-nowrap px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredCategories.map(
                (category) => {
                  const publicPath =
                    getPublicPath(category.slug);

                  const copied =
                    copiedCategoryId ===
                    category.id;

                  return (
                    <tr
                      key={category.id}
                      className="border-b last:border-b-0"
                    >
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                        {category.name}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-700">
                        {category.source.name}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-700">
                        {category.page.name}
                      </td>

                      <td className="min-w-72 px-6 py-4">
                        {publicPath ? (
                          <div className="space-y-2">
                            <code className="block max-w-72 truncate rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs text-slate-700">
                              {publicPath}
                            </code>

                            <div className="flex flex-wrap items-center gap-2">
                              <a
                                href={publicPath}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Open Page
                              </a>

                              <button
                                type="button"
                                onClick={() =>
                                  void copyPublicLink(
                                    category
                                  )
                                }
                                className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                              >
                                {copied ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}

                                {copied
                                  ? "Copied"
                                  : "Copy Link"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-amber-600">
                            Slug unavailable
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            runAction(() =>
                              toggleReelCategory(
                                category.id,
                                !category.status
                              )
                            )
                          }
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            category.status
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {category.status
                            ? "Active"
                            : "Inactive"}
                        </button>
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                        {new Date(
                          category.createdAt
                        ).toLocaleDateString(
                          "en-GB"
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setEditing(category)
                            }
                            className="rounded-lg border p-2 text-slate-600 hover:bg-slate-50"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              removeCategory(
                                category
                              )
                            }
                            className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }
              )}

              {!filteredCategories.length ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-10 text-center text-sm text-slate-500"
                  >
                    No reel categories found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Edit Reel Category
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Updating the category name will not change its existing
                  public link.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setEditing(null)
                }
                className="rounded-xl border p-2 text-slate-500"
                aria-label="Close edit modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {getPublicPath(editing.slug) ? (
              <div className="mb-5 rounded-2xl border bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Public page
                </p>

                <code className="mt-2 block break-all text-sm text-slate-800">
                  {getPublicPath(editing.slug)}
                </code>
              </div>
            ) : null}

            <form
              action={submitEdit}
              className="space-y-4"
            >
              <input
                type="hidden"
                name="id"
                value={editing.id}
              />

              <Field label="Category Name">
                <input
                  name="name"
                  required
                  defaultValue={editing.name}
                  className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Source">
                  <select
                    name="sourceId"
                    required
                    defaultValue={
                      editing.sourceId
                    }
                    className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                  >
                    {sources.map((source) => (
                      <option
                        key={source.id}
                        value={source.id}
                      >
                        {source.name}
                        {source.status
                          ? ""
                          : " (Inactive)"}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Page">
                  <select
                    name="pageId"
                    required
                    defaultValue={
                      editing.pageId
                    }
                    className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                  >
                    {pages.map((page) => (
                      <option
                        key={page.id}
                        value={page.id}
                      >
                        {page.name}
                        {page.status
                          ? ""
                          : " (Inactive)"}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Status">
                <select
                  name="status"
                  defaultValue={String(
                    editing.status
                  )}
                  className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                >
                  <option value="true">
                    Active
                  </option>

                  <option value="false">
                    Inactive
                  </option>
                </select>
              </Field>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setEditing(null)
                  }
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={pending}
                >
                  {pending
                    ? "Saving..."
                    : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-700">
        {label}
      </span>

      {children}
    </label>
  );
}

function Message({
  success,
  text,
}: {
  success: boolean;
  text: string;
}) {
  return (
    <div
      className={`rounded-2xl px-4 py-3 text-sm ${
        success
          ? "bg-emerald-50 text-emerald-700"
          : "bg-red-50 text-red-700"
      }`}
    >
      {text}
    </div>
  );
}