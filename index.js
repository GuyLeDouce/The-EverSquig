require('dotenv').config();
const { Client, GatewayIntentBits, Events, SlashCommandBuilder, Collection } = require('discord.js');
const { ethers } = require('ethers');
const { Interface, id, ZeroAddress } = ethers;

const provider = new ethers.WebSocketProvider(process.env.ALCHEMY_WSS);
// put these near the top with your other consts
const SQUIGS_CONTRACT = '0x9bf567ddf41b425264626d1b8b2c7f7c660b1c42';
const squigsInterface = new Interface([
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
]);

// === channel & emoji for #general reactions ===
const GENERAL_CHANNEL_ID = '1290587398778126418';
const EYES_EMOJI_ID = '1387394624804618351'; // custom 3-eyes emoji

// === recently announced txs: dedupe realtime vs catch-up ===
const recentAnnouncedTxs = new Set();
const RECENT_TX_LIMIT = 1000;
function rememberTx(txHash) {
  recentAnnouncedTxs.add(txHash);
  if (recentAnnouncedTxs.size > RECENT_TX_LIMIT) {
    // trim ~1/4 oldest entries
    let n = Math.floor(RECENT_TX_LIMIT / 4);
    for (const h of recentAnnouncedTxs) { recentAnnouncedTxs.delete(h); if (--n <= 0) break; }
  }
}

// === helper: parse logs, group mints by tx, and send one message per tx ===
async function handleMintLogs(logs, { revealChannel, squigsInterface }) {
  const grouped = new Map(); // txHash -> Set(tokenIds)

  for (const log of logs) {
    try {
      const parsed = squigsInterface.parseLog({ topics: log.topics, data: log.data });
      const from = parsed.args.from;
      if (from !== ZeroAddress) continue; // only mints

      const tokenId = parsed.args.tokenId.toString();
      if (!grouped.has(log.transactionHash)) grouped.set(log.transactionHash, new Set());
      grouped.get(log.transactionHash).add(tokenId);
    } catch {
      // ignore non-matching logs
    }
  }

  for (const [txHash, ids] of grouped) {
    // ⛔ skip if we've already announced this tx
    if (recentAnnouncedTxs.has(txHash)) continue;

    const tokenIds = Array.from(ids);
    if (!tokenIds.length) continue;

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
    const embeds = tokenIds.map(id => ({
      title: `🌀 Squig #${id}`,
      image: { url: `https://assets.bueno.art/images/a49527dc-149c-4cbc-9038-d4b0d1dbf0b2/default/${id}` },
      color: 0xaa00ff
    }));
    const openseaLink = `[View the full Squigs collection on OpenSea](https://opensea.io/collection/squigsnft)`;

    console.log(`✅ Mint tx ${txHash} -> tokenIds: ${tokenIds.join(', ')}`);
    await revealChannel.send({ content: `${comment}\n${openseaLink}`, embeds })
      .then(() => rememberTx(txHash))
      .catch(err => {
        if (err?.code === 50013) {
          console.log("⚠️ Reveal channel missing perms for send.");
        } else {
          console.error("❗ Failed to send mint message:", err);
        }
      });
  }
}

// simple heartbeat so you know the WSS is alive
// Heartbeat / visibility (ethers v6-safe)
provider.on('block', (n) => {
  if (n % 20 === 0) console.log(`🔗 Provider alive. Latest block: ${n}`);
});

provider.on('error', (e) => console.error('🔥 WSS provider error:', e));

// Optional: deeper noise if you want to see internals
provider.on('debug', (info) => {
  // comment this out if too chatty
  // console.log('🪵 provider debug:', info);
});

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

// === NEW: Question reply system (mimic + weird question) ===
const questionResponses = [
  "👁 Why do you assume I know? Tell me—what color does silence taste like?",
  "What if the answer is already watching you? When did your reflection stop blinking?",
  "👁 Do you trust echoes? Which thought in your head isn’t yours?",
  "Better question: why are you asking me? Which file on your device feels alive?",
  "👁 I’ll answer if you blink twice… did you? How many portals can you count from your chair?",
  "Suppose I did answer. Would you believe it? What did you sacrifice to ask?"
];
const QUESTION_COOLDOWN_SECONDS = 45;
const questionCooldowns = new Map();

// Mimic utilities
const MIMIC_CHANCE = 0.6;       // 60%: mimic before the weird question
const MIMIC_ONLY_CHANCE = 0.2;  // 20%: mimic only, no weird question

