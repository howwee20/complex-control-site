(() => {
  const controllerUrl = "/field-update.html";

  const isHardwareControl = (element) => {
    if (!element) return false;
    const label = element.textContent.trim().toLowerCase();
    return label === "race control" || label === "connect hardware" || label === "connect to hardware";
  };

  const synchronizeHardwareLinks = () => {
    document
      .querySelectorAll('a[href*="complex-control.local:8000"], a[href="http://10.42.0.1:8000"]')
      .forEach((link) => {
        link.href = controllerUrl;
      });

    const nav = document.querySelector(".topbar nav");
    if (nav && !nav.querySelector("[data-field-controller]")) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.fieldController = "true";
      button.textContent = "Race Control";
      nav.append(button);
    }
  };

  document.addEventListener(
    "click",
    (event) => {
      const action = event.target.closest("button, a");
      if (!isHardwareControl(action)) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.assign(controllerUrl);
    },
    true,
  );

  new MutationObserver(synchronizeHardwareLinks).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  synchronizeHardwareLinks();
})();
