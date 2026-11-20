// @vitest-environment jsdom
// W2-17 (D-52): a rua da vila, com um fixture de 6 locais.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initLocale, t, type MessageKey } from "../i18n";
import { STREET_POS_KEY, Street, type StreetPlace } from "./Street";
import { BAKERY } from "./art/sprites";

const NAMES: MessageKey[] = ["place.bakery", "place.tavern", "place.bakery", "place.tavern", "place.bakery", "place.tavern"];
const six: StreetPlace[] = NAMES.map((name, i) => ({ id: i % 2 === 0 ? "bakery" : "tavern", name, art: BAKERY }));

// jsdom não tem layout: cada espaço "mede" 100 px e o scrollTo vira scrollLeft.
beforeEach(() => {
  localStorage.clear();
  initLocale(["en"]);
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get: () => 100 });
  HTMLElement.prototype.scrollTo = function (this: HTMLElement, options?: ScrollToOptions | number) {
    this.scrollLeft = typeof options === "object" ? (options.left ?? 0) : 0;
    fireEvent.scroll(this);
  } as typeof HTMLElement.prototype.scrollTo;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const renderStreet = (places: StreetPlace[], locked: (typeof BAKERY)[] = []) =>
  render(
    <MemoryRouter>
      <Street places={places} locked={locked} />
    </MemoryRouter>,
  );

describe("rua da vila", () => {
  it("é uma lista de links, um por local, para o leitor de tela", () => {
    renderStreet(six);
    expect(screen.getByRole("list", { name: t("map.places") })).toBeTruthy();
    expect(screen.getAllByRole("link")).toHaveLength(6);
    expect(screen.getAllByRole("link")[2]?.getAttribute("href")).toBe("/place/bakery");
  });

  it("com 2 locais não precisa de setas nem pontinhos", () => {
    renderStreet(six.slice(0, 2));
    expect(screen.queryByRole("button", { name: t("street.next") })).toBeNull();
  });

  it("a seta e o teclado andam um local e a posição fica guardada; no começo a seta anterior está desligada", () => {
    renderStreet(six);
    const prev = screen.getByRole("button", { name: t("street.prev") }) as HTMLButtonElement;
    const next = screen.getByRole("button", { name: t("street.next") }) as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
    fireEvent.click(next);
    expect(localStorage.getItem(STREET_POS_KEY)).toBe("1");
    expect(prev.disabled).toBe(false);
    fireEvent.keyDown(screen.getAllByRole("link")[0]!, { key: "ArrowRight" });
    expect(localStorage.getItem(STREET_POS_KEY)).toBe("2");
    fireEvent.keyDown(screen.getAllByRole("link")[0]!, { key: "ArrowLeft" });
    expect(localStorage.getItem(STREET_POS_KEY)).toBe("1");
    for (let i = 0; i < 8; i++) fireEvent.click(next);
    expect(next.disabled).toBe(true); // no último par, não há mais para onde ir
  });

  it("volta à última posição guardada", () => {
    localStorage.setItem(STREET_POS_KEY, "3");
    renderStreet(six);
    const track = document.querySelector(".street-track") as HTMLElement;
    expect(track.scrollLeft).toBe(300);
  });

  it("localStorage bloqueado não derruba a rua", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    renderStreet(six);
    fireEvent.click(screen.getByRole("button", { name: t("street.next") }));
    expect(screen.getAllByRole("link")).toHaveLength(6);
  });

  it("silhuetas trancadas são só visual: escondidas do leitor de tela e sem link", () => {
    renderStreet(six.slice(0, 2), [BAKERY, BAKERY]);
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(document.querySelectorAll(".street-locked[aria-hidden='true']")).toHaveLength(2);
  });
});
