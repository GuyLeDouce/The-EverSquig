const { pools, selectFromPool } = require('./responseLibrary');
const { moods } = require('./personality');
const { getPromptState, sendPrompt } = require('./questionPrompts');

const intensities = ['low', 'normal', 'chaos'];

function isAdmin(interaction, config) {
  return interaction.memberPermissions?.has('Administrator') || config.commanderUserIds.includes(interaction.user.id);
}

function statusText(state, config) {
  const quietUntil = state.global.quietUntilTs && state.global.quietUntilTs > Date.now()
    ? new Date(state.global.quietUntilTs).toLocaleString()
    : 'off';
  return [
    `**Mood:** ${state.global.mood || 'lurking'}`,
    `**Intensity:** ${state.global.intensity || config.defaultIntensity}`,
    `**Quiet:** ${quietUntil}`,
    `**Prompts:** ${getPromptState(state, config).enabled === false ? 'off' : 'on'}`,
    `**Next prompt:** ${new Date(getPromptState(state, config).nextAskTs || Date.now()).toLocaleString()}`,
    `**Ambient ready:** ${new Date(state.global.ambientNextEligibleTs || Date.now()).toLocaleString()}`
  ].join('\n');
}

async function handleInsquig(interaction, store, config) {
  const state = store.getState();
  const sub = interaction.options.getSubcommand(false);
  const group = interaction.options.getSubcommandGroup(false);

  if (sub === 'status') {
    return interaction.reply({ content: statusText(state, config), ephemeral: true });
  }

  if (sub === 'test') {
    const category = interaction.options.getString('category', true);
    const text = selectFromPool(pools[category] || pools.directMention, {
      recentResponses: state.global.recentResponses,
      recentOpenings: state.global.recentOpenings
    }, { user: interaction.user.toString() });
    return interaction.reply({ content: text, ephemeral: true });
  }

  if (!isAdmin(interaction, config)) {
    return interaction.reply({ content: 'Admin only. The portal is judgmental about permissions.', ephemeral: true });
  }

  if (sub === 'quiet') {
    const mode = interaction.options.getString('mode', true);
    const hours = interaction.options.getInteger('hours') || 12;
    if (mode === 'off') state.global.quietUntilTs = 0;
    else state.global.quietUntilTs = Date.now() + hours * 60 * 60 * 1000;
    store.markDirty();
    const value = state.global.quietUntilTs ? new Date(state.global.quietUntilTs).toLocaleString() : 'off';
    return interaction.reply({ content: `Quiet mode: ${value}`, ephemeral: true });
  }

  if (sub === 'mood') {
    state.global.mood = interaction.options.getString('mood', true);
    store.markDirty();
    return interaction.reply({ content: `Mood set to ${state.global.mood}.`, ephemeral: true });
  }

  if (sub === 'intensity') {
    state.global.intensity = interaction.options.getString('level', true);
    store.markDirty();
    return interaction.reply({ content: `Intensity set to ${state.global.intensity}.`, ephemeral: true });
  }

  if (sub === 'prompts') {
    const mode = interaction.options.getString('mode', true);
    const qp = getPromptState(state, config);
    qp.enabled = mode === 'on';
    store.markDirty();
    return interaction.reply({ content: `Question prompts: ${qp.enabled ? 'on' : 'off'}.`, ephemeral: true });
  }

  if (sub === 'prompt-now') {
    const channel = interaction.guild?.channels?.cache?.get(config.prompts.channelId) ||
      await interaction.guild?.channels?.fetch(config.prompts.channelId).catch(() => null);
    const ok = channel?.isTextBased() ? await sendPrompt(channel, store, config, { manual: true }) : false;
    return interaction.reply({ content: ok ? 'Prompt sent.' : 'Could not send a prompt.', ephemeral: true });
  }

  if (sub === 'reset-cooldowns') {
    state.global.ambientNextEligibleTs = 0;
    state.global.categoryLastTs = {};
    Object.values(state.channels).forEach((ch) => {
      ch.lastBotSpeakTs = 0;
      ch.humanMessagesSinceBot = 999;
    });
    store.markDirty();
    return interaction.reply({ content: 'Cooldowns reset. The portal is breathing normally.', ephemeral: true });
  }

  if (group === 'channels') {
    if (sub === 'list') {
      const rows = Object.entries(state.channels)
        .filter(([, ch]) => ch.allow !== null && ch.allow !== undefined)
        .map(([id, ch]) => `<#${id}>: ${ch.allow ? 'allow' : 'deny'}`);
      return interaction.reply({ content: rows.length ? rows.join('\n') : 'No runtime channel overrides.', ephemeral: true });
    }
    const channel = interaction.options.getChannel('channel', true);
    const ch = store.getChannel(channel.id);
    ch.allow = sub === 'allow';
    store.markDirty();
    return interaction.reply({ content: `<#${channel.id}> set to ${ch.allow ? 'allow' : 'deny'} for automatic speech.`, ephemeral: true });
  }

  return interaction.reply({ content: 'Unknown /insquig command.', ephemeral: true });
}

module.exports = { handleInsquig, statusText, isAdmin, moods, intensities };
