// Supabase Storage helper — uploads are stored in the cloud (not on the
// server's disk) so files survive Render restarts/redeploys.
// Falls back to local disk behavior when SUPABASE_URL / SERVICE_ROLE_KEY are not set.
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET = "uploads";

export function isStorageEnabled() {
  return Boolean(SUPABASE_URL && SERVICE_KEY);
}

export function isStoragePath(p) {
  return typeof p === "string" && p.startsWith(`/storage/${BUCKET}/`);
}

function storageKeyFromPath(p) {
  return p.replace(`/storage/${BUCKET}/`, "");
}

async function storageRequest(method, apiPath, { body, headers = {} } = {}) {
  return fetch(`${SUPABASE_URL}/storage/v1${apiPath}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      ...headers,
    },
    body,
  });
}

export async function ensureResumeBucket() {
  if (!isStorageEnabled()) return;
  try {
    const res = await storageRequest("POST", "/bucket", {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: BUCKET, public: false }),
    });
    if (!res.ok && res.status !== 400) {
      console.error("ensureResumeBucket:", res.status, await res.text());
    }
  } catch (err) {
    console.error("ensureResumeBucket error:", err.message);
  }
}

export async function uploadBytes(key, buf, contentType) {
  if (!isStorageEnabled()) throw new Error("Storage not configured");
  const res = await storageRequest("POST", `/object/${BUCKET}/${key}`, {
    headers: { "Content-Type": contentType },
    body: new Uint8Array(buf),
  });
  if (!res.ok) throw new Error(`Storage upload failed (${res.status})`);
  return `/storage/${BUCKET}/${key}`;
}

export async function readBytes(storagePath) {
  if (!isStorageEnabled()) throw new Error("Storage not configured");
  const res = await storageRequest("GET", `/object/${BUCKET}/${storageKeyFromPath(storagePath)}`);
  if (!res.ok) throw new Error(`Storage read failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

export async function deleteObject(storagePath) {
  if (!isStorageEnabled()) return;
  const res = await storageRequest("DELETE", `/object/${BUCKET}/${storageKeyFromPath(storagePath)}`);
  if (!res.ok && res.status !== 404) {
    throw new Error(`Storage delete failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
}
