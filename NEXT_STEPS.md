# trackID.lb — Next Steps

> Written Session 29, after a full pass to bring CLAUDE.md, ROADMAP.md, ENHANCEMENTS.md,
> BUGS.md, DEPLOY.md, and ENV_VARS.md up to date with this session's actual progress
> (domain cutover, theme-adaptive favicon, WhatsApp Cloud API setup, Google Search Console,
> and an 8-item UX/conversion batch — see CLAUDE.md's Session 29 entries for the full detail
> on each). This file is the forward-looking counterpart: what to pick up next, in
> recommended order. Keep it updated the same way as the other planning docs — flip items
> as they're done, log the session in CLAUDE.md.

---

## 1. Immediate — finish what's already in motion

### WhatsApp templates (blocked on Meta, not on code)
Two message templates were submitted to Meta Business Manager for approval this session:
- `WHATSAPP_ORDER_ALERT_TEMPLATE_NAME` — staff new-order alert
- `WHATSAPP_ORDER_CONFIRMATION_TEMPLATE_NAME` — customer order confirmation

**Action**: check Meta's dashboard for approval status. Once approved, set both env vars
(`.env.local` for dev, Vercel for prod — see ENV_VARS.md for the exact template bodies if
you need to resubmit), then place one real test order to confirm both messages land. This
closes out BUGS.md B25 and ROADMAP Part 0's WhatsApp-activation line for good.

---

## 2. The big strategic one — ROADMAP Part 8 (Productization)

This is the largest genuinely-unstarted piece of work, and it's what turns trackID.lb from
"a store" into "a product sellable to other brands" — the stated eventual goal. Multi-session
sized; treat as its own dedicated push rather than folding into a polish batch.

- **Generic taxonomy / de-verticalization** — the data model still hardcodes a music/clothing
  brand (`Artist` collection, `reference_artist`/`reference_song` on CustomRequest). A
  jewelry or furniture brand needs these as admin-configurable labels + URL segments, not a
  code change per client. See ROADMAP.md Part 8 for the full breakdown.
- **Deployment model decision** — recommendation already in ROADMAP.md: per-client deploy
  (own Vercel + Supabase project per brand) over multi-tenant SaaS. Confirm this before
  building anything that assumes one or the other.
- **Onboarding wizard** — guided first-run admin flow (brand → theme → delivery zones →
  payment providers → first product → publish) instead of a developer manually walking
  admin.
- **Feature flags** — a SiteSettings "Features" tab toggling reviews/gift cards/loyalty/
  blog/chatbot on or off per brand size.
- **Demo mode + seed** — a polished, vertical-neutral demo dataset for sales conversations
  (the current seed script is music-specific).
- **Owner documentation** — a non-technical admin guide (products, orders, refunds, reports,
  theming) required for real handover to a store owner who isn't a developer.
- **Versioned upgrades** — clients on older versions need a documented upgrade path
  (migrations already give the DB half; add a CHANGELOG.md discipline).
- **Licensing/commercial model** — pricing decision, out of code scope but the feature-flag
  work above supports tiering.

---

## 3. Smaller, real, still-open polish (if you'd rather stay incremental)

Confirmed genuinely open during this session's doc audit (several other ENHANCEMENTS.md
items turned out already done elsewhere and have been marked accordingly):

- **E3 — Checkout form polish**: render `CartNotices` on the checkout page itself (currently
  only visible in the drawer/cart — a reduced/sold-out line is invisible at the exact place
  it matters most), a "save this address to my account" checkbox for logged-in customers,
  submit button disabled until required fields are valid + scroll-to-first-error. (Per-field
  server-side validation errors, the other original sub-item here, was already done in
  Session 20 — doc corrected.)
- **F2 — Admin orders list ergonomics**: a readable admin title format
  (`TRK-1234 · Name · $86 COD`) and status filter presets. (Packing slips and CSV export,
  the other two original sub-items, were already done in Sessions 24/27 — doc corrected.)
- **F5 — Page versions + live preview**: `versions: { drafts: true }` on Pages/Homepage +
  Payload Live Preview. Needs a one-time force-publish migration for existing pages and your
  explicit buy-in before scheduling — only build this when undo/history is something you've
  actually asked for, not preemptively.

---

## 4. Externally blocked — not code-actionable until you move them

These need a business-side decision or paperwork before any code gets written:

- **Real card payment gateway** — Areeba (MPGS) or NetCommerce merchant account +
  sandbox/hosted-checkout access. The payment abstraction and a mock provider already exist
  (ROADMAP F1); a real gateway is "add a provider," not a rewrite.
- **Real courier integration** — needs a vendor pick (Wakilni/Toters or similar). The courier
  adapter interface already exists (ROADMAP Part 3.2) for the same reason.
- **Real OMT API confirmation** — currently voucher + manual admin confirm (v1); needs OMT's
  B2B agreement for the real e-commerce API.
- **Instagram embed** — blocked on the brand's Instagram handle, nothing else.

---

## 5. Explicitly out of scope (your own prior direction, unchanged)

- **AI Assistant / chatbot** (ROADMAP Part 5) — skipped per your Session 22 decision.
- **Whish Money adapter** (ROADMAP §2.2) — skipped per the same decision; card rail goes
  through a dedicated acquirer instead.

---

## Recommended order

1. WhatsApp templates whenever Meta approves them (quick, already in motion)
2. Start Part 8 (Productization) — the one piece of real strategic value sitting completely
   untouched, and everything else is refinement on a store that's already functionally
   complete
3. Fold in the small E3/F2 polish items opportunistically, or as a short session between
   Part 8 milestones
4. Revisit payments/courier once the external business conversations have actually moved
