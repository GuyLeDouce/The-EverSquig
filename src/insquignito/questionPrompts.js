const { questionPrompts, pools, selectFromPool } = require('./responseLibrary');
const { isQuietModeActive, isChannelAllowed, recordResponse } = require('./cooldowns');

let timer = null;

function flatPrompts() {
  return Object.entries(questionPrompts).flatMap(([category, prompts]) => prompts.map((text) => ({ category, text })));
}

function getPromptState(state, config) {
  const qp = state.global.questionPrompts;
  if (typeof qp.enabled !== 'boolean') qp.enabled = config.promptsEnabled;
  if (!Array.isArray(qp.order)) qp.order = [];
  if (!qp.activeMessages) qp.activeMessages = {};
  return qp;
}

function shuffle(count) {
  const arr = Array.from({ length: count }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function ensureSchedule(state, config, now = Date.now()) {
  const qp = getPromptState(state, config);
  if (!qp.nextAskTs) {
    qp.nextAskTs = now + config.prompts.minMs + Math.floor(Math.random() * Math.max(1, config.prompts.maxMs - config.prompts.minMs));
  }
}

function bumpSchedule(state, config, now = Date.now()) {
  const qp = getPromptState(state, config);
  qp.nextAskTs = now + config.prompts.minMs + Math.floor(Math.random() * Math.max(1, config.prompts.maxMs - config.prompts.minMs));
}

function nextPrompt(state, config) {
  const qp = getPromptState(state, config);
  const prompts = flatPrompts();
  qp.order = qp.order.filter((i) => Number.isInteger(i) && i >= 0 && i < prompts.length);
  if (!qp.order.length) qp.order = shuffle(prompts.length);
  return prompts[qp.order.shift()];
}

function pruneActive(qp, config, now = Date.now()) {
  qp.activeMessages = Object.fromEntries(
    Object.entries(qp.activeMessages || {})
      .filter(([, meta]) => now - (meta.sentTs || 0) <= config.prompts.activeTtlMs)
      .sort((a, b) => (b[1].sentTs || 0) - (a[1].sentTs || 0))
      .slice(0, config.prompts.activeLimit)
  );
}

function trackPromptActivity(message, state, config, looksLikeQuestion, now = Date.now()) {
  if (message.channel.id !== config.prompts.channelId) return;
  const qp = getPromptState(state, config);
  qp.lastActivityTs = now;
  qp.lastMessageWasQuestion = looksLikeQuestion(message.content || '');
}

function canAskPrompt(channel, channelState, state, config, now = Date.now()) {
  if (!channel || channel.id !== config.prompts.channelId || !channel.isTextBased()) return false;
  if (!isChannelAllowed(channel, channelState, config)) return false;
  if (isQuietModeActive(state, now)) return false;
  const qp = getPromptState(state, config);
  if (!qp.lastActivityTs || now - qp.lastActivityTs > config.prompts.activityWindowMs) return false;
  if (qp.lastMessageWasQuestion) return false;
  if ((channelState.humanMessagesSinceBot || 0) < config.gates.questionPromptMinHumanMessagesAfterBot) return false;
  return true;
}

async function sendPrompt(channel, store, config, options = {}) {
  const state = store.getState();
  const qp = getPromptState(state, config);
  const prompt = nextPrompt(state, config);
  const sent = await channel.send(prompt.text).catch(() => null);
  if (!sent) return false;
  const channelState = store.getChannel(channel.id);
  channelState.lastBotSpeakTs = Date.now();
  channelState.humanMessagesSinceBot = 0;
  qp.activeMessages[sent.id] = {
    sentTs: Date.now(),
    category: prompt.category,
    text: prompt.text,
    responses: 0,
    responseUserIds: [],
    manual: !!options.manual
  };
  pruneActive(qp, config);
  store.markDirty();
  return true;
}

async function maybeAskScheduledPrompt(client, store, config) {
  const state = store.getState();
  const qp = getPromptState(state, config);
  if (qp.enabled === false) return false;
  const now = Date.now();
  ensureSchedule(state, config, now);
  if (now < qp.nextAskTs) return false;
  bumpSchedule(state, config, now);
  const channel = client.channels.cache.get(config.prompts.channelId) ||
    await client.channels.fetch(config.prompts.channelId).catch(() => null);
  const channelState = channel ? store.getChannel(channel.id) : null;
  if (!canAskPrompt(channel, channelState, state, config, now)) {
    store.markDirty();
    return false;
  }
  return sendPrompt(channel, store, config, { manual: false });
}

async function maybeReplyToPrompt(message, referencedMessage, store, config) {
  if (!referencedMessage || referencedMessage.author?.id !== message.client.user.id) return false;
  if (message.channel.id !== config.prompts.channelId) return false;
  const state = store.getState();
  const qp = getPromptState(state, config);
  const promptMeta = qp.activeMessages?.[referencedMessage.id];
  if (!promptMeta) return false;
  if (promptMeta.responseUserIds?.includes(message.author.id)) return false;
  const channelState = store.getChannel(message.channel.id);
  const userState = store.getUser(message.author.id);
  const responseText = selectFromPool(pools.questionPromptReply, {
    recentResponses: [...(state.global.recentResponses || []), ...(channelState.recentResponses || [])],
    recentOpenings: [...(state.global.recentOpenings || []), ...(channelState.recentOpenings || [])]
  });
  const sent = await message.reply(responseText).catch(() => null);
  if (!sent) return false;
  promptMeta.responses = (promptMeta.responses || 0) + 1;
  promptMeta.responseUserIds = [...(promptMeta.responseUserIds || []), message.author.id];
  promptMeta.lastResponseTs = Date.now();
  recordResponse({ text: responseText, mode: 'direct', category: 'questionPromptReply', channelState, userState, state, config });
  pruneActive(qp, config);
  store.markDirty();
  return true;
}

function schedulePromptTimer(client, store, config) {
  if (timer) clearTimeout(timer);
  const state = store.getState();
  const qp = getPromptState(state, config);
  if (qp.enabled === false) return;
  ensureSchedule(state, config);
  const delay = Math.max(5000, qp.nextAskTs - Date.now());
  timer = setTimeout(async () => {
    timer = null;
    await maybeAskScheduledPrompt(client, store, config).catch(() => {});
    schedulePromptTimer(client, store, config);
  }, delay);
}

module.exports = {
  flatPrompts,
  getPromptState,
  ensureSchedule,
  bumpSchedule,
  trackPromptActivity,
  canAskPrompt,
  sendPrompt,
  maybeAskScheduledPrompt,
  maybeReplyToPrompt,
  schedulePromptTimer
};
