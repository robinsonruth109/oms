"use client";

import { useEffect } from "react";

import { createMetaSkuEventId, trackMetaEvent } from "@/components/meta/meta-pixel";

type Props = {
  sku: string;
  parentSku?: string | null;
  name: string;
  price: number;
};

export default function MetaViewContent({ sku, parentSku, name, price }: Props) {
  useEffect(() => {
    if (!sku || !Number.isFinite(price) || price < 0) return;

    const eventId = createMetaSkuEventId("view_content", sku);

    trackMetaEvent("ViewContent", {
      content_ids: [sku],
      content_type: "product",
      contents: [{ id: sku, quantity: 1, item_price: price }],
      content_name: name,
      value: price,
      currency: "BDT",
      ...(parentSku ? { item_group_id: parentSku } : {}),
    }, eventId);
  }, [name, parentSku, price, sku]);

  return null;
}
