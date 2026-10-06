const { canSpeak, recordResponse } = require('./cooldowns');
const { shouldIgnoreMessage } = require('./triggerClassifier');
const { TRICK_OR_TREAT_GM_MODE } = require('./trickOrTreatGm');

// Reserve the event slot before awaiting Discord so a simultaneous GM wave
// cannot pass the same cooldown check. Failed sends release it without recording.
const pendingEventSends = new WeakSet();

async function speak({ action, message, channel, channelState, userState, state, config, store, reply = false, now = Date.now() }) {
  if (!action.shouldSpeak || !action.responseText) return false;
  const isEvent = action.mode === TRICK_OR_TREAT_GM_MODE;
  if (isEvent && (shouldIgnoreMessage(message, message.client?.user?.id) || pendingEventSends.has(state))) return false;
  const gate = canSpeak({
    mode: action.mode,
    category: action.category,
    channel,
    channelState,
    userState,
    state,
    config,
    now
  });
  if (!gate.ok) return false;

  if (isEvent) pendingEventSends.add(state);
  try {
    const sent = isEvent
      ? await message.reply({ content: action.responseText, allowedMentions: { parse: [], repliedUser: false } }).catch(() => null)
      : reply || action.mode === 'direct'
        ? await message.reply(action.responseText).catch(() => null)
        : await channel.send(action.responseText).catch(() => null);
    if (!sent) return false;

    recordResponse({
      text: action.responseText,
      mode: action.mode,
      category: action.category,
      channelState,
      userState,
      state,
      config,
      now
    });
    store.markDirty();
    return true;
  } finally {
    if (isEvent) pendingEventSends.delete(state);
  }
}

module.exports = { speak };
