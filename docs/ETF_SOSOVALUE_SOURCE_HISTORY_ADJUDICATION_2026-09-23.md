# ETF SoSoValue source-history adjudication — 2026-09-23

Design and governance only. SoSoValue is **not** the production ETF source. Daily ETL still acquires ETF Flows from Farside HTML. This document does not authorize a source switch, a scoring change, or any H8 change.

Status labels used below:

- **DECIDED** — required by current code, frozen scoring, or already observed evidence.
- **RECOMMENDED_PENDING_BOBBY_APPROVAL** — proposed contract for later implementation. Not active.
- **UNRESOLVED** — evidence is not sufficient to freeze a rule.
- **REJECTED** — must not be done.

## 1. Executive decision summary

| Topic | Status | Position |
|---|---|---|
| Live provider | RECOMMENDED_PENDING_BOBBY_APPROVAL | SoSoValue as the future primary machine-readable ETF source. Not active now. |
| Canonical unit | RECOMMENDED_PENDING_BOBBY_APPROVAL | USD. Convert the frozen Farside baseline from displayed millions at the boundary. |
| Historical calibration | RECOMMENDED_PENDING_BOBBY_APPROVAL | Keep `public/data/etf-flows-historical.json` as a frozen Farside calibration baseline. Do not rebuild percentiles from about 21 SoSoValue days. |
| Ticker universe | RECOMMENDED_PENDING_BOBBY_APPROVAL | Exact tickers only. FBTC and BTC stay distinct. The scored universe must be an explicit approved set. MSBT is not silently added. |
| Completeness | RECOMMENDED_PENDING_BOBBY_APPROVAL | A date is eligible only with a finite summary total and a finite flow for every approved ticker. |
| Finality | RECOMMENDED_PENDING_BOBBY_APPROVAL | Score only the latest completed U.S. trading date strictly before the current U.S. trading calendar date. Do not carry 16:00 UTC forward as a SoSoValue publication time. |
| Durable history | RECOMMENDED_PENDING_BOBBY_APPROVAL | GhostGauge keeps normalized SoSoValue history separate from scores and from the revision audit. |
| Revisions | RECOMMENDED_PENDING_BOBBY_APPROVAL | Detect changes, keep an append-only audit, and apply an explicit policy before a revised value becomes current. |
| Outage fallback | RECOMMENDED_PENDING_BOBBY_APPROVAL | Fall back only to a complete durable SoSoValue row for the expected date. Otherwise exclude ETF Flows. |
| Freshness | RECOMMENDED_PENDING_BOBBY_APPROVAL | Compare the latest complete trading date with the expected eligible trading date. Do not use file mtime or a synthetic 16:00 UTC stamp. |
| Farside role | RECOMMENDED_PENDING_BOBBY_APPROVAL | Frozen calibration provenance and optional manual evidence. Not an automatic live fallback. |
| Versioning | DECIDED as a requirement | A live provider change and the unit/finality correction are scientifically material and need a source-contract version, an implementation revision, and lineage disclosure before activation. The exact future model version number is UNRESOLVED. |

Production switch: **not authorized**.

## 2. Evidence reviewed

Repository files were inspected and not modified.

`computeEtfFlows` does not read ETF subweights from `config/dashboard-config.json`. The live blend uses `scripts/etl/lib/ssotSubweights.mjs`.

Also inspected:

- `scripts/etl/factors.mjs` — acquisition, HTML parser, historical baseline load, and synthetic `lastUpdated`.
- `scripts/etl/marketCalendar.mjs` — `ETF_FLOW_PUBLISH_HOUR_UTC = 16`, expected trading day, published-row filter, and cadence freshness.
- `scripts/etl/stalenessUtils.mjs` — the ETF path calls the market-calendar cadence check. A 5-day TTL remains a fallback description.
- `scripts/etl/fetch-helper.mjs` — shared fetch helper. ETF HTML fetches discard per-URL errors.
- `public/data/etf-flows-historical.json` — Farside source, `fetchedAt` `2025-09-17T11:24:18.385Z`, 294 records, `2024-01-11` through `2025-09-16`. The `2024-01-11` daily flow is `655.3`.
- `public/data/cache/etf/**` — date-named HTML snapshots. The 2026-09-08 page title and `h1` say `(US$m)`. The table header cells are bare tokens such as `Total`, `FBTC`, and `BTC`.
- `docs/H8_V2_STOP_2026-09-22.md` and `research/h8-v2-prospective/H8_V2_STOP.json` — H8 v2 is stopped.

