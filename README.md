# Remint — Smart Waste Management

A lightweight prototype for **“Smart Waste Management: Turning Everyday Waste into Valuable Resources.”** Remint helps people look up sorting guidance, log recovered materials, understand estimated resource impact, and arrange a neighborhood pickup.

## Run locally

Requires Node.js 18 or newer; there are no external packages to install.

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000). Set `PORT` to use a different port. On GitHub Pages, Remint automatically switches to browser storage; each visitor's saved items and pickup requests stay in that browser and are not shared with other visitors.
To preview the browser-storage mode locally, open [http://localhost:3000/?storage=browser](http://localhost:3000/?storage=browser).

Open [http://localhost:3000/infographic.html](http://localhost:3000/infographic.html) for the presentation-ready value-chain visual; use **Print / save PDF** to export a slide-sized copy.

## Publish on GitHub Pages

The public repository is configured to deploy the static site from `public/` whenever changes to the site or deployment workflow land on `main`. In **Settings → Pages**, choose **GitHub Actions** as the build and deployment source if it is not already enabled. After the first successful deployment, GitHub displays the public website URL in that Pages settings screen and on the deployment workflow.

The public site URL for this repository will be `https://neeraj-prabhanjan11.github.io/HACKARENA/`. The hosted static version is a demo, not a shared multi-user service: it has no central database, identity/login, or live municipal connection. A backend and shared database would be needed for all households, campuses, municipalities, and scrap dealers to see the same records.

## Try the prototype

- **Sort & log:** Search the quick guide or choose **Log waste**. Add a material and estimated weight to update the dashboard.
- **See your impact:** The overview recalculates recovered weight, a material-based CO₂e estimate, illustrative resource value, weekly sorting activity, and recent items.
- **Schedule a pickup:** Choose a future date, time window, address, and at least one recyclable material. The next collection appears on the dashboard.

The app starts with three clearly illustrative sample entries so the impact dashboard has something to show. New items and collection requests persist in the generated `data.json` file in the project root. Set `DATA_FILE` to use another storage path. Remove the data file and restart the server to restore the starter demo data.

## How it works

- `server.js` serves the static interface and exposes JSON endpoints: `GET /api/materials`, `GET /api/overview`, `POST /api/items`, and `POST /api/pickups`.
- `public/` contains the responsive, dependency-free browser interface and infographic.
- `data.json` is created on first launch and stores the prototype's local data. This single-file store is intended for a local demo, not concurrent or production deployment.

Impact estimates use simple per-material factors for demonstration; they are not certified measurements or a substitute for local recycling guidance.
