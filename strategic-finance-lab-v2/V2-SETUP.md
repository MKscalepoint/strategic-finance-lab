# V2 Setup Instructions

## New files to add to your repo

### 1. Replace `src/lib/prompt.ts`
Use the new `prompt.ts` file — payments/fintech focused, 4-turn demo format.

### 2. Add `src/lib/docx-generator.ts`
New Word doc generator. Copy `docx-generator.ts` into `src/lib/`.

### 3. Replace `src/lib/excel.ts`
Use the new `excel.ts` with separated Inputs sheet.

### 4. Add `src/app/api/email/route.ts`
Create folder `src/app/api/email/` and add `email-route.ts` renamed to `route.ts`.

### 5. Install new dependencies
Add these to your `package.json` dependencies:
```json
"resend": "^3.0.0",
"docx": "^9.0.0"
```

Or add to GitHub directly by editing `package.json`.

---

## Vercel Environment Variables to add

Go to Vercel → your project → Settings → Environment Variables and add:

| Name | Value |
|------|-------|
| `RESEND_API_KEY` | Your Resend API key (starts with `re_...`) |
| `FROM_EMAIL` | Your verified sender email e.g. `advisor@yourdomain.com` |

---

## DNS records for Resend (add to your domain registrar)

Resend will show you the exact records. Typically:

| Type | Host | Value |
|------|------|-------|
| TXT | @ or yourdomain.com | `resend-verification=...` |
| CNAME | `resend._domainkey` | `...._domainkey.resend.com` |

After adding, click "Verify" in Resend. Can take up to 48 hours but usually under 30 minutes.

---

## page.tsx changes needed

The `page.tsx` needs two additions:

### 1. Email gate at start (before question selection)
Add an email + business name input stage before the user selects a question.

### 2. Send by email button at end (instead of/alongside download button)
When analysis is complete, show a button that calls `/api/email` with the analysis data and the captured email address.

Ask Claude to update `page.tsx` with these two changes once the other files are in place.

---

## Testing without a verified domain

Resend allows sending to your own email address in test mode before domain verification.
Just set `FROM_EMAIL=onboarding@resend.dev` temporarily and it will work immediately.
