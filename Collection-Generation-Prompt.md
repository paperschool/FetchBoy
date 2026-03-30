# FetchBoy Collection Generation Prompt

You are generating an API collection for FetchBoy, a desktop API client. Output a single valid JSON object that conforms exactly to the FetchBoy native collection format described below. The user will save this JSON as a `.fetchboy` file and import it directly into the application, so strict adherence to the schema is required.

## Top-Level Envelope

```json
{
  "fetch_boy_version": "1.0",
  "type": "collection",
  "exported_at": "2025-01-01T00:00:00.000Z",
  "collection": { /* Collection object */ },
  "folders": [ /* Folder objects */ ],
  "requests": [ /* Request objects */ ],
  "environment": { /* optional — Environment object */ }
}
```

| Field               | Type   | Description                                                      |
|---------------------|--------|------------------------------------------------------------------|
| `fetch_boy_version` | string | Must be `"1.0"`.                                                |
| `type`              | string | Must be `"collection"`.                                         |
| `exported_at`       | string | ISO 8601 timestamp of when the file was generated.              |
| `collection`        | object | The collection metadata.                                        |
| `folders`           | array  | All folders in the collection (flat list, hierarchy via `parent_id`). |
| `requests`          | array  | All requests in the collection (flat list, placed via `folder_id`).  |
| `environment`       | object | Optional. If any `{{variable}}` placeholders are used, include this with the variables so an environment is created on import. |

---

## Collection Object

```json
{
  "id": "col-001",
  "name": "My API",
  "description": "API collection for the example service",
  "default_environment_id": null,
  "created_at": "2025-01-01T00:00:00.000Z",
  "updated_at": "2025-01-01T00:00:00.000Z"
}
```

| Field                    | Type        | Description                                         |
|--------------------------|-------------|-----------------------------------------------------|
| `id`                     | string      | Unique identifier. Use any unique string (e.g. UUID or slug). IDs are remapped on import. |
| `name`                   | string      | Display name of the collection.                     |
| `description`            | string      | Optional description. Use `""` if none.             |
| `default_environment_id` | string/null | Set to `null`. Environments are managed separately. |
| `created_at`             | string      | ISO 8601 timestamp.                                 |
| `updated_at`             | string      | ISO 8601 timestamp.                                 |

---

## Folder Object

Folders are stored as a **flat array**. Nesting is expressed via `parent_id` references. A top-level folder has `parent_id: null`.

```json
{
  "id": "folder-auth",
  "collection_id": "col-001",
  "parent_id": null,
  "name": "Auth",
  "sort_order": 0,
  "created_at": "2025-01-01T00:00:00.000Z",
  "updated_at": "2025-01-01T00:00:00.000Z"
}
```

| Field           | Type        | Description                                                   |
|-----------------|-------------|---------------------------------------------------------------|
| `id`            | string      | Unique identifier. Remapped on import.                       |
| `collection_id` | string      | Must match the collection's `id`.                            |
| `parent_id`     | string/null | `null` for top-level folders, or the `id` of the parent folder. |
| `name`          | string      | Display name of the folder.                                  |
| `sort_order`    | number      | Integer controlling display order within the parent (0-based). |
| `created_at`    | string      | ISO 8601 timestamp.                                          |
| `updated_at`    | string      | ISO 8601 timestamp.                                          |

---

## Request Object

Requests are stored as a **flat array**. Each request belongs to the collection and optionally to a folder.

```json
{
  "id": "req-001",
  "collection_id": "col-001",
  "folder_id": "folder-auth",
  "name": "Login",
  "method": "POST",
  "url": "{{base_url}}/auth/login",
  "headers": [
    { "key": "Content-Type", "value": "application/json", "enabled": true }
  ],
  "query_params": [],
  "body_type": "json",
  "body_content": "{\"email\": \"user@example.com\", \"password\": \"secret\"}",
  "auth_type": "none",
  "auth_config": {},
  "pre_request_script": "",
  "pre_request_script_enabled": true,
  "sort_order": 0,
  "created_at": "2025-01-01T00:00:00.000Z",
  "updated_at": "2025-01-01T00:00:00.000Z"
}
```

### Field Reference

