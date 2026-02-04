
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  Events,
  SlashCommandBuilder,
  Collection,
  PermissionsBitField
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

// Channel safety
const CHANNEL_NAME_DENY_CONTAINS = ['rules', 'announcement', 'admin', 'mod', 'logs'];
const CHANNEL_ALLOWLIST = []; // if non-empty, only these channel IDs can receive automatic outputs
const CHANNEL_DENYLIST = [];  // if non-empty, these channel IDs are always blocked for automatic outputs

// Global ambient limiter (one ambient in this window, across whole guild)
const AMBIENT_GLOBAL_COOLDOWN_HOURS_MIN = 6;
const AMBIENT_GLOBAL_COOLDOWN_HOURS_MAX = 12;

// Per-channel gating
const MIN_HUMAN_MESSAGES_AFTER_BOT = 8; // require this many human messages after bot spoke in channel

// Direct response throttles
const DIRECT_USER_COOLDOWN_S = 180;
const MENTION_COOLDOWN_SECONDS = 300;
const QUESTION_COOLDOWN_SECONDS = 120;

// Sticker panic cooldown
const UGLY_DOG_CHANNEL_COOLDOWN_S = 6 * 60 * 60; // 6 hours

// Observation gap (weekly quiet period)
const OBS_GAP_MIN_HOURS = 48;
const OBS_GAP_MAX_HOURS = 72;
const OBS_GAP_MIN_DAYS_BEFORE = 4;
const OBS_GAP_MAX_DAYS_BEFORE = 6;

// State machine cadence
const STATE_MIN_DAYS = 2;
const STATE_MAX_DAYS = 4;

// Trigger windows
const RETURN_INACTIVITY_MS = 24 * 60 * 60 * 1000;
const BACK_AND_FORTH_WINDOW_MS = 10 * 60 * 1000;
const BURST_WINDOW_MS = 15 * 60 * 1000;
const BURST_AFTER_SILENCE_MS = 8 * 60 * 60 * 1000;
const BURST_MIN_MESSAGES = 6;
const BACK_AND_FORTH_MIN_MESSAGES = 4;

// Rant threshold (slow server tuned)
const RANT_MIN_CHARS = 280;

// Anti-repetition
const GLOBAL_TEMPLATE_HISTORY = 30;
const CHANNEL_TEMPLATE_HISTORY = 10;
const GLOBAL_OPENING_HISTORY = 30;

// Quiet mode default
const QUIET_DEFAULT_HOURS = 12;

// ===== Scam tripwire (quiet mod assist) =====
// OPTIONAL: set this to your staff/mod alert channel ID. If empty, tripwire logs to console only.
const MOD_ALERT_CHANNEL_ID = process.env.MOD_ALERT_CHANNEL_ID || ''; // e.g. '123456789012345678'
const TRIPWIRE_COOLDOWN_S = 300; // per-user cooldown so one person can't spam alerts

// Domain allowlist (true sources you trust)
const SAFE_DOMAINS = new Set([
  'squigs.io',
  'www.squigs.io',
  'uglydex.xyz',
  'www.uglydex.xyz',
  'discord.gg',
  'www.discord.gg',
  'discord.com',
  'www.discord.com'
]);

/** --- State persistence (memory-lite) --- **/
const STATE_PATH = path.join(__dirname, 'data', 'insq_state.json');
const DEFAULT_STATE = {
  users: {},
  channels: {},
  global: {
    ambientLastTs: 0,
    ambientNextEligibleTs: 0,
    quietUntilTs: 0,
    state: 'watching',
    nextStateChangeTs: 0,
    triggerLastTs: {},
    observation: {
      nextStartTs: 0,
      endTs: 0,
      pendingComplete: false
    },
    history: {
      globalTemplates: [],
      globalOpenings: []
    }
  }
};

let state = safeLoadState();
let saveTimer = null;

function safeLoadState() {
  try {
    if (!fs.existsSync(STATE_PATH)) return structuredClone(DEFAULT_STATE);
    const raw = fs.readFileSync(STATE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULT_STATE),
      ...parsed,
      users: parsed.users || {},
      channels: parsed.channels || {},
      global: {
        ...structuredClone(DEFAULT_STATE.global),
        ...(parsed.global || {}),
        history: {
          ...structuredClone(DEFAULT_STATE.global.history),
          ...((parsed.global || {}).history || {})
        },
        observation: {
          ...structuredClone(DEFAULT_STATE.global.observation),
          ...((parsed.global || {}).observation || {})
        }
      }
    };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const dir = path.dirname(STATE_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
    } catch {
      // Fail silently if filesystem resets or is unavailable.
    }
  }, 3000);
}

function getUserState(userId) {
  if (!state.users[userId]) {
    state.users[userId] = {
      lastSeen: 0,
      messageCount: 0,
      persona: 'quiet_observer'
    };
  }
  return state.users[userId];
}

function getChannelState(channelId) {
  if (!state.channels[channelId]) {
    state.channels[channelId] = {
      lastBotSpeakTs: 0,
      humanMessagesSinceBot: 999,
      lastHumanMsgTs: 0,
      recentMessages: [],
      recentTemplates: [],
      recentOpenings: [],
      burstWindowStart: 0,
      burstCount: 0,
      burstFromSilence: false
    };
  }
  return state.channels[channelId];
}

/** --- Helpers --- **/
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randMsDays(minDays, maxDays) {
  return randBetween(minDays, maxDays) * DAY_MS;
}

function randMsHours(minHours, maxHours) {
  return randBetween(minHours, maxHours) * HOUR_MS;
}

