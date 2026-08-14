# Creditxa — Setup & Admin Guide

## 🗄️ Supabase Database Setup

Everything now lives in **one file**: `creditxa-supabase.sql`. It always starts by
dropping every Creditxa table, view, function and trigger it knows about, so you
can paste this exact file into the SQL Editor again in the future to wipe and
rebuild a perfectly clean database — no separate "update" script needed anymore.

### Step 1 — Create a Supabase project
1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Name it "creditxa", set a strong database password, choose a region near Portugal (West Europe / Frankfurt)
3. Wait ~2 minutes for provisioning

### Step 2 — Run the schema
1. Open **SQL Editor** → **New query**
2. Paste the **entire** contents of `creditxa-supabase.sql` → click **Run**

This creates all 9 tables, indexes, Row Level Security policies, helper
functions/RPCs, triggers, views, and seed data (default admin row + starting
rates/limits).

### Step 3 — Get your API keys
Go to **Project Settings → API Keys**. You need two values:
- **Project URL** — looks like `https://yourproject.supabase.co`
- **anon / public key** — long string starting with `eyJ...`

Do **not** use the `service_role` key anywhere in these HTML files — it must never be exposed in browser-side code.

### Step 4 — Point the site at your project
The Supabase URL and anon key appear in every HTML file that talks to the
database (`index.html`, `pages/admin.html`, `pages/login.html`, and the four
product pages). In each file, find:
```javascript
const _sb_url  = '...';
const _sb_key  = '...';
```
and replace both values with your own project's URL and anon key.

### Step 5 — Create your first real admin login
The SQL script seeds a row in `admin_users` for `admin@creditxa.pt`, but that's
just a database record — it is **not** a login. There is no password stored
anywhere in the code anymore. To actually be able to sign in:

1. In the Supabase dashboard, go to **Authentication → Users → Add user**
2. Use the **same email** as the seeded `admin_users` row (or update that row's
   `email` first if you want a different address), and set a strong password
3. Open `pages/admin.html` and sign in with that email/password

The first successful sign-in automatically links your new Supabase Auth account
to the `admin_users` row (via the `admin_login_check()` database function) —
you don't need to run any extra SQL. From then on the session persists across
page reloads, and every login/logout is written to `activity_log` and visible
in **Admin → Atividade**.

To add more admins later, insert another row into `admin_users` (via SQL Editor
or a future admin UI) and create a matching Supabase Auth user for them the
same way.

---

## 👤 Client Accounts (Signup / Verify / Login / Logout)

`pages/login.html` is the client-facing account page:

- **Criar Conta** — creates a real Supabase Auth account and sends a
  verification email automatically. The account creation and, once the person
  clicks the email link, the email verification are both logged to
  `activity_log` automatically by database triggers — no extra code needed.
- **Iniciar Sessão** — signs the client in and logs a `login` activity entry.
- **Sair** — logs a `logout` activity entry *before* ending the session, then
  signs out.
- **Esqueceu-se da password?** — sends a reset email; clicking it now lands
  back on `login.html` with a working "set new password" screen (previously
  this link had nowhere to go).
- Once logged in, a client sees their own applications/loans/payments only —
  Row Level Security restricts every table so one client can never see another
  client's data, even through the browser's network tab.

All of this activity — signups, verifications, logins, logouts, by both
clients and admins — is visible to admins in **Admin → Atividade**.

---

## 📋 Admin Panel — What You Can Do

| Section | Capabilities |
|---------|-------------|
| **Dashboard** | Live stats and a real "Atividade Recente" feed (admin + client events) |
| **Pedidos de Crédito** | View full KYC detail per application, approve/reject, filter by status/type |
| **Clientes** | Full client list, view real profile per client, block, add new clients |
| **Empréstimos Ativos** | Monitor all active contracts, view real contract detail per loan |
| **Pagamentos** | Real payment history and stats, register manual payments |
| **Mensagens** | Read contact form submissions |
| **Newsletter** | Real subscriber list and count |
| **Atividade** *(new)* | Full feed of admin actions and client account activity — signup, email verified, login, logout — filterable by type |
| **Definições** | Change interest rates and system settings |
| **Relatórios** | Export reports |

---

## 📝 How the Loan Application Form Works

Clicking **"Pedir Este Crédito"** on the homepage simulator opens a 4-step
modal collecting the identity, residence, employment and consent information
a Portuguese lender needs before underwriting.

On submission, the browser calls a single database function,
`submit_loan_application(...)`, which — running securely on the server side —
validates every field, finds-or-creates the client record, creates the
application with a database-generated reference number (e.g. `#CR-2026-00231`),
and logs the event. The public website never has direct read/write access to
the `clients` or `loan_applications` tables; everything goes through this
function, so one applicant can never read another applicant's data even by
inspecting network requests.

The application then appears immediately in **Admin → Pedidos de Crédito**,
where clicking the 👁 icon shows the full KYC profile before you approve or
reject.

---

## 📁 File Structure

```
creditxa/
├── index.html                          ← Homepage + loan simulator + application modal
├── assets/
│   ├── css/
│   │   ├── style.css
│   │   └── application-modal.css
│   ├── js/
│   │   ├── main.js
│   │   └── application-modal.js        ← Calls submit_loan_application() RPC
│   ├── application-modal.html          ← Reference copy of modal markup (not loaded directly)
│   └── images/
├── pages/
│   ├── admin.html                      ← Admin dashboard (real Supabase Auth login)
│   ├── login.html                      ← Client signup / login / logout / password reset
│   ├── emprestimo-pessoal.html
│   ├── credito-habitacao.html
│   ├── credito-automovel.html
│   ├── consolidacao.html
│   ├── guia-credito-portugal.html
│   ├── sobre-nos.html / carreiras.html / imprensa.html / responsabilidade.html / parceiros.html
│   └── privacidade.html / termos.html / cookies.html / reclamacoes.html
└── creditxa-supabase.sql               ← Complete schema — the ONLY SQL file, run once
```

---

## 🔒 Security Notes

1. **Never expose the admin page URL publicly on your marketing site** — even
   with real authentication behind it, it's good practice to keep it unlinked.
2. The Supabase `service_role` key must never appear in any of these HTML/JS files.
3. Row Level Security is enabled on every table. Public (anonymous) access is
   limited to: inserting a newsletter signup, inserting a contact message, and
   calling the `submit_loan_application()` function — nothing else. All other
   reads/writes require either being the record's owner (a signed-in client)
   or a verified admin (checked via the `is_admin()` database function).
4. There is no password anywhere in the HTML source anymore — admin
   authentication is real Supabase Auth, checked server-side.

---

## 🚀 Deploying

**Option A — Netlify (easiest, free)**
1. Go to [netlify.com](https://netlify.com)
2. Drag and drop the entire `creditxa/` folder
3. Live instantly with HTTPS

**Option B — Vercel**
Upload the folder or connect a GitHub repo; Vercel auto-detects static HTML.

**Option C — Your own hosting**
Upload all files via FTP/SFTP to your `public_html` or `www` directory, preserving the folder structure exactly.

---

## 📞 Quick Reference

| Task | Where |
|------|-------|
| Access admin | `pages/admin.html` |
| Create your first admin login | Supabase Dashboard → Authentication → Users → Add user (matching email in `admin_users`) |
| Set up database | Run `creditxa-supabase.sql` once — that's the only file |
| Review a loan application | Admin → Pedidos de Crédito → 👁 |
| View login/signup/logout activity | Admin → Atividade |
| Change interest rates | Admin → Definições |
| See contact messages | Admin → Mensagens |
