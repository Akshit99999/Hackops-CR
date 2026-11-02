"use client";
import { useEffect, useState } from "react";
import {
  Plus,
  Search,
  ArrowUpRight,
  Archive,
  Clock3,
  Wallet,
  FileCheck2,
  Paperclip,
} from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { coverage, currency } from "@/lib/utils";
import { Badge, Loading, PageHeading, EmptyState } from "@/components/ui";
import { ProductArt } from "@/components/visualizers/ProductArt";
import { ProductForm } from "@/components/warranty/ProductForm";
import { ProductPassport } from "@/components/warranty/ProductPassport";
import { ClaimWizard } from "@/components/warranty/ClaimWizard";

export default function WarrantyVault() {
  const { data, ready } = useWorkspace();
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [claimId, setClaimId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All purchases");
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("item")) setSelectedId(query.get("item"));
    if (query.get("new")) setCreating(true);
  }, []);
  const selected = data.warranties.find((item) => item.id === selectedId);
  const claiming = data.warranties.find((item) => item.id === claimId);
  if (!ready) return <Loading />;
  const active = data.warranties.filter((item) => coverage(item).days > 0);
  const expiring = data.warranties.filter(
    (item) => coverage(item).days > 0 && coverage(item).days <= 30,
  );
  const documented = data.warranties.filter(
    (item) => item.documents.length > 0,
  ).length;
  const visible = data.warranties.filter(
    (item) =>
      (filter === "All purchases" ||
        (filter === "Expiring soon"
          ? coverage(item).status === "Expiring soon"
          : filter === "Expired"
            ? coverage(item).status === "Expired"
            : item.category === filter)) &&
      `${item.name} ${item.brand} ${item.serialNumber}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div>
      <PageHeading
        eyebrow="THE IMPORTANT BITS, ALL TOGETHER"
        title="Keep a little peace of mind."
        description="Your purchases and paperwork. A home for everything worth keeping."
        action={
          <button
            className="button button-primary"
            onClick={() => setCreating(true)}
          >
            <Plus size={16} /> Add purchase
          </button>
        }
      />
      <div className="metrics-grid">
        <VaultMetric
          label="Protected purchases"
          value={String(active.length).padStart(2, "0")}
          detail="With recorded coverage remaining"
          icon={<Archive size={18} />}
        />
        <VaultMetric
          label="Expiring soon"
          value={String(expiring.length).padStart(2, "0")}
          detail="Within the next 30 days"
          icon={<Clock3 size={18} />}
          warm
        />
        <VaultMetric
          label="Protected purchase value"
          value={currency(
            active.reduce((sum, item) => sum + item.purchasePrice, 0),
          )}
          detail="Based on the price you recorded"
          icon={<Wallet size={18} />}
        />
        <VaultMetric
          label="Paperwork attached"
          value={`${documented}/${data.warranties.length}`}
          detail="Purchases with a document saved"
          icon={<FileCheck2 size={18} />}
        />
      </div>
      <div className="vault-toolbar">
        <div className="preset-buttons">
          {[
            "All purchases",
            "Audio",
            "Computing",
            "Home",
            "Expiring soon",
            "Expired",
          ].map((value) => (
            <button
              key={value}
              className={`chip ${filter === value ? "selected" : ""}`}
              onClick={() => setFilter(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <label className="search-input">
          <Search size={16} />
          <input
            aria-label="Search purchases"
            placeholder="Find a purchase…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>
      {visible.length ? (
        <div className="product-grid">
          {visible.map((item) => {
            const state = coverage(item);
            return (
              <button
                className="product-card"
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                aria-label={`Open passport for ${item.name}`}
              >
                <ProductArt category={item.category} />
                <div className="product-card-body">
                  <div className="product-brand-row">
                    <span>{item.brand}</span>
                    <span>
                      {item.sample
                        ? "SAMPLE PURCHASE"
                        : item.category.toUpperCase()}
                    </span>
                  </div>
                  <h3>{item.name}</h3>
                  <p className="product-model mono">
                    {item.modelNumber || "Model not recorded"}
                  </p>
                  <div className="product-coverage">
                    <Badge
                      tone={
                        state.status === "Protected"
                          ? "green"
                          : state.status === "Expired"
                            ? "red"
                            : "amber"
                      }
                    >
                      {state.status}
                    </Badge>
                    <small>{state.days} days left</small>
                  </div>
                  <div
                    className={`coverage-bar ${state.days <= 30 ? "warning" : ""}`}
                  >
                    <span style={{ width: `${state.percent}%` }} />
                  </div>
                  <div className="product-card-footer">
                    <span>
                      <Paperclip size={12} />
                      {item.documents.length
                        ? `${item.documents.length} document(s)`
                        : "Add your paperwork"}
                    </span>
                    <ArrowUpRight size={16} />
                  </div>
                </div>
              </button>
            );
          })}
          <button
            className="add-product-card"
            onClick={() => setCreating(true)}
          >
            <span>
              <Plus size={21} />
            </span>
            <strong>Room for one more.</strong>
            <p>Add your next purchase to the vault.</p>
          </button>
        </div>
      ) : (
        <div className="panel">
          <EmptyState
            title={
              search || filter !== "All purchases"
                ? "Nothing here just yet."
                : "Start with your first purchase."
            }
            description={
              search || filter !== "All purchases"
                ? "Try another category or search term."
                : "Keep the details together before you need them."
            }
            action={
              <button
                className="button button-primary"
                onClick={() => setCreating(true)}
              >
                Add a purchase <Plus size={15} />
              </button>
            }
          />
        </div>
      )}
      <div className="feature-note">
        <Archive size={18} />
        <div>
          <strong>A local home for your records.</strong>
          <p>
            Details and documents stay in this browser. Recorded dates are
            reminders, rather than verification of warranty coverage.
          </p>
        </div>
      </div>
      {creating && <ProductForm onClose={() => setCreating(false)} />}
      {selected && (
        <ProductPassport
          item={selected}
          onClose={() => setSelectedId(null)}
          onClaim={() => {
            setClaimId(selected.id);
            setSelectedId(null);
          }}
        />
      )}
      {claiming && (
        <ClaimWizard item={claiming} onClose={() => setClaimId(null)} />
      )}
    </div>
  );
}
function VaultMetric({
  label,
  value,
  detail,
  icon,
  warm,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  warm?: boolean;
}) {
  return (
    <div className={`metric-card ${warm ? "metric-warm" : ""}`}>
      <div className="metric-label">
        {label}
        <span>{icon}</span>
      </div>
      <div className="metric-value">{value}</div>
      <p>{detail}</p>
    </div>
  );
}