GitHub evidence. The diagnostic artifacts were not modified.

- PR #52 — R02 fixture: FBTC and BTC are distinct Farside identities. Production `header.includes` is not repaired here.
- PR #54 — closed, unmerged. GitHub-hosted runners received Cloudflare HTTP 403 challenge pages from the frozen Farside HTML URLs.
- PR #55 — merged H8 stop.
- PR #56 — merged Term & Leverage freshness repair. Not an ETF change.
- PR #57 — closed, unmerged. Run `35779748776`, artifact `10717398959`.
- PR #58 — closed, unmerged. Run `35899536329`, artifact `10768722673`.

Base for this document: `bb28999387435eb7a5cccc6330d71d9d21200963`.

## 3. Current production architecture

**DECIDED.** `computeEtfFlows` in `scripts/etl/factors.mjs` is the live ETF factor.

It reads `public/data/cache/etf/YYYY-MM-DD.html` for the UTC calendar date. If that file is absent, it fetches four Farside HTML URLs and may write the cache file. Per-URL fetch errors are discarded. Total failure returns `farside_unavailable`.

`parseEtfFlowsFromHtml` finds a table, reads a `Total` column when present, and maps fund columns with `header.includes(etf)` over `ibit`, `fbtc`, `bitb`, `arkb`, `btco`, `ezbc`, `brrr`, `hodl`, `btcw`, `gbtc`, `btc`. That list does not include `MSBT`. Substring matching is the known R02 collision: a search for `btc` can bind the `FBTC` header.

Scale is chosen only from the joined header text (`$bn`, `$m`, or `(us$m)`). The preserved page puts `(US$m)` in the title and `h1`, not in those header cells. The parser can therefore leave values in displayed millions. Returned metrics are still named `day_flow_usd` and `sum21_usd`.

Scoring, which this document does not change:

- A 21-business-day rolling sum, then `riskFromPercentile` against `rollingSums` from the historical file when that file loads.
- Acceleration is the latest 7 daily flows minus the prior 7. Its percentile is taken from that same parsed series, not from the historical file.
- Diversification is an HHI of the latest individual absolute flows. Equal scaling cancels in the shares.
- The official blend in `ssotSubweights.mjs` is `sum_21d` 0.30, `acceleration` 0.30, and `diversification` 0.40. A comment above the 21-day score still says 40 percent. The SSOT blend is what executes.
- `lastUpdated` is `${latestFlow.date}T16:00:00.000Z`.
- A separate rule inside `computeEtfFlows` nulls the score when the latest published date is more than 5 calendar days old.

`marketCalendar.mjs` treats an observation as unpublished before 16:00 UTC on a U.S. trading day. Daily ETL is scheduled at 11:00 UTC, so the scheduled run already selects the previous completed U.S. session. A manual run after 16:00 UTC can select the same calendar day. That clock is a Farside-era assumption.

`stalenessUtils.mjs` evaluates `etf_flows` through `isEtfFlowsFreshForSourceCadence`. That function parses `lastUpdated` as a date and compares it with `getExpectedLatestUsTradingDay`. The 5-day TTL remains a fallback description, not the cadence check itself.

## 4. SoSoValue qualification findings

**DECIDED** as evidence from PR #57 and PR #58. This is not a production authorization.

