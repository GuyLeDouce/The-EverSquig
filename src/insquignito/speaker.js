const { canSpeak, recordResponse } = require('./cooldowns');
const { shouldIgnoreMessage } = require('./triggerClassifier');
const { TRICK_OR_TREAT_GM_MODE } = require('./trickOrTreatGm');

async function speak({ action, message, channel, channelState, userState, state, config, store, reply = false, now = Date.now() }) {
  if (!action.shouldSpeak || !action.responseText) return false;
  const isEvent = action.mode === TRICK_OR_TREAT_GM_MODE;
  if (isEvent && shouldIgnoreMessage(message, message.client?.user?.id)) return false;
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
}

module.exports = { speak };
