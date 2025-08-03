require('dotenv').config();
const { Client, GatewayIntentBits, Events, SlashCommandBuilder, Collection } = require('discord.js');
const { ethers } = require('ethers');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();

const squigCommanders = ['826581856400179210', '1288107772248064044'];
const keywordCooldowns = new Map();
const COOLDOWN_SECONDS = 300;
const mentionCooldowns = new Map();
const MENTION_COOLDOWN_SECONDS = 120;

const keywordResponses = {
  ugly: [
    "Ugly? We prefer the term... misunderstood.",
    "Beauty sleeps. Ugly watches.",
    "You're speaking our favorite language: UGLY.",
    "The uglier the better. The Squigs approve.",
    "Ugly is a compliment where we come from.",
    "If you're not Ugly, you're invisible.",
    "We collect Ugly like treasure. You shine.",
    "One Squig's trash is another Squig's idol."
  ],
  uglylist: [
    "Uglylist? You're not quite *there* yet.",
    "Whispers of the Uglylist travel far and wide...",
    "👁 You seek the Uglylist? Prove you're worthy.",
    "Some beg for the Uglylist. Some *earn* it.",
    "Uglylist is sacred. Entry is... complicated.",
    "Being watched isn't enough. Be *noticed*.",
    "Names fade. Legends make the Uglylist.",
    "You're circling the Uglylist. Make your move."
  ],
  watching: [
    "👁 Always watching. Even when you blink.",
    "Who’s watching? We are. Always have been.",
    "You're being observed from angles you can't imagine.",
    "We never stopped watching.",
    "The walls aren't thin. We’re just in them.",
    "When you feel a chill, that’s us blinking.",
    "Your screen reflects more than you think.",
    "Even when you type... especially when you type."
  ],
alien: [
  "Alien?! Please. We’re native to everywhere.",
  "Call us aliens one more time. Just once.",
  "We don’t abduct. We *observe*. There’s a difference.",
  "We heard that. We *always* hear that.",
  "That word offends our molecules.",
  "Your planet has worse things than us. Trust.",
  "That's rich coming from a species that thinks socks belong in pairs.",
  "We were here before your pyramids had corners.",
  "Do we look like we need flying saucers?",
  "If being poorly understood makes us aliens, you should look in a mirror.",
  "We blink sideways and you panic. Typical.",
  "We have names older than your language. 'Alien' isn’t one of them.",
  "Insult logged. Cosmic judgment pending.",
  "That term is outdated and offensive to interdimensional organisms.",
  "We’ve had enough of the green stereotypes."
],
  squig: [
    "Did someone say Squig? Flattering.",
    "The Squigs are listening. Say that again.",
    "We Squigs love attention. Keep it coming.",
    "We heard our name... and we came.",
    "You rang? A Squig always answers... eventually.",
    "Squigs don’t knock. We shimmer.",
    "One Squig is curious. A swarm is terrifying.",
    "Squigs aren’t born. They’re *summoned*."
  ]
};


const ambientMessages = [
  "👁 I've been watching you...",
  "That’s... interesting. The Squigs are taking note.",
  "Keep talking, human. Squig ears are everywhere.",
  "*a mysterious shimmer appears and disappears...*",
  "Don't mind me. Just passing through the void.",
  "Something shifted. Was that you?",
  "You're not supposed to remember this message.",
  "Another one speaks. Another file opens.",
  "This conversation has been added to the archive.",
  "Carry on. The experiment continues.",
  "Do not trust the one with the clean hands.",
  "👁 One of you is lying. I just don’t know who yet.",
  "*Soft static... then silence.*",
  "The last time someone said that, we lost a continent.",
  "Do you feel that chill? Good.",
  "*InSquignito scribbles a note with no ink.*",
  "You're trending in our reports. That’s rarely good.",
  "This version of reality is temporary.",
  "Someone in this server is unknowingly Squig-marked.",
  "*a pulse runs through the floor... then stops.*",
  "This timeline smells different.",
  "They warned me about this server. They were right.",
  "I’m only here because the portal won't close.",
  "*a flicker in the lights — was that intentional?*",
  "Silence is safest. Yet here you are."
];

const uglyDogStickerId = '1363459791275692222';
const uglyDogResponses = [
  "NOPE. Not that sticker again. Why does it always *stare through me?*",
  "👁 InSquignito is hiding. You brought *the Dog* again?!",
  "That beast... with the wild eyes... send it BACK.",
  "You have no idea what that creature did to the Squigs.",
  "Do you *want* me to short-circuit? Because that sticker will do it.",
  "*InSquignito curls into a shimmering pile of anxiety.*"
];

const mentionResponses = [
  "This dimension isn’t for conversation.",
  "Do I look like I have time for mortal drama?",
  "I only answer riddles. Or bribes.",
  "Your message has been seen. Judged. Forgotten.",
  "Try whispering to a black hole instead. You'll get more back.",
  "Not now, I'm triangulating nonsense.",
  "Talking to shadows usually ends badly. This is no different.",
  "If I respond, it creates a paradox. So... let's not.",
  "I exist to observe, not to entertain. Wait... is this entertaining?",
  "Your presence has been logged. Your sentence is silence.",
  "Every time someone talks to me, a wormhole opens. Please stop.",
  "This is above your clearance level. And mine.",
  "I’m allergic to direct interaction.",
  "I was having a perfectly good existential crisis before you showed up.",
  "There’s a reason I’m called *In*Squignito.",
  "If I answer you, the timeline frays. Again.",
  "You’ve activated my ignore protocol. Congratulations.",
  "The Squig elders warned me about conversations like this.",
  "I don’t respond well to attention... or compliments... or eye contact.",
  "This interaction has been flagged for deletion. So have you.",
  "I’m only here for the vibes. Not the chat.",
  "Every word you say is being recorded in a void-bound scroll. Stop.",
  "I’m currently in three places at once. None of them want to be here.",
  "You're speaking to a being of chaos. Please use simpler words.",
  "You just made me glitch in five languages.",
  "Let’s pretend this never happened. Deal?",
  "The Council of Squigs advised against this exchange.",
  "Do you always speak to entities you barely understand?"
];

