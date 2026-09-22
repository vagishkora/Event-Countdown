# Event Countdown

A server-authoritative live event countdown for hackathons, competitions and projector screens.

## Features
- Public `/` display and `/admin` control room.
- Server clock is authoritative. Clients sync every 5 seconds using a midpoint network-delay estimate and `performance.now()` for monotonic counting.
- Offline resilience: the last synchronized clock keeps counting until connectivity returns.
- There is deliberately **no pause, stop, reset or skip API or UI**. The only schedule mutation is `PUT /api/state`.
- Milestone warning windows, live 2-minute milestone celebration, schedule list, announcements.
- Time-dependent visual phases, CSS/canvas particles, video backdrop crossfades, reduced-motion fallback.
- Admin preview changes only the admin browser preview; it never writes or changes the real schedule.
- JSON persistence survives server restarts.
- Compression and lightweight 5-second polling are suitable for hundreds of read-only clients; a CDN/reverse proxy can cache static assets.

## Run locally
1. Install Node.js 20+.
2. Copy `.env.example` to `.env` and set a strong `ADMIN_PASSWORD`.
3. `npm install`
4. `npm start`
5. Open `http://localhost:3000/` and `http://localhost:3000/admin`.

## Videos
Put short, compressed MP4/WebM loops in `public/videos/`. Edit `public/videos/config.js` to point each phase at its file. Recommended target: 5–15 seconds and under 5 MB each. If a video cannot play, the gradient/canvas background remains usable. For production, self-host clips that you have permission to use (for example royalty-free clips from Pexels, Pixabay or Mixkit).

## Deployment
Render, Railway or a VPS can run `npm start`. Set `ADMIN_PASSWORD`, `PORT` if required, and optionally `DATA_FILE`. Put HTTPS in front of Express using the platform's TLS/reverse-proxy support. For a multi-instance deployment, replace the JSON store with SQLite/Postgres so all instances share one schedule.

## Security notes
- Admin writes use HTTP Basic credentials and a constant-time password comparison.
- Failed admin requests are rate-limited.
- User-controlled schedule text is rendered with `textContent`/escaped HTML; no raw HTML is accepted.
- Do not commit `.env`.
- The browser never gets the admin password.
