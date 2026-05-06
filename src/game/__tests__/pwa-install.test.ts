import { afterEach, describe, expect, it, vi } from "vitest";
import { setupInstallPrompt } from "../../pwaInstall";

class FakeClassList {
  private classes = new Set<string>();

  constructor(initialClasses: string[]) {
    initialClasses.forEach((className) => this.classes.add(className));
  }

  add(className: string): void {
    this.classes.add(className);
  }

  remove(className: string): void {
    this.classes.delete(className);
  }

  contains(className: string): boolean {
    return this.classes.has(className);
  }
}

class FakeElement {
  classList: FakeClassList;
  textContent = "";
  private listeners = new Map<string, Array<() => void | Promise<void>>>();
  private children = new Map<string, FakeElement>();

  constructor(classes: string[] = []) {
    this.classList = new FakeClassList(classes);
  }

  addEventListener(type: string, listener: () => void | Promise<void>): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  async click(): Promise<void> {
    for (const listener of this.listeners.get("click") ?? []) {
      await listener();
    }
  }

  querySelector<T extends FakeElement>(selector: string): T | null {
    return (this.children.get(selector) as T | undefined) ?? null;
  }

  setChild(selector: string, child: FakeElement): void {
    this.children.set(selector, child);
  }
}

function installFakeDom(
  userAgent = "Mozilla/5.0 (Linux; Android 14) Chrome/125",
  displayMode: "browser" | "standalone" | "fullscreen" = "browser"
): {
  button: FakeElement;
  help: FakeElement;
  helpCopy: FakeElement;
  listeners: Map<string, Array<(event: Event) => void>>;
} {
  const button = new FakeElement(["is-hidden"]);
  const help = new FakeElement(["is-hidden"]);
  const helpCopy = new FakeElement();
  const close = new FakeElement();
  help.setChild("[data-install-help-copy]", helpCopy);
  help.setChild("[data-install-help-close]", close);

  const listeners = new Map<string, Array<(event: Event) => void>>();
  const fakeWindow = {
    navigator: { userAgent },
    matchMedia: vi.fn((query: string) => ({
      matches: query.includes(`display-mode: ${displayMode}`)
        || query.includes("hover: none")
        || query.includes("pointer: coarse")
    })),
    addEventListener: vi.fn((type: string, listener: (event: Event) => void) => {
      const typeListeners = listeners.get(type) ?? [];
      typeListeners.push(listener);
      listeners.set(type, typeListeners);
    })
  };
  const fakeDocument = {
    querySelector: vi.fn((selector: string) => {
      if (selector === "#install-app") return button;
      if (selector === "#install-help") return help;
      return null;
    })
  };

  vi.stubGlobal("window", fakeWindow);
  vi.stubGlobal("document", fakeDocument);

  return { button, help, helpCopy, listeners };
}

describe("setupInstallPrompt", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the Android install button hidden until the native prompt is ready", async () => {
    const { button, help } = installFakeDom();
    setupInstallPrompt();

    expect(button.classList.contains("is-hidden")).toBe(true);

    await button.click();

    expect(help.classList.contains("is-hidden")).toBe(true);
  });

  it("keeps install UI hidden when launched as a fullscreen PWA", async () => {
    const { button, help, listeners } = installFakeDom(
      "Mozilla/5.0 (Linux; Android 14) Chrome/125",
      "fullscreen"
    );
    setupInstallPrompt();

    const prompt = vi.fn().mockResolvedValue({ outcome: "accepted" });
    const event = {
      preventDefault: vi.fn(),
      prompt
    } as unknown as Event;

    listeners.get("beforeinstallprompt")?.forEach((listener) => listener(event));

    expect(button.classList.contains("is-hidden")).toBe(true);
    expect(help.classList.contains("is-hidden")).toBe(true);
    expect(prompt).not.toHaveBeenCalled();
  });

  it("stores beforeinstallprompt and calls the native prompt from a user click", async () => {
    const { button, listeners } = installFakeDom();
    setupInstallPrompt();

    const prompt = vi.fn().mockResolvedValue({ outcome: "accepted" });
    const event = {
      preventDefault: vi.fn(),
      prompt
    } as unknown as Event;

    listeners.get("beforeinstallprompt")?.forEach((listener) => listener(event));
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(button.classList.contains("is-hidden")).toBe(false);

    await button.click();
    expect(prompt).toHaveBeenCalledOnce();
    expect(button.classList.contains("is-hidden")).toBe(true);
  });

  it("shows iOS home-screen instructions when no native prompt exists", async () => {
    const { button, help, helpCopy } = installFakeDom("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    setupInstallPrompt();

    await button.click();

    expect(help.classList.contains("is-hidden")).toBe(false);
    expect(helpCopy.textContent).toBe("Use Share, then Add to Home Screen.");
  });
});
