const { SlashCommandBuilder } = require('discord.js');
const { pools } = require('../insquignito/responseLibrary');
const { moods, intensities } = require('../insquignito/adminControls');

function buildCommands() {
  const squigsay = new SlashCommandBuilder()
    .setName('squigsay')
    .setDescription('Speak through InSquignito')
    .addStringOption((o) => o.setName('message').setDescription('What should he say?').setRequired(true))
    .addAttachmentOption((o) => o.setName('image').setDescription('Optional image to include'));

  const question = new SlashCommandBuilder()
    .setName('question')
    .setDescription('Manage InSquignito question prompts')
    .addSubcommand((sc) => sc.setName('on').setDescription('Turn question prompts on'))
    .addSubcommand((sc) => sc.setName('off').setDescription('Turn question prompts off'))
    .addSubcommand((sc) => sc.setName('now').setDescription('Ask a question immediately'));

  const categories = Object.keys(pools)
    .filter((name) => !['questionPromptReply'].includes(name))
    .slice(0, 25)
    .map((name) => ({ name, value: name }));

  const insquig = new SlashCommandBuilder()
    .setName('insquig')
    .setDescription('InSquignito controls')
    .addSubcommand((sc) => sc.setName('status').setDescription('Show current state'))
    .addSubcommand((sc) =>
      sc
        .setName('quiet')
        .setDescription('Toggle quiet mode')
        .addStringOption((o) =>
          o.setName('mode').setDescription('on or off').setRequired(true).addChoices(
            { name: 'on', value: 'on' },
            { name: 'off', value: 'off' },
            { name: 'hours', value: 'hours' }
          )
        )
        .addIntegerOption((o) => o.setName('hours').setDescription('Hours for quiet mode').setMinValue(1).setMaxValue(168))
    )
    .addSubcommand((sc) =>
      sc
        .setName('mood')
        .setDescription('Set personality mood')
        .addStringOption((o) =>
          o.setName('mood').setDescription('Mood').setRequired(true).addChoices(...moods.map((m) => ({ name: m, value: m })))
        )
    )
    .addSubcommand((sc) =>
      sc
        .setName('intensity')
        .setDescription('Set ambient intensity')
        .addStringOption((o) =>
          o.setName('level').setDescription('Intensity').setRequired(true).addChoices(...intensities.map((i) => ({ name: i, value: i })))
        )
    )
    .addSubcommand((sc) =>
      sc
        .setName('test')
        .setDescription('Preview a response category')
        .addStringOption((o) => o.setName('category').setDescription('Category').setRequired(true).addChoices(...categories))
    )
    .addSubcommand((sc) =>
      sc
        .setName('prompts')
        .setDescription('Turn scheduled prompts on or off')
        .addStringOption((o) =>
          o.setName('mode').setDescription('Mode').setRequired(true).addChoices(
            { name: 'on', value: 'on' },
            { name: 'off', value: 'off' }
          )
        )
    )
    .addSubcommand((sc) => sc.setName('prompt-now').setDescription('Send a prompt now'))
    .addSubcommand((sc) => sc.setName('reset-cooldowns').setDescription('Reset cooldowns'))
    .addSubcommandGroup((group) =>
      group
        .setName('channels')
        .setDescription('Channel allow/deny controls')
        .addSubcommand((sc) => sc.setName('list').setDescription('List runtime channel overrides'))
        .addSubcommand((sc) =>
          sc
            .setName('allow')
            .setDescription('Allow automatic speech in a channel')
            .addChannelOption((o) => o.setName('channel').setDescription('Channel').setRequired(true))
        )
        .addSubcommand((sc) =>
          sc
            .setName('deny')
            .setDescription('Deny automatic speech in a channel')
            .addChannelOption((o) => o.setName('channel').setDescription('Channel').setRequired(true))
        )
    );

  return [squigsay, question, insquig].map((command) => command.toJSON());
}

async function registerCommands(client, config, logger) {
  const commands = buildCommands();
  await client.application.commands.set(commands);
  const devGuild = config.devGuildId ? client.guilds.cache.get(config.devGuildId) : null;
  if (devGuild) await devGuild.commands.set(commands);
  logger.info('Slash commands registered');
}

module.exports = { buildCommands, registerCommands };
