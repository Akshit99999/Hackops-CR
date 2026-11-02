"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  ShieldCheck,
  ScanLine,
  FileText,
  Archive,
  BookOpen,
  ArrowUpRight,
  ChevronDown,
  Menu,
  X,
  Bell,
  Check,
  CircleHelp,
  RotateCcw,
  Sparkles,
  PanelLeftClose,
} from "lucide-react";
import { WorkspaceProvider, useWorkspace } from "@/lib/workspace";
import { backendConfigured } from "@/lib/backend";
import { Modal } from "@/components/ui";
import { LandingChrome } from "./LandingChrome";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/command-center", label: "Command center", icon: ShieldCheck },
  { href: "/scan", label: "Product scanner", icon: ScanLine },
  { href: "/lexibot", label: "Terms agent", icon: FileText },
  { href: "/warranty-vault", label: "Warranty vault", icon: Archive },
];

function Chrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data, message, reset } = useWorkspace();
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [panel, setPanel] = useState<
    "workspace" | "notifications" | "help" | null
  >(null);
  const active =
    navigation.find((item) => item.href === pathname)?.label ||
    "Research library";
  const samples =
    data.cases.some((item) => item.sample) ||
    data.warranties.some((item) => item.sample);
  if (pathname === "/") return <LandingChrome>{children}</LandingChrome>;
  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "is-open" : ""}`}>
        <Link
          href="/"
          className="brand"
          aria-label="Hackops home"
          onClick={() => setMobile(false)}
        >
          <span className="brand-mark">
            <ShieldCheck size={24} strokeWidth={1.7} />
          </span>
          <span>
            Hackops<span className="brand-period">-CR</span>
            <small>CONSUMER DEFENSE PLATFORM</small>
          </span>
        </Link>
        <button
          className="workspace-switch"
          onClick={() => setPanel("workspace")}
        >
          <span className="workspace-avatar">P</span>
          <span>
            Personal workspace
            <small>
              {samples ? "Demo data · fictional" : backendConfigured() ? "Backend sync configured" : "Saved in this browser"}
            </small>
          </span>
          <ChevronDown size={14} />
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobile(false)}
              className={`nav-item ${pathname === href ? "active" : ""}`}
              aria-current={pathname === href ? "page" : undefined}
            >
              <Icon size={18} strokeWidth={1.65} />
              <span>{label}</span>
              {href === "/command-center" &&
                data.cases.filter((item) => item.status !== "Resolved").length >
                  0 && (
                  <span className="nav-count">
                    {
                      data.cases.filter((item) => item.status !== "Resolved")
                        .length
                    }
                  </span>
                )}
            </Link>
          ))}
        </nav>
        <div className="nav-label resources-label">RESOURCES</div>
        <Link
          href="/research"
          className={`nav-item ${pathname === "/research" ? "active" : ""}`}
          onClick={() => setMobile(false)}
        >
          <BookOpen size={18} strokeWidth={1.65} />
          <span>Research library</span>
          <ArrowUpRight size={14} />
        </Link>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="mini-spark">
              <Sparkles size={17} />
            </span>
            <h3>
              A little knowledge.
              <br />A lot more power.
            </h3>
            <p>
              Know what you own.
              <br />
              Know where you stand.
            </p>
            <Link href="/research">
              Explore your rights <ArrowUpRight size={14} />
            </Link>
          </div>
          <button className="help-link" onClick={() => setPanel("help")}>
            <CircleHelp size={17} /> A hand when you need it{" "}
            <ArrowUpRight size={13} />
          </button>
          <div className="sidebar-foot">
            <span className="status-dot" /> Built for the everyday consumer
          </div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button desktop-collapse"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setCollapsed(!collapsed)}
            >
              <PanelLeftClose size={17} />
            </button>
            <button
              className="icon-button mobile-toggle"
              aria-label={mobile ? "Close navigation" : "Open navigation"}
              onClick={() => setMobile(!mobile)}
            >
              {mobile ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span>Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{active}</strong>
          </div>
          <div className="topbar-actions">
            <span className="local-status">
              <span className="status-dot" /> {backendConfigured() ? "Backend configured" : "Browser-local mode"}
            </span>
            <span className="topbar-divider" />
            <button
              className="notification-button icon-button"
              aria-label="Open activity notifications"
              onClick={() => setPanel("notifications")}
            >
              <Bell size={18} />
              <span />
            </button>
            <button
              className="user-avatar"
              aria-label="Workspace settings"
              onClick={() => setPanel("workspace")}
            >
              AM
            </button>
          </div>
        </header>
        <main key={pathname}>{children}</main>
        <footer className="main-footer">
          <span>YOUR PURCHASES. YOUR PROOF. YOUR POWER.</span>
          <span>
            Hackops-CR <span className="footer-dot">✦</span> Local-first ·
            USD
          </span>
        </footer>
      </div>
      <div
        className={`toast ${message ? "visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {message && (
          <>
            <Check size={17} />
            {message}
          </>
        )}
      </div>
      {panel === "workspace" && (
        <Modal
          title="Make yourself at home."
          description={backendConfigured()
            ? "Records sync to the configured private workspace. Sample records are fictional."
            : "Records and documents stay in this browser. Sample records are fictional."}
          onClose={() => setPanel(null)}
        >
          <div className="settings-options">
            <button
              className="settings-option"
              onClick={() => {
                reset(false);
                setPanel(null);
              }}
            >
              <Archive size={22} />
              <span>
                <strong>Start a fresh workspace</strong>
                <small>
                  Remove current records and begin with your purchases.
                </small>
              </span>
              <ArrowUpRight size={18} />
            </button>
            <button
              className="settings-option"
              onClick={() => {
                reset(true);
                setPanel(null);
              }}
            >
              <RotateCcw size={22} />
              <span>
                <strong>Restore the demo</strong>
                <small>Replace current records with fictional examples.</small>
              </span>
              <ArrowUpRight size={18} />
            </button>
          </div>
          <p className="form-note">
            Resetting replaces your workspace records. Uploaded files remain in
            {backendConfigured()
              ? " browser storage until you clear this site’s data; connected records are also removed from the backend workspace. This is a single-device token, not an account."
              : " browser storage until you clear this site’s data. Connect the optional backend for private workspace sync."}
          </p>
        </Modal>
      )}
      {panel === "notifications" && (
        <Modal
          title="The latest in your corner."
          description="Recent activity from this workspace."
          onClose={() => setPanel(null)}
        >
          <div className="activity-list">
            {data.activities.length ? (
              data.activities.map((item) => (
                <div className="activity-row" key={item.id}>
                  <span className="activity-icon">
                    <ShieldCheck size={17} />
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </div>
                  <small>{item.date}</small>
                </div>
              ))
            ) : (
              <p className="muted">
                All quiet for now. Your next action will appear here.
              </p>
            )}
          </div>
        </Modal>
      )}
      {panel === "help" && (
        <Modal
          title="A clearer path forward."
          description="A quick guide to the workspace."
          onClose={() => setPanel(null)}
        >
          <div className="help-content">
            <h3>Start with what you own.</h3>
            <p>
              Add a product to your warranty vault and attach a receipt. Files
              receive a SHA-256 integrity hash and sync when the backend is connected.
            </p>
            <h3>Turn a problem into a plan.</h3>
            <p>
              Draft a case in the command center, review the notice, and export
              it. Record it as sent after you contact the merchant yourself.
            </p>
            <h3>Read between the lines.</h3>
            <p>
              Paste contract text into the terms agent to try keyword screening
              and exact-sentence retrieval. Public recall lookup is available
              when connected; no legal eligibility is determined.
            </p>
          </div>
          <Link
            className="button button-primary"
            href="/research"
            onClick={() => setPanel(null)}
          >
            Visit the research library <ArrowUpRight size={16} />
          </Link>
        </Modal>
      )}
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <Chrome>{children}</Chrome>
    </WorkspaceProvider>
  );
}
