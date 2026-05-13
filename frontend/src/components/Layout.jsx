import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import FaultyTerminal from "@/components/FaultyTerminal";
import FlowingMenu from "@/components/FlowingMenu";
import OnboardingModal from "@/components/OnboardingModal";

export default function Layout({ children, onRunPipeline, running }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const navItems = [
    { text: "Home", to: "/", end: true, image: "https://picsum.photos/600/400?random=21" },
    { text: "Dashboard", to: "/dashboard", image: "https://picsum.photos/600/400?random=22" },
    { text: "Alerts", to: "/alerts", image: "https://picsum.photos/600/400?random=23" },
    { text: "Supplier Profile", to: "/suppliers", image: "https://picsum.photos/600/400?random=24" },
    { text: "Analytics", to: "/analytics", image: "https://picsum.photos/600/400?random=25" },
  ];

  return (
    <div className="app-shell">
      <div className="app-terminal-background" aria-hidden="true">
        <FaultyTerminal
          scale={3}
          gridMul={[2, 1]}
          digitSize={0.5}
          timeScale={3}
          pause={false}
          scanlineIntensity={0.5}
          glitchAmount={1}
          flickerAmount={1}
          noiseAmp={1}
          chromaticAberration={0}
          dither={0}
          curvature={0.5}
          tint="#A7EF9E"
          mouseReact
          mouseStrength={2}
          pageLoadAnimation
          brightness={0.55}
          className="terminal-canvas terminal-background-canvas"
        />
      </div>

      <div className="app-content-layer">
        <header className="topbar">
          <div>
            <h1>SCOUT Control Tower</h1>
            <p>Supply disruption intelligence across ingest, NLP, risk, and suppliers.</p>
          </div>
          <div className="topbar-actions">
            <button
              className="cta cta-menu"
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="app-sidebar-menu"
              aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            >
              <span className="menu-icon" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>
            <button className="cta" type="button" onClick={() => setOnboardingOpen(true)} disabled={running}>
              {running ? "Working..." : "Onboard"}
            </button>
          </div>
        </header>

        <div
          className={`sidebar-backdrop ${menuOpen ? "is-open" : ""}`.trim()}
          onClick={() => setMenuOpen(false)}
          aria-hidden={!menuOpen}
        />

        <aside
          id="app-sidebar-menu"
          className={`sidebar-menu ${menuOpen ? "is-open" : ""}`.trim()}
          aria-hidden={!menuOpen}
        >
          <div className="sidebar-menu__head">
            <h2>Navigation</h2>
            <button
              className="sidebar-close"
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
            >
              Close
            </button>
          </div>
          <div className="sidebar-menu__body">
            <FlowingMenu
              items={navItems.map((item) => {
                const active = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);
                return {
                  link: item.to,
                  text: item.text,
                  image: item.image,
                  active,
                  onClick: () => {
                    navigate(item.to);
                    setMenuOpen(false);
                  },
                };
              })}
              speed={18}
              textColor="#f4f8f3"
              bgColor="#0b1110"
              marqueeBgColor="#d9f99d"
              marqueeTextColor="#0a0f0c"
              borderColor="rgba(167,239,158,0.55)"
            />
          </div>
        </aside>

        <main className="content">{children}</main>
      </div>

      <OnboardingModal
        open={onboardingOpen}
        loading={running}
        onClose={() => setOnboardingOpen(false)}
        onSubmit={async (payload) => {
          await onRunPipeline(payload);
          setOnboardingOpen(false);
        }}
      />
    </div>
  );
}
