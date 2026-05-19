# Release Notes

## Upcoming Release

### Highlights

- **Compact / aligned layout toggle** — Month, Week, and Rolling views now have a toggle button in the header. Toggle off (gray) gives a compact stacked layout with more days visible at once; toggle on (blue) activates slot-aligned layout where events at the same time appear at the same vertical row across all person columns.
- Improved all-day event normalization and timezone handling.
- Better visual emphasis for single-day all-day events.
- All events in a day are always visible — no events are hidden behind an overflow counter.
- Cleaner public repository documentation and contribution flow.

### Documentation and Project Hygiene

- Added API documentation in docs/API.md.
- Added contributor guide (CONTRIBUTING.md).
- Added security policy (SECURITY.md).
- Added issue templates and PR template in .github/.
- Added contrib/README.md for deployment helper assets.
- Removed redundant root favicon.svg.

### Upgrade Notes

- Re-sync calendar sources after deployment to refresh normalized all-day values.
- If using Docker, restart the service after pulling latest changes.

### Known Notes

- During production build, Next.js may log dynamic server usage for /api/events due to request.url usage; this is expected for dynamic route behavior.
