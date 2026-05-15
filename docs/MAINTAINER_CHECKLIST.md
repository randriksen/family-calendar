# Maintainer Checklist

## First Public Release Checklist

### Repository Safety

- Verify no private data is tracked in git.
- Confirm .gitignore covers runtime data and secrets:
  - data/
  - .env*
  - build artifacts
- Review commit history for accidental secrets.

### Documentation

- README.md is current and accurate.
- docs/API.md reflects current endpoints and payloads.
- CONTRIBUTING.md and SECURITY.md are present and up to date.
- Release summary is updated in RELEASE_NOTES.md.

### Quality Gates

- Run npm run build successfully on clean checkout.
- Validate core workflows manually:
  - Add/edit people
  - Add iCal source (URL and file)
  - Refresh events
  - Open settings page
- Confirm all-day events render correctly in calendar and details modal.

### Deployment Readiness

- Docker compose paths and environment values are documented.
- Healthcheck endpoint is stable.
- Data volume backup/restore procedure is documented.

### Public Launch

- Create git tag and GitHub release.
- Include summary, upgrade notes, and known limitations.
- Monitor first issues and triage quickly.
