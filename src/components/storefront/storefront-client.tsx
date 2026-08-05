"use client";

import Link from "next/link";
import { FormEvent, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Loader2,
  Minus,
  PackageCheck,
  Play,
  Plus,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Truck,
  X,
} from "lucide-react";
import { MetaPixel, createMetaEventId, trackMetaEvent } from "@/components/meta/meta-pixel";
import type { StorefrontProduct, StorefrontSettings } from "./types";

type DeliveryArea = "INSIDE_DHAKA" | "OUTSIDE_DHAKA";
type MediaItem = { id: string; mediaType: string; url: string; altText: string | null; isPrimary: boolean };

type Props = {
  products: StorefrontProduct[];
  settings: StorefrontSettings;
  singleProduct?: boolean;
};

function money(value: string | number) {
  return new Intl.NumberFormat("bn-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function getImage(product: StorefrontProduct) {
  return (
    product.gallery.find((item) => item.isPrimary && item.mediaType !== "VIDEO")?.url ??
    product.gallery.find((item) => item.mediaType !== "VIDEO")?.url ??
    product.thumbnailUrl
  );
}

function getProductMedia(product: StorefrontProduct): MediaItem[] {
  const gallery = [...product.gallery].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  const hasVideo = gallery.some((item) => item.mediaType === "VIDEO" && item.url === product.videoUrl);

  if (product.videoUrl && !hasVideo) {
    gallery.push({
      id: `${product.reelId}-video`,
      mediaType: "VIDEO",
      url: product.videoUrl,
      altText: product.title,
      isPrimary: false,
    });
  }

  return gallery;
}

function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  const value = document.cookie.split("; ").find((row) => row.startsWith(`${name}=`));
  return value ? decodeURIComponent(value.split("=").slice(1).join("=")) : null;
}

