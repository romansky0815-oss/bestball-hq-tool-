# BestBall HQ

A subscription web app for best ball drafters:

- **Team grades against "ADP twins"**: for every pick on your team, the engine finds players at the same position whose ADP was near that pick. It then simulates hundreds of teams that made those alternative picks and scores each with best-ball lineup rules (QB1 RB2 WR3 TE1 FLEX1). Your percentile among them becomes a letter grade, with a pick-by-pick breakdown (`lib/grading.ts`).
- **Draft grade**: value against current ADP and against your own rankings.
- **Exposure tracking**: exposure %, average pick vs. current ADP (closing line value), near-duplicate teams, repeated 2- and 3-player cores, QB stacks and roster builds (`lib/exposure.ts`).
- **Imports**: Underdog exposure CSV as-is, a generic CSV format, or manual entry with snake-draft pick numbers.
- **Your rankings**: versioned. Subscribers see tiers, notes, movement since the last update and their own exposure.
- **Newsletter**: injury, rankings and strategy posts. Pro posts show free readers a teaser.
- **Subscriptions**: Stripe Checkout, billing portal and a webhook that syncs plans. Free tier: 5 teams and the top-24 rankings.
- **Admin**: upload ADP and weekly scores, publish rankings, write posts, comp Pro to users.

## Run locally

```bash
npm install
cp .env.example .env        # set AUTH_SECRET and ADMIN_EMAIL
npx prisma db push
npm run db:seed             # optional demo data: demo@bestball.test / demo1234
npm run dev
```

Sign up with the email in `ADMIN_EMAIL` to get the admin account.

> The seed data is **fake**. ADP is an approximate ordering and the weekly scores are random. Upload real ADP in Admin and real scores with `npm run sync:sleeper` before you show the app to anyone.

## Data each week

1. **ADP**: Admin → Upload ADP (`Player, Position, Team, ADP`). Underdog's rankings CSV works.
2. **Scores**: run `npm run sync:sleeper -- --season 2026 --weeks 1-18`, which pulls half-PPR points from Sleeper's free API. You can also upload a `Player, Position, Week, Points` CSV.
3. **Rankings**: Admin → Publish rankings. The page is prefilled with the live version, so you edit it and republish. You can also announce the update in the newsletter.

## Going to production

- **Database**: change `provider` in `prisma/schema.prisma` to `postgresql` and set `DATABASE_URL` (Neon, Supabase, Railway).
- **Hosting**: Vercel or similar. Set every variable from `.env.example`.
- **Stripe**: create a recurring Price and set `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID`. Add a webhook to `/api/stripe/webhook` for `checkout.session.completed` and `customer.subscription.updated|deleted`, then set `STRIPE_WEBHOOK_SECRET`.
- **Scheduled sync**: run `sync:sleeper` on a schedule, for example a GitHub Action every Tuesday.

## Known limitations / next steps

- Cohorts use **current** ADP, not the ADP on the day you drafted. Storing daily ADP snapshots would make grades more accurate for early drafts.
- Newsletter posts are on-site only. Sending them by email needs a provider such as Resend or Postmark.
- There is no password reset yet.
- Grades are computed on request and cached in memory. With many users, move them to a background job.

## Tests

```bash
npm test
```
