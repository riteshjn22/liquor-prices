# Liquor Price Index

SEO-first liquor price website. Official MRPs are pulled daily from state excise
departments (Delhi today), cleaned, stored in MongoDB, and served as static pages.

```
/prices                                   all states
/prices/delhi                             state hub: types, popular brands, recent changes
/prices/delhi/whisky                      every whisky brand, filterable (?q= &size= &sort=)
/prices/delhi/whisky/<brand-slug>         sizes, tax breakdown, price history, FAQ
/search?q=...                             search (noindex)
/admin                                    password-protected Excel export / import
/sitemap.xml  /robots.txt
```

**Stack:** Next.js 16 (App Router, Cache Components) · MongoDB Atlas · Vercel (hosting + daily cron) · ImageKit (brand images, optional).

---

## Run it locally

Needs Node.js 20+.

```bash
npm install
cp .env.example .env.local          # Windows PowerShell: Copy-Item .env.example .env.local
```

Open `.env.local` and set `CRON_SECRET` and `REVALIDATE_SECRET` to any long random strings:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then, in **three terminals**:

```bash
npm run db      # 1. local MongoDB (first run downloads ~800 MB once; keep it running)
npm run sync    # 2. pull the Delhi price list into the database (~20 s)
npm run dev     # 3. http://localhost:3000
```

`npm run db` is only for development. You can skip it and point `MONGODB_URI`
at your Atlas cluster instead.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / server (needs the database) |
| `npm run sync` | Fetch + clean + save prices. `-- --force` rewrites even if unchanged |
| `npm run images:link` | Link images uploaded to ImageKit to their brands |
| `npm run typecheck` / `npm run lint` | Checks |

---

## Deploy (all free tiers)

### 1. MongoDB Atlas

