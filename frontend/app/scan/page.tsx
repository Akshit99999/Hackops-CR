"use client";
import { useEffect, useRef, useState } from "react";
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
  LoaderCircle,
  Package,
  Leaf,
  RotateCcw,
} from "lucide-react";
import { PageHeading, Badge } from "@/components/ui";
import { BarcodeCamera } from "@/components/scanner/BarcodeCamera";
import { ProductForm } from "@/components/warranty/ProductForm";
import { parseBarcode, type ProductBarcode } from "@/lib/barcodes";
import type {
  ProductLookup,
  ScannedProduct,
  RecallLookup,
} from "@/lib/products";
import { backendConfigured, backendRequest } from "@/lib/backend";
import type { WarrantyItem } from "@/lib/types";
import "./scanner.css";

type LookupState =
  | { phase: "idle" }
  | { phase: "loading"; barcode: string }
  | { phase: "done"; result: ProductLookup }
  | { phase: "error"; barcode: string; message: string };

function vaultCategory(
  product: ScannedProduct | null,
): WarrantyItem["category"] {
  const category = product?.category.toLowerCase() || "";
  if (/audio|headphone|speaker/.test(category)) return "Audio";
  if (/computer|mobile|phone|tablet|laptop/.test(category)) return "Computing";
  if (/home|kitchen|appliance|furniture/.test(category)) return "Home";
  return "Other";
}

function ProductImage({ product }: { product: ScannedProduct | null }) {
  const [failed, setFailed] = useState(false);
  return product?.image && !failed ? (
    <div className="scan-product-image">
      <img
        src={product.image}
        alt={product.name}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    </div>
  ) : (
    <span className="empty-icon">
      <Barcode size={32} />
    </span>
  );
}

