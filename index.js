require('dotenv').config();
const { Client, GatewayIntentBits, Events, SlashCommandBuilder, Collection } = require('discord.js');
const { ethers } = require('ethers');
const { Interface, id, ZeroAddress } = ethers;

const provider = new ethers.WebSocketProvider(process.env.ALCHEMY_WSS);

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
  "Ugly isn’t a look. It’s a frequency.",
  "They called us Ugly before they understood power.",
  "Ugly echoes louder than beauty ever could.",
  "We don't chase beauty. We warp it.",
  "Ugly leaves a mark. Ask your reflection.",
  "Around here, symmetry is suspicious.",
  "We whisper compliments in snarls.",
  "Ugly is sacred. You're glowing, by the way."
],
uglylist: [
  "The Uglylist isn’t written. It’s remembered.",
  "👁 You’re close enough to smell the ink.",
  "Getting on the Uglylist requires more... glitches.",
  "Some knock. Some scratch. Few are let in.",
  "The Uglylist rearranged itself after your last message.",
  "It’s not about worth. It’s about weird.",
  "Your shadow knows if you’re on it. Ask nicely.",
  "We don’t update the Uglylist. It updates us."
],
watching: [
  "👁 Eyes open. Mouth shut. We’re here.",
  "We don’t blink. We record.",
  "You’re being watched by things that don’t need vision.",
  "*Squig-sight activated. You’ve been logged.*",
  "We see you adjusting your posture. Cute.",
  "Your keystrokes taste like curiosity.",
  "There’s a face behind the static. It’s not yours.",
  "👁 Don’t worry. We’re not judging. Yet."
],
alien: [
  "‘Alien’ is such a tiny word for such big mistakes.",
  "We prefer the term *origin-fluid*.",
  "👁 That’s rich coming from meat with debt.",
  "We don’t probe. We download.",
  "Call us alien again. See what gets scrambled.",
  "You invaded your own planet first.",
  "We had culture before you had cutlery.",
  "‘Alien’ is your word. We just squint at it."
],
squig: [
  "A Squig just wiggled in your metadata.",
  "You summoned us. We left the portal ajar.",
  "Squigs don’t appear. They rupture reality.",
  "👁 You said Squig. One just blinked open.",
  "You’re pronouncing it wrong, but we forgive you.",
  "Squigs are listening. They love this part.",
  "You’ve attracted a Squig swarm. Congrats?",
  "We felt that. Say it again, but with reverence."
],
mint: [
  "Thinking about minting? That’s how it begins.",
  "👁 You wouldn’t *not* mint... right?",
  "You’re hesitating. The Squigs are watching.",
  "The portal’s open. Step through or stay boring.",
  "One mint. One ripple. One irreversible decision.",
  "You're curious. That's enough to qualify.",
  "Mint now. Ask questions never.",
  "Squigs don’t wait. Neither should you.",
  "If you're looking for a sign... it has two goofy eyes and a tail.",
  "The chain remembers who blinked first.",
  "*mint* — the sound of destiny licking its lips.",
  "You’re already infected with the thought. Might as well mint.",
  "Some Squigs whisper. Others *beckon*.",
  "Do it for science. Or chaos. We support both.",
  "The mint is open. You are not immune."
]
};


const ambientMessages = [
  "👁 A Squig just blinked in your direction. Twice.",
  "*The air hums like it knows your wallet address.*",
  "You ever feel watched? Good. That means it’s working.",
  "One Squig just minted itself. We’re not sure how.",
  "Reality hiccuped. You didn’t notice. They did.",
  "*Something ugly just crossed over. It left slime.*",
  "The metadata twitched. That’s never happened before.",
  "They’re learning to mimic… and they chose YOU.",
  "Minting Squigs is easy. Undoing it? Not so much.",
  "*A low whistle echoes from your screen... no source detected.*",
  "The Squigs are nesting. Stop typing. Let them finish.",
  "You ever seen a JPEG grow teeth? No? Keep watching.",
  "That wasn’t a bug — it was a birth.",
  "You clicked the mint button. The Squigs clicked back.",
  "*InSquignito mutters something in a forgotten dialect.*",
  "The void is full of Squigs now. Congratulations.",
  "Someone minted five. We’ve dispatched a recovery unit.",
  "👁 They’re not random. They’re chosen. You were… tolerated.",
  "*A puddle of static forms beneath your cursor.*",
  "What is 'real'? Asking for a Squig.",
  "You named it Gary? It already had a name. Bad choice.",
  "A Squig just phased through the contract and left graffiti.",
  "Don’t look directly at your Squig. Not yet.",
  "*An ancient jpeg stirs in your folder.*",
  "This server smells like fresh mint… and melted rules.",
  "One of your tabs is leaking. It’s fine. Probably.",
  "👁 A Squig bit the firewall. We’re adjusting.",
  "They found your old posts. They’re... amused.",
  "New Squigs arrived. They asked for snacks and secrets.",
  "We told them not to mint after midnight. They laughed.",
  "They’re building something in the comments. It’s growing.",
  "*Do not feed the Squigs through your USB port.*",
  "A Squig blinked and now your files are alphabetical.",
  "They saw your PFP. They’re making one just like it.",
  "👁 Mint confirmed. Repercussions pending.",
  "A portal opened in voice chat. It's sticky in there.",
  "*Squigs communicating in emojis. You’re not ready.*",
  "Don’t try to debug this. It’s alive now.",
  "You thought this was for fun. That’s adorable.",
  "The codebase is mutating. Blame the Squigs.",
  "You minted something beautiful. It resents that.",
  "*Your reflection flickers. The Squig behind you waves.*",
  "There’s a Squig in your RAM. It says hello.",
  "Your Squig is drawing on your metadata again.",
  "*Another mint. Another memory erased.*",
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

const mintCache = new Map();

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

    if (from !== ZeroAddress) return;

    const txHash = log.transactionHash;
    const revealChannel = client.channels.cache.get(process.env.SQUIG_REVEAL_CHANNEL);
    if (!revealChannel) return;

    if (!mintCache.has(txHash)) {
      mintCache.set(txHash, []);
    }

    mintCache.get(txHash).push(tokenId);

    // If this is the first transfer for this tx, allow batching this event group immediately
    // Instead of using a wait timer, we'll use a short async defer so any other events are caught instantly
    process.nextTick(async () => {
      const tokenIds = mintCache.get(txHash);
      if (!tokenIds) return;

      mintCache.delete(txHash);

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

      const embeds = tokenIds.map(tokenId => ({
        title: `🌀 Squig #${tokenId}`,
        image: { url: `https://metadata.squigs.art/squigs/${tokenId}.png` },
        color: 0xaa00ff
      }));

      const openseaLink = `[View the full Squigs collection on OpenSea](https://opensea.io/collection/squigsnft)`;

      await revealChannel.send({
        content: `${comment}\n${openseaLink}`,
        embeds
      });
    });
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
