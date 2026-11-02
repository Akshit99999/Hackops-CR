"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, FileDown, ShieldCheck } from "lucide-react";
import { Modal } from "@/components/ui";
import { useWorkspace } from "@/lib/workspace";
import { backendConfigured, backendRequest } from "@/lib/backend";
import { currency, downloadText, today } from "@/lib/utils";
import type { WarrantyItem } from "@/lib/types";

export function ClaimWizard({
  item,
  onClose,
}: {
  item: WarrantyItem;
  onClose: () => void;
}) {
  const { addCase, notify } = useWorkspace();
  const router = useRouter();
  const [action, setAction] = useState<"request" | "escalate">("request");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name")).trim();
    const defect = String(form.get("defect")).trim();
    if (action === "request") {
      let requestMarkdown = `# Warranty service request\n\nFrom: ${name}\nProduct: ${item.name}\nBrand: ${item.brand}\nModel: ${item.modelNumber}\nSerial: ${item.serialNumber}\nSeller: ${item.seller}\nPurchase date: ${item.purchaseDate}\nPurchase price: ${currency(item.purchasePrice)} (USD)\nRecorded warranty end: ${item.expiryDate}\n\n## Issue\n${defect}\n\nPlease confirm coverage and the next steps for service under the applicable warranty.\n\n## Evidence inventory\n${item.documents.map((doc) => `- ${doc.name}: SHA-256 ${doc.sha256}`).join("\n") || "No documents attached."}\n\nCoverage dates are consumer-entered and do not establish eligibility. This request has not been sent. Attach the original documents when contacting the manufacturer.\n${item.sample ? "\nSAMPLE PURCHASE — demonstration only." : ""}`;
      if (backendConfigured() && !item.sample) {
        try {
          const result = await backendRequest<{ content_markdown: string }>("/warranty/claim/generate", {
            method: "POST",
            body: JSON.stringify({
              warranty_item_id: item.id,
              consumer_name: name,
              defect,
              requested_action: "repair or replacement",
            }),
          });
          requestMarkdown = result.content_markdown;
        } catch {
          notify("Backend request draft was unavailable; a local draft was exported instead.");
        }
      }
      downloadText(
        `${item.id}-warranty-request.md`,
        requestMarkdown,
      );
      if (!backendConfigured()) notify("Your warranty request has been exported. Review it before sending.");
    } else {
      addCase({
        id: `CR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        consumerName: name,
        merchant: item.seller,
        product: item.name,
        purchaseDate: item.purchaseDate,
        defectDate: today(),
        claimAmount: item.purchasePrice,
        narrative: defect,
        status: "Draft notice",
        createdDate: today(),
        deadline: null,
        documents: [...item.documents],
        sample: item.sample,
      });
      notify(
        "Draft case created with your product details and evidence inventory.",
      );
      router.push("/command-center");
    }
    onClose();
  }
  return (
    <Modal
      title="Let’s get it working again."
      description={`${item.name} · ${item.brand}`}
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="form-stack">
        <div className="claim-options">
          <button
            type="button"
            className={`claim-option ${action === "request" ? "selected" : ""}`}
            onClick={() => setAction("request")}
            aria-pressed={action === "request"}
          >
            <FileDown size={23} />
            <h3>Prepare a service request</h3>
            <p>
              Export your product details, issue, and evidence inventory for the
              manufacturer.
            </p>
          </button>
          <button
            type="button"
            className={`claim-option ${action === "escalate" ? "selected" : ""}`}
            onClick={() => setAction("escalate")}
            aria-pressed={action === "escalate"}
          >
            <ShieldCheck size={23} />
            <h3>Move to the command center</h3>
            <p>
              If a request was declined, organize the facts into a new
              resolution case.
            </p>
          </button>
        </div>
        <label className="field">
          Your full name
          <input
            name="name"
            required
            minLength={2}
            maxLength={150}
            placeholder="Name to include in your request"
          />
        </label>
        <label className="field">
          What’s the issue?
          <textarea
            name="defect"
            required
            minLength={20}
            maxLength={10000}
            rows={4}
            placeholder="What stopped working, when it happened, and any steps you’ve already taken…"
          />
        </label>
        <p className="form-note">
          This preview organizes your request. Manufacturer service lookup and
          automatic eligibility checks will be added later. Nothing is sent for
          you.
        </p>
        <div className="form-actions">
          <span className="inline-note">
            {item.documents.length} document(s) in the evidence inventory
          </span>
          <button type="submit" className="button button-primary">
            {action === "request" ? "Export request" : "Create draft case"}
            <ArrowUpRight size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