- GitHub Actions authenticated with `SOSOVALUE_API_KEY`.
- Both runs observed this BTC/US universe, in this order: IBIT, FBTC, ARKB, BTCO, BTCW, BRRR, BITB, EZBC, HODL, GBTC, BTC, MSBT.
- FBTC and BTC were separate exact ticker strings.
- PR #58 summary history: 21 distinct dates, 2026-08-24 through 2026-09-22, 0 null totals, descending.
- Each of the 12 ticker histories in that artifact: 21 rows, the same date span, 0 null `net_inflow`.
- By `2026-09-23T18:01:07.605Z`, 2026-09-22 was present in the summary and in all 12 ticker histories. That is presence and completeness by query time. It does not prove the publication clock time.
- 2026-09-23 was absent from the summary and from every ticker history at that query.
- On that snapshot, the sum of the 12 Sep 22 ticker flows equaled the summary total (`714748985.505`). One exact match is not a permanent provider guarantee.
- The partial revision window versus PR #57 had 11 aggregate dates and 120 ticker/date cells, all unchanged. Snapshot #1 did not retain every raw row. This is initial stability evidence, not proof that SoSoValue never revises history.
- Operational, authentication, demonstrated 21-day history, and exact ticker semantics passed on that evidence. Initial revision stability passed inside the partial window. A production switch is not authorized.
- PR #54 showed the frozen Farside HTML URLs returning Cloudflare HTTP 403 from GitHub-hosted runners. That motivates a machine-readable replacement. It does not by itself approve SoSoValue.

## 5. Source-provider adjudication

**RECOMMENDED_PENDING_BOBBY_APPROVAL.** SoSoValue becomes the future primary machine-readable ETF source.

**REJECTED** for the current plan:

- Farside HTML as an automatic live acquisition fallback.
- CoinGlass, Bitbo, or any other undeclared provider as an automatic fallback.
- Scraping SoSoValue webpages.
- Treating the PR #57 or PR #58 diagnostic branches as production code. They were closed unmerged.

The qualified endpoint family, if that recommendation is approved:

- `GET /etfs?symbol=BTC&country_code=US`
- `GET /etfs/summary-history?symbol=BTC&country_code=US&limit=300`
- `GET /etfs/{ticker}/history?limit=300`

Authentication header: `x-soso-api-key`. Secret name: `SOSOVALUE_API_KEY`. The key must not be stored in repository files.

**UNRESOLVED:** whether SoSoValue's documented one-month history limit will remain, and whether a later contract will expose a longer official history. A durable GhostGauge history layer is what would make a short provider window usable. That layer does not exist yet.

## 6. Unit contract adjudication

**RECOMMENDED_PENDING_BOBBY_APPROVAL.** The canonical internal ETF monetary unit is USD.

Evidence, **DECIDED**:

- `etf-flows-historical.json` stores Farside displayed values. `2024-01-11` is `655.3`, not `655300000`. Rolling sums in that file use the same displayed-million units.
- SoSoValue `total_net_inflow` and `net_inflow` in the PR #58 artifact are dollar amounts. The Sep 22 summary total was about $714.7 million.
- Mixing those scales is about a 1,000,000x error.
- The live parser's header-only unit test does not see `(US$m)` when that text sits outside the header cells.

**REJECTED:** a production adapter that adds SoSoValue USD values to the current historical millions without an explicit conversion.

Scale reasoning, **DECIDED** as mathematics, not yet applied:

- `percentileRank` and the z-score are unchanged if every compared flow and rolling sum is multiplied by the same positive constant.
- HHI divides absolute flows by their sum, so a uniform scale cancels.
- The acceleration percentile is computed inside one parsed series. Scaling every daily flow in that series by `1e6` does not change that percentile.
- Converting both the live SoSoValue observations and the frozen baseline from displayed millions to USD at the boundary therefore preserves rank-based ETF scores.
- Displayed dollar text, and any consumer that assumed the old magnitude, would change. That is a provenance and presentation correction, not a scoring-formula change.
- This adjudication does not perform the conversion.

## 7. Historical calibration-baseline adjudication

**RECOMMENDED_PENDING_BOBBY_APPROVAL.** `public/data/etf-flows-historical.json` remains a frozen Farside calibration baseline. It is not the live source.

The demonstrated SoSoValue API history is about one month. Replacing the 294-record baseline with those observations, or percentile-ranking only inside the current 21-day window, would change the methodology. Both are **REJECTED**.

Required boundary conditions before any later implementation uses the frozen file together with SoSoValue live data:

- Provenance states that the baseline is Farside, frozen, and stored in displayed millions.
- Conversion to USD happens at the scoring boundary, unless a later PR explicitly versions a converted dataset.
- Live rows are labeled SoSoValue.
- Lineage records both providers.
- Farside is not described as the current live provider.