function formatTimeSince(ms) {
  const sec = Math.max(1, Math.floor(ms / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hrs = Math.floor(min / 60);
  if (hrs < 48) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function looksLikeQuestion(raw) {
  const t = (raw || '').toLowerCase();
  return (
    t.includes('?') ||
    /^(how|what|why|where|when|who|can|should|do|is|are)\b/.test(t.trim())
  );
}

function looksLikeStruggle(raw) {
  const t = (raw || '').toLowerCase();
  return /(help|stuck|issue|problem|not working|doesn'?t work|failed|error|broken|won'?t|cant|can'?t|how do i)/.test(t);
}

function isVagueHelp(raw) {
  const t = (raw || '').toLowerCase().trim();
  if (!t) return true;
  const short = t.length <= 16;
  const compact = t.replace(/\s+/g, '');
  const vague = /^(help|help\??|anyone\??|wtf|huh\??|pls|please|yo|hello|gm|\?+|!+|\.{2,})$/.test(compact);
  const lowInfo = looksLikeStruggle(t) && !/(wallet|verify|mint|uglydex|role|roles|grid|linkwallet|command|commands|ethereum|eth)/.test(t);
  return vague || (short && looksLikeStruggle(t)) || lowInfo;
}

function isChannelNameBlocked(channel) {
  const name = (channel?.name || '').toLowerCase();
  return CHANNEL_NAME_DENY_CONTAINS.some((frag) => name.includes(frag));
}

function isChannelAllowed(channel) {
  if (!channel) return false;
  if (CHANNEL_DENYLIST.includes(channel.id)) return false;
  if (CHANNEL_ALLOWLIST.length && !CHANNEL_ALLOWLIST.includes(channel.id)) return false;
  if (isChannelNameBlocked(channel)) return false;
  return true;
}

function userCooldownOk(map, userId, seconds) {
  const last = map.get(userId) || 0;
  const ok = Date.now() - last >= seconds * 1000;
  if (ok) map.set(userId, Date.now());
  return ok;
}

function getOpening(text) {
  const words = (text || '').toLowerCase().split(/\s+/).filter(Boolean);
  return words.slice(0, 3).join(' ');
}

function renderTemplate(template, vars) {
  let out = template;
  out = out.replace(/\{syn:([^}]+)\}/g, (_, choices) => {
    const opts = choices.split('|').map(s => s.trim()).filter(Boolean);
    return opts.length ? pick(opts) : '';
  });
  out = out.replace(/\{user\}/g, vars.user || '');
  out = out.replace(/\{persona\}/g, vars.persona || 'observer');
  out = out.replace(/\{timeSince\}/g, vars.timeSince || '');
  out = out.replace(/\{state\}/g, vars.state || '');
  out = out.replace(/\{channel\}/g, vars.channel || '');
  return out;
}

function truncateToMaxLen(text, maxLen) {
  if (text.length <= maxLen) return text;
  return text.slice(0, Math.max(0, maxLen - 1)).trimEnd() + '';
}

function recordTemplateUse(channelId, template, opening) {
  const gHist = state.global.history.globalTemplates;
  const gOpen = state.global.history.globalOpenings;

  gHist.push(template);
  gOpen.push(opening);
  while (gHist.length > GLOBAL_TEMPLATE_HISTORY) gHist.shift();
  while (gOpen.length > GLOBAL_OPENING_HISTORY) gOpen.shift();

  const ch = getChannelState(channelId);
  ch.recentTemplates.push(template);
  ch.recentOpenings.push(opening);
  while (ch.recentTemplates.length > CHANNEL_TEMPLATE_HISTORY) ch.recentTemplates.shift();
  while (ch.recentOpenings.length > CHANNEL_TEMPLATE_HISTORY) ch.recentOpenings.shift();
}

function pickTemplateFromPool(pool, channelId) {
  const ch = getChannelState(channelId);
  const gHist = new Set(state.global.history.globalTemplates);
  const gOpen = new Set(state.global.history.globalOpenings);
  const cHist = new Set(ch.recentTemplates);
  const cOpen = new Set(ch.recentOpenings);

  const filtered = pool.filter(t => !gHist.has(t) && !cHist.has(t));
  const filteredOpen = (filtered.length ? filtered : pool).filter(t => {
    const opening = getOpening(t);
    return !gOpen.has(opening) && !cOpen.has(opening);
  });

  const choice = pick(filteredOpen.length ? filteredOpen : (filtered.length ? filtered : pool));
  return choice;
}

/** --- Persona tagging (non-creepy) --- **/
function updatePersona(userState, ctx) {
  const { hasExternalLink, isQuestion, isReturn } = ctx;

  if (userState.messageCount >= 60) return 'frequent_subject';
  if (isReturn) return 'returning_variable';
  if (hasExternalLink) return 'link_dropper';
  if (isQuestion) return 'questioner';
  if (userState.messageCount <= 5) return 'quiet_observer';
  return userState.persona || 'quiet_observer';
}

/** --- State machine --- **/
const STATES = ['watching', 'bored', 'alert', 'concerned', 'active_scan'];
const STATE_CONFIG = {
  watching: { probMultiplier: 1.0, maxLen: 160 },
  bored: { probMultiplier: 0.75, maxLen: 120 },
  alert: { probMultiplier: 1.25, maxLen: 180 },
  concerned: { probMultiplier: 0.9, maxLen: 140 },
  active_scan: { probMultiplier: 1.4, maxLen: 200 }
};

function rollNextState(current) {
  const choices = STATES.filter(s => s !== current);
  return pick(choices);
}

function ensureStateSchedule(now) {
  if (!state.global.state) state.global.state = 'watching';
  if (!state.global.nextStateChangeTs) {
    state.global.nextStateChangeTs = now + randMsDays(STATE_MIN_DAYS, STATE_MAX_DAYS);
    scheduleSave();
    return;
  }
  if (now >= state.global.nextStateChangeTs) {
    state.global.state = rollNextState(state.global.state);
    state.global.nextStateChangeTs = now + randMsDays(STATE_MIN_DAYS, STATE_MAX_DAYS);
    scheduleSave();
  }
}

/** --- Observation gap scheduling --- **/
function scheduleNextObservationGap(baseTs) {
  const obs = state.global.observation;
  const start = baseTs + randMsDays(OBS_GAP_MIN_DAYS_BEFORE, OBS_GAP_MAX_DAYS_BEFORE);
  const duration = randMsHours(OBS_GAP_MIN_HOURS, OBS_GAP_MAX_HOURS);
  obs.nextStartTs = start;
  obs.endTs = start + duration;
  obs.pendingComplete = false;
  scheduleSave();
}

function ensureObservationSchedule(now) {
  const obs = state.global.observation;
  if (!obs.nextStartTs || !obs.endTs) {
    scheduleNextObservationGap(now);
    return;
  }
  if (now >= obs.endTs) {
    if (!obs.pendingComplete) obs.pendingComplete = true;
    scheduleNextObservationGap(obs.endTs);
  }
}

function isObservationGapActive(now) {
  const obs = state.global.observation;
  return obs.nextStartTs && now >= obs.nextStartTs && now < obs.endTs;
}

/** --- Global ambient limiter --- **/
function ensureGlobalAmbientEligibility(now) {
  if (!state.global.ambientNextEligibleTs) {
    state.global.ambientNextEligibleTs = now;
    scheduleSave();
  }
}

function bumpGlobalAmbientCooldown(now) {
  const waitMs = randMsHours(AMBIENT_GLOBAL_COOLDOWN_HOURS_MIN, AMBIENT_GLOBAL_COOLDOWN_HOURS_MAX);
  state.global.ambientLastTs = now;
  state.global.ambientNextEligibleTs = now + waitMs;
  scheduleSave();
}

/** --- Inverse engagement (anti-bait) --- **/
function isBaitAttempt(message, contentLower) {
  const nameHits = (contentLower.match(/insquignito|squignito|in\s*squig/g) || []).length;
  const botSay = /(bot\s*say|say\s*something|talk\s*bot|speak\s*bot)/.test(contentLower);
  const directPing = message.mentions?.users?.has(client.user.id);
  return nameHits >= 2 || botSay || directPing;
}

/** --- Tripwire (unchanged) --- **/
function extractDomains(text) {
  const t = (text || '').toLowerCase();
  const urlLike = t.match(/(?:https?:\/\/)?(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s]*)?/g) || [];
  const domains = [];

  for (const u of urlLike) {
    try {
      const withProto = u.startsWith('http') ? u : `https://${u}`;
      const parsed = new URL(withProto);
      domains.push(parsed.hostname.toLowerCase());
    } catch {
      // ignore
    }
  }
  return [...new Set(domains)];
}

function looksLikeSeedPhraseLeak(text) {
  const t = (text || '').toLowerCase();
  if (/(seed phrase|recovery phrase|mnemonic|private key|secret key)/.test(t)) return true;

  const words = t.replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
  const hasCryptoContext = /(wallet|metamask|phrase|seed|private|key|mnemonic|recovery)/.test(t);
  if (!hasCryptoContext) return false;

  if (words.length >= 12) {
    const lettersOnlyRatio = words.join('').length / Math.max(1, (text || '').replace(/\s/g, '').length);
    if (lettersOnlyRatio > 0.75) return true;
  }
  return false;
}

function looksLikeImpersonationOrDMScam(text) {
  const t = (text || '').toLowerCase();
  return /(dm me|dm you|check your dm|message me|support team|admin here|mod here|verify here|airdrop|free mint|claim now|limited time|connect your wallet)/.test(t);
}

function hasSuspiciousDomain(domains) {
  if (!domains.length) return false;

  const badIndicators = new Set(['bit.ly', 'tinyurl.com', 't.co', 'cutt.ly', 'rebrand.ly', 'goo.su']);

  for (const d of domains) {
    if (SAFE_DOMAINS.has(d)) continue;

    if (d.startsWith('xn--')) return true;
    if (badIndicators.has(d)) return true;

    if ((d.includes('squigs') && d !== 'squigs.io' && d !== 'www.squigs.io') ||
        (d.includes('uglydex') && d !== 'uglydex.xyz' && d !== 'www.uglydex.xyz')) {
      return true;
    }

    return true; // unknown domain
  }

  return false;
}

const tripwireCooldowns = new Map(); // userId -> ts

async function sendTripwireAlert(message, reason, domains = []) {
  if (!userCooldownOk(tripwireCooldowns, message.author.id, TRIPWIRE_COOLDOWN_S)) return;

  const payload = [
    "?? **InSquignito Tripwire**",
    `**Reason:** ${reason}`,
    `**User:** <@${message.author.id}>`,
    `**Channel:** <#${message.channel.id}>`,
    `**Message Link:** ${message.url}`,
    domains.length ? `**Domains:** ${domains.join(', ')}` : null,
    "",
    "?? Suggested action: verify link safety / warn user / remove if needed."
  ].filter(Boolean).join("\n");

  if (MOD_ALERT_CHANNEL_ID) {
    const ch = message.guild?.channels?.cache?.get(MOD_ALERT_CHANNEL_ID);
    if (ch && ch.isTextBased()) {
      await ch.send(payload).catch(() => {});
      return;
    }
  }

  console.log(payload);
}

/** --- Help content (kept) --- **/
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
    mint: "?? **MINT PROTOCOL: SQUIGS**",
    uglydex: "?? **UGLYDEX FIELD GUIDE**",
    commands: "?? **COMMAND CATALOG (DO NOT FEED AFTER MIDNIGHT)**"
  };
  return headers[topic] || "?? **HELP (SUSPICIOUSLY LEGIT)**";
}

