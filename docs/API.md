# Family Calendar API

This project exposes an internal JSON API used by the web UI.

- Base URL: `/api`
- Authentication: none (add reverse-proxy auth if you expose it publicly)
- Content type: `application/json` unless noted

## Common Response Patterns

- Success: `200`, `201`
- Client error: `400`, `404`
- Server error: `500` with `{ "error": "..." }`

## People

### GET /api/people
Returns all people.

### POST /api/people
Creates a person.

Body:

```json
{
  "name": "Alex",
  "color": "#0ea5e9"
}
```

Response `201`:

```json
{ "id": "uuid" }
```

### GET /api/people/:id
Returns one person.

### PUT /api/people/:id
Updates one person or reorders all people.

Supported body fields:

```json
{
  "name": "Alex",
  "color": "#0ea5e9",
  "display_order": 2,
  "photo_url": "/uploads/abc.jpg"
}
```

Reorder mode:

```json
{
  "orderedIds": ["person-id-1", "person-id-2"]
}
```

### DELETE /api/people/:id
Deletes one person.

### POST /api/people/:id/photo
Uploads profile photo for a person.

- Request type: `multipart/form-data`
- Field: `file`
- Allowed MIME types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`

Response `201`:

```json
{ "url": "/uploads/uuid.jpg" }
```

## Settings

### GET /api/settings
Returns all settings as a key-value object.

### PUT /api/settings
Updates settings.

Body example:

```json
{
  "locale": "no",
  "default_view": "rolling",
  "display_timezone": "Europe/Oslo"
}
```

Response:

```json
{ "success": true }
```

## Uploads

### POST /api/upload
Uploads an `.ics` file for source creation.

- Request type: `multipart/form-data`
- Field: `file`
- Allowed: filename ending in `.ics` or MIME `text/calendar`

Response `201`:

```json
{ "file_path": "uuid.ics" }
```

## Sources

### GET /api/sources
Returns sources.

Optional query:

- `person_id`: filter by person

### POST /api/sources
Creates a source.

Body:

```json
{
  "name": "School",
  "type": "ical_url",
  "url": "https://example.com/calendar.ics",
  "color": "#22c55e",
  "sync_interval_minutes": 240,
  "person_ids": ["person-1", "person-2"]
}
```

Notes:

- `type` must be `ical_url` or `ical_file`
- `person_ids` is preferred; `person_id` is accepted for legacy clients
- For `ical_file`, send `file_path` from `POST /api/upload`

Response `201`:

```json
{ "id": "uuid" }
```

### GET /api/sources/:id
Returns one source.

### PUT /api/sources/:id
Updates source fields.

Supported fields:

```json
{
  "name": "Updated name",
  "url": "https://example.com/new.ics",
  "file_path": "uuid.ics",
  "color": "#f97316",
  "sync_interval_minutes": 120,
  "person_ids": ["person-1"]
}
```

### DELETE /api/sources/:id
Deletes one source and related events.

### POST /api/sources/:id/refresh
Refreshes one source immediately.

Response:

```json
{ "success": true, "count": 123 }
```

### GET /api/sources/:id/events
Returns grouped source events used in override UI.

Response item example:

```json
{
  "ical_uid": "uid-hash",
  "title": "Renovation",
  "start_date": "2026-05-21T00:00:00.000Z",
  "all_day": 1,
  "person_ids": ["person-1", "person-2"]
}
```

### GET /api/sources/:id/overrides
Returns override rows.

### PUT /api/sources/:id/overrides
Sets override rows.

Body:

```json
{
  "overrides": [
    { "ical_uid": "uid-hash", "person_id": "person-1" }
  ]
}
```

### POST /api/sources/:id/check-event
Re-syncs source and checks whether one event UID still exists.

Body:

```json
{ "ical_uid": "uid-hash" }
```

Response:

```json
{ "exists": true, "removed": false }
```

## Events

### GET /api/events
Returns events for a date range.

Required query parameters:

- `start`: ISO date-time
- `end`: ISO date-time

Optional query parameter:

- `person_id`: repeatable, for example `?person_id=a&person_id=b`

Response: array of event rows.

Note: server applies all-day normalization heuristics for feeds that encode all-day values as timed UTC ranges.

### POST /api/events/refresh
Refreshes all sources immediately.

Response:

```json
{ "success": true, "total": 1234, "errors": 0 }
```

## File Serving Endpoint

Uploaded photos are served from a non-API route:

- `GET /uploads/:filename`
