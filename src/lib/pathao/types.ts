export type PathaoEnvironmentValue = "SANDBOX" | "LIVE";

export type PathaoCredentials = {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
};

export type PathaoTokenBundle = {
  accessToken: string;
  refreshToken: string;
};

export type PathaoStore = {
  store_id: number | string;
  store_name?: string | null;
  store_address?: string | null;
  is_active?: number | boolean | null;
  is_default_store?: number | boolean | null;
};

export type PathaoOrderPayload = {
  store_id: number;
  merchant_order_id: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  delivery_type: 48 | 12;
  item_type: 1 | 2;
  special_instruction?: string;
  item_quantity: number;
  item_weight: number;
  item_description?: string;
  amount_to_collect: number;
};

export type PathaoBulkResponse = {
  message?: string;
  type?: string;
  code?: number;
  data?: boolean;
};

export type PathaoOrderInfo = {
  consignment_id?: string;
  merchant_order_id?: string | null;
  order_status?: string | null;
  order_status_slug?: string | null;
  updated_at?: string | null;
  invoice_id?: string | null;
  amount_to_collect?: number | string | null;
  amountToCollect?: number | string | null;
};

export type PreparedPathaoOrder = {
  orderId: string;
  invoiceId: string;
  payload: PathaoOrderPayload;
};
