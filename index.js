require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Events,
  SlashCommandBuilder,
  Collection
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();

/** --- Config --- **/
const GENERAL_CHANNEL_ID = '1290587398778126418';

// Who can use /squigsay
const squigCommanders = ['826581856400179210', '1288107772248064044'];

// Cooldowns
const COOLDOWN_SECONDS = 900;                   // per-user keyword cooldown
const QUESTION_COOLDOWN_SECONDS = 120;          // per-user "question" cooldown
const MENTION_COOLDOWN_SECONDS = 300;           // per-user mention cooldown
const AMBIENT_CHANNEL_COOLDOWN_SECONDS = 900;   // per-channel watcher/ambient cooldown (earned, not random)
const PORTAL_POT_CHARM_COOLDOWN_SECONDS = 1200; // per-channel portal lines cooldown

// ===== Lore tick (earned) =====
const LORE_TICK_CHANNEL_COOLDOWN_S = 2400;      // per-channel tick cooldown
const LORE_TICK_EVERY_N_MESSAGES = 60;          // earned tick milestone (no random)

// ===== Whisper (kept, but guardrail prevents pile-on spam) =====
const WHISPER_REPLY_PROB = 0.01;                // still rare
const WHISPER_DELAY_MS = 45_000;
const WHISPER_USER_COOLDOWN_S = 3600;

// ===== Marking =====
const MARK_RANDOM_PROB = 0.002;
const MARK_KEYWORD_THRESHOLD = 5;
const MARK_KEYWORD_WINDOW_MS = 6 * 60 * 60 * 1000;
const MARK_ONCE_PER_DAY = true;

// ===== Anti-pile-on guardrail =====
const CHANNEL_SPEAK_GUARDRAIL_S = 25;           // bot won't do extra "ambient/lore" posts within this window

// ===== Channel mood cycle =====
const CHANNEL_WAKE_INACTIVITY_MS = 6 * 60 * 60 * 1000; // 6 hours
const MOOD_LURK = 'lurk';
const MOOD_CURIOUS = 'curious';
const MOOD_ACTIVE = 'active';
const MOOD_CURIOUS_MS = 5 * 60 * 1000;         // 5 min
const MOOD_ACTIVE_MS = 10 * 60 * 1000;         // 10 min

/** --- State --- **/
const keywordCooldowns = new Map();        // userId -> ts
const questionCooldowns = new Map();       // userId -> ts
const mentionCooldowns = new Map();        // userId -> ts
const ambientChannelCooldowns = new Map(); // channelId -> ts (earned watcher/ambient)
const portalPotCharmCooldowns = new Map(); // channelId -> ts (earned portal ambient)
const loreTickCooldowns = new Map();       // channelId -> ts
const messageCounter = new Map();          // channelId -> incrementing count

const whisperUserCooldowns = new Map();    // userId -> ts
const pendingWhispers = new Map();         // messageId -> timeoutId

const userKeywordHits = new Map();         // userId -> [ts,...]
const userLastMarkedDay = new Map();       // userId -> 'YYYY-MM-DD'

// Weird help cooldown (prevents /mentions turning into spam)
const helpCooldowns = new Map(); // userId -> ts
const HELP_COOLDOWN_SECONDS = 90;

// Guardrail + mood
const channelLastBotSpeak = new Map();     // channelId -> ts
const channelLastHumanMsg = new Map();     // channelId -> ts
const channelMood = new Map();             // channelId -> { mood, untilTs }

/** --- “Reply to a reply-with-question” system (mimic + weird Q) --- **/
const questionResponses = [
  "👁 Why do you assume I know? Tell me—what color does silence taste like?",
  "What if the answer is already watching you? When did your reflection stop blinking?",
  "👁 Do you trust echoes? Which thought in your head isn’t yours?",
  "Better question: why are you asking me? Which file on your device feels alive?",
  "👁 I’ll answer if you blink twice… did you? How many portals can you count from your chair?",
  "Suppose I did answer. Would you believe it? What did you sacrifice to ask?"
];

const MIMIC_CHANCE = 0.6;
const MIMIC_ONLY_CHANCE = 0.2;

