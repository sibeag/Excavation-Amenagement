const PHONE_CONVERSION_TARGET = "AW-18139948408/QLDFCJeO4NgcEPjK5slD";
const CONVERSION_TARGET_PATTERN = /^AW-\d+\/[A-Za-z0-9_-]+$/;

document.addEventListener("click", (event) => {
  const lienTelephone = event.target.closest('a[href^="tel:"]');

  if (
    !lienTelephone ||
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    typeof window.gtag !== "function" ||
    !CONVERSION_TARGET_PATTERN.test(PHONE_CONVERSION_TARGET)
  ) {
    return;
  }

  event.preventDefault();

  let navigationLancee = false;
  const continuerVersTelephone = () => {
    if (navigationLancee) return;
    navigationLancee = true;
    window.location.href = lienTelephone.href;
  };

  window.gtag("event", "conversion", {
    send_to: PHONE_CONVERSION_TARGET,
    value: 1.0,
    currency: "CAD",
    phone_location: lienTelephone.dataset.phoneLocation || "site",
    event_callback: continuerVersTelephone,
    event_timeout: 800,
  });

  window.setTimeout(continuerVersTelephone, 900);
});
