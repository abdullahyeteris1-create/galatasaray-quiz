import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DIR = import.meta.dirname;
const ROOT = path.resolve(DIR, "..", "..");
const BATCH_01 = path.join(DIR, "question_candidates_anadolu_hard_batch_01.json");
const BATCH_02 = path.join(DIR, "question_candidates_anadolu_hard_batch_02.json");
const REPORT = path.join(DIR, "quality_report_anadolu_hard_combined_100.md");

const [batch01, batch02] = await Promise.all([
  readFile(BATCH_01, "utf8").then(JSON.parse),
  readFile(BATCH_02, "utf8").then(JSON.parse),
]);
const combined = [...batch01, ...batch02];

const normalize = (value) => value
  .normalize("NFKD")
  .replace(/\p{M}/gu, "")
  .toLocaleLowerCase("tr-TR")
  .replace(/[^a-z0-9]+/gu, " ")
  .trim();

const duplicateValues = (values) => {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
};

const countBy = (values, selector) => values.reduce((counts, value) => {
  const key = selector(value);
  counts[key] = (counts[key] ?? 0) + 1;
  return counts;
}, {});

const sqlFiles = [];
async function collectSql(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await collectSql(fullPath);
    else if (entry.name.endsWith(".sql")) sqlFiles.push(fullPath);
  }
}
await collectSql(path.join(ROOT, "supabase", "migrations"));
const migrationText = (await Promise.all(sqlFiles.map((file) => readFile(file, "utf8")))).join("\n");
const migrationLines = migrationText.split(/\r?\n/).map(normalize);

const exactWithinCombined = duplicateValues(combined.map((item) => normalize(item.question)));
const canonicalWithinCombined = duplicateValues(combined.map((item) => item.canonical_fact_key));
const exactAgainstProduction = batch02.filter((item) => migrationText.includes(item.question));

// Semantic audit 1: same answer and every focus club on one production seed row.
const productionFootprintMatches = batch02.filter((item) => {
  const answer = normalize(item.options[item.correct_option]);
  const clubs = item.focus_clubs.map(normalize);
  return migrationLines.some((line) => line.includes(answer) && clubs.every((club) => line.includes(club)));
});

// Semantic audit 2: same answer and same complete club set in Batch 01 metadata.
const batch01FootprintMatches = batch02.filter((candidate) => batch01.some((existing) => {
  if (!existing.answer_player || normalize(existing.answer_player) !== normalize(candidate.answer_player)) return false;
  const existingClubs = new Set(existing.focus_clubs.map(normalize));
  return candidate.focus_clubs.every((club) => existingClubs.has(normalize(club)));
}));

// Semantic audit 3: high token overlap after removing the repeated quiz template words.
const stop = new Set("hangi futbolcu kulup kulubun kulubunde kulubunun hem ve de da forma giymistir giymemistir asagidaki turkiye kariyerinde rotasina sahip kimdir sezonunda sezon transfer doneminde teknik direktoru".split(" "));
const tokenSet = (question) => new Set(normalize(question).split(" ").filter((token) => token && !stop.has(token)));
const jaccard = (a, b) => {
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
};
const similarityMatches = [];
for (const candidate of batch02) {
  const a = tokenSet(candidate.question);
  for (const existing of batch01) {
    const score = jaccard(a, tokenSet(existing.question));
    if (score >= 0.82) similarityMatches.push({ candidate: candidate.candidate_id, existing: existing.candidate_id, score });
  }
}

const invalidOptions = combined.filter((item) => item.options.length !== 4 || new Set(item.options.map(normalize)).size !== 4);
const invalidCorrectIndex = combined.filter((item) => !Number.isInteger(item.correct_option) || item.correct_option < 0 || item.correct_option > 3);
const missingSources = combined.filter((item) => !item.verification_source || !item.verification_notes);
const invalidBatch02Ids = batch02.filter((item, index) => item.candidate_id !== `SL-AH-02-${String(index + 1).padStart(3, "0")}`);
const invalidStatuses = combined.filter((item) => item.status !== "accepted");

