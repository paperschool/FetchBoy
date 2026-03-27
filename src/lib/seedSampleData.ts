import { getDb } from "@/lib/db";
import type { Collection, Request } from "@/lib/db";
import { useCollectionStore } from "@/stores/collectionStore";
import { useUiSettingsStore } from "@/stores/uiSettingsStore";

const now = () => new Date().toISOString();

const SAMPLE_COLLECTION_ID = "sample-getting-started";

const SAMPLE_COLLECTION: Collection = {
  id: SAMPLE_COLLECTION_ID,
  name: "Getting Started",
  description: "Sample API requests to help you get started with FetchBoy",
  default_environment_id: null,
  created_at: now(),
  updated_at: now(),
};

const SAMPLE_REQUESTS: Omit<Request, "created_at" | "updated_at">[] = [
  {
    id: "sample-get-1",
    collection_id: SAMPLE_COLLECTION_ID,
    folder_id: null,
    name: "Get All Posts",
    method: "GET",
    url: "https://jsonplaceholder.typicode.com/posts",
    headers: [],
    query_params: [],
    body_type: "none",
    body_content: "",
    auth_type: "none",
    auth_config: {},
    sort_order: 0,
  },
  {
    id: "sample-get-2",
    collection_id: SAMPLE_COLLECTION_ID,
    folder_id: null,
    name: "Get Single Post",
    method: "GET",
    url: "https://jsonplaceholder.typicode.com/posts/1",
    headers: [],
    query_params: [],
    body_type: "none",
    body_content: "",
    auth_type: "none",
    auth_config: {},
    sort_order: 1,
  },
  {
    id: "sample-post-1",
    collection_id: SAMPLE_COLLECTION_ID,
    folder_id: null,
    name: "Create Post",
    method: "POST",
    url: "https://jsonplaceholder.typicode.com/posts",
    headers: [
      { key: "Content-Type", value: "application/json", enabled: true },
    ],
    query_params: [],
    body_type: "json",
    body_content: JSON.stringify(
      { title: "foo", body: "bar", userId: 1 },
      null,
      2,
    ),
    auth_type: "none",
    auth_config: {},
    sort_order: 2,
  },
  {
    id: "sample-get-3",
    collection_id: SAMPLE_COLLECTION_ID,
    folder_id: null,
    name: "Get User",
    method: "GET",
    url: "https://jsonplaceholder.typicode.com/users/1",
    headers: [],
    query_params: [],
    body_type: "none",
    body_content: "",
    auth_type: "none",
    auth_config: {},
    sort_order: 3,
  },
  {
    id: "sample-image-get-1",
    collection_id: SAMPLE_COLLECTION_ID,
    folder_id: null,
    name: "Get Image - 500 x 500",
    method: "GET",
    url: "https://picsum.photos/500/500",
    headers: [],
    query_params: [],
    body_type: "none",
    body_content: "",
    auth_type: "none",
    auth_config: {},
    sort_order: 0,
  },
  {
    id: "sample-image-get-2",
    collection_id: SAMPLE_COLLECTION_ID,
    folder_id: null,
    name: "Get Image - 1000 x 1000",
    method: "GET",
    url: "https://picsum.photos/1000/1000",
    headers: [],
    query_params: [],
    body_type: "none",
    body_content: "",
    auth_type: "none",
    auth_config: {},
    sort_order: 0,
  },
];

export async function seedSampleDataIfNeeded(): Promise<void> {
  const hasSeeded = useUiSettingsStore.getState().hasSeededSampleData;

  if (hasSeeded) {
    return;
  }

  const existingCollections = useCollectionStore.getState().collections;
  if (existingCollections.find((c) => c.id === SAMPLE_COLLECTION_ID)) {
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
  const requests: Request[] = SAMPLE_REQUESTS.map((r) => ({
    ...r,
    created_at: timestamp,
    updated_at: timestamp,
  }));

  try {
    const db = await getDb();
    await db.execute(
      "INSERT INTO collections (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      [
        collection.id,
        collection.name,
        collection.description,
        collection.created_at,
        collection.updated_at,
      ],
    );
    for (const req of requests) {
      await db.execute(
        `INSERT INTO requests
                    (id, collection_id, folder_id, name, method, url, headers, query_params,
                     body_type, body_content, auth_type, auth_config, sort_order, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
  for (const req of requests) {
    useCollectionStore.getState().addRequest(req);
  }

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