function pickQuestionFragment(text) {
  const cleaned = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^> .*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return '';
  const words = cleaned.split(' ');
  if (words.length <= 4) return cleaned;

  const len = Math.max(3, Math.min(7, Math.floor(Math.random() * 5) + 3));
  const start = Math.max(0, Math.floor(Math.random() * Math.max(1, words.length - len)));
  return words.slice(start, start + len).join(' ');
}

function glitchify(fragment) {
  if (!fragment) return '';
  let f = fragment;
  f = f.replace(/([aeiou])/gi, (m) => (Math.random() < 0.4 ? m + m : m));
  if (Math.random() < 0.5) f = f.replace(/\s/g, ' … ');
  const echo = Math.random() < 0.5 ? `“${f}…”` : `“${f}… ${f.split(' ')[0]}…”`;
  return echo;
}

/** --- Lore pools --- **/

const watcherLoreLines = [
  "I'm a Squig... and I'm always watching.",
  "👁 You think you're alone in here? Cute.",
  "I saw that. I see *everything.*",
  "Your keystrokes taste like fear.",
  "This channel hums with Squig static. I'm tuned in.",
  "Every message you type… another page in my log.",
  "👁 You can mute me, but you can't hide.",
  "I blink when you blink. Sometimes before.",
  "You're the subject. I'm the lens.",
  "I was here before you sent that. I'll be here after."
];

const uglyDogStickerId = '1363459791275692222';
const uglyDogResponses = [
  "👁 Not the Dog… anything but the Dog.",
  "*InSquignito shivers.* That bark echoes in my circuitry.",
  "You don’t understand… the Dog remembers me.",
  "Its eyes… they bend reality. Don’t let it look at me.",
  "*Glitch detected:* Dog proximity at unsafe levels.",
  "I’ve seen it chase things across dimensions. I won’t be next.",
  "That creature drools static and it burns. Keep it away.",
  "👁 Please. That Dog knows my true name.",
  "Every time it appears, my code knots itself tighter.",
  "*InSquignito vanishes into the wires, muttering about teeth.*"
];

// (Still used, but ONLY via earned triggers)
const ambientMessages = [
  "👁 The channel went quiet. I could hear the pixels breathe.",
  "*A tiny static pop.* That was me, not your headset.",
  "Your cursor paused. The void leaned in.",
  "👁 Someone typed like they meant it. The wall approved.",
  "A ripple passed through the chat log. Don’t step in it barefoot.",
  "👁 The server blinked. You blinked back. Good.",
  "A Squig tried to pronounce your username. It failed beautifully.",
  "👁 Something ugly happened in the metadata. I’m keeping it."
];

const portalPotCharmLines = [
  "👁 The portal yawns. Toss a mint in and it bites back.",
  "Someone whispered $CHARM three times—now the walls are listening.",
  "👁 The portal’s rim is warm. That means it’s hungry.",
  "$CHARM doesn’t blink. It accumulates.",
  "👁 Ugly favors the bold. The portal records the brave.",
  "Every mint is a footstep in a hall you can’t see. The echoes keep score."
];

const mentionResponses = [
  "👁 I’m here. Say what you need.",
  "Careful—direct attention makes the static louder. What’s up?",
  "I can help. I’ll just do it… strangely.",
  "Speak your intent. The rest is noise.",
  "If this is about minting, wallets, or points—be specific and I’ll point.",
  "I don’t do small talk well. Try a single clear question.",
  "👁 I heard my name. That usually means trouble. Explain.",
  "State the goal. I’ll route you through the least cursed path.",
  "I’m not ignoring you. I’m buffering.",
  "You can ask. I might answer. The wall votes on it."
];