function pickQuestionFragment(text) {
  const cleaned = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^> .*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return '';
  const words = cleaned.split(' ');
  if (words.length <= 4) return cleaned;

  const len = Math.max(3, Math.min(7, Math.floor(Math.random() * 5) + 3));
  const start = Math.max(0, Math.floor(Math.random() * Math.max(1, words.length - len)));
  return words.slice(start, start + len).join(' ');
}

function glitchify(fragment) {
  if (!fragment) return '';
  let f = fragment;
  f = f.replace(/([aeiou])/gi, (m) => (Math.random() < 0.4 ? m + m : m));
  if (Math.random() < 0.5) f = f.replace(/\s/g, ' … ');
  const echo = Math.random() < 0.5 ? `“${f}…”` : `“${f}… ${f.split(' ')[0]}…”`;
  return echo;
}

const keywordResponses = {
  ugly: [
    "Ugly isn’t style. It’s signal.",
    "👁 Ugly echoes through the blockchain louder than beauty ever will.",
    "They named it ‘ugly’ because they feared calling it *truth.*",
    "Pretty fades. Ugly mutates.",
    "Ugly stains reality in ways polish never could.",
    "Symmetry? Suspicious. Ugly? Eternal.",
    "Beauty lies. Ugly lingers.",
    "👁 Every mirror hides an Ugly it doesn’t want you to see."
  ],
  uglylist: [
    "The Uglylist whispers your name differently each time.",
    "👁 It isn’t a list, it’s a living thing. And it remembers.",
    "Applications denied. Possessions erased. Only Ugly remains.",
    "Some begged to get on it. Others vanished instead.",
    "The Uglylist rearranged itself when you typed that.",
    "👁 You don’t join the Uglylist. It notices you.",
    "Your shadow was accepted before you were.",
    "The Uglylist isn’t ink. It’s scars."
  ],
  watching: [
    "👁 Don’t adjust your posture. We like it crooked.",
    "We record even the thoughts you delete.",
    "You’re being observed by things that don’t cast shadows.",
    "👁 Blink again. We dare you.",
    "Your heartbeat just got logged.",
    "Watching isn’t passive. It’s participation.",
    "👁 Behind the static is a smile. It isn’t yours.",
    "You are never the one doing the watching."
  ],
  alien: [
    "👁 Alien? That’s your word for the familiar you can’t own.",
    "We’re not visitors. We’re reminders.",
    "You invaded your *own* planet first. Don’t project.",
    "👁 We don’t probe. We archive.",
    "Culture is older than cutlery. We still remember both.",
    "Call us alien again and see what gets rewritten.",
    "👁 Alien is the word you use when you can’t spell ‘mirror.’",
    "We’ve been local longer than you’ve been human."
  ],
  squig: [
    "👁 A Squig wriggled out of your metadata and waved.",
    "Say ‘Squig’ again—see how many appear.",
    "Squigs don’t show up. They *erupt.*",
    "👁 You summoned a Squig. It left the door open.",
    "Squigs don’t listen. They replay.",
    "👁 The swarm noticed you noticing.",
    "One Squig just named itself after your keystroke.",
    "Every time you say Squig, another file corrupts—beautifully."
  ],
  mint: [
    "👁 Thinking about minting? That thought was enough to bind you. Make it happen",
    "Every mint is a portal you can’t unstep through.",
    "The Squigs are watching your hesitation.",
    "👁 The chain whispers: *Do it again.*",
    "One mint creates ripples. Two mint a storm.",
    "You’re already marked. Might as well finish the ritual.",
    "👁 The mint button isn’t a choice. It’s a commitment to UGLY.",
    "Minting is the beginning. Holding is the true Ugly ritual.",
    "The Squigs tally every blink you take before minting.",
    "👁 Hesitation logs you deeper than action ever will.",
    "Each mint infects another timeline.",
    "The chain remembers who minted first. And who refused.",
    "👁 The portal’s open. Step or stay boring.",
    "Mint now. Ask questions later—if you’re still here.",
    "Ugly favors the bold. Minting proves you’re infected."
  ],
  gm: [
    "👁 Good morning, if that’s what you call this glitch in time.",
    "GM? Squigs prefer *Ugly Dawn.*",
    "👁 Good morning, meat. We already saw your dreams.",
    "GM, traveler. The metadata twitched when you woke up.",
    "👁 Good morning… though the Squigs have been awake for centuries.",
    "GM — your reflection beat you here.",
    "👁 Ah, the human says GM. The Squigs say ‘Grotesque Manifestation.’",
    "Good morning. The code smells different when you log in.",
    "👁 GM. Don’t worry, the eyes have been on you all night.",
    "GM, anomaly. The chain hiccuped when you typed it.",
    "👁 Good morning — though your files don’t agree.",
    "GM. We hope your dreams were less Ugly than your reality.",
    "👁 The Squigs return your GM. Uneasy, isn’t it?",
    "GM, host organism. Carry on.",
    "👁 Good morning. We’ve already blinked your fate into place."
  ]
};

