"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, ShieldCheck, Menu, X, User } from "lucide-react";

export function LandingChrome({ children }: { children: React.ReactNode }) {
  const [menu, setMenu] = useState(false);
  return (
    <div className="landing-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="landing-nav">
        <Link className="landing-brand" href="/" aria-label="CartMax home">
          <span className="brand-mark-circle">
            <ShieldCheck size={20} strokeWidth={2.2} />
          </span>
          <span className="brand-text">
            Cart<strong>Max</strong>
          </span>
        </Link>
        <nav
          aria-label="Landing page navigation"
          className={menu ? "landing-nav-links is-open" : "landing-nav-links"}
        >
          <a className="is-active" href="#home" onClick={() => setMenu(false)}>
            Home
          </a>
          <a href="#about" onClick={() => setMenu(false)}>
            About
          </a>
          <a href="#features" onClick={() => setMenu(false)}>
            The toolkit
          </a>
          <a href="#how-it-works" onClick={() => setMenu(false)}>
            How it works
          </a>
          <Link href="/research" onClick={() => setMenu(false)}>
            Research
          </Link>
          <Link
            className="mobile-menu-cta"
            href="/dashboard"
            onClick={() => setMenu(false)}
          >
            Open CartMax <ArrowUpRight size={15} />
          </Link>
        </nav>
        <div className="landing-nav-actions">
          <Link className="landing-login-link" href="/dashboard">
            <User size={15} /> Sign In
          </Link>
          <Link className="landing-nav-cta" href="/dashboard">
            Open CartMax <ArrowUpRight size={15} />
          </Link>
          <button
            className="landing-menu-button"
            aria-label={menu ? "Close navigation" : "Open navigation"}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>
      <main className="landing-main" id="main-content">
        {children}
      </main>
      <footer className="landing-footer">
        <div className="landing-footer-top">
          <div className="footer-brand-col">
            <Link className="landing-brand" href="/">
              <span className="brand-mark-circle">
                <ShieldCheck size={20} strokeWidth={2.2} />
              </span>
              <span className="brand-text">
                Cart<strong>Max</strong>
              </span>
            </Link>
            <p>
              Consumer intelligence made simple. Effortless purchase tracking,
              smart warranty vaults, and dispute resolution for everyone.
            </p>
          </div>
          <div className="footer-link-group">
            <span>THE WORKSPACE</span>
            <Link href="/command-center">Command center</Link>
            <Link href="/scan">Product scanner</Link>
            <Link href="/lexibot">Terms agent</Link>
            <Link href="/warranty-vault">Warranty vault</Link>
          </div>
          <div className="footer-link-group">
            <span>EXPLORE</span>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/research">Research library</Link>
            <a href="#faq">Common questions</a>
            <a href="#features">Explore the toolkit</a>
          </div>
          <div className="landing-footer-note">
            <span className="status-dot" /> PRIVATE &amp; SECURE
            <p>
              Everything is saved securely in your browser. No unwanted tracking.
            </p>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <span>© 2026 CartMax · All Rights Reserved</span>
          <span>Designed with care for everyday shoppers &amp; families.</span>
          <span>Local-first · Optional backend · USD</span>
        </div>
      </footer>
    </div>
  );
}
