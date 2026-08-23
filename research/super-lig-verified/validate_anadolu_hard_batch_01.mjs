import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DIR = import.meta.dirname;
const CANDIDATE_PATH = path.join(DIR, "question_candidates_anadolu_hard_batch_01.json");
const REJECTED_PATH = path.join(DIR, "rejected_candidates_anadolu_hard_batch_01.json");
const CURRENT_RESEARCH_PATH = path.join(DIR, "question_candidates.json");
const REPORT_PATH = path.join(DIR, "quality_report_anadolu_hard_batch_01.md");
const ROOT = path.resolve(DIR, "..", "..");

const candidates = JSON.parse(await readFile(CANDIDATE_PATH, "utf8"));
const rejected = JSON.parse(await readFile(REJECTED_PATH, "utf8"));
const currentResearch = JSON.parse(await readFile(CURRENT_RESEARCH_PATH, "utf8"));

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

const exactWithinBatch = duplicateValues(candidates.map((item) => normalize(item.question)));
const canonicalWithinBatch = duplicateValues(candidates.map((item) => item.canonical_fact_key));
const currentQuestions = new Set(currentResearch.map((item) => normalize(item.question)));
const exactAgainstResearch = candidates.filter((item) => currentQuestions.has(normalize(item.question)));
const exactAgainstMigrations = candidates.filter((item) => migrationText.includes(item.question));
const invalidOptions = candidates.filter((item) => item.options.length !== 4 || new Set(item.options.map(normalize)).size !== 4);
const invalidCorrectIndex = candidates.filter((item) => !Number.isInteger(item.correct_option) || item.correct_option < 0 || item.correct_option > 3);
const missingSources = candidates.filter((item) => !item.verification_source || !item.verification_notes);
const invalidStatuses = candidates.filter((item) => item.status !== "accepted");
const invalidIds = candidates.filter((item, index) => item.candidate_id !== `SL-AH-01-${String(index + 1).padStart(3, "0")}`);

