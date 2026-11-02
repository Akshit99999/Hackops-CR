"use client";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Modal } from "@/components/ui";
import { useWorkspace } from "@/lib/workspace";
import { today, expiryDate } from "@/lib/utils";
import type { WarrantyItem } from "@/lib/types";

export function ProductForm({
  onClose,
  initialName = "",
  initialBrand = "",
}: {
  onClose: () => void;
  initialName?: string;
  initialBrand?: string;
}) {
  const { addWarranty, notify } = useWorkspace();
  const [error, setError] = useState("");
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const purchaseDate = String(form.get("purchaseDate"));
    if (purchaseDate > today()) {
      setError("The purchase date can’t be in the future.");
      return;
    }
    addWarranty({
      id: `WV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      name: String(form.get("name")).trim(),
      brand: String(form.get("brand")).trim(),
      category: String(form.get("category")) as WarrantyItem["category"],
      modelNumber: String(form.get("modelNumber")).trim(),
      serialNumber: String(form.get("serialNumber")).trim(),
      seller: String(form.get("seller")).trim(),
      purchaseDate,
      purchasePrice: Number(form.get("purchasePrice")),
      warrantyDurationMonths: Number(form.get("months")),
      expiryDate: expiryDate(purchaseDate, Number(form.get("months"))),
      documents: [],
    });
    notify(
      "A new purchase, all in one place. Open its passport to add a receipt.",
    );
    onClose();
  }
  return (
    <Modal
      title="A home for your new purchase."
      description="Keep the essentials close. You can attach the receipt in its product passport."
      onClose={onClose}
      wide
    >
      <form className="form-stack" onSubmit={submit}>
        <div className="form-grid">
          <label className="field">
            Product name
            <input
              name="name"
              required
              minLength={2}
              maxLength={200}
              defaultValue={initialName}
              placeholder="e.g. Studio Headphones Pro"
            />
          </label>
          <label className="field">
            Brand
            <input
              name="brand"
              required
              minLength={1}
              maxLength={100}
              defaultValue={initialBrand}
              placeholder="Who made it?"
            />
          </label>
          <label className="field">
            Category
            <select name="category">
              <option>Audio</option>
              <option>Computing</option>
              <option>Home</option>
              <option>Other</option>
            </select>
          </label>
          <label className="field">
            Purchased from
            <input
              name="seller"
              required
              minLength={2}
              maxLength={150}
              placeholder="Store or retailer"
            />
          </label>
          <label className="field">
            Model number (optional)
            <input
              name="modelNumber"
              maxLength={100}
              placeholder="Find this on the label"
            />
          </label>
          <label className="field">
            Serial number (optional)
            <input
              name="serialNumber"
              maxLength={100}
              placeholder="Your product’s unique identifier"
            />
          </label>
          <label className="field">
            Purchase date
            <input
              name="purchaseDate"
              type="date"
              required
              max={today()}
              defaultValue={today()}
            />
          </label>
          <label className="field">
            Purchase price (USD)
            <input
              name="purchasePrice"
              type="number"
              min="0.01"
              max="10000000"
              step="0.01"
              required
              placeholder="0.00"
            />
          </label>
          <label className="field">
            Warranty duration (months)
            <input
              name="months"
              type="number"
              min="1"
              max="240"
              step="1"
              defaultValue={12}
              required
            />
            <small>Use the duration stated in your warranty.</small>
          </label>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <span className="form-note">
            Saved in this browser. Coverage dates are based on the details you
            enter.
          </span>
          <button className="button button-primary" type="submit">
            Add to my vault <ArrowUpRight size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
