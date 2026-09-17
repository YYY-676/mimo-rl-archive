# MiMo v2.6 RL archive

An hourly GitHub Actions job captures the live [MiMo RL dashboard](https://mimo.xiaomi.com/rl/) at `#overview` and `#metrics`.

Every run saves:

- rendered `overview.png` and `metrics.png`;
- the dashboard's live API responses, including status, tags, all chart series, notices and benchmarks;
- `manifest.json` with the UTC capture time and contents.

## Downloading a snapshot

Open **Actions** → **Capture MiMo RL snapshots** → select a run → download its `mimo-rl-<run-id>` artifact. GitHub keeps these artifacts for 90 days.

## Long-term archive (recommended)

To keep snapshots beyond 90 days, create a Cloudflare R2 bucket and add these repository secrets under **Settings → Secrets and variables → Actions**:

| Secret | Value |
| --- | --- |
| `R2_ACCESS_KEY_ID` | R2 API token access-key ID |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret access key |
| `R2_BUCKET` | Your bucket name |
| `R2_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` |

Once `R2_ACCESS_KEY_ID` is present, the same workflow additionally uploads every snapshot to `mimo-rl/<UTC timestamp>/` in that bucket. No workflow change is needed.

## Triggering immediately

From the workflow's **Run workflow** button, select `main` and run it once. Scheduled captures run at minute 17 of every UTC hour; timestamps inside each archive are the actual capture time.