**UNRESOLVED:** whether any frozen-baseline dates were revised by Farside after `fetchedAt` `2025-09-17T11:24:18.385Z`. This adjudication does not rebuild that file.

If a later review shows the frozen series is not the same economic measure as SoSoValue net inflow even after multiplying by `1e6`, the cross-source percentile baseline becomes **UNRESOLVED** and must not be activated. PR #57 did not provide a unit-aligned proof. PR #58 did not repeat a Farside comparison. The boundary conditions above are mandatory.

## 8. Ticker identity and universe contract

**DECIDED.** Use exact normalized ticker strings. Do not use substring matching. FBTC is not BTC. The R02 fixture remains the semantic statement. This document does not repair `parseEtfFlowsFromHtml`.

**RECOMMENDED_PENDING_BOBBY_APPROVAL.**

- The `/etfs` payload is the observed provider universe.
- GhostGauge also keeps an approved scored-ticker universe and a fingerprint of that set.
- Observed membership and scored membership may differ.
- As of PR #58, MSBT is present at SoSoValue and absent from the production parser's named column list. Putting MSBT into the HHI would change diversification relative to the current 11-name parser. Dropping a present MSBT flow without recording it would also change how the summary total relates to the HHI inputs.
- The first source-contract version must name the scored set.

**UNRESOLVED** until that contract is written: whether MSBT is in the scored universe.

A later add or remove relative to the approved scored set is detected and recorded. It must not silently change diversification. ETF scoring fails closed, or enters an explicit review state, until a versioned contract update approves the new set.

## 9. Daily completeness contract

**RECOMMENDED_PENDING_BOBBY_APPROVAL.** An eligible trading date requires all of:

1. A finite SoSoValue summary total.
2. A row for every approved scored ticker.
3. A finite `net_inflow` on each of those rows.
4. The finality rule in section 10.
5. Identity and approved-universe checks.

**DECIDED.** A numeric zero is an observation. Missing, null, and error are not zero.

**RECOMMENDED_PENDING_BOBBY_APPROVAL.** Compute the approved-ticker sum minus the summary total, and retain that difference as an integrity diagnostic.

**REJECTED** as a permanent hard gate, and **UNRESOLVED** as a provider guarantee: exact equality. PR #58 observed exact equality for 2026-09-22 across all 12 returned tickers. That does not establish that SoSoValue will always define the summary as that sum, especially if the scored universe is a subset of the provider universe.

## 10. Finality

**REJECTED.** Carrying `ETF_FLOW_PUBLISH_HOUR_UTC = 16` forward as a SoSoValue publication time. The diagnostics do not establish that clock.

**RECOMMENDED_PENDING_BOBBY_APPROVAL.** Use only the most recent completed U.S. trading date strictly before the current U.S. trading calendar date.

- A Tuesday Daily ETL run scores Monday.
- A Monday run scores Friday, subject to the existing U.S. holiday calendar.
- Weekend and holiday runs score the most recent completed U.S. session before that calendar date.
- A current-calendar-day row may be stored if the provider sends it. It is not scored merely because it exists.

This matches the scheduled 11:00 UTC Daily ETL under today's 16:00 rule, because 11:00 UTC is before 16:00 UTC. It is stricter than today's rule for a manual run after 16:00 UTC on a trading day. Today's code can accept that calendar date. The recommended rule still waits until the next calendar date. That conservatism is intentional.

**UNRESOLVED.** The exact SoSoValue publication time, if one exists.

## 11. Durable history schema

**RECOMMENDED_PENDING_BOBBY_APPROVAL.** GhostGauge maintains normalized SoSoValue source history keyed by trading date. This schema is not implemented here.

Keep these layers separate:

1. Provider observation data.
2. Fetch metadata.
3. Revision audit.
4. Scoring output.

Fields for a later contract:

