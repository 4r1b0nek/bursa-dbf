/* Registrasi PWA + tombol "Pasang aplikasi" (Android/Chrome). */
(() => {
  const buttons = () => document.querySelectorAll("[data-install-app]");
  let deferredPrompt = null;
  let available = false;

  const refresh = () => {
    buttons().forEach((btn) => { btn.hidden = !available; });
  };

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js", { updateViaCache: "none" })
        .catch((err) => console.warn("Service worker gagal:", err));
    });
  }

  if (window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true) {
    available = false;
    refresh();
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    available = true;
    refresh();
  });

  document.addEventListener("click", async (event) => {
    const btn = event.target.closest?.("[data-install-app]");
    if (!btn || !deferredPrompt) return;
    event.preventDefault();
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } finally {
      deferredPrompt = null;
      available = false;
      refresh();
    }
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    available = false;
    refresh();
    console.info("Bursa DBF dipasang sebagai PWA.");
  });

  new MutationObserver(refresh).observe(document.documentElement, { childList: true, subtree: true });
  refresh();
})();
