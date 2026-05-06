type InstallChoice = {
  outcome: "accepted" | "dismissed";
  platform?: string;
};

type BeforeInstallPromptEvent = Event & {
  platforms?: string[];
  prompt: () => Promise<InstallChoice>;
  userChoice: Promise<InstallChoice>;
};

const isIos = (): boolean => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

const isStandalone = (): boolean => {
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
};

const isTouchDevice = (): boolean => window.matchMedia("(hover: none), (pointer: coarse)").matches;

export function setupInstallPrompt(): void {
  const installButton = document.querySelector<HTMLButtonElement>("#install-app");
  const installHelp = document.querySelector<HTMLElement>("#install-help");
  const installHelpCopy = installHelp?.querySelector<HTMLElement>("[data-install-help-copy]");
  const installHelpClose = installHelp?.querySelector<HTMLButtonElement>("[data-install-help-close]");
  let deferredPrompt: BeforeInstallPromptEvent | null = null;

  if (!installButton || isStandalone()) return;

  const hideInstallUi = (): void => {
    installButton.classList.add("is-hidden");
    installHelp?.classList.add("is-hidden");
  };

  const showInstallButton = (): void => {
    installButton.classList.remove("is-hidden");
  };

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    showInstallButton();
  });

  installButton.addEventListener("click", async () => {
    if (deferredPrompt) {
      const promptEvent = deferredPrompt;
      deferredPrompt = null;
      installButton.classList.add("is-hidden");
      await promptEvent.prompt();
      return;
    }

    if (isIos()) {
      if (installHelpCopy) installHelpCopy.textContent = "Use Share, then Add to Home Screen.";
      installHelp?.classList.remove("is-hidden");
      return;
    }

    if (installHelpCopy) installHelpCopy.textContent = "Open the browser menu, then choose Install app or Add to Home screen.";
    installHelp?.classList.remove("is-hidden");
  });

  installHelpClose?.addEventListener("click", () => {
    installHelp?.classList.add("is-hidden");
  });

  window.addEventListener("appinstalled", hideInstallUi);

  if (isTouchDevice()) {
    showInstallButton();
  }
}