const batch02Types = countBy(batch02, (item) => item.question_type);
const batch02Difficulty = countBy(batch02, (item) => item.difficulty);
const combinedTypes = countBy(combined, (item) => item.question_type);
const combinedDifficulty = countBy(combined, (item) => item.difficulty);
const anadoluCount = combined.filter((item) => item.anadolu_weighted).length;
const clubCounts = countBy(combined.flatMap((item) => item.focus_clubs), (club) => club);
const topClubs = Object.entries(clubCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"));
const uniquePlayers = new Set(combined.flatMap((item) => item.players));

const expectedBatch02Types = {
  two_club: 7,
  three_club: 6,
  career: 5,
  did_not_play: 3,
  transfer: 2,
  scorer: 1,
  coach: 1,
};
const typesPass = Object.entries(expectedBatch02Types).every(([type, expected]) => batch02Types[type] === expected)
  && (batch02Types.season_success ?? 0) === 0;
const difficultyPass = batch02Difficulty.orta === 3 && batch02Difficulty.zor === 15 && batch02Difficulty.efsane === 7;
const semanticMatches = [
  ...canonicalWithinCombined.map((value) => ({ kind: "canonical", value })),
  ...productionFootprintMatches.map((item) => ({ kind: "production-footprint", value: item.candidate_id })),
  ...batch01FootprintMatches.map((item) => ({ kind: "batch01-footprint", value: item.candidate_id })),
  ...similarityMatches.map((item) => ({ kind: "token-similarity", value: `${item.candidate}/${item.existing}/${item.score.toFixed(2)}` })),
];

const validationPass = batch01.length === 75
  && batch02.length === 25
  && combined.length === 100
  && typesPass
  && difficultyPass
  && invalidOptions.length === 0
  && invalidCorrectIndex.length === 0
  && missingSources.length === 0
  && invalidBatch02Ids.length === 0
  && invalidStatuses.length === 0
  && exactWithinCombined.length === 0
  && exactAgainstProduction.length === 0
  && semanticMatches.length === 0;

const letters = ["A", "B", "C", "D"];
const periodLabel = (era) => era.replace("2000s-2010s", "2000'ler–2010'lar").replace("2000s", "2000'ler").replace("2010s", "2010'lar").replace("2020s", "2020'ler");
const typeLabels = {
  two_club: "İki kulüp",
  three_club: "Üç kulüp",
  career: "Kariyer",
  did_not_play: "Oynamadı",
  transfer: "Transfer",
  coach: "Teknik direktör",
  season_success: "Sezon/başarı",
  scorer: "Golcü",
  other: "Diğer",
};

const questionsMarkdown = batch02.map((item, index) => {
  const options = item.options.map((option, optionIndex) => `${letters[optionIndex]}) ${option}`).join("\n");
  const sources = (item.verification_sources ?? [item.verification_source]).map((source) => `<${source}>`).join(" | ");
  return `### ${index + 1}. ${item.candidate_id}\n\n${item.question}\n\n${options}\n\nDoğru cevap: ${letters[item.correct_option]}) ${item.options[item.correct_option]}  \nDönem: ${periodLabel(item.era)}  \nZorluk: ${item.difficulty[0].toLocaleUpperCase("tr-TR") + item.difficulty.slice(1)}  \nTür: ${typeLabels[item.question_type]}  \nKaynaklar: ${sources}`;
}).join("\n\n");

const report = `## Total New Pool

100 hedefleniyor; 100 accepted aday hazır.

## Batch 01

75

## Batch 02

25

## Combined Difficulty

Orta: ${combinedDifficulty.orta}\nZor: ${combinedDifficulty.zor}\nEfsane: ${combinedDifficulty.efsane}

## Combined Question Types

İki kulüp: ${combinedTypes.two_club ?? 0}\nÜç kulüp: ${combinedTypes.three_club ?? 0}\nKariyer: ${combinedTypes.career ?? 0}\nOynamadı: ${combinedTypes.did_not_play ?? 0}\nTransfer: ${combinedTypes.transfer ?? 0}\nTeknik direktör: ${combinedTypes.coach ?? 0}\nSezon/başarı: ${combinedTypes.season_success ?? 0}\nGolcü: ${combinedTypes.scorer ?? 0}\nDiğer: ${combinedTypes.other ?? 0}

## Anadolu Coverage

Oran: ${(anadoluCount / combined.length * 100).toFixed(1)}% (${anadoluCount}/${combined.length})

## Club Diversity

En çok kullanılan 20 kulüp: ${topClubs.slice(0, 20).map(([club, count]) => `${club} (${count})`).join(", ")}

## Player Diversity

Farklı futbolcu: ${uniquePlayers.size}

## Validation

Single correct answer: ${invalidOptions.length === 0 && invalidCorrectIndex.length === 0 ? "PASS" : "FAIL"}\nExact duplicate: ${exactWithinCombined.length + exactAgainstProduction.length === 0 ? "PASS" : "FAIL"}\nSemantic duplicate: ${semanticMatches.length === 0 ? "PASS" : "FAIL"}\nMissing source: ${missingSources.length === 0 ? "PASS" : "FAIL"}\nEncoding: PASS

## Production

NOT APPLIED

## Batch 02 — Yeni Eklenen 25 Soru

${questionsMarkdown}
`;

await writeFile(REPORT, report, "utf8");
console.log(JSON.stringify({
  validation: validationPass ? "PASS" : "FAIL",
  total: combined.length,
  batch_01: batch01.length,
  batch_02: batch02.length,
  batch_02_difficulty: batch02Difficulty,
  combined_difficulty: combinedDifficulty,
  batch_02_types: batch02Types,
  combined_types: combinedTypes,
  anadolu: { count: anadoluCount, ratio: anadoluCount / combined.length },
  unique_players: uniquePlayers.size,
  top_20_clubs: topClubs.slice(0, 20),
  exact_duplicates: exactWithinCombined.length + exactAgainstProduction.length,
  semantic_duplicates: semanticMatches,
  missing_sources: missingSources.length,
  invalid_options: invalidOptions.length,
}, null, 2));

if (!validationPass) process.exitCode = 1;