function ProductDetailView({
  item,
  quantity,
  setQuantity,
  onOrder,
}: {
  item: StorefrontProduct;
  quantity: number;
  setQuantity: (value: number | ((current: number) => number)) => void;
  onOrder: () => void;
}) {
  const media = useMemo(() => getProductMedia(item), [item]);
  const firstImage = media.find((entry) => entry.mediaType !== "VIDEO");
  const [activeMediaId, setActiveMediaId] = useState(firstImage?.id ?? media[0]?.id ?? "");
  const activeMedia = media.find((entry) => entry.id === activeMediaId) ?? media[0];

  const shareProduct = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: item.title, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(window.location.href);
      }
    } catch {
      // The customer cancelled sharing or clipboard permission was unavailable.
    }
  };

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-7xl px-4 pb-14 pt-5 sm:px-6 lg:px-8 lg:pt-8">
        <nav className="mb-6 flex items-center gap-2 overflow-hidden text-sm text-slate-500">
          <Link href="/" className="shrink-0 transition hover:text-orange-600">
            Home
          </Link>
          <ChevronRight className="h-4 w-4 shrink-0" />
          <span className="truncate font-medium text-slate-700">{item.title}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.06fr)_minmax(380px,0.94fr)] lg:gap-12">
          <section>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              <div className="relative aspect-square w-full">
                {activeMedia?.mediaType === "VIDEO" ? (
                  <video
                    key={activeMedia.url}
                    src={activeMedia.url}
                    poster={getImage(item) ?? undefined}
                    controls
                    playsInline
                    className="h-full w-full bg-black object-contain"
                  />
                ) : activeMedia ? (
                  <img
                    src={activeMedia.url}
                    alt={activeMedia.altText || item.title}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400">No media available</div>
                )}
              </div>
            </div>

            {media.length > 1 && (
              <div className="mt-4 grid grid-cols-5 gap-3 sm:grid-cols-6">
                {media.map((entry) => {
                  const active = entry.id === activeMedia?.id;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => setActiveMediaId(entry.id)}
                      className={`relative aspect-square overflow-hidden rounded-xl border-2 bg-slate-50 transition ${
                        active ? "border-orange-500 ring-2 ring-orange-100" : "border-slate-200 hover:border-slate-400"
                      }`}
                      aria-label={entry.mediaType === "VIDEO" ? "Play product video" : "View product image"}
                    >
                      {entry.mediaType === "VIDEO" ? (
                        <>
                          {getImage(item) ? (
                            <img src={getImage(item) ?? ""} alt="" className="h-full w-full object-cover opacity-75" />
                          ) : (
                            <div className="h-full w-full bg-slate-900" />
                          )}
                          <span className="absolute inset-0 flex items-center justify-center">
                            <span className="rounded-full bg-black/70 p-2 text-white">
                              <Play className="h-4 w-4 fill-current" />
                            </span>
                          </span>
                        </>
                      ) : (
                        <img src={entry.url} alt={entry.altText || item.title} className="h-full w-full object-cover" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="lg:pt-2">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-600">Gloss & Glows</p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">{item.title}</h1>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <p className="text-3xl font-bold text-orange-600">{money(item.product.sellingPrice)}</p>
              {item.product.quantity > 0 ? (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">In stock</span>
              ) : (
                <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-700">Out of stock</span>
              )}
            </div>

            {item.caption && <p className="mt-5 leading-7 text-slate-600">{item.caption}</p>}

            <div className="mt-8">
              <label className="text-sm font-semibold text-slate-800">Quantity</label>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <div className="inline-flex h-14 w-40 items-center justify-between rounded-xl border border-slate-300 bg-white px-2">
                  <button
                    type="button"
                    onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                    className="rounded-lg p-3 text-slate-700 transition hover:bg-slate-100"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <strong className="min-w-8 text-center text-lg">{quantity}</strong>
                  <button
                    type="button"
                    onClick={() => setQuantity((current) => Math.min(Math.max(1, item.product.quantity), current + 1))}
                    className="rounded-lg p-3 text-slate-700 transition hover:bg-slate-100"
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onOrder}
                  disabled={item.product.quantity <= 0}
                  className="hidden h-14 flex-1 items-center justify-center gap-3 rounded-xl bg-orange-600 px-6 text-lg font-bold text-white shadow-lg shadow-orange-200 transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none sm:flex"
                >
                  <ShoppingBag className="h-5 w-5" />
                  অর্ডার করুন
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={shareProduct}
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 transition hover:text-orange-600"
            >
              <Share2 className="h-4 w-4" />
              Share this product
            </button>

            <div className="mt-7 divide-y divide-slate-200 border-y border-slate-200">
              <div className="flex gap-4 py-4">
                <Truck className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
                <div>
                  <p className="font-semibold text-slate-900">Fast delivery across Bangladesh</p>
                  <p className="mt-1 text-sm text-slate-500">Delivery charge is shown during checkout.</p>
                </div>
              </div>
              <div className="flex gap-4 py-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
                <div>
                  <p className="font-semibold text-slate-900">Secure cash-on-delivery order</p>
                  <p className="mt-1 text-sm text-slate-500">Confirm your order using your name, phone number and address.</p>
                </div>
              </div>
              <div className="flex gap-4 py-4">
                <PackageCheck className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
                <div>
                  <p className="font-semibold text-slate-900">Product code: {item.product.sku}</p>
                  <p className="mt-1 text-sm text-slate-500">Available quantity: {item.product.quantity}</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {item.descriptionHtml && (
        <section className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <div className="border-b border-slate-200">
              <h2 className="inline-block border-b-2 border-slate-950 pb-4 text-xl font-semibold text-slate-950">
                Product description
              </h2>
            </div>
            <div
              className="prose prose-slate mx-auto mt-10 max-w-4xl text-center prose-img:mx-auto prose-img:rounded-xl prose-img:shadow-sm"
              dangerouslySetInnerHTML={{ __html: item.descriptionHtml }}
            />
          </div>
        </section>
      )}
    </div>
  );
}

export default function StorefrontClient({ products, settings, singleProduct = false }: Props) {
  const [selected, setSelected] = useState<StorefrontProduct | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [deliveryArea, setDeliveryArea] = useState<DeliveryArea>("INSIDE_DHAKA");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const checkoutRequestIdRef = useRef<string | null>(null);

  const openCheckout = (product: StorefrontProduct, initialQty = 1) => {
    const safeQuantity = Math.max(1, Math.min(initialQty, Math.max(1, product.product.quantity)));
    setSelected(product);
    setQuantity(safeQuantity);
    setError("");
    setSuccess(null);
    checkoutRequestIdRef.current = createMetaEventId("checkout");
    const eventId = createMetaEventId("initiate_checkout");
    trackMetaEvent(
      "InitiateCheckout",
      {
        content_ids: [product.product.id],
        content_type: "product",
        value: Number(product.product.sellingPrice) * safeQuantity,
        currency: "BDT",
      },
      eventId,
    );
  };

  const subtotal = useMemo(
    () => (selected ? Number(selected.product.sellingPrice) * quantity : 0),
    [selected, quantity],
  );
  const delivery =
    deliveryArea === "INSIDE_DHAKA"
      ? Number(settings.insideDhakaDeliveryCharge)
      : Number(settings.outsideDhakaDeliveryCharge);
  const total = subtotal + delivery;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setError("");
    if (!name.trim()) return setError("আপনার নাম লিখুন।");
    if (!/^01[3-9]\d{8}$/.test(phone.replace(/\D/g, ""))) return setError("সঠিক ১১ সংখ্যার মোবাইল নম্বর লিখুন।");
    if (!address.trim()) return setError("সম্পূর্ণ ঠিকানা লিখুন।");

    const checkoutRequestId =
      checkoutRequestIdRef.current ?? createMetaEventId("checkout");
    checkoutRequestIdRef.current = checkoutRequestId;
    setSubmitting(true);
    try {
      const response = await fetch("/api/reels/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reelId: selected.reelId,
          categorySlug: selected.categorySlug,
          customerName: name,
          phone,
          address,
          quantity,
          deliveryArea,
          customerNote: note,
          website,
          checkoutRequestId,
          eventSourceUrl: window.location.href,
          fbp: getCookie("_fbp"),
          fbc: getCookie("_fbc"),
        }),
      });
      const result = (await response.json()) as {
        success: boolean;
        message?: string;
        order?: {
          orderId?: string | null;
          invoiceId?: string | null;
          totalAmount?: string;
          metaEventId?: string;
        };
      };
      if (!response.ok || !result.success) throw new Error(result.message || "অর্ডার গ্রহণ করা যায়নি।");
      trackMetaEvent(
        "Purchase",
        {
          content_ids: [selected.product.id],
          content_type: "product",
          value: Number(result.order?.totalAmount ?? total),
          currency: "BDT",
          num_items: quantity,
          order_id:
            result.order?.orderId ??
            result.order?.invoiceId ??
            checkoutRequestId,
        },
        result.order?.metaEventId ?? `purchase_${checkoutRequestId}`,
      );
      setSuccess(result.order?.orderId || "SUCCESS");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "অর্ডার গ্রহণ করা যায়নি।");
    } finally {
      setSubmitting(false);
    }
  }

  const productCards = (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <div className="mb-10 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.28em] text-orange-600">Gloss & Glows</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 lg:text-5xl">আমাদের জনপ্রিয় পণ্যসমূহ</h1>
        <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-slate-600">
          ভিডিও দেখুন, বিস্তারিত জানুন এবং সহজে অর্ডার করুন
        </p>
      </div>

      <div className="grid justify-center gap-8 [grid-template-columns:repeat(auto-fit,minmax(300px,370px))]">
        {products.map((item) => {
          const image = getImage(item);
          const inStock = item.product.quantity > 0;

          return (
            <article
              key={item.reelId}
              className="group overflow-hidden rounded-[28px] border border-slate-200/90 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.08)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_22px_50px_rgba(15,23,42,0.14)]"
            >
              <Link href={`/product/${item.reelId}`} className="relative block overflow-hidden bg-slate-100">
                <div className="aspect-[4/4.35] overflow-hidden">
                  {item.videoUrl ? (
                    <video
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      src={item.videoUrl}
                      poster={image ?? undefined}
                      muted
                      loop
                      playsInline
                    />
                  ) : image ? (
                    <img
                      src={image}
                      alt={item.title}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm font-medium text-slate-400">
                      No image available
                    </div>
                  )}
                </div>

                <div className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-slate-800 shadow-sm backdrop-blur">
                  জনপ্রিয়
                </div>
                <div
                  className={`absolute right-4 top-4 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm backdrop-blur ${
                    inStock ? "bg-emerald-500/95 text-white" : "bg-red-500/95 text-white"
                  }`}
                >
                  {inStock ? "স্টকে আছে" : "স্টক শেষ"}
                </div>
              </Link>

              <div className="p-6">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-600">Gloss & Glows</p>
                <Link href={`/product/${item.reelId}`} className="mt-2 block">
                  <h2 className="line-clamp-2 min-h-[3.5rem] text-xl font-black leading-7 text-slate-950 transition group-hover:text-orange-600">
                    {item.title}
                  </h2>
                </Link>

                <div className="mt-4 flex items-end justify-between gap-3">
                  <p className="text-3xl font-black tracking-tight text-orange-600">{money(item.product.sellingPrice)}</p>
                  <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
                    Cash on delivery
                  </span>
                </div>

                {item.caption && (
                  <p className="mt-4 line-clamp-2 min-h-[2.75rem] text-sm leading-6 text-slate-600">{item.caption}</p>
                )}

                <div className="mt-6 grid grid-cols-[1.2fr_1fr] gap-3">
                  <button
                    type="button"
                    onClick={() => openCheckout(item)}
                    disabled={!inStock}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3 font-black text-white shadow-lg shadow-orange-200 transition hover:bg-orange-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    {inStock ? "অর্ডার করুন" : "স্টক শেষ"}
                  </button>
                  <Link
                    href={`/product/${item.reelId}`}
                    className="inline-flex min-h-12 items-center justify-center gap-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-center font-black text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 active:scale-[0.98]"
                  >
                    বিস্তারিত
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );

  return (
    <main className={`min-h-screen bg-slate-50 ${singleProduct ? "pb-24 sm:pb-0" : ""}`}>
      <MetaPixel pixelId={settings.metaPixelId} />

      {singleProduct && products[0] ? (
        <ProductDetailView
          item={products[0]}
          quantity={quantity}
          setQuantity={setQuantity}
          onOrder={() => openCheckout(products[0], quantity)}
        />
      ) : (
        <>
          <div className="hidden md:block">{productCards}</div>
          <div className="md:hidden">
            <div className="h-[100svh] snap-y snap-mandatory overflow-y-auto bg-black">
              {products.map((item) => (
                <section key={item.reelId} className="relative h-[100svh] snap-start overflow-hidden bg-black">
                  <video
                    src={item.videoUrl}
                    poster={getImage(item) ?? undefined}
                    className="h-full w-full object-cover"
                    muted
                    loop
                    autoPlay
                    playsInline
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/20" />
                  <div className="absolute inset-x-0 bottom-0 p-5 pb-8 text-white">
                    <h2 className="text-2xl font-black">{item.title}</h2>
                    <p className="mt-2 text-2xl font-black text-orange-400">{money(item.product.sellingPrice)}</p>
                    {item.caption && <p className="mt-2 line-clamp-2 text-sm text-white/80">{item.caption}</p>}
                    <div className="mt-5 flex gap-3">
                      <button
                        onClick={() => openCheckout(item)}
                        className="flex-1 rounded-xl bg-orange-600 px-4 py-3 font-bold"
                      >
                        অর্ডার করুন
                      </button>
                      <Link
                        href={`/product/${item.reelId}`}
                        className="flex-1 rounded-xl border border-white/50 bg-black/20 px-4 py-3 text-center font-bold backdrop-blur"
                      >
                        বিস্তারিত
                      </Link>
                    </div>
                  </div>
                </section>
              ))}
            </div>
          </div>
        </>
      )}

      {singleProduct && products[0] && !selected && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.14)] backdrop-blur sm:hidden">
          <button
            type="button"
            onClick={() => openCheckout(products[0], quantity)}
            disabled={products[0].product.quantity <= 0}
            className="flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-orange-600 px-6 text-lg font-black text-white shadow-lg shadow-orange-200 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            <ShoppingBag className="h-5 w-5" />
            {products[0].product.quantity > 0 ? "অর্ডার করুন" : "স্টক শেষ"}
          </button>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
          <div className="max-h-[95vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-orange-600">অর্ডার ফর্ম</p>
                <h3 className="mt-1 text-xl font-bold text-slate-950">{selected.title}</h3>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-full p-2 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            {success ? (
              <div className="py-12 text-center">
                <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-600" />
                <h4 className="mt-4 text-2xl font-bold">অর্ডার সফল হয়েছে</h4>
                <p className="mt-2 text-slate-600">Order ID: {success}</p>
                <button
                  onClick={() => setSelected(null)}
                  className="mt-6 rounded-xl bg-slate-900 px-6 py-3 font-bold text-white"
                >
                  বন্ধ করুন
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-6 space-y-4">
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                  <span className="font-semibold">পরিমাণ</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                      className="rounded-lg border p-2"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <strong>{quantity}</strong>
                    <button
                      type="button"
                      onClick={() => setQuantity((current) => Math.min(selected.product.quantity, current + 1))}
                      className="rounded-lg border p-2"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDeliveryArea("INSIDE_DHAKA")}
                    className={`rounded-xl border p-3 text-sm font-bold ${
                      deliveryArea === "INSIDE_DHAKA" ? "border-orange-600 bg-orange-50 text-orange-700" : ""
                    }`}
                  >
                    ঢাকার ভিতরে
                    <br />
                    {money(settings.insideDhakaDeliveryCharge)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryArea("OUTSIDE_DHAKA")}
                    className={`rounded-xl border p-3 text-sm font-bold ${
                      deliveryArea === "OUTSIDE_DHAKA" ? "border-orange-600 bg-orange-50 text-orange-700" : ""
                    }`}
                  >
                    ঢাকার বাইরে
                    <br />
                    {money(settings.outsideDhakaDeliveryCharge)}
                  </button>
                </div>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="আপনার নাম"
                  className="w-full rounded-xl border px-4 py-3 outline-none focus:border-orange-500"
                />
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="মোবাইল নম্বর (১১ সংখ্যা)"
                  inputMode="numeric"
                  className="w-full rounded-xl border px-4 py-3 outline-none focus:border-orange-500"
                />
                <textarea
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="সম্পূর্ণ ঠিকানা"
                  rows={3}
                  className="w-full rounded-xl border px-4 py-3 outline-none focus:border-orange-500"
                />
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="বিশেষ নির্দেশনা (ঐচ্ছিক)"
                  rows={2}
                  className="w-full rounded-xl border px-4 py-3 outline-none focus:border-orange-500"
                />
                <input
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  className="hidden"
                  aria-hidden="true"
                />
                <div className="rounded-2xl bg-slate-950 p-4 text-white">
                  <div className="flex justify-between text-sm">
                    <span>পণ্যের মূল্য</span>
                    <span>{money(subtotal)}</span>
                  </div>
                  <div className="mt-2 flex justify-between text-sm">
                    <span>ডেলিভারি</span>
                    <span>{money(delivery)}</span>
                  </div>
                  <div className="mt-3 flex justify-between border-t border-white/20 pt-3 text-lg font-black">
                    <span>সর্বমোট</span>
                    <span>{money(total)}</span>
                  </div>
                </div>
                {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
                <button
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-4 text-lg font-black text-white disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShoppingBag className="h-5 w-5" />}
                  অর্ডার নিশ্চিত করুন
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}