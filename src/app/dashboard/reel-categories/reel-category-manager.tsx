"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, Film, Loader2, Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createReelCategory, deleteReelCategory, toggleReelCategory, updateReelCategory } from "./actions";

type ActionState = { success: boolean; message: string };
type LookupItem = { id: string; name: string; status: boolean };
type ReelCategoryRow = {
  id: string; name: string; slug: string | null; sourceId: string; pageId: string; status: boolean;
  collectionVideoUrl: string | null; collectionVideoPublicId: string | null; createdAt: string;
  source: { id: string; name: string }; page: { id: string; name: string };
};
type Props = { categories: ReelCategoryRow[]; sources: LookupItem[]; pages: LookupItem[] };
type UploadedVideo = { url: string; publicId: string };
const initialState: ActionState = { success: false, message: "" };
const reelPath = (slug: string | null) => slug ? `/reels/${slug}` : null;
const collectionPath = (slug: string | null) => slug ? `/collections/${slug}` : null;

async function uploadCollectionVideo(file: File): Promise<UploadedVideo> {
  const body = new FormData(); body.append("file", file); body.append("kind", "collection-video");
  const response = await fetch("/api/reel-products/upload", { method: "POST", body });
  const result = await response.json() as { success: boolean; message?: string; media?: { url?: string; publicId?: string } };
  if (!response.ok || !result.success || !result.media?.url || !result.media.publicId) throw new Error(result.message || "Collection video upload failed.");
  return { url: result.media.url, publicId: result.media.publicId };
}

function CollectionVideoField({ value, onChange, disabled }: { value: UploadedVideo | null; onChange: (v: UploadedVideo | null) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null); const [uploading, setUploading] = useState(false); const [error, setError] = useState("");
  async function select(file?: File) {
    if (!file) return; setUploading(true); setError("");
    try { onChange(await uploadCollectionVideo(file)); } catch (e) { setError(e instanceof Error ? e.message : "Upload failed."); }
    finally { setUploading(false); if (inputRef.current) inputRef.current.value = ""; }
  }
  return <div className="rounded-2xl border bg-slate-50 p-4">
    <input ref={inputRef} type="file" accept="video/mp4,video/webm,video/quicktime,video/x-m4v" className="hidden" onChange={(e) => void select(e.target.files?.[0])} />
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div><div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Film className="h-4 w-4" />Collection Hero Video (16:9)</div><p className="mt-1 text-xs text-slate-500">Shown at the top of the Collection page. MP4/WebM/MOV/M4V, max 100 MB.</p></div>
      <div className="flex gap-2">{value ? <Button type="button" variant="outline" disabled={disabled || uploading} onClick={() => onChange(null)}><Trash2 className="mr-2 h-4 w-4" />Remove</Button> : null}<Button type="button" variant="outline" disabled={disabled || uploading} onClick={() => inputRef.current?.click()}>{uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}{value ? "Replace Video" : "Upload Video"}</Button></div>
    </div>
    {value?.url ? <video src={value.url} controls playsInline preload="metadata" className="mt-4 aspect-video w-full max-w-2xl rounded-xl bg-black object-contain" /> : null}
    {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}
  </div>;
}

