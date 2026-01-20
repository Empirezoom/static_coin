# ORYX Frontend Template (Tailwind CDN)

This is a small multi-page frontend scaffold for a crypto-style webapp (demo). It uses plain HTML, Tailwind via CDN and a tiny client-side mock (`localStorage`) to simulate flows for later backend integration (e.g. Django).

Pages included:

- `index.html` — homepage / dashboard
- `login.html` — sign in
- `register.html` — create account (simulates sending confirmation)
- `wallet.html` — displays BTC address + QR, deposit request form
- `profile.html` — edit profile, see verification status
- `verify.html` — upload ID + SSN (simulated)
- `reset.html` — reset password (simulated)

- `eth.html` — Ethereum wallet demo (address + QR)
- `usdt.html` — USDT (ERC-20) wallet demo (address + QR)
- `livechat.html` — user live chat (send messages + attachments)
- `admin_livechat.html` — admin chat console (reply, view attachments, manage deposits)
- `admin_assets.html` — admin UI to upload custom logo and favicon (stored in browser localStorage)

How it works:

- Client-only demo. User accounts are stored in `localStorage` under key `oryx_users_v1`.
- The script `js/app.js` exposes `window.ORYXAuth` helper for quick integration.

Replace `image/logo.png` and `image/favicon.png` with your supplied assets.
New placeholder SVGs are included at `image/logo.svg` and `image/favicon.svg`.
You can also upload custom images using `admin_assets.html` — they will be stored in your browser's `localStorage` for demo purposes.

To run: open the files in a browser directly (no build step). For cross-page navigation use a small HTTP server such as:

```powershell
# from project folder
python -m http.server 8000

# then open http://localhost:8000/index.html
```

Notes:

- This is a frontend mock only — you will connect Django later to persist users, send emails, and verify uploads.
