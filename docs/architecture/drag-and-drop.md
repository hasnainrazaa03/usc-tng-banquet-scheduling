# Drag-and-Drop Board

File: [`src/app/(app)/schedule/board/board.tsx`](../../src/app/(app)/schedule/board/board.tsx)

The board is built on [dnd-kit](https://docs.dndkit.com/). Two view modes
share the same drag-and-drop contract:

- **Day grid** — 7 day columns of stacked shift cards with role slot drop
  zones inside each card.
- **Roster grid** — `server × day` spreadsheet with sticky header and
  sticky first column. Cells are informational; drags still target the
  role slots in the day view.

## Drag IDs

Every draggable/droppable has a typed ID encoded as a colon-delimited
string:

| ID pattern | Meaning |
| --- | --- |
| `server:<serverId>` | A server pill being dragged from the sidebar. |
| `assignment:<assignmentId>` | An already-assigned chip being moved to a different slot. |
| `shift:<shiftId>:<roleCode>` | A drop zone for one role on one shift. |

The drop handler (`onDragEnd`) parses these and routes to the right
persistence endpoint:

```ts
if (over.id starts with "shift:") {
  const [_, shiftId, roleCode] = over.id.split(":");
  if (active.id starts with "server:")     POST /api/schedule/assign
  if (active.id starts with "assignment:") DELETE old, then POST new
}
```

## Visual states

| State | Style |
| --- | --- |
| Slot is empty | Dashed red border, "N open" caption. |
| Slot is being hovered | Cardinal ring + light cardinal fill. |
| Assignment is locked | Solid cardinal background, lock icon. |
| Assignment has a conflict (overlapping shift) | Red ring around the chip + count in the top stat bar. |
| Status shift (OFF/VAC/SICK/…) | Status-coded background, no role chips. |

## Conflict detection

Computed client-side in a `useMemo` over `shifts`. For each shift in `NONE`
status, we build a per-server interval list and mark any pair of
assignments with overlapping `[startsAt, endsAt]` as conflicting. The
result is a `Set<assignmentId>` consumed by every chip-renderer.

Why client-side? Three reasons:

1. The data needed (`shifts + assignments`) is already on the page.
2. Manual edits should reflect immediately without a round-trip.
3. The server enforces the same rule on POST, so the client UI is just a
   fast hint, not the truth.

## Persistence model

The board treats Prisma as the source of truth. State updates follow
*optimistic-after-confirm*:

1. User drags.
2. `fetch("/api/schedule/assign", …)` writes the row.
3. The returned row gets merged into local state.
4. On any error, `router.refresh()` re-hydrates from the server.

`router.refresh()` is the escape hatch for any state drift; we never store
authoritative data only in client memory.

## Filters & density

The sidebar's name/role/location filters are pure local `useMemo`
operations on the prefetched `servers[]` array. Density toggle is a
client-only preference (`comfortable | compact`) that adjusts paddings
and shows/hides secondary info.
