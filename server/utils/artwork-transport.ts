import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fetch as fetchWithProxy, ProxyAgent } from "undici";

const execute = promisify(execFile);
let systemProxy: Promise<ProxyAgent | undefined> | undefined;

function windowsArtworkProxy() {
  systemProxy ??= (async () => {
    try {
      // Ask Windows only for the public proxy address, without reading credentials.
      const { stdout } = await execute("powershell.exe", [
        "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command",
        "$cardUri = [Uri]'https://lycee-tcg.com/card/image/LO-0001.png'; [System.Net.WebRequest]::DefaultWebProxy.GetProxy($cardUri).GetComponents([System.UriComponents]::SchemeAndServer, [System.UriFormat]::Unescaped)",
      ], { encoding: "utf8", windowsHide: true, timeout: 3000 });
      const proxy = new URL(stdout.trim());
      if (!["http:", "https:"].includes(proxy.protocol) || proxy.hostname === "lycee-tcg.com" || proxy.username || proxy.password) return;
      return new ProxyAgent(proxy.href);
    } catch { return; }
  })();
  return systemProxy;
}

export async function fetchOfficialArtwork(source: string, options: { credentials: "omit"; redirect: "error"; signal: AbortSignal }) {
  const dispatcher = process.platform === "win32" ? await windowsArtworkProxy() : undefined;
  return dispatcher ? fetchWithProxy(source, { ...options, dispatcher }) : fetch(source, options);
}