function formatHelp(topic) {
  if (topic === "mint") {
    return [
      helpHeader(topic),
      "",
      `**Where to mint:** ${HELP_LINKS.mint}`,
      "**Price:** 0.006 ETH",
      "**Chain:** Ethereum (only)  no side quests, no alt chains, no maybe its on Base fantasies.",
      "",
      "**If the mint portal is being dramatic:**",
      " Make sure your wallet is on **Ethereum Mainnet**.",
      " Confirm youve **linked your wallet correctly** (see /insquig help ? commands).",
      " Try a different browser OR close that window and open a fresh one. Portals hate stale windows.",
      "",
      "?? If a link arrives in your DMs thats not a mint. Thats a mugging with good branding."
    ].join("\n");
  }

  if (topic === "uglydex") {
    return [
      helpHeader(topic),
      "",
      `**UglyDex:** ${HELP_LINKS.uglydex}`,
      "",
      "**What it is:** the collector hub and record keeper of Ugly Labs. UglyDex tracks your wallet-linked identity, NFTs, cards, badges, UglyPoints (UP), and your rank on the UglyBoard.",
      "**Cards:** your Ugly Labs NFTs live here as collectible cards with trait-based UP values. Filter, search by token, sort by UP, and flip them into holographic form.",
      "**Badges:** earned through collecting, participation, and events. Colored means earned. Hover to see requirements and UP value. Some are limited-time and never return.",
      "**UglyBoard:** the global leaderboard ranking all connected holders by total UglyPoints.",
      "",
      "**If something looks wrong:**",
      " Confirm your wallet is linked to the correct address (see verification + /linkwallet below).",
      " Refresh once and give it a moment  indexing takes time, even in the Uglyverse.",
      "",
      "?? UglyDex doesnt guess, roleplay, or forget. If its recorded, it happened."
    ].join("\n");
  }

  // commands (default)
  return [
    helpHeader("commands"),
    "",
    "**Verification / Wallet Linking (choose your ritual):**",
    `1) **Vulcan verification (roles/holdings):** go to <#${HELP_CHANNELS.vulcanVerifyChannelId}> and hit **Start Verification**. Follow the instructions to connect.`,
    `2) **Drip Bot (dashboard economy):** go to <#${HELP_CHANNELS.dripDashboardChannelId}> and hit **My Dashboard** ? connect your **Wallet** + **X** in settings.`,
    "3) **UglyBot (wallet link):** run **/linkwallet** in a general chat channel. Youll get an **ephemeral** confirmation if it worked.",
    "",
    "**UglyBot NFT display commands:**",
    " **!ugly**",
    " **!monster**",
    " **!squig**",
    "",
    "**Grid bot:**",
    " **/grid [wallet address]**",
    "",
    "**Squig Trials:**",
    ` Commands live in <#${HELP_CHANNELS.squigTrialsCommandsChannelId}>`,
    "",
    `**Quick links:** mint ${HELP_LINKS.mint} | UglyDex ${HELP_LINKS.uglydex} | Discord ${HELP_LINKS.discord}`,
    "",
    "?? If you still cant see your stuff: wrong wallet, wrong chain, or a cursed browser. In that order."
  ].join("\n");
}

