# Segment data – backend plan

All segment data should be loaded from the backend when the user hits that segment. No localStorage, no fake or demo data for add/remove.

## Current state

| Segment        | Data source     | Loader | Add flow              |
|----------------|-----------------|--------|------------------------|
| **Todos**      | API (`/todos`)  | Yes    | Inline title → Save → API |
| **Issues**     | API (`/issues`) | Yes    | Create popup → API    |
| **Rocks**      | localStorage    | No     | Create popup / inline → local |
| **Headlines**  | localStorage    | No     | Inline title → Save → local |
| **Scorecard**  | Mock in component | No   | —                     |
| **Segue**      | Static prompt   | —      | —                     |
| **Conclude**   | Static text     | —      | —                     |

## Plan

1. **Rocks**
   - Add backend: `Rock` model (existing in Prisma), `GET/POST/PUT/DELETE /rocks` scoped by `organizationId` + `teamId`.
   - Add `rocks.service.ts` and `RocksContext` to fetch on mount when `organizationId` + `teamId` are set; add/update/delete/reorder via API. Add `isLoading` and show loader in `RocksSegmentView`.
   - Add inline “add rock” flow: type title → Save button → API (with loader).

2. **Headlines**
   - Add backend: `Headline` (and optionally `CascadingMessage`) models and `GET/POST/PUT/DELETE /headlines` (and `/cascading-messages` if needed).
   - Add `headlines.service.ts` and update `HeadlinesContext` to fetch from API when meeting/team context is available; add/update/delete via API. Add `isLoading` and loader in `HeadlinesSegmentView`.
   - Inline add flow already in place; wire to API when backend is ready.

3. **Scorecard (Instruments)**
   - Add backend: `Scorecard` + `ScorecardMetric` (existing in Prisma), `GET/POST/PUT` for scorecard and metrics scoped by organization/team.
   - Fetch scorecard + metrics when segment is shown; add `isLoading` and loader in `InstrumentsSegmentView`.

4. **Segment hit**
   - When the user switches to a segment, the corresponding provider/context should already be mounted (e.g. `RocksProvider`, `HeadlinesProvider` are at meeting page level). Ensure each context fetches on mount when `organizationId` and `teamId` are available, so “segment hit” is effectively “first time this segment’s data is needed”. Optionally refetch when the user navigates to that segment (e.g. pass `sectionId` and refetch when `sectionId === 'rocks'`).

## Implementation order

1. Rocks API + Rocks context API integration + loader + inline add (with loader).
2. Headlines API + Headlines context API integration + loader (inline add already done).
3. Scorecard API + Instruments segment fetch + loader.
