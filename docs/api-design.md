# QuickNotes REST API

Base URL: `https://api.quicknotes.example/v1`

All requests and responses use JSON unless a response has no body. Except for public health checks (not included here), endpoints require `Authorization: Bearer <access-token>`. A note belongs to the authenticated user; clients cannot select another owner by supplying a different `userId`.

## Endpoints

| Method | Path | Description | Success |
| --- | --- | --- | --- |
| `GET` | `/notes?limit=20&cursor=<cursor>` | List the authenticated user's notes, newest first, with cursor pagination. | `200 OK` |
| `POST` | `/notes` | Create a note owned by the authenticated user. | `201 Created` |
| `GET` | `/notes/{noteId}` | Get one note the authenticated user owns. | `200 OK` |
| `PATCH` | `/notes/{noteId}` | Update the supplied title, body, or tag assignments on an owned note. | `200 OK` |
| `DELETE` | `/notes/{noteId}` | Permanently delete an owned note and its tag links. | `204 No Content` |
| `GET` | `/tags` | List tags available to the authenticated user. | `200 OK` |
| `POST` | `/notes/{noteId}/tags` | Add one or more existing tags to an owned note. | `200 OK` |

A missing or invalid access token returns `401`; a valid token without permission to access a resource returns `403`. Requests are scoped to the caller by default.

## Create a note

Request:

```http
POST /v1/notes HTTP/1.1
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "title": "Prepare design review",
  "body": "Bring the storage and caching diagrams.",
  "tagIds": [3, 8]
}
```

Response: `201 Created`

```json
{
  "data": {
    "id": "note_01J9K8W6",
    "userId": "user_42",
    "title": "Prepare design review",
    "body": "Bring the storage and caching diagrams.",
    "createdAt": "2026-10-22T09:30:00Z",
    "updatedAt": "2026-10-22T09:30:00Z",
    "tags": [
      { "id": 3, "name": "work" },
      { "id": 8, "name": "planning" }
    ]
  }
}
```

The server sets `userId` from the access token; the client cannot choose the owner.

## List notes

Request:

```http
GET /v1/notes?limit=20 HTTP/1.1
Authorization: Bearer <access-token>
```

Response: `200 OK`

```json
{
  "data": [
    {
      "id": "note_01J9K8W6",
      "userId": "user_42",
      "title": "Prepare design review",
      "body": "Bring the storage and caching diagrams.",
      "createdAt": "2026-10-22T09:30:00Z",
      "updatedAt": "2026-10-22T09:30:00Z",
      "tags": [{ "id": 3, "name": "work" }]
    }
  ],
  "page": {
    "limit": 20,
    "nextCursor": null
  }
}
```

`limit` is capped by the server (for example, at 100). `nextCursor` is an opaque value clients pass as `cursor` to retrieve the next page.

## Errors

Errors use a stable JSON envelope; `requestId` helps support teams trace a failure without exposing internal details.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title is required.",
    "details": [{ "field": "title", "issue": "required" }],
    "requestId": "req_8d72a1"
  }
}
```

| Status | Meaning | Example |
| --- | --- | --- |
| `400 Bad Request` | The payload or query parameters are invalid. | A note title is empty or longer than 100 characters. |
| `401 Unauthorized` | Authentication is missing, invalid, or expired. | The bearer token is omitted from `GET /notes`. |
| `403 Forbidden` | The caller is authenticated but lacks access. | A user requests another user's private note. |
| `404 Not Found` | The requested resource does not exist or is not visible to the caller. | `GET /notes/note_missing`. |
| `500 Internal Server Error` | An unexpected server failure occurred. | The database is unavailable while saving a note. |
