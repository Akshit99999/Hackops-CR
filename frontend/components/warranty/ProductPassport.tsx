"use client";
import { useRef, useState } from "react";
import {
  UploadCloud,
  FileText,
  Download,
  ShieldCheck,
  ArrowUpRight,
  LoaderCircle,
} from "lucide-react";
import { Badge, Modal } from "@/components/ui";
import { ProductArt } from "@/components/visualizers/ProductArt";
import { useWorkspace } from "@/lib/workspace";
import { coverage, currency, formatDate } from "@/lib/utils";
import { storeDocument, downloadDocument } from "@/lib/documents";
import type { WarrantyItem } from "@/lib/types";

export function ProductPassport({
  item,
  onClose,
  onClaim,
}: {
  item: WarrantyItem;
  onClose: () => void;
  onClaim: () => void;
}) {
  const { updateWarranty, notify } = useWorkspace();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const state = coverage(item);
  async function attach(file?: File) {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    try {
      const document = await storeDocument(file);
      updateWarranty({ ...item, documents: [...item.documents, document] });
      notify("Receipt saved in this browser. SHA-256 hash recorded.");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not store this file.",
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <Modal
      title="Your product passport."
      description={`${item.id}${item.sample ? " · Fictional sample purchase" : ""}`}
      onClose={onClose}
      wide
    >
      <div className="passport-header">
        <ProductArt category={item.category} />
        <div>
          <span className="eyebrow">{item.brand}</span>
          <h3>{item.name}</h3>
          <p>{item.modelNumber || "Model not recorded"}</p>
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
        </div>
      </div>
      <dl className="passport-details">
        <div>
          <dt>PURCHASED FROM</dt>
          <dd>{item.seller}</dd>
        </div>
        <div>
          <dt>PURCHASE DATE</dt>
          <dd>{formatDate(item.purchaseDate)}</dd>
        </div>
        <div>
          <dt>PURCHASE PRICE</dt>
          <dd>{currency(item.purchasePrice)}</dd>
        </div>
        <div>
          <dt>SERIAL NUMBER</dt>
          <dd className="mono">{item.serialNumber || "Not recorded"}</dd>
        </div>
        <div>
          <dt>COVERAGE ENDS</dt>
          <dd>{formatDate(item.expiryDate)}</dd>
        </div>
        <div>
          <dt>RECORDED COVERAGE</dt>
          <dd>{item.warrantyDurationMonths} months</dd>
        </div>
      </dl>
      <div className="product-coverage">
        <span className="inline-note">
          <ShieldCheck size={15} />
          {state.days} days of recorded coverage left
        </span>
        <small>{state.status}</small>
      </div>
      <div className={`coverage-bar ${state.days <= 30 ? "warning" : ""}`}>
        <span style={{ width: `${state.percent}%` }} />
      </div>
      <section className="document-section">
        <h3>The important paperwork.</h3>
        <p>
          Attach receipts, warranty certificates, or serial photos. Files stay
          in this browser; the hash records integrity, not legal verification.
        </p>
        <input
          ref={input}
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          className="sr-only"
          tabIndex={-1}
          aria-label="Attach a receipt or warranty document"
          onChange={(event) => void attach(event.target.files?.[0])}
        />
        <button
          disabled={busy}
          className={`drop-zone ${dragging ? "dragging" : ""}`}
          style={{ width: "100%" }}
          onClick={() => input.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void attach(event.dataTransfer.files[0]);
          }}
        >
          {busy ? (
            <LoaderCircle size={22} className="spin" />
          ) : (
            <UploadCloud size={24} />
          )}
          <span>
            {busy
              ? "Saving your document…"
              : "Drop a document here, or browse files"}
            <small>
              PDF, PNG, or JPEG · up to 10 MB · manual entry, no OCR
            </small>
          </span>
        </button>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {item.documents.map((document) => (
          <div className="document-row" key={document.id}>
            <FileText size={19} />
            <div>
              <strong>{document.name}</strong>
              <small>
                {(document.size / 1024).toFixed(1)} KB ·{" "}
                {formatDate(document.date)}
              </small>
              <small className="mono" title={document.sha256}>
                SHA-256 {document.sha256.slice(0, 22)}…
              </small>
            </div>
            <button
              className="icon-button"
              aria-label={`Download ${document.name}`}
              onClick={() =>
                void downloadDocument(document).catch((error) =>
                  setError(error.message),
                )
              }
            >
              <Download size={17} />
            </button>
          </div>
        ))}
        {!item.documents.length && (
          <p className="form-note">
            No documents yet. A receipt is a good place to start.
          </p>
        )}
      </section>
      <div className="form-actions">
        <span className="form-note">Something not working as it should?</span>
        <button className="button button-primary" onClick={onClaim}>
          Prepare a warranty request <ArrowUpRight size={15} />
        </button>
      </div>
    </Modal>
  );
}
