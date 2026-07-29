"use client";

import {
  Loader2,
  Save,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
} from "react";
import { Button } from "@/components/ui/button";
import CategorySelector, {
  type ReelCategorySelectorItem,
} from "./category-selector";
import GalleryUploader, {
  type ReelGalleryItem,
} from "./gallery-uploader";
import ProductSelector, {
  type ReelProductSelectorItem,
} from "./product-selector";
import ReelMediaUploader, {
  type ReelMainMediaState,
} from "./reel-media-uploader";
import RichTextEditor from "./rich-text-editor";

export type ReelProductFormState = {
  id: string | null;
  productId: string;
  categoryId: string;
  caption: string;
  descriptionHtml: string;
  status: boolean;
  media: ReelMainMediaState;
  gallery: ReelGalleryItem[];
};

type ReelProductModalProps = {
  open: boolean;
  mode: "CREATE" | "EDIT";

  form: ReelProductFormState;
  products: ReelProductSelectorItem[];
  categories: ReelCategorySelectorItem[];

  saving?: boolean;
  disabled?: boolean;

  videoUploading?: boolean;
  thumbnailUploading?: boolean;
  galleryImageUploading?: boolean;
  galleryVideoUploading?: boolean;

  onFormChange: (
    form: ReelProductFormState
  ) => void;

  onClose: () => void;
  onSubmit: () => Promise<void> | void;

  onSelectVideo: () => void;
  onSelectThumbnail: () => void;

  onRemoveVideo?: () => Promise<void> | void;
  onRemoveThumbnail?: () => Promise<void> | void;

  onUploadGalleryImages: (
    files: File[]
  ) => Promise<void>;

  onUploadGalleryVideos: (
    files: File[]
  ) => Promise<void>;

  onDeleteGalleryItem: (
    item: ReelGalleryItem
  ) => Promise<void>;
};

