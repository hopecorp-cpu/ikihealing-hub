const API = "https://api.github.com";
const OWNER = "your-org";
const REPO = "nova-website";
const BRANCH = "main";

export type CommitFile = {
  path: string;
  content: string;
  isBase64?: boolean;
};

function headers(): Record<string, string> {
  const token = (process.env.APP_GH_TOKEN || "").trim();
  if (!token) throw new Error("Chưa cấu hình APP_GH_TOKEN");
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "ops-hub-blogwriter",
  };
}

async function gh<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers as Record<string, string> | undefined) },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub ${init?.method || "GET"} ${path} -> ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export async function listSlugs(): Promise<string[]> {
  const items = await gh<Array<{ name: string; type: string }>>(
    `/repos/${OWNER}/${REPO}/contents/blog?ref=${BRANCH}`
  );
  return items
    .filter((it) => it.type === "file" && it.name.endsWith(".html"))
    .map((it) => it.name.replace(/\.html$/, ""));
}

export async function getFile(path: string): Promise<string> {
  const res = await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`, {
    headers: { ...headers(), Accept: "application/vnd.github.raw+json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub GET ${path} -> ${res.status}: ${body.slice(0, 200)}`);
  }
  return await res.text();
}

export async function commitBatch(files: CommitFile[], message: string): Promise<string> {
  if (!files.length) throw new Error("commitBatch: không có file nào để commit");

  const ref = await gh<{ object: { sha: string } }>(
    `/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`
  );
  const baseCommitSha = ref.object.sha;
  const baseCommit = await gh<{ tree: { sha: string } }>(
    `/repos/${OWNER}/${REPO}/git/commits/${baseCommitSha}`
  );

  const treeItems: Array<{ path: string; mode: "100644"; type: "blob"; sha: string }> = [];
  for (const f of files) {
    const blob = await gh<{ sha: string }>(`/repos/${OWNER}/${REPO}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({
        content: f.content,
        encoding: f.isBase64 ? "base64" : "utf-8",
      }),
    });
    treeItems.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
  }

  const tree = await gh<{ sha: string }>(`/repos/${OWNER}/${REPO}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: treeItems }),
  });

  const commit = await gh<{ sha: string }>(`/repos/${OWNER}/${REPO}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message, tree: tree.sha, parents: [baseCommitSha] }),
  });

  await gh(`/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });

  return commit.sha;
}

export async function soBaiTrongNgay(ngayVN: string): Promise<number> {

  const since = `${ngayVN}T00:00:00+07:00`;
  const until = `${ngayVN}T23:59:59+07:00`;
  const commits = await gh<Array<{ sha: string }>>(
    `/repos/${OWNER}/${REPO}/commits?sha=${BRANCH}&path=blog`
    + `&since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}&per_page=30`
  );

  const slugs = new Set<string>();
  for (const c of commits) {
    const chiTiet = await gh<{ files?: Array<{ filename: string; status: string }> }>(
      `/repos/${OWNER}/${REPO}/commits/${c.sha}`
    );
    for (const f of chiTiet.files || []) {

      if (f.status !== "added") continue;
      const m = f.filename.match(/^blog\/([a-z0-9-]+)\.html$/);
      if (m && m[1] !== "index") slugs.add(m[1]);
    }
  }
  return slugs.size;
}
