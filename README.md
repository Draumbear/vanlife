# Kea

An ad-free expense tracker for two people living in a van in New Zealand — named
after the parrot that raids campervans in the Southern Alps.

Everything in NZD with a live EUR conversion beside it. Works offline; syncs both
phones through your own free Supabase project.

## What's in the box

| File | What it is |
|---|---|
| `index.html` | The whole app — UI, logic, sync. No build step, no frameworks. |
| `sw.js` | Service worker so the app opens with no signal. |
| `manifest.json` | Makes it installable on the Android home screen. |
| `icon-192.png`, `icon-512.png` | App icon. |

---

## Step 1 — Put it online with GitHub Pages (free)

The app needs to be on an `https://` address for offline mode and home-screen install
to work. GitHub Pages does that for free.

This lives at **https://github.com/Draumbear/vanlife** and is already pushed.

To switch Pages on: in the repo go to **Settings → Pages**, under *Source* pick
**Deploy from a branch**, branch **main**, folder **/ (root)**, and Save.

A minute later the app is live at:

**https://draumbear.github.io/vanlife/**

That URL is what you open on both phones.

**To update the app later:**

```bash
git add -A
git commit -m "tweak"
git push
```

Pages redeploys on its own in about a minute. Bump `CACHE` in `sw.js` (e.g.
`kea-v3`) whenever you change `index.html`, otherwise the phones will keep
serving the old version out of their cache.

> Your Supabase keys are **not** in this repo — you type them into the app on each
> phone and they're stored in that phone's browser. So a public repo leaks nothing.

## Step 2 — Install on both Androids

1. Open the URL in **Chrome** on the phone.
2. Menu (⋮) → **Add to Home screen** / **Install app**.
3. It now opens fullscreen with its own icon, like a normal app, and works with no
   signal — which is most of the West Coast.

## Step 3 — Sync the two phones (optional but you want it)

**Why this needs Supabase and not just GitHub:** GitHub Pages only *serves files* —
it has nowhere to put data that arrives from a phone, so without a database each
phone keeps its own separate list. Supabase is the free bit that stores the shared
data. You could in principle make the app commit to the repo through the GitHub API,
but that means putting a token with write access to your repo inside a page anyone
can view the source of — worse in every way than the anon key below.

With sync on, you both see the same expenses within seconds.

1. Create a free project at **https://supabase.com** (free tier is plenty — this app
   will use a fraction of a percent of it).
2. In the project: **SQL Editor → New query**, paste the SQL below, press **Run**.
3. Go to **Project Settings → API** and copy:
   - the **Project URL** (`https://xxxxx.supabase.co`)
   - the **anon / publishable** key (the long `eyJ...` one — *not* the service_role key)
4. In the app: **Settings → Sync between phones**, paste both, tap
   **Save & test connection**. You should get a green ✓.
5. Do exactly the same on the second phone with the **same** URL and key.

The URL and key are kept on the phone as soon as you type them — you enter them
once, not every time you open the app. **Save & test connection** only confirms
they work. Add the app to your home screen (Step 2): an installed app keeps its
storage, while a page left in a browser tab can have it cleared after a week of
not being opened, which would mean entering them again.

```sql
create table if not exists van_expenses (
  id         text primary key,
  amount     numeric      not null,
  category   text         not null,
  spent_on   date         not null,
  payer      text         not null,
  note       text         default '',
  deleted    boolean      default false,
  updated_at timestamptz  default now()
);

create table if not exists van_settings (
  id         text primary key,
  data       jsonb        not null,
  updated_at timestamptz  default now()
);

alter table van_expenses enable row level security;
alter table van_settings enable row level security;

create policy van_expenses_all on van_expenses
  for all to anon using (true) with check (true);
create policy van_settings_all on van_settings
  for all to anon using (true) with check (true);

-- records which of you typed an expense in, as opposed to who paid for it
alter table van_expenses add column if not exists entered_by text;

-- which account the money came out of (BNZ, Revolut, cash...)
alter table van_expenses add column if not exists account text;
```

