import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = "https://mimo.xiaomi.com/rl";
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = join("snapshots", stamp);

async function getJson(path) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { "user-agent": "mimo-rl-archive/1.0" },
  });
  if (!response.ok) throw new Error(`${response.status} ${path}`);
  return response.json();
}

async function writeJson(relativePath, value) {
  const filename = join(outDir, relativePath);
  await mkdir(join(filename, ".."), { recursive: true });
  await writeFile(filename, `${JSON.stringify(value, null, 2)}\n`);
}

async function archiveApi() {
  const runs = await getJson("/api/runs");
  await writeJson("api/runs.json", runs);

  await Promise.all([
    getJson("/api/notices").then((data) => writeJson("api/notices.json", data)),
    getJson("/api/benchmarks").then((data) => writeJson("api/benchmarks.json", data)),
  ]);

  for (const run of runs.runs ?? []) {
    const key = run.key;
    const status = await getJson(`/api/status?run=${encodeURIComponent(key)}`);
    const live = await getJson(`/api/live?run=${encodeURIComponent(key)}`);
    const tags = await getJson(`/api/tags?run=${encodeURIComponent(key)}&v=${encodeURIComponent(status.version)}`);
    await writeJson(`api/${key}/status.json`, status);
    await writeJson(`api/${key}/live.json`, live);
    await writeJson(`api/${key}/tags.json`, tags);

    // The site itself asks for metric series in batches of up to 96 tags.
    const allTags = tags.tags ?? [];
    for (let i = 0; i < allTags.length; i += 96) {
      const batch = allTags.slice(i, i + 96);
      const query = new URLSearchParams({ run: key, v: status.version, tags: batch.join(",") });
      const series = await getJson(`/api/series?${query}`);
      await writeJson(`api/${key}/series-${String(i / 96).padStart(3, "0")}.json`, series);
    }
  }
  return runs;
}

async function screenshot(browser, name, hash) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/#${hash}`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(5_000); // lets charts finish their post-load rendering
  await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: true });
  await page.close();
}

await mkdir(outDir, { recursive: true });
const startedAt = new Date().toISOString();
const [runs] = await Promise.all([
  archiveApi(),
  (async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      await screenshot(browser, "overview", "overview");
      await screenshot(browser, "metrics", "metrics");
    } finally {
      await browser.close();
    }
  })(),
]);

await writeJson("manifest.json", {
  captured_at_utc: startedAt,
  completed_at_utc: new Date().toISOString(),
  source: BASE,
  routes: ["#overview", "#metrics"],
  run_keys: (runs.runs ?? []).map((run) => run.key),
  contents: ["overview.png", "metrics.png", "api/", "manifest.json"],
});
console.log(`Saved snapshot to ${outDir}`);
