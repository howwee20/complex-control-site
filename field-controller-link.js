(() => {
  // Compatibility for cached public bundles. React owns current navigation;
  // opening Race Control must never turn into an update request.
  const synchronizeHardwareLinks = () => {
    const nav = document.querySelector(".topbar nav");
    if (nav?.hasAttribute("data-controller-navigation")) return;
    if (nav && !nav.querySelector("[data-field-controller]")) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.fieldController = "true";
      button.textContent = "Race Control";
      button.addEventListener("click", () => window.location.assign("/?view=connect"));
      nav.append(button);
    }
  };

  new MutationObserver(synchronizeHardwareLinks).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  synchronizeHardwareLinks();
})();
