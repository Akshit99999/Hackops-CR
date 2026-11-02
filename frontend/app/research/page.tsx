"use client";
import { useState } from "react";
import {
  Search,
  ArrowUpRight,
  BookOpen,
  BookMarked,
  ExternalLink,
} from "lucide-react";
import { EmptyState, PageHeading } from "@/components/ui";

const references = [
  {
    title: "A guide to federal warranty law",
    author: "Federal Trade Commission",
    category: "Warranty rights",
    type: "OFFICIAL GUIDANCE",
    description:
      "An introduction to written and implied warranties, disclosures, and federal warranty requirements.",
    url: "https://www.ftc.gov/business-guidance/resources/businesspersons-guide-federal-warranty-law",
  },
  {
    title: "Implied warranties and written coverage",
    author: "U.S. Code · 15 U.S.C. § 2308",
    category: "Warranty rights",
    type: "STATUTE",
    description:
      "Read the statutory text on limitations affecting implied warranties when a supplier provides a written warranty or service contract.",
    url: "https://www.govinfo.gov/content/pkg/USCODE-2024-title15/html/USCODE-2024-title15-chap50-sec2308.htm",
  },
  {
    title: "The Market for “Lemons”",
    author: "George A. Akerlof · Quarterly Journal of Economics",
    category: "Product transparency",
    type: "RESEARCH PAPER · 1970",
    description:
      "A foundational look at quality uncertainty and the information gap between buyers and sellers.",
    url: "https://doi.org/10.2307/1879431",
  },
  {
    title: "CLAUDETTE: unfair terms in online contracts",
    author: "Lippi et al. · Artificial Intelligence and Law",
    category: "Contract intelligence",
    type: "RESEARCH PAPER · 2019",
    description:
      "Research behind automated screening of potentially unfair clauses in online consumer contracts.",
    url: "https://doi.org/10.1007/s10506-019-09243-2",
  },
  {
    title: "The cost of reading privacy policies",
    author: "Aleecia M. McDonald & Lorrie Faith Cranor",
    category: "Contract intelligence",
    type: "RESEARCH PAPER",
    description:
      "An examination of the time and effort involved in reading the privacy policies consumers encounter.",
    url: "https://kb.osu.edu/handle/1811/72839",
  },
  {
    title: "Digital product passports & ecodesign",
    author: "European Union · Regulation (EU) 2024/1781",
    category: "Product transparency",
    type: "REGULATION",
    description:
      "The EU framework for ecodesign requirements and digital product information. Read the regulation for its scope and implementation details.",
    url: "https://eur-lex.europa.eu/eli/reg/2024/1781/oj",
  },
  {
    title: "Access to consumer remedies",
    author: "Amy J. Schmitz · Pepperdine Law Review",
    category: "Consumer redress",
    type: "RESEARCH PAPER",
    description:
      "A study of consumer redress and the challenges people face when seeking a resolution after a purchase.",
    url: "https://digitalcommons.pepperdine.edu/plr/vol39/iss2/2/",
  },
  {
    title: "Mass arbitration",
    author: "J. Maria Glover · Stanford Law Review",
    category: "Consumer redress",
    type: "RESEARCH PAPER",
    description:
      "An analysis of mass arbitration and its role in the wider landscape of dispute resolution.",
    url: "https://www.stanfordlawreview.org/print/article/mass-arbitration/",
  },
];

export default function ResearchPage() {
  const [filter, setFilter] = useState("All resources");
  const [search, setSearch] = useState("");
  const visible = references.filter(
    (item) =>
      (filter === "All resources" || item.category === filter) &&
      `${item.title} ${item.author} ${item.description}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div>
      <PageHeading
        eyebrow="KNOWLEDGE LOOKS GOOD ON YOU"
        title="A little knowledge. More power."
        description="The research and sources behind a more informed consumer life."
      />
      <section className="research-intro">
        <BookOpen size={43} strokeWidth={1.2} />
        <div>
          <h2>Good decisions start with better information.</h2>
          <p>
            A reading list from the project specification: research, statutes,
            and official guidance.
            <br />
            Follow each source for its full text, current context, and scope.
          </p>
        </div>
      </section>
      <div className="vault-toolbar research-toolbar">
        <div className="preset-buttons">
          {[
            "All resources",
            "Consumer redress",
            "Warranty rights",
            "Contract intelligence",
            "Product transparency",
          ].map((value) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`chip ${filter === value ? "selected" : ""}`}
            >
              {value}
            </button>
          ))}
        </div>
        <label className="search-input">
          <Search size={16} />
          <input
            placeholder="Find a source or author…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search research library"
          />
        </label>
      </div>
      <div className="research-count">{visible.length} sources to explore</div>
      {visible.length ? (
        <div className="research-grid">
          {visible.map((item) => (
            <a
              className="research-card"
              key={item.url}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="research-card-top">
                <span>{item.type}</span>
                <ExternalLink size={14} />
              </div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <div className="research-card-foot">
                <span>{item.author}</span>
                <ArrowUpRight size={17} />
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="panel">
          <EmptyState
            title="A different search might help."
            description="Try a broader topic or another author."
            action={
              <button
                className="button button-outline"
                onClick={() => {
                  setSearch("");
                  setFilter("All resources");
                }}
              >
                Show all sources
              </button>
            }
          />
        </div>
      )}
      <div className="feature-note">
        <BookMarked size={18} />
        <div>
          <strong>Read the source. Keep the context.</strong>
          <p>
            The specification draws on U.S. and EU material. Applicability
            depends on the purchase, jurisdiction, and current law.
          </p>
        </div>
      </div>
    </div>
  );
}