1. Create a free **M0** cluster. Pick **AWS Mumbai (ap-south-1)** so it is close to Vercel's Mumbai region.
2. *Database Access*: add a database user with a strong password.
3. *Network Access*: add `0.0.0.0/0` (Vercel's IPs are not fixed).
4. *Connect → Drivers*: copy the connection string, e.g.
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
5. **Load the data once before the first deploy** (the build prerenders pages from it):
   put that string in `.env.local` as `MONGODB_URI`, then run `npm run sync`.

### 2. Push to GitHub

```bash
git add .
git commit -m "Initial liquor price site"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

`.env.local` and `.data/` are git-ignored, so secrets and the local database stay on your machine.

### 3. Vercel

1. *Add New → Project*, import the GitHub repo (framework is auto-detected).
2. *Settings → Environment Variables*, add for **Production** (and Preview if you use it):

   | Name | Value |
   |---|---|
   | `MONGODB_URI` | Atlas connection string |
   | `MONGODB_DB` | `liquor` |
   | `NEXT_PUBLIC_SITE_URL` | `https://your-domain.com` (no trailing slash) |
   | `NEXT_PUBLIC_SITE_NAME` | Your site name |
   | `CRON_SECRET` | long random string |
   | `REVALIDATE_SECRET` | another long random string |
   | `ADMIN_PASSWORD` | password for `/admin` (8+ characters) |
   | `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT` | optional, see ImageKit below |

3. Deploy. `vercel.json` already:
   - runs functions in **Mumbai (`bom1`)**, close to the Delhi server and to Atlas;
   - schedules **`/api/cron/sync` daily at 21:30 UTC (03:00 IST)**. Vercel sends the `CRON_SECRET` automatically.
4. Check it: *Settings → Cron Jobs → Run*, or
   `curl -H "Authorization: Bearer <CRON_SECRET>" https://your-domain.com/api/cron/sync`
5. Add your domain, then submit `https://your-domain.com/sitemap.xml` in Google Search Console.

> Changing `NEXT_PUBLIC_*` variables needs a redeploy, because they are baked in at build time.

### 4. ImageKit (optional brand photos)

Pages show a built-in bottle illustration until a photo is linked.

1. Copy your **URL endpoint** (Developer options) into `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT` on Vercel and in `.env.local`.
2. Upload photos named after the brand page URL:
   `/brands/<state>/<type>/<brand-slug>.jpg`, e.g.
   `/brands/delhi/rum/old-monk-matured-xxx-select-rum-vov.jpg`
3. Put your **private key** in `.env.local` only (`IMAGEKIT_PRIVATE_KEY`; never add it to Vercel), then:
   ```bash
   npm run images:link
   ```
   Set `SITE_URL_FOR_REVALIDATE=https://your-domain.com` too, so the live site refreshes right away.

Images are served straight from ImageKit with on-the-fly resizing, so they don't use Vercel's image-optimisation quota.

### 5. Admin: edit data with Excel

Set `ADMIN_PASSWORD` (8+ characters; `ADMIN_USER` defaults to `admin`) in `.env.local` and on Vercel.
Then open **`/admin`**. The browser asks for the user name and password.

1. **Download Excel.** You get three sheets:
   - **Read me**: instructions.
   - **Brands**: one row per brand.
   - **Prices**: one row per brand size.
2. **Edit the yellow columns only:**

   | Sheet | Column | Effect |
   |---|---|---|
   | Brands | Display name | Shown instead of the official name (the URL never changes) |
   | Brands | Description | Your own text on the brand page; a blank line starts a new paragraph |
   | Brands | SEO title / SEO description | Replace the automatic Google title / description |
   | Brands | Image path | ImageKit path, e.g. `/brands/delhi/rum/old-monk.jpg` |
   | Brands | Hidden | `yes` removes the brand everywhere (page returns 404, gone from sitemap and search) |
   | Prices | MRP override | Price shown instead of the official MRP for that size |

3. **Upload** the file on `/admin`, check the **preview** of every change, then press **Apply**.
   Changes are live on the next page visit.

Rules:
- A blank yellow cell means "use the official value", so clearing a cell undoes an edit.
- You can delete rows you didn't touch, sort, filter or reorder columns. Missing rows are left as they are.
- Any error (unknown key, bad price, etc.) blocks the whole upload and is listed with its sheet and row number. Nothing is half-saved.
- **Edits survive the daily sync.** The sync updates the official values and re-applies your edits on top.
  A price override stays until you clear it, even if the official price changes. The export shows both columns so you can compare.
- The export always includes your current edits, so the latest download is your up-to-date master copy.

Edits are stored on each brand as `overrides` (plus `image`). Each upload is logged in the `imports` collection.

### 6. Optional backup sync (GitHub Actions)

`.github/workflows/sync.yml` runs the same sync from GitHub every day, with no 60-second limit.
Use it if the Vercel cron times out because the government server is slow.
Add repository secrets `MONGODB_URI`, `REVALIDATE_SECRET` and `SITE_URL_FOR_REVALIDATE`.
It can also be run by hand from the *Actions* tab.

---

## How the data pipeline works

```
Delhi excise API (one ~6 MB JSON, ~8,700 rows)
  → src/lib/sources/delhi.ts   fetch with retries; skip rows with no MRP;
                               strip label codes ("...L1F20228261") and e-mail
                               addresses glued onto brand names; title-case; slugs
  → src/lib/build-brands.ts    one document per state + type + brand, with every
                               size, current price, and price history across years
  → src/lib/sync.ts            skip if the source hash is unchanged; upsert to
                               MongoDB; log price changes; brands that disappear
                               keep their page (inSource: false) so URLs never 404
  → revalidateTag("prices")    cached pages refresh in the background
```

Safety checks: if the source returns fewer than 1,000 rows, the sync aborts and keeps the existing data.
Every run is logged in the `sync_runs` collection.

**Collections:** `brands` (one per page, including your `overrides`), `price_changes`, `sync_runs`, `imports`.

### Rendering and SEO

- Every page is static. Data reads use `'use cache'` with the `prices` tag, refreshed by the daily sync.
- `ensureStatic = "navigation"` means crawlers always get complete HTML, including pages not prerendered at build (rendered on first visit, then cached).
- Unique title, description and canonical on every page. Filter URLs (`?size=...`) keep the clean canonical, so they never compete in search.
- Structured data: BreadcrumbList, FAQPage, ItemList (type pages), Product + AggregateOffer (brand pages).
- `sitemap.xml` lists every state, type and brand URL. Unknown URLs return a real 404.

### Adding another state

1. Write `src/lib/sources/<state>.ts` that returns `PriceRow[]` (see `delhi.ts`).
2. Register it in `src/lib/sources/index.ts` and `STATES` in `src/lib/config.ts`.

URLs, sitemap and pages pick it up automatically.

---

## Notes

- **State in the data:** Delhi's `State_Desc` field is where a product is *manufactured*.
  It is shown as "Made in"; every price on the Delhi pages is a Delhi price.
- **Vercel Hobby** is for personal, non-commercial projects. If the site will earn money (ads, affiliate links), check Vercel's terms and plan for the Pro plan.
- Prices are the official MRP. The site credits the excise department on every page and does not sell alcohol.
