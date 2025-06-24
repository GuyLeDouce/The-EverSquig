// squigbot/index.js
require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const keywords = ['uglylist', 'squigs', 'watching', 'who’s here'];

client.once(Events.ClientReady, () => {
  console.log(`👁 SquigWatcher is lurking as ${client.user.tag}`);
});

client.on(Events.MessageCreate, message => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase();

  // Keyword response
  if (keywords.some(word => content.includes(word))) {
    message.reply(getRandomSquigMessage());
  }

  // Randomly reply 5% of the time
  if (Math.random() < 0.05) {
    message.channel.send(getRandomSquigMessage());
  }
});

function getRandomSquigMessage() {
  const messages = [
    "👁 I've been watching you...",
    "That’s... interesting. The Squigs are taking note.",
    "Did someone say Uglylist? You're not quite *there* yet.",
    "Keep talking, human. Squig ears are everywhere.",
    "*a mysterious shimmer appears and disappears...*",
    "Don't mind me. Just passing through the void."
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

client.login(process.env.SQUIG_TOKEN);
