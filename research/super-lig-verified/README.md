# Super Lig verified research (staged)

This folder is a source-first working dataset. It is intentionally not a production migration.

Each player-club edge must have a source URL before it can become a seed question. A question is accepted only when the correct option and all three distractors have been checked against the same evidence set. `canonical_fact_key` is used to reject semantic duplicates.

Current status: seed expansion is not approved. The dataset below is a small verified starting tranche, not the 250-question target.

Sources consulted in this tranche:

- worldfootball.net Süper Lig archive: https://www.worldfootball.net/schedule/tur-sueper-lig-2009-2010/
- worldfootball.net Bursaspor 2009/10 appearances: https://www.worldfootball.net/team_performance/bursaspor/tur-sueper-lig-2009-2010/
- Transfermarkt Serdar Aziz transfer history: https://www.transfermarkt.com/serdar-aziz/transfers/spieler/44996/transfer_id/1511116
- worldfootball.net Serdar Aziz club matches: https://www.worldfootball.net/player_summary/serdar-aziz/2/
- Transfermarkt Umut Bulut detailed stats: https://www.transfermarkt.com/umut-bulut/leistungsdatendetails/spieler/10143/verein/449
- worldfootball.net Ozan İpek club matches: https://www.worldfootball.net/player_summary/ozan-pek/2/

## Anadolu hard batch 01

- Candidate data: `question_candidates_anadolu_hard_batch_01.json`
- Rejected drafts: `rejected_candidates_anadolu_hard_batch_01.json`
- Rebuild: `node research/super-lig-verified/build_anadolu_hard_batch_01.mjs`
- Validate and report: `node research/super-lig-verified/validate_anadolu_hard_batch_01.mjs`
- Quality report: `quality_report_anadolu_hard_batch_01.md`

This batch remains in the research area and has not been applied to production.

## Anadolu hard batch 02 and combined pool

- Batch 02 candidate data: `question_candidates_anadolu_hard_batch_02.json`
- Batch 02 rebuild: `node research/super-lig-verified/build_anadolu_hard_batch_02.mjs`
- Combined validation: `node research/super-lig-verified/validate_anadolu_hard_combined_100.mjs`
- Combined 100-question report: `quality_report_anadolu_hard_combined_100.md`

Batch 02 adds 25 source-verified questions without any season/success questions. The combined 100-question pool remains staged research data and has not been applied to production.
