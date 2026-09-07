export const MAX_READY_ORDER_PRODUCT_COLUMNS = 8;

export type ReadyOrderSheetItem = {
  productSku: string;
  quantity: number;
  unitPrice: unknown;
  product: {
    parent: {
      sku: string;
    };
  } | null;
};

export type ReadyOrderSheetOrder = {
  id: string;
  invoiceId: string | null;
  source: { name: string };
  readyToShipAt: Date;
  customerName: string;
  phone: string;
  address: string;
  items: ReadyOrderSheetItem[];
  deliveryCharge: unknown;
  advance: unknown;
  discount: unknown;
  totalAmount: unknown;
  note: string | null;
  orderStatus: string;
};

export function formatReadyOrderSheetDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

export function formatReadyOrderBusinessDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function readyOrderStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING_CONFIRMATION: "Pending Confirmation",
    READY_TO_SHIP: "Ready",
    NO_ANSWER: "No Answer",
    PHONE_OFF: "Phone Off",
    CANCELLED: "Cancelled",
    DOUBLE_ORDER: "Double Order",
    STOCK_OUT: "Stock Out",
    RETURNED: "Returned",
    PARTIAL_RETURN: "Partial Return",
  };

  return labels[status] || status.replace(/_/g, " ");
}

export function readyOrderProductColumns(items: ReadyOrderSheetItem[]) {
  const columns: Array<string | number> = [];

  for (let index = 0; index < MAX_READY_ORDER_PRODUCT_COLUMNS; index += 1) {
    const item = items[index];

    if (!item) {
      columns.push("", "", "", "");
      continue;
    }

    columns.push(
      item.product?.parent.sku || "",
      item.productSku || "",
      Number(item.unitPrice),
      item.quantity
    );
  }

  return columns;
}

export function buildReadyOrderSheetRow(
  order: ReadyOrderSheetOrder,
  options?: {
    businessDate?: string | null;
    statusOverride?: string | null;
  }
) {
  const invoiceId = order.invoiceId || "";
  const date = options?.businessDate
    ? formatReadyOrderBusinessDate(options.businessDate)
    : formatReadyOrderSheetDate(order.readyToShipAt);
  const status = options?.statusOverride
    ? options.statusOverride
    : readyOrderStatusLabel(order.orderStatus);

  return [
    // A: OMS UUID
    order.id,
    // B-C: Invoice ID intentionally duplicated.
    invoiceId,
    invoiceId,
    // D-H
    order.source.name,
    date,
    order.customerName,
    String(order.phone || "").trim(),
    order.address,
    // I-AN: Product 1-8 (Parent Code, SKU, Price, Qty)
    ...readyOrderProductColumns(order.items),
    // AO-AT
    Number(order.deliveryCharge),
    Number(order.advance),
    Number(order.discount),
    Number(order.totalAmount),
    order.note || "",
    status,
  ];
}
