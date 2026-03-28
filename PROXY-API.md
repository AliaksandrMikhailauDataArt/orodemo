# Oro Proxy — Frontend API Reference

Base URL: `http://localhost:3001` (default)

The proxy handles OAuth2 client credentials and Authelia authentication transparently. The frontend never sends `client_id` or `client_secret`.

---

## Authentication Endpoints

### POST /login

Authenticate a registered customer user.

**Request:**

```json
{
  "username": "user@example.com",
  "password": "secret"
}
```

**Response (200):**

```json
{
  "access_token": "eyJ...",
  "refresh_token": "def...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

**Error (401):**

```json
{
  "error": "invalid_grant",
  "error_description": "Invalid credentials.",
  "message": "The user credentials were incorrect."
}
```

---

### POST /guest-token

Get a guest token for anonymous catalog browsing. No request body needed.

**Request:** empty body

**Response (200):**

```json
{
  "access_token": "eyJ...",
  "refresh_token": "def...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

---

### POST /refresh-token

Exchange a refresh token for a new token pair.

**Request:**

```json
{
  "refresh_token": "def..."
}
```

**Response (200):**

```json
{
  "access_token": "eyJ...",
  "refresh_token": "def...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

---

## API Proxy

### ALL /api/*

All OroCommerce Storefront API requests are proxied through this path. The proxy forwards the request to Oro and returns the response as-is.

**Required headers on every request:**

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer {access_token}` |
| `Content-Type` | `application/vnd.api+json` |
| `Accept` | `application/vnd.api+json` |
| `X-Include` | `totalCount;noHateoas` (optional, for pagination) |

**Forwarded response headers:** `Content-Type`, `X-Include-Total-Count`

---

## Health Check

### GET /health

Returns `{ "ok": true }`.

---

## Frontend Token Management

1. On page load, call `POST /guest-token` to get anonymous access.
2. On login, call `POST /login` with user credentials. Store the returned tokens.
3. Include `Authorization: Bearer {access_token}` on all `/api/*` requests.
4. Track `expires_in` — call `POST /refresh-token` before the token expires (e.g. 60 seconds before).
5. If refresh fails, redirect to login.
6. On logout, discard stored tokens and call `POST /guest-token` to revert to anonymous access.

---

## Error Codes

| Status | Meaning |
|--------|---------|
| 400 | Missing required fields (check request body) |
| 401 | Invalid credentials or expired token |
| 403 | Insufficient permissions |
| 404 | Resource not found |
| 422 | Validation error (check `errors` array) |
| 502 | Proxy could not reach Oro upstream |