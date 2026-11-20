// @vitest-environment jsdom
// W2-10: o aviso de iPhone aparece só no Safari/iOS sem instalação, e dispensado não volta.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initLocale, t } from "../i18n";
import { IOS_NOTICE_KEY, isIosNotInstalled, type InstallEnv } from "../services/install";
import { IosInstallNotice } from "./IosInstallNotice";

const ios: InstallEnv = { navigatorStandalone: false, displayStandalone: false, hasInstallPrompt: false };
const g = globalThis as Record<string, unknown>;

function setEnv(env: InstallEnv) {
  Object.defineProperty(navigator, "standalone", { value: env.navigatorStandalone, configurable: true });
  window.matchMedia = ((query: string) => ({ matches: env.displayStandalone && query.includes("standalone") })) as typeof window.matchMedia;
  if (env.hasInstallPrompt) g["onbeforeinstallprompt"] = null;
  else delete g["onbeforeinstallprompt"];
}

function renderNotice() {
  const router = createMemoryRouter([{ path: "/", element: <IosInstallNotice /> }]);
  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  localStorage.clear();
  initLocale(["en"]);
});
afterEach(() => {
  cleanup();
  delete (navigator as { standalone?: unknown }).standalone;
  delete g["onbeforeinstallprompt"];
});

describe("detecção por função", () => {
  it("só Safari/iOS sem instalação", () => {
    expect(isIosNotInstalled(ios)).toBe(true);
    expect(isIosNotInstalled({ ...ios, navigatorStandalone: true })).toBe(false); // instalado no iOS
    expect(isIosNotInstalled({ ...ios, navigatorStandalone: undefined })).toBe(false); // Chrome/Firefox no desktop ou Android
    expect(isIosNotInstalled({ ...ios, displayStandalone: true })).toBe(false);
    expect(isIosNotInstalled({ ...ios, hasInstallPrompt: true })).toBe(false); // Chrome do Android: instala pelo próprio prompt
  });
});

describe("IosInstallNotice", () => {
  it("aparece no Safari/iOS sem instalação, com os passos e o lembrete de exportar", () => {
    setEnv(ios);
    renderNotice();
    expect(screen.getByText(t("install.ios.title"))).toBeTruthy();
    expect(screen.getByText(t("install.ios.steps"))).toBeTruthy();
    expect(screen.getByText(t("install.ios.export"))).toBeTruthy();
  });

  it("não aparece no Android/desktop, nem instalado", () => {
    for (const env of [{ ...ios, navigatorStandalone: undefined, hasInstallPrompt: true }, { ...ios, navigatorStandalone: true }, { ...ios, navigatorStandalone: undefined }]) {
      cleanup();
      setEnv(env);
      renderNotice();
      expect(screen.queryByText(t("install.ios.title"))).toBeNull();
    }
  });

  it("dispensou, não volta (nem ao abrir de novo)", () => {
    setEnv(ios);
    renderNotice();
    fireEvent.click(screen.getByRole("button", { name: t("install.ios.dismiss") }));
    expect(screen.queryByText(t("install.ios.title"))).toBeNull();
    expect(localStorage.getItem(IOS_NOTICE_KEY)).toBe("1");
    cleanup();
    renderNotice();
    expect(screen.queryByText(t("install.ios.title"))).toBeNull();
  });

  it("textos nos dois idiomas", () => {
    for (const locale of ["en", "pt-BR"]) {
      initLocale([locale]);
      for (const key of ["install.ios.title", "install.ios.steps", "install.ios.export", "install.ios.settings", "install.ios.dismiss"] as const) {
        expect(t(key)).not.toBe(key);
      }
    }
    expect(t("install.ios.title")).toContain("iPhone");
  });
});