export default function ReelProductModal({
  open,
  mode,
  form,
  products,
  categories,
  saving = false,
  disabled = false,
  videoUploading = false,
  thumbnailUploading = false,
  galleryImageUploading = false,
  galleryVideoUploading = false,
  onFormChange,
  onClose,
  onSubmit,
  onSelectVideo,
  onSelectThumbnail,
  onRemoveVideo,
  onRemoveThumbnail,
  onUploadGalleryImages,
  onUploadGalleryVideos,
  onDeleteGalleryItem,
}: ReelProductModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  const busy =
    saving ||
    videoUploading ||
    thumbnailUploading ||
    galleryImageUploading ||
    galleryVideoUploading;

  const selectedProduct = useMemo(
    () =>
      products.find(
        (product) =>
          product.id === form.productId
      ) ?? null,
    [form.productId, products]
  );

  const selectedCategory = useMemo(
    () =>
      categories.find(
        (category) =>
          category.id === form.categoryId
      ) ?? null,
    [categories, form.categoryId]
  );

  const validation = useMemo(
    () => validateForm(form),
    [form]
  );

  const formDisabled =
    disabled || saving;

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    function handleKeyDown(
      event: KeyboardEvent
    ) {
      if (event.key !== "Escape") {
        return;
      }

      if (busy) {
        return;
      }

      onClose();
    }

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [busy, onClose, open]);

  if (!open) {
    return null;
  }

  function updateForm<
    Key extends keyof ReelProductFormState,
  >(
    key: Key,
    value: ReelProductFormState[Key]
  ) {
    onFormChange({
      ...form,
      [key]: value,
    });
  }


  function handleBackdropClick(
    event: React.MouseEvent<HTMLDivElement>
  ) {
    if (
      event.target === event.currentTarget &&
      !busy
    ) {
      onClose();
    }
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!validation.valid || busy) {
      return;
    }

    await onSubmit();
  }

  return (
    <div
      role="presentation"
      onMouseDown={handleBackdropClick}
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/60 p-0 backdrop-blur-sm sm:p-4 lg:p-6"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reel-product-modal-title"
        className="min-h-screen w-full bg-slate-50 shadow-2xl sm:min-h-0 sm:max-w-7xl sm:rounded-3xl"
      >
        <form onSubmit={handleSubmit}>
          <header className="sticky top-0 z-40 flex items-center justify-between gap-4 border-b bg-white/95 px-4 py-4 backdrop-blur sm:rounded-t-3xl sm:px-6">
            <div className="min-w-0">
              <h2
                id="reel-product-modal-title"
                className="truncate text-lg font-semibold text-slate-950"
              >
                {mode === "CREATE"
                  ? "Create Reel Product"
                  : "Edit Reel Product"}
              </h2>

              <p className="mt-1 hidden text-sm text-slate-500 sm:block">
                Configure the linked product, reel
                video, description and gallery.
              </p>
            </div>

            <button
              type="button"
              aria-label="Close reel product modal"
              disabled={busy}
              onClick={onClose}
              className="rounded-xl border bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="space-y-6 p-4 sm:p-6">
            <section className="rounded-2xl border bg-white p-4 sm:p-5">
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-slate-900">
                  Basic Information
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  Select the product and category that
                  this reel will belong to.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <FormField
                  label="Product"
                  required
                  error={
                    validation.showErrors
                      ? validation.errors.productId
                      : undefined
                  }
                >
                  <ProductSelector
                    products={products}
                    value={form.productId}
                    disabled={formDisabled}
                    onChange={(productId) =>
                      updateForm(
                        "productId",
                        productId
                      )
                    }
                  />
                </FormField>

                <FormField
                  label="Reel Category"
                  required
                  error={
                    validation.showErrors
                      ? validation.errors.categoryId
                      : undefined
                  }
                >
                  <CategorySelector
                    categories={categories}
                    value={form.categoryId}
                    disabled={formDisabled}
                    onChange={(categoryId) =>
                      updateForm(
                        "categoryId",
                        categoryId
                      )
                    }
                  />
                </FormField>
              </div>

              {(selectedProduct ||
                selectedCategory) && (
                <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {selectedProduct ? (
                    <SelectionSummary
                      label="Selected product"
                      title={selectedProduct.name}
                      description={`${selectedProduct.sku} · ৳${formatMoney(
                        selectedProduct.sellingPrice
                      )}`}
                      inactive={
                        !selectedProduct.status ||
                        !selectedProduct.parent.status
                      }
                    />
                  ) : null}

                  {selectedCategory ? (
                    <SelectionSummary
                      label="Selected category"
                      title={selectedCategory.name}
                      description={`${selectedCategory.source.name} · ${selectedCategory.page.name}`}
                      inactive={
                        !selectedCategory.status ||
                        !selectedCategory.source
                          .status ||
                        !selectedCategory.page.status
                      }
                    />
                  ) : null}
                </div>
              )}

              <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_auto]">
                <FormField
                  label="Reel Caption"
                  description="A short caption shown over or near the reel."
                >
                  <textarea
                    value={form.caption}
                    disabled={formDisabled}
                    maxLength={500}
                    rows={4}
                    onChange={(event) =>
                      updateForm(
                        "caption",
                        event.target.value
                      )
                    }
                    placeholder="Write a short and engaging reel caption..."
                    className="w-full resize-y rounded-xl border bg-white px-3 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70"
                  />

                  <p className="mt-1 text-right text-xs text-slate-400">
                    {form.caption.length}/500
                  </p>
                </FormField>

                <div className="lg:w-64">
                  <FormField
                    label="Status"
                    description="Inactive reels remain saved but are hidden from the feed."
                  >
                    <StatusToggle
                      checked={form.status}
                      disabled={formDisabled}
                      onChange={(checked) =>
                        updateForm(
                          "status",
                          checked
                        )
                      }
                    />
                  </FormField>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border bg-white p-4 sm:p-5">
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-slate-900">
                  Product Description
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  Add detailed product information that
                  customers can read from the reel.
                </p>
              </div>

              <RichTextEditor
                value={form.descriptionHtml}
                disabled={formDisabled}
                onChange={(descriptionHtml) =>
                  updateForm(
                    "descriptionHtml",
                    descriptionHtml
                  )
                }
              />
            </section>

            <ReelMediaUploader
              media={form.media}
              disabled={formDisabled}
              videoUploading={videoUploading}
              thumbnailUploading={
                thumbnailUploading
              }
              onSelectVideo={onSelectVideo}
              onSelectThumbnail={
                onSelectThumbnail
              }
              onRemoveVideo={
                onRemoveVideo
                  ? () => {
                      void onRemoveVideo();
                    }
                  : undefined
              }
              onRemoveThumbnail={
                onRemoveThumbnail
                  ? () => {
                      void onRemoveThumbnail();
                    }
                  : undefined
              }
            />

            {validation.showErrors &&
            validation.errors.video ? (
              <p className="-mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {validation.errors.video}
              </p>
            ) : null}

            <GalleryUploader
              items={form.gallery}
              disabled={formDisabled}
              imageUploading={
                galleryImageUploading
              }
              videoUploading={
                galleryVideoUploading
              }
              onChange={(gallery) =>
                updateForm("gallery", gallery)
              }
              onUploadImages={
                onUploadGalleryImages
              }
              onUploadVideos={
                onUploadGalleryVideos
              }
              onDeleteItem={
                onDeleteGalleryItem
              }
            />
          </div>

          <footer className="sticky bottom-0 z-40 flex flex-col-reverse gap-3 border-t bg-white/95 px-4 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:rounded-b-3xl sm:px-6">
            <div className="text-xs text-slate-500">
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Please wait while media or data is
                  being processed.
                </span>
              ) : (
                <span>
                  Fields marked with * are required.
                  Display order is assigned
                  automatically.
                </span>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={onClose}
                className="flex-1 sm:flex-none"
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={
                  busy || !validation.valid
                }
                className="flex-1 sm:flex-none"
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}

                {saving
                  ? "Saving..."
                  : mode === "CREATE"
                    ? "Create Reel"
                    : "Save Changes"}
              </Button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}

