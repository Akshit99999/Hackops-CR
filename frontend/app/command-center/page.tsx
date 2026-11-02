"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  ArrowUpRight,
  Search,
  Download,
  ShieldCheck,
  Clock3,
  CircleCheck,
  FileText,
  ArrowRight,
  Check,
} from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import {
  currency,
  daysUntil,
  downloadText,
  draftNotice,
  formatDate,
} from "@/lib/utils";
import {
  Badge,
  PageHeading,
  Modal,
  EmptyState,
  Loading,
} from "@/components/ui";
import { CaseForm } from "@/components/CaseForm";
import type { DisputeCase } from "@/lib/types";
import { backendConfigured, downloadBackendFile } from "@/lib/backend";

export default function CommandCenter() {
  const { data, ready, updateCase, notify } = useWorkspace();
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All cases");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new"))
      setCreating(true);
  }, []);
  const selected = data.cases.find((item) => item.id === selectedId);
  if (!ready) return <Loading />;
  const active = data.cases.filter((item) => item.status !== "Resolved");
  const visible = data.cases.filter(
    (item) =>
      (filter === "All cases" ||
        (filter === "Active"
          ? item.status !== "Resolved"
          : item.status === "Resolved")) &&
      `${item.id} ${item.product} ${item.merchant}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div>
      <PageHeading
        eyebrow="YOUR VOICE, WITH A LITTLE MORE WEIGHT"
        title="Make your case."
        description="From a frustrating purchase to a clear path forward."
        action={
          <button
            className="button button-primary"
            onClick={() => setCreating(true)}
          >
            <Plus size={16} /> New case
          </button>
        }
      />
      <div className="metrics-grid metrics-three">
        <CaseMetric
          label="Open case value"
          value={currency(
            active.reduce((sum, item) => sum + item.claimAmount, 0),
          )}
          icon={<ShieldCheck size={18} />}
          detail="Your requested refunds"
        />
        <CaseMetric
          label="Awaiting a response"
          value={String(
            data.cases.filter((item) => item.status === "Awaiting response")
              .length,
          ).padStart(2, "0")}
          icon={<Clock3 size={18} />}
          detail="Notices recorded as sent"
        />
        <CaseMetric
          label="Cases resolved"
          value={String(
            data.cases.filter((item) => item.status === "Resolved").length,
          ).padStart(2, "0")}
          icon={<CircleCheck size={18} />}
          detail="Marked resolved in this workspace"
        />
      </div>
      <section className="intake-banner">
        <span className="intake-icon">
          <FileText size={27} strokeWidth={1.5} />
        </span>
        <div>
          <span className="eyebrow">START WITH WHAT HAPPENED</span>
          <h2>A clear request can change the conversation.</h2>
          <p>
            Gather the facts, keep your evidence together, and prepare a notice
            you can review.
          </p>
        </div>
        <button
          className="button button-outline"
          onClick={() => setCreating(true)}
        >
          Draft a request <ArrowUpRight size={16} />
        </button>
      </section>
      <section className="panel ledger-panel">
        <div className="ledger-header">
          <div>
            <h2>Your case ledger</h2>
            <p>Every step, a little easier to follow.</p>
          </div>
          <div className="tabs">
            {["All cases", "Active", "Resolved"].map((value) => (
              <button
                className={filter === value ? "selected" : ""}
                key={value}
                onClick={() => setFilter(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        <div className="ledger-toolbar">
          <label className="search-input">
            <Search size={16} />
            <input
              placeholder="Search cases, products, or merchants…"
              aria-label="Search cases"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <span className="muted small">{visible.length} cases</span>
        </div>
        {visible.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>CASE / PRODUCT</th>
                  <th>MERCHANT</th>
                  <th>REQUESTED</th>
                  <th>STATUS</th>
                  <th>NEXT STEP</th>
                  <th>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <button
                        className="table-title"
                        onClick={() => setSelectedId(item.id)}
                      >
                        {item.product}
                      </button>
                      <span className="table-subtitle mono">
                        {item.id}
                        {item.sample ? " · SAMPLE" : ""}
                      </span>
                    </td>
                    <td>
                      {item.merchant}
                      <span className="table-subtitle">
                        {formatDate(item.createdDate)}
                      </span>
                    </td>
                    <td className="amount-cell">
                      {currency(item.claimAmount)}
                    </td>
                    <td>
                      <Badge
                        tone={
                          item.status === "Resolved"
                            ? "green"
                            : item.status === "Awaiting response"
                              ? "amber"
                              : "neutral"
                        }
                      >
                        {item.status}
                      </Badge>
                    </td>
                    <td>
                      <NextStep item={item} />
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        onClick={() => setSelectedId(item.id)}
                        aria-label={`Review ${item.product}`}
                      >
                        <ArrowUpRight size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={search ? "No matching cases." : "A clean slate."}
            description={
              search
                ? "Try a different product or merchant name."
                : "Your next step starts with a few simple facts."
            }
            action={
              <button
                className="button button-outline"
                onClick={() => setCreating(true)}
              >
                Create your first case <Plus size={15} />
              </button>
            }
          />
        )}
      </section>
      <div className="feature-note">
        <ShieldCheck size={18} />
        <div>
          <strong>You’re always in the driver’s seat.</strong>
          <p>
            Drafts stay in your workspace. Review and send them yourself, then
            record the date and any response period you choose to track.
          </p>
        </div>
      </div>
      {creating && <CaseForm onClose={() => setCreating(false)} />}
      {selected && (
        <Modal
          title="Your request, ready to review."
          description={`${selected.id}${selected.sample ? " · Fictional sample" : ""}`}
          onClose={() => setSelectedId(null)}
          wide
        >
          <div className="notice-summary">
            <Badge tone={selected.status === "Resolved" ? "green" : "amber"}>
              {selected.status}
            </Badge>
            <strong>{currency(selected.claimAmount)} requested</strong>
          </div>
          <pre className="notice-preview">{selected.noticeMarkdown || draftNotice(selected)}</pre>
          <div className="form-actions">
            <button
              className="button button-outline"
              onClick={() => {
                if (backendConfigured() && !selected.sample)
                  void downloadBackendFile(`/api/v1/cases/${encodeURIComponent(selected.id)}/notice.md`, `${selected.id}-draft.md`)
                    .catch(() => notify("Could not export the backend draft. The preview is still available here."));
                else downloadText(`${selected.id}-notice.md`, draftNotice(selected));
              }}
            >
              <Download size={16} /> Export draft
            </button>
            <div className="button-group">
              {selected.status === "Draft notice" && (
                <button
                  className="button button-primary"
                  onClick={() => {
                    updateCase(selected.id, "sent");
                    notify(
                      "Recorded as sent. Your requested response window starts today.",
                    );
                  }}
                >
                  Record as sent <ArrowRight size={16} />
                </button>
              )}
              {selected.status !== "Resolved" && (
                <button
                  className="button button-outline"
                  onClick={() => {
                    updateCase(selected.id, "resolved");
                    notify("Case marked resolved.");
                  }}
                >
                  <Check size={16} /> Mark resolved
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
function CaseMetric({
  label,
  value,
  icon,
  detail,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  detail: string;
}) {
  return (
    <div className="metric-card">
      <div className="metric-label">
        {label}
        <span>{icon}</span>
      </div>
      <div className="metric-value">{value}</div>
      <p>{detail}</p>
    </div>
  );
}
function NextStep({ item }: { item: DisputeCase }) {
  if (item.status === "Resolved")
    return (
      <span className="next-step">
        <CircleCheck size={14} /> All wrapped up
      </span>
    );
  if (!item.deadline)
    return (
      <span className="next-step">
        Review your draft <ArrowRight size={13} />
      </span>
    );
  const days = Math.max(0, daysUntil(item.deadline));
  return (
    <div className="deadline-cell">
      <span>{days ? `${days} days remaining` : "Follow-up time"}</span>
      <div className="progress-track">
        <span style={{ width: `${Math.min(100, (days / 15) * 100)}%` }} />
      </div>
    </div>
  );
}