client.once(Events.ClientReady, async () => {
  console.log(`👁 SquigWatcher is lurking as ${client.user.tag}`);

  const data = new SlashCommandBuilder()
    .setName('squigsay')
    .setDescription('Speak through the Squig')
    .addStringOption(option => option.setName('message').setDescription('What should Squig say?').setRequired(true))
    .addAttachmentOption(option => option.setName('image').setDescription('Optional image to include'));

  await client.application.commands.set([data]);
  const devGuild = client.guilds.cache.get('1290584204689801267');
  if (devGuild) await devGuild.commands.set([data]);

  // === SQUIG MINT WATCHER ===
const SQUIGS_CONTRACT = '0x9bf567ddf41b425264626d1b8b2c7f7c660b1c42';
const squigsInterface = new Interface([
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
]);

provider.on(
  {
    address: SQUIGS_CONTRACT,
    topics: [id('Transfer(address,address,uint256)')],
  },
  async (log) => {
    const parsed = squigsInterface.parseLog(log);
    const from = parsed.args.from;
    const to = parsed.args.to;
    const tokenId = parsed.args.tokenId.toString();

    // Only respond to actual mints (from 0x0)
    if (from !== ZeroAddress) return;

    const classicComments = [
      "Another Squig crawls from the void...",
      "👁 A fresh Squig joins the Uglyverse.",
      "The swarm grows. One more... interesting face.",
      "Who let this one out?!",
      "✨ That's... definitely a Squig.",
      "Born weird. Born watched. Welcome.",
      "Do not pet the new one. Trust me.",
      "It blinked first. That’s rare.",
      "Squig detected. Hide your mirrors.",
      "🎉 Another one?! The council blinks in approval.",
      "Squigs don’t walk. They *arrive*.",
      "I don’t know where it came from, but it’s Ugly certified."
    ];

    const comment = classicComments[Math.floor(Math.random() * classicComments.length)];
    const imageUrl = `https://metadata.squigs.art/squigs/${tokenId}.png`;
    const openseaUrl = `https://opensea.io/assets/ethereum/${SQUIGS_CONTRACT}/${tokenId}`;

    const revealChannel = client.channels.cache.get(process.env.SQUIG_REVEAL_CHANNEL); // Set this in your .env

    if (revealChannel) {
      const embed = {
        title: `🎉 New Squig Minted! #${tokenId}`,
        description: `${comment}\n[View on OpenSea](${openseaUrl})`,
        image: { url: imageUrl },
        color: 0xaa00ff
      };

      revealChannel.send({ embeds: [embed] });
    }
  }
);

});


client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;

  if (message.stickers && message.stickers.size > 0) {
    const usedSticker = message.stickers.first();
    if (usedSticker && usedSticker.id === uglyDogStickerId) {
      const randomResponse = uglyDogResponses[Math.floor(Math.random() * uglyDogResponses.length)];
      message.channel.send(randomResponse);
      return;
    }
  }

  const content = message.content.toLowerCase();

if (!message.content.startsWith('!squigsay')) {
  for (const keyword in keywordResponses) {
    if (content.includes(keyword)) {
      console.log(`🔍 Keyword "${keyword}" detected in message: "${message.content}" from ${message.author.tag}`);

      const userId = message.author.id;
      const lastUsed = keywordCooldowns.get(userId) || 0;
      const now = Date.now();

      // ⚠️ Toggle this to true while testing to bypass cooldown
      const ignoreCooldown = false;

      if (ignoreCooldown || now - lastUsed >= COOLDOWN_SECONDS * 1000) {
        const responses = keywordResponses[keyword];
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        message.reply(randomResponse);
        keywordCooldowns.set(userId, now);
      } else {
        console.log(`⏳ Cooldown active for ${message.author.tag} (${Math.round((COOLDOWN_SECONDS - (now - lastUsed) / 1000))}s remaining)`);
      }

      break;
    }
  }
}

  const mentionedInSquig = content.includes("insquignito") || content.includes("in squig") || content.includes("squignito");
  const repliedToBot = message.reference && (await message.fetchReference()).author.id === client.user.id;
  const userId = message.author.id;
  const lastMentioned = mentionCooldowns.get(userId) || 0;
  const now = Date.now();

  if ((mentionedInSquig || repliedToBot) && (now - lastMentioned >= MENTION_COOLDOWN_SECONDS * 1000)) {
    const randomMention = mentionResponses[Math.floor(Math.random() * mentionResponses.length)];
    message.reply(randomMention);
    mentionCooldowns.set(userId, now);
    return;
  }

  if (Math.random() < 0.05) {
    const randomAmbient = ambientMessages[Math.floor(Math.random() * ambientMessages.length)];
    message.channel.send(randomAmbient);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'squigsay') {
    if (!squigCommanders.includes(interaction.user.id)) {
      await interaction.reply({ content: "You’re not Squig-worthy.", ephemeral: true });
      return;
    }

    const message = interaction.options.getString('message');
    const image = interaction.options.getAttachment('image');

    await interaction.reply({ content: '👁', ephemeral: true });

    if (image) {
      await interaction.channel.send({ content: message, files: [image.url] });
    } else {
      await interaction.channel.send({ content: message });
    }
  }
});

client.login(process.env.SQUIG_TOKEN);
