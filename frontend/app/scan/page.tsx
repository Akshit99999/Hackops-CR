"use client";
import { useState } from "react";
import {
  ScanLine,
  ShieldCheck,
  Scale,
  Wrench,
  Building2,
  ArrowUpRight,
  Plus,
  Info,
  Barcode,
} from "lucide-react";
import { PageHeading, Badge } from "@/components/ui";
import { BarcodeCamera } from "@/components/scanner/BarcodeCamera";
import { ProductArt } from "@/components/visualizers/ProductArt";
import { ProductForm } from "@/components/warranty/ProductForm";

const SAMPLE = "5901234123457";
function parseBarcode(raw: string) {
  let value = raw.trim();
  if (/^https:\/\//i.test(value)) {
    const match = value.match(/\/01\/(\d{14})(?:[/?#]|$)/);
    if (!match)
      throw new Error(
        "Enter a GS1 Digital Link containing /01/ followed by a 14-digit GTIN.",
      );
    value = match[1];
  }
  if (!/^\d+$/.test(value) || ![8, 12, 13, 14].includes(value.length))
    throw new Error("Enter a GTIN-8, UPC-A, EAN-13, or GTIN-14 barcode.");
  const sum = value
    .slice(0, -1)
    .split("")
    .reverse()
    .reduce(
      (total, digit, index) =>
        total + Number(digit) * (index % 2 === 0 ? 3 : 1),
      0,
    );
  if ((10 - (sum % 10)) % 10 !== Number(value.at(-1)))
    throw new Error(
      "That barcode’s check digit doesn’t match. Check the numbers and try again.",
    );
  return value;
}

export default function ScanPage() {
  const [barcode, setBarcode] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const sample = result === SAMPLE;
  function lookup(value: string) {
    setError("");
    try {
      const parsed = parseBarcode(value);
      setResult(parsed);
      setBarcode(parsed);
    } catch (error) {
      setResult(null);
      setError(error instanceof Error ? error.message : "Check your barcode.");
    }
  }
  return (
    <div>
      <PageHeading
        eyebrow="THERE’S MORE BEHIND THE LABEL"
        title="Look a little closer."
        description="A barcode is just the beginning. Know more about what you bring home."
      />
      <div className="preview-strip">
        <Info size={16} />
        Scanner preview: barcode validation and a fictional sample. Product
        databases, recalls, and scoring are not connected yet.
      </div>
      <div className="scanner-layout">
        <section className="panel scanner-panel">
          <h2>Meet your next purchase.</h2>
          <p>Use your camera or enter the numbers beneath the barcode.</p>
          <BarcodeCamera onDetected={lookup} />
          <form
            className="scanner-manual"
            onSubmit={(event) => {
              event.preventDefault();
              lookup(barcode);
            }}
          >
            <label className="field">
              Barcode or GS1 Digital Link
              <input
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                required
                maxLength={500}
                placeholder="e.g. 5901234123457"
              />
            </label>
            {error && (
              <p
                className="form-error"
                role="alert"
                style={{ marginBottom: 13 }}
              >
                {error}
              </p>
            )}
            <button type="submit" className="button button-primary">
              Look up product <ArrowUpRight size={16} />
            </button>
            <div className="scanner-example">
              Just looking around?
              <button type="button" onClick={() => lookup(SAMPLE)}>
                Try a sample scan
              </button>
            </div>
          </form>
        </section>
        <section className="panel scanner-result" aria-live="polite">
          {!result ? (
            <div className="result-empty">
              <span>
                <ScanLine size={36} strokeWidth={1.25} />
              </span>
              <h2>A little less guesswork.</h2>
              <p>
                Scan a barcode to see how product information will come together
                here.
              </p>
              <small>YOUR NEXT PURCHASE, WITH MORE CONTEXT.</small>
            </div>
          ) : (
            <>
              <div className="section-heading">
                <span className="eyebrow" style={{ marginBottom: 0 }}>
                  PRODUCT PASSPORT PREVIEW
                </span>
                <Badge tone={sample ? "amber" : "green"}>
                  {sample ? "Fictional sample" : "Valid barcode"}
                </Badge>
              </div>
              <div className="scan-product-header">
                {sample ? (
                  <ProductArt category="Audio" />
                ) : (
                  <span className="empty-icon">
                    <Barcode size={32} />
                  </span>
                )}
                <div>
                  <span className="eyebrow">
                    {sample
                      ? "SONORA · SAMPLE PRODUCT"
                      : "READY FOR A FUTURE LOOKUP"}
                  </span>
                  <h2>
                    {sample ? "Studio Headphones Pro" : "Barcode validated."}
                  </h2>
                  <p className="mono">{result}</p>
                </div>
              </div>
              {[
                {
                  icon: ShieldCheck,
                  title: "Safety recalls",
                  text: "CPSC and openFDA integrations planned",
                },
                {
                  icon: Scale,
                  title: "Package & value history",
                  text: "Historical weight and price data needed",
                },
                {
                  icon: Wrench,
                  title: "Repairability",
                  text: "Verified repair scores not yet connected",
                },
                {
                  icon: Building2,
                  title: "Corporate ownership",
                  text: "Ownership data not yet connected",
                },
              ].map(({ icon: Icon, title, text }) => (
                <div className="scan-data-row" key={title}>
                  <Icon size={18} />
                  <div>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                  <span>Not checked</span>
                </div>
              ))}
              <div className="scan-result-note">
                {sample
                  ? "This fictional product shows the planned scorecard layout. "
                  : "This preview checks barcode format and checksum only. "}
                No transparency score is assigned without source data.
              </div>
              <div className="scan-result-actions">
                <button
                  className="button button-primary"
                  onClick={() => setSaving(true)}
                >
                  <Plus size={15} /> Add purchase details
                </button>
                <button
                  className="button button-outline"
                  onClick={() => {
                    setResult(null);
                    setBarcode("");
                  }}
                >
                  Scan another
                </button>
              </div>
            </>
          )}
        </section>
      </div>
      <div className="feature-note">
        <ShieldCheck size={18} />
        <div>
          <strong>Permission on your terms.</strong>
          <p>
            The camera opens only when you choose it. Images are processed in
            the browser and the camera stops when you leave.
          </p>
        </div>
      </div>
      {saving && (
        <ProductForm
          initialName={sample ? "Studio Headphones Pro" : ""}
          initialBrand={sample ? "Sonora" : ""}
          onClose={() => setSaving(false)}
        />
      )}
    </div>
  );
}