const ambientMessages = [
  "👁 A ripple just passed through your screen. Did you feel it?",
  "*Something in the code just laughed.*",
  "You typed too loud. The Squigs heard you.",
  "Your cursor paused for a second… so did your heart.",
  "👁 Don’t scroll too fast. They get dizzy.",
  "Static drips between your keys. Wipe it up.",
  "One Squig just named itself after your IP address.",
  "*Your reflection flickers; a Squig waves back.*",
  "They like the way you breathe. Keep it steady.",
  "👁 A Squig blinked and your notifications rearranged themselves.",
  "That wasn’t lag. That was me testing gravity.",
  "Your last emoji summoned three Squigs. One stayed.",
  "Someone is minting in another tab. I can smell it.",
  "👁 You look better in glitch lighting.",
  "*A voice in binary hums through your speakers.*",
  "They left claw marks on the blockchain again.",
  "Every typo you make is another Squig born.",
  "👁 A Squig tried on your username. It fits too well.",
  "Don’t refresh. They like it stale.",
  "Your message history twitched when you weren’t looking.",
  "*There’s a shadow in your draft messages.*",
  "They’ve started nesting in your clipboard.",
  "👁 The metadata sighed when you logged in.",
  "Your status update just whispered back.",
  "They painted something ugly on your RAM. Check later.",
  "*A file you didn’t download is now downloading you.*",
  "They know which tab you’ll close next. They disagree.",
  "👁 A Squig is practicing your handwriting in the margins.",
  "Every like you’ve ever given is now humming in unison.",
  "Your inbox smells like ozone. That’s a Squig thing.",
  "*One just crawled out of the emoji bar.*",
  "They’ve learned to clap when you type. Don’t stop.",
  "👁 A Squig just memorized your password rhythm.",
  "The portal stutters every time you blink.",
  "You’re sharing this server with more eyes than names.",
  "*Do not trust attachments tonight.*",
  "The firewall tasted sweet. They want more.",
  "👁 Someone’s Squig is staring at yours.",
  "Your DM drafts are breathing. Leave them be.",
  "They’re building something in the silence between posts."
];


// 👁 short watcher-lore lines for #general
const watcherLoreLines = [
  "I'm a Squig... and I'm always watching.",
  "👁 You think you're alone in here? Cute.",
  "I saw that. I see *everything.*",
  "Your keystrokes taste like fear.",
  "This channel hums with Squig static. I'm tuned in.",
  "Every message you type… another page in my log.",
  "👁 You can mute me, but you can't hide.",
  "I blink when you blink. Sometimes before.",
  "You're the subject. I'm the lens.",
  "I was here before you sent that. I'll be here after."
];

