"use client";

import { useState } from "react";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { today, offsetDate } from "@/lib/utils";
import { Modal } from "@/components/ui";
import type { WarrantyItem } from "@/lib/types";

export function CaseForm({
  onClose,
  product,
}: {
  onClose: () => void;
  product?: WarrantyItem;
}) {
  const { addCase, notify, data } = useWorkspace();
  const [selectedId, setSelectedId] = useState(product?.id || "");
  const [error, setError] = useState("");
  const [preset, setPreset] = useState("");
  const selected = data.warranties.find((item) => item.id === selectedId);
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const purchaseDate = String(form.get("purchaseDate"));
    const defectDate = String(form.get("defectDate"));
    if (purchaseDate > defectDate || defectDate > today()) {
      setError(
        "Check your dates: purchase should come before the issue, and neither should be in the future.",
      );
      return;
    }
    const narrative = String(form.get("narrative")).trim();
    if (narrative.length < 20) {
      setError(
        "Add a little more detail—at least 20 characters about what happened.",
      );
      return;
    }
    addCase({
      id: `CR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      consumerName: String(form.get("consumerName")).trim(),
      merchant: String(form.get("merchant")).trim(),
      product: String(form.get("product")).trim(),
      purchaseDate,
      defectDate,
      claimAmount: Number(form.get("claimAmount")),
      narrative,
      status: "Draft notice",
      createdDate: today(),
      deadline: null,
      documents: selected?.documents || [],
      sample: selected?.sample,
    });
    notify("Your case is ready to review. Nothing has been sent.");
    onClose();
  }
  return (
    <Modal
      title="Let’s make your case."
      description="Start with the facts. We’ll help you organize the next step."
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="form-stack">
        <div className="preset-buttons">
          {["Defective product", "Refund declined", "Warranty denied"].map(
            (value) => (
              <button
                key={value}
                type="button"
                className={`chip ${preset === value ? "selected" : ""}`}
                onClick={() => setPreset(value)}
              >
                {value}
              </button>
            ),
          )}
        </div>
        <label className="field">
          Import a purchase (optional)
          <select
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            <option value="">Start from scratch</option>
            {data.warranties.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
                {item.sample ? " (sample)" : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="form-grid" key={selectedId}>
          <label className="field">
            Your full name
            <input
              name="consumerName"
              required
              minLength={2}
              maxLength={150}
              placeholder="e.g. Alex Morgan"
            />
          </label>
          <label className="field">
            Merchant
            <input
              name="merchant"
              required
              minLength={2}
              maxLength={150}
              defaultValue={selected?.seller}
              placeholder="Where you purchased it"
            />
          </label>
          <label className="field">
            Product
            <input
              name="product"
              required
              minLength={2}
              maxLength={200}
              defaultValue={selected?.name}
              placeholder="Product name"
            />
          </label>
          <label className="field">
            Requested refund (USD)
            <input
              name="claimAmount"
              type="number"
              min="0.01"
              max="10000000"
              step="0.01"
              required
              defaultValue={selected?.purchasePrice}
              placeholder="0.00"
            />
          </label>
          <label className="field">
            Purchase date
            <input
              name="purchaseDate"
              type="date"
              required
              max={today()}
              defaultValue={selected?.purchaseDate || offsetDate(-30)}
            />
          </label>
          <label className="field">
            When did the issue occur?
            <input
              name="defectDate"
              type="date"
              required
              max={today()}
              defaultValue={today()}
            />
          </label>
        </div>
        <label className="field">
          What happened?
          <textarea
            name="narrative"
            key={preset}
            defaultValue={preset ? `${preset}: ` : ""}
            required
            minLength={20}
            maxLength={10000}
            rows={4}
            placeholder="Describe the issue, when it started, and what you’ve tried so far…"
          />
        </label>
        {selected && (
          <p className="inline-note">
            <ShieldCheck size={15} />
            {selected.documents.length} document(s) will be copied from your
            vault.
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <span className="form-note">
            A draft for your review. You choose when to send.
          </span>
          <button type="submit" className="button button-primary">
            Create draft <ArrowUpRight size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
