# Cloudflare Pages Deployment Setup

This repo is configured for deployment to an existing Cloudflare Pages project with:

- Local CLI deployment via Wrangler
- GitHub Actions deployment on push to `main`

## 1) Local deployment with Wrangler

1. Install dependencies:
   ```bash
   npm install
   ```
2. Login to Cloudflare:
   ```bash
   npm run cf:login
   ```
3. Set your Pages project name:
   ```bash
   export CLOUDFLARE_PAGES_PROJECT_NAME="your-existing-project-name"
   ```
4. Deploy:
   ```bash
   npm run cf:deploy
   ```

## 2) GitHub Actions deployment

Workflow file: `.github/workflows/deploy-pages.yml`

Add these repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Add this repository variable:

- `CLOUDFLARE_PAGES_PROJECT_NAME`

Then push to `main`, or run the workflow manually from Actions.

## 3) Cloudflare API token permissions

Use an API token with at least:

- `Account - Cloudflare Pages: Edit`

## 4) Resume lead capture setup (D1 + Pages Functions)

1. Create a D1 database:
   ```bash
   npx wrangler d1 create resume-leads
   ```
2. Update `wrangler.toml`:
   - Replace `database_id = "REPLACE_WITH_D1_DATABASE_ID"` with your generated id.
3. Apply migrations:
   ```bash
   npx wrangler d1 migrations apply resume-leads --remote
   ```
4. Set required secrets:
   ```bash
   npx wrangler pages secret put TURNSTILE_SECRET_KEY
   npx wrangler pages secret put LEADS_IP_SALT
   npx wrangler pages secret put TELEGRAM_BOT_TOKEN
   npx wrangler pages secret put TELEGRAM_CHAT_ID
   ```
5. Turnstile site key:
   - Update the `data-sitekey` value in `about.html` from test key (`1x00000000000000000000AA`) to your production key.
6. Add a Cloudflare rate limiting rule:
   - Path: `/api/resume-lead`
   - Rule: throttle aggressive repeated requests from same IP.