(The app no longer shows this SQL — it's only needed once, when setting up a
project from scratch. Any of the optional columns can be missing: the app
detects the rejection, drops that one field and syncs everything else. You lose
only that field across phones, not the expense.)

> **Worth knowing:** that policy lets anyone holding your project URL + anon key read
> and write these two tables. The key is embedded in the app, so treat your app URL as
> semi-private — don't post it publicly. For a shared holiday budget that's a fine
> trade; it keeps setup to one paste with no logins. If you'd rather lock it down,
> turn on Supabase email auth and change the policies to `to authenticated`.

## Step 4 — Set your budget

**Settings → Trip & budget.** Enter your budget in whichever unit you actually think
in — **Day**, **Week**, **Month** or **Total** — then say whether that figure is for
both of you or per person. Everything else is worked out from there, and the panel
underneath shows the same budget expressed every other way.

So all four of these are the same budget over a 123-day trip:

| You enter | For | Comes to |
|---|---|---|
| 130 | both of us | $15,990 total |
| 65 | per person | $15,990 total |
| 910 | both of us, per week | $15,990 total |
| 15990 | both of us, total | $15,990 total |

Switching unit or headcount never changes what you can spend — it just re-expresses
the same pot, so you can flip between them freely.

If you'd already spent something before installing this, put the running total in
**Starting balance already spent** rather than back-filling every receipt.

---

## How it works day to day

- **Add** — amount, category, who paid, date, optional note. Four taps. The **×2**
  and **÷2** buttons under the amount are for when the price you're looking at isn't
  the number you want to log: ×2 for "we each paid $20", ÷2 for "that $60 covers us
  both and I only want my half".
- **Home** —
  - money left, days left, and a bar with a marker showing where you *should* be today
  - daily allowance = what's left ÷ days left (so it self-corrects as you go)
  - this week and this month against their targets, each clipped to the trip dates
    so a part-week at either end isn't budgeted as a full one
  - who's paid more and what the settle-up is
- **Expenses** — week / month / all time, category breakdown, tap any row to edit or
  delete it.
- **Settle up** — when one of you has paid more, the Who paid panel offers a Settle
  up button. It records the transfer between you, zeroes the balance, and is *not*
  counted as trip spending. There's an undo if you press it by mistake.
- **Planned big costs** (Settings) — ferry crossings, tours, anything booked ahead.
  The money is held back from your daily allowance so paying it doesn't wreck a week.
  Delete the entry once you've logged the real expense.
- **Repeat a recent one** — the Add screen offers your last few distinct expenses as
  one-tap prefills, so logging the same petrol station is amount-only.
- **Paid from** — tag each expense with the account it came out of (BNZ, Revolut,
  Cash by default). Tap **+ New** to add another; it's remembered from then on, and
  the list is editable under Settings → Accounts. Expenses also break down **by
  account**, which is what you want when reconciling against a statement.
- **Note suggestions** — type two or more characters and past entries matching
  anywhere in the note appear. Picking one fills the category, who paid and the
  account as well, so most repeat expenses are three taps.
- **Last 8 weeks** — a bar per week against that week's target, red where you went over.
- Every NZD figure has the euro equivalent under it.
- The **Both of us / Per person** toggle at the top of Home halves every total,
  allowance and target so you can see your own share. Individual expenses always show
  what was actually paid. The choice is per phone — it isn't synced.

## Euro rate

Pulled from `open.er-api.com` (free, no key) whenever you open the app online, at most
once every 6 hours; cached otherwise. You can overwrite it by hand in Settings — useful
if you'd rather budget at the rate your card actually charges rather than the mid-market
rate.

## Offline behaviour

The app is fully usable with no signal — everything saves to the phone first. The badge
top-right shows `3 to sync` while you're offline; it pushes automatically the next time
you have data, and when you reopen the app. Conflicts resolve last-edit-wins, per
expense, which is the right call when two people are rarely editing the same receipt.

## Backups

**Settings → Backup → Export** writes a `.json` of everything. Worth doing once a month
onto Google Drive. Import merges rather than overwrites, so it's safe to re-import an
old file.
