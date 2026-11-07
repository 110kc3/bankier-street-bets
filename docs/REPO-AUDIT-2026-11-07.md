# Repository audit — 2026-11-07

Repository: `bankier-street-bets` · Agent: Codex

Audited source: [`4471341`](https://github.com/110kc3/bankier-street-bets/commit/44713419baa590b7f4b8d1eb699ccd36c827f539)

Evidence collected: 2026-11-06–2026-11-07. Chat item numbers: 8, 9, 10.

This dated report preserves the findings and feature suggestions already reported in chat.
The owner authorized recording, committing and pushing this documentation. The findings
remain unresolved, and the proposed features have not been selected for implementation.
This is an evidence report, not a second accepted work queue. Existing project decisions,
accepted tasks and owner-only blockers remain authoritative in [README.md](../README.md).

## Verification status

The evidence below describes the earlier audit, including its limitations. This documentation
change does not claim to fix the findings or repeat every runtime reproduction. No production
account, database or infrastructure was changed by those isolated reproductions.

Documentation push: CI verification pending. Check the exact resulting commit on the next
session using [Actions](https://github.com/110kc3/bankier-street-bets/actions?query=branch%3Amain);
no run was awaited for this documentation update. A repository without a workflow has no
CI result to claim.

## 8. Scheduled refresh is blocked by upstream HTTP 403 responses

Type: Open finding — not fixed. Priority: High. Estimated effort: Medium.

All 19 stock forum scrape targets on m.bankier.pl returned HTTP 403. The latest five refresh runs inspected during the audit failed, leaving the last successful dataset in place.

**Evidence:** [Run 42175871895](https://github.com/110kc3/bankier-street-bets/actions/runs/42175871895) and its failed collector logs; audited source 4471341. See [collector](../scripts/bankier.js).

**Suggested change:** Determine a supported source/access path and expose dataset freshness and refresh failure clearly; retain the last valid dataset during an outage.

**Acceptance if selected:** A blocked response is distinguishable from valid empty activity; failed refreshes do not overwrite valid data; a supported successful refresh updates its timestamp.

## 9. The data gate accepts an all-empty snapshot

Type: Open finding — not fixed. Priority: Medium. Estimated effort: Medium.

All 19 stocks can have zero comments and still pass the data contract. The collector swallows individual thread failures and can mark affected results available.

**Evidence:** A synthetic all-empty snapshot passed all 41 contract tests. See [collector](../scripts/bankier.js) and [data contract](../tests/data-contract.test.js).

**Suggested change:** Track fetch/parse outcomes independently from comment counts and reject an outage-shaped snapshot before publication.

**Acceptance if selected:** Simulated all-target failures fail the publication gate and preserve prior data; a genuinely empty successful response is represented explicitly.

## 10. An older request can replace the latest stock selection

Type: Open finding — not fixed. Priority: Medium. Estimated effort: Small.

Selecting AAA and then BBB can display AAA's headline and URL if the AAA request resolves last.

**Evidence:** Reproduced in jsdom by resolving BBB before AAA. See [app.js](../app.js).

**Suggested change:** Associate response handling with the active selection/request, or cancel superseded requests.

**Acceptance if selected:** Resolving requests in reverse order leaves the latest selected stock's results and URL visible.
