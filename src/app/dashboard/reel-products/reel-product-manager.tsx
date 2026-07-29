"use client";

import {
  type ChangeEvent,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { Film, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createReelProduct,
  deleteReelProduct,
  updateReelProduct,
} from "./actions";
import ReelProductModal, {
  type ReelProductFormState,
} from "./components/reel-product-modal";
import ReelProductTable, {
  type ReelProductTableItem,
} from "./components/reel-product-table";
import type { ReelGalleryItem } from "./components/gallery-uploader";
import type { ReelProductSelectorItem } from "./components/product-selector";
import type { ReelCategorySelectorItem } from "./components/category-selector";

type ActionResult = {
  success: boolean;
  message: string;
};

type GalleryRow = {
  id: string;
  reelProductId: string;
  mediaType: "IMAGE" | "VIDEO";
  url: string;
  publicId: string;
  resourceType: string;
  format: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  bytes: number | null;
  altText: string | null;
  displayOrder: number;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};

type ReelProductRow = {
  id: string;
  productId: string;
  categoryId: string;
  title: string;
  caption: string | null;
  descriptionHtml: string | null;
  displayOrder: number;
  videoUrl: string;
  videoPublicId: string;
  thumbnailUrl: string | null;
  thumbnailPublicId: string | null;
  videoDuration: number | null;
  videoWidth: number | null;
  videoHeight: number | null;
  videoFormat: string | null;
  videoBytes: number | null;
  status: boolean;
  createdAt: string;
  updatedAt: string;
  gallery: GalleryRow[];
  product: ReelProductSelectorItem;
  category: ReelCategorySelectorItem;
};

type Props = {
  products: ReelProductSelectorItem[];
  categories: ReelCategorySelectorItem[];
  reelProducts: ReelProductRow[];
};

type UploadKind =
  | "video"
  | "thumbnail"
  | "gallery-image"
  | "gallery-video";

type UploadedMedia = {
  kind: UploadKind;
  publicId: string;
  originalUrl: string;
  url: string;
  thumbnailUrl?: string | null;
  version?: number;
  format: string | null;
  resourceType: string;
  bytes: number | null;
  width: number | null;
  height: number | null;
  duration?: number | null;
  createdAt?: string | null;
};

type UploadResponse = {
  success: boolean;
  message: string;
  media?: UploadedMedia;
};

const emptyForm: ReelProductFormState = {
  id: null,
  productId: "",
  categoryId: "",
  caption: "",
  descriptionHtml: "",
  status: true,
  media: {
    videoUrl: "",
    videoPublicId: "",
    thumbnailUrl: "",
    thumbnailPublicId: "",
    videoDuration: null,
    videoWidth: null,
    videoHeight: null,
    videoFormat: null,
    videoBytes: null,
  },
  gallery: [],
};

export default function ReelProductManager({
  products,
  categories,
  reelProducts,
}: Props) {
  const router = useRouter();

  const [form, setForm] =
    useState<ReelProductFormState>(emptyForm);
  const [mode, setMode] =
    useState<"CREATE" | "EDIT">("CREATE");
  const [modalOpen, setModalOpen] = useState(false);
  const [feedback, setFeedback] =
    useState<ActionResult>({
      success: false,
      message: "",
    });

  const [saving, startSaving] = useTransition();
  const [deleting, startDeleting] = useTransition();

  const [videoUploading, setVideoUploading] =
    useState(false);
  const [
    thumbnailUploading,
    setThumbnailUploading,
  ] = useState(false);
  const [
    galleryImageUploading,
    setGalleryImageUploading,
  ] = useState(false);
  const [
    galleryVideoUploading,
    setGalleryVideoUploading,
  ] = useState(false);

  const videoInputRef =
    useRef<HTMLInputElement>(null);
  const thumbnailInputRef =
    useRef<HTMLInputElement>(null);

  const originalAssetIdsRef = useRef<Set<string>>(
    new Set()
  );

  const tableItems: ReelProductTableItem[] =
    reelProducts.map((item) => ({
      id: item.id,
      caption: item.caption,
      descriptionHtml: item.descriptionHtml,
      status: item.status,
      displayOrder: item.displayOrder,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      videoUrl: item.videoUrl,
      videoPublicId: item.videoPublicId,
      thumbnailUrl: item.thumbnailUrl,
      thumbnailPublicId: item.thumbnailPublicId,
      product: item.product,
      category: item.category,
      gallery: item.gallery.map((galleryItem) => ({
        id: galleryItem.id,
        mediaType: galleryItem.mediaType,
        url: galleryItem.url,
        publicId: galleryItem.publicId,
        thumbnailUrl: null,
        displayOrder: galleryItem.displayOrder,
      })),
    }));

  function openCreateModal() {
    originalAssetIdsRef.current = new Set();
    setMode("CREATE");
    setForm(emptyForm);
    setFeedback({
      success: false,
      message: "",
    });
    setModalOpen(true);
  }

  function openEditModal(item: ReelProductTableItem) {
    const source = reelProducts.find(
      (entry) => entry.id === item.id
    );

    if (!source) {
      return;
    }

    const originalIds = new Set<string>([
      source.videoPublicId,
      ...(source.thumbnailPublicId
        ? [source.thumbnailPublicId]
        : []),
      ...source.gallery.map(
        (galleryItem) => galleryItem.publicId
      ),
    ]);

    originalAssetIdsRef.current = originalIds;

    setMode("EDIT");
    setForm({
      id: source.id,
      productId: source.productId,
      categoryId: source.categoryId,
      caption: source.caption ?? "",
      descriptionHtml:
        source.descriptionHtml ?? "",
      status: source.status,
      media: {
        videoUrl: source.videoUrl,
        videoPublicId: source.videoPublicId,
        thumbnailUrl: source.thumbnailUrl ?? "",
        thumbnailPublicId:
          source.thumbnailPublicId ?? "",
        videoDuration: source.videoDuration,
        videoWidth: source.videoWidth,
        videoHeight: source.videoHeight,
        videoFormat: source.videoFormat,
        videoBytes: source.videoBytes,
      },
      gallery: source.gallery.map((galleryItem) => ({
        id: galleryItem.id,
        clientId: galleryItem.id,
        mediaType: galleryItem.mediaType,
        url: galleryItem.url,
        publicId: galleryItem.publicId,
        format: galleryItem.format,
        width: galleryItem.width,
        height: galleryItem.height,
        duration: galleryItem.duration,
        bytes: galleryItem.bytes,
        displayOrder: galleryItem.displayOrder,
        persisted: true,
      })),
    });

    setFeedback({
      success: false,
      message: "",
    });
    setModalOpen(true);
  }

  async function uploadMedia(
    file: File,
    kind: UploadKind
  ): Promise<UploadedMedia> {
    const uploadForm = new FormData();

    uploadForm.set("file", file);
    uploadForm.set("kind", kind);

    const response = await fetch(
      "/api/reel-products/upload",
      {
        method: "POST",
        body: uploadForm,
      }
    );

    const result =
      (await response.json()) as UploadResponse;

    if (
      !response.ok ||
      !result.success ||
      !result.media
    ) {
      throw new Error(
        result.message ||
          "The media upload failed."
      );
    }

    return result.media;
  }

  async function deleteUploadedMedia(
    publicId: string,
    resourceType: "image" | "video"
  ) {
    if (!publicId.trim()) {
      return;
    }

    const response = await fetch(
      "/api/reel-products/delete-media",
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          publicId,
          resourceType,
        }),
      }
    );

    const result =
      (await response.json()) as ActionResult;

    if (!response.ok || !result.success) {
      throw new Error(
        result.message ||
          "The media could not be deleted."
      );
    }
  }

  async function handleMainMediaInput(
    event: ChangeEvent<HTMLInputElement>,
    kind: "video" | "thumbnail"
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const setUploading =
      kind === "video"
        ? setVideoUploading
        : setThumbnailUploading;

    setUploading(true);
    setFeedback({
      success: false,
      message: "",
    });

    try {
      const media = await uploadMedia(file, kind);

      setForm((current) => {
        if (kind === "video") {
          return {
            ...current,
            media: {
              ...current.media,
              videoUrl: media.url,
              videoPublicId: media.publicId,
              thumbnailUrl:
                current.media.thumbnailPublicId
                  ? current.media.thumbnailUrl
                  : media.thumbnailUrl ?? "",
              videoDuration:
                media.duration ?? null,
              videoWidth: media.width,
              videoHeight: media.height,
              videoFormat: media.format,
              videoBytes: media.bytes,
            },
          };
        }

        return {
          ...current,
          media: {
            ...current.media,
            thumbnailUrl: media.url,
            thumbnailPublicId: media.publicId,
          },
        };
      });

      setFeedback({
        success: true,
        message:
          kind === "video"
            ? "Video uploaded successfully."
            : "Thumbnail uploaded successfully.",
      });
    } catch (error) {
      setFeedback({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "The upload failed.",
      });
    } finally {
      setUploading(false);
    }
  }

  async function removeMainVideo() {
    const publicId = form.media.videoPublicId;

    if (!publicId) {
      return;
    }

    try {
      if (
        !originalAssetIdsRef.current.has(publicId)
      ) {
        await deleteUploadedMedia(
          publicId,
          "video"
        );
      }

      setForm((current) => ({
        ...current,
        media: {
          ...current.media,
          videoUrl: "",
          videoPublicId: "",
          videoDuration: null,
          videoWidth: null,
          videoHeight: null,
          videoFormat: null,
          videoBytes: null,
          thumbnailUrl:
            current.media.thumbnailPublicId
              ? current.media.thumbnailUrl
              : "",
        },
      }));
    } catch (error) {
      setFeedback({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "The video could not be removed.",
      });
    }
  }

  async function removeThumbnail() {
    const publicId =
      form.media.thumbnailPublicId;

    if (!publicId) {
      return;
    }

    try {
      if (
        !originalAssetIdsRef.current.has(publicId)
      ) {
        await deleteUploadedMedia(
          publicId,
          "image"
        );
      }

      setForm((current) => ({
        ...current,
        media: {
          ...current.media,
          thumbnailPublicId: "",
          thumbnailUrl: current.media.videoUrl
            ? current.media.thumbnailUrl
            : "",
        },
      }));
    } catch (error) {
      setFeedback({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "The thumbnail could not be removed.",
      });
    }
  }

  async function uploadGalleryFiles(
    files: File[],
    kind: "gallery-image" | "gallery-video"
  ) {
    if (!files.length) {
      return;
    }

    const setUploading =
      kind === "gallery-image"
        ? setGalleryImageUploading
        : setGalleryVideoUploading;

    setUploading(true);
    setFeedback({
      success: false,
      message: "",
    });

    const uploadedItems: ReelGalleryItem[] = [];

    try {
      for (const file of files) {
        const media = await uploadMedia(file, kind);

        uploadedItems.push({
          clientId: crypto.randomUUID(),
          mediaType:
            kind === "gallery-image"
              ? "IMAGE"
              : "VIDEO",
          url: media.url,
          publicId: media.publicId,
          thumbnailUrl: media.thumbnailUrl ?? null,
          format: media.format,
          width: media.width,
          height: media.height,
          duration: media.duration ?? null,
          bytes: media.bytes,
          displayOrder: 0,
          persisted: false,
        });
      }

      setForm((current) => ({
        ...current,
        gallery: [
          ...current.gallery,
          ...uploadedItems,
        ].map((item, index) => ({
          ...item,
          displayOrder: index,
        })),
      }));

      setFeedback({
        success: true,
        message:
          kind === "gallery-image"
            ? "Gallery images uploaded successfully."
            : "Gallery videos uploaded successfully.",
      });
    } catch (error) {
      await Promise.allSettled(
        uploadedItems.map((item) =>
          deleteUploadedMedia(
            item.publicId,
            item.mediaType === "VIDEO"
              ? "video"
              : "image"
          )
        )
      );

      setFeedback({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Gallery upload failed.",
      });
    } finally {
      setUploading(false);
    }
  }

  async function deleteGalleryItem(
    item: ReelGalleryItem
  ) {
    try {
      if (
        !originalAssetIdsRef.current.has(
          item.publicId
        )
      ) {
        await deleteUploadedMedia(
          item.publicId,
          item.mediaType === "VIDEO"
            ? "video"
            : "image"
        );
      }

      setForm((current) => ({
        ...current,
        gallery: current.gallery
          .filter(
            (galleryItem) =>
              galleryItem.publicId !==
              item.publicId
          )
          .map((galleryItem, index) => ({
            ...galleryItem,
            displayOrder: index,
          })),
      }));
    } catch (error) {
      setFeedback({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "The gallery item could not be removed.",
      });
    }
  }

  function buildFormData() {
    const formData = new FormData();

    if (form.id) {
      formData.set("id", form.id);
    }

    formData.set("productId", form.productId);
    formData.set("categoryId", form.categoryId);
    formData.set("caption", form.caption);
    formData.set(
      "descriptionHtml",
      form.descriptionHtml
    );
    formData.set("status", String(form.status));

    formData.set(
      "videoUrl",
      form.media.videoUrl
    );
    formData.set(
      "videoPublicId",
      form.media.videoPublicId
    );
    formData.set(
      "thumbnailUrl",
      form.media.thumbnailUrl
    );
    formData.set(
      "thumbnailPublicId",
      form.media.thumbnailPublicId
    );
    formData.set(
      "videoDuration",
      form.media.videoDuration === null
        ? ""
        : String(form.media.videoDuration)
    );
    formData.set(
      "videoWidth",
      form.media.videoWidth === null
        ? ""
        : String(form.media.videoWidth)
    );
    formData.set(
      "videoHeight",
      form.media.videoHeight === null
        ? ""
        : String(form.media.videoHeight)
    );
    formData.set(
      "videoFormat",
      form.media.videoFormat ?? ""
    );
    formData.set(
      "videoBytes",
      form.media.videoBytes === null
        ? ""
        : String(form.media.videoBytes)
    );

    formData.set(
      "galleryJson",
      JSON.stringify(
        form.gallery.map((item, index) => ({
          ...item,
          displayOrder: index,
        }))
      )
    );

    return formData;
  }

  function submitForm() {
    setFeedback({
      success: false,
      message: "",
    });

    startSaving(async () => {
      const formData = buildFormData();

      const result =
        mode === "CREATE"
          ? await createReelProduct(formData)
          : await updateReelProduct(formData);

      setFeedback(result);

      if (result.success) {
        originalAssetIdsRef.current =
          new Set();
        setModalOpen(false);
        setForm(emptyForm);
        router.refresh();
      }
    });
  }

  async function closeModal() {
    if (saving) {
      return;
    }

    const temporaryAssets: Array<{
      publicId: string;
      resourceType: "image" | "video";
    }> = [];

    if (
      form.media.videoPublicId &&
      !originalAssetIdsRef.current.has(
        form.media.videoPublicId
      )
    ) {
      temporaryAssets.push({
        publicId: form.media.videoPublicId,
        resourceType: "video",
      });
    }

    if (
      form.media.thumbnailPublicId &&
      !originalAssetIdsRef.current.has(
        form.media.thumbnailPublicId
      )
    ) {
      temporaryAssets.push({
        publicId:
          form.media.thumbnailPublicId,
        resourceType: "image",
      });
    }

    for (const item of form.gallery) {
      if (
        !originalAssetIdsRef.current.has(
          item.publicId
        )
      ) {
        temporaryAssets.push({
          publicId: item.publicId,
          resourceType:
            item.mediaType === "VIDEO"
              ? "video"
              : "image",
        });
      }
    }

    await Promise.allSettled(
      temporaryAssets.map((asset) =>
        deleteUploadedMedia(
          asset.publicId,
          asset.resourceType
        )
      )
    );

    originalAssetIdsRef.current = new Set();
    setModalOpen(false);
    setForm(emptyForm);
  }

  function removeReelProduct(
    item: ReelProductTableItem
  ) {
    const confirmed = window.confirm(
      `Delete reel product “${item.product.name}”? Its video, thumbnail and gallery assets will also be deleted.`
    );

    if (!confirmed) {
      return;
    }

    startDeleting(async () => {
      const result = await deleteReelProduct(
        item.id
      );

      setFeedback(result);

      if (result.success) {
        router.refresh();
      }
    });
  }

  const busy =
    saving ||
    deleting ||
    videoUploading ||
    thumbnailUploading ||
    galleryImageUploading ||
    galleryVideoUploading;

  return (
    <div className="space-y-6">
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
        className="hidden"
        onChange={(event) =>
          void handleMainMediaInput(
            event,
            "video"
          )
        }
      />

      <input
        ref={thumbnailInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        onChange={(event) =>
          void handleMainMediaInput(
            event,
            "thumbnail"
          )
        }
      />

      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                <Film className="h-5 w-5" />
              </div>

              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  Reel Products
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Manage reel videos, product
                  descriptions and gallery media.
                </p>
              </div>
            </div>
          </div>

          <Button
            type="button"
            disabled={busy}
            onClick={openCreateModal}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Reel Product
          </Button>
        </div>
      </section>

      {feedback.message ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            feedback.success
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <ReelProductTable
        items={tableItems}
        loading={false}
        disabled={busy}
        onEdit={openEditModal}
        onDelete={removeReelProduct}
      />

      <ReelProductModal
        open={modalOpen}
        mode={mode}
        form={form}
        products={products}
        categories={categories}
        saving={saving}
        disabled={deleting}
        videoUploading={videoUploading}
        thumbnailUploading={
          thumbnailUploading
        }
        galleryImageUploading={
          galleryImageUploading
        }
        galleryVideoUploading={
          galleryVideoUploading
        }
        onFormChange={setForm}
        onClose={() => void closeModal()}
        onSubmit={submitForm}
        onSelectVideo={() =>
          videoInputRef.current?.click()
        }
        onSelectThumbnail={() =>
          thumbnailInputRef.current?.click()
        }
        onRemoveVideo={removeMainVideo}
        onRemoveThumbnail={removeThumbnail}
        onUploadGalleryImages={(files) =>
          uploadGalleryFiles(
            files,
            "gallery-image"
          )
        }
        onUploadGalleryVideos={(files) =>
          uploadGalleryFiles(
            files,
            "gallery-video"
          )
        }
        onDeleteGalleryItem={
          deleteGalleryItem
        }
      />
    </div>
  );
}