"use client";

import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  ImageIcon,
  Loader2,
  MapPin,
  Maximize2,
  Minus,
  Pause,
  Phone,
  Play,
  Plus,
  ShoppingBag,
  User,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;

    _fbq?: unknown;
  }
}

export type PublicReelGalleryItem = {
  id: string;
  mediaType: string;
  url: string;
  altText: string | null;
  displayOrder: number;
  isPrimary: boolean;
};

export type PublicReelItem = {
  id: string;
  title: string;
  caption: string | null;
  descriptionHtml: string | null;
  videoUrl: string;
  thumbnailUrl: string | null;
  displayOrder: number;

  product: {
    id: string;
    name: string;
    sku: string;
    quantity: number;
    sellingPrice: string;
  };

  gallery: PublicReelGalleryItem[];
};

type ReelFeedProps = {
  categoryName: string;
  categorySlug: string;
  reels: PublicReelItem[];
  insideDhakaDeliveryCharge: string;
  outsideDhakaDeliveryCharge: string;
  metaPixelId: string | null;
};

type ProductModalProps = {
  reel: PublicReelItem;
  onClose: () => void;
  onBuyNow: () => void;
};

type DeliveryArea =
  | "INSIDE_DHAKA"
  | "OUTSIDE_DHAKA";

type CheckoutField =
  | "customerName"
  | "phone"
  | "address"
  | "quantity"
  | "deliveryArea"
  | "customerNote";

type CheckoutForm = {
  customerName: string;
  phone: string;
  address: string;
  customerNote: string;
  quantity: number;
  deliveryArea: DeliveryArea;
  website: string;
};

type CheckoutErrors = Partial<
  Record<CheckoutField, string>
>;

type CreatedOrder = {
  id: string;
  orderId: string | null;
  invoiceId: string | null;
  subtotal: string;
  deliveryCharge: string;
  totalAmount: string;
};

type CheckoutResponse = {
  success: boolean;
  message?: string;
  field?: string;
  order?: CreatedOrder;
};

const CHECKOUT_FIELD_NAMES: CheckoutField[] = [
  "customerName",
  "phone",
  "address",
  "quantity",
  "deliveryArea",
  "customerNote",
];

function isCheckoutField(
  value: string | undefined
): value is CheckoutField {
  return (
    typeof value === "string" &&
    CHECKOUT_FIELD_NAMES.includes(
      value as CheckoutField
    )
  );
}

function parseMoney(
  value: string,
  fallback = 0
): number {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return fallback;
  }

  return amount;
}

function formatMoney(
  value: string | number
): string {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return `৳${String(value)}`;
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function isVideoMedia(
  mediaType: string
): boolean {
  return mediaType.toUpperCase() === "VIDEO";
}

function getPrimaryProductImage(
  reel: PublicReelItem
): string | null {
  const primaryImage = reel.gallery.find(
    (media) =>
      media.isPrimary &&
      !isVideoMedia(media.mediaType)
  );

  if (primaryImage) {
    return primaryImage.url;
  }

  const firstImage = reel.gallery.find(
    (media) => !isVideoMedia(media.mediaType)
  );

  return (
    firstImage?.url ??
    reel.thumbnailUrl ??
    null
  );
}

function trackMetaEvent(
  eventName: string,
  parameters?: Record<string, unknown>,
  eventId?: string
) {
  if (typeof window === "undefined") {
    return;
  }

  if (eventId) {
    window.fbq?.("track", eventName, parameters ?? {}, { eventID: eventId });
    return;
  }

  window.fbq?.("track", eventName, parameters);
}

function createMetaEventId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getBrowserCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const entry = document.cookie.split("; ").find((item) => item.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.split("=").slice(1).join("=")) : null;
}

function MetaPixel({
  pixelId,
}: {
  pixelId: string | null;
}) {
  useEffect(() => {
    if (!pixelId) {
      return;
    }

    const existingScript =
      document.querySelector<HTMLScriptElement>(
        `script[data-meta-pixel-id="${pixelId}"]`
      );

    if (existingScript) {
      trackMetaEvent("PageView");
      return;
    }

    const facebookWindow = window as typeof window & {
      fbq?: {
        (
          action: string,
          eventName: string,
          parameters?: Record<string, unknown>
        ): void;
        callMethod?: (...args: unknown[]) => void;
        queue?: unknown[];
        loaded?: boolean;
        version?: string;
        push?: (...args: unknown[]) => void;
      };
    };

    if (!facebookWindow.fbq) {
        type MetaPixelFunction = {
            (...args: unknown[]): void;
            callMethod?: (...args: unknown[]) => void;
            queue: unknown[][];
            loaded: boolean;
            version: string;
            push: (...args: unknown[]) => void;
        };

        const fbq = function (
            ...args: unknown[]
        ) {
            if (fbq.callMethod) {
            fbq.callMethod(...args);
            return;
            }

            fbq.queue.push(args);
        } as MetaPixelFunction;

        fbq.queue = [];
        fbq.loaded = true;
        fbq.version = "2.0";
        fbq.push = (...args: unknown[]) => {
            fbq(...args);
        };

        facebookWindow.fbq = fbq;
        window._fbq = fbq;
        }

    const script =
      document.createElement("script");

    script.async = true;
    script.src =
      "https://connect.facebook.net/en_US/fbevents.js";

    script.dataset.metaPixelId = pixelId;

    document.head.appendChild(script);

    window.fbq?.("init", pixelId);
    trackMetaEvent("PageView");

    return () => {
      /*
       * Meta Pixel is intentionally kept loaded after
       * route transitions to avoid duplicate loading.
       */
    };
  }, [pixelId]);

  return null;
}

