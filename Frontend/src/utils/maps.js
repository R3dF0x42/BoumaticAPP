const MOBILE_UA_REGEX =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;

export function isMobileDevice() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  const ua = navigator.userAgent || "";
  if (MOBILE_UA_REGEX.test(ua)) return true;

  return (
    navigator.maxTouchPoints > 0 &&
    window.matchMedia("(max-width: 1024px)").matches
  );
}

export function buildMapAppLinks({ lat = null, lng = null, address = "" } = {}) {
  const hasCoords =
    lat !== null &&
    lat !== undefined &&
    lng !== null &&
    lng !== undefined &&
    lat !== "" &&
    lng !== "";
  const safeAddress = String(address || "").trim();

  if (!hasCoords && !safeAddress) return null;

  if (hasCoords) {
    const coord = `${lat},${lng}`;
    return {
      google: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coord)}`,
      waze: `https://waze.com/ul?ll=${encodeURIComponent(coord)}&navigate=yes`,
      apple: `https://maps.apple.com/?ll=${encodeURIComponent(coord)}`
    };
  }

  const query = encodeURIComponent(safeAddress);
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${query}`,
    waze: `https://waze.com/ul?q=${query}&navigate=yes`,
    apple: `https://maps.apple.com/?q=${query}`
  };
}
