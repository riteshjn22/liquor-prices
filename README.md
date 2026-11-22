# Trendswe Liquor Info

SEO-first liquor price directory for India. One page per **brand** from your own brand list,
with an approximate India price range plus **state-wise price tables**:
- **Delhi** prices come automatically from the Delhi excise department (synced daily).
- **Other states** are prices you add in Excel.

You choose which brands appear: every brand can be switched on or off in the admin.

```
/                                   home: search, categories, popular brands, latest price changes
/prices                             category directory
/prices/whisky                      A–Z list of enabled whisky brands with price ranges
/prices/rum/old-monk                brand page: range, price table per state, FAQ, similar brands
/search?q=...                       search (noindex)
/admin                              password-protected: brand on/off switches, Excel export / import
/sitemap.xml  /robots.txt
```

Categories (whisky, beer, wine, vodka, rum, brandy) are defined in `src/lib/categories.ts`.
Delhi's beer types (light, strong, draught) are grouped under "beer", and cognac under "brandy".

**Stack:** Next.js 16 (App Router, Cache Components) · MongoDB Atlas · Vercel (hosting + daily cron) · ImageKit (brand images, optional).

---

## Run it locally

Needs Node.js 20+.

```bash
npm install
cp .env.example .env.local          # Windows PowerShell: Copy-Item .env.example .env.local
```

Open `.env.local` and set `CRON_SECRET`, `REVALIDATE_SECRET` and `ADMIN_PASSWORD` to long random strings:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Then, in **three terminals**:

```bash
npm run db      # 1. local MongoDB (first run downloads ~800 MB once; keep it running)
npm run sync    # 2. pull the Delhi excise list (~20 s)
npm run dev     # 3. http://localhost:3000
```

4. Open http://localhost:3000/admin, log in (`admin` / your `ADMIN_PASSWORD`) and upload your brand
   list Excel (e.g. `Liquor_Brands_Price_Range_India.xlsx`). That creates the brands and links Delhi products to them.

`npm run db` is only for development. You can skip it and point `MONGODB_URI` at your Atlas cluster instead.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / server (needs the database) |
| `npm run sync` | Fetch the Delhi excise list and re-link products to brands. `-- --force` rewrites even if unchanged |
| `npm run images:link` | Link images uploaded to ImageKit to their brands |
| `npm run typecheck` / `npm run lint` | Checks |

---

## Admin

Set `ADMIN_PASSWORD` (8+ characters; `ADMIN_USER` defaults to `admin`). Open **`/admin`**; the browser asks for the login.

### Brand on/off

A table of every brand with an **on/off switch**, search, category and status filters, and bulk
**Enable / Disable** for the selected (or all filtered) brands. Only enabled brands appear on the site, in
search and in the sitemap; a disabled brand's page returns 404. Changes are live immediately.

New brands start enabled. Delhi products are only ever shown inside a brand page, so a product that
doesn't belong to one of your brands never appears on the site.

### Excel

**Download Excel** gives one file with four sheets. Edit the **yellow** columns only:

| Sheet | What you can do |
|---|---|
| **Brands** | Add a brand (new row with Category + Brand name, Key left blank), rename, **Enabled** yes/no, **Price range in India** (e.g. `₹700 – ₹950`), Price note, Description, SEO title / description, Image path, **Match words** (extra names to find the brand in the Delhi list, e.g. `mc dowells`) |
| **State prices** | Add prices for any state: Brand key (e.g. `rum/old-monk`), **State**, Variant, Size, **MRP**, Note. Leave Price ID blank for new rows; type `yes` in **Delete** to remove one |
| **Delhi products** | See which official Delhi product is linked to which brand. **Assign to brand** fixes a match (a brand key, or `none` to leave it out); **Variant name** changes the name shown |
| Read me | Instructions |

**Upload** the file, check the **preview** of every change, then press **Apply**.
- Any error (unknown state, bad price, unknown key…) blocks the whole upload, with its sheet and row number. Nothing is half-saved.
- Rows you delete from the file are left unchanged on the site.
- The upload also accepts a **plain brand list**: sheets named after categories (`Whiskies`, `Beers`, `Wines`, `Vodkas`, `Rums`, `Brandies`)
  with a `Brand` column and a price column. Missing brands are created; existing ones get their price range refreshed.
  Duplicate rows are merged with a warning.