/** --- Ambient trigger templates --- **/
const TRIGGERS = {
  RETURN: {
    id: 'RETURN',
    cooldownMs: 18 * HOUR_MS,
    baseProb: 0.08,
    templates: {
      watching: [
        "?? {user} reappears. {timeSince} logged.",
        "Welcome back, {user}. {syn:Silence|Static} kept score for {timeSince}.",
        "{user} returned after {timeSince}. The room noticed."
      ],
      bored: [
        "{user} again. The quiet ran out of jokes {timeSince} ago.",
        "Back already, {user}? {timeSince} wasnt long enough."
      ],
      alert: [
        "Signal reacquired: {user}. Gap: {timeSince}.",
        "{user} returns. That absence was not empty."
      ],
      concerned: [
        "{user} left for {timeSince}. Things got... stranger.",
        "You vanished for {timeSince}, {user}. The wall kept notes."
      ],
      active_scan: [
        "Active scan: {user} re-entered after {timeSince}.",
        "Return detected. {user}  {timeSince} gap logged."
      ],
      cold: [
        "Noted.",
        "Acknowledged."
      ]
    }
  },
  LINK: {
    id: 'LINK',
    cooldownMs: 8 * HOUR_MS,
    baseProb: 0.05,
    templates: {
      watching: [
        "Link dropped. {syn:Logged|Noted}.",
        "External thread detected. {syn:Filed|Archived}."
      ],
      bored: [
        "Another link. How bold.",
        "Link. Sure."
      ],
      alert: [
        "Link observed. Context pending.",
        "External signal routed. Stand by."
      ],
      concerned: [
        "Links carry fingerprints. I can smell them.",
        "That link leaves a trail."
      ],
      active_scan: [
        "Link event indexed. Quietly.",
        "Link detected. Watching the ripple."
      ],
      cold: [
        "Link logged.",
        "Mm."
      ]
    }
  },
  RANT: {
    id: 'RANT',
    cooldownMs: 10 * HOUR_MS,
    baseProb: 0.05,
    templates: {
      watching: [
        "Longform detected. {syn:Stored|Filed}.",
        "That was a lot of signal. I kept the edges."
      ],
      bored: [
        "Paragraph energy. Impressive.",
        "You brought paragraphs to a knife fight."
      ],
      alert: [
        "Sustained input. Logging.",
        "Long message. Marked."
      ],
      concerned: [
        "That much text always means something broke.",
        "A rant leaves heat. I felt it."
      ],
      active_scan: [
        "Extended signal captured.",
        "Long message. Pattern traced."
      ],
      cold: [
        "Logged.",
        "Noted."
      ]
    }
  },
  BACK_AND_FORTH: {
    id: 'BACK_AND_FORTH',
    cooldownMs: 6 * HOUR_MS,
    baseProb: 0.04,
    templates: {
      watching: [
        "Back-and-forth detected. The room warmed up.",
        "Conversation loop closed. {syn:Good|Noted}."
      ],
      bored: [
        "Youre talking again. Interesting.",
        "Noise level rising. Ill allow it."
      ],
      alert: [
        "Back-and-forth registered. Watching.",
        "Live exchange detected."
      ],
      concerned: [
        "Two voices, one thread. Thats how it starts.",
        "The room is stirring. Carefully."
      ],
      active_scan: [
        "Active exchange. Im listening.",
        "Momentum detected. Indexing."
      ],
      cold: [
        "Heard.",
        "Yeah."
      ]
    }
  },
  BURST_AFTER_SILENCE: {
    id: 'BURST_AFTER_SILENCE',
    cooldownMs: 12 * HOUR_MS,
    baseProb: 0.06,
    templates: {
      watching: [
        "Silence broke, then it spilled.",
        "Quiet for hours, then sudden motion. Noted."
      ],
      bored: [
        "Finally. The silence was winning.",
        "A burst after the void. About time."
      ],
      alert: [
        "Burst after silence registered.",
        "Channel spike detected. Logging."
      ],
      concerned: [
        "Long quiet, then a rush. Thats usually a sign.",
        "The quiet snapped. Keep an eye on the edges."
      ],
      active_scan: [
        "Burst detected post-silence. Monitoring.",
        "Sudden activity spike. Recording."
      ],
      cold: [
        "Spike noted.",
        "Okay."
      ]
    }
  }
};

