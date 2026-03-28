import { getDb } from "@/lib/db";
import type { Collection, Folder, Request } from "@/lib/db";
import { useCollectionStore } from "@/stores/collectionStore";
import { useUiSettingsStore } from "@/stores/uiSettingsStore";

const now = () => new Date().toISOString();

const COLLECTION_ID = "sample-getting-started";
const FOLDER_JSONPLACEHOLDER = "folder-jsonplaceholder";
const FOLDER_GITHUB = "folder-github";
const FOLDER_WEATHER = "folder-weather";
const FOLDER_IMAGES = "folder-images";
const FOLDER_HTTPBIN = "folder-httpbin";

const SAMPLE_COLLECTION: Collection = {
  id: COLLECTION_ID,
  name: "Example Requests",
  description:
    "Sample API requests showcasing headers, query params, body, and public APIs",
  default_environment_id: null,
  created_at: now(),
  updated_at: now(),
};

const SAMPLE_FOLDERS: Omit<Folder, "created_at" | "updated_at">[] = [
  {
    id: FOLDER_JSONPLACEHOLDER,
    collection_id: COLLECTION_ID,
    parent_id: null,
    name: "JSONPlaceholder",
    sort_order: 0,
  },
  {
    id: FOLDER_GITHUB,
    collection_id: COLLECTION_ID,
    parent_id: null,
    name: "GitHub API",
    sort_order: 1,
  },
  {
    id: FOLDER_WEATHER,
    collection_id: COLLECTION_ID,
    parent_id: null,
    name: "Open-Meteo Weather",
    sort_order: 2,
  },
  {
    id: FOLDER_IMAGES,
    collection_id: COLLECTION_ID,
    parent_id: null,
    name: "Images & Placeholders",
    sort_order: 3,
  },
  {
    id: FOLDER_HTTPBIN,
    collection_id: COLLECTION_ID,
    parent_id: null,
    name: "httpbin (Echo & Debug)",
    sort_order: 4,
  },
];

const h = (key: string, value: string) => ({ key, value, enabled: true });
const q = (key: string, value: string) => ({ key, value, enabled: true });

const defaultScript = { pre_request_script: "", pre_request_script_enabled: true };

