"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, ShieldCheck, Menu, X } from "lucide-react";

export function LandingChrome({ children }: { children: React.ReactNode }) {
  const [menu, setMenu] = useState(false);
  return (
    <div className="landing-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="landing-nav">
        <Link className="landing-brand" href="/" aria-label="Hackops-CR home">
          <ShieldCheck size={25} strokeWidth={1.6} />
          <span>
            Hackops<span>-CR</span>
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
          <Link href="/research">Research</Link>
        </nav>
        <div className="landing-nav-actions">
          <Link className="landing-nav-cta" href="/dashboard">
            Your workspace <ArrowUpRight size={15} />
          </Link>
          <button
            className="landing-menu-button"
            aria-label={menu ? "Close navigation" : "Open navigation"}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </header>
      <main className="landing-main" id="main-content">
        {children}
      </main>
      <footer className="landing-footer">
        <div className="landing-footer-top">
          <div>
            <Link className="landing-brand" href="/">
              <ShieldCheck size={25} />
              <span>
                Hackops<span>-CR</span>
              </span>
            </Link>
            <p>
              Consumer intelligence. Everyday confidence.
              <br />
              Your purchases, your proof, your power.
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
            <span>TAKE A LOOK</span>
            <Link href="/dashboard">Your dashboard</Link>
            <Link href="/research">Research library</Link>
            <a href="#faq">Common questions</a>
            <a href="#features">Explore the toolkit</a>
          </div>
          <div className="landing-footer-note">
            <span className="status-dot" /> FRONTEND PREVIEW
            <p>
              Built to bring a little more
              <br />
              clarity to consumer life.
            </p>
          </div>
        </div>
        <div className="footer-wordmark" aria-hidden="true">
          YOUR MOVE<span>↗</span>
        </div>
        <div className="landing-footer-bottom">
          <span>© 2026 Hackops-CR</span>
          <span>DESIGNED AROUND THE CONSUMER.</span>
          <span>Local-first · Optional backend</span>
        </div>
      </footer>
    </div>
  );
}