function FormField({
  label,
  description,
  required = false,
  error,
  children,
}: {
  label: string;
  description?: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-800">
        {label}

        {required ? (
          <span className="ml-1 text-red-500">
            *
          </span>
        ) : null}
      </label>

      {description ? (
        <p className="mb-2 text-xs leading-5 text-slate-500">
          {description}
        </p>
      ) : null}

      {children}

      {error ? (
        <p className="mt-2 text-xs font-medium text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SelectionSummary({
  label,
  title,
  description,
  inactive,
}: {
  label: string;
  title: string;
  description: string;
  inactive: boolean;
}) {
  return (
    <div className="rounded-xl border bg-slate-50 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {label}
          </p>

          <p className="mt-1 truncate text-sm font-semibold text-slate-800">
            {title}
          </p>

          <p className="mt-1 truncate text-xs text-slate-500">
            {description}
          </p>
        </div>

        {inactive ? (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700">
            Inactive
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">
            Active
          </span>
        )}
      </div>
    </div>
  );
}

function StatusToggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex min-h-12 w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
        checked
          ? "border-emerald-200 bg-emerald-50"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <div>
        <p
          className={`text-sm font-semibold ${
            checked
              ? "text-emerald-800"
              : "text-slate-700"
          }`}
        >
          {checked ? "Active" : "Inactive"}
        </p>

        <p className="mt-0.5 text-xs text-slate-500">
          {checked
            ? "Visible in the seller reels feed"
            : "Hidden from the seller reels feed"}
        </p>
      </div>

      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked
            ? "bg-emerald-600"
            : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </span>
    </button>
  );
}

function validateForm(
  form: ReelProductFormState
) {
  const errors: {
    productId?: string;
    categoryId?: string;
    video?: string;
  } = {};

  if (!form.productId.trim()) {
    errors.productId =
      "Please select a product.";
  }

  if (!form.categoryId.trim()) {
    errors.categoryId =
      "Please select a reel category.";
  }

  if (
    !form.media.videoUrl.trim() ||
    !form.media.videoPublicId.trim()
  ) {
    errors.video =
      "Please upload the main reel video.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    showErrors: true,
  };
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}