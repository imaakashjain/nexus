# Superset Weekly Stability Extension

Chrome extension to extract weekly automation stability data from the CRM Automation Results Superset dashboard.

## What it does
- Pulls module-wise Pass%/Fail% from Superset API (chart 392)
- Pulls daily PassCount/FailCount trends from Superset API (chart 149)
- Filters by your 8 prod clusters only (excludes Nightly_Cc etc.)
- Excludes Regression/Lighthouse runs
- Generates charts matching the Superset style
- Downloads PNGs for your weekly cadence slides

## Installation

1. Unzip `superset-weekly-stability-extension.zip` to a folder
2. Open Chrome → go to `chrome://extensions/`
3. Turn ON **Developer mode** (top-right toggle)
4. Click **Load unpacked**
5. Select the unzipped folder
6. Pin the extension from the puzzle icon in toolbar

## Usage

1. Open Superset in Chrome and make sure you're **logged in** (Google SSO)
   - URL: https://superset.cc-tooling.cctools.capillarytech.com
2. Click the extension icon in the toolbar
3. Select date range (quick buttons or manual)
4. Select modules you want
5. Click **Fetch Data**
6. View results:
   - Weekly cadence slide format (copy-paste ready)
   - Detail table with Pass%/Fail%
   - Daily trend charts per module (Superset-style: PassCount green, FailCount red, k-formatted labels)
7. Click **Download PPTX** to generate a deck — one slide per module, each with the
   module name, the weekly trend chart, daily Runs (min–max), pass rate, and callouts.
   (Per-chart **📥 PNG** buttons are still available under each chart.)

## Modules available
- Loyalty UI / Loyalty Node
- Coupons UI / Coupon Node
- Badges UI
- Tesseract UI
- Garuda UI
- Incentives Node

## Prod clusters (hardcoded)
seacrm, Eucrm, incrm, Seacrm, sgcrm, Tatacrm, Uscrm, Ushc_Crm

## How it works
- Uses `chrome.scripting.executeScript` to run fetch calls inside your Superset tab
- Piggybacks on your Google SSO session (no credentials stored)
- Gets CSRF token automatically before each POST
- Uses Chart.js for rendering charts in the popup