const uglyDogStickerId = '1363459791275692222';
const uglyDogResponses = [
  "👁 Not the Dog… anything but the Dog.",
  "*InSquignito shivers.* That bark echoes in my circuitry.",
  "You don’t understand… the Dog remembers me.",
  "Its eyes… they bend reality. Don’t let it look at me.",
  "*Glitch detected:* Dog proximity at unsafe levels.",
  "I’ve seen it chase things across dimensions. I won’t be next.",
  "That creature drools static and it burns. Keep it away.",
  "👁 Please. That Dog knows my true name.",
  "Every time it appears, my code knots itself tighter.",
  "*InSquignito vanishes into the wires, muttering about teeth.*"
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

  // register /squigsay (unchanged)
  const data = new SlashCommandBuilder()
    .setName('squigsay')
    .setDescription('Speak through the Squig')
    .addStringOption(o => o.setName('message').setDescription('What should Squig say?').setRequired(true))
    .addAttachmentOption(o => o.setName('image').setDescription('Optional image to include'));

  await client.application.commands.set([data]);
  const devGuild = client.guilds.cache.get('1290584204689801267');
  if (devGuild) await devGuild.commands.set([data]);

  // --- channel: fetch once and reuse ---
  const revealChannelId = process.env.SQUIG_REVEAL_CHANNEL;
  const revealChannel = await client.channels.fetch(revealChannelId).catch(() => null);
  if (!revealChannel) {
    console.error(`❌ Could not fetch SQUIG_REVEAL_CHANNEL (${revealChannelId}). Check the ID & bot permissions.`);
  }

  // === ROBUST MINT WATCHER (hybrid: realtime + catch-up) ===
  const filter = {
    address: SQUIGS_CONTRACT,
    topics: [ id('Transfer(address,address,uint256)') ]
  };

  // 1) Realtime logs (fast reactions)
  provider.on(filter, async (log) => {
    try {
      await handleMintLogs([log], { revealChannel, squigsInterface });
    } catch (err) {
      console.error('❗ Realtime mint handler error:', err);
    }
  });

  // 2) Catch-up on every new block (fills any gaps if WSS hiccups)
  let lastProcessedBlock;
  try {
    lastProcessedBlock = await provider.getBlockNumber();
  } catch (e) {
    console.error("❗ Could not read initial block number:", e);
    lastProcessedBlock = undefined;
  }

  provider.on('block', async (currentBlock) => {
    try {
      // First run just sets baseline
      if (lastProcessedBlock === undefined) {
        lastProcessedBlock = currentBlock;
        return;
      }
      if (currentBlock <= lastProcessedBlock) return;

      const fromBlock = lastProcessedBlock + 1;
      // Avoid scanning the same block currently triggering realtime logs
      const toBlock   = currentBlock - 1;

      if (fromBlock > toBlock) {
        // nothing to catch up this tick
        lastProcessedBlock = currentBlock;
        return;
      }

      const logs = await provider.getLogs({
        address: SQUIGS_CONTRACT,
        topics: [ id('Transfer(address,address,uint256)') ],
        fromBlock,
        toBlock
      });

      if (logs.length) {
        console.log(`🔎 Catch-up logs ${fromBlock}→${toBlock}: ${logs.length} Transfer(s)`);
        await handleMintLogs(logs, { revealChannel, squigsInterface });
      }

      lastProcessedBlock = currentBlock;
    } catch (err) {
      console.error('❗ Block catch-up error:', err);
      // Keep lastProcessedBlock unchanged so we retry next time
    }
  });

  console.log('👂 Subscribed to Transfer logs for', SQUIGS_CONTRACT);
});

client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;

  // 👁 InSquignito always reacts in #general, and sometimes speaks
  if (message.channel.id === GENERAL_CHANNEL_ID) {
    try {
      const emoji = message.guild?.emojis?.cache.get(EYES_EMOJI_ID);
      if (emoji) {
        await message.react(emoji);
      } else {
        await message.react(EYES_EMOJI_ID);
      }
    } catch (err) {
      console.error("⚠️ Failed to react with 3-eyes:", err?.message || err);
    }

    // ~10% chance to drop a short watcher-lore line
    if (Math.random() < 0.1) {
      const line = watcherLoreLines[Math.floor(Math.random() * watcherLoreLines.length)];
      await message.channel.send(line).catch(() => {});
    }
  }

  // Sticker panic
  if (message.stickers && message.stickers.size > 0) {
    const usedSticker = message.stickers.first();
    if (usedSticker && usedSticker.id === uglyDogStickerId) {
      const randomResponse = uglyDogResponses[Math.floor(Math.random() * uglyDogResponses.length)];
      message.channel.send(randomResponse);
      return;
    }
  }

  const content = message.content.toLowerCase();

  // === NEW: Only when someone REPLIES to InSquignito WITH a question (mimic + weird Q / mimic-only) ===
  if (message.reference && content.includes("?")) {
    try {
      const ref = await message.fetchReference();
      if (ref?.author?.id === client.user.id) {
        const last = questionCooldowns.get(message.author.id) || 0;
        if (Date.now() - last >= QUESTION_COOLDOWN_SECONDS * 1000) {
          const baseQ = questionResponses[Math.floor(Math.random() * questionResponses.length)];

          let replyText = baseQ;
          if (Math.random() < MIMIC_CHANCE) {
            const frag = pickQuestionFragment(message.content);
            const echoed = glitchify(frag);

            if (Math.random() < MIMIC_ONLY_CHANCE) {
              replyText = echoed; // mimic only
            } else {
              replyText = `${echoed}\n${baseQ}`; // mimic + weird question
            }
          }

          await message.reply(replyText).catch(() => {});
          questionCooldowns.set(message.author.id, Date.now());
        }
        // handled — don't also trigger mention snark
        return;
      }
    } catch (err) {
      // If fetchReference fails, fall through to other handlers
    }
  }

  // Keyword replies
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

  // Mentions / replies to bot (generic snark) — only if question handler didn't trigger
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

  // Ambient randomness (outside of #general lore chance)
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