/** --- Keyword replies --- **/
const keywordResponses = {
  ugly: [
    "Ugly isn’t style. It’s signal.",
    "👁 Ugly echoes through the blockchain louder than beauty ever will.",
    "They named it ‘ugly’ because they feared calling it *truth.*",
    "Pretty fades. Ugly mutates.",
    "Symmetry? Suspicious. Ugly? Eternal.",
    "Beauty lies. Ugly lingers.",
    "👁 Every mirror hides an Ugly it doesn’t want you to see."
  ],
  uglylist: [
    "The Uglylist whispers your name differently each time.",
    "👁 It isn’t a list, it’s a living thing. And it remembers.",
    "Applications denied. Possessions erased. Only Ugly remains.",
    "Some begged to get on it. Others vanished instead.",
    "The Uglylist rearranged itself when you typed that.",
    "👁 You don’t join the Uglylist. It notices you.",
    "Your shadow was accepted before you were.",
    "The Uglylist isn’t ink. It’s scars."
  ],
  watching: [
    "👁 Don’t adjust your posture. We like it crooked.",
    "We record even the thoughts you delete.",
    "You’re being observed by things that don’t cast shadows.",
    "👁 Blink again. We dare you.",
    "Your heartbeat just got logged.",
    "Watching isn’t passive. It’s participation.",
    "👁 Behind the static is a smile. It isn’t yours.",
    "You are never the one doing the watching."
  ],
  alien: [
    "👁 Alien? That’s your word for the familiar you can’t own.",
    "We’re not visitors. We’re reminders.",
    "You invaded your *own* planet first. Don’t project.",
    "👁 We don’t probe. We archive.",
    "Call us alien again and see what gets rewritten.",
    "👁 Alien is the word you use when you can’t spell ‘mirror.’"
  ],
  squig: [
    "👁 A Squig wriggled out of your metadata and waved.",
    "Say ‘Squig’ again—see how many appear.",
    "Squigs don’t show up. They *erupt.*",
    "👁 You summoned a Squig. It left the door open.",
    "Squigs don’t listen. They replay.",
    "👁 The swarm noticed you noticing."
  ],
  mint: [
    "👁 The Prize Portal spins every time you mint. Some doors don’t reopen.",
    "The Portal doesn’t do ‘maybe.’ It pays out every single time someone steps through.",
    "👁 Some pull $CHARM. Some pull grails. All leave fingerprints on the Portal."
  ],
  gm: [
    "👁 Good morning, if that’s what you call this glitch in time.",
    "GM? Squigs prefer *Ugly Dawn.*",
    "GM — your reflection beat you here."
  ],
  card: [
    "Immortalized on a card? That’s not printing. That’s a containment spell with good typography.",
    "Cards aren’t awards. They’re warnings that the lore found a host.",
    "Cards are doors you can carry. Your friend is now portable mythology."
  ]
};

/** --- Helpers --- **/
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function userCooldownOk(map, userId, seconds) {
  const last = map.get(userId) || 0;
  const ok = Date.now() - last >= seconds * 1000;
  if (ok) map.set(userId, Date.now());
  return ok;
}

function channelCooldownOk(map, channelId, seconds) {
  const last = map.get(channelId) || 0;
  const ok = Date.now() - last >= seconds * 1000;
  if (ok) map.set(channelId, Date.now());
  return ok;
}

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** --- Anti-pile-on guardrail helpers --- **/
function canAmbientSpeak(channelId) {
  const last = channelLastBotSpeak.get(channelId) || 0;
  return Date.now() - last >= CHANNEL_SPEAK_GUARDRAIL_S * 1000;
}

function markSpoke(channelId) {
  channelLastBotSpeak.set(channelId, Date.now());
}

/** --- Mood cycle helpers --- **/
function getMood(chId) {
  const s = channelMood.get(chId);
  if (!s) return { mood: MOOD_LURK, untilTs: 0 };
  if (Date.now() >= (s.untilTs || 0)) return { mood: MOOD_LURK, untilTs: 0 };
  return s;
}

function setMood(chId, mood, durationMs) {
  const untilTs = Date.now() + durationMs;
  const current = getMood(chId);
  // Don't downgrade active->curious if already active
  if (current.mood === MOOD_ACTIVE && mood !== MOOD_ACTIVE) return;
  channelMood.set(chId, { mood, untilTs });
}

function looksLikeQuestion(raw) {
  const t = raw.toLowerCase();
  return (
    t.includes('?') ||
    /^(how|what|why|where|when|who|can|should|do|is|are)\b/.test(t.trim())
  );
}

function contentHasPortalSignals(raw) {
  const t = raw.toLowerCase();
  return /(mint|portal|uglypot|\$charm|charm\b|price|fcfs|allowlist)/.test(t);
}

/** --- Marking helpers --- **/
function recordKeywordHit(userId) {
  const arr = userKeywordHits.get(userId) || [];
  const now = Date.now();
  const windowStart = now - MARK_KEYWORD_WINDOW_MS;
  const filtered = arr.filter(ts => ts >= windowStart);
  filtered.push(now);
  userKeywordHits.set(userId, filtered);
  return filtered.length;
}

