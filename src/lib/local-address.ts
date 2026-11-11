/**
 * Whether a server address is on this computer or the local network, where
 * plain HTTP is a reasonable choice (and the only one iOS allows over HTTP).
 * Anything else, over HTTP, sends the password and the sync token in clear text.
 * Pure: takes the address as a string.
 */
export function isLocalAddress(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  host = host.replace(/^\[|\]$/g, ""); // IPv6 literals come in brackets
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".lan"))
    return true;
  if (host.endsWith(".home.arpa") || host.endsWith(".internal")) return true;
  // A single-label name ("nas") resolves on the local network only
  if (/^[a-z0-9-]+$/.test(host) && !/^\d+$/.test(host)) return true;

  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 127 || // loopback
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) || // link-local
      (a === 100 && b >= 64 && b <= 127) // carrier-grade NAT, as Tailscale uses
    );
  }
  if (host.includes(":")) {
    return host === "::1" || /^f[cd][0-9a-f]{2}:/.test(host) || /^fe[89ab][0-9a-f]:/.test(host);
  }
  return false;
}

/** True when signing in to `url` would send the password unencrypted over the internet. */
export function isInsecureRemote(url: string): boolean {
  return url.trim().toLowerCase().startsWith("http://") && !isLocalAddress(url.trim());
}
