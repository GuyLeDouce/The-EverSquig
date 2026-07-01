const { canSpeak, recordResponse } = require('./cooldowns');

async function speak({ action, message, channel, channelState, userState, state, config, store, reply = false }) {
  if (!action.shouldSpeak || !action.responseText) return false;
  const gate = canSpeak({
    mode: action.mode,
    category: action.category,
    channel,
    channelState,
    userState,
    state,
    config
  });
  if (!gate.ok) return false;

  const sent = reply || action.mode === 'direct'
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
    config
  });
  store.markDirty();
  return true;
}

module.exports = { speak };