const SAMPLE_REQUESTS: Omit<Request, "created_at" | "updated_at">[] = [
  // ─── JSONPlaceholder ─────────────────────────────────────────────────
  {
    id: "sample-jp-list",
    collection_id: COLLECTION_ID,
    folder_id: FOLDER_JSONPLACEHOLDER,
    name: "List Posts (paginated)",
    method: "GET",
    url: "https://jsonplaceholder.typicode.com/posts",
    headers: [h("Accept", "application/json")],
    query_params: [q("_page", "1"), q("_limit", "5")],
    body_type: "none",
    body_content: "",
    auth_type: "none",
    auth_config: {},
    ...defaultScript,
    sort_order: 0,
  },
  {
    id: "sample-jp-single",
    collection_id: COLLECTION_ID,
    folder_id: FOLDER_JSONPLACEHOLDER,
    name: "Get Post by ID",
    method: "GET",
    url: "https://jsonplaceholder.typicode.com/posts/1",
    headers: [h("Accept", "application/json")],
    query_params: [],
    body_type: "none",
    body_content: "",
    auth_type: "none",
    auth_config: {},
    ...defaultScript,
    sort_order: 1,
  },
  {
    id: "sample-jp-create",
    collection_id: COLLECTION_ID,
    folder_id: FOLDER_JSONPLACEHOLDER,
    name: "Create Post",
    method: "POST",
    url: "https://jsonplaceholder.typicode.com/posts",
    headers: [
      h("Content-Type", "application/json"),
      h("Accept", "application/json"),
    ],
    query_params: [],
    body_type: "json",
    body_content: JSON.stringify(
      {
        title: "My New Post",
        body: "This is the content of my post.",
        userId: 1,
      },
      null,
      2,
    ),
    auth_type: "none",
    auth_config: {},
    ...defaultScript,
    sort_order: 2,
  },
  {
    id: "sample-jp-update",
    collection_id: COLLECTION_ID,
    folder_id: FOLDER_JSONPLACEHOLDER,
    name: "Update Post (PUT)",
    method: "PUT",
    url: "https://jsonplaceholder.typicode.com/posts/1",
    headers: [
      h("Content-Type", "application/json"),
      h("Accept", "application/json"),
    ],
    query_params: [],
    body_type: "json",
    body_content: JSON.stringify(
      { id: 1, title: "Updated Title", body: "Updated content.", userId: 1 },
      null,
      2,
    ),
    auth_type: "none",
    auth_config: {},
    ...defaultScript,
    sort_order: 3,
  },
  {
    id: "sample-jp-delete",
    collection_id: COLLECTION_ID,
    folder_id: FOLDER_JSONPLACEHOLDER,
    name: "Delete Post",
    method: "DELETE",
    url: "https://jsonplaceholder.typicode.com/posts/1",
    headers: [],
    query_params: [],
    body_type: "none",
    body_content: "",
    auth_type: "none",
    auth_config: {},
    ...defaultScript,
    sort_order: 4,
  },
  {
    id: "sample-jp-comments",
    collection_id: COLLECTION_ID,
    folder_id: FOLDER_JSONPLACEHOLDER,
    name: "Get Comments for Post",
    method: "GET",
    url: "https://jsonplaceholder.typicode.com/comments",
    headers: [h("Accept", "application/json")],
    query_params: [q("postId", "1")],
    body_type: "none",
    body_content: "",
    auth_type: "none",
    auth_config: {},
    ...defaultScript,
    sort_order: 5,
  },

  // ─── GitHub API ──────────────────────────────────────────────────────
  {
    id: "sample-gh-user",
    collection_id: COLLECTION_ID,
    folder_id: FOLDER_GITHUB,
    name: "Get Public User Profile",
    method: "GET",
    url: "https://api.github.com/users/octocat",
    headers: [
      h("Accept", "application/vnd.github.v3+json"),
      h("User-Agent", "FetchBoy"),
    ],
    query_params: [],
    body_type: "none",
    body_content: "",
    auth_type: "none",
    auth_config: {},
    ...defaultScript,
    sort_order: 0,
  },
  {
    id: "sample-gh-repos",
    collection_id: COLLECTION_ID,
    folder_id: FOLDER_GITHUB,
    name: "List User Repos (sorted)",
    method: "GET",
    url: "https://api.github.com/users/octocat/repos",
    headers: [
      h("Accept", "application/vnd.github.v3+json"),
      h("User-Agent", "FetchBoy"),
    ],
    query_params: [
      q("sort", "updated"),
      q("per_page", "5"),
      q("direction", "desc"),
    ],
    body_type: "none",
    body_content: "",
    auth_type: "none",
    auth_config: {},
    ...defaultScript,
    sort_order: 1,
  },
  {
    id: "sample-gh-search",
    collection_id: COLLECTION_ID,
    folder_id: FOLDER_GITHUB,
    name: "Search Repositories",
    method: "GET",
    url: "https://api.github.com/search/repositories",
    headers: [
      h("Accept", "application/vnd.github.v3+json"),
      h("User-Agent", "FetchBoy"),
    ],
    query_params: [
      q("q", "language:typescript stars:>1000"),
      q("sort", "stars"),
      q("per_page", "3"),
    ],
    body_type: "none",
    body_content: "",
    auth_type: "none",
    auth_config: {},
    ...defaultScript,
    sort_order: 2,
  },

  // ─── Open-Meteo Weather ──────────────────────────────────────────────
  {
    id: "sample-weather-forecast",
    collection_id: COLLECTION_ID,
    folder_id: FOLDER_WEATHER,
    name: "7-Day Forecast (London)",
    method: "GET",
    url: "https://api.open-meteo.com/v1/forecast",
    headers: [h("Accept", "application/json")],
    query_params: [
      q("latitude", "51.5074"),
      q("longitude", "-0.1278"),
      q("daily", "temperature_2m_max,temperature_2m_min"),
      q("timezone", "Europe/London"),
    ],
    body_type: "none",
    body_content: "",
    auth_type: "none",
    auth_config: {},
    ...defaultScript,
    sort_order: 0,
  },
  {
    id: "sample-weather-current",
    collection_id: COLLECTION_ID,
    folder_id: FOLDER_WEATHER,
    name: "Current Weather (Tokyo)",
    method: "GET",
    url: "https://api.open-meteo.com/v1/forecast",
    headers: [h("Accept", "application/json")],
    query_params: [
      q("latitude", "35.6762"),
      q("longitude", "139.6503"),
      q("current_weather", "true"),
    ],
    body_type: "none",
    body_content: "",
    auth_type: "none",
    auth_config: {},
    ...defaultScript,
    sort_order: 1,
  },

  // ─── Images & Placeholders ───────────────────────────────────────────
  {
    id: "sample-img-random",
    collection_id: COLLECTION_ID,
    folder_id: FOLDER_IMAGES,
    name: "Random Image (500x500)",
    method: "GET",
    url: "https://picsum.photos/500/500",
    headers: [],
    query_params: [],
    body_type: "none",
    body_content: "",
    auth_type: "none",
    auth_config: {},
    ...defaultScript,
    sort_order: 0,
  },
  {
    id: "sample-img-grayscale",
    collection_id: COLLECTION_ID,
    folder_id: FOLDER_IMAGES,
    name: "Grayscale Image",
    method: "GET",
    url: "https://picsum.photos/600/400",
    headers: [],
    query_params: [q("grayscale", "")],
    body_type: "none",
    body_content: "",
    auth_type: "none",
    auth_config: {},
    ...defaultScript,
    sort_order: 1,
  },
  {
    id: "sample-img-blur",
    collection_id: COLLECTION_ID,
    folder_id: FOLDER_IMAGES,
    name: "Blurred Image",
    method: "GET",
    url: "https://picsum.photos/600/400",
    headers: [],
    query_params: [q("blur", "5")],
    body_type: "none",
    body_content: "",
    auth_type: "none",
    auth_config: {},
    ...defaultScript,
    sort_order: 2,
  },

  // ─── httpbin (Echo & Debug) ──────────────────────────────────────────
  {
    id: "sample-hb-get",
    collection_id: COLLECTION_ID,
    folder_id: FOLDER_HTTPBIN,
    name: "Echo GET (inspect headers)",
    method: "GET",
    url: "https://httpbin.org/get",
    headers: [
      h("X-Custom-Header", "FetchBoy-Test"),
      h("Accept", "application/json"),
    ],
    query_params: [q("foo", "bar"), q("baz", "123")],
    body_type: "none",
    body_content: "",
    auth_type: "none",
    auth_config: {},
    ...defaultScript,
    sort_order: 0,
  },
  {
    id: "sample-hb-post",
    collection_id: COLLECTION_ID,
    folder_id: FOLDER_HTTPBIN,
    name: "Echo POST (inspect body)",
    method: "POST",
    url: "https://httpbin.org/post",
    headers: [
      h("Content-Type", "application/json"),
      h("X-Request-ID", "fetch-boy-demo"),
    ],
    query_params: [],
    body_type: "json",
    body_content: JSON.stringify(
      { message: "Hello from FetchBoy!", timestamp: "2026-03-28T00:00:00Z" },
      null,
      2,
    ),
    auth_type: "none",
    auth_config: {},
    ...defaultScript,
    sort_order: 1,
  },
  {
    id: "sample-hb-status",
    collection_id: COLLECTION_ID,
    folder_id: FOLDER_HTTPBIN,
    name: "Return Specific Status Code",
    method: "GET",
    url: "https://httpbin.org/status/418",
    headers: [],
    query_params: [],
    body_type: "none",
    body_content: "",
    auth_type: "none",
    auth_config: {},
    ...defaultScript,
    sort_order: 2,
  },
  {
    id: "sample-hb-headers",
    collection_id: COLLECTION_ID,
    folder_id: FOLDER_HTTPBIN,
    name: "Return Request Headers",
    method: "GET",
    url: "https://httpbin.org/headers",
    headers: [
      h("Authorization", "Bearer demo-token-12345"),
      h("X-Correlation-ID", "abc-def-ghi"),
    ],
    query_params: [],
    body_type: "none",
    body_content: "",
    auth_type: "none",
    auth_config: {},
    ...defaultScript,
    sort_order: 3,
  },
  {
    id: "sample-hb-delay",
    collection_id: COLLECTION_ID,
    folder_id: FOLDER_HTTPBIN,
    name: "Delayed Response (2s)",
    method: "GET",
    url: "https://httpbin.org/delay/2",
    headers: [],
    query_params: [],
    body_type: "none",
    body_content: "",
    auth_type: "none",
    auth_config: {},
    ...defaultScript,
    sort_order: 4,
  },
];

