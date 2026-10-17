# Deployment Documentation: Hiraya Enrollment System (HES)
**Project:** Placido L. Señor National High School - Hiraya Enrollment System  
**Platform:** Vercel (Edge Network / Static Web Hosting)  
**Repository:** `https://github.com/Mangila4k/CAPSTONEWEB.git` (Branch: `main`)  
**Target Environment:** Production  

---

## 1. Executive Summary & Architecture

The **Hiraya Enrollment System (CAPSTONEWEB)** is engineered as a multi-page static web application (MPA). It interacts directly with Supabase from client-side JavaScript via CDN modules (`@supabase/supabase-js`).

### Technical Characteristics
* **Runtime:** Pure client-side HTML5, CSS3, and modern ES6+ JavaScript modules.
* **No Server-Side Node.js Bundling Required:** Assets are served directly without compilation steps (e.g., Babel, Webpack, or Rollup).
* **Primary Entry Point:** `auth/homepage.html` (rather than a conventional root `index.html`).
* **CI/CD Pipeline:** Git-driven automated deployment using Vercel GitHub integration.

### Directory Mapping
```text
CAPSTONEWEB/
├── admin/               # Administrative portal pages & logic
├── auth/                # Authentication & entry (homepage.html, login.html)
│   ├── css/
│   ├── js/
│   └── homepage.html    # <-- Primary landing page
├── css/                 # Global styling & layout stylesheets
├── guidance/            # Guidance office modules
├── js/                  # Shared utilities (chatbot.js, email_service.js)
├── parents/             # Parents portal
├── pictures/            # Static image assets & branding logos
├── registrar/           # Registrar enrollment management modules
├── student/             # Student portal & online enrollment
├── supabase/            # Supabase client initialization & configuration
├── teacher/             # Teacher portal
├── index.html           # Root fallback redirect
├── package.json         # Dependency manifest
└── vercel.json          # Vercel deployment routing configuration
```

---

## 2. Prerequisites