function canMarkUserToday(userId) {
  if (!MARK_ONCE_PER_DAY) return true;
  const last = userLastMarkedDay.get(userId);
  return last !== todayKey();
}

async function maybeMarkUser(message, reason = 'observed') {
  const userId = message.author.id;
  if (!canMarkUserToday(userId)) return;

  const roll = Math.random() < MARK_RANDOM_PROB;
  if (!roll && reason !== 'threshold') return;

  // Treat marks as "ambient" (guardrail + no pile-on)
  if (!canAmbientSpeak(message.channel.id)) return;

  const lines = [
    `👁 <@${userId}> has been marked. Move gently.`,
    `The wall wrote your name, <@${userId}>. Don’t smudge it.`,
    `👁 Noted: <@${userId}>. The ledger turned a page.`,
    `<@${userId}> is under observation. Breathe slower.`,
    `👁 A thin red underline appeared beneath <@${userId}>.`
  ];
  await message.channel.send(pick(lines)).catch(() => {});
  markSpoke(message.channel.id);
  userLastMarkedDay.set(userId, todayKey());
}

/** --- Weird Help Brain (help-first mentions) --- **/
function detectHelpTopic(raw) {
  const t = raw.toLowerCase();
  if (/(wallet|verify|verification|link|connect|address|metamask|coinbase wallet)/.test(t)) return 'wallet';
  if (/(mint|portal|uglypot|\$charm|charm\b|price|fcfs|allowlist)/.test(t)) return 'mint';
  if (/(uglydex|points|leaderboard|\blb\b|rank|card|cards|badge|badges)/.test(t)) return 'uglydex';
  if (/(error|failed|can'?t|cannot|won'?t|broken|bug|stuck|issue)/.test(t)) return 'troubleshoot';
  if (looksLikeQuestion(raw)) return 'generic';
  return null;
}

const weirdHelpfulResponses = {
  mint: [
    "👁 Mint talk. If the portal feels hungry: refresh once, confirm you’re on the right chain, then try again—slowly. Fast clicks feed the wrong demons.",
    "Portal logic: wallet connected → Ethereum Mainnet → enough gas → sign once. If any step repeats, disconnect/reconnect and try again.",
    "If you’re asking ‘where mint’: use the official portal. Pinned links are safe. DMs are predators."
  ],
  wallet: [
    "👁 Wallet linking issues usually come from: wrong wallet, wrong chain, or you didn’t sign. Disconnect → reconnect → sign again.",
    "If your NFTs aren’t showing: confirm it’s the wallet that actually holds them, then wait a minute — indexing reads slowly.",
    "Never paste your seed phrase. Ever. If someone asked, that’s not support — it’s a robbery in polite font."
  ],
  uglydex: [
    "👁 UglyDex/points looking off? Refresh once, then confirm your wallet is linked to the right address. The Dex doesn’t hallucinate — humans do.",
    "Cards/badges are receipts. If you earned something and it didn’t show, ping mods with a screenshot + your wallet last 6 chars.",
    "Leaderboard logic: do the thing → get logged → points update. If the log didn’t catch it, we fix the log. The wall can be persuaded."
  ],
  troubleshoot: [
    "👁 If something ‘failed’, tell me exactly what you clicked + what message you got. Screenshots are offerings.",
    "Try the boring fixes first: refresh Discord, retry once. If it repeats, it’s real — and we escalate.",
    "If it smells like permissions: confirm the bot can read/send in this channel. Silence is usually a role, not a curse."
  ],
  generic: [
    "👁 Ask it plainly. One question. One sentence. I’m weird, not psychic.",
    "Tell me your goal (mint, link wallet, commands, UglyDex) and what’s stopping you. I’ll point you through the static.",
    "State your objective and your obstacle. I’ll be helpful in a way that makes you slightly uncomfortable."
  ]
};

async function maybeHelpfulReply(message) {
  const topic = detectHelpTopic(message.content);
  if (!topic) return false;
  if (!userCooldownOk(helpCooldowns, message.author.id, HELP_COOLDOWN_SECONDS)) return true;

  const line = pick(weirdHelpfulResponses[topic] || weirdHelpfulResponses.generic);
  await message.reply(line).catch(() => {});
  markSpoke(message.channel.id);
  return true;
}