export default function ReelCategoryManager({ categories, sources, pages }: Props) {
  const router = useRouter(); const [createState, createAction, creating] = useActionState(createReelCategory, initialState);
  const createFormRef = useRef<HTMLFormElement>(null); const [query, setQuery] = useState(""); const [editing, setEditing] = useState<ReelCategoryRow | null>(null);
  const [feedback, setFeedback] = useState<ActionState>(initialState); const [copied, setCopied] = useState<string | null>(null); const [pending, startTransition] = useTransition();
  const [createVideo, setCreateVideo] = useState<UploadedVideo | null>(null); const [editVideo, setEditVideo] = useState<UploadedVideo | null>(null);

  useEffect(() => { if (!createState.success) return; createFormRef.current?.reset(); setCreateVideo(null); router.refresh(); }, [createState.success, router]);
  useEffect(() => { if (!editing) return; setEditVideo(editing.collectionVideoUrl && editing.collectionVideoPublicId ? { url: editing.collectionVideoUrl, publicId: editing.collectionVideoPublicId } : null); }, [editing]);
  useEffect(() => { if (!copied) return; const t = window.setTimeout(() => setCopied(null), 1800); return () => window.clearTimeout(t); }, [copied]);

  const filtered = useMemo(() => { const v = query.trim().toLowerCase(); if (!v) return categories; return categories.filter(c => [c.name,c.source.name,c.page.name,c.slug ?? "",reelPath(c.slug) ?? "",collectionPath(c.slug) ?? ""].join(" ").toLowerCase().includes(v)); }, [categories, query]);
  function runAction(action: () => Promise<ActionState>) { setFeedback(initialState); startTransition(async () => { const result = await action(); setFeedback(result); if (result.success) { setEditing(null); router.refresh(); } }); }
  async function copyLink(id: string, path: string, type: string) { try { await navigator.clipboard.writeText(`${window.location.origin}${path}`); setCopied(`${id}:${type}`); } catch { setFeedback({ success:false, message:"The link could not be copied." }); } }

  return <div className="space-y-6">
    <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6"><h1 className="text-2xl font-bold text-slate-900">Reel Categories</h1><p className="mt-1 text-sm text-slate-500">Every category creates both a Reel page and a Collection page.</p></section>
    <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-center gap-3"><div className="rounded-2xl bg-slate-100 p-3"><Plus className="h-5 w-5" /></div><div><h2 className="text-lg font-semibold">Add Category</h2><p className="text-sm text-slate-500">Reel + Collection links are generated automatically.</p></div></div>
      <form ref={createFormRef} action={createAction} className="space-y-4"><input type="hidden" name="collectionVideoUrl" value={createVideo?.url ?? ""} /><input type="hidden" name="collectionVideoPublicId" value={createVideo?.publicId ?? ""} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Category Name"><input name="name" required placeholder="Enter category name" className="w-full rounded-xl border px-3 py-2.5 text-sm" /></Field>
          <Field label="Source"><select name="sourceId" required defaultValue="" className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm"><option value="" disabled>Select source</option>{sources.map(i => <option key={i.id} value={i.id}>{i.name}{i.status ? "" : " (Inactive)"}</option>)}</select></Field>
          <Field label="Page"><select name="pageId" required defaultValue="" className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm"><option value="" disabled>Select page</option>{pages.map(i => <option key={i.id} value={i.id}>{i.name}{i.status ? "" : " (Inactive)"}</option>)}</select></Field>
          <Field label="Status"><select name="status" defaultValue="true" className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm"><option value="true">Active</option><option value="false">Inactive</option></select></Field>
        </div><CollectionVideoField value={createVideo} onChange={setCreateVideo} disabled={creating} />{createState.message ? <Message success={createState.success} text={createState.message} /> : null}<div className="flex justify-end"><Button type="submit" disabled={creating || !sources.length || !pages.length}>{creating ? "Saving..." : "Save Category"}</Button></div>
      </form>
    </section>

    <section className="overflow-hidden rounded-3xl border bg-white shadow-sm"><div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><h2 className="text-lg font-semibold">Category List</h2><p className="text-sm text-slate-500">{categories.length} total categories</p></div><div className="relative w-full sm:w-80"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search category, source, page or link" className="w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm" /></div></div>
      {feedback.message ? <div className="px-5 pt-5 sm:px-6"><Message success={feedback.success} text={feedback.message} /></div> : null}
      <div className="overflow-x-auto"><table className="min-w-full"><thead className="bg-slate-50"><tr className="border-b">{["Category Name","Source","Page","Public Pages","Hero Video","Status","Created","Actions"].map(l => <th key={l} className="whitespace-nowrap px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{l}</th>)}</tr></thead><tbody>
        {filtered.map(c => { const reel = reelPath(c.slug), collection = collectionPath(c.slug); return <tr key={c.id} className="border-b last:border-b-0"><td className="px-6 py-4 text-sm font-semibold">{c.name}</td><td className="px-6 py-4 text-sm">{c.source.name}</td><td className="px-6 py-4 text-sm">{c.page.name}</td><td className="min-w-80 px-6 py-4">{reel && collection ? <div className="space-y-3">{[["Reel",reel],["Collection",collection]].map(([label,path]) => <div key={label} className="rounded-xl border bg-slate-50 p-2.5"><div className="flex items-center justify-between gap-2"><b className="text-[11px] uppercase text-slate-500">{label}</b><code className="max-w-52 truncate text-xs">{path}</code></div><div className="mt-2 flex gap-2"><a href={path} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border bg-white px-2 py-1 text-xs font-semibold"><ExternalLink className="h-3 w-3" />Open</a><button type="button" onClick={() => void copyLink(c.id,path,label)} className="inline-flex items-center gap-1 rounded-lg border bg-white px-2 py-1 text-xs font-semibold">{copied === `${c.id}:${label}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}Copy</button></div></div>)}</div> : <span className="text-xs text-amber-600">Slug unavailable</span>}</td><td className="px-6 py-4">{c.collectionVideoUrl ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">Uploaded</span> : <span className="text-xs text-slate-400">Not set</span>}</td><td className="px-6 py-4"><button type="button" disabled={pending} onClick={() => runAction(() => toggleReelCategory(c.id,!c.status))} className={`rounded-full px-3 py-1 text-xs font-semibold ${c.status ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{c.status ? "Active" : "Inactive"}</button></td><td className="px-6 py-4 text-sm">{new Date(c.createdAt).toLocaleDateString("en-GB")}</td><td className="px-6 py-4"><div className="flex gap-2"><button type="button" onClick={() => setEditing(c)} className="rounded-lg border p-2"><Pencil className="h-4 w-4" /></button><button type="button" onClick={() => { if (window.confirm(`Delete “${c.name}”?`)) runAction(() => deleteReelCategory(c.id)); }} className="rounded-lg border border-red-200 p-2 text-red-600"><Trash2 className="h-4 w-4" /></button></div></td></tr>; })}
        {!filtered.length ? <tr><td colSpan={8} className="px-6 py-10 text-center text-sm text-slate-500">No reel categories found.</td></tr> : null}
      </tbody></table></div>
    </section>

    {editing ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-6"><div className="mb-5 flex items-start justify-between"><div><h2 className="text-xl font-bold">Edit Reel Category</h2><p className="mt-1 text-sm text-slate-500">Existing public links stay unchanged.</p></div><button type="button" onClick={() => setEditing(null)} className="rounded-xl border p-2"><X className="h-4 w-4" /></button></div>
      <form action={(formData) => runAction(() => updateReelCategory(formData))} className="space-y-4"><input type="hidden" name="id" value={editing.id} /><input type="hidden" name="collectionVideoUrl" value={editVideo?.url ?? ""} /><input type="hidden" name="collectionVideoPublicId" value={editVideo?.publicId ?? ""} />
        <Field label="Category Name"><input name="name" required defaultValue={editing.name} className="w-full rounded-xl border px-3 py-2.5 text-sm" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Source"><select name="sourceId" required defaultValue={editing.sourceId} className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm">{sources.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></Field><Field label="Page"><select name="pageId" required defaultValue={editing.pageId} className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm">{pages.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></Field></div><Field label="Status"><select name="status" defaultValue={String(editing.status)} className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm"><option value="true">Active</option><option value="false">Inactive</option></select></Field><CollectionVideoField value={editVideo} onChange={setEditVideo} disabled={pending} /><div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save Changes"}</Button></div>
      </form></div></div> : null}
  </div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block space-y-2"><span className="text-sm font-medium text-slate-700">{label}</span>{children}</label>; }
function Message({ success, text }: { success: boolean; text: string }) { return <div className={`rounded-2xl px-4 py-3 text-sm ${success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{text}</div>; }