Before deploying, ensure you have:
1. **GitHub Account:** Access to the [`Mangila4k/CAPSTONEWEB`](https://github.com/Mangila4k/CAPSTONEWEB.git) repository.
2. **Vercel Account:** Registered at [vercel.com](https://vercel.com) and connected with your GitHub account.
3. **Local Tools:** Git and modern web browser installed on your workstation.

---

## 3. Critical Configuration Files Explained

Because this application organizes its pages into subdirectories and does not use an automated bundler, two configuration files in the root folder are required for Vercel:

### 3.1 `vercel.json` (Vercel Routing Rule)
Located at: `CAPSTONEWEB/vercel.json`

```json
{
  "rewrites": [
    {
      "source": "/",
      "destination": "/auth/homepage.html"
    }
  ]
}
```
* **Purpose:** Instructs Vercel's Edge routing engine that when a visitor requests the root domain (`https://your-domain.vercel.app/`), it should serve `auth/homepage.html` seamlessly without triggering a `404 NOT_FOUND` error or changing the URL.

### 3.2 `index.html` (Fallback Redirect)
Located at: `CAPSTONEWEB/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="refresh" content="0; url=auth/homepage.html">
    <title>Hiraya Enrollment System</title>
    <script>
        window.location.replace("auth/homepage.html");
    </script>
</head>
<body>
    <p>Redirecting to <a href="auth/homepage.html">Homepage</a>...</p>
</body>
</html>
```
* **Purpose:** Provides a client-side meta-refresh fallback for any web server environment that looks specifically for an `index.html` file in the root directory.

---

## 4. Initial Vercel Dashboard Configuration

Follow these steps when creating the project on Vercel or updating project settings:

### Step 1: Import the Repository
1. Log in to [vercel.com](https://vercel.com).
2. Click **"Add New..."** in the top-right corner and select **"Project"**.
3. Under **"Import Git Repository"**, locate **`CAPSTONEWEB`** (or `Mangila4k/CAPSTONEWEB`) and click **"Import"**.

### Step 2: Configure Project & Build Settings
On the project configuration page, set the options exactly as specified:

| Setting | Value | Rationale |
| :--- | :--- | :--- |
| **Project Name** | `capstoneweb` *(or your choice)* | Identifier for the production URL. |
| **Framework Preset** | **`Other`** | Disables automatic framework detection (e.g. Vite, Next.js). |
| **Root Directory** | **`./`** *(default)* | The application files live in the repository root. |

### Step 3: Configure Build and Output Settings Overrides
Click to expand **Build and Output Settings**, then toggle **Override** to **ON** for all three fields:

```text
┌─────────────────────────────────────────────────────────────┐
│ Build and Output Settings                                   │
├─────────────────────────────────────────────────────────────┤
│ Build Command        [OVERRIDE: ON]  echo "build skipped"   │
│ Output Directory     [OVERRIDE: ON]  .                      │
│ Install Command      [OVERRIDE: ON]  echo "install skipped" │
└─────────────────────────────────────────────────────────────┘
```

* **Build Command (`echo "build skipped"`):**  
  *Prevents Vercel from executing `pnpm run build` or `vite build`. Vite requires a root `index.html` for single-page compilation; running it on this multi-page structure causes a fatal `Could not resolve entry module "index.html"` build error.*
* **Output Directory (`.`):**  
  *Instructs Vercel to serve the entire root folder contents (`admin/`, `auth/`, `css/`, `js/`, etc.) directly.*
* **Install Command (`echo "install skipped"`):**  
  *Prevents unnecessary dependency installation cycles, speeding up deployment time to under 15 seconds.*

### Step 4: Deploy
Click **"Deploy"**. Vercel will complete the deployment and provide a live production URL (e.g., `https://capstoneweb.vercel.app`).

---

## 5. Daily Continuous Deployment (CI/CD) Workflow

Once Vercel is connected to GitHub, **you never need to manually redeploy via the Vercel dashboard**. Every `git push` to `main` automatically triggers an instant production build.

### Terminal Commands to Deploy Code Changes:

Open PowerShell or terminal in `CAPSTONEWEB`:

```powershell
# 1. Stage all edited files
git add .

# 2. Create commit with a clear description
git commit -m "Update enrollment verification workflow"

# 3. Pull any remote updates and apply local changes on top
git pull --rebase origin main

# 4. Push to production
git push origin main
```

---

## 6. Post-Deployment Verification Checklist

Verify key application pathways after deployment:

- [ ] **Root URL Routing:** Visiting `https://<your-project>.vercel.app/` immediately displays the school landing page.
- [ ] **Login Flow:** Navigate to `https://<your-project>.vercel.app/auth/login.html` and verify input responsiveness.
- [ ] **Supabase Connectivity:** Open browser Developer Tools (`F12` ➔ Console) and ensure no CORS or network connection errors appear from Supabase.
- [ ] **Asset Loading:** Verify school logos (`pictures/`) and FontAwesome icon fonts render crisply without 404 broken image icons.
- [ ] **Sub-Portal Navigation:** Test direct navigation to `/admin/`, `/registrar/`, and `/student/` pages.

---

## 7. Troubleshooting Playbook

### Issue A: "404 NOT_FOUND: This page doesn't exist"
* **Symptom:** Accessing the root URL displays Vercel's standard 404 page.
* **Root Cause:** The `vercel.json` rewrite file is either missing from the repository root or has not been pushed to GitHub.
* **Resolution:**
  1. Confirm `vercel.json` exists in `CAPSTONEWEB/vercel.json`.
  2. Run `git status` to ensure it is tracked.
  3. Run `git add vercel.json && git commit -m "Add vercel rewrite" && git push origin main`.

---

### Issue B: "Could not resolve entry module 'index.html' / Command failed with exit code 1"
* **Symptom:** Deployment log fails during the build phase with Rollup/Vite errors.
* **Root Cause:** Vercel is still trying to run `pnpm run build` or `vite build`.
* **Resolution:**
  1. Open Vercel Dashboard ➔ **Project Settings** ➔ **General**.
  2. Under **Build & Development Settings**, toggle **Build Command** to **OVERRIDE**.
  3. Enter: `echo "build skipped"`.
  4. Save and click **Redeploy**.

---

### Issue C: Git Push Rejected ("Updates were rejected because the remote contains work...")
* **Symptom:** Terminal outputs `! [rejected] main -> main (fetch first)`.
* **Root Cause:** Commits exist on GitHub that do not exist in your local working branch.
* **Resolution:**
  ```powershell
  git pull --rebase origin main
  git push origin main
  ```
  *Never use `git push --force` as it can erase history committed by teammates.*

---

## 8. Summary of Key URLs & Resources

* **GitHub Repository:** [Mangila4k/CAPSTONEWEB](https://github.com/Mangila4k/CAPSTONEWEB)
* **Vercel Dashboard:** [vercel.com/dashboard](https://vercel.com/dashboard)
* **Live Homepage Route:** `https://<project-name>.vercel.app/auth/homepage.html`
* **Direct Root Route:** `https://<project-name>.vercel.app/`