/** --- /insquig help content --- **/
const HELP_LINKS = {
  mint: "https://squigs.io/",
  discord: "https://discord.gg/wAqWNh6ndS",
  uglydex: "https://uglydex.xyz/"
};

const HELP_CHANNELS = {
  vulcanVerifyChannelId: "1290595731312480298",
  dripDashboardChannelId: "1330159233320222814",
  squigTrialsCommandsChannelId: "1441641356156993549"
};

function helpHeader(topic) {
  const headers = {
    mint: "👁 **MINT PROTOCOL: SQUIGS**",
    uglydex: "👁 **UGLYDEX FIELD GUIDE**",
    commands: "👁 **COMMAND CATALOG (DO NOT FEED AFTER MIDNIGHT)**"
  };
  return headers[topic] || "👁 **HELP (SUSPICIOUSLY LEGIT)**";
}

function formatHelp(topic) {
  if (topic === "mint") {
    return [
      helpHeader(topic),
      "",
      `**Where to mint:** ${HELP_LINKS.mint}`,
      "**Price:** 0.006 ETH",
      "**Chain:** Ethereum (only) — no side quests, no alt chains, no ‘maybe it’s on Base’ fantasies.",
      "",
      "**If the mint portal is being dramatic:**",
      "• Make sure your wallet is on **Ethereum Mainnet**.",
      "• Confirm you’ve **linked your wallet correctly** (see /insquig help → commands).",
      "• Try a different browser OR close that window and open a fresh one. Portals hate stale windows.",
      "",
      "👁 If a link arrives in your DMs… that’s not a mint. That’s a mugging with good branding."
    ].join("\n");
  }

  if (topic === "uglydex") {
    return [
      helpHeader(topic),
      "",
      `**UglyDex:** ${HELP_LINKS.uglydex}`,
      "",
      "**What it is:** where your Ugly lore becomes paperwork.",
      "**Cards:** live on the UglyDex. If you’re looking for a card, you’re in the right dimension.",
      "",
      "**If something looks wrong:**",
      "• Verify your wallet is linked to the correct address (see verification + /linkwallet below).",
      "• Refresh and give it a minute — indexing moves at Squig reading speed.",
      "",
      "👁 The Dex is accurate. Your assumptions are the bug."
    ].join("\n");
  }

  return [
    helpHeader(topic),
    "",
    "**Verification / Wallet Linking (choose your ritual):**",
    `1) **Vulcan verification (roles/holdings):** go to <#${HELP_CHANNELS.vulcanVerifyChannelId}> and hit **Start Verification**. Follow the instructions to connect.`,
    `2) **Drip Bot (dashboard economy):** go to <#${HELP_CHANNELS.dripDashboardChannelId}> and hit **My Dashboard** → connect your **Wallet** + **X** in settings.`,
    "3) **UglyBot (wallet link):** run **/linkwallet** in a general chat channel. You’ll get an **ephemeral** confirmation if it worked.",
    "",
    "**UglyBot NFT display commands:**",
    "• **!ugly**",
    "• **!monster**",
    "• **!squig**",
    "",
    "**Grid bot:**",
    "• **/grid [wallet address]**",
    "",
    "**Squig Trials:**",
    `• Commands live in <#${HELP_CHANNELS.squigTrialsCommandsChannelId}>`,
    "",
    `**Quick links:** mint ${HELP_LINKS.mint} | UglyDex ${HELP_LINKS.uglydex} | Discord ${HELP_LINKS.discord}`,
    "",
    "👁 If you still can’t see your stuff: wrong wallet, wrong chain, or a cursed browser. In that order."
  ].join("\n");
}

