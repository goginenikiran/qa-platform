# QA Platform - End-to-End Deployment Guide

## Prerequisites
- Node.js 20+
- Git
- GitHub account
- Vercel account (free)
- Neon account (free PostgreSQL)

---

## Step 1: Set Up Cloud PostgreSQL (Neon)

1. Go to **https://neon.tech** → Sign up with GitHub/Google
2. Click **"Create Project"**
3. Project name: `qa-platform` → **Create Project**
4. Wait for provisioning (~30 seconds)
5. Copy **Connection String** from dashboard:
   ```
   postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```

---

## Step 2: Configure Local Environment

```bash
cd qa-platform

# Update .env with your Neon connection string
# Edit .env file and replace DATABASE_URL:
DATABASE_URL="postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
```

---

## Step 3: Push Schema to Cloud Database

```bash
# Push Prisma schema to Neon
npx prisma db push

# Verify tables created (optional)
npx prisma studio
```

---

## Step 4: Test Locally with Cloud Database

```bash
# Install dependencies (if not done)
npm install

# Start dev server
npm run dev

# Open http://localhost:3000
# Verify: Requirements, Test Cases, Execution modules work
# Verify: Delete buttons only show for Admin/Lead roles
```

---

## Step 5: Deploy to Vercel

### Option A: Vercel CLI (Recommended)
```bash
# Install Vercel CLI globally
npm i -g vercel

# Login to Vercel
vercel login

# Deploy from project root
cd qa-platform
vercel

# Follow prompts:
# ? Set up and deploy? [Y/n] Y
# ? Which scope? → Select your account
# ? Link to existing project? [y/N] N
# ? Project name: qa-platform
# ? Directory: ./
# ? Override settings? [y/N] N
```

### Option B: GitHub Integration (Auto-deploy on push)
1. Push code to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/qa-platform.git
   git push -u origin main
   ```
2. Go to **https://vercel.com/dashboard** → **Add New Project**
3. Import your GitHub repo → **Deploy**

---

## Step 6: Add Environment Variables in Vercel

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Click **Add New** → Add:
   - **Name**: `DATABASE_URL`
   - **Value**: (paste your Neon connection string)
   - **Environment**: ✅ Production, ✅ Preview, ✅ Development
3. Click **Save**

---

## Step 7: Redeploy with Environment Variables

```bash
# If using CLI:
vercel --prod

# If using GitHub integration:
# Push any commit to trigger auto-deploy
git commit --allow-empty -m "Trigger deploy" && git push
```

---

## Step 8: Verify Production Deployment

1. Visit your Vercel URL: `https://qa-platform-xxx.vercel.app`
2. Test all modules:
   - ✅ Dashboard
   - ✅ Requirements (CRUD + delete for Admin/Lead)
   - ✅ Test Cases (CRUD + delete for Admin/Lead)
   - ✅ Execution
   - ✅ Integrations
   - ✅ Teams/Folders
3. Test role-based permissions:
   - Login as Admin → Delete visible
   - Login as Lead → Delete visible
   - Login as Tester → Delete hidden

---

## Step 9: Multi-System Testing

Share the **Vercel URL** with team members:
- Access from any machine/browser/phone
- No local setup required
- Data persists in Neon PostgreSQL
- Real-time collaboration works

---

## Step 10: Future Updates Workflow

### For Code Changes:
```bash
# 1. Make changes locally
# 2. Test locally
npm run dev

# 3. Verify build passes
npm run build

# 4. Deploy
# Option A: Git push (auto-deploy if GitHub connected)
git add . && git commit -m "feat: your changes" && git push

# Option B: Manual deploy
vercel --prod
```

### For Schema Changes:
```bash
# 1. Edit prisma/schema.prisma
# 2. Generate client & push to DB
npx prisma generate
npx prisma db push

# 3. Test locally
npm run dev

# 4. Deploy
vercel --prod
```

---

## Quick Reference Commands

| Task | Command |
|------|---------|
| Local dev | `npm run dev` |
| Build check | `npm run build` |
| Lint check | `npm run lint` |
| Push DB schema | `npx prisma db push` |
| Open DB UI | `npx prisma studio` |
| Deploy (CLI) | `vercel --prod` |
| View logs | `vercel logs <deployment-url>` |

---

## Important URLs

- **Vercel Dashboard**: https://vercel.com/dashboard
- **Neon Dashboard**: https://console.neon.tech
- **Prisma Docs**: https://www.prisma.io/docs
- **Next.js Docs**: https://nextjs.org/docs

---

## Troubleshooting

### Build fails on Vercel
- Check `vercel logs <url>` for errors
- Ensure `DATABASE_URL` is set in Vercel Environment Variables
- Run `npm run build` locally first

### Database connection errors
- Verify Neon connection string is correct
- Check Neon project is not paused (free tier pauses after 5 min inactivity)
- Ensure `sslmode=require` in connection string

### Permission errors
- Verify `ROLE_PERMISSIONS` in `app/store/AppContext.tsx`
- Check `hasPermission()` function usage in views

---

## Support

For issues:
1. Check Vercel deployment logs
2. Check Neon query logs
3. Run `npm run build` locally to catch TypeScript errors
4. Verify all environment variables are set