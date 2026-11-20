// Casca: barra de cima (marca e idioma), conteúdo da rota e navegação inferior.
import { useEffect, useRef, type MouseEvent } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import type { MessageKey } from "../i18n";
import { LanguageSelector } from "./LanguageSelector";
import { useT } from "./useT";

const NAV: ReadonlyArray<{ to: string; label: MessageKey; end?: boolean }> = [
  { to: "/", label: "nav.home", end: true },
  { to: "/profile", label: "nav.profile" },
  { to: "/settings", label: "nav.settings" },
  { to: "/about", label: "nav.about" },
];

export function Layout() {
  const t = useT();
  const { pathname } = useLocation();
  const lastPath = useRef(pathname);

  // Ao trocar de rota, o foco vai para o título da tela nova (não na primeira carga).
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    document.getElementById("page-title")?.focus();
  }, [pathname]);

  // "Pular para o conteúdo" sem mexer no histórico (um href="#main" empilharia uma entrada no botão Voltar).
  function skipToContent(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    document.getElementById("main")?.focus();
  }

  return (
    <div className="shell">
      <a className="skip-link" href="#main" onClick={skipToContent}>
        {t("a11y.skip")}
      </a>
      <header className="top-bar">
        <span className="brand">{t("app.name")}</span>
        <LanguageSelector />
      </header>
      <main id="main" tabIndex={-1} className="page">
        <Outlet />
      </main>
      <nav className="bottom-nav" aria-label={t("nav.label")}>
        <ul>
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end}>
                {t(item.label)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