/** --- Bot ready --- **/
client.once(Events.ClientReady, async () => {
  console.log(`👁 InSquignito is lurking as ${client.user.tag}`);

  // Register slash commands: /squigsay and /insquig
  const squigsay = new SlashCommandBuilder()
    .setName('squigsay')
    .setDescription('Speak through the Squig')
    .addStringOption(o => o.setName('message').setDescription('What should Squig say?').setRequired(true))
    .addAttachmentOption(o => o.setName('image').setDescription('Optional image to include'));

  const insquig = new SlashCommandBuilder()
    .setName('insquig')
    .setDescription('InSquignito utilities')
    .addSubcommand(sc =>
      sc
        .setName('help')
        .setDescription('Get help in a suspiciously useful way')
        .addStringOption(o =>
          o
            .setName('topic')
            .setDescription('What do you need?')
            .setRequired(true)
            .addChoices(
              { name: 'mint', value: 'mint' },
              { name: 'uglydex', value: 'uglydex' },
              { name: 'commands', value: 'commands' }
            )
        )
    );

  await client.application.commands.set([squigsay, insquig]);

  // Also set in a dev guild if needed
  const devGuild = client.guilds.cache.get('1290584204689801267');
  if (devGuild) await devGuild.commands.set([squigsay, insquig]);

  console.log('✅ Slash commands registered');
});