| Field                        | Type    | Description                                                       |
|------------------------------|---------|-------------------------------------------------------------------|
| `id`                         | string  | Unique identifier. Remapped on import.                           |
| `collection_id`              | string  | Must match the collection's `id`.                                |
| `folder_id`                  | string/null | `null` if at collection root, or the `id` of the containing folder. |
| `name`                       | string  | Display name of the request.                                     |
| `method`                     | string  | HTTP method: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`. |
| `url`                        | string  | The full URL. May contain `{{variable}}` placeholders.           |
| `headers`                    | array   | Request headers (see KeyValuePair below).                        |
| `query_params`               | array   | Query parameters (see KeyValuePair below).                       |
| `body_type`                  | string  | One of: `none`, `raw`, `json`, `form-data`, `urlencoded`.       |
| `body_content`               | string  | The body as a string. For JSON bodies, this is the JSON string.  |
| `auth_type`                  | string  | One of: `none`, `bearer`, `basic`, `api-key`.                   |
| `auth_config`                | object  | Key-value object for auth configuration (see Auth below).        |
| `pre_request_script`         | string  | JavaScript code to run before the request. Use `""` if none.    |
| `pre_request_script_enabled` | boolean | Whether the pre-request script is active.                        |
| `sort_order`                 | number  | Integer controlling display order within the folder (0-based).   |
| `created_at`                 | string  | ISO 8601 timestamp.                                             |
| `updated_at`                 | string  | ISO 8601 timestamp.                                             |

### KeyValuePair

Used for `headers` and `query_params`:

```json
{ "key": "Accept", "value": "application/json", "enabled": true }
```

| Field     | Type    | Description                                |
|-----------|---------|--------------------------------------------|
| `key`     | string  | The header or parameter name.              |
| `value`   | string  | The header or parameter value.             |
| `enabled` | boolean | `true` to include when sending, `false` to skip. |

### Auth Configuration

The `auth_config` object varies by `auth_type`:

**`"none"`** — empty object:
```json
{ "auth_type": "none", "auth_config": {} }
```

**`"bearer"`** — token-based:
```json
{ "auth_type": "bearer", "auth_config": { "token": "my-bearer-token" } }
```

**`"basic"`** — username/password:
```json
{ "auth_type": "basic", "auth_config": { "username": "user", "password": "pass" } }
```

**`"api-key"`** — key/value pair:
```json
{ "auth_type": "api-key", "auth_config": { "key": "X-API-Key", "value": "my-api-key" } }
```

### Body Types

| `body_type`   | `body_content`                                      |
|---------------|-----------------------------------------------------|
| `none`        | `""` (empty string)                                 |
| `raw`         | Plain text body content.                            |
| `json`        | JSON string (e.g. `"{\"name\": \"Alice\"}"`).       |
| `form-data`   | Form data as a string.                              |
| `urlencoded`  | URL-encoded form body as a string.                  |

For JSON bodies, set `body_type` to `"json"` and include a `Content-Type: application/json` header.

---

## Environment Object (optional)

If any request uses `{{variable}}` placeholders in its URL, headers, or body, include an `environment` object at the top level so that FetchBoy creates an environment with those variables on import. The environment will be automatically named after the collection and linked as its default.

```json
{
  "environment": {
    "variables": [
      { "key": "base_url", "value": "https://api.example.com", "enabled": true },
      { "key": "auth_token", "value": "changeme", "enabled": true }
    ]
  }
}
```

| Field       | Type  | Description                                                     |
|-------------|-------|-----------------------------------------------------------------|
| `variables` | array | Array of KeyValuePair objects (same format as headers/query_params). |

Each variable:

| Field     | Type    | Description                                          |
|-----------|---------|------------------------------------------------------|
| `key`     | string  | The variable name (referenced as `{{key}}` in requests). |
| `value`   | string  | The default value for this variable.                 |
| `enabled` | boolean | `true` to activate the variable, `false` to skip it. |

Only include variables that are actually referenced by requests in the collection. Do not include empty or unused variables.

---

## Complete Example

```json
{
  "fetch_boy_version": "1.0",
  "type": "collection",
  "exported_at": "2025-01-01T00:00:00.000Z",
  "collection": {
    "id": "col-001",
    "name": "Example API",
    "description": "A sample API collection",
    "default_environment_id": null,
    "created_at": "2025-01-01T00:00:00.000Z",
    "updated_at": "2025-01-01T00:00:00.000Z"
  },
  "folders": [
    {
      "id": "folder-auth",
      "collection_id": "col-001",
      "parent_id": null,
      "name": "Auth",
      "sort_order": 0,
      "created_at": "2025-01-01T00:00:00.000Z",
      "updated_at": "2025-01-01T00:00:00.000Z"
    },
    {
      "id": "folder-users",
      "collection_id": "col-001",
      "parent_id": null,
      "name": "Users",
      "sort_order": 1,
      "created_at": "2025-01-01T00:00:00.000Z",
      "updated_at": "2025-01-01T00:00:00.000Z"
    }
  ],
  "requests": [
    {
      "id": "req-login",
      "collection_id": "col-001",
      "folder_id": "folder-auth",
      "name": "Login",
      "method": "POST",
      "url": "{{base_url}}/auth/login",
      "headers": [
        { "key": "Content-Type", "value": "application/json", "enabled": true }
      ],
      "query_params": [],
      "body_type": "json",
      "body_content": "{\"email\": \"user@example.com\", \"password\": \"secret\"}",
      "auth_type": "none",
      "auth_config": {},
      "pre_request_script": "",
      "pre_request_script_enabled": true,
      "sort_order": 0,
      "created_at": "2025-01-01T00:00:00.000Z",
      "updated_at": "2025-01-01T00:00:00.000Z"
    },
    {
      "id": "req-list-users",
      "collection_id": "col-001",
      "folder_id": "folder-users",
      "name": "List Users",
      "method": "GET",
      "url": "{{base_url}}/users",
      "headers": [
        { "key": "Accept", "value": "application/json", "enabled": true }
      ],
      "query_params": [
        { "key": "limit", "value": "10", "enabled": true }
      ],
      "body_type": "none",
      "body_content": "",
      "auth_type": "bearer",
      "auth_config": { "token": "{{auth_token}}" },
      "pre_request_script": "",
      "pre_request_script_enabled": true,
      "sort_order": 0,
      "created_at": "2025-01-01T00:00:00.000Z",
      "updated_at": "2025-01-01T00:00:00.000Z"
    },
    {
      "id": "req-create-user",
      "collection_id": "col-001",
      "folder_id": "folder-users",
      "name": "Create User",
      "method": "POST",
      "url": "{{base_url}}/users",
      "headers": [
        { "key": "Content-Type", "value": "application/json", "enabled": true }
      ],
      "query_params": [],
      "body_type": "json",
      "body_content": "{\"name\": \"Alice\", \"email\": \"alice@example.com\"}",
      "auth_type": "bearer",
      "auth_config": { "token": "{{auth_token}}" },
      "pre_request_script": "",
      "pre_request_script_enabled": true,
      "sort_order": 1,
      "created_at": "2025-01-01T00:00:00.000Z",
      "updated_at": "2025-01-01T00:00:00.000Z"
    }
  ],
  "environment": {
    "variables": [
      { "key": "base_url", "value": "https://api.example.com", "enabled": true },
      { "key": "auth_token", "value": "changeme", "enabled": true }
    ]
  }
}
```

## Rules

1. Output **only** the JSON object — no markdown fences, no commentary.
2. The file must be saved with a `.fetchboy` extension.
3. All `id` fields must be unique within the file. Use readable slugs or UUIDs.
4. All `collection_id` references in folders and requests must match the collection's `id`.
5. All `folder_id` references in requests must match a folder's `id` (or be `null` for root-level requests).
6. All `parent_id` references in folders must match another folder's `id` (or be `null` for top-level folders).
7. Use `{{variable}}` syntax in URLs, headers, and body content for values the user should configure per-environment.
8. If any `{{variable}}` placeholders are used, include an `environment` object with all referenced variables and sensible default values.
9. Organise related requests into folders for clarity.
10. Include realistic placeholder values rather than empty strings.
11. Set appropriate `Content-Type` headers when a body is present.
12. Use `sort_order` to control the display order of folders and requests (0-based, sequential within their parent).
