# The EverSquig: InSquignito

InSquignito is the weird little Squigs Reloaded Discord watcher: harmless, judgmental, suspicious, and occasionally useful. He speaks less than a normal ambient bot, but when he does, it should feel like ugly little space freak lore, not generic trivia.

## Security

`.env` must never be committed. This repo previously tracked `.env`; any Discord token or secret that was ever pushed publicly should be rotated immediately in the Discord Developer Portal.

Use `.env.example` for variable names only. Keep real values in local deployment secrets.

## Setup

```bash
npm install
cp .env.example .env
npm start
```

Token variables are checked in this order:

- `DISCORD_TOKEN`
- `DISCORD_BOT_TOKEN`
- `SQUIG_TOKEN` for existing deploy compatibility

## Useful Scripts

```bash
npm start
npm run check
npm test
```

## Commands

- `/squigsay message image` speaks through InSquignito. Admin/commander only.
- `/question on|off|now` controls scheduled question prompts.
- `/insquig status` shows mood, intensity, quiet mode, prompts, and cooldown timing.
- `/insquig quiet on|off|hours` controls quiet mode.
- `/insquig mood <mood>` sets the personality mood.
- `/insquig intensity low|normal|chaos` tunes ambient frequency.
- `/insquig test <category>` previews a response pool.
- `/insquig channels list|allow|deny` controls automatic speech per channel.
- `/insquig prompts on|off` controls scheduled prompts.
- `/insquig prompt-now` sends a prompt immediately.
- `/insquig reset-cooldowns` clears ambient/category cooldowns.

## Configuration

Common env variables:

- `GENERAL_CHANNEL_ID`
- `DEV_GUILD_ID`
- `COMMANDER_USER_IDS`
- `MOD_ALERT_CHANNEL_ID`
- `UGLY_DOG_STICKER_ID`
- `CHANNEL_ALLOWLIST`
- `CHANNEL_DENYLIST`
- `CHANNEL_NAME_DENY_CONTAINS`
- `SAFE_DOMAINS`
- `INSQUIG_INTENSITY`
- `QUESTION_PROMPTS_ENABLED`

See [docs/INSQUIGNITO.md](docs/INSQUIGNITO.md) for the personality engine, cooldowns, and line editing guide.