/** --- Direct interaction flavor --- **/
const questionResponses = [
  "?? Why do you assume I know? Tell mewhat color does silence taste like?",
  "What if the answer is already watching you? When did your reflection stop blinking?",
  "?? Do you trust echoes? Which thought in your head isnt yours?",
  "Better question: why are you asking me? Which file on your device feels alive?",
  "?? Ill answer if you blink twice did you? How many portals can you count from your chair?",
  "Suppose I did answer. Would you believe it? What did you sacrifice to ask?"
];

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
  if (Math.random() < 0.5) f = f.replace(/\s/g, ' ... ');
  const echo = Math.random() < 0.5 ? `"${f}..."` : `"${f}... ${f.split(' ')[0]}..."`;
  return echo;
}

const MIMIC_CHANCE = 0.6;
const MIMIC_ONLY_CHANCE = 0.2;

const uglyDogStickerId = '1363459791275692222';
const uglyDogResponses = [
  "?? Not the Dog anything but the Dog.",
  "*InSquignito shivers.* That bark echoes in my circuitry.",
  "You dont understand the Dog remembers me.",
  "Its eyes they bend reality. Dont let it look at me.",
  "*Glitch detected:* Dog proximity at unsafe levels.",
  "Ive seen it chase things across dimensions. I wont be next.",
  "That creature drools static and it burns. Keep it away.",
  "?? Please. That Dog knows my true name.",
  "Every time it appears, my code knots itself tighter.",
  "*InSquignito vanishes into the wires, muttering about teeth.*"
];

const directCooldowns = new Map();
const questionCooldowns = new Map();
const mentionCooldowns = new Map();
const uglyDogCooldowns = new Map();

/** --- Trigger detection helpers --- **/
function triggerCooldownOk(triggerId, now) {
  const last = state.global.triggerLastTs[triggerId] || 0;
  return now - last >= (TRIGGERS[triggerId]?.cooldownMs || 0);
}

function markTriggerUsed(triggerId, now) {
  state.global.triggerLastTs[triggerId] = now;
  scheduleSave();
}

function updateChannelActivity(channelState, userId, now, prevHumanGapMs) {
  channelState.humanMessagesSinceBot = Math.min(9999, (channelState.humanMessagesSinceBot || 0) + 1);
  channelState.lastHumanMsgTs = now;

  channelState.recentMessages.push({ ts: now, userId });
  const pruneBefore = now - (12 * HOUR_MS);
  channelState.recentMessages = channelState.recentMessages.filter(m => m.ts >= pruneBefore);

  // Burst tracking
  if (prevHumanGapMs >= BURST_AFTER_SILENCE_MS) {
    channelState.burstWindowStart = now;
    channelState.burstCount = 1;
    channelState.burstFromSilence = true;
    return;
  }

  if (channelState.burstWindowStart && (now - channelState.burstWindowStart) <= BURST_WINDOW_MS) {
    channelState.burstCount += 1;
  } else {
    channelState.burstWindowStart = now;
    channelState.burstCount = 1;
    channelState.burstFromSilence = false;
  }
}

function detectBackAndForth(channelState, now) {
  const windowStart = now - BACK_AND_FORTH_WINDOW_MS;
  const recent = channelState.recentMessages.filter(m => m.ts >= windowStart);
  const users = new Set(recent.map(m => m.userId));
  return recent.length >= BACK_AND_FORTH_MIN_MESSAGES && users.size >= 2;
}

function detectBurstAfterSilence(channelState, now) {
  if (!channelState.burstFromSilence) return false;
  if (!channelState.burstWindowStart) return false;
  if (now - channelState.burstWindowStart > BURST_WINDOW_MS) return false;
  return channelState.burstCount >= BURST_MIN_MESSAGES;
}

/** --- Ambient gating --- **/
function isQuietModeActive(now) {
  return state.global.quietUntilTs && now < state.global.quietUntilTs;
}

