// Compatibility loader. New embeds should load oneko-smort-v4.js directly.
(function loadCurrentOnekoSmort() {
  "use strict";

  const script = document.currentScript;
  if (!script) return;

  const currentScript = document.createElement("script");
  currentScript.src = new URL(
    "oneko-smort-v4.js",
    script.src || document.baseURI,
  ).href;
  currentScript.async = false;

  for (const attribute of script.attributes) {
    if (attribute.name.startsWith("data-")) {
      currentScript.setAttribute(attribute.name, attribute.value);
    }
  }

  script.insertAdjacentElement("afterend", currentScript);
})();
