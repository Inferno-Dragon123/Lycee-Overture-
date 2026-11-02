import type { Card } from "#shared/domain/catalog";
import { categoryLabels } from "#shared/domain/catalog";
import {
  printLayout,
  printCards,
  type PrintSettings,
} from "#shared/domain/exports";
import { cardTextureSource } from "#shared/domain/card-artwork";
export interface RenderedPages {
  images: string[];
  width: number;
  height: number;
  missing: string[];
}
const cache = new Map<string, Promise<HTMLImageElement>>();
function load(card: Card) {
  const src = cardTextureSource(card.img);
  let pending = cache.get(src);
  if (!pending) {
    pending = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      const timer = setTimeout(() => {
        image.src = "";
        reject(new Error(card.code));
      }, 16000);
      image.onload = () => {
        clearTimeout(timer);
        resolve(image);
      };
      image.onerror = () => {
        clearTimeout(timer);
        reject(new Error(card.code));
      };
      image.src = src;
    });
    if (cache.size >= 128) cache.delete(cache.keys().next().value!);
    cache.set(src, pending);
    pending.catch(() => cache.delete(src));
  }
  return pending;
}
export async function renderPrint(
  name: string,
  q: Record<string, number>,
  catalog: Map<string, Card>,
  settings: PrintSettings,
  list = false,
  signal?: AbortSignal,
): Promise<RenderedPages> {
  const cards = printCards(q, catalog),
    unique = [...new Map(cards.map((c) => [c.code, c])).values()],
    missing: string[] = [],
    images = new Map<string, HTMLImageElement>();
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, unique.length) }, async () => {
      while (cursor < unique.length) {
        if (signal?.aborted) throw new Error("cancelled");
        const c = unique[cursor++]!;
        try {
          images.set(c.code, await load(c));
        } catch {
          missing.push(c.code);
        }
      }
    }),
  );
  if (signal?.aborted) throw new Error("cancelled");
  const s = list
    ? {
        pageWidth: 210,
        pageHeight: 297,
        cardWidth: 63,
        cardHeight: 88,
        margin: 7,
        gap: 1,
      }
    : settings;
  const layout = printLayout(s),
    source = list ? unique : cards,
    perPage = list ? 12 : layout.perPage,
    result: string[] = [];
  const scale = 200 / 25.4;
  for (let start = 0; start < Math.max(1, source.length); start += perPage) {
    if (signal?.aborted) throw new Error("cancelled");
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(s.pageWidth * scale);
    canvas.height = Math.round(s.pageHeight * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, s.pageWidth, s.pageHeight);
    ctx.fillStyle = "#17241d";
    if (list) {
      ctx.font = "bold 6px sans-serif";
      ctx.fillText(name || "未命名卡组", 10, 14, 190);
      ctx.font = "3.2px sans-serif";
      ctx.fillText(
        `LYCEE OVERTURE · ${cards.length} 张 · ${unique.length} 种 · ${Math.floor(start / perPage) + 1} / ${Math.max(1, Math.ceil(source.length / perPage))}`,
        10,
        22,
      );
    }
    source.slice(start, start + perPage).forEach((c, i) => {
      const x = list
          ? 10
          : layout.x + (i % layout.columns) * (s.cardWidth + s.gap),
        y = list
          ? 30 + i * 21
          : layout.y + Math.floor(i / layout.columns) * (s.cardHeight + s.gap),
        w = list ? 13 : s.cardWidth,
        h = list ? 18.16 : s.cardHeight;
      const image = images.get(c.code);
      if (image) {
        const fit = Math.min(w / image.width, h / image.height);
        ctx.drawImage(
          image,
          x + (w - image.width * fit) / 2,
          y + (h - image.height * fit) / 2,
          image.width * fit,
          image.height * fit,
        );
      } else {
        ctx.strokeStyle = "#999";
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = "#333";
        ctx.font = "2.8px sans-serif";
        ctx.fillText(c.code, x + 1, y + h / 2, w - 2);
      }
      if (list) {
        ctx.fillStyle = "#17241d";
        ctx.font = "bold 3.5px sans-serif";
        ctx.fillText(`${c.code}  × ${q[c.code]}    ${c.name}`, 28, y + 5, 170);
        ctx.font = "3px sans-serif";
        ctx.fillText(
          `${categoryLabels[c.category] || c.category} · ${c.attribute} · 费用 ${c.cost || "—"} · EX ${c.ex ?? "—"}`,
          28,
          y + 11,
          170,
        );
        ctx.fillText(`${c.version} · ${c.rarity}`, 28, y + 16, 170);
        ctx.strokeStyle = "#ddd";
        ctx.beginPath();
        ctx.moveTo(10, y + 20);
        ctx.lineTo(200, y + 20);
        ctx.stroke();
      }
    });
    result.push(canvas.toDataURL("image/png"));
    canvas.width = canvas.height = 1;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return { images: result, width: s.pageWidth, height: s.pageHeight, missing };
}
export async function downloadPdf(name: string, pages: RenderedPages) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({
    orientation: pages.width > pages.height ? "l" : "p",
    unit: "mm",
    format: [pages.width, pages.height],
    compress: true,
  });
  pages.images.forEach((image, i) => {
    if (i)
      pdf.addPage(
        [pages.width, pages.height],
        pages.width > pages.height ? "l" : "p",
      );
    pdf.addImage(
      image,
      "PNG",
      0,
      0,
      pages.width,
      pages.height,
      undefined,
      "FAST",
    );
  });
  pdf.save(`${name || "卡组"}.pdf`);
}
export function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name || "卡组"}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