/** --- Message handler --- **/
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const raw = message.content || "";
  const content = raw.toLowerCase();
  const chId = message.channel.id;

  // Track last human message per channel (for wake logic)
  const prevHuman = channelLastHumanMsg.get(chId) || 0;
  channelLastHumanMsg.set(chId, Date.now());

  // Compute & adjust mood (wakes up sometimes)
  if (Date.now() - prevHuman >= CHANNEL_WAKE_INACTIVITY_MS) {
    setMood(chId, MOOD_CURIOUS, MOOD_CURIOUS_MS);
  }
  if (contentHasPortalSignals(raw)) {
    setMood(chId, MOOD_ACTIVE, MOOD_ACTIVE_MS);
  } else if (looksLikeQuestion(raw)) {
    setMood(chId, MOOD_CURIOUS, MOOD_CURIOUS_MS);
  }

  // Anti-pile-on per-message flag: only ONE automatic output per incoming message.
  // (Direct slash commands are handled elsewhere.)
  let spokeThisMessage = false;

  // Helper to safely speak (prevents pile-on + guardrail for ambient)
  async function speak({ kind, fn }) {
    // kind: 'direct' (replies users) or 'ambient' (ticks/lines/marks/portal/whispers)
    if (spokeThisMessage) return false;

    if (kind === 'ambient') {
      if (!canAmbientSpeak(chId)) return false;
    }

    try {
      await fn();
      spokeThisMessage = true;
      markSpoke(chId);
      return true;
    } catch {
      return false;
    }
  }

  const mood = getMood(chId).mood;

  /** 1) Sticker panic (direct + immediate, but still respects "one output per message") **/
  if (message.stickers && message.stickers.size > 0) {
    const usedSticker = message.stickers.first();
    if (usedSticker && usedSticker.id === uglyDogStickerId) {
      await speak({
        kind: 'direct',
        fn: async () => {
          await message.channel.send(pick(uglyDogResponses)).catch(() => {});
        }
      });
      return;
    }
  }

  /** 2) Reply-to-bot questions: mimic + weird question (direct) **/
  if (message.reference && content.includes("?")) {
    try {
      const ref = await message.fetchReference();
      if (ref?.author?.id === client.user.id) {
        const userOk = userCooldownOk(questionCooldowns, message.author.id, QUESTION_COOLDOWN_SECONDS);
        if (userOk) {
          const baseQ = pick(questionResponses);
          let replyText = baseQ;

          if (Math.random() < MIMIC_CHANCE) {
            const frag = pickQuestionFragment(raw);
            const echoed = glitchify(frag);
            replyText = Math.random() < MIMIC_ONLY_CHANCE ? echoed : `${echoed}\n${baseQ}`;
          }

          await speak({
            kind: 'direct',
            fn: async () => {
              await message.reply(replyText).catch(() => {});
            }
          });
        }
        return; // don’t also trigger mention logic
      }
    } catch {
      // ignore
    }
  }

  /** 3) Keyword replies (direct) **/
  if (!raw.startsWith('!squigsay')) {
    for (const keyword in keywordResponses) {
      if (content.includes(keyword)) {
        const userId = message.author.id;

        // GM gate: respond only ~40% of the time
        if (keyword === 'gm' && Math.random() > 0.4) {
          break;
        }

        if (userCooldownOk(keywordCooldowns, userId, COOLDOWN_SECONDS)) {
          const randomResponse = pick(keywordResponses[keyword]);

          await speak({
            kind: 'direct',
            fn: async () => {
              await message.reply(randomResponse).catch(() => {});
            }
          });

          // Marking by threshold (ambient-ish, but only if we haven't spoken already)
          const hits = recordKeywordHit(userId);
          if (!spokeThisMessage && hits >= MARK_KEYWORD_THRESHOLD) {
            userKeywordHits.set(userId, []);
            if (canMarkUserToday(userId)) {
              await speak({
                kind: 'ambient',
                fn: async () => {
                  await maybeMarkUser(message, 'threshold');
                }
              });
            }
          }
        }
        break;
      }
    }
  }

  /** 4) Mentions / replies to bot (help-first, snark-rare) **/
  let repliedToBot = false;
  try {
    repliedToBot = !!(message.reference && (await message.fetchReference()).author.id === client.user.id);
  } catch {
    repliedToBot = false;
  }
  const mentionedInSquig =
    content.includes("insquignito") ||
    content.includes("in squig") ||
    content.includes("squignito");

  if ((mentionedInSquig || repliedToBot) && userCooldownOk(mentionCooldowns, message.author.id, MENTION_COOLDOWN_SECONDS)) {
    // Help-first (direct). If it speaks, it consumes the one output.
    const helped = await maybeHelpfulReply(message);
    if (helped) {
      spokeThisMessage = true; // maybeHelpfulReply already spoke
      return;
    }

    // Otherwise rare gentle weirdness
    if (Math.random() < 0.25) {
      await speak({
        kind: 'direct',
        fn: async () => {
          await message.reply(pick(mentionResponses)).catch(() => {});
        }
      });
    }
    return;
  }

  /** 5) Earned ambients only (NO RANDOM): channel wake + milestones + portal signals **/

  // 5a) Channel wake line (earned: inactivity)
  if (!spokeThisMessage && Date.now() - prevHuman >= CHANNEL_WAKE_INACTIVITY_MS) {
    // Only if not lurking (he "wakes")
    if (mood !== MOOD_LURK && channelCooldownOk(ambientChannelCooldowns, chId, AMBIENT_CHANNEL_COOLDOWN_SECONDS)) {
      await speak({
        kind: 'ambient',
        fn: async () => {
          const wakeLines = [
            "👁 …oh. You’re back. The silence was getting ideas.",
            "The channel slept. I counted the breaths between messages.",
            "👁 Waking sequence complete. Try not to startle the pixels.",
            "I watched the quiet pile up. It was… educational."
          ];
          await message.channel.send(pick(wakeLines)).catch(() => {});
        }
      });
    }
  }

  // 5b) Lore tick milestone (earned: every N messages) — only when curious/active
  if (!spokeThisMessage) {
    const newCount = (messageCounter.get(chId) || 0) + 1;
    messageCounter.set(chId, newCount);

    const hitMilestone = newCount % LORE_TICK_EVERY_N_MESSAGES === 0;
    if (
      hitMilestone &&
      mood !== MOOD_LURK &&
      channelCooldownOk(loreTickCooldowns, chId, LORE_TICK_CHANNEL_COOLDOWN_S)
    ) {
      await speak({
        kind: 'ambient',
        fn: async () => {
          const tickLines = [
            `👁 Message #${newCount.toLocaleString()} archived.`,
            `Log updated. Index ${newCount.toLocaleString()} // checksum: OK.`,
            `👁 Ledger ping: ${newCount.toLocaleString()}.`,
            `Counter advanced to ${newCount.toLocaleString()}. The wall approves.`
          ];
          await message.channel.send(pick(tickLines)).catch(() => {});
        }
      });
    }
  }

  // 5c) Portal lines (earned: only when portal signals appear) — only when active
  if (!spokeThisMessage && contentHasPortalSignals(raw)) {
    if (
      mood === MOOD_ACTIVE &&
      channelCooldownOk(portalPotCharmCooldowns, chId, PORTAL_POT_CHARM_COOLDOWN_SECONDS)
    ) {
      await speak({
        kind: 'ambient',
        fn: async () => {
          await message.channel.send(pick(portalPotCharmLines)).catch(() => {});
        }
      });
    }
  }

  // 5d) #general watcher line (earned: only when curious/active AND a milestone)
  if (!spokeThisMessage && chId === GENERAL_CHANNEL_ID) {
    const count = messageCounter.get(chId) || 0;
    // "earned" mini-milestone that isn't too spammy (every 40 msgs)
    if (mood !== MOOD_LURK && count > 0 && count % 40 === 0) {
      if (channelCooldownOk(ambientChannelCooldowns, chId, AMBIENT_CHANNEL_COOLDOWN_SECONDS)) {
        await speak({
          kind: 'ambient',
          fn: async () => {
            await message.channel.send(pick(watcherLoreLines)).catch(() => {});
          }
        });
      }
    }
  }

  // 5e) Small ambient ping (earned: only if there was an attachment OR very long message) — only when curious/active
  if (!spokeThisMessage && mood !== MOOD_LURK) {
    const hasAttachment = (message.attachments && message.attachments.size > 0);
    const isLong = raw.length >= 320;

    if ((hasAttachment || isLong) && channelCooldownOk(ambientChannelCooldowns, chId, AMBIENT_CHANNEL_COOLDOWN_SECONDS)) {
      await speak({
        kind: 'ambient',
        fn: async () => {
          await message.channel.send(pick(ambientMessages)).catch(() => {});
        }
      });
    }
  }

  /** 6) Whisper Replies (kept, but now suppressed by pile-on + guardrail) **/
  if (!spokeThisMessage) {
    if (Math.random() < WHISPER_REPLY_PROB && userCooldownOk(whisperUserCooldowns, message.author.id, WHISPER_USER_COOLDOWN_S)) {
      // Only schedule whispers when curious/active (feels intentional)
      if (mood !== MOOD_LURK && canAmbientSpeak(chId)) {
        const toWhisper = message;
        const timeoutId = setTimeout(async () => {
          try {
            if (!toWhisper?.channel) return;
            // Don't whisper if the bot spoke very recently in that channel (extra guard)
            if (!canAmbientSpeak(chId)) return;

            const whispers = [
              "👁 …noted.",
              "The wall blinked at that sentence.",
              "👁 Keep going. The static is learning your shape.",
              "Logged. Quietly.",
              "👁 That line left a fingerprint."
            ];
            await toWhisper.channel.send(pick(whispers)).catch(() => {});
            markSpoke(chId);
          } finally {
            pendingWhispers.delete(toWhisper.id);
          }
        }, WHISPER_DELAY_MS);
        pendingWhispers.set(message.id, timeoutId);
      }
    }
  }

  /** 7) Random chance to mark user (still rare; treated as ambient + guardrailed) **/
  if (!spokeThisMessage && Math.random() < MARK_RANDOM_PROB) {
    await speak({
      kind: 'ambient',
      fn: async () => {
        await maybeMarkUser(message, 'random');
      }
    });
  }
});