- Brand page URLs never change after a brand is created (renaming keeps the URL; category can't be changed).
- The daily sync never overwrites your brands, state prices, assignments or variant names.

---

## Deploy (all free tiers)

### 1. MongoDB Atlas

1. Create a free **M0** cluster. Pick **AWS Mumbai (ap-south-1)** so it is close to Vercel's Mumbai region.
2. *Database Access*: add a database user with a strong password.
3. *Network Access*: add `0.0.0.0/0` (Vercel's IPs are not fixed).
4. *Connect → Drivers*: copy the connection string, e.g.
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
5. **Load data before the first deploy** (the build prerenders brand pages from it): put that string in
   `.env.local` as `MONGODB_URI`, run `npm run sync`, then `npm run dev`, open `/admin` and upload your brand list.

### 2. Push to GitHub

```bash
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
   | `NEXT_PUBLIC_SITE_NAME` | `Trendswe Liquor Info` (the part after the first word shows in gold) |
   | `NEXT_PUBLIC_SITE_TAGLINE` | optional tagline under the name |
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
> Brands added in the admin after a deploy get their pages on the first visit (then cached), no redeploy needed.

### 4. ImageKit (optional brand photos)

Pages show a built-in bottle illustration until a photo is linked.

1. Copy your **URL endpoint** (Developer options) into `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT` on Vercel and in `.env.local`.
2. Upload photos named after the brand page URL: `/brands/<category>/<brand-slug>.jpg`,
   e.g. `/brands/rum/old-monk.jpg` for `/prices/rum/old-monk`.
3. Put your **private key** in `.env.local` only (`IMAGEKIT_PRIVATE_KEY`; never add it to Vercel), then run
   `npm run images:link`. Set `SITE_URL_FOR_REVALIDATE=https://your-domain.com` too, so the live site refreshes right away.

You can also type an image path in the Brands sheet of the admin Excel.

### 5. Optional backup sync (GitHub Actions)

`.github/workflows/sync.yml` runs the same sync from GitHub every day, with no 60-second limit.
Use it if the Vercel cron times out because the government server is slow.
Add repository secrets `MONGODB_URI`, `REVALIDATE_SECRET` and `SITE_URL_FOR_REVALIDATE`.

---

## How the data works

```
Your brand list (Excel)  ──>  brands         one per page: name, category, enabled, price range, content
Delhi excise API (daily) ──>  products       ~2,500 official products with every size and MRP
                                  │           linked to a brand by name (longest match wins, so
                                  │           "Old Monk Coffee" products go to that brand, not "Old Monk")
Your Excel (State prices)──>  state_prices   prices you add for any state
                                  ▼
Brand page = brand + its Delhi products (official table) + state prices (one table per state)
```

- `src/lib/sources/delhi.ts`: fetch with retries; skip rows with no MRP; strip label codes and e-mail addresses glued onto names.
- `src/lib/build-products.ts`: one product per name, with every size, current price and history.
- `src/lib/sync.ts`: skip if unchanged; upsert products; log price changes; re-link products to brands.
- `src/lib/brand-match.ts`: product → brand matching, variant names, price-range parsing.
- If the source returns fewer than 1,000 rows, the sync aborts and keeps the existing data.

**Collections:** `brands`, `products`, `state_prices`, `price_changes`, `sync_runs`, `imports`.

### Rendering and SEO

- Every page is static. Data reads use `'use cache'` with the `prices` tag, refreshed by the daily sync and by admin changes.
- `ensureStatic = "navigation"` means crawlers always get complete HTML.
- Unique title, description and canonical on every page; real 404s for unknown or disabled brands.
- Structured data: BreadcrumbList, FAQPage, ItemList (category pages), Product + AggregateOffer (brand pages, from listed prices only).

### Adding an automatic source for another state

1. Write `src/lib/sources/<state>.ts` that returns `PriceRow[]` (see `delhi.ts`).
2. Register it in `src/lib/sources/index.ts` and `STATES` in `src/lib/config.ts`.

Its products are linked to your brands automatically and appear as another official state table.

---

## Notes

- **Price ranges** come from your Excel and are shown as "approximate". Only the Delhi tables (and any future automatic sources)
  are labelled as official excise MRP; prices you add are labelled "added by our team".
- **Vercel Hobby** is for personal, non-commercial projects. If the site will earn money (ads, affiliate links), check Vercel's terms and plan for the Pro plan.
- The site credits the excise department on every official table and does not sell alcohol.
