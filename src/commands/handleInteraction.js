const { handleInsquig, isAdmin } = require('../insquignito/adminControls');
const { getPromptState, sendPrompt } = require('../insquignito/questionPrompts');

async function handleInteraction(interaction, store, config) {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'squigsay') {
    if (!isAdmin(interaction, config)) {
      return interaction.reply({ content: 'Only trusted Squig handlers can use this.', ephemeral: true });
    }
    const content = interaction.options.getString('message', true);
    const image = interaction.options.getAttachment('image');
    await interaction.reply({ content: 'Sent.', ephemeral: true });
    return interaction.channel?.send({ content, files: image ? [image.url] : [] }).catch(() => {});
  }

  if (interaction.commandName === 'question') {
    if (!isAdmin(interaction, config)) {
      return interaction.reply({ content: 'Admin only. The portal guards its question jar.', ephemeral: true });
    }
    const sub = interaction.options.getSubcommand();
    const state = store.getState();
    const qp = getPromptState(state, config);
    if (sub === 'on' || sub === 'off') {
      qp.enabled = sub === 'on';
      store.markDirty();
      return interaction.reply({ content: `Question prompts: ${qp.enabled ? 'on' : 'off'}.`, ephemeral: true });
    }
    const channel = interaction.guild?.channels?.cache?.get(config.prompts.channelId) ||
      await interaction.guild?.channels?.fetch(config.prompts.channelId).catch(() => null);
    const ok = channel?.isTextBased() ? await sendPrompt(channel, store, config, { manual: true }) : false;
    return interaction.reply({ content: ok ? 'Question sent.' : 'Could not send a question right now.', ephemeral: true });
  }

  if (interaction.commandName === 'insquig') {
    return handleInsquig(interaction, store, config);
  }
}

module.exports = { handleInteraction };
