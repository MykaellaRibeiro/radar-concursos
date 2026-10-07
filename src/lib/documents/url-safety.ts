import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_HOSTNAMES = new Set(["localhost", "localhost.localdomain", "metadata.google.internal"]);

function ipv4ToNumber(address: string): number {
  return address.split(".").reduce((value, octet) => (value << 8) + Number(octet), 0) >>> 0;
}

function inIpv4Range(address: string, base: string, prefix: number): boolean {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipv4ToNumber(address) & mask) === (ipv4ToNumber(base) & mask);
}

export function isBlockedIp(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    return [
      ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
      ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
      ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
      ["224.0.0.0", 4], ["240.0.0.0", 4],
    ].some(([base, prefix]) => inIpv4Range(address, String(base), Number(prefix)));
  }
  if (version === 6) {
    const normalized = address.toLowerCase();
    const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    if (mappedIpv4) return isBlockedIp(mappedIpv4);
    return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd")
      || /^fe[89ab]/.test(normalized)
      || normalized.startsWith("2001:db8:");
  }
  return true;
}

export async function assertSafeDocumentUrl(
  value: string,
  resolver: (hostname: string) => Promise<Array<{ address: string }>> = async (hostname) => lookup(hostname, { all: true }),
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("URL de documento inválida.");
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Somente URLs HTTP/HTTPS são aceitas.");
  if (url.username || url.password) throw new Error("URLs com credenciais não são aceitas.");
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("Host local ou de metadata bloqueado.");
  }
  if (isIP(hostname)) {
    if (isBlockedIp(hostname)) throw new Error("Endereço IP privado ou reservado bloqueado.");
    return url;
  }
  const addresses = await resolver(hostname);
  if (!addresses.length || addresses.some(({ address }) => isBlockedIp(address))) {
    throw new Error("O host resolve para endereço privado, reservado ou desconhecido.");
  }
  return url;
}
