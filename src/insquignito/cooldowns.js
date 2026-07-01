const { getOpening } = require('./responseLibrary');

function isQuietModeActive(state, now = Date.now()) {
  return !!(state.global.quietUntilTs && now < state.global.quietUntilTs);
}

function isChannelNameBlocked(channel, config) {
  const name = String(channel?.name || '').toLowerCase();
  return (config.channelNameDenyContains || []).some((frag) => name.includes(frag));
}

function isChannelAllowed(channel, channelState, config) {
  if (!channel) return false;
  if ((config.channelDenylist || []).includes(channel.id)) return false;
  if (channelState?.allow === false) return false;
  if ((config.channelAllowlist || []).length && !(config.channelAllowlist || []).includes(channel.id) && channelState?.allow !== true) return false;
  if (isChannelNameBlocked(channel, config) && channelState?.allow !== true) return false;
  return true;
}

function enoughHumanMessages(channelState, min) {
  return (channelState.humanMessagesSinceBot || 0) >= min;
}

function canSpeak({ mode, category, channel, channelState, userState, state, config, now = Date.now() }) {
  if (!isChannelAllowed(channel, channelState, config)) {
    return { ok: false, reason: 'channel_blocked' };
  }
  if (mode === 'ambient' || mode === 'prompt') {
    if (isQuietModeActive(state, now)) return { ok: false, reason: 'quiet_mode' };
    if (!enoughHumanMessages(channelState, config.gates.minHumanMessagesAfterBot)) return { ok: false, reason: 'not_enough_human_messages' };
    if (now < (state.global.ambientNextEligibleTs || 0)) return { ok: false, reason: 'global_ambient_cooldown' };
    if (now - (channelState.lastBotSpeakTs || 0) < config.cooldowns.channelMs) return { ok: false, reason: 'channel_cooldown' };
  }
  if (mode === 'direct') {
    if (now - (userState.lastDirectTs || 0) < config.cooldowns.directUserMs) return { ok: false, reason: 'user_direct_cooldown' };
  }
  if (category && now - (state.global.categoryLastTs?.[category] || 0) < config.cooldowns.categoryMs && mode !== 'direct') {
    return { ok: false, reason: 'category_cooldown' };
  }
  return { ok: true, reason: 'ok' };
}

function recordResponse({ text, mode, category, channelState, userState, state, config, now = Date.now() }) {
  const opening = getOpening(text);
  channelState.lastBotSpeakTs = now;
  channelState.humanMessagesSinceBot = 0;
  channelState.recentResponses = [...(channelState.recentResponses || []), text].slice(-12);
  channelState.recentOpenings = [...(channelState.recentOpenings || []), opening].slice(-12);
  state.global.recentResponses = [...(state.global.recentResponses || []), text].slice(-40);
  state.global.recentOpenings = [...(state.global.recentOpenings || []), opening].slice(-40);
  if (category) state.global.categoryLastTs[category] = now;
  if (mode === 'direct') userState.lastDirectTs = now;
  if (mode === 'ambient') {
    const min = config.cooldowns.ambientGlobalMinMs;
    const max = config.cooldowns.ambientGlobalMaxMs;
    state.global.ambientLastTs = now;
    state.global.ambientNextEligibleTs = now + min + Math.floor(Math.random() * Math.max(1, max - min));
  }
}

function updateActivity(channelState, userState, userId, now, config) {
  const prevGap = channelState.lastHumanMsgTs ? now - channelState.lastHumanMsgTs : Infinity;
  channelState.humanMessagesSinceBot = Math.min(9999, (channelState.humanMessagesSinceBot || 0) + 1);
  channelState.lastHumanMsgTs = now;
  channelState.recentMessages = [...(channelState.recentMessages || []), { ts: now, userId }]
    .filter((m) => now - m.ts <= 12 * 60 * 60 * 1000);

  if (prevGap >= config.gates.burstAfterSilenceMs) {
    channelState.burstWindowStart = now;
    channelState.burstCount = 1;
    channelState.burstFromSilence = true;
  } else if (channelState.burstWindowStart && now - channelState.burstWindowStart <= config.gates.burstWindowMs) {
    channelState.burstCount = (channelState.burstCount || 0) + 1;
  } else {
    channelState.burstWindowStart = now;
    channelState.burstCount = 1;
    channelState.burstFromSilence = false;
  }

  userState.messageCount = (userState.messageCount || 0) + 1;
  userState.lastSeen = now;
}

module.exports = { isQuietModeActive, isChannelAllowed, canSpeak, recordResponse, updateActivity };
