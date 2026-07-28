# Learn and Sell

Learn and Sell is a craft-skills learning and marketplace platform for young women in Rwanda
who dropped out of school. Learners take short craft courses (tailoring, beading,
basket weaving) in Kinyarwanda or English; finishing a course automatically unlocks
a digital shop where they can list products and get paid via MTN MoMo or Airtel Money.

This repository contains a **front-end prototype** built to demonstrate the actors,
flows and functional requirements described in the project's SRS document
(linked in the submission doc). It runs entirely in the browser — there is no
backend or database yet, so data resets on refresh. This matches the current
stage of the project (front end built; backend/database is in progress).

## Actors covered in this prototype
- **Learner / Seller** — registers, browses courses, completes lessons and a quiz,
  earns a certificate, creates a shop, lists products, views orders and requests a payout.
- **Buyer** — registers, searches/filters the marketplace, adds items to a cart,
  pays (mock MTN MoMo / Airtel Money), tracks order status, and adds product ratings/reviews.
- **Admin** — manages courses (add/remove), manages users (suspend/reactivate),
  manages marketplace products, and views basic reports.
- **Notifications (all logged-in users)** — receives in-app updates for enrollments,
  completions, payments, shop updates, and admin actions.

## Tech stack
Plain HTML, CSS and JavaScript — no build step, no dependencies, no installation required.

## How to run it locally
You do not need to install anything. Pick one of these two options:

**Option A — just open the file**
1. Download or clone this repository.
2. Double-click `index.html` (or right-click → Open with → your browser).

**Option B — run a local server (recommended, avoids browser file-access warnings)**
1. Make sure you have Python installed (comes pre-installed on most systems).
2. Open a terminal in the project folder.
3. Run:
   ```
   python3 -m http.server 8000
   ```
4. Open `http://localhost:8000` in your browser.

## How to deploy it (to get a public URL)
The easiest option is **GitHub Pages**, since this is a static site:
1. Push this repo to GitHub (make sure it's Public).
2. Go to the repo's **Settings → Pages**.
3. Under "Build and deployment", set **Source: Deploy from a branch**,
   Branch: `main`, folder: `/ (root)`. Click Save.
4. Wait 1–2 minutes, then GitHub will show your live URL
   (usually `https://<your-username>.github.io/<repo-name>/`).

## Project structure
```
├── index.html      # all page markup/views
├── styles.css      # design system + component styles
├── script.js       # all app logic and state
└── README.md
```

## What's mocked vs. real in this version
- ✅ Real: form validation, client-side navigation, course/lesson/quiz progress logic,
  shop-unlock-on-graduation logic, product CRUD, marketplace search/filter, cart math,
  order status progression, admin CRUD on courses/users/products.
- 🚧 Not yet built: persistent database, real authentication, real MTN MoMo/Airtel Money
  payment processing, offline mode/service worker caching.

## Related links
- SRS document: _add your Google Doc / PDF link here_
- Demo video: _add your video link here_
