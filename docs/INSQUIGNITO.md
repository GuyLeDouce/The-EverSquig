# InSquignito Operator Notes

## Personality

InSquignito is a Squigs Reloaded character, not a generic assistant. The voice should stay:

- short and punchy
- ugly, suspicious, meme-ready, and useful when needed
- harmless but judgmental
- tied to Squigs, Ugly City, the portal, creator chaos, games, and community weirdness

Avoid fake announcements, fake dates, fake floor prices, financial advice, protected-class jokes, mean-spirited insults, `@everyone`, `@here`, and long monologues.

## Engine

Message flow:

1. `index.js` receives the Discord event.
2. `triggerClassifier.js` detects direct mentions, replies, gm/gn, floor, sweep, mint, portal, ugly, Squigs, survival game, creator portal, hype, FUD, links, long rants, burst/back-and-forth activity, bait, and safety risks.
3. `personality.js` runs `decideInSquignitoAction(context)` and returns:
   - `shouldSpeak`
   - `mode`
   - `category`
   - `mood`
   - `responseText`
   - `reason`
   - `cooldownKey`
4. `speaker.js` checks cooldowns and sends the response.
5. `stateStore.js` persists runtime state to `data/insq_state.json`.

## Moods

Supported moods:

- `lurking`
- `judging`
- `suspicious`
- `impressed`
- `offended`
- `excited`
- `confused`
- `unhinged`
- `helpful_weird`
- `silent`

Set mood with `/insquig mood <mood>`. `silent` blocks personality output without disabling admin commands or tripwire checks.

## Intensity

Intensity affects ambient probability only:

- `low`: quieter
- `normal`: default
- `chaos`: more likely to speak, still cooldown-gated

Set with `/insquig intensity low|normal|chaos`.

## Cooldowns

Centralized cooldown and safety logic lives in `src/insquignito/cooldowns.js`.

It enforces:

- global ambient cooldown
- channel cooldown
- per-user direct cooldown
- per-category cooldown
- recent response/opening history
- minimum human messages after bot speech
- quiet mode
- channel allow/deny safety
- no automatic speech in rules/admin/announcement/log channels unless explicitly allowed

Default posture: InSquignito speaks less, but lands harder.

## Temporary October 2026 GM reminders

The existing GM classifier/personality/speaker pipeline uses the 30 supplied
Trick or Treat reminders for ordinary GM greetings during October 1–30, 2026.
There is no second message listener. Direct mentions/replies, moderation and
sticker priorities keep their existing behavior. Before and after the event,
the original GM response pool and ambient cooldowns apply automatically.

Matching is case-insensitive: standalone `gm` or `good` + whitespace + `morning`
anywhere in the message, including punctuation, Markdown and emojis. Adjacent
letters (including Unicode letters), digits or underscores prevent a match.
Bots, InSquignito itself and webhooks are ignored before activity processing.
All capitalization variants work, including `GM`, `Gm`, `gm`, `gM` and mixed-case
`Good Morning`. During the event, stickers `1458788269088313355` and
`1509562739947737188` also count as GM, even without message text. They use the
same response pool and probability; combining text and stickers
does not create extra replies. Sticker recognition is limited to the event dates.

`src/insquignito/trickOrTreatGm.js` holds all reminder text, the channel URL,
date constants and sticker IDs. No new environment variables or
dependencies are required. `TRICK_OR_TREAT_GM_END_DATE` is the exclusive end:
October 31, 2026 at 00:00 Toronto time (`2026-10-31T04:00:00Z`). The repository
had no timezone convention; Toronto is UTC-04:00 for this event. Both action
selection and the send gate check the date on each message; no timer, restart,
manual toggle or redeploy is needed to expire it. It does not recur next year.

Reminders keep the existing GM probability (35% at normal intensity, 17.5% low,
50.75% chaos). They have no global, channel, per-user, category or minimum-human-
message cooldown, and an in-flight send does not block other GM replies.
Quiet mode, silent mood and channel restrictions still apply. A reminder is a
Discord reply without pinging the author. Probability-skipped reminders do not
fall back to a second GM response.

Successful sends reuse existing response history and JSON state persistence;
the last event response is excluded from subsequent selection even when all pool
entries are in history. Event responses do not advance the ambient global timer
or direct-user timer. Channel speech history still updates normally. Cooldowns
for other features and normal GM behavior outside the event remain unchanged.

## Question Prompts

Prompts live in `responseLibrary.js` under `questionPrompts`, organized by:

- `ugly_opinions`
- `squig_lore`
- `survival_game`
- `portal_questions`
- `memes`
- `creator_portal`
- `holders`
- `floor_sweep_energy`
- `weird_earth_studies`
- `safe_trivia_rare`

Add new prompts only if they connect back to Squigs, ugly culture, games, memes, creator tools, or community weirdness.

## Response Lines

Response pools live in `src/insquignito/responseLibrary.js`.

Major categories include:

- `directMention`
- `questions`
- `gm`
- `gn`
- `floor`
- `sweep`
- `mint`
- `portal`
- `ugly`
- `squigs`
- `squigSurvival`
- `creatorPortal`
- `hype`
- `fud`
- `dogPanic`
- `unknown`
- `rareUnhinged`

Keep lines short. Make rare unhinged lines actually rare.

## Project Knowledge

Safe stable facts live in `src/insquignito/projectKnowledge.js`.

If a question asks about live project facts such as dates, prices, floor, mint rules, allowlist, snapshots, supply, or official links and those facts are not in config, InSquignito must defer instead of inventing canon.

## Moderation Tripwire

`modTripwire.js` watches for:

- seed/private key risk
- unknown or suspicious domains
- impersonation, DM, claim, airdrop, or wallet-connection scam language

Set `MOD_ALERT_CHANNEL_ID` to send alerts to staff. Without it, alerts are logged.

## Local Testing

```bash
npm run check
npm test
```

Tests use Node's built-in test runner and do not connect to Discord.
