# Local Dev Runbook

## Quick start

```bash
npm run dev
```

This starts the Next.js dev server on **http://localhost:3000**.

## If you see 404 or wrong page

1. **Clear build cache and restart**
   ```bash
   npm run dev:clean
   ```
   This removes the `.next` folder and starts the dev server. Use when the app shows incorrect or cached content.

2. **Check port conflicts (common cause of "wrong page")**
   - If another process is using port 3000, visiting localhost:3000 will show that app, not Archive Intel.
   - On Windows, find and kill the process:
     ```powershell
     netstat -ano | findstr :3000
     taskkill /PID <PID> /F
     ```
   - Then run `npm run dev` again.
   - Or use another port:
     ```bash
     npx next dev -p 3001
     ```
   - If you use 3001, set `NEXT_PUBLIC_APP_URL=http://localhost:3001` in `.env.local`.

3. **Verify environment**
   - Ensure `.env.local` exists and includes `NEXT_PUBLIC_APP_URL=http://localhost:3000` (or your chosen port).
   - Do not rely only on `.env` for local dev; `.env.local` overrides it.

## Expected behavior

- Home: http://localhost:3000/ — landing page with "ARCHIVE.INTEL" branding
- App: http://localhost:3000/app — main app (requires sign-in)
- Login: http://localhost:3000/login — Clerk sign-in

## OneDrive / sync folders

This project is in OneDrive. If you see strange errors (e.g. `EINVAL readlink`), the `.next` folder may be corrupted. Run `npm run dev:clean` and restart. Consider excluding `.next` from sync if problems persist.