- `source_contract_version`
- `provider` (`sosovalue` for live rows)
- `asset` (`BTC`)
- `country` (`US`)
- `trading_date`
- `summary_total_usd`
- `ticker_flows_usd` for the approved scored set, with any recorded-but-unscored provider tickers kept outside the HHI input
- `ticker_universe`
- `universe_fingerprint`
- `fetched_at_utc`
- `first_seen_at_utc`
- `last_seen_at_utc`
- `complete`
- `revision_number`
- `revision_detected_at_utc`
- prior-value provenance when a revision is detected

The PR #58 diagnostic artifact is evidence. It is not this durable store.

## 12. Revision policy

**DECIDED.** No revisions in the partial PR #57 versus PR #58 window is not a promise that history is immutable.

**RECOMMENDED_PENDING_BOBBY_APPROVAL.**

- On each fetch, compare overlapping dates with durable canonical history.
- Append an audit record for every changed date or ticker cell. That audit is immutable.
- The materialized current history may replace the latest value for a date only when the newest successful complete SoSoValue observation for that date becomes current, and the displaced value stays in the audit.
- Do not rewrite accepted H8 observations or any other frozen prospective capture.
- A revision inside the active 21-business-day window is visible in provenance.

**UNRESOLVED.** Whether an in-window revision should force an immediate recompute. This document authorizes the next scheduled compute to read current materialized history. It does not authorize an immediate extra run.

## 13. Cache and outage policy

**RECOMMENDED_PENDING_BOBBY_APPROVAL.**

- Pace requests. Honor `Retry-After`. Allow one bounded retry. Do not loop aggressively.
- Partial ticker coverage is not a complete day.
- If the live fetch fails, durable SoSoValue history may be used only when it already contains a complete row for the expected eligible trading date.
- If durable history is behind that date, ETF Flows is excluded. The reason names the SoSoValue source. It does not say `farside_unavailable`.

**REJECTED:**

- Treating a stale Farside HTML file as a fresh SoSoValue observation.
- Live Farside scraping as an automatic fallback.
- Automatic CoinGlass failover.
- Writing zeros for missing cells.
- Using fetch time as the source observation time.

**UNRESOLVED.** The provider's long-term numeric rate limit. PR #58 saw one HTTP 429 on BITB, then success after a 20-second `Retry-After`. Operational limits can change. They are not part of the scientific model.

## 14. Freshness and staleness contract

**RECOMMENDED_PENDING_BOBBY_APPROVAL.**

- Expected eligible date: section 10, using the existing U.S. trading calendar in `marketCalendar.mjs`, without treating 16:00 UTC as a SoSoValue publication time.
- Actual date: the latest trading date in durable SoSoValue history that meets section 9.
- Fresh when actual equals expected.
- Stale or excluded when actual is earlier than expected, or when the expected date is incomplete.
- File modification time, the cache filename date, and fetch timestamp do not make a row fresh.
- Do not synthesize `T16:00:00.000Z`.

`stalenessUtils.mjs` should eventually call that comparison for `etf_flows`. The 5-day wall-clock nulling inside `computeEtfFlows` should not remain a second, conflicting rule. Removing it belongs to ETF-S4. It is not a change to the 21-day scoring window.

## 15. Provenance contract

**RECOMMENDED_PENDING_BOBBY_APPROVAL.** Future ETF factor output distinguishes:

- provider
- `source_contract_version`
- source trading date
- `fetched_at_utc`
- acquisition state: live, or durable-history fallback
- universe fingerprint
- revision state when a revision exists
- historical calibration provider (`farside_frozen_baseline`)

**REJECTED:** collapsing those fields into one `lastUpdated` timestamp.

## 16. Farside future role

**RECOMMENDED_PENDING_BOBBY_APPROVAL.**

Farside remains historical evidence, the frozen calibration-baseline provenance, and an optional manual validation source.

Farside does not remain an automatic live machine fallback.

The R02 exact-identity fixture stays in force for any future Farside reading. It is not a SoSoValue parser.

## 17. Versioning requirements

**DECIDED.** Changing the live ETF provider, and correcting unit, provenance, and finality handling, is scientifically material. Activation requires:

- a source-contract version
- an implementation revision
- lineage disclosure that live acquisition is SoSoValue and the percentile baseline is frozen Farside, including the unit conversion

**UNRESOLVED.** The exact future model version string. This review did not find a rule that assigns the next number. This PR does not choose one.

## 18. H8 boundary