export default function ReelFeed({
  categoryName,
  categorySlug,
  reels,
  insideDhakaDeliveryCharge,
  outsideDhakaDeliveryCharge,
  metaPixelId,
}: ReelFeedProps) {
  const containerRef =
    useRef<HTMLDivElement>(null);

  const videoRefs = useRef<
    Record<string, HTMLVideoElement | null>
  >({});

  const [activeIndex, setActiveIndex] =
    useState(0);

  const [muted, setMuted] =
    useState(true);

  const [pausedReelIds, setPausedReelIds] =
    useState<Set<string>>(
      () => new Set()
    );

  const [selectedReel, setSelectedReel] =
    useState<PublicReelItem | null>(null);

  const [checkoutReel, setCheckoutReel] =
    useState<PublicReelItem | null>(null);

  const [showSwipeHint, setShowSwipeHint] =
    useState(false);

  useEffect(() => {
    if (reels.length < 2) {
      return;
    }

    const storageKey = `reel-swipe-hint:${categorySlug}`;

    try {
      if (window.sessionStorage.getItem(storageKey) === "seen") {
        return;
      }

      window.sessionStorage.setItem(storageKey, "seen");
    } catch {
      // Continue showing the hint when sessionStorage is unavailable.
    }

    const showTimer = window.setTimeout(() => {
      setShowSwipeHint(true);
    }, 450);

    const hideTimer = window.setTimeout(() => {
      setShowSwipeHint(false);
    }, 4200);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [categorySlug, reels.length]);

  const dismissSwipeHint = useCallback(() => {
    setShowSwipeHint(false);
  }, []);

  const playActiveVideo = useCallback(
    async (index: number) => {
      const activeReel = reels[index];

      for (const reel of reels) {
        const video =
          videoRefs.current[reel.id];

        if (!video) {
          continue;
        }

        if (
          reel.id !== activeReel?.id
        ) {
          video.pause();
        }
      }

      if (!activeReel) {
        return;
      }

      const activeVideo =
        videoRefs.current[
          activeReel.id
        ];

      if (
        !activeVideo ||
        pausedReelIds.has(
          activeReel.id
        )
      ) {
        return;
      }

      try {
        await activeVideo.play();
      } catch {
        // Autoplay may be blocked.
      }
    },
    [pausedReelIds, reels]
  );

  useEffect(() => {
    void playActiveVideo(activeIndex);
  }, [
    activeIndex,
    playActiveVideo,
  ]);

  useEffect(() => {
    const container =
      containerRef.current;

    if (!container) {
      return;
    }

    const observer =
      new IntersectionObserver(
        (entries) => {
          let bestEntry:
            | IntersectionObserverEntry
            | null = null;

          for (const entry of entries) {
            if (
              !entry.isIntersecting ||
              entry.intersectionRatio <
                0.55
            ) {
              continue;
            }

            if (
              !bestEntry ||
              entry.intersectionRatio >
                bestEntry.intersectionRatio
            ) {
              bestEntry = entry;
            }
          }

          if (!bestEntry) {
            return;
          }

          const nextIndex = Number(
            bestEntry.target.getAttribute(
              "data-index"
            )
          );

          if (
            Number.isInteger(nextIndex)
          ) {
            setActiveIndex(nextIndex);
          }
        },
        {
          root: container,
          threshold: [
            0.55,
            0.7,
            0.85,
          ],
        }
      );

    const slides =
      container.querySelectorAll<HTMLElement>(
        "[data-reel-slide]"
      );

    slides.forEach((slide) => {
      observer.observe(slide);
    });

    return () => {
      observer.disconnect();
    };
  }, [reels]);

  function scrollToIndex(
    index: number
  ) {
    const safeIndex = Math.max(
      0,
      Math.min(
        reels.length - 1,
        index
      )
    );

    const element =
      containerRef.current?.querySelector<HTMLElement>(
        `[data-index="${safeIndex}"]`
      );

    element?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  async function togglePlayback(
    reel: PublicReelItem
  ) {
    const video =
      videoRefs.current[reel.id];

    if (!video) {
      return;
    }

    if (video.paused) {
      setPausedReelIds(
        (current) => {
          if (
            !current.has(reel.id)
          ) {
            return current;
          }

          const next =
            new Set(current);

          next.delete(reel.id);

          return next;
        }
      );

      try {
        await video.play();
      } catch {
        setPausedReelIds(
          (current) => {
            const next =
              new Set(current);

            next.add(reel.id);

            return next;
          }
        );
      }

      return;
    }

    video.pause();

    setPausedReelIds(
      (current) => {
        if (
          current.has(reel.id)
        ) {
          return current;
        }

        const next =
          new Set(current);

        next.add(reel.id);

        return next;
      }
    );
  }

  function toggleMuted() {
    setMuted(
      (current) => !current
    );
  }

  function openFullscreen(
    reel: PublicReelItem
  ) {
    const video =
      videoRefs.current[reel.id];

    if (!video) {
      return;
    }

    void video.requestFullscreen?.();
  }

  function openProductDetails(
    reel: PublicReelItem
  ) {
    videoRefs.current[
      reel.id
    ]?.pause();

    setSelectedReel(reel);

    trackMetaEvent(
      "ViewContent",
      {
        content_ids: [
          reel.product.id,
        ],
        content_name:
          reel.product.name,
        content_type: "product",
        currency: "BDT",
        value: parseMoney(
          reel.product.sellingPrice
        ),
      }
    );
  }

  function closeProductDetails() {
    setSelectedReel(null);

    void playActiveVideo(
      activeIndex
    );
  }

  function openCheckout(
    reel: PublicReelItem
  ) {
    videoRefs.current[
      reel.id
    ]?.pause();

    setSelectedReel(null);
    setCheckoutReel(reel);

    trackMetaEvent(
      "InitiateCheckout",
      {
        content_ids: [
          reel.product.id,
        ],
        content_name:
          reel.product.name,
        content_type: "product",
        currency: "BDT",
        value: parseMoney(
          reel.product.sellingPrice
        ),
        num_items: 1,
      }
    );
  }

  function closeCheckout() {
    setCheckoutReel(null);

    void playActiveVideo(
      activeIndex
    );
  }

  if (!reels.length) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <MetaPixel
          pixelId={metaPixelId}
        />

        <div className="max-w-md text-center">
          <ShoppingBag className="mx-auto h-12 w-12 text-slate-500" />

          <h1 className="mt-5 text-2xl font-bold">
            No reels available
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            There are currently no
            active products in{" "}
            {categoryName}.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="h-dvh overflow-hidden bg-black">
      <MetaPixel
        pixelId={metaPixelId}
      />

      <div className="relative mx-auto h-full max-w-md overflow-hidden bg-black shadow-2xl">
        <header className="pointer-events-none absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-black/80 to-transparent px-4 pb-12 pt-4 text-white">
          <p className="truncate text-center text-sm font-semibold">
            {categoryName}
          </p>
        </header>

        <div
          ref={containerRef}
          onScroll={dismissSwipeHint}
          onTouchStart={dismissSwipeHint}
          onWheel={dismissSwipeHint}
          className="h-full snap-y snap-mandatory overflow-y-auto overscroll-y-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {reels.map(
            (reel, index) => {
              const paused =
                pausedReelIds.has(
                  reel.id
                );

              return (
                <section
                  key={reel.id}
                  data-reel-slide
                  data-index={index}
                  className="relative h-full snap-start overflow-hidden bg-black"
                >
                  <video
                    ref={(element) => {
                      videoRefs.current[
                        reel.id
                      ] = element;
                    }}
                    src={reel.videoUrl}
                    poster={
                      reel.thumbnailUrl ??
                      undefined
                    }
                    muted={muted}
                    loop
                    playsInline
                    preload={
                      Math.abs(
                        activeIndex -
                          index
                      ) <= 1
                        ? "auto"
                        : "metadata"
                    }
                    onClick={() => {
                      void togglePlayback(
                        reel
                      );
                    }}
                    onPlay={() => {
                      setPausedReelIds(
                        (current) => {
                          if (
                            !current.has(
                              reel.id
                            )
                          ) {
                            return current;
                          }

                          const next =
                            new Set(
                              current
                            );

                          next.delete(
                            reel.id
                          );

                          return next;
                        }
                      );
                    }}
                    onError={(
                      event
                    ) => {
                      event.currentTarget.pause();

                      setPausedReelIds(
                        (current) => {
                          const next =
                            new Set(
                              current
                            );

                          next.add(
                            reel.id
                          );

                          return next;
                        }
                      );
                    }}
                    className="h-full w-full cursor-pointer object-contain"
                  />

                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/20" />

                  {paused ? (
                    <button
                      type="button"
                      onClick={() => {
                        void togglePlayback(
                          reel
                        );
                      }}
                      className="absolute left-1/2 top-1/2 z-20 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur"
                      aria-label="Play video"
                    >
                      <Play className="ml-1 h-7 w-7 fill-current" />
                    </button>
                  ) : null}

                  <div className="absolute right-3 top-20 z-20 flex flex-col gap-3">
                    <CircleButton
                      label={
                        muted
                          ? "Turn sound on"
                          : "Mute video"
                      }
                      onClick={
                        toggleMuted
                      }
                    >
                      {muted ? (
                        <VolumeX className="h-5 w-5" />
                      ) : (
                        <Volume2 className="h-5 w-5" />
                      )}
                    </CircleButton>

                    <CircleButton
                      label={
                        paused
                          ? "Play video"
                          : "Pause video"
                      }
                      onClick={() => {
                        void togglePlayback(
                          reel
                        );
                      }}
                    >
                      {paused ? (
                        <Play className="h-5 w-5 fill-current" />
                      ) : (
                        <Pause className="h-5 w-5 fill-current" />
                      )}
                    </CircleButton>

                    <CircleButton
                      label="Open fullscreen"
                      onClick={() => {
                        openFullscreen(
                          reel
                        );
                      }}
                    >
                      <Maximize2 className="h-5 w-5" />
                    </CircleButton>
                  </div>

                  <div className="absolute inset-x-0 bottom-0 z-20 p-4 pb-5 text-white">
                    <div className="pr-14">
                      <h1 className="line-clamp-2 text-xl font-bold">
                        {reel.title}
                      </h1>

                      <p className="mt-1 text-lg font-bold text-emerald-300">
                        {formatMoney(
                          reel.product
                            .sellingPrice
                        )}
                      </p>

                      {reel.caption ? (
                        <p className="mt-2 line-clamp-3 text-sm leading-6 text-white/85">
                          {
                            reel.caption
                          }
                        </p>
                      ) : null}

                      <p className="mt-2 text-xs text-white/60">
                        SKU:{" "}
                        {
                          reel.product
                            .sku
                        }
                      </p>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          openProductDetails(
                            reel
                          );
                        }}
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/30 bg-black/30 px-4 text-sm font-semibold backdrop-blur transition hover:bg-black/50"
                      >
                        <Eye className="h-4 w-4" />
                        বিস্তারিত
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          openCheckout(
                            reel
                          );
                        }}
                        disabled={
                          reel.product
                            .quantity <=
                          0
                        }
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-bold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-500"
                      >
                        <ShoppingBag className="h-4 w-4" />

                        {reel.product
                          .quantity > 0
                          ? "অর্ডার করুন"
                          : "স্টক শেষ"}
                      </button>
                    </div>
                  </div>
                </section>
              );
            }
          )}
        </div>

        {activeIndex > 0 ? (
          <button
            type="button"
            onClick={() => {
              scrollToIndex(
                activeIndex - 1
              );
            }}
            className="absolute left-3 top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur"
            aria-label="Previous reel"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : null}

        {activeIndex <
        reels.length - 1 ? (
          <button
            type="button"
            onClick={() => {
              scrollToIndex(
                activeIndex + 1
              );
            }}
            className="absolute right-3 top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur"
            aria-label="Next reel"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        ) : null}

        <div className="absolute right-3 top-4 z-40 rounded-full bg-black/45 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
          {activeIndex + 1}/
          {reels.length}
        </div>

        {showSwipeHint ? (
          <button
            type="button"
            onClick={dismissSwipeHint}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 text-white backdrop-blur-[1px]"
            aria-label="Swipe instruction বন্ধ করুন"
          >
            <span className="flex flex-col items-center rounded-3xl bg-black/65 px-7 py-5 shadow-2xl backdrop-blur">
              <span className="reel-swipe-hand text-5xl" aria-hidden="true">
                ☝️
              </span>
              <span className="mt-3 text-base font-bold">
                উপরে সোয়াইপ করুন
              </span>
              <span className="mt-1 text-xs text-white/75">
                পরের পণ্য দেখতে
              </span>
            </span>
          </button>
        ) : null}
      </div>

      {selectedReel ? (
        <ProductModal
          reel={selectedReel}
          onClose={
            closeProductDetails
          }
          onBuyNow={() => {
            openCheckout(
              selectedReel
            );
          }}
        />
      ) : null}

      <style jsx>{`
        @keyframes reelSwipeUp {
          0%,
          100% {
            transform: translateY(18px);
            opacity: 0.55;
          }
          50% {
            transform: translateY(-22px);
            opacity: 1;
          }
        }

        .reel-swipe-hand {
          animation: reelSwipeUp 1.25s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .reel-swipe-hand {
            animation: none;
          }
        }
      `}</style>

      {checkoutReel ? (
        <CheckoutModal
          key={checkoutReel.id}
          reel={checkoutReel}
          categorySlug={
            categorySlug
          }
          insideDhakaDeliveryCharge={
            insideDhakaDeliveryCharge
          }
          outsideDhakaDeliveryCharge={
            outsideDhakaDeliveryCharge
          }
          onClose={closeCheckout}
        />
      ) : null}
    </main>
  );
}

function CircleButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function ProductModal({
  reel,
  onClose,
  onBuyNow,
}: ProductModalProps) {
  const media = reel.gallery;

  const [
    activeMediaIndex,
    setActiveMediaIndex,
  ] = useState(0);

  const currentMedia =
    media[activeMediaIndex] ??
    null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4">
      <div className="flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="z-10 flex shrink-0 items-center justify-between border-b bg-white/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <h2 className="font-bold text-slate-900">
              Product Details
            </h2>

            <p className="truncate text-xs text-slate-500">
              {reel.product.sku}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="ml-4 shrink-0 rounded-full border p-2 text-slate-600 transition hover:bg-slate-100"
            aria-label="Close product details"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 pb-8">
          <div className="overflow-hidden rounded-2xl bg-slate-100">
            {currentMedia ? (
              isVideoMedia(
                currentMedia.mediaType
              ) ? (
                <video
                  src={
                    currentMedia.url
                  }
                  controls
                  playsInline
                  className="aspect-square w-full object-contain"
                />
              ) : (
                 
                <img
                  src={
                    currentMedia.url
                  }
                  alt={
                    currentMedia.altText ??
                    reel.product.name
                  }
                  className="aspect-square w-full object-contain"
                />
              )
            ) : reel.thumbnailUrl ? (
               
              <img
                src={
                  reel.thumbnailUrl
                }
                alt={
                  reel.product.name
                }
                className="aspect-square w-full object-contain"
              />
            ) : (
              <div className="flex aspect-square items-center justify-center text-slate-400">
                <ImageIcon className="h-12 w-12" />
              </div>
            )}
          </div>

          {media.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {media.map(
                (item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveMediaIndex(
                        index
                      );
                    }}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-slate-100 ${
                      index ===
                      activeMediaIndex
                        ? "border-slate-900"
                        : "border-transparent"
                    }`}
                    aria-label={`View product media ${
                      index + 1
                    }`}
                  >
                    {isVideoMedia(
                      item.mediaType
                    ) ? (
                      <video
                        src={
                          item.url
                        }
                        muted
                        playsInline
                        preload="metadata"
                        className="pointer-events-none h-full w-full object-cover"
                      />
                    ) : (
                       
                      <img
                        src={
                          item.url
                        }
                        alt={
                          item.altText ??
                          reel
                            .product
                            .name
                        }
                        className="h-full w-full object-cover"
                      />
                    )}
                  </button>
                )
              )}
            </div>
          ) : null}

          <div>
            <h3 className="text-xl font-bold text-slate-900">
              {
                reel.product
                  .name
              }
            </h3>

            <p className="mt-1 text-xl font-bold text-emerald-600">
              {formatMoney(
                reel.product
                  .sellingPrice
              )}
            </p>

            <p className="mt-2 text-sm text-slate-500">
              {reel.product
                .quantity > 0
                ? `${reel.product.quantity} available`
                : "Currently out of stock"}
            </p>
          </div>

          {reel.descriptionHtml ? (
            <div
              className="prose prose-sm max-w-none text-slate-700"
              dangerouslySetInnerHTML={{
                __html:
                  reel.descriptionHtml,
              }}
            />
          ) : reel.caption ? (
            <p className="whitespace-pre-line text-sm leading-7 text-slate-700">
              {reel.caption}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 border-t bg-white p-4 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500">
                Product price
              </p>

              <p className="text-lg font-bold text-emerald-600">
                {formatMoney(
                  reel.product
                    .sellingPrice
                )}
              </p>
            </div>

            <p className="text-right text-xs text-slate-500">
              {reel.product
                .quantity > 0
                ? `${reel.product.quantity} available`
                : "Out of stock"}
            </p>
          </div>

          <button
            type="button"
            onClick={onBuyNow}
            disabled={
              reel.product
                .quantity <= 0
            }
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-bold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            <ShoppingBag className="h-4 w-4" />

            {reel.product
              .quantity > 0
              ? "অর্ডার করুন"
              : "স্টক শেষ"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckoutModal({
  reel,
  categorySlug,
  insideDhakaDeliveryCharge,
  outsideDhakaDeliveryCharge,
  onClose,
}: {
  reel: PublicReelItem;
  categorySlug: string;
  insideDhakaDeliveryCharge: string;
  outsideDhakaDeliveryCharge: string;
  onClose: () => void;
}) {
  const [form, setForm] =
    useState<CheckoutForm>({
      customerName: "",
      phone: "",
      address: "",
      customerNote: "",
      quantity: 1,
      deliveryArea:
        "INSIDE_DHAKA",
      website: "",
    });

  const [errors, setErrors] =
    useState<CheckoutErrors>(
      {}
    );

  const [
    generalError,
    setGeneralError,
  ] = useState("");

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    createdOrder,
    setCreatedOrder,
  ] =
    useState<CreatedOrder | null>(
      null
    );

  const unitPrice = parseMoney(
    reel.product.sellingPrice
  );

  const insideCharge =
    parseMoney(
      insideDhakaDeliveryCharge,
      70
    );

  const outsideCharge =
    parseMoney(
      outsideDhakaDeliveryCharge,
      150
    );

  const deliveryCharge =
    form.deliveryArea ===
    "INSIDE_DHAKA"
      ? insideCharge
      : outsideCharge;

  const subtotal =
    unitPrice * form.quantity;

  const grandTotal =
    subtotal + deliveryCharge;

  const productImage =
    getPrimaryProductImage(reel);

  function clearFieldError(
    field: CheckoutField
  ) {
    setErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = {
        ...current,
      };

      delete next[field];

      return next;
    });

    setGeneralError("");
  }

  function setTextField(
    field:
      | "customerName"
      | "phone"
      | "address"
      | "customerNote"
      | "website",
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    if (
      field !== "website"
    ) {
      clearFieldError(field);
    }
  }

  function changeQuantity(
    nextQuantity: number
  ) {
    const safeQuantity =
      Math.max(
        1,
        Math.min(
          reel.product.quantity,
          nextQuantity
        )
      );

    setForm((current) => ({
      ...current,
      quantity: safeQuantity,
    }));

    clearFieldError(
      "quantity"
    );
  }

  function changeDeliveryArea(
    area: DeliveryArea
  ) {
    setForm((current) => ({
      ...current,
      deliveryArea: area,
    }));

    clearFieldError(
      "deliveryArea"
    );
  }

  function validateCheckout(): boolean {
    const nextErrors:
      CheckoutErrors = {};

    const customerName =
      form.customerName.trim();

    const phone =
      form.phone.replace(
        /\D/g,
        ""
      );

    const address =
      form.address.trim();

    if (!customerName) {
      nextErrors.customerName =
        "আপনার নাম লিখুন।";
    }

    if (
      !/^01[3-9]\d{8}$/.test(
        phone
      )
    ) {
      nextErrors.phone =
        "সঠিক ১১ সংখ্যার মোবাইল নম্বর লিখুন।";
    }

    if (!address) {
      nextErrors.address =
        "সম্পূর্ণ ঠিকানা লিখুন।";
    }

    if (
      form.quantity < 1 ||
      form.quantity >
        reel.product.quantity
    ) {
      nextErrors.quantity =
        "পণ্যের সঠিক পরিমাণ নির্বাচন করুন।";
    }

    setErrors(nextErrors);

    return (
      Object.keys(
        nextErrors
      ).length === 0
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setGeneralError("");

    if (!validateCheckout()) {
      return;
    }

    setIsSubmitting(true);
    const purchaseEventId = createMetaEventId("purchase");

    try {
      const response = await fetch(
        "/api/reels/orders",
        {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type":
              "application/json",
            Accept:
              "application/json",
          },
          body: JSON.stringify({
            reelId: reel.id,
            categorySlug,
            customerName:
              form.customerName.trim(),
            phone:
              form.phone.replace(
                /\D/g,
                ""
              ),
            address:
              form.address.trim(),
            quantity:
              form.quantity,
            deliveryArea:
              form.deliveryArea,
            customerNote:
              form.customerNote.trim(),
            website:
              form.website,
            eventId: purchaseEventId,
            eventSourceUrl: window.location.href,
            fbp: getBrowserCookie("_fbp"),
            fbc: getBrowserCookie("_fbc"),
          }),
        }
      );

      const result =
        (await response.json()) as CheckoutResponse;

      if (
        !response.ok ||
        !result.success ||
        !result.order
      ) {
        const responseField =
          result.field;

        if (
          isCheckoutField(
            responseField
          )
        ) {
          setErrors(
            (current) => ({
              ...current,
              [responseField]:
                result.message ??
                "তথ্যটি সঠিক নয়।",
            })
          );
        }

        throw new Error(
          result.message ??
            "অর্ডারটি সম্পন্ন করা যায়নি।"
        );
      }

      setCreatedOrder(
        result.order
      );

      trackMetaEvent(
        "Purchase",
        {
          content_ids: [
            reel.product.id,
          ],
          content_name:
            reel.product.name,
          content_type:
            "product",
          currency: "BDT",
          value: Number(
            result.order
              .totalAmount
          ),
          num_items:
            form.quantity,
          order_id:
            result.order
              .invoiceId ??
            result.order
              .orderId ??
            result.order.id,
        },
        purchaseEventId
      );
    } catch (error) {
      setGeneralError(
        error instanceof Error
          ? error.message
          : "অর্ডারটি সম্পন্ন করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (createdOrder) {
    return (
      <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/75 sm:items-center sm:p-4">
        <div className="w-full max-w-lg rounded-t-3xl bg-white p-6 text-center shadow-2xl sm:rounded-3xl">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-11 w-11" />
          </div>

          <h2 className="mt-5 text-2xl font-bold text-slate-950">
            অর্ডার সফল হয়েছে
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে। আমাদের প্রতিনিধি শিগগিরই আপনার সঙ্গে যোগাযোগ করবেন।
          </p>

          <div className="mt-5 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left">
            {createdOrder.invoiceId ? (
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-slate-600">
                  Invoice ID
                </span>

                <strong className="text-sm text-slate-950">
                  {
                    createdOrder.invoiceId
                  }
                </strong>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-slate-600">
                পণ্যের মূল্য
              </span>

              <strong className="text-sm text-slate-950">
                {formatMoney(
                  createdOrder.subtotal
                )}
              </strong>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-slate-600">
                ডেলিভারি চার্জ
              </span>

              <strong className="text-sm text-slate-950">
                {formatMoney(
                  createdOrder.deliveryCharge
                )}
              </strong>
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-dashed border-slate-300 pt-3">
              <span className="font-semibold text-slate-800">
                সর্বমোট
              </span>

              <strong className="text-xl text-emerald-600">
                {formatMoney(
                  createdOrder.totalAmount
                )}
              </strong>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-6 min-h-13 w-full rounded-xl bg-emerald-600 px-4 text-base font-bold text-white transition hover:bg-emerald-700"
          >
            সম্পন্ন
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/75 sm:items-center sm:p-4">
      <div className="flex max-h-[96dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">
              Checkout
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-950">
              আপনার অর্ডার সম্পূর্ণ করুন
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={
              isSubmitting
            }
            className="shrink-0 rounded-full border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close checkout"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 pb-8">
            <div className="flex gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white">
                {productImage ? (
                   
                  <img
                    src={productImage}
                    alt={
                      reel.product.name
                    }
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <ImageIcon className="h-9 w-9 text-slate-400" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-2 font-bold leading-6 text-slate-950">
                  {
                    reel.product
                      .name
                  }
                </h3>

                <p className="mt-1 text-lg font-bold text-emerald-600">
                  {formatMoney(
                    unitPrice
                  )}
                </p>

                <p className="mt-1 truncate text-xs text-slate-500">
                  SKU:{" "}
                  {
                    reel.product
                      .sku
                  }
                </p>
              </div>
            </div>

            <section>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-slate-950">
                    পরিমাণ
                  </h3>

                  <p className="mt-1 text-xs text-slate-500">
                    উপলব্ধ:{" "}
                    {
                      reel.product
                        .quantity
                    }
                  </p>
                </div>

                <div className="flex items-center overflow-hidden rounded-xl border border-slate-300 bg-white">
                  <button
                    type="button"
                    onClick={() => {
                      changeQuantity(
                        form.quantity -
                          1
                      );
                    }}
                    disabled={
                      form.quantity <=
                        1 ||
                      isSubmitting
                    }
                    className="flex h-11 w-11 items-center justify-center text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-4 w-4" />
                  </button>

                  <div className="flex h-11 min-w-14 items-center justify-center border-x border-slate-300 px-3 text-base font-bold text-slate-950">
                    {
                      form.quantity
                    }
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      changeQuantity(
                        form.quantity +
                          1
                      );
                    }}
                    disabled={
                      form.quantity >=
                        reel.product
                          .quantity ||
                      isSubmitting
                    }
                    className="flex h-11 w-11 items-center justify-center text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {errors.quantity ? (
                <p className="mt-2 text-sm font-medium text-red-600">
                  {
                    errors.quantity
                  }
                </p>
              ) : null}
            </section>

            <section>
              <h3 className="font-bold text-slate-950">
                ডেলিভারি এলাকা নির্বাচন করুন
              </h3>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label
                  className={[
                    "cursor-pointer rounded-2xl border p-4 transition",
                    form.deliveryArea ===
                    "INSIDE_DHAKA"
                      ? "border-orange-500 bg-orange-50 ring-2 ring-orange-100"
                      : "border-slate-200 bg-white hover:border-slate-300",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name="deliveryArea"
                    value="INSIDE_DHAKA"
                    checked={
                      form.deliveryArea ===
                      "INSIDE_DHAKA"
                    }
                    onChange={() => {
                      changeDeliveryArea(
                        "INSIDE_DHAKA"
                      );
                    }}
                    disabled={
                      isSubmitting
                    }
                    className="sr-only"
                  />

                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-950">
                        ঢাকা শহরের মধ্যে
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Inside Dhaka
                      </p>
                    </div>

                    <strong className="text-orange-600">
                      {formatMoney(
                        insideCharge
                      )}
                    </strong>
                  </div>
                </label>

                <label
                  className={[
                    "cursor-pointer rounded-2xl border p-4 transition",
                    form.deliveryArea ===
                    "OUTSIDE_DHAKA"
                      ? "border-orange-500 bg-orange-50 ring-2 ring-orange-100"
                      : "border-slate-200 bg-white hover:border-slate-300",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name="deliveryArea"
                    value="OUTSIDE_DHAKA"
                    checked={
                      form.deliveryArea ===
                      "OUTSIDE_DHAKA"
                    }
                    onChange={() => {
                      changeDeliveryArea(
                        "OUTSIDE_DHAKA"
                      );
                    }}
                    disabled={
                      isSubmitting
                    }
                    className="sr-only"
                  />

                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-950">
                        ঢাকা শহরের বাইরে
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Outside Dhaka
                      </p>
                    </div>

                    <strong className="text-orange-600">
                      {formatMoney(
                        outsideCharge
                      )}
                    </strong>
                  </div>
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-bold text-slate-950">
                অর্ডার সারাংশ
              </h3>

              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-600">
                    পণ্যের মূল্য
                  </span>

                  <span className="font-semibold text-slate-900">
                    {formatMoney(
                      unitPrice
                    )}{" "}
                    ×{" "}
                    {
                      form.quantity
                    }
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-600">
                    সাবটোটাল
                  </span>

                  <strong className="text-slate-950">
                    {formatMoney(
                      subtotal
                    )}
                  </strong>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-600">
                    ডেলিভারি চার্জ
                  </span>

                  <strong className="text-slate-950">
                    {formatMoney(
                      deliveryCharge
                    )}
                  </strong>
                </div>

                <div className="flex items-center justify-between gap-4 border-t border-dashed border-slate-300 pt-3">
                  <span className="text-base font-bold text-slate-950">
                    সর্বমোট
                  </span>

                  <strong className="text-xl text-emerald-600">
                    {formatMoney(
                      grandTotal
                    )}
                  </strong>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="font-bold text-slate-950">
                আপনার তথ্য
              </h3>

              <div>
                <label
                  htmlFor="checkoutCustomerName"
                  className="block text-sm font-semibold text-slate-800"
                >
                  আপনার নাম
                  <span className="text-red-500">
                    *
                  </span>
                </label>

                <div className="relative mt-2">
                  <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                  <input
                    id="checkoutCustomerName"
                    type="text"
                    value={
                      form.customerName
                    }
                    onChange={(
                      event
                    ) => {
                      setTextField(
                        "customerName",
                        event.target
                          .value
                      );
                    }}
                    placeholder="আপনার পূর্ণ নাম লিখুন"
                    autoComplete="name"
                    maxLength={120}
                    disabled={
                      isSubmitting
                    }
                    className={[
                      "h-12 w-full rounded-xl border bg-white pl-12 pr-4 text-base text-slate-950 outline-none transition",
                      errors.customerName
                        ? "border-red-400 ring-4 ring-red-100"
                        : "border-slate-300 focus:border-orange-500 focus:ring-4 focus:ring-orange-100",
                    ].join(" ")}
                  />
                </div>

                {errors.customerName ? (
                  <p className="mt-2 text-sm font-medium text-red-600">
                    {
                      errors.customerName
                    }
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="checkoutPhone"
                  className="block text-sm font-semibold text-slate-800"
                >
                  মোবাইল নম্বর
                  <span className="text-red-500">
                    *
                  </span>
                </label>

                <div className="relative mt-2">
                  <Phone className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                  <input
                    id="checkoutPhone"
                    type="tel"
                    inputMode="numeric"
                    value={
                      form.phone
                    }
                    onChange={(
                      event
                    ) => {
                      setTextField(
                        "phone",
                        event.target.value
                          .replace(
                            /\D/g,
                            ""
                          )
                          .slice(
                            0,
                            11
                          )
                      );
                    }}
                    placeholder="01XXXXXXXXX"
                    autoComplete="tel"
                    maxLength={11}
                    disabled={
                      isSubmitting
                    }
                    className={[
                      "h-12 w-full rounded-xl border bg-white pl-12 pr-4 text-base text-slate-950 outline-none transition",
                      errors.phone
                        ? "border-red-400 ring-4 ring-red-100"
                        : "border-slate-300 focus:border-orange-500 focus:ring-4 focus:ring-orange-100",
                    ].join(" ")}
                  />
                </div>

                {errors.phone ? (
                  <p className="mt-2 text-sm font-medium text-red-600">
                    {
                      errors.phone
                    }
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">
                    ১১ সংখ্যার বাংলাদেশি মোবাইল নম্বর লিখুন।
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="checkoutAddress"
                  className="block text-sm font-semibold text-slate-800"
                >
                  সম্পূর্ণ ঠিকানা
                  <span className="text-red-500">
                    *
                  </span>
                </label>

                <div className="relative mt-2">
                  <MapPin className="pointer-events-none absolute left-4 top-4 h-5 w-5 text-slate-400" />

                  <textarea
                    id="checkoutAddress"
                    value={
                      form.address
                    }
                    onChange={(
                      event
                    ) => {
                      setTextField(
                        "address",
                        event.target
                          .value
                      );
                    }}
                    placeholder="বাড়ি/রোড, এলাকা, থানা ও জেলা লিখুন"
                    autoComplete="street-address"
                    maxLength={1000}
                    rows={4}
                    disabled={
                      isSubmitting
                    }
                    className={[
                      "w-full resize-none rounded-xl border bg-white py-3 pl-12 pr-4 text-base leading-6 text-slate-950 outline-none transition",
                      errors.address
                        ? "border-red-400 ring-4 ring-red-100"
                        : "border-slate-300 focus:border-orange-500 focus:ring-4 focus:ring-orange-100",
                    ].join(" ")}
                  />
                </div>

                {errors.address ? (
                  <p className="mt-2 text-sm font-medium text-red-600">
                    {
                      errors.address
                    }
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="checkoutCustomerNote"
                  className="block text-sm font-semibold text-slate-800"
                >
                  বিশেষ নির্দেশনা
                  <span className="ml-1 text-xs font-normal text-slate-500">
                    (ঐচ্ছিক)
                  </span>
                </label>

                <textarea
                  id="checkoutCustomerNote"
                  value={
                    form.customerNote
                  }
                  onChange={(
                    event
                  ) => {
                    setTextField(
                      "customerNote",
                      event.target.value
                    );
                  }}
                  placeholder="অর্ডার সম্পর্কে কোনো বিশেষ নির্দেশনা থাকলে লিখুন"
                  maxLength={1000}
                  rows={3}
                  disabled={
                    isSubmitting
                  }
                  className="mt-2 w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-base leading-6 text-slate-950 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                />
              </div>

              <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
                <label htmlFor="checkoutWebsite">
                  Website
                </label>

                <input
                  id="checkoutWebsite"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={
                    form.website
                  }
                  onChange={(
                    event
                  ) => {
                    setTextField(
                      "website",
                      event.target.value
                    );
                  }}
                />
              </div>
            </section>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <strong>
                গুরুত্বপূর্ণ:
              </strong>{" "}
              অর্ডার নিশ্চিত করার আগে আপনার নাম, মোবাইল নম্বর এবং ঠিকানা সঠিকভাবে যাচাই করুন। ভুয়া অর্ডার করা থেকে বিরত থাকুন।
            </div>

            {generalError ? (
              <div
                role="alert"
                className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium leading-6 text-red-700"
              >
                {generalError}
              </div>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-white p-4 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
            <div className="mb-3 flex items-center justify-between gap-4">
              <span className="text-sm font-semibold text-slate-700">
                সর্বমোট বিল
              </span>

              <strong className="text-xl text-emerald-600">
                {formatMoney(
                  grandTotal
                )}
              </strong>
            </div>

            <button
              type="submit"
              disabled={
                isSubmitting ||
                reel.product
                  .quantity <= 0
              }
              className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 text-base font-bold text-white shadow-sm transition hover:bg-orange-700 focus:outline-none focus:ring-4 focus:ring-orange-200 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  অর্ডারটি সম্পন্ন হচ্ছে...
                </>
              ) : (
                <>
                  <ShoppingBag className="h-5 w-5" />
                  অর্ডারটি সম্পূর্ণ করতে এখানে চাপ দিন
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}