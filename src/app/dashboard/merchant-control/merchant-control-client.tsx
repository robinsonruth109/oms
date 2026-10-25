"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Building2,
  CircleDollarSign,
  Eye,
  EyeOff,
  KeyRound,
  PackageCheck,
  Pencil,
  Save,
  Truck,
  WalletCards,
  X,
} from "lucide-react";

import {
  allocateOmsStockToMerchant,
  assignMerchantCouriers,
  createMerchant,
  rechargeMerchantDollar,
  saveMerchantOperatingCost,
  updateMerchant,
} from "./actions";

type Merchant = {
  id: string;
  name: string;
  phone: string;
  address: string;
  status: boolean;
  username: string;
  loginEnabled: boolean;
  courierIds: string[];
  courierNames: string[];
  parentCount: number;
  parentCodes: string[];
  recentRecharges: {
    id: string;
    date: string;
    usd: number;
    bdt: number;
    rate: number;
  }[];
  recentOperatingCosts: {
    id: string;
    month: string;
    amount: number;
  }[];
  recentOmsPurchases: {
    id: string;
    date: string;
    sku: string;
    name: string;
    quantity: number;
    physicalUnits: number;
    totalCost: number;
  }[];
};

type Courier = {
  id: string;
  name: string;
  pathaoEnabled: boolean;
};

type Parent = {
  id: string;
  sku: string;
  name: string;
  merchantId: string | null;
  stockMode: string;
  stockQuantity: number;
  omsOwnedStockQuantity: number;
  purchasePrice: number;
};

