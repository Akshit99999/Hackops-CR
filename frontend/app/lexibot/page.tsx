"use client";
import { useState } from "react";
import {
  FileSearch,
  Sparkles,
  ArrowUpRight,
  MessageSquareText,
  Send,
  Info,
  Download,
} from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import {
  Badge,
  EmptyState,
  PageHeading,
  SectionHeading,
} from "@/components/ui";
import { RiskRadar } from "@/components/visualizers/RiskRadar";
import { SAMPLE_TERMS, auditContract, findPassages } from "@/lib/contracts";
import { downloadText } from "@/lib/utils";
import type { ContractAudit } from "@/lib/types";

interface Message {
  id: string;
  role: "user" | "agent";
  text: string;
  citations?: { id: string; text: string }[];
}

export default function TermsAgent() {
  const { addActivity, notify } = useWorkspace();
  const [text, setText] = useState("");
  const [audit, setAudit] = useState<ContractAudit | null>(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState("");
  function runAudit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (text.trim().length < 30) {
      setError("Paste at least 30 characters of terms to start the review.");
      return;
    }
    const result = auditContract(text.trim());
    setAudit(result);
    setMessages([]);
    setQuestion("");
    addActivity(
      "The fine print, a little clearer",
      `${result.sentences.length} sentences reviewed · ${result.flags.length} keyword matches`,
      "audit",
    );
    notify("Screening complete. Review each passage in context.");
  }
  function ask(value: string) {
    if (!audit || value.trim().length < 3) return;
    const passages = findPassages(audit, value.trim());
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", text: value.trim() },
      {
        id: crypto.randomUUID(),
        role: "agent",
        text: passages.length
          ? "These passages may help answer your question. They’re quoted directly from the text you supplied:"
          : "I couldn’t find a matching passage in the supplied text. Try a different term or review the full agreement.",
        citations: passages,
      },
    ]);
    setQuestion("");
  }
  return (
    <div>
      <PageHeading
        eyebrow="THE FINE PRINT, IN PLAIN SIGHT"
        title="Read between the lines."
        description="Understand the terms you’re agreeing to, one clause at a time."
      />
      <div className="preview-strip">
        <Info size={16} />
        Frontend screening uses keywords across nine categories. Scores are
        illustrative signals; no trained CLAUDETTE model or live AI is
        connected.
      </div>
      <div className="terms-layout">
        <form className="panel terms-input-panel" onSubmit={runAudit}>
          <div className="section-heading">
            <h2>Bring the fine print.</h2>
            <button
              type="button"
              className="sample-link"
              onClick={() => {
                setText(SAMPLE_TERMS);
                setError("");
              }}
            >
              <Sparkles size={13} /> Try sample terms
            </button>
          </div>
          <p>
            Paste the agreement or privacy policy you want to take a closer look
            at.
          </p>
          <label className="field">
            <span className="sr-only">Contract text</span>
            <textarea
              rows={12}
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={100000}
              required
              minLength={30}
              placeholder="Paste terms and conditions here…&#10;&#10;We’ll look for language around arbitration, changes to the agreement, liability limits, and more."
            />
          </label>
          {error && (
            <p role="alert" className="form-error" style={{ marginTop: 15 }}>
              {error}
            </p>
          )}
          <div className="terms-input-actions">
            <small>{text.length.toLocaleString()} / 100,000 characters</small>
            <button className="button button-primary" type="submit">
              <FileSearch size={16} /> Review the terms{" "}
              <ArrowUpRight size={15} />
            </button>
          </div>
        </form>
        <section className="panel terms-score-panel">
          <div className="score-heading">
            <h2>The balance of the agreement.</h2>
            <Badge tone={audit ? "amber" : "neutral"}>
              {audit ? "Keyword screening" : "Awaiting text"}
            </Badge>
          </div>
          <div className="score-value">
            {audit ? audit.score : "—"}
            <small> / 100</small>
          </div>
          <p className="score-caption">
            Illustrative balance score · higher means fewer rule matches
          </p>
          <RiskRadar values={audit?.axes || [100, 100, 100, 100, 100]} />
          <p className="score-note">
            {audit
              ? `${audit.sentences.length} sentences reviewed across 5 axes. The score reflects only keyword matches in the supplied text.`
              : "Add a document to see the five-axis preview respond to its language."}
          </p>
        </section>
      </div>
      {audit && (
        <>
          <section className="audit-results">
            <SectionHeading
              label="WORTH A SECOND LOOK"
              title={`${audit.flags.length} clause${audit.flags.length === 1 ? "" : "s"} to look at more closely.`}
              action={
                <button
                  className="text-link"
                  onClick={() =>
                    downloadText(
                      "terms-screening.md",
                      `# Terms screening\n\nMethod: keyword rules, not legal advice or a trained classifier.\nIllustrative score: ${audit.score}/100\n\n${audit.flags.map((flag) => `## ${flag.category} [${flag.sentenceId}]\n\n> ${flag.quote}\n\n${flag.explanation}`).join("\n\n")}`,
                    )
                  }
                >
                  <Download size={14} /> Export review
                </button>
              }
            />
            {audit.flags.length ? (
              <div className="clause-list">
                {audit.flags.map((flag, index) => (
                  <article
                    className="clause-card"
                    key={`${flag.sentenceId}-${index}`}
                  >
                    <div>
                      <h3>
                        {flag.category}
                        <span className="mono">[{flag.sentenceId}]</span>
                      </h3>
                      <blockquote>“{flag.quote}”</blockquote>
                      <p>{flag.explanation}</p>
                    </div>
                    <div>
                      <Badge tone={flag.severity === "High" ? "red" : "amber"}>
                        {flag.severity} attention
                      </Badge>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="panel">
                <EmptyState
                  title="No keyword matches found."
                  description="This doesn’t establish that the terms are fair or complete. Review the full text and its context."
                />
              </div>
            )}
          </section>
          <section className="panel chat-panel">
            <div className="chat-header">
              <span className="chat-icon">
                <MessageSquareText size={20} />
              </span>
              <div>
                <h2>A question about the details?</h2>
                <p>LexiBot preview · exact passages from your document</p>
              </div>
              <Badge tone="neutral">Sentence search</Badge>
            </div>
            <div className="chat-messages" aria-live="polite">
              {!messages.length && (
                <div className="chat-message">
                  <small>LEXIBOT</small>Ask about cancellation, dispute
                  resolution, or content rights. I’ll find relevant passages in
                  the text you supplied.
                </div>
              )}
              {messages.map((message) => (
                <div
                  className={`chat-message ${message.role === "user" ? "user" : ""}`}
                  key={message.id}
                >
                  <small>{message.role === "user" ? "YOU" : "LEXIBOT"}</small>
                  {message.text}
                  {message.citations?.map((citation) => (
                    <span className="chat-citation" key={citation.id}>
                      [{citation.id}] “{citation.text}”
                    </span>
                  ))}
                </div>
              ))}
            </div>
            <div className="chat-suggestions">
              {[
                "Can I cancel?",
                "How are disputes resolved?",
                "What rights to my content?",
              ].map((value) => (
                <button className="chip" key={value} onClick={() => ask(value)}>
                  {value}
                </button>
              ))}
            </div>
            <form
              className="chat-form"
              onSubmit={(event) => {
                event.preventDefault();
                ask(question);
              }}
            >
              <label className="sr-only" htmlFor="terms-question">
                Ask about the supplied terms
              </label>
              <input
                id="terms-question"
                className="standalone-input"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                minLength={3}
                maxLength={2000}
                required
                placeholder="What would you like to understand?"
              />
              <button
                className="button button-primary"
                type="submit"
                aria-label="Find relevant passages"
              >
                <Send size={16} />
              </button>
            </form>
          </section>
        </>
      )}
      <div className="feature-note">
        <FileSearch size={18} />
        <div>
          <strong>Keep the whole agreement in view.</strong>
          <p>
            Keyword matches help you find passages to read. They do not
            determine whether a term is unfair, unlawful, or enforceable.
          </p>
        </div>
      </div>
    </div>
  );
}