**DECIDED.**

- H8 v2 stays stopped and historical-only.
- Do not reconstruct 2026-09-09 through 2026-09-21.
- Do not reopen H8, insert SoSoValue into H8, or recalculate accepted observations.
- Do not tune ETF handling from H8 outcomes.
- A successor prospective study can use the corrected ETF architecture only after that architecture is separately frozen and preregistered.

## 19. Proposed implementation slices

Design only. Merging this document does not authorize any slice.

| Slice | Concern |
|---|---|
| ETF-S1 | Source contract and deterministic fixtures: exact tickers, approved scored universe, USD units, completeness, and T+1 finality. No live compute change. |
| ETF-S2 | SoSoValue normalized acquisition and durable source-history adapter, including the revision audit. No score change. |
| ETF-S3 | Approved-universe enforcement. MSBT's disposition must already be decided in ETF-S1. |
| ETF-S4 | Replace the Farside publication-hour freshness rule with the T+1 complete-date rule. |
| ETF-S5 | Convert the frozen Farside baseline to USD at the boundary, with provenance. Do not replace the baseline with 21 SoSoValue days. |
| ETF-S6 | Point `computeEtfFlows` at the adapter. Preserve subweights, the 21-day sum, 7-versus-prior-7 acceleration, HHI, and `riskFromPercentile`. |
| ETF-S7 | Guarded read-only preview comparing the current Farside scoring path with the SoSoValue path before activation. |
| ETF-S8 | Production activation, plus disclosure and the version update. |

ETF-S1 blocks ETF-S3 and ETF-S6. ETF-S2 blocks ETF-S4 and ETF-S6. ETF-S5 must land before ETF-S6 scores against the historical file. ETF-S7 blocks ETF-S8.

## 20. Explicit unresolved questions

- Whether Bobby approves SoSoValue as the future live provider.
- Whether the approved scored universe includes MSBT.
- Whether SoSoValue's summary total is contractually the sum of listed ticker flows.
- The exact SoSoValue publication time, if any.
- Whether an in-window revision should trigger an immediate recompute or wait for the next scheduled ETL.
- Whether the frozen Farside baseline remains economically comparable to SoSoValue after multiplying by `1e6`.
- The next model version identifier.
- The provider's durable rate-limit contract.

## 21. What this adjudication does not authorize

- Implementing an adapter, or changing `scripts/etl/**`, `config/**`, `lib/**`, `public/**`, workflows, or H8 artifacts.
- Changing the ETF factor weight, the subweights (`0.30` / `0.30` / `0.40`), the 21-business-day window, the 7-day versus prior-7-day acceleration definition, the HHI definition, `riskFromPercentile`, or composite weighting.
- G-Score tuning or outcome optimization.
- Declaring SoSoValue the current production source.
- Declaring SoSoValue equivalent to Farside.
- Reopening H8, or repairing R01, R02, or R03 production behavior.
- Using CoinGlass or live Farside HTML as a silent fallback.

## 22. Where later implementation must replace Farside-specific behavior

These files are not edited here. Later slices have to touch them.

`scripts/etl/factors.mjs`

- Direct Farside HTML acquisition and the date-named raw HTML cache.
- `parseEtfFlowsFromHtml` and substring ticker matching.
- Header-only source-unit detection.
- Loading `public/data/etf-flows-historical.json` as if it were same-scale live data.
- Synthetic `T16:00:00.000Z` `lastUpdated`.
- The `farside_unavailable` failure reason.
- The separate 5-day calendar nulling of the score.

`scripts/etl/marketCalendar.mjs`

- `ETF_FLOW_PUBLISH_HOUR_UTC = 16`.
- `getExpectedLatestUsTradingDay`.
- `selectPublishedEtfFlowRows`.
- `isEtfFlowsFreshForSourceCadence`.

`scripts/etl/stalenessUtils.mjs`

- The `etf_flows` freshness branch, which currently depends on the synthetic timestamp and the 16:00 rule.

`public/data/etf-flows-historical.json`

- Farside provenance, displayed-million units, `fetchedAt` `2025-09-17T11:24:18.385Z`, and the `2024-01-11` through `2025-09-16` range.
