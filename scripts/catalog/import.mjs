import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";

const source = process.argv[2];
if (!source)
  throw new Error(
    "Usage: npm run catalog:import -- <public legacy repository directory>",
  );
const sources = [
  "data/catalog.json",
  "lycee-japanese-database-final.json",
  "lycee-chinese-database-final.json",
];
const inputs = sources.map((file) => readFileSync(join(resolve(source), file)));
const sourceHashes = Object.fromEntries(
  sources.map((file, i) => [
    file,
    createHash("sha256").update(inputs[i]).digest("hex"),
  ]),
);
const [catalog, ja, zh] = inputs.map(
  (buffer) => JSON.parse(buffer.toString("utf8")).cards,
);
const japanese = new Map(ja.map((card) => [card.code, card]));
const chinese = new Map(zh.map((card) => [card.code, card]));
const codes = new Set();
const unknownSeries = [];
const missingTranslations = [];
const cards = catalog
  .map((card) => {
    if (!/^LO-[0-9]+[A-Za-z0-9-]*$/.test(card.code) || codes.has(card.code))
      throw new Error(`Invalid/duplicate code: ${card.code}`);
    codes.add(card.code);
    if (!card.brand || card.brand === "-") unknownSeries.push(card.code);
    if (!chinese.get(card.code)?.japaneseText)
      missingTranslations.push(card.code);
    const image = new URL(card.img);
    if (image.protocol !== "https:" || image.hostname !== "lycee-tcg.com")
      throw new Error(`Unexpected image source for ${card.code}`);
    return {
      ...card,
      printingId: card.code,
      // Identity mapping is deliberately unresolved; a suffix is not a rules identity.
      identityId: null,
      series: card.brand && card.brand !== "-" ? card.brand : "其他卡牌",
      textJa: japanese.get(card.code)?.japaneseText ?? "",
      textZh: chinese.get(card.code)?.japaneseText ?? "",
    };
  })
  .sort((a, b) => a.code.localeCompare(b.code, "en", { numeric: true }));
const serialized = JSON.stringify(cards) + "\n";
const hash = createHash("sha256").update(serialized).digest("hex");
const manifest = {
  schemaVersion: 1,
  catalogVersion: hash,
  cardCount: cards.length,
  sourceRepository: "https://github.com/Inferno-Dragon123/lycee-toolbox",
  sourceHashes,
  imageSource: "https://lycee-tcg.com/card/image/",
  identityMapping: "unresolved",
  unknownSeries,
  missingTranslations,
};
mkdirSync("data", { recursive: true });
writeFileSync("data/cards.json", serialized);
writeFileSync("data/manifest.json", JSON.stringify(manifest, null, 2) + "\n");
console.log(
  JSON.stringify({
    count: cards.length,
    sha256: hash,
    unknownSeries: unknownSeries.length,
    missingTranslations: missingTranslations.length,
  }),
);
