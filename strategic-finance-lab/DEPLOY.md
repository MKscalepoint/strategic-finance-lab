# Strategic Finance Lab — Deployment Guide

Follow these steps exactly. Each one takes a few minutes. No coding required.

---

## Before you start

You will need:
- A GitHub account (free) — github.com
- A Vercel account (free) — vercel.com
- Your Anthropic API key — console.anthropic.com

---

## Step 1 — Put the code on GitHub

1. Go to github.com and sign in
2. Click the **+** button in the top right → **New repository**
3. Name it `strategic-finance-lab`
4. Leave all other settings as default
5. Click **Create repository**
6. On the next screen, click **uploading an existing file**
7. Drag the entire `strategic-finance-lab` folder contents into the upload area
   - Upload ALL files including the hidden ones (.env.example, next.config.mjs etc.)
   - Do NOT upload the `node_modules` folder if it exists
8. Click **Commit changes**

---

## Step 2 — Deploy to Vercel

1. Go to vercel.com and sign in (you can sign in with your GitHub account)
2. Click **Add New** → **Project**
3. Find your `strategic-finance-lab` repository and click **Import**
4. Vercel will detect it is a Next.js project automatically
5. **Before clicking Deploy**, click **Environment Variables** and add:
   - Name: `ANTHROPIC_API_KEY`
   - Value: your Anthropic API key (starts with `sk-ant-...`)
   - Click **Add**
6. Click **Deploy**
7. Wait 2-3 minutes for the build to complete
8. Vercel will give you a URL like `strategic-finance-lab.vercel.app`

---

## Step 3 — Test it

1. Open your Vercel URL
2. Click **Begin analysis**
3. Select a question
4. Describe a business and click **Begin analysis**
5. The advisor should respond with streaming text

If it works — you are live.

---

## Step 4 — Share with pilot clients

Share your Vercel URL directly. You control who has the link.

If you want to add password protection later, add this to your environment variables in Vercel:
- Name: `PILOT_PASSWORD`
- Value: a password of your choice

Then redeploy. (Password protection requires a small code addition — ask for help when ready.)

---

## Troubleshooting

**The page loads but analysis does not start**
- Check that your ANTHROPIC_API_KEY is correctly set in Vercel environment variables
- Make sure there are no extra spaces in the API key value
- In Vercel dashboard, go to Settings → Environment Variables to check

**Build fails on Vercel**
- Make sure you uploaded all files including package.json and next.config.mjs
- Check that node_modules was NOT uploaded

**The response cuts off**
- This is normal for very long analyses — the user can ask the advisor to continue

---

## Updating the system prompt

The analytical framework lives in one file: `src/lib/prompt.ts`

To update it:
1. Edit the file locally
2. Go to your GitHub repository
3. Navigate to the file and click the pencil icon to edit
4. Paste your updated content
5. Click **Commit changes**
6. Vercel will automatically redeploy within 2 minutes

---

## Getting your Anthropic API key

1. Go to console.anthropic.com
2. Sign in or create an account
3. Click **API Keys** in the left menu
4. Click **Create Key**
5. Copy the key immediately — you cannot see it again
6. Paste it into Vercel as described in Step 2