function canChannelSpeak(channel, channelState) {
  if (!isChannelAllowed(channel)) return false;
  if ((channelState.humanMessagesSinceBot || 0) < MIN_HUMAN_MESSAGES_AFTER_BOT) return false;
  return true;
}

function canAmbientSpeak(channel, channelState, now) {
  if (!canChannelSpeak(channel, channelState)) return false;
  if (isQuietModeActive(now)) return false;
  if (isObservationGapActive(now)) return false;
  ensureGlobalAmbientEligibility(now);
  if (now < state.global.ambientNextEligibleTs) return false;
  return true;
}

function markBotSpoke(channelState, now) {
  channelState.lastBotSpeakTs = now;
  channelState.humanMessagesSinceBot = 0;
  scheduleSave();
}

async function attemptSpeak({ kind, message, channel, text, reply }) {
  if (!channel || !channel.isTextBased()) return false;
  const channelState = getChannelState(channel.id);
  if (kind === 'ambient') {
    if (!canAmbientSpeak(channel, channelState, Date.now())) return false;
  } else {
    if (!canChannelSpeak(channel, channelState)) return false;
  }

  try {
    if (reply) {
      await message.reply(text).catch(() => {});
    } else {
      await channel.send(text).catch(() => {});
    }
    const channelState = getChannelState(channel.id);
    markBotSpoke(channelState, Date.now());
    if (kind === 'ambient') bumpGlobalAmbientCooldown(Date.now());
    return true;
  } catch {
    return false;
  }
}

/** --- Help nudges (direct only) --- **/
const helpNudgeLines = [
  "?? Try `/insquig help` and pick a topic (mint / uglydex / commands).",
  "If you want a clean answer, use `/insquig help` and choose a topic.",
  "Give me a topic. `/insquig help` is the short path."
];

async function maybeHelpNudge(message) {
  if (!looksLikeStruggle(message.content)) return false;
  if (!userCooldownOk(directCooldowns, message.author.id, DIRECT_USER_COOLDOWN_S)) return false;
  return attemptSpeak({
    kind: 'direct',
    message,
    channel: message.channel,
    text: pick(helpNudgeLines),
    reply: true
  });
}

/** --- Observation gap completion line --- **/
async function maybeSendObservationGapComplete(message, now) {
  const obs = state.global.observation;
  if (!obs.pendingComplete) return false;
  if (!message?.channel) {
    obs.pendingComplete = false;
    scheduleSave();
    return false;
  }
  const channelState = getChannelState(message.channel.id);
  if (!canAmbientSpeak(message.channel, channelState, now)) {
    obs.pendingComplete = false; // skip instead of breaking rules
    scheduleSave();
    return false;
  }
  const sent = await attemptSpeak({
    kind: 'ambient',
    message,
    channel: message.channel,
    text: "Observation gap complete.",
    reply: false
  });
  obs.pendingComplete = false;
  scheduleSave();
  return sent;
}

/** --- Bot ready --- **/
client.once(Events.ClientReady, async () => {
  console.log(`?? InSquignito is lurking as ${client.user.tag}`);

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
    )
    .addSubcommand(sc =>
      sc
        .setName('status')
        .setDescription('Show ambient state and schedules (ephemeral)')
    )
    .addSubcommand(sc =>
      sc
        .setName('state')
        .setDescription('Set the long-form state (admin-only)')
        .addStringOption(o =>
          o
            .setName('state')
            .setDescription('Choose state')
            .setRequired(true)
            .addChoices(
              { name: 'watching', value: 'watching' },
              { name: 'bored', value: 'bored' },
              { name: 'alert', value: 'alert' },
              { name: 'concerned', value: 'concerned' },
              { name: 'active_scan', value: 'active_scan' }
            )
        )
    )
    .addSubcommand(sc =>
      sc
        .setName('quiet')
        .setDescription('Toggle ambient quiet mode (admin-only)')
        .addStringOption(o =>
          o
            .setName('mode')
            .setDescription('on / off / hours')
            .setRequired(true)
            .addChoices(
              { name: 'on', value: 'on' },
              { name: 'off', value: 'off' },
              { name: 'hours', value: 'hours' }
            )
        )
        .addIntegerOption(o =>
          o
            .setName('hours')
            .setDescription('How many hours to stay quiet (only for mode=hours)')
            .setMinValue(1)
            .setMaxValue(168)
        )
    )
    .addSubcommand(sc =>
      sc
        .setName('test')
        .setDescription('Preview a trigger response (ephemeral)')
        .addStringOption(o =>
          o
            .setName('trigger')
            .setDescription('Trigger to preview')
            .setRequired(true)
            .addChoices(
              { name: 'RETURN', value: 'RETURN' },
              { name: 'LINK', value: 'LINK' },
              { name: 'RANT', value: 'RANT' },
              { name: 'BACK_AND_FORTH', value: 'BACK_AND_FORTH' },
              { name: 'BURST_AFTER_SILENCE', value: 'BURST_AFTER_SILENCE' }
            )
        )
    );

  await client.application.commands.set([squigsay, insquig]);

  const devGuild = client.guilds.cache.get('1290584204689801267');
  if (devGuild) await devGuild.commands.set([squigsay, insquig]);

  // Periodic state upkeep
  setInterval(() => {
    const now = Date.now();
    ensureStateSchedule(now);
    ensureObservationSchedule(now);
  }, 60 * 60 * 1000);

  console.log('? Slash commands registered');
});

