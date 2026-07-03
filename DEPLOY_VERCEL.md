# Deploy QA Platform to Vercel (Step-by-Step)

---

## 1. Prerequisites

- GitHub account
- Vercel account (free tier works)
- Neon PostgreSQL account (free tier works)

---

## 2. Push Code to GitHub

```bash
cd qa-platform
git init
git add .
git commit -m "Initial commit: QA Platform"
gh repo create qa-platform --public --source=. --push
# Or create repo on github.com first, then:
# git remote add origin https://github.com/<your-username>/qa-platform.git
# git push -u origin main
```

---

## 3. Create Neon PostgreSQL Database

1. Go to [https://neon.tech](https://neon.tech) → Sign up / Log in
2. Click **Create Project**
3. Fill in:
   - Project name: `qa-platform`
   - Postgres version: `16` (or latest)
   - Region: closest to you
4. Click **Create Project**
5. On the dashboard, copy the **Connection String** (looks like):
   ```
   postgresql://user:password@ep-xyz-123456.region.aws.neon.tech/neondb?sslmode=require
   ```
   Save this — you'll need it in Vercel.

---

## 4. Deploy to Vercel

1. Go to [https://vercel.com](https://vercel.com) → Sign up / Log in (use GitHub)
2. Click **Add New...** → **Project**
3. Import your GitHub repo (`qa-platform`)
4. Vercel auto-detects **Next.js** — keep defaults
5. **Environment Variables** — click **Add** for each:

   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | Paste your Neon connection string from Step 3 |
   | `NEXTAUTH_SECRET` | Generate: `openssl rand -base64 32` (run in terminal) |
   | `NEXTAUTH_URL` | `https://<your-project-name>.vercel.app` (after deploy, update if needed) |

6. Click **Deploy**
7. Wait for build to complete (~2-3 minutes)

---

## 5. Initialize Database Schema (One-Time)

After first successful deploy:

**Option A: Via Vercel CLI (recommended)**
```bash
npm i -g vercel
vercel login
vercel link  # select your project
vercel env pull .env.production  # pulls env vars locally
npx prisma db push
```

**Option B: Add to Build Command in Vercel**
1. Vercel Dashboard → Your Project → **Settings** → **General**
2. **Build Command**: Change to:
   ```
   npx prisma db push && next build
   ```
3. Redeploy (Settings → Deployments → **Redeploy**)

---

## 6. Access from Any Device

- Your live URL: `https://<project-name>.vercel.app`
- Share this URL with team members — works on any browser, any network
- No VPN, no ngrok, no local server needed

---

## 7. (Optional) Custom Domain

1. Vercel Dashboard → Project → **Settings** → **Domains**
2. Click **Add** → enter your domain (e.g., `qa.yourcompany.com`)
3. Follow Vercel's DNS instructions (add CNAME/A records at your DNS provider)
4. SSL auto-provisioned by Vercel

---

## 8. Useful Vercel Commands

```bash
# View logs
vercel logs <deployment-url>

# List deployments
vercel ls

# Promote preview to production
vercel promote <preview-url>

# Rollback
vercel rollback <deployment-url>
```

---

## 9. Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Yes | Random 32+ char string for JWT/sessions |
| `NEXTAUTH_URL` | Yes | Your production URL (e.g., `https://qa-platform.vercel.app`) |
| `GEMINI_API_KEY` | No | For AI test case generation |
| `OPENROUTER_API_KEY` | No | Alternative AI provider |

---

## 10. Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails on `prisma db push` | Ensure `DATABASE_URL` is set in Vercel Environment Variables |
| `PrismaClientKnownRequestError` | Run `npx prisma db push` locally with `.env` pointing to Neon |
| 500 on API routes | Check Vercel Function logs → usually missing env var or DB connection |
| `NEXTAUTH_URL` mismatch | Update in Vercel env vars to match your actual deployment URL |

---

## 11. Project Structure Notes

- `prisma/schema.prisma` — Database schema (PostgreSQL)
- `app/lib/prisma.ts` — Prisma client singleton with `@prisma/adapter-pg`
- `app/api/*` — Next.js 16 API routes (serverless functions on Vercel)
- `next.config.js` — Configured for `output: 'standalone'`

---

**Done.** Your team can now access the QA Platform at your Vercel URL from anywhere.