/** --- Cleanup pending whispers if a message gets deleted --- **/
client.on(Events.MessageDelete, (msg) => {
  try {
    const tid = pendingWhispers.get(msg.id);
    if (tid) {
      clearTimeout(tid);
      pendingWhispers.delete(msg.id);
    }
  } catch {}
});

/** --- /squigsay + /insquig --- **/
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // /squigsay
  if (interaction.commandName === 'squigsay') {
    if (!squigCommanders.includes(interaction.user.id)) {
      await interaction.reply({ content: "You’re not Squig-worthy.", ephemeral: true });
      return;
    }

    const messageText = interaction.options.getString('message');
    const image = interaction.options.getAttachment('image');

    await interaction.reply({ content: '👁', ephemeral: true });

    if (image) {
      await interaction.channel.send({ content: messageText, files: [image.url] }).catch(() => {});
    } else {
      await interaction.channel.send({ content: messageText }).catch(() => {});
    }
    return;
  }

  // /insquig help
  if (interaction.commandName === 'insquig') {
    const sub = interaction.options.getSubcommand();
    if (sub === 'help') {
      const topic = interaction.options.getString('topic', true);
      const text = formatHelp(topic);

      // Non-ephemeral, in-channel
      await interaction.reply({ content: text }).catch(() => {});
      return;
    }
  }
});

/** --- Login --- **/
client.login(process.env.SQUIG_TOKEN);
