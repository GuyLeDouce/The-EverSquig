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
