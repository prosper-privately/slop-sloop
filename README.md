# slop-sloop
AI-generated sailing simulator

What’s in it:

- top-down sailing physics
- wind direction and gusts
- sail trim and rudder controls
- no-go zone / “in irons”
- buoy-rounding score loop
- HUD for speed, heading, trim, heel, VMG, and tack

## Controls

- A / D or ← / →: steer
- W / S or ↑ / ↓: trim sail
- Space: tack assist
- R: restart

## Deploying with GitHub Pages

This repo is configured to auto-deploy to GitHub Pages using GitHub Actions whenever `main` is updated.

### One-time GitHub setup

1. Push this repository to GitHub.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Ensure your default branch is `main` (or update `.github/workflows/deploy-pages.yml` if you use a different branch).

### Deploy flow

- Every push to `main` runs `.github/workflows/deploy-pages.yml`.
- The workflow uploads the repository as a Pages artifact and deploys it.
- Your site URL will be shown in the workflow run summary after deployment.

### Local preview

Because this is a static site, you can open `index.html` directly, or run a simple local web server:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.
