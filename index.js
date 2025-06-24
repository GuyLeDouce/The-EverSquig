require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const squigCommanders = ['826581856400179210', '1288107772248064044']; // You and Vince
const keywordCooldowns = new Map(); // Tracks last keyword trigger per user
const COOLDOWN_SECONDS = 300; // 5 minutes

// Keyword-specific replies
const keywordResponses = {
  ugly: [
    "Ugly? We prefer the term... misunderstood.",
    "Beauty sleeps. Ugly watches.",
    "You're speaking our favorite language: UGLY.",
    "The uglier the better. The Squigs approve."
  ],
  uglylist: [
    "Uglylist? You're not quite *there* yet.",
    "Whispers of the Uglylist travel far and wide...",
    "👁 You seek the Uglylist? Prove you're worthy.",
    "Some beg for the Uglylist. Some *earn* it."
  ],
  watching: [
    "👁 Always watching. Even when you blink.",
    "Who’s watching? We are. Always have been.",
    "You're being observed from angles you can't imagine.",
    "We never stopped watching."
  ],
  squig: [
    "Did someone say Squig? Flattering.",
    "The Squigs are listening. Say that again.",
    "We Squigs love attention. Keep it coming.",
    "We heard our name... and we came."
  ]
};

// Random ambient Squig lines
const ambientMessages = [
  "👁 I've been watching you...",
  "That’s... interesting. The Squigs are taking note.",
  "Keep talking, human. Squig ears are everywhere.",
  "*a mysterious shimmer appears and disappears...*",
  "Don't mind me. Just passing through the void."
];

client.once(Events.ClientReady, () => {
  console.log(`👁 SquigWatcher is lurking as ${client.user.tag}`);
});

client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase();

  // === Keyword-specific response with cooldown ===
  for (const keyword in keywordResponses) {
    if (content.includes(keyword)) {
      const userId = message.author.id;
      const lastUsed = keywordCooldowns.get(userId) || 0;
      const now = Date.now();

      if (now - lastUsed >= COOLDOWN_SECONDS * 1000) {
        const responses = keywordResponses[keyword];
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        message.reply(randomResponse);
        keywordCooldowns.set(userId, now);
      }
      break;
    }
  }

  // === Random ambient interjection (5% chance) ===
  if (Math.random() < 0.05) {
    const randomAmbient = ambientMessages[Math.floor(Math.random() * ambientMessages.length)];
    message.channel.send(randomAmbient);
  }

  // === Manual Squig override command ===
  if (message.content.startsWith('!squigsay')) {
    if (squigCommanders.includes(message.author.id)) {
      const squigMessage = message.content.slice(10).trim();
      if (squigMessage.length > 0) {
        await message.delete(); // Keep it sneaky
        message.channel.send(squigMessage);
      }
    } else {
      message.reply("You’re not Squig-worthy.");
    }
  }
});

client.login(process.env.SQUIG_TOKEN);

