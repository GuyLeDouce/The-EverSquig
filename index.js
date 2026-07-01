const { Client, GatewayIntentBits, Events, Collection } = require('discord.js');
const { config } = require('./src/config');
const logger = require('./src/logger');
const { createStateStore } = require('./src/stateStore');
const { registerCommands } = require('./src/commands/registerCommands');
const { handleInteraction } = require('./src/commands/handleInteraction');
const { classifyMessage, looksLikeQuestion } = require('./src/insquignito/triggerClassifier');
const { decideInSquignitoAction } = require('./src/insquignito/personality');
const { speak } = require('./src/insquignito/speaker');
const { updateActivity } = require('./src/insquignito/cooldowns');
const { maybeSendTripwireAlert } = require('./src/insquignito/modTripwire');
const {
  schedulePromptTimer,
  trackPromptActivity,
  maybeReplyToPrompt
} = require('./src/insquignito/questionPrompts');

if (!config.token) {
  logger.error('Missing Discord token. Set DISCORD_TOKEN, DISCORD_BOT_TOKEN, or SQUIG_TOKEN.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();
const store = createStateStore(config.statePath, {
  global: {
    intensity: config.defaultIntensity,
    questionPrompts: { enabled: config.promptsEnabled }
  }
});

function formatTimeSince(ms) {
  const sec = Math.max(1, Math.floor(ms / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hours = Math.floor(min / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function stickerIds(message) {
  return message.stickers ? [...message.stickers.values()].map((sticker) => sticker.id) : [];
}

async function referencedMessage(message) {
  if (!message.reference?.messageId) return null;
  return message.channel.messages.fetch(message.reference.messageId).catch(() => null);
}

client.once(Events.ClientReady, async () => {
  logger.info(`InSquignito is lurking as ${client.user.tag}`);
  await registerCommands(client, config, logger).catch((err) => logger.error('Slash registration failed', err));
  schedulePromptTimer(client, store, config);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const now = Date.now();
  const state = store.getState();
  const userState = store.getUser(message.author.id);
  const channelState = store.getChannel(message.channel.id);
  const lastSeen = userState.lastSeen || 0;

  updateActivity(channelState, userState, message.author.id, now, config);
  trackPromptActivity(message, state, config, looksLikeQuestion, now);
  store.markDirty();

  await maybeSendTripwireAlert(message, config, logger).catch((err) => logger.warn('Tripwire failed', err));

  const ref = await referencedMessage(message);
  if (await maybeReplyToPrompt(message, ref, store, config).catch(() => false)) return;

  const classification = classifyMessage({
    content: message.content || '',
    mentionsBot: message.mentions?.users?.has(client.user.id),
    isReplyToBot: ref?.author?.id === client.user.id,
    stickerIds: stickerIds(message),
    channelState,
    userState: { ...userState, lastSeen },
    config,
    now
  });

  const action = decideInSquignitoAction({
    classification,
    content: message.content || '',
    channelState,
    userState,
    state,
    config,
    userId: message.author.id,
    userLabel: `<@${message.author.id}>`,
    timeSince: lastSeen ? formatTimeSince(now - lastSeen) : ''
  });

  await speak({
    action,
    message,
    channel: message.channel,
    channelState,
    userState,
    state,
    config,
    store,
    reply: action.mode === 'direct'
  });
});

client.on(Events.InteractionCreate, async (interaction) => {
  await handleInteraction(interaction, store, config).catch(async (err) => {
    logger.error('Interaction failed', err);
    const payload = { content: 'The portal coughed. Try again.', ephemeral: true };
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => {});
    else await interaction.reply(payload).catch(() => {});
  });
});

process.on('SIGINT', () => {
  store.saveNow();
  process.exit(0);
});

client.login(config.token);