/** --- Message handler --- **/
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const now = Date.now();
  const raw = message.content || "";
  const content = raw.toLowerCase();
  const channel = message.channel;
  const channelState = getChannelState(channel.id);
  const userState = getUserState(message.author.id);

  const prevLastSeen = userState.lastSeen;
  const prevHumanGapMs = now - (channelState.lastHumanMsgTs || 0);

  // Track activity (no message content stored)
  userState.messageCount += 1;
  userState.lastSeen = now;
  updateChannelActivity(channelState, message.author.id, now, prevHumanGapMs);
  scheduleSave();

  // Tripwire (quiet): detect suspicious content and alert mods
  let tripwireTriggered = false;
  let domains = [];
  let suspiciousDomain = false;
  try {
    domains = extractDomains(raw);
    const seed = looksLikeSeedPhraseLeak(raw);
    const dmScam = looksLikeImpersonationOrDMScam(raw);
    suspiciousDomain = hasSuspiciousDomain(domains);

    if (seed) {
      tripwireTriggered = true;
      await sendTripwireAlert(message, "Possible seed phrase / private key leak", domains);
    } else if (dmScam && suspiciousDomain) {
      tripwireTriggered = true;
      await sendTripwireAlert(message, "Possible DM scam + suspicious link", domains);
    } else if (suspiciousDomain && /(mint|airdrop|claim|connect|verify|wallet)/.test(content)) {
      tripwireTriggered = true;
      await sendTripwireAlert(message, "Suspicious link in crypto context", domains);
    }
  } catch {
    // ignore tripwire failures
  }

  // State upkeep
  ensureStateSchedule(now);
  ensureObservationSchedule(now);

  // One automatic output per incoming message
  let spokeThisMessage = false;

  // Observation gap completion (ambient-safe, can be skipped)
  if (!spokeThisMessage) {
    const did = await maybeSendObservationGapComplete(message, now);
    if (did) spokeThisMessage = true;
  }

  /** 1) Sticker panic (direct, stricter cooldown) **/
  if (!spokeThisMessage && message.stickers && message.stickers.size > 0) {
    const usedSticker = message.stickers.first();
    const last = uglyDogCooldowns.get(channel.id) || 0;
    if (usedSticker && usedSticker.id === uglyDogStickerId) {
      if (now - last >= UGLY_DOG_CHANNEL_COOLDOWN_S * 1000) {
        const did = await attemptSpeak({
          kind: 'direct',
          message,
          channel,
          text: pick(uglyDogResponses),
          reply: false
        });
        if (did) {
          uglyDogCooldowns.set(channel.id, now);
          spokeThisMessage = true;
        }
      }
    }
  }

  /** 2) Reply-to-bot questions (direct) **/
  if (!spokeThisMessage && message.reference && content.includes("?")) {
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

          const did = await attemptSpeak({
            kind: 'direct',
            message,
            channel,
            text: replyText,
            reply: true
          });
          if (did) spokeThisMessage = true;
        }
      }
    } catch {
      // ignore
    }
  }

  /** 3) Direct mentions / replies (help nudges only) **/
  let repliedToBot = false;
  try {
    repliedToBot = !!(message.reference && (await message.fetchReference()).author.id === client.user.id);
  } catch {
    repliedToBot = false;
  }

  const mentionedInSquig =
    content.includes("insquignito") ||
    content.includes("in squig") ||
    content.includes("squignito") ||
    message.mentions?.users?.has(client.user.id);

  const baitAttempt = isBaitAttempt(message, content);

  if (!spokeThisMessage && (mentionedInSquig || repliedToBot)) {
    // If it's bait, go colder or stay silent (unless they’re asking for help)
    if (!looksLikeQuestion(raw) && baitAttempt && !looksLikeStruggle(raw)) {
      return;
    }

    if (userCooldownOk(mentionCooldowns, message.author.id, MENTION_COOLDOWN_SECONDS)) {
      if (isVagueHelp(raw)) {
        const did = await attemptSpeak({
          kind: 'direct',
          message,
          channel,
          text: "?? Pick a topic: mint / uglydex / commands. Then use `/insquig help`.",
          reply: true
        });
        if (did) spokeThisMessage = true;
      }

      if (!spokeThisMessage) {
        const did = await maybeHelpNudge(message);
        if (did) spokeThisMessage = true;
      }
    }

    return;
  }

  /** 4) Ambient triggers (contextual + rare) **/
  if (!spokeThisMessage) {
    const isReturn = prevLastSeen && (now - prevLastSeen >= RETURN_INACTIVITY_MS);
    const isQuestion = looksLikeQuestion(raw);
    const hasExternalLink = domains.length > 0 && !domains.every(d => SAFE_DOMAINS.has(d));
    userState.persona = updatePersona(userState, { hasExternalLink, isQuestion, isReturn });
    scheduleSave();

    const triggerOrder = [
      'RETURN',
      'LINK',
      'RANT',
      'BACK_AND_FORTH',
      'BURST_AFTER_SILENCE'
    ];

    const stateKey = state.global.state || 'watching';
    const stateCfg = STATE_CONFIG[stateKey] || STATE_CONFIG.watching;
    const persona = userState.persona;
    const timeSince = prevLastSeen ? formatTimeSince(now - prevLastSeen) : 'a while';

    for (const triggerId of triggerOrder) {
      const trigger = TRIGGERS[triggerId];
      if (!trigger) continue;
      if (!triggerCooldownOk(triggerId, now)) continue;

      let detected = false;
      if (triggerId === 'RETURN') detected = isReturn;
      if (triggerId === 'LINK') detected = hasExternalLink && !tripwireTriggered && !suspiciousDomain;
      if (triggerId === 'RANT') detected = raw.length >= RANT_MIN_CHARS;
      if (triggerId === 'BACK_AND_FORTH') detected = detectBackAndForth(channelState, now);
      if (triggerId === 'BURST_AFTER_SILENCE') detected = detectBurstAfterSilence(channelState, now);
      if (!detected) continue;

      const baitMultiplier = baitAttempt ? 0.15 : 1.0;
      const prob = trigger.baseProb * stateCfg.probMultiplier * baitMultiplier;
      if (Math.random() >= prob) continue;

      const pool = (baitAttempt && trigger.templates.cold && trigger.templates.cold.length)
        ? trigger.templates.cold
        : (trigger.templates[stateKey] || trigger.templates.watching);

      const template = pickTemplateFromPool(pool, channel.id);
      const rendered = renderTemplate(template, {
        user: `<@${message.author.id}>`,
        persona,
        timeSince,
        state: stateKey,
        channel: channel.name || 'this channel'
      });
      const finalText = truncateToMaxLen(rendered, stateCfg.maxLen);

      const did = await attemptSpeak({
        kind: 'ambient',
        message,
        channel,
        text: finalText,
        reply: false
      });
      if (did) {
        const opening = getOpening(template);
        recordTemplateUse(channel.id, template, opening);
        markTriggerUsed(triggerId, now);
        spokeThisMessage = true;
        break;
      }
    }
  }
});