type Product = {
  id: string;
  sku: string;
  name: string;
  parentId: string;
  parentSku: string;
  merchantId: string | null;
  stockMode: string;
  quantity: number;
  parentQuantity: number;
  omsOwnedStockQuantity: number;
  parentOmsOwnedStockQuantity: number;
  unitsPerSale: number;
  purchasePrice: number;
  parentPurchasePrice: number;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthNow() {
  return new Date().toISOString().slice(0, 7);
}

function money(value: number) {
  return "Tk " + Number(value || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function Panel({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: typeof Building2;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-slate-100 p-2.5">
          <Icon className="h-5 w-5 text-slate-700" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function MerchantControlClient({
  merchants,
  couriers,
  parents,
  products,
}: {
  merchants: Merchant[];
  couriers: Courier[];
  parents: Parent[];
  products: Product[];
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [credentials, setCredentials] = useState<{
    username: string;
    temporaryPassword: string;
  } | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const [courierMerchantId, setCourierMerchantId] = useState(
    merchants[0]?.id || ""
  );
  const selectedMerchant = merchants.find(
    (merchant) => merchant.id === courierMerchantId
  );
  const [courierIds, setCourierIds] = useState<string[]>(
    selectedMerchant?.courierIds || []
  );

  const [rechargeMerchantId, setRechargeMerchantId] = useState(
    merchants[0]?.id || ""
  );
  const [rechargeDate, setRechargeDate] = useState(today());
  const [rechargeUsd, setRechargeUsd] = useState(0);
  const [rechargeBdt, setRechargeBdt] = useState(0);
  const [rechargeNote, setRechargeNote] = useState("");

  const [costMerchantId, setCostMerchantId] = useState(merchants[0]?.id || "");
  const [costMonth, setCostMonth] = useState(monthNow());
  const [costAmount, setCostAmount] = useState(0);
  const [costNote, setCostNote] = useState("");

  const [buyMerchantId, setBuyMerchantId] = useState(merchants[0]?.id || "");
  const [buyProductQuery, setBuyProductQuery] = useState("");
  const [buyProductId, setBuyProductId] = useState("");
  const [buyDate, setBuyDate] = useState(today());
  const [buyQty, setBuyQty] = useState(1);
  const [buyNote, setBuyNote] = useState("");

  const [editingMerchantId, setEditingMerchantId] = useState("");
  const editingMerchant = merchants.find(
    (merchant) => merchant.id === editingMerchantId
  );
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editPasswordConfirm, setEditPasswordConfirm] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editError, setEditError] = useState("");

  function openMerchantEditor(merchant: Merchant) {
    setEditingMerchantId(merchant.id);
    setEditName(merchant.name);
    setEditPhone(merchant.phone);
    setEditAddress(merchant.address);
    setEditPassword("");
    setEditPasswordConfirm("");
    setShowEditPassword(false);
    setEditError("");
  }

  function closeMerchantEditor() {
    if (pending) return;
    setEditingMerchantId("");
    setEditPassword("");
    setEditPasswordConfirm("");
    setEditError("");
  }

  const filteredBuyProducts = useMemo(() => {
    const q = buyProductQuery.toLowerCase().trim();
    return products
      .filter(
        (product) =>
          !q ||
          (
            product.sku +
            " " +
            product.name +
            " " +
            product.parentSku
          )
            .toLowerCase()
            .includes(q)
      )
      .slice(0, 30);
  }, [products, buyMerchantId, buyProductQuery]);

  const buyProduct = products.find((product) => product.id === buyProductId);
  const buyAvailable = buyProduct
    ? buyProduct.stockMode === "PARENT_STOCK"
      ? Math.max(0, buyProduct.parentQuantity)
      : Math.max(0, buyProduct.quantity)
    : 0;
  const buyUnitsPerSale =
    buyProduct?.stockMode === "PARENT_STOCK"
      ? Math.max(1, buyProduct.unitsPerSale)
      : 1;
  const buyUnitCost = buyProduct
    ? buyProduct.stockMode === "PARENT_STOCK"
      ? buyProduct.parentPurchasePrice
      : buyProduct.purchasePrice
    : 0;
  const buyPhysicalUnits = Math.max(0, buyQty) * buyUnitsPerSale;
  const buyTotal = buyPhysicalUnits * buyUnitCost;

  const rechargeRate =
    rechargeUsd > 0 && rechargeBdt > 0 ? rechargeBdt / rechargeUsd : 0;

  function run(action: () => Promise<{ success: boolean; message: string }>) {
    setMessage("");
    startTransition(async () => {
      const result = await action();
      setMessage(result.message);
      if (result.success) window.location.reload();
    });
  }

  return (
    <div className="space-y-6">
      {message ? (
        <div className="rounded-2xl border bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
          {message}
        </div>
      ) : null}

      {credentials ? (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="font-bold text-emerald-900">
            Merchant login created — save these credentials now
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-white p-3">
              <p className="text-xs text-slate-500">Username</p>
              <p className="mt-1 font-mono font-bold text-slate-950">
                {credentials.username}
              </p>
            </div>
            <div className="rounded-xl bg-white p-3">
              <p className="text-xs text-slate-500">Temporary password</p>
              <p className="mt-1 font-mono font-bold text-slate-950">
                {credentials.temporaryPassword}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel
          title="Create Merchant"
          description="Name, phone and address create the Merchant plus a restricted Merchant login."
          icon={Building2}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Merchant name"
              className="rounded-xl border px-3 py-2.5 text-sm"
            />
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Phone number"
              className="rounded-xl border px-3 py-2.5 text-sm"
            />
            <textarea
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Address"
              className="min-h-24 rounded-xl border px-3 py-2.5 text-sm sm:col-span-2"
            />
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setMessage("");
              setCredentials(null);
              startTransition(async () => {
                const result = await createMerchant({ name, phone, address });
                setMessage(result.message);
                if (
                  result.success &&
                  result.username &&
                  result.temporaryPassword
                ) {
                  setCredentials({
                    username: result.username,
                    temporaryPassword: result.temporaryPassword,
                  });
                  setName("");
                  setPhone("");
                  setAddress("");
                }
              });
            }}
            className="mt-4 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Create Merchant
          </button>
        </Panel>

        <Panel
          title="Assign Couriers"
          description="Control which Pathao/courier accounts this Merchant is allowed to report against."
          icon={Truck}
        >
          <select
            value={courierMerchantId}
            onChange={(event) => {
              const merchantId = event.target.value;
              setCourierMerchantId(merchantId);
              setCourierIds(
                merchants.find((merchant) => merchant.id === merchantId)
                  ?.courierIds || []
              );
            }}
            className="w-full rounded-xl border px-3 py-2.5 text-sm"
          >
            <option value="">Select Merchant</option>
            {merchants.map((merchant) => (
              <option key={merchant.id} value={merchant.id}>
                {merchant.name}
              </option>
            ))}
          </select>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {couriers.map((courier) => (
              <label
                key={courier.id}
                className="flex items-center gap-2 rounded-xl border p-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={courierIds.includes(courier.id)}
                  onChange={(event) => {
                    setCourierIds((current) =>
                      event.target.checked
                        ? Array.from(new Set([...current, courier.id]))
                        : current.filter((id) => id !== courier.id)
                    );
                  }}
                />
                <span>
                  {courier.name}
                  {courier.pathaoEnabled ? (
                    <span className="ml-1 text-xs text-emerald-600">
                      Pathao
                    </span>
                  ) : null}
                </span>
              </label>
            ))}
          </div>

          <button
            type="button"
            disabled={pending || !courierMerchantId}
            onClick={() =>
              run(() =>
                assignMerchantCouriers({
                  merchantId: courierMerchantId,
                  courierIds,
                })
              )
            }
            className="mt-4 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Save Courier Access
          </button>
        </Panel>
      </div>

      <section className="rounded-3xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-950 shadow-sm">
        <div className="flex items-start gap-3">
          <PackageCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h2 className="text-lg font-bold">OMS is the Product Master Owner</h2>
            <p className="mt-1">
              Products are no longer transferred by changing Product Parent ownership.
              Use the stock allocation section below to move a specific quantity from OMS
              inventory to a Merchant. Each allocation creates a buying-cost receipt.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel
          title="Dollar Recharge"
          description="Enter USD received and total BDT price. Dollar rate is calculated automatically."
          icon={WalletCards}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={rechargeMerchantId}
              onChange={(event) => setRechargeMerchantId(event.target.value)}
              className="rounded-xl border px-3 py-2.5 text-sm sm:col-span-2"
            >
              <option value="">Select Merchant</option>
              {merchants.map((merchant) => (
                <option key={merchant.id} value={merchant.id}>
                  {merchant.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={rechargeDate}
              onChange={(event) => setRechargeDate(event.target.value)}
              className="rounded-xl border px-3 py-2.5 text-sm"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={rechargeUsd}
              onChange={(event) => setRechargeUsd(Number(event.target.value))}
              placeholder="USD amount"
              className="rounded-xl border px-3 py-2.5 text-sm"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={rechargeBdt}
              onChange={(event) => setRechargeBdt(Number(event.target.value))}
              placeholder="Total price BDT"
              className="rounded-xl border px-3 py-2.5 text-sm"
            />
            <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700">
              Rate: {rechargeRate ? money(rechargeRate) + " / USD" : "—"}
            </div>
            <input
              value={rechargeNote}
              onChange={(event) => setRechargeNote(event.target.value)}
              placeholder="Note"
              className="rounded-xl border px-3 py-2.5 text-sm sm:col-span-2"
            />
          </div>
          <button
            type="button"
            disabled={pending || !rechargeMerchantId}
            onClick={() =>
              run(() =>
                rechargeMerchantDollar({
                  merchantId: rechargeMerchantId,
                  rechargeDate,
                  usdAmount: rechargeUsd,
                  bdtAmount: rechargeBdt,
                  note: rechargeNote,
                })
              )
            }
            className="mt-4 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Recharge Dollar
          </button>
        </Panel>

        <Panel
          title="Monthly Operating Cost"
          description="One full-month operating cost per Merchant. Saving the same month updates it."
          icon={CircleDollarSign}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={costMerchantId}
              onChange={(event) => setCostMerchantId(event.target.value)}
              className="rounded-xl border px-3 py-2.5 text-sm sm:col-span-2"
            >
              <option value="">Select Merchant</option>
              {merchants.map((merchant) => (
                <option key={merchant.id} value={merchant.id}>
                  {merchant.name}
                </option>
              ))}
            </select>
            <input
              type="month"
              value={costMonth}
              onChange={(event) => setCostMonth(event.target.value)}
              className="rounded-xl border px-3 py-2.5 text-sm"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={costAmount}
              onChange={(event) => setCostAmount(Number(event.target.value))}
              placeholder="Operating cost BDT"
              className="rounded-xl border px-3 py-2.5 text-sm"
            />
            <input
              value={costNote}
              onChange={(event) => setCostNote(event.target.value)}
              placeholder="Note"
              className="rounded-xl border px-3 py-2.5 text-sm sm:col-span-2"
            />
          </div>
          <button
            type="button"
            disabled={pending || !costMerchantId}
            onClick={() =>
              run(() =>
                saveMerchantOperatingCost({
                  merchantId: costMerchantId,
                  month: costMonth,
                  amount: costAmount,
                  note: costNote,
                })
              )
            }
            className="mt-4 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Save Monthly Cost
          </button>
        </Panel>
      </div>

      <Panel
        title="OMS Buy Merchant Product"
        description="Reserve Merchant-owned physical stock for OMS at the current buying price. The physical Product Master total is not double-counted."
        icon={PackageCheck}
      >
        <div className="grid gap-3 xl:grid-cols-4">
          <select
            value={buyMerchantId}
            onChange={(event) => {
              setBuyMerchantId(event.target.value);
              setBuyProductId("");
              setBuyProductQuery("");
            }}
            className="rounded-xl border px-3 py-2.5 text-sm"
          >
            <option value="">Select Merchant</option>
            {merchants.map((merchant) => (
              <option key={merchant.id} value={merchant.id}>
                {merchant.name}
              </option>
            ))}
          </select>

          <div className="xl:col-span-2">
            <input
              value={buyProductQuery}
              onChange={(event) => {
                setBuyProductQuery(event.target.value);
                setBuyProductId("");
              }}
              placeholder="Search OMS SKU / Parent Code / product name"
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
            />
            {buyProductQuery && !buyProductId ? (
              <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border bg-white">
                {filteredBuyProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => {
                      setBuyProductId(product.id);
                      setBuyProductQuery(
                        product.sku + " - " + product.name
                      );
                    }}
                    className="block w-full border-b px-3 py-2.5 text-left last:border-0 hover:bg-slate-50"
                  >
                    <span className="font-semibold">{product.sku}</span>
                    <span className="ml-2 text-xs text-slate-500">
                      Parent {product.parentSku}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <input
            type="date"
            value={buyDate}
            onChange={(event) => setBuyDate(event.target.value)}
            className="rounded-xl border px-3 py-2.5 text-sm"
          />

          <input
            type="number"
            min="1"
            step="1"
            value={buyQty}
            onChange={(event) => setBuyQty(Number(event.target.value))}
            placeholder="Sale quantity"
            className="rounded-xl border px-3 py-2.5 text-sm"
          />

          <input
            value={buyNote}
            onChange={(event) => setBuyNote(event.target.value)}
            placeholder="Note"
            className="rounded-xl border px-3 py-2.5 text-sm xl:col-span-2"
          />

          <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700 xl:col-span-4">
            {buyProduct ? (
              <div className="grid gap-2 sm:grid-cols-4">
                <span>
                  OMS available: <strong>{buyAvailable}</strong> physical units
                </span>
                <span>
                  Units / sale: <strong>{buyUnitsPerSale}</strong>
                </span>
                <span>
                  Buying price: <strong>{money(buyUnitCost)}</strong>
                </span>
                <span>
                  Receipt value: <strong>{money(buyTotal)}</strong>
                </span>
              </div>
            ) : (
              "Select an OMS product to see available stock and receipt value."
            )}
          </div>
        </div>

        <button
          type="button"
          disabled={
            pending ||
            !buyMerchantId ||
            !buyProductId ||
            buyQty <= 0 ||
            buyPhysicalUnits > buyAvailable
          }
          onClick={() =>
            run(() =>
              allocateOmsStockToMerchant({
                merchantId: buyMerchantId,
                productId: buyProductId,
                allocationDate: buyDate,
                quantity: buyQty,
                note: buyNote,
              })
            )
          }
          className="mt-4 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Allocate Stock & Create Receipt
        </button>
      </Panel>

      <section className="rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-bold text-slate-950">
            Merchant Directory
          </h2>
        </div>
        <div className="grid gap-4 p-5 xl:grid-cols-2">
          {merchants.map((merchant) => (
            <div key={merchant.id} className="rounded-2xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-950">{merchant.name}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {merchant.phone} · @{merchant.username}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {merchant.address}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openMerchantEditor(merchant)}
                    className="inline-flex items-center gap-1.5 rounded-xl border bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    View / Edit
                  </button>
                  <span
                    className={
                      "rounded-full px-2.5 py-1 text-xs font-semibold " +
                      (merchant.status && merchant.loginEnabled
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-600")
                    }
                  >
                    {merchant.status && merchant.loginEnabled
                      ? "ACTIVE"
                      : "INACTIVE"}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Allocated Products</p>
                  <p className="mt-1 font-bold">{merchant.parentCount}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Couriers</p>
                  <p className="mt-1 font-bold">
                    {merchant.courierNames.join(", ") || "None"}
                  </p>
                </div>
              </div>

              {merchant.parentCodes.length ? (
                <p className="mt-3 text-xs text-slate-500">
                  Allocated: {merchant.parentCodes.join(", ")}
                  {merchant.parentCount > merchant.parentCodes.length
                    ? " …"
                    : ""}
                </p>
              ) : null}

              {merchant.recentOmsPurchases.length ? (
                <div className="mt-4 border-t pt-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Recent Stock Allocations
                  </p>
                  <div className="mt-2 space-y-1 text-xs text-slate-600">
                    {merchant.recentOmsPurchases.slice(0, 3).map((row) => (
                      <p key={row.id}>
                        {row.sku} · {row.quantity} sale qty ·{" "}
                        {money(row.totalCost)}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}

          {!merchants.length ? (
            <p className="text-sm text-slate-500">
              No Merchants created yet.
            </p>
          ) : null}
        </div>
      </section>

      {editingMerchant ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeMerchantEditor();
          }}
        >
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-white px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  Merchant Account
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  View / Edit {editingMerchant.name}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Update Merchant profile details or set a new login password.
                </p>
              </div>
              <button
                type="button"
                onClick={closeMerchantEditor}
                disabled={pending}
                className="rounded-xl border p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                aria-label="Close Merchant editor"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 p-5 sm:p-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Login Username
                  </p>
                  <p className="mt-1 break-all font-mono font-bold text-slate-950">
                    {editingMerchant.username || "—"}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Allocated Products
                  </p>
                  <p className="mt-1 text-xl font-bold text-slate-950">
                    {editingMerchant.parentCount}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Couriers
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-950">
                    {editingMerchant.courierNames.join(", ") || "None"}
                  </p>
                </div>
              </div>

              <section className="rounded-2xl border p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <Pencil className="h-4 w-4 text-slate-600" />
                  <h3 className="font-bold text-slate-950">Merchant Profile</h3>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium text-slate-700">
                    Merchant Name
                    <input
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                    />
                  </label>

                  <label className="text-sm font-medium text-slate-700">
                    Phone Number
                    <input
                      value={editPhone}
                      onChange={(event) => setEditPhone(event.target.value)}
                      className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                    />
                  </label>

                  <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                    Address
                    <textarea
                      value={editAddress}
                      onChange={(event) => setEditAddress(event.target.value)}
                      rows={3}
                      className="mt-1.5 w-full resize-y rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                    />
                  </label>
                </div>

                <p className="mt-3 text-xs leading-5 text-slate-400">
                  Changing the phone number updates the Merchant contact number.
                  The existing login username remains unchanged so the Merchant
                  is not unexpectedly locked out.
                </p>
              </section>

              <section className="rounded-2xl border p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-slate-600" />
                  <h3 className="font-bold text-slate-950">Change Password</h3>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Leave both password fields blank if you only want to update
                  the Merchant profile.
                </p>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium text-slate-700">
                    New Password
                    <div className="relative mt-1.5">
                      <input
                        type={showEditPassword ? "text" : "password"}
                        value={editPassword}
                        onChange={(event) => setEditPassword(event.target.value)}
                        placeholder="Minimum 8 characters"
                        autoComplete="new-password"
                        className="w-full rounded-xl border px-3 py-2.5 pr-11 text-sm outline-none focus:border-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEditPassword((value) => !value)}
                        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-700"
                        aria-label={showEditPassword ? "Hide password" : "Show password"}
                      >
                        {showEditPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </label>

                  <label className="text-sm font-medium text-slate-700">
                    Confirm New Password
                    <input
                      type={showEditPassword ? "text" : "password"}
                      value={editPasswordConfirm}
                      onChange={(event) =>
                        setEditPasswordConfirm(event.target.value)
                      }
                      placeholder="Repeat new password"
                      autoComplete="new-password"
                      className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                    />
                  </label>
                </div>
              </section>

              {editingMerchant.parentCodes.length ? (
                <section className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Assigned Parent Codes
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {editingMerchant.parentCodes.map((code) => (
                      <span
                        key={code}
                        className="rounded-lg border bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
                      >
                        {code}
                      </span>
                    ))}
                    {editingMerchant.parentCount >
                    editingMerchant.parentCodes.length ? (
                      <span className="rounded-lg border bg-white px-2.5 py-1 text-xs font-semibold text-slate-500">
                        +
                        {editingMerchant.parentCount -
                          editingMerchant.parentCodes.length}{" "}
                        more
                      </span>
                    ) : null}
                  </div>
                </section>
              ) : null}

              {editError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                  {editError}
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeMerchantEditor}
                  disabled={pending}
                  className="rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setEditError("");

                    if (!editName.trim() || !editPhone.trim() || !editAddress.trim()) {
                      setEditError("Name, phone number and address are required.");
                      return;
                    }

                    if (editPassword && editPassword.length < 8) {
                      setEditError("New password must be at least 8 characters.");
                      return;
                    }

                    if (editPassword !== editPasswordConfirm) {
                      setEditError("New password and confirmation do not match.");
                      return;
                    }

                    startTransition(async () => {
                      const result = await updateMerchant({
                        merchantId: editingMerchant.id,
                        name: editName,
                        phone: editPhone,
                        address: editAddress,
                        newPassword: editPassword || undefined,
                      });

                      if (!result.success) {
                        setEditError(result.message);
                        return;
                      }

                      setMessage(result.message);
                      window.location.reload();
                    });
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {pending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
