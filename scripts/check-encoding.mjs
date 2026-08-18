import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOTS = [
  "src",
  path.join("supabase", "migrations"),
  path.join("research", "super-lig-verified"),
];
const TEXT_EXTENSIONS = new Set([".css", ".html", ".js", ".json", ".jsx", ".md", ".mjs", ".sql", ".ts", ".tsx"]);
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });
const MOJIBAKE_LEADS = new Set([0x00c3, 0x00c4, 0x00c5]);
const BROKEN_PUNCTUATION_PREFIX = 0x00e2;
const REPLACEMENT_CHARACTER = 0xfffd;
const LATIN1_REPLACEMENT_SEQUENCE = String.fromCodePoint(0x00ef, 0x00bf, 0x00bd);
const WINDOWS_1252_CODE_POINTS = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6,
  0x2030, 0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c,
  0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a,
  0x0153, 0x017e, 0x0178,
]);

const failures = [];

async function scanDirectory(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await scanDirectory(filePath);
      continue;
    }

    if (!TEXT_EXTENSIONS.has(path.extname(entry.name))) continue;
    await scanFile(filePath);
  }
}

async function scanFile(filePath) {
  const bytes = await readFile(filePath);
  let content;

  try {
    content = UTF8_DECODER.decode(bytes);
  } catch {
    failures.push(`${filePath}: geçerli UTF-8 değil`);
    return;
  }

  content.split(/\r?\n/u).forEach((line, index) => {
    const codePoints = Array.from(line, (character) => character.codePointAt(0));
    const hasMojibake = codePoints.some((codePoint, position) => {
      const nextCodePoint = codePoints[position + 1];
      const nextLooksLikeMisdecodedByte = nextCodePoint !== undefined
        && ((nextCodePoint >= 0x0080 && nextCodePoint <= 0x00bf) || WINDOWS_1252_CODE_POINTS.has(nextCodePoint));

      return codePoint === REPLACEMENT_CHARACTER
        || (MOJIBAKE_LEADS.has(codePoint) && nextLooksLikeMisdecodedByte)
        || (codePoint === BROKEN_PUNCTUATION_PREFIX && nextLooksLikeMisdecodedByte);
    }) || line.includes(LATIN1_REPLACEMENT_SEQUENCE);

    if (hasMojibake) failures.push(`${filePath}:${index + 1}: şüpheli encoding dizisi`);
  });
}

for (const root of ROOTS) await scanDirectory(root);

if (failures.length > 0) {
  console.error("Encoding doğrulaması başarısız:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Encoding doğrulaması başarılı: ${ROOTS.join(", ")}`);
}