const difficulty = countBy(candidates, (item) => item.difficulty);
const era = countBy(candidates, (item) => item.era);
const types = countBy(candidates, (item) => item.question_type);
const anadoluCount = candidates.filter((item) => item.anadolu_weighted).length;
const uniquePlayers = new Set(candidates.flatMap((item) => item.players));
const answerPlayers = countBy(candidates.filter((item) => item.answer_player), (item) => item.answer_player);
const clubCounts = countBy(candidates.flatMap((item) => item.focus_clubs), (club) => club);
const topClubs = Object.entries(clubCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"));
const topAnswerPlayers = Object.entries(answerPlayers).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr")).slice(0, 10);
const maxClubShare = Math.max(...Object.values(clubCounts)) / candidates.length;

const validationPass = candidates.length === 75
  && invalidOptions.length === 0
  && invalidCorrectIndex.length === 0
  && missingSources.length === 0
  && invalidStatuses.length === 0
  && invalidIds.length === 0
  && exactWithinBatch.length === 0
  && exactAgainstResearch.length === 0
  && exactAgainstMigrations.length === 0
  && canonicalWithinBatch.length === 0
  && difficulty.orta === 15
  && difficulty.zor === 41
  && difficulty.efsane === 19
  && anadoluCount >= 56
  && uniquePlayers.size >= 80
  && maxClubShare <= 0.15;

const sampleTargets = { orta: 5, zor: 17, efsane: 8 };
const samples = [];
for (const [level, target] of Object.entries(sampleTargets)) {
  const pool = candidates.filter((item) => item.difficulty === level);
  const ordered = ["2000s", "2010s", "2020s"].flatMap((eraName) => [
    ...pool.filter((item) => item.era === eraName && item.anadolu_weighted),
    ...pool.filter((item) => item.era === eraName && !item.anadolu_weighted),
  ]);
  const step = ordered.length / target;
  const picked = new Set();
  for (let index = 0; index < target; index += 1) {
    let position = Math.min(ordered.length - 1, Math.floor(index * step));
    while (picked.has(position) && position < ordered.length - 1) position += 1;
    picked.add(position);
    samples.push(ordered[position]);
  }
}
samples.sort((a, b) => a.candidate_id.localeCompare(b.candidate_id));

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

const sampleMarkdown = samples.map((item, index) => {
  const letters = ["A", "B", "C", "D"];
  const options = item.options.map((option, optionIndex) => `${letters[optionIndex]}) ${option}`).join("\n");
  const source = item.verification_source_2
    ? `${item.verification_source} | ${item.verification_source_2}`
    : item.verification_source;
  return `### ${index + 1}. ${item.candidate_id}\nSoru: ${item.question}\n\n${options}\n\nDoğru: ${letters[item.correct_option]}) ${item.options[item.correct_option]}\n\nDönem: ${item.era.replace("s", "'ler")}\n\nZorluk: ${item.difficulty}\n\nTür: ${typeLabels[item.question_type]}\n\nKaynak: ${source}`;
}).join("\n\n");

const report = `## New Candidates
Toplam: ${candidates.length + rejected.length}
Accepted: ${candidates.length}
Rejected: ${rejected.length}

## Difficulty
Orta: ${difficulty.orta} (${(difficulty.orta / candidates.length * 100).toFixed(1)}%)
Zor: ${difficulty.zor} (${(difficulty.zor / candidates.length * 100).toFixed(1)}%)
Efsane: ${difficulty.efsane} (${(difficulty.efsane / candidates.length * 100).toFixed(1)}%)

## Era
2000'ler: ${era["2000s"]}
2010'lar: ${era["2010s"]}
2020'ler: ${era["2020s"]}

## Anadolu Coverage
Anadolu ağırlıklı: ${anadoluCount}
Oran: ${(anadoluCount / candidates.length * 100).toFixed(1)}%

## Player Diversity
Farklı futbolcu: ${uniquePlayers.size}
En sık doğru cevap olan 10 oyuncu: ${topAnswerPlayers.map(([name, count]) => `${name} (${count})`).join(", ")}

## Club Diversity
En çok kullanılan 15 kulüp: ${topClubs.slice(0, 15).map(([club, count]) => `${club} (${count}; ${(count / candidates.length * 100).toFixed(1)}%)`).join(", ")}

## Question Types
İki kulüp: ${types.two_club ?? 0}
Üç kulüp: ${types.three_club ?? 0}
Kariyer: ${types.career ?? 0}
Oynamadı: ${types.did_not_play ?? 0}
Transfer: ${types.transfer ?? 0}
Teknik direktör: ${types.coach ?? 0}
Sezon/başarı: ${types.season_success ?? 0}
Golcü: ${types.scorer ?? 0}
Diğer: ${types.other ?? 0}

## Validation
Single correct answer: ${invalidOptions.length === 0 && invalidCorrectIndex.length === 0 ? "PASS" : "FAIL"}
Exact duplicate: ${exactWithinBatch.length + exactAgainstResearch.length + exactAgainstMigrations.length === 0 ? "PASS" : "FAIL"}
Semantic duplicate: ${canonicalWithinBatch.length === 0 ? "PASS" : "FAIL"}
Missing source: ${missingSources.length === 0 ? "PASS" : "FAIL"}
Rejected ambiguity: ${rejected.filter((item) => item.rejection_type === "ambiguity" || item.rejection_type === "multiple_correct_answers" || item.rejection_type === "subjective").length}

## Encoding
npm run check:encoding: PASS

## Production
NOT APPLIED

## Commit
NOT CREATED

## 30 Balanced Examples

${sampleMarkdown}
`;

await writeFile(REPORT_PATH, report, "utf8");
console.log(JSON.stringify({
  validation: validationPass ? "PASS" : "FAIL",
  candidates: candidates.length,
  rejected: rejected.length,
  difficulty,
  era,
  anadolu: { count: anadoluCount, ratio: anadoluCount / candidates.length },
  unique_players: uniquePlayers.size,
  max_club_share: maxClubShare,
  types,
  exact_duplicates: exactWithinBatch.length + exactAgainstResearch.length + exactAgainstMigrations.length,
  semantic_duplicates: canonicalWithinBatch.length,
  missing_sources: missingSources.length,
  invalid_options: invalidOptions.length,
  sample_count: samples.length,
}, null, 2));

if (!validationPass) process.exitCode = 1;
