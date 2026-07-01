require('dotenv').config();
const path = require('path');

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function listFromEnv(name, fallback = []) {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw.split(',').map((v) => v.trim()).filter(Boolean);
}

function intFromEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boolFromEnv(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  return /^(1|true|yes|on)$/i.test(raw);
}

const config = {
  token: process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN || process.env.SQUIG_TOKEN || '',
  generalChannelId: process.env.GENERAL_CHANNEL_ID || '1290587398778126418',
  devGuildId: process.env.DEV_GUILD_ID || '1290584204689801267',
  commanderUserIds: listFromEnv('COMMANDER_USER_IDS', ['826581856400179210', '1288107772248064044']),
  modAlertChannelId: process.env.MOD_ALERT_CHANNEL_ID || '',
  uglyDogStickerId: process.env.UGLY_DOG_STICKER_ID || '1363459791275692222',
  channelNameDenyContains: listFromEnv('CHANNEL_NAME_DENY_CONTAINS', ['rules', 'announcement', 'announcements', 'admin', 'mod', 'logs']),
  channelAllowlist: listFromEnv('CHANNEL_ALLOWLIST', []),
  channelDenylist: listFromEnv('CHANNEL_DENYLIST', []),
  safeDomains: new Set(listFromEnv('SAFE_DOMAINS', [
    'squigs.io',
    'www.squigs.io',
    'uglydex.xyz',
    'www.uglydex.xyz',
    'discord.gg',
    'www.discord.gg',
    'discord.com',
    'www.discord.com'
  ])),
  statePath: process.env.INSQUIG_STATE_PATH || path.join(__dirname, '..', 'data', 'insq_state.json'),
  defaultIntensity: process.env.INSQUIG_INTENSITY || 'normal',
  promptsEnabled: boolFromEnv('QUESTION_PROMPTS_ENABLED', true),
  cooldowns: {
    ambientGlobalMinMs: intFromEnv('AMBIENT_GLOBAL_COOLDOWN_HOURS_MIN', 6) * HOUR_MS,
    ambientGlobalMaxMs: intFromEnv('AMBIENT_GLOBAL_COOLDOWN_HOURS_MAX', 12) * HOUR_MS,
    channelMs: intFromEnv('CHANNEL_COOLDOWN_MINUTES', 45) * 60 * 1000,
    directUserMs: intFromEnv('DIRECT_USER_COOLDOWN_SECONDS', 120) * 1000,
    categoryMs: intFromEnv('CATEGORY_COOLDOWN_MINUTES', 60) * 60 * 1000,
    tripwireUserMs: intFromEnv('TRIPWIRE_COOLDOWN_SECONDS', 300) * 1000,
    uglyDogChannelMs: intFromEnv('UGLY_DOG_CHANNEL_COOLDOWN_HOURS', 6) * HOUR_MS
  },
  gates: {
    minHumanMessagesAfterBot: intFromEnv('MIN_HUMAN_MESSAGES_AFTER_BOT', 8),
    questionPromptMinHumanMessagesAfterBot: intFromEnv('QUESTION_PROMPT_MIN_HUMAN_MESSAGES_AFTER_BOT', 3),
    rantMinChars: intFromEnv('RANT_MIN_CHARS', 280),
    returnInactivityMs: intFromEnv('RETURN_INACTIVITY_HOURS', 24) * HOUR_MS,
    backAndForthWindowMs: intFromEnv('BACK_AND_FORTH_WINDOW_MINUTES', 10) * 60 * 1000,
    backAndForthMinMessages: intFromEnv('BACK_AND_FORTH_MIN_MESSAGES', 4),
    burstWindowMs: intFromEnv('BURST_WINDOW_MINUTES', 15) * 60 * 1000,
    burstAfterSilenceMs: intFromEnv('BURST_AFTER_SILENCE_HOURS', 8) * HOUR_MS,
    burstMinMessages: intFromEnv('BURST_MIN_MESSAGES', 6)
  },
  prompts: {
    channelId: process.env.QUESTION_PROMPT_CHANNEL_ID || process.env.GENERAL_CHANNEL_ID || '1290587398778126418',
    minMs: intFromEnv('QUESTION_PROMPT_MIN_MINUTES', 60) * 60 * 1000,
    maxMs: intFromEnv('QUESTION_PROMPT_MAX_HOURS', 6) * HOUR_MS,
    activityWindowMs: intFromEnv('QUESTION_PROMPT_ACTIVITY_WINDOW_MINUTES', 90) * 60 * 1000,
    activeTtlMs: 24 * HOUR_MS,
    activeLimit: 20
  },
  state: {
    moodMinMs: intFromEnv('MOOD_MIN_DAYS', 2) * DAY_MS,
    moodMaxMs: intFromEnv('MOOD_MAX_DAYS', 4) * DAY_MS,
    quietDefaultMs: intFromEnv('QUIET_DEFAULT_HOURS', 12) * HOUR_MS
  }
};

module.exports = { config, HOUR_MS, DAY_MS };
