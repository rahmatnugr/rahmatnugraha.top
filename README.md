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