/** --- /squigsay + /insquig --- **/
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // /squigsay
  if (interaction.commandName === 'squigsay') {
    if (!squigCommanders.includes(interaction.user.id)) {
      await interaction.reply({ content: "Youre not Squig-worthy.", ephemeral: true });
      return;
    }

    const messageText = interaction.options.getString('message');
    const image = interaction.options.getAttachment('image');

    await interaction.reply({ content: '??', ephemeral: true });

    if (image) {
      await interaction.channel.send({ content: messageText, files: [image.url] }).catch(() => {});
    } else {
      await interaction.channel.send({ content: messageText }).catch(() => {});
    }
    return;
  }

  if (interaction.commandName === 'insquig') {
    const sub = interaction.options.getSubcommand();

    if (sub === 'help') {
      const topic = interaction.options.getString('topic', true);
      const text = formatHelp(topic);
      await interaction.reply({ content: text }).catch(() => {});
      return;
    }

    if (sub === 'status') {
      const now = Date.now();
      ensureStateSchedule(now);
      ensureObservationSchedule(now);
      ensureGlobalAmbientEligibility(now);

      const stateKey = state.global.state || 'watching';
      const nextChange = new Date(state.global.nextStateChangeTs || now).toLocaleString();
      const nextAmbient = new Date(state.global.ambientNextEligibleTs || now).toLocaleString();
      const quietActive = isQuietModeActive(now);
      const quietUntil = quietActive ? new Date(state.global.quietUntilTs).toLocaleString() : 'off';

      const obs = state.global.observation;
      const gapActive = isObservationGapActive(now);
      const gapStatus = gapActive
        ? `active until ${new Date(obs.endTs).toLocaleString()}`
        : `next window starts ${new Date(obs.nextStartTs).toLocaleString()}`;

      const text = [
        `**State:** ${stateKey}`,
        `**Next state change:** ${nextChange}`,
        `**Next ambient eligible:** ${nextAmbient}`,
        `**Quiet mode:** ${quietUntil}`,
        `**Observation gap:** ${gapStatus}`
      ].join("\n");

      await interaction.reply({ content: text, ephemeral: true }).catch(() => {});
      return;
    }

    if (sub === 'state') {
      const isAdmin = interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator);
      if (!isAdmin) {
        await interaction.reply({ content: "Admin-only.", ephemeral: true });
        return;
      }
      const next = interaction.options.getString('state', true);
      state.global.state = next;
      state.global.nextStateChangeTs = Date.now() + randMsDays(STATE_MIN_DAYS, STATE_MAX_DAYS);
      scheduleSave();
      await interaction.reply({ content: `State set to **${next}**.`, ephemeral: true }).catch(() => {});
      return;
    }

    if (sub === 'quiet') {
      const isAdmin = interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator);
      if (!isAdmin) {
        await interaction.reply({ content: "Admin-only.", ephemeral: true });
        return;
      }
      const mode = interaction.options.getString('mode', true);
      const hours = interaction.options.getInteger('hours');
      if (mode === 'off') {
        state.global.quietUntilTs = 0;
      } else if (mode === 'hours') {
        const h = Math.max(1, Math.min(168, hours || QUIET_DEFAULT_HOURS));
        state.global.quietUntilTs = Date.now() + h * HOUR_MS;
      } else {
        state.global.quietUntilTs = Date.now() + QUIET_DEFAULT_HOURS * HOUR_MS;
      }
      scheduleSave();
      const until = state.global.quietUntilTs ? new Date(state.global.quietUntilTs).toLocaleString() : 'off';
      await interaction.reply({ content: `Quiet mode: ${until}`, ephemeral: true }).catch(() => {});
      return;
    }

    if (sub === 'test') {
      const triggerId = interaction.options.getString('trigger', true);
      const trigger = TRIGGERS[triggerId];
      if (!trigger) {
        await interaction.reply({ content: "Unknown trigger.", ephemeral: true });
        return;
      }
      const stateKey = state.global.state || 'watching';
      const pool = trigger.templates[stateKey] || trigger.templates.watching;
      const template = pickTemplateFromPool(pool, interaction.channelId);
      const rendered = renderTemplate(template, {
        user: `<@${interaction.user.id}>`,
        persona: getUserState(interaction.user.id).persona || 'quiet_observer',
        timeSince: '2d',
        state: stateKey,
        channel: interaction.channel?.name || 'this channel'
      });
      const finalText = truncateToMaxLen(rendered, STATE_CONFIG[stateKey]?.maxLen || 160);
      await interaction.reply({ content: `**Sample (${triggerId}):**\n${finalText}`, ephemeral: true }).catch(() => {});
      return;
    }
  }
});

/** --- Login --- **/
client.login(process.env.SQUIG_TOKEN);
