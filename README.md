<div align="center">

```
███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝
```

**The nexus between your Superset automation data and your weekly stability report.**

![Version](https://img.shields.io/badge/version-1.0.0-blue?style=flat-square)
![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-yellow?style=flat-square&logo=googlechrome)
![Manifest](https://img.shields.io/badge/Manifest-V3-green?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-orange?style=flat-square)

</div>

---

## What is NEXUS?

**NEXUS** is a Chrome extension built for the **Capillary Technologies CRM Automation team**. It connects directly to your internal Superset instance — using your existing Google SSO session — pulls module-wise automation test results, and generates ready-to-present PowerPoint slides in seconds.

No manual copy-pasting. No screenshots. No spreadsheets. Just click, fetch, download.

---

## Features

| Tab | What it does |
|-----|-------------|
| **⭐ OKR** | Tracks weekly pass rates vs OKR targets per module for the full quarter. Generates a PPTX with colour-coded pass/fail/amber status per cluster per week. |
| **📅 Weekly** | Pulls daily PassCount / FailCount trends per module for any date range. Shows failure dates, failed run IDs with result page links, and exports a PPTX with one slide per module. |
| **📆 Monthly** | Monthly stability overview across all modules with aggregated pass rates and trend summary. |

### Weekly PPTX Slide — what's on each slide

- **Module name** label box
- **Daily trend chart** — PassCount (green) + FailCount (red), k-formatted, Superset style
- **Pass Rate** — colour-coded vs your module's OKR target
- **Runs** — daily min–max range (e.g. `~0.8–1.0k`)
- **Callouts** — "No callouts" or "⚠ X failures"
- **Failed Runs Table** — Date | Total | Pass | Fail | Run ID | Result Link | RCA / Comment
  - Result links go directly to `apitester.capillary.in`
  - RCA column is editable directly in PowerPoint
  - Auto-paginates to next slide if failures overflow

---

## Prerequisites

Before you begin, make sure you have:

- **Google Chrome** browser (v88+)
- **Git** installed on your machine
- Access to Capillary's internal Superset: `superset.cc-tooling.cctools.capillarytech.com`
- You must be **logged into Superset via Google SSO** in Chrome before using the extension

---

## Installation

### Step 1 — Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/nexus.git
cd nexus
```

> No build step required. This is a pure HTML + JavaScript extension — what you clone is what runs.

### Step 2 — Load into Chrome

1. Open Chrome and go to:
   ```
   chrome://extensions/
   ```

2. Turn on **Developer mode** using the toggle in the top-right corner

   ![Developer Mode toggle in top right](https://i.imgur.com/placeholder.png)

3. Click **Load unpacked**

4. Select the cloned `nexus` folder (the one containing `manifest.json`)

5. NEXUS will appear in your extensions list with version `11.1.0`

### Step 3 — Pin the extension

1. Click the **puzzle piece icon** 🧩 in the Chrome toolbar
2. Find **Superset Weekly Stability v11**
3. Click the **pin icon** 📌 to keep it visible in your toolbar

### Step 4 — Open Superset first

> ⚠️ **Important:** NEXUS piggybacks on your existing Superset SSO session. Before using the extension, open Superset in a Chrome tab and make sure you are logged in.

```
https://superset.cc-tooling.cctools.capillarytech.com
```

---

## How to Use

### OKR Tab

1. Click the NEXUS icon in your toolbar
2. Go to the **⭐ OKR** tab
3. Set the **Week Start** date (Wednesday of your OKR week)
4. Click **Fetch OKR Data**
5. Review the module-wise pass rate table
6. Click **📥 Download PPTX** to export the OKR deck

> The OKR week runs **Wednesday → Tuesday**. Quarter dates: Q1 = Apr–Jun, Q2 = Jul–Sep, Q3 = Oct–Dec, Q4 = Jan–Mar.

---

### Weekly Tab

1. Go to the **📅 Weekly** tab
2. Select your **environment** — Production / Staging / Nightly
3. Set your **date range**
   - Use quick buttons: `This Week` / `Last Week` / `Last 7 Days`
   - Or pick dates manually (both start and end are **inclusive**)
4. Select the **modules** you want to report on (toggle the chips)
5. Click **Fetch Data**
6. NEXUS will load:
   - A summary card per module showing Pass Rate, Runs range, and failure dates
   - For modules with failures: a list of failed run IDs with clickable result links
7. Click **📥 Download PPTX** to generate the weekly stability deck

> 💡 The PPTX includes a **RCA / Comment** column in the failure table. You can double-click any cell in that column inside PowerPoint and type your root cause directly.

---

### Monthly Tab

1. Go to the **📆 Monthly** tab
2. Set the month range
3. Click **Fetch Data**
4. Download the monthly summary PPTX

---

## Modules Tracked

| Module | Type | OKR Target |
|--------|------|------------|
| Loyalty UI | UI | 99% |
| Loyalty Node | Node | 99% |
| Coupons UI | UI | 99% |
| Coupon Node | Node | 99% |
| Badges UI | UI | 99% |
| Tesseract UI | UI | 99% |
| Garuda UI | UI | 99% |
| Incentives Node | Node | 99% |

---

## Environments

| Environment | Clusters |
|------------|---------|
| **Production** | seacrm, Eucrm, incrm, Seacrm, sgcrm, Tatacrm, Uscrm, Ushc_Crm |
| **Staging** | Crm_Staging_New |
| **Nightly** | Nightly_Cc |

> Regression runs and Lighthouse runs are **always excluded** from all queries.

---

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│                     NEXUS Flow                          │
│                                                         │
│  Chrome Tab          Extension Popup        Output      │
│  ──────────          ────────────────       ──────      │
│                                                         │
│  Superset ──SSO──▶  CSRF Token Fetch                    │
│  (logged in)         │                                  │
│                      ▼                                  │
│                  POST /api/v1/chart/data  ──▶  JSON     │
│                      │                                  │
│                      ▼                                  │
│                  Parse Results                          │
│                      │                                  │
│                      ├──▶ UI Summary Cards              │
│                      │                                  │
│                      └──▶ PptxGenJS ──▶  .pptx file    │
│                           + Chart.js                    │
│                           (offscreen canvas)            │
└─────────────────────────────────────────────────────────┘
```

- **No credentials stored** — NEXUS uses your active Google SSO session in Chrome
- **No external servers** — all processing happens locally in your browser
- **CSRF token** is fetched automatically before every API call
- **chrome.scripting.executeScript** runs fetch calls inside your existing Superset tab to bypass CORS
- **Chart.js v4** renders high-res (1600×800) offscreen canvases for slide charts
- **PptxGenJS v3.12** builds the `.pptx` file entirely in-browser and triggers a download

---

## Tech Stack

| Library | Version | Purpose |
|---------|---------|---------|
| Chrome Extension | Manifest V3 | Extension platform |
| Vanilla JS | ES2022 | No framework, no bundler |
| [Chart.js](https://www.chartjs.org/) | 4.4.1 | Trend chart rendering (bundled, no CDN) |
| [PptxGenJS](https://gitbrent.github.io/PptxGenJS/) | 3.12.0 | PPTX generation (bundled, no CDN) |

> Both libraries are bundled locally inside `lib/` — the extension works fully offline and does not make any requests to CDNs.

---

## Project Structure

```
nexus/
├── manifest.json          # Chrome extension config (MV3)
├── popup.html             # Main UI — all 3 tabs
├── popup.js               # All logic — fetch, render, export
├── background.js          # Service worker — tab reuse
├── lib/
│   ├── chart.umd.js       # Chart.js v4.4.1 (local)
│   └── pptxgen.bundle.js  # PptxGenJS v3.12.0 (local)
└── icons/
    ├── icon48.png
    └── icon128.png
```

---

## Updating the Extension

When a new version is pushed to the repo:

```bash
git pull origin main
```

Then in Chrome:

1. Go to `chrome://extensions/`
2. Find NEXUS
3. Click the **refresh icon** 🔄

No reinstall needed.

---

## Known Limitations

- Requires an active Superset session — if you're logged out, fetch will fail with an auth error. Just log back in to Superset and try again.
- The `id` column (for result page links) must be configured as a dimension in the Superset dataset. If it's not available, run IDs will appear without clickable links.
- Monthly tab aggregates data server-side — very large date ranges may be slow.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes
4. Test by loading unpacked in Chrome
5. Submit a Pull Request

---

## Built by

**Aakash** — CRM Automation Team, Capillary Technologies

> *NEXUS — the connection point between your automation data and the people who need to see it.*

---

<div align="center">

Made with ☕ and a lot of Superset API calls.

</div>