export async function seedSampleDataIfNeeded(): Promise<void> {
  const hasSeeded = useUiSettingsStore.getState().hasSeededSampleData;
  if (hasSeeded) return;

  const existingCollections = useCollectionStore.getState().collections;
  if (existingCollections.find((c) => c.id === COLLECTION_ID)) {
    useUiSettingsStore.getState().setHasSeededSampleData(true);
    await persistSeedFlag();
    return;
  }

  const timestamp = now();
  const collection: Collection = {
    ...SAMPLE_COLLECTION,
    created_at: timestamp,
    updated_at: timestamp,
  };
  const folders: Folder[] = SAMPLE_FOLDERS.map((f) => ({
    ...f,
    created_at: timestamp,
    updated_at: timestamp,
  }));
  const requests: Request[] = SAMPLE_REQUESTS.map((r) => ({
    ...r,
    created_at: timestamp,
    updated_at: timestamp,
  }));

  try {
    const db = await getDb();
    await db.execute(
      "INSERT INTO collections (id, name, description, default_environment_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      [
        collection.id,
        collection.name,
        collection.description,
        collection.default_environment_id,
        collection.created_at,
        collection.updated_at,
      ],
    );
    for (const f of folders) {
      await db.execute(
        "INSERT INTO folders (id, collection_id, parent_id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          f.id,
          f.collection_id,
          f.parent_id,
          f.name,
          f.sort_order,
          f.created_at,
          f.updated_at,
        ],
      );
    }
    for (const req of requests) {
      await db.execute(
        `INSERT INTO requests
                    (id, collection_id, folder_id, name, method, url, headers, query_params,
                     body_type, body_content, auth_type, auth_config, pre_request_script,
                     pre_request_script_enabled, sort_order, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.id,
          req.collection_id,
          req.folder_id,
          req.name,
          req.method,
          req.url,
          JSON.stringify(req.headers),
          JSON.stringify(req.query_params),
          req.body_type,
          req.body_content,
          req.auth_type,
          JSON.stringify(req.auth_config),
          req.pre_request_script,
          req.pre_request_script_enabled ? 1 : 0,
          req.sort_order,
          req.created_at,
          req.updated_at,
        ],
      );
    }
  } catch {
    // Not in a Tauri environment (e.g. tests) — skip DB write
  }

  useCollectionStore.getState().addCollection(collection);
  for (const f of folders) useCollectionStore.getState().addFolder(f);
  for (const req of requests) useCollectionStore.getState().addRequest(req);

  useUiSettingsStore.getState().setHasSeededSampleData(true);
  await persistSeedFlag();
}

async function persistSeedFlag(): Promise<void> {
  try {
    const db = await getDb();
    await db.execute(
      "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
      ["has_seeded_sample_data", "true"],
    );
  } catch {
    // Not in a Tauri environment — skip
  }
}