export default function ScanPage() {
  const [barcode, setBarcode] = useState("");
  const [state, setState] = useState<LookupState>({ phase: "idle" });
  const [parsed, setParsed] = useState<ProductBarcode | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [recalls, setRecalls] = useState<{
    phase: "idle" | "loading" | "done" | "error";
    data?: RecallLookup;
  }>({ phase: "idle" });
  const request = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  useEffect(
    () => () => {
      sequence.current++;
      request.current?.abort();
    },
    [],
  );

  async function lookup(value: string, format?: string) {
    request.current?.abort();
    const id = ++sequence.current;
    setError("");
    setSaving(false);
    setRecalls({ phase: "idle" });
    let code: ProductBarcode;
    try {
      code = parseBarcode(value, format);
    } catch (error) {
      setParsed(null);
      setState({ phase: "idle" });
      setError(error instanceof Error ? error.message : "Check your barcode.");
      return;
    }
    setParsed(code);
    setBarcode(code.gtin);
    setState({ phase: "loading", barcode: code.gtin });
    const controller = new AbortController();
    request.current = controller;
    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(20000),
    ]);
    try {
      const response = await fetch(`/api/scan/${code.gtin}`, { signal });
      const payload = await response.json();
      if (id !== sequence.current) return;
      if (
        !["found", "not_found", "unavailable"].includes(payload.status) ||
        !Array.isArray(payload.sources) ||
        (payload.status === "found" && !payload.product?.name)
      )
        throw new Error(
          payload.detail ||
            "Could not read the product catalog response. Please try again.",
        );
      setState({ phase: "done", result: payload as ProductLookup });
      if (backendConfigured()) {
        setRecalls({ phase: "loading" });
        void backendRequest<RecallLookup>("/scan/lookup", {
          method: "POST",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(25000),
          ]),
          body: JSON.stringify({
            barcode: code.gtin,
            product_name: payload.product?.name,
            brand: payload.product?.brand,
            model_number: payload.product?.model,
          }),
        })
          .then((data) => {
            if (id === sequence.current) setRecalls({ phase: "done", data });
          })
          .catch(() => {
            if (id === sequence.current && !controller.signal.aborted)
              setRecalls({ phase: "error" });
          });
      }
    } catch (error) {
      if (id !== sequence.current || controller.signal.aborted) return;
      setState({
        phase: "error",
        barcode: code.gtin,
        message: signal.aborted
          ? "The product lookup timed out. Please try again."
          : error instanceof TypeError
            ? "Could not reach the product lookup. Check your connection and try again."
            : error instanceof Error
              ? error.message
              : "Product lookup failed. Please try again.",
      });
    }
  }
  function reset() {
    sequence.current++;
    request.current?.abort();
    setState({ phase: "idle" });
    setBarcode("");
    setParsed(null);
    setError("");
    setRecalls({ phase: "idle" });
  }
  const result = state.phase === "done" ? state.result : null;
  const product = result?.product || null;
  const loading = state.phase === "loading";
  const unavailable = result?.status === "unavailable";

  return (
    <div>
      <PageHeading
        eyebrow="THERE’S MORE BEHIND THE LABEL"
        title="Look a little closer."
        description="Scan a product barcode to find its name, brand, and available catalog details."
      />
      <div className="preview-strip">
        <Info size={16} />
        Live catalog lookup · Scan with your camera, upload a barcode photo, or
        enter its digits. Product coverage varies by catalog.
      </div>
      <div className="scanner-layout">
        <section className="panel scanner-panel">
          <h2>Meet your next purchase.</h2>
          <p>
            Keep the entire barcode in view, with good light and a little space
            around the edges.
          </p>
          <BarcodeCamera
            onDetected={(value, format) => void lookup(value, format)}
          />
          <form
            className="scanner-manual"
            onSubmit={(event) => {
              event.preventDefault();
              void lookup(barcode);
            }}
          >
            <label className="field">
              Barcode or GS1 Digital Link
              <input
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                required
                maxLength={500}
                placeholder="e.g. 0885909950805"
                autoComplete="off"
                spellCheck={false}
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
            <button
              type="submit"
              className="button button-primary"
              disabled={loading}
            >
              {loading ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <ArrowUpRight size={16} />
              )}
              {loading ? "Looking up product…" : "Look up product"}
            </button>
            <div className="scanner-example">
              Try a real barcode:
              <button
                type="button"
                disabled={loading}
                onClick={() => void lookup("0885909950805")}
              >
                iPhone 6
              </button>
              <span>·</span>
              <button
                type="button"
                disabled={loading}
                onClick={() => void lookup("0049000028911")}
              >
                Diet Coke
              </button>
            </div>
          </form>
        </section>
        <section
          className="panel scanner-result"
          aria-live="polite"
          aria-busy={loading}
        >
          {state.phase === "idle" && (
            <div className="result-empty">
              <span>
                <ScanLine size={36} strokeWidth={1.25} />
              </span>
              <h2>A little less guesswork.</h2>
              <p>
                Scan a barcode to look up the product across public food and
                general-product catalogs.
              </p>
              <small>REAL PRODUCT DATA. A CLEARER STARTING POINT.</small>
            </div>
          )}
          {loading && (
            <div className="result-empty scan-loading">
              <span>
                <LoaderCircle className="spin" size={32} />
              </span>
              <h2>Finding your product.</h2>
              <p className="mono">{state.barcode}</p>
              <p>
                Checking public product catalogs. This may take a few seconds.
              </p>
              <button className="button button-outline" onClick={reset}>
                Cancel lookup
              </button>
            </div>
          )}
          {state.phase === "error" && (
            <div className="result-empty">
              <span>
                <Info size={30} />
              </span>
              <h2>Let’s try that again.</h2>
              <p>{state.message}</p>
              <button
                className="button button-primary"
                onClick={() => void lookup(state.barcode)}
              >
                <RotateCcw size={15} /> Retry lookup
              </button>
              <button className="text-link" onClick={reset}>
                Scan another product
              </button>
            </div>
          )}
          {result && (
            <>
              <div className="section-heading">
                <span className="eyebrow" style={{ marginBottom: 0 }}>
                  PRODUCT LOOKUP
                </span>
                <Badge tone={product ? "green" : "neutral"}>
                  {product
                    ? "Catalog match"
                    : unavailable
                      ? "Service unavailable"
                      : "No listing found"}
                </Badge>
              </div>
              <div className="scan-product-header">
                <ProductImage key={result.barcode} product={product} />
                <div>
                  <span className="eyebrow">
                    {product?.brand ||
                      (product ? "BRAND NOT LISTED" : "PRODUCT BARCODE")}
                  </span>
                  <h2>
                    {product?.name ||
                      (unavailable
                        ? "Catalogs couldn’t be reached."
                        : "This product isn’t listed yet.")}
                  </h2>
                  <p className="mono">{result.barcode}</p>
                </div>
              </div>
              {product ? (
                <>
                  <div className="scan-product-facts">
                    <Fact
                      icon={Package}
                      title="Package / size"
                      value={product.quantity || "Not provided in the listing"}
                    />
                    <Fact
                      icon={Building2}
                      title="Category"
                      value={product.category || "Not provided in the listing"}
                    />
                    {product.model && (
                      <Fact
                        icon={Barcode}
                        title="Model"
                        value={product.model}
                      />
                    )}
                    {product.nutriScore && (
                      <Fact
                        icon={Leaf}
                        title="Nutri-Score"
                        value={`${product.nutriScore} · as listed by ${product.source.name}`}
                      />
                    )}
                  </div>
                  {product.description && (
                    <details className="scan-description">
                      <summary>Product description</summary>
                      <p>{product.description}</p>
                    </details>
                  )}
                  {product.ingredients && (
                    <details className="scan-description">
                      <summary>Ingredients from the listing</summary>
                      <p>{product.ingredients}</p>
                    </details>
                  )}
                  {product.allergens.length > 0 && (
                    <div className="scan-allergens">
                      <strong>Listed allergens</strong>
                      <p>{product.allergens.join(", ")}</p>
                      <small>
                        Check the actual packaging; catalog data may be
                        incomplete or outdated.
                      </small>
                    </div>
                  )}
                  <div className="scan-source">
                    <span>
                      Product data:{" "}
                      <a
                        href={product.source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {product.source.name}
                        <ArrowUpRight size={12} />
                      </a>
                      {product.source.license && (
                        <>
                          {" "}
                          ·{" "}
                          <a
                            href="https://opendatacommons.org/licenses/odbl/1-0/"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {product.source.license}
                          </a>
                        </>
                      )}
                    </span>
                    <small>
                      Catalog descriptions can be incomplete or outdated.
                      Confirm the match against your packaging.
                    </small>
                  </div>
                </>
              ) : (
                <p className="scan-empty-description">
                  {unavailable
                    ? "The catalog services are temporarily unavailable or have reached their lookup limit. Try again later, or enter the product details yourself."
                    : "No matching listing was returned by the available catalogs. This can happen with local brands, new products, or incomplete catalog coverage. You can still save the product manually."}
                </p>
              )}
              {(parsed?.lot || parsed?.serial) && (
                <dl className="scan-identifiers">
                  {parsed.lot && (
                    <div>
                      <dt>GS1 LOT</dt>
                      <dd>{parsed.lot}</dd>
                    </div>
                  )}
                  {parsed.serial && (
                    <div>
                      <dt>GS1 SERIAL</dt>
                      <dd>{parsed.serial}</dd>
                    </div>
                  )}
                </dl>
              )}
              <details className="scan-catalog-status">
                <summary>Catalog availability</summary>
                {result.sources.map((source, index) => (
                  <div key={`${source.name}-${index}`}>
                    <span>{source.name}</span>
                    <span>
                      {
                        {
                          found: "Listing found",
                          not_found: "No listing",
                          unavailable: "Unavailable",
                          rate_limited: "Lookup limit reached",
                        }[source.status]
                      }
                    </span>
                  </div>
                ))}
                <p>
                  UPCitemDB’s free service has a shared daily request limit.
                  Successful lookups are cached to reduce requests.
                </p>
              </details>
              {backendConfigured() && (
                <section className="scan-recalls">
                  <h3>Public recall records</h3>
                  {recalls.phase === "loading" ? (
                    <p role="status">Checking CPSC and openFDA sources…</p>
                  ) : recalls.phase === "done" && recalls.data ? (
                    <>
                      <div className="scan-recall-sources">
                        {[
                          ["CPSC", recalls.data.sources.cpsc?.status],
                          ["openFDA", recalls.data.sources.openfda?.status],
                        ].map(([name, status]) => (
                          <span key={name}>
                            {name}:{" "}
                            {status === "matched"
                              ? "Possible match"
                              : status === "no_match"
                                ? "No matching record"
                                : status === "not_queried"
                                  ? "Not checked"
                                  : "Unavailable"}
                          </span>
                        ))}
                      </div>
                      {recalls.data.recalls.map((entry, index) => (
                        <article className="scan-recall-record" key={index}>
                          <Badge tone="red">Possible recall match</Badge>
                          <strong>
                            {entry.title ||
                              entry.product ||
                              entry.recall_number ||
                              "Recall record"}
                          </strong>
                          {entry.reason && <p>{entry.reason}</p>}
                          {entry.source_url?.startsWith("https://") && (
                            <a
                              className="text-link"
                              href={entry.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Read {entry.source || "source"} record{" "}
                              <ArrowUpRight size={13} />
                            </a>
                          )}
                        </article>
                      ))}
                      <p>
                        {recalls.data.disclaimer ||
                          "A missing match does not establish that a product is safe or recall-free. Confirm the model, lot, and dates in the original source."}
                      </p>
                    </>
                  ) : (
                    <p>
                      Recall sources could not be reached. A product catalog
                      match does not establish safety.
                    </p>
                  )}
                </section>
              )}
              {product && (
                <details className="scan-future-checks">
                  <summary>Additional checks</summary>
                  {[
                    ...(!backendConfigured()
                      ? [
                          {
                            icon: ShieldCheck,
                            title: "Safety recalls",
                            text: "No live recall check has been performed. Connect the optional backend to query recall sources.",
                          },
                        ]
                      : []),
                    {
                      icon: Scale,
                      title: "Package history",
                      text: "No historical weight or price comparison.",
                    },
                    {
                      icon: Wrench,
                      title: "Repairability",
                      text: "No verified repairability score available.",
                    },
                  ].map(({ icon: Icon, title, text }) => (
                    <div className="scan-data-row" key={title}>
                      <Icon size={17} />
                      <div>
                        <h3>{title}</h3>
                        <p>{text}</p>
                      </div>
                      <span>Not checked</span>
                    </div>
                  ))}
                </details>
              )}
              <div className="scan-result-actions">
                <button
                  className="button button-primary"
                  onClick={() => setSaving(true)}
                >
                  <Plus size={15} />
                  {product ? "Save to warranty vault" : "Add product manually"}
                </button>
                <button className="button button-outline" onClick={reset}>
                  Scan another
                </button>
                {unavailable && (
                  <button
                    className="button button-outline"
                    onClick={() => void lookup(result.barcode)}
                  >
                    <RotateCcw size={14} /> Retry
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      </div>
      <div className="feature-note">
        <ShieldCheck size={18} />
        <div>
          <strong>Your camera stays on your device.</strong>
          <p>
            Only the decoded barcode and product identifiers are sent for
            lookups. Photos are decoded locally and are not uploaded. Camera
            access stops after a scan, when you cancel, or when you leave this
            page.
          </p>
        </div>
      </div>
      {saving && (
        <ProductForm
          initialName={product?.name || ""}
          initialBrand={product?.brand || ""}
          initialModel={product?.model || ""}
          initialBarcode={parsed?.gtin || ""}
          initialSerial={parsed?.serial || ""}
          initialLot={parsed?.lot || ""}
          initialCategory={vaultCategory(product)}
          initialSource={product?.source}
          onClose={() => setSaving(false)}
        />
      )}
    </div>
  );
}

function Fact({
  icon: Icon,
  title,
  value,
}: {
  icon: typeof Package;
  title: string;
  value: string;
}) {
  return (
    <div className="scan-data-row">
      <Icon size={18} />
      <div>
        <h3>{title}</h3>
        <p>{value}</p>
      </div>
    </div>
  );
}
