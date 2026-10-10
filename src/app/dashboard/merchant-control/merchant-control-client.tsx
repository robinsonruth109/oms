"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Building2,
  CircleDollarSign,
  PackageCheck,
  Truck,
  WalletCards,
} from "lucide-react";

import {
  assignMerchantCouriers,
  assignProductParentToMerchant,
  createMerchant,
  omsBuyMerchantProduct,
  rechargeMerchantDollar,
  saveMerchantOperatingCost,
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

  const [parentQuery, setParentQuery] = useState("");
  const [parentId, setParentId] = useState("");
  const [parentMerchantId, setParentMerchantId] = useState("");

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

  const filteredParents = useMemo(() => {
    const q = parentQuery.toLowerCase().trim();
    if (!q) return parents.slice(0, 30);
    return parents
      .filter((parent) =>
        (parent.sku + " " + parent.name).toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [parents, parentQuery]);

  const filteredBuyProducts = useMemo(() => {
    const q = buyProductQuery.toLowerCase().trim();
    return products
      .filter((product) => product.merchantId === buyMerchantId)
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
      ? Math.max(
          0,
          buyProduct.parentQuantity - buyProduct.parentOmsOwnedStockQuantity
        )
      : Math.max(0, buyProduct.quantity - buyProduct.omsOwnedStockQuantity)
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

      <Panel
        title="Product Parent Ownership"
        description="Search a Parent Code and assign it to a Merchant. Selecting Default OMS removes Merchant ownership."
        icon={PackageCheck}
      >
        <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_auto]">
          <div>
            <input
              value={parentQuery}
              onChange={(event) => {
                setParentQuery(event.target.value);
                setParentId("");
              }}
              placeholder="Search Parent SKU or product name"
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
            />
            {parentQuery ? (
              <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border bg-white">
                {filteredParents.map((parent) => {
                  const owner = parent.merchantId
                    ? merchants.find(
                        (merchant) => merchant.id === parent.merchantId
                      )?.name || "Merchant"
                    : "OMS";
                  return (
                    <button
                      key={parent.id}
                      type="button"
                      onClick={() => {
                        setParentId(parent.id);
                        setParentQuery(parent.sku + " - " + parent.name);
                        setParentMerchantId(parent.merchantId || "");
                      }}
                      className="block w-full border-b px-3 py-2.5 text-left last:border-0 hover:bg-slate-50"
                    >
                      <span className="font-semibold text-slate-900">
                        {parent.sku}
                      </span>
                      <span className="ml-2 text-xs text-slate-500">
                        {parent.name} · Owner: {owner}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <select
            value={parentMerchantId}
            onChange={(event) => setParentMerchantId(event.target.value)}
            className="rounded-xl border px-3 py-2.5 text-sm"
          >
            <option value="">Default OMS</option>
            {merchants.map((merchant) => (
              <option key={merchant.id} value={merchant.id}>
                {merchant.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={pending || !parentId}
            onClick={() =>
              run(() =>
                assignProductParentToMerchant({
                  parentId,
                  merchantId: parentMerchantId || undefined,
                })
              )
            }
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Assign
          </button>
        </div>
      </Panel>

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
              placeholder="Search Merchant SKU / Parent Code"
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
                  Merchant available: <strong>{buyAvailable}</strong> physical
                  units
                </span>
                <span>
                  Units / sale: <strong>{buyUnitsPerSale}</strong>
                </span>
                <span>
                  Buying price: <strong>{money(buyUnitCost)}</strong>
                </span>
                <span>
                  OMS payable: <strong>{money(buyTotal)}</strong>
                </span>
              </div>
            ) : (
              "Select a Merchant product to see stock and payable value."
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
              omsBuyMerchantProduct({
                merchantId: buyMerchantId,
                productId: buyProductId,
                purchaseDate: buyDate,
                quantity: buyQty,
                note: buyNote,
              })
            )
          }
          className="mt-4 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Confirm OMS Purchase
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

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Product Parents</p>
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
                  Parents: {merchant.parentCodes.join(", ")}
                  {merchant.parentCount > merchant.parentCodes.length
                    ? " …"
                    : ""}
                </p>
              ) : null}

              {merchant.recentOmsPurchases.length ? (
                <div className="mt-4 border-t pt-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Recent OMS purchases
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
    </div>
  );
}
