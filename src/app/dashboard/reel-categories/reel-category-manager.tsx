"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createReelCategory,
  deleteReelCategory,
  toggleReelCategory,
  updateReelCategory,
} from "./actions";

type LookupItem = {
  id: string;
  name: string;
  status: boolean;
};

type ReelCategoryRow = {
  id: string;
  name: string;
  sourceId: string;
  pageId: string;
  status: boolean;
  createdAt: string;
  source: { id: string; name: string };
  page: { id: string; name: string };
};

type Props = {
  categories: ReelCategoryRow[];
  sources: LookupItem[];
  pages: LookupItem[];
};

const initialState = { success: false, message: "" };

export default function ReelCategoryManager({ categories, sources, pages }: Props) {
  const router = useRouter();
  const [createState, createAction, creating] = useActionState(
    createReelCategory,
    initialState
  );
  const [resetKey, setResetKey] = useState(0);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<ReelCategoryRow | null>(null);
  const [feedback, setFeedback] = useState(initialState);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (createState.success) {
      setResetKey((value) => value + 1);
      router.refresh();
    }
  }, [createState.success, router]);

  const filteredCategories = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return categories;

    return categories.filter((category) =>
      [category.name, category.source.name, category.page.name]
        .join(" ")
        .toLowerCase()
        .includes(value)
    );
  }, [categories, query]);

  function runAction(action: () => Promise<{ success: boolean; message: string }>) {
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
    if (!window.confirm(`Delete “${category.name}”?`)) return;
    runAction(() => deleteReelCategory(category.id));
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900">Reel Categories</h1>
        <p className="mt-1 text-sm text-slate-500">
          Create categories and connect each category with an OMS source and page.
        </p>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
            <Plus className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Add Category</h2>
            <p className="text-sm text-slate-500">Select the source and page used for orders from this category.</p>
          </div>
        </div>

        <form key={resetKey} action={createAction} className="space-y-4">
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
                <option value="" disabled>Select source</option>
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}{source.status ? "" : " (Inactive)"}
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
                <option value="" disabled>Select page</option>
                {pages.map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.name}{page.status ? "" : " (Inactive)"}
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
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </Field>
          </div>

          {createState.message ? (
            <Message success={createState.success} text={createState.message} />
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={creating || !sources.length || !pages.length}>
              {creating ? "Saving..." : "Save Category"}
            </Button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Category List</h2>
            <p className="text-sm text-slate-500">{categories.length} total categories</p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search category, source or page"
              className="w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm outline-none focus:border-slate-500"
            />
          </div>
        </div>

        {feedback.message ? (
          <div className="px-5 pt-5 sm:px-6">
            <Message success={feedback.success} text={feedback.message} />
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="border-b">
                {['Category Name', 'Source', 'Page', 'Status', 'Created', 'Actions'].map((label) => (
                  <th key={label} className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredCategories.map((category) => (
                <tr key={category.id} className="border-b last:border-b-0">
                  <td className="px-6 py-4 text-sm font-semibold text-slate-900">{category.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">{category.source.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">{category.page.name}</td>
                  <td className="px-6 py-4">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => runAction(() => toggleReelCategory(category.id, !category.status))}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        category.status
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {category.status ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                    {new Date(category.createdAt).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(category)}
                        className="rounded-lg border p-2 text-slate-600 hover:bg-slate-50"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => removeCategory(category)}
                        className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!filteredCategories.length ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">
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
                <h2 className="text-xl font-bold text-slate-900">Edit Reel Category</h2>
                <p className="mt-1 text-sm text-slate-500">Update category, source, page or status.</p>
              </div>
              <button type="button" onClick={() => setEditing(null)} className="rounded-xl border p-2 text-slate-500">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={submitEdit} className="space-y-4">
              <input type="hidden" name="id" value={editing.id} />
              <Field label="Category Name">
                <input name="name" required defaultValue={editing.name} className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none" />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Source">
                  <select name="sourceId" required defaultValue={editing.sourceId} className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none">
                    {sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
                  </select>
                </Field>
                <Field label="Page">
                  <select name="pageId" required defaultValue={editing.pageId} className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none">
                    {pages.map((page) => <option key={page.id} value={page.id}>{page.name}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Status">
                <select name="status" defaultValue={String(editing.status)} className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none">
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </Field>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button type="submit" disabled={pending}>{pending ? 'Saving...' : 'Save Changes'}</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function Message({ success, text }: { success: boolean; text: string }) {
  return (
    <div className={`rounded-2xl px-4 py-3 text-sm ${success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
      {text}
    </div>
  );
}
