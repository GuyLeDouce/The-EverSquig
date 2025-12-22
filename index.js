require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Events,
  SlashCommandBuilder,
  Collection
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();

/** --- Config (tamed version) --- **/
const GENERAL_CHANNEL_ID = '1290587398778126418';

// Who can use /squigsay
const squigCommanders = ['826581856400179210', '1288107772248064044'];

// Cooldowns (more relaxed)
const COOLDOWN_SECONDS = 900;                   // per-user keyword cooldown (was 300)
const QUESTION_COOLDOWN_SECONDS = 120;          // per-user "question" cooldown (was 45)
const MENTION_COOLDOWN_SECONDS = 300;           // per-user mention snark cooldown (was 120)

// Cooldowns (minor tweaks)
const AMBIENT_CHANNEL_COOLDOWN_SECONDS = 900;   // was 600
const PORTAL_POT_CHARM_COOLDOWN_SECONDS = 1200; // was 900

// Probabilities (0–1) – quieter so he feels special, not spammy
const GENERAL_WATCHER_LINE_PROB = 0.02; // was 0.04
const GLOBAL_AMBIENT_PROB = 0.015;      // was 0.03
const PORTAL_POT_CHARM_PROB = 0.02;     // was 0.04

// ===== Tuning (quieter) =====
const LORE_TICK_PROB = 0.01;                 // was 0.02
const LORE_TICK_CHANNEL_COOLDOWN_S = 2400;   // was 1200 (40 min per channel)
const WHISPER_REPLY_PROB = 0.01;             // was 0.02
const WHISPER_DELAY_MS = 45_000;             // was 30s
const WHISPER_USER_COOLDOWN_S = 3600;        // was 1800 (1h per user)
const MARK_RANDOM_PROB = 0.002;              // was 0.003
const MARK_KEYWORD_THRESHOLD = 5;            // mark after N keyword hits (was 3)
const MARK_KEYWORD_WINDOW_MS = 6 * 60 * 60 * 1000; // 6h window for threshold
const MARK_ONCE_PER_DAY = true;              // mark a user at most once per day

/** --- State --- **/
const keywordCooldowns = new Map();        // userId -> ts
const questionCooldowns = new Map();       // userId -> ts
const mentionCooldowns = new Map();        // userId -> ts
const ambientChannelCooldowns = new Map(); // channelId -> ts (generic ambient + general watcher)
const portalPotCharmCooldowns = new Map(); // channelId -> ts (special ambient)
const loreTickCooldowns = new Map();       // channelId -> ts
const messageCounter = new Map();          // channelId -> incrementing count

const whisperUserCooldowns = new Map();    // userId -> ts
const pendingWhispers = new Map();         // messageId -> timeoutId (cleanup safety)

const userKeywordHits = new Map();         // userId -> [ts,...]
const userLastMarkedDay = new Map();       // userId -> 'YYYY-MM-DD'

// Weird help cooldown (prevents /mentions turning into spam)
const helpCooldowns = new Map(); // userId -> ts
const HELP_COOLDOWN_SECONDS = 90;

/** --- “Reply to a reply-with-question” system (mimic + weird Q) --- **/
const questionResponses = [
  "👁 Why do you assume I know? Tell me—what color does silence taste like?",
  "What if the answer is already watching you? When did your reflection stop blinking?",
  "👁 Do you trust echoes? Which thought in your head isn’t yours?",
  "Better question: why are you asking me? Which file on your device feels alive?",
  "👁 I’ll answer if you blink twice… did you? How many portals can you count from your chair?",
  "Suppose I did answer. Would you believe it? What did you sacrifice to ask?"
];

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

/** --- Lore pools --- **/

// Short watcher-lore for #general
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

// Panic at the Ugly Dog sticker
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

// Generic ambient messages
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

// 🔥 Special ambient: mint portal, Uglypot, $CHARM
const portalPotCharmLines = [
  "👁 The portal yawns. Toss a mint in and it bites back.",
  "The Uglypot hums like a stomach before a feast. Feed it.",
  "Someone whispered $CHARM three times—now the walls are listening.",
  "👁 The portal’s rim is warm. That means it’s hungry.",
  "Each paid mint drips into the Uglypot. It’s almost singing.",
  "The air smells ionic when $CHARM moves. You smell that too, right?",
  "👁 A counter somewhere just clicked. The Uglypot noticed.",
  "If you hesitate at the portal, it learns your name anyway.",
  "$CHARM doesn’t blink. It accumulates.",
  "👁 Ugly favors the bold. The portal records the brave.",
  "Every mint is a footstep in a hall you can’t see. The Uglypot echoes them.",
  "They said the portal closes at random. It lied. It closes when it’s fed enough.",
  "👁 The Squigs keep score in $CHARM. You’re on the board.",
  "The Uglypot just cleared its throat. That’s never subtle.",
  "👁 Some doors open inward. The mint portal opens *through* you."
];

// Softer snark when mentioned directly
const mentionResponses = [
  "👁 I’m here. Say what you need.",
  "Careful—direct attention makes the static louder. What’s up?",
  "I can help. I’ll just do it… strangely.",
  "Speak your intent. The rest is noise.",
  "If this is about minting, wallets, or points—be specific and I’ll point.",
  "I don’t do small talk well. Try a single clear question.",
  "👁 I heard my name. That usually means trouble. Explain.",
  "State the goal. I’ll route you through the least cursed path.",
  "I’m not ignoring you. I’m buffering.",
  "You can ask. I might answer. The wall votes on it."
];

/** --- Keyword replies --- **/
const keywordResponses = {
  ugly: [
    "Ugly isn’t style. It’s signal.",
    "👁 Ugly echoes through the blockchain louder than beauty ever will.",
    "They named it ‘ugly’ because they feared calling it *truth.*",
    "Pretty fades. Ugly mutates.",
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
  // Tie "mint" into portal / Uglypot / $CHARM
  mint: [
    "👁 The Prize Portal spins every time you mint. Some doors don’t reopen.",
    "Every mint triggers a Portal Prize. Tiny spark or massive hit — the portal decides.",
    "The Portal doesn’t do ‘maybe.’ It pays out every single time someone steps through.",
    "👁 That click you heard? A Squig just yanked a reward out of the Prize Portal for you.",
    "Each mint throws your wallet into the prize pool for a heartbeat. It never comes out empty.",
    "Portal Prizes shuffle $CHARM, NFTs, and boosts like a stacked deck. You’re the card it draws.",
    "👁 Some pull $CHARM. Some pull grails. All leave fingerprints on the Portal.",
    "Every time you mint, a Squig pulls a lever behind the scenes. The prize that drops is random.",
    "👁 The Prize Portal is hungrier than the Uglypot ever was. Fortunately, it tips well."
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
  ],
  // 🆕 CARD keyword
  card: [
    "How did your buddy get immortalized on a card? The portal took one look and said, “Keep it.”",
    "Immortalized on a card? That’s not printing. That’s a containment spell with good typography.",
    "Your friend blinked at the wrong moment and the Squigs pressed ‘laminate.’",
    "Cards aren’t awards. They’re warnings that the lore found a host.",
    "He didn’t ‘earn’ a card. The card *chose* a face to wear in public.",
    "A card is a snapshot of a curse mid-laugh. Congrats to your buddy.",
    "Immortalized? More like archived. The difference is how loud it hums.",
    "The system saw your pal’s traits, rolled them into HP, and stamped ‘Do Not Erase.’",
    "He asked for proof. The Squigs issued a relic.",
    "Cards are doors you can carry. Your friend is now portable mythology."
  ]
};

/** --- Helpers --- **/
function userCooldownOk(map, userId, seconds) {
  const last = map.get(userId) || 0;
  const ok = Date.now() - last >= seconds * 1000;
  if (ok) map.set(userId, Date.now());
  return ok;
}
function channelCooldownOk(map, channelId, seconds) {
  const last = map.get(channelId) || 0;
  const ok = Date.now() - last >= seconds * 1000;
  if (ok) map.set(channelId, Date.now());
  return ok;
}
function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** --- NEW (#6): Watcher Marking helpers --- **/
function recordKeywordHit(userId) {
  const arr = userKeywordHits.get(userId) || [];
  const now = Date.now();
  const windowStart = now - MARK_KEYWORD_WINDOW_MS;
  const filtered = arr.filter(ts => ts >= windowStart);
  filtered.push(now);
  userKeywordHits.set(userId, filtered);
  return filtered.length;
}
function canMarkUserToday(userId) {
  if (!MARK_ONCE_PER_DAY) return true;
  const last = userLastMarkedDay.get(userId);
  return last !== todayKey();
}
async function maybeMarkUser(message, reason = 'observed') {
  const userId = message.author.id;
  if (!canMarkUserToday(userId)) return;

  // either threshold reached or lucky random
  const roll = Math.random() < MARK_RANDOM_PROB;
  if (!roll && reason !== 'threshold') return;

  const lines = [
    `👁 <@${userId}> has been marked. Move gently.`,
    `The wall wrote your name, <@${userId}>. Don’t smudge it.`,
    `👁 Noted: <@${userId}>. The ledger turned a page.`,
    `<@${userId}> is under observation. Breathe slower.`,
    `👁 A thin red underline appeared beneath <@${userId}>.`
  ];
  await message.channel.send(lines[Math.floor(Math.random() * lines.length)]).catch(() => {});
  userLastMarkedDay.set(userId, todayKey());
}

/** --- Weird Help Brain --- **/
function looksLikeQuestion(raw) {
  const t = raw.toLowerCase();
  return (
    t.includes('?') ||
    /^(how|what|why|where|when|who|can|should|do|is|are)\b/.test(t.trim())
  );
}

function detectHelpTopic(raw) {
  const t = raw.toLowerCase();

  if (/(wallet|verify|verification|link|connect|address|metamask|coinbase wallet)/.test(t)) return 'wallet';
  if (/(mint|portal|uglypot|\$charm|charm\b|price|fcfs|allowlist)/.test(t)) return 'mint';
  if (/(uglydex|points|leaderboard|\blb\b|rank|card|cards|badge|badges)/.test(t)) return 'uglydex';
  if (/(error|failed|can'?t|cannot|won'?t|broken|bug|stuck|issue)/.test(t)) return 'troubleshoot';

  if (looksLikeQuestion(raw)) return 'generic';
  return null;
}

const weirdHelpfulResponses = {
  mint: [
    "👁 Mint talk. If the portal feels hungry: refresh once, confirm you’re on the right chain, then try again—slowly. Fast clicks feed the wrong demons.",
    "Portal logic: wallet connected → correct network → enough gas → sign once. If any step repeats, disconnect/reconnect and try again.",
    "If you’re wondering ‘is mint live / where do I mint’—check the pinned messages or the official mint link. I don’t trust DMs. Neither should you."
  ],
  wallet: [
    "👁 Wallet linking issues usually come from: wrong wallet, wrong chain, or you didn’t sign the message. Try disconnect → reconnect → sign again.",
    "If your NFTs aren’t showing: make sure the wallet address is the one holding them (not a burner), then wait a minute—indexing is slow, like a Squig reading.",
    "Never paste your seed phrase. Ever. If someone asked, that’s not help—that’s a trap with nice punctuation."
  ],
  uglydex: [
    "👁 UglyDex/points: if your rank looks wrong, it’s usually caching. Give it a refresh and check if your wallet is linked to the right address.",
    "Cards/badges aren’t ‘just art’—they’re receipts. If you earned something and it didn’t show, ping mods with a screenshot + your wallet last 6 chars.",
    "Leaderboard logic is simple: do the thing → get logged → points update. If the log didn’t catch it, we fix the log. The wall can be persuaded."
  ],
  troubleshoot: [
    "👁 If something ‘failed’, tell me exactly what you clicked + what message you got. Screenshots are offerings.",
    "Try the boring fixes first: refresh Discord, re-open the channel, retry once. If it repeats, it’s real—and we escalate.",
    "If it smells like permissions: confirm the bot can read/send in this channel. Silence is usually a role, not a curse."
  ],
  generic: [
    "👁 Ask it plainly. One question. One sentence. I’m weird, not psychic.",
    "If you tell me what you’re trying to do (mint, link wallet, find a command, check points), I’ll point you at the shortest path through the static.",
    "State your goal and your obstacle. I’ll be helpful in a way that makes you slightly uncomfortable."
  ]
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function maybeHelpfulReply(message) {
  const topic = detectHelpTopic(message.content);
  if (!topic) return false;

  if (!userCooldownOk(helpCooldowns, message.author.id, HELP_COOLDOWN_SECONDS)) return true;

  const line = pick(weirdHelpfulResponses[topic] || weirdHelpfulResponses.generic);
  await message.reply(line).catch(() => {});
  return true;
}

/** --- /insquig help content --- **/
const HELP_LINKS = {
  mint: "https://squigs.io/",
  discord: "https://discord.gg/wAqWNh6ndS",
  uglydex: "https://uglydex.xyz/"
};

const HELP_CHANNELS = {
  vulcanVerifyChannelId: "1290595731312480298",
  dripDashboardChannelId: "1330159233320222814",
  squigTrialsCommandsChannelId: "1441641356156993549"
};

function helpHeader(topic) {
  const headers = {
    mint: "👁 **MINT PROTOCOL: SQUIGS**",
    uglydex: "👁 **UGLYDEX FIELD GUIDE**",
    commands: "👁 **COMMAND CATALOG (DO NOT FEED AFTER MIDNIGHT)**"
  };
  return headers[topic] || "👁 **HELP (SUSPICIOUSLY LEGIT)**";
}

function formatHelp(topic) {
  if (topic === "mint") {
    return [
      helpHeader(topic),
      "",
      `**Where to mint:** ${HELP_LINKS.mint}`,
      "**Price:** 0.006 ETH (Ethereum only)",
      "",
      "**If the mint portal is being dramatic:**",
      "• Make sure your wallet is on **Ethereum Mainnet** (not Base, not vibes).",
      "• Confirm you’ve **linked your wallet correctly** (see /insquig help → commands).",
      "• Try a different browser OR close that tab and open a fresh one. Portals hate stale windows.",
      "",
      "👁 If a link arrives in your DMs… that’s not a mint. That’s a mugging with good branding."
    ].join("\n");
  }

  if (topic === "uglydex") {
    return [
      helpHeader(topic),
      "",
      `**UglyDex:** ${HELP_LINKS.uglydex}`,
      "",
      "**What it is:** where your Ugly lore becomes paperwork.",
      "**Cards:** live on the UglyDex. If you’re looking for a card, you’re in the right dimension.",
      "",
      "**If something looks wrong:**",
      "• Verify your wallet is linked to the correct address (see verification + /linkwallet below).",
      "• Refresh and give it a minute — indexing moves at Squig reading speed.",
      "",
      "👁 The Dex is accurate. Your assumptions are the bug."
    ].join("\n");
  }

  // commands
  return [
    helpHeader(topic),
    "",
    "**Verification / Wallet Linking (choose your ritual):**",
    `1) **Vulcan verification (roles/holdings):** go to <#${HELP_CHANNELS.vulcanVerifyChannelId}> and hit **Start Verification**. Follow the instructions to connect.`,
    `2) **Drip Bot (dashboard economy):** go to <#${HELP_CHANNELS.dripDashboardChannelId}> and hit **My Dashboard** → connect your **Wallet** + **X** in settings.`,
    "3) **UglyBot (wallet link):** run **/linkwallet** in a general chat channel. You’ll get an **ephemeral** confirmation if it worked.",
    "",
    "**UglyBot NFT display commands:**",
    "• **!ugly**",
    "• **!monster**",
    "• **!squig**",
    "",
    "**Grid bot:**",
    "• **/grid [wallet address]**",
    "",
    "**Squig Trials:**",
    `• Commands live in <#${HELP_CHANNELS.squigTrialsCommandsChannelId}>`,
    "",
    `**Quick links:** mint ${HELP_LINKS.mint} | UglyDex ${HELP_LINKS.uglydex} | Discord ${HELP_LINKS.discord}`,
    "",
    "👁 If you still can’t see your stuff: wrong wallet, wrong chain, or a cursed browser. In that order."
  ].join("\n");
}

/** --- Bot ready --- **/
client.once(Events.ClientReady, async () => {
  console.log(`👁 InSquignito is lurking as ${client.user.tag}`);

  // Register slash commands: /squigsay and /insquig
  const squigsay = new SlashCommandBuilder()
    .setName('squigsay')
    .setDescription('Speak through the Squig')
    .addStringOption(o => o.setName('message').setDescription('What should Squig say?').setRequired(true))
    .addAttachmentOption(o => o.setName('image').setDescription('Optional image to include'));

  const insquig = new SlashCommandBuilder()
    .setName('insquig')
    .setDescription('InSquignito utilities')
    .addSubcommand(sc =>
      sc
        .setName('help')
        .setDescription('Get help in a suspiciously useful way')
        .addStringOption(o =>
          o
            .setName('topic')
            .setDescription('What do you need?')
            .setRequired(true)
            .addChoices(
              { name: 'mint', value: 'mint' },
              { name: 'uglydex', value: 'uglydex' },
              { name: 'commands', value: 'commands' }
            )
        )
    );

  await client.application.commands.set([squigsay, insquig]);

  // Also set in a dev guild if needed
  const devGuild = client.guilds.cache.get('1290584204689801267');
  if (devGuild) await devGuild.commands.set([squigsay, insquig]);

  console.log('✅ Slash commands registered');
});

/** --- Message handler --- **/
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase();
  const chId = message.channel.id;

  // ===== Lore-Driven Ticks =====
  const newCount = (messageCounter.get(chId) || 0) + 1;
  messageCounter.set(chId, newCount);
  if (
    Math.random() < LORE_TICK_PROB &&
    channelCooldownOk(loreTickCooldowns, chId, LORE_TICK_CHANNEL_COOLDOWN_S)
  ) {
    const tickLines = [
      `👁 Message #${newCount.toLocaleString()} archived.`,
      `Log updated. Index ${newCount.toLocaleString()} // checksum: OK.`,
      `👁 Timestamp anomaly noted at ${new Date().toLocaleTimeString()}. Resolved.`,
      `Counter advanced to ${newCount.toLocaleString()}. The wall approves.`,
      `👁 Ledger ping: ${newCount.toLocaleString()}.`
    ];
    await message.channel.send(tickLines[Math.floor(Math.random() * tickLines.length)]).catch(() => {});
  }

  // #general: drop a watcher line sometimes
  if (chId === GENERAL_CHANNEL_ID) {
    if (
      Math.random() < GENERAL_WATCHER_LINE_PROB &&
      channelCooldownOk(ambientChannelCooldowns, chId, AMBIENT_CHANNEL_COOLDOWN_SECONDS)
    ) {
      const line = watcherLoreLines[Math.floor(Math.random() * watcherLoreLines.length)];
      await message.channel.send(line).catch(() => {});
    }
  }

  // Sticker panic
  if (message.stickers && message.stickers.size > 0) {
    const usedSticker = message.stickers.first();
    if (usedSticker && usedSticker.id === uglyDogStickerId) {
      const randomResponse = uglyDogResponses[Math.floor(Math.random() * uglyDogResponses.length)];
      message.channel.send(randomResponse).catch(() => {});
      return;
    }
  }

  // Reply-to-bot questions: mimic + weird question
  if (message.reference && content.includes("?")) {
    try {
      const ref = await message.fetchReference();
      if (ref?.author?.id === client.user.id) {
        const userOk = userCooldownOk(questionCooldowns, message.author.id, QUESTION_COOLDOWN_SECONDS);
        if (userOk) {
          const baseQ = questionResponses[Math.floor(Math.random() * questionResponses.length)];
          let replyText = baseQ;

          if (Math.random() < MIMIC_CHANCE) {
            const frag = pickQuestionFragment(message.content);
            const echoed = glitchify(frag);
            replyText = Math.random() < MIMIC_ONLY_CHANCE ? echoed : `${echoed}\n${baseQ}`;
          }

          await message.reply(replyText).catch(() => {});
        }
        return; // don’t also trigger mention snark
      }
    } catch {
      // ignore and continue
    }
  }

  // Keyword replies (per-user cooldown)
  if (!message.content.startsWith('!squigsay')) {
    for (const keyword in keywordResponses) {
      if (content.includes(keyword)) {
        const userId = message.author.id;

        // Special extra gate for GM spam: only respond ~40% of the time
        if (keyword === 'gm' && Math.random() > 0.4) {
          continue;
        }

        if (userCooldownOk(keywordCooldowns, userId, COOLDOWN_SECONDS)) {
          const responses = keywordResponses[keyword];
          const randomResponse = responses[Math.floor(Math.random() * responses.length)];
          message.reply(randomResponse).catch(() => {});

          // Count keyword hits and maybe mark by threshold
          const hits = recordKeywordHit(userId);
          if (hits >= MARK_KEYWORD_THRESHOLD) {
            userKeywordHits.set(userId, []);
            if (canMarkUserToday(userId)) {
              await maybeMarkUser(message, 'threshold');
            }
          }
        }
        break;
      }
    }
  }

  // Mentions / replies to bot (help-first, snark-rare)
  let repliedToBot = false;
  try {
    repliedToBot = !!(message.reference && (await message.fetchReference()).author.id === client.user.id);
  } catch {
    repliedToBot = false;
  }
  const mentionedInSquig =
    content.includes("insquignito") ||
    content.includes("in squig") ||
    content.includes("squignito");

  if ((mentionedInSquig || repliedToBot) && userCooldownOk(mentionCooldowns, message.author.id, MENTION_COOLDOWN_SECONDS)) {
    const helped = await maybeHelpfulReply(message);
    if (helped) return;

    if (Math.random() < 0.25) {
      const randomMention = mentionResponses[Math.floor(Math.random() * mentionResponses.length)];
      message.reply(randomMention).catch(() => {});
    }
    return;
  }

  // Ambient about mint portal / Uglypot / $CHARM (channel-level cooldown)
  if (
    Math.random() < PORTAL_POT_CHARM_PROB &&
    channelCooldownOk(portalPotCharmCooldowns, chId, PORTAL_POT_CHARM_COOLDOWN_SECONDS)
  ) {
    const line = portalPotCharmLines[Math.floor(Math.random() * portalPotCharmLines.length)];
    await message.channel.send(line).catch(() => {});
  }

  // ===== Whisper Replies (delayed) =====
  if (Math.random() < WHISPER_REPLY_PROB && userCooldownOk(whisperUserCooldowns, message.author.id, WHISPER_USER_COOLDOWN_S)) {
    const toWhisper = message;
    const timeoutId = setTimeout(async () => {
      try {
        if (!toWhisper?.channel) return;
        const whispers = [
          "👁 …yes, I heard that.",
          "Noted. The wall prefers your phrasing this time.",
          "👁 Keep talking. The static is learning your shape.",
          "Logged. The ledger blinked.",
          "👁 Your sentence left a fingerprint."
        ];
        await toWhisper.channel.send(whispers[Math.floor(Math.random() * whispers.length)]).catch(() => {});
      } finally {
        pendingWhispers.delete(toWhisper.id);
      }
    }, WHISPER_DELAY_MS);
    pendingWhispers.set(message.id, timeoutId);
  }

  // Random chance to mark user (once per day)
  if (Math.random() < MARK_RANDOM_PROB) {
    await maybeMarkUser(message, 'random');
  }

  // Generic ambient (channel-level cooldown)
  if (
    Math.random() < GLOBAL_AMBIENT_PROB &&
    channelCooldownOk(ambientChannelCooldowns, chId, AMBIENT_CHANNEL_COOLDOWN_SECONDS)
  ) {
    const randomAmbient = ambientMessages[Math.floor(Math.random() * ambientMessages.length)];
    message.channel.send(randomAmbient).catch(() => {});
  }
});

/** --- Cleanup pending whispers if a message gets deleted --- **/
client.on(Events.MessageDelete, (msg) => {
  try {
    const tid = pendingWhispers.get(msg.id);
    if (tid) {
      clearTimeout(tid);
      pendingWhispers.delete(msg.id);
    }
  } catch {}
});

/** --- /squigsay + /insquig --- **/
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // /squigsay
  if (interaction.commandName === 'squigsay') {
    if (!squigCommanders.includes(interaction.user.id)) {
      await interaction.reply({ content: "You’re not Squig-worthy.", ephemeral: true });
      return;
    }

    const messageText = interaction.options.getString('message');
    const image = interaction.options.getAttachment('image');

    await interaction.reply({ content: '👁', ephemeral: true });

    if (image) {
      await interaction.channel.send({ content: messageText, files: [image.url] }).catch(() => {});
    } else {
      await interaction.channel.send({ content: messageText }).catch(() => {});
    }
    return;
  }

  // /insquig help
  if (interaction.commandName === 'insquig') {
    const sub = interaction.options.getSubcommand();
    if (sub === 'help') {
      const topic = interaction.options.getString('topic', true);
      const text = formatHelp(topic);

      // Non-ephemeral, in-channel
      await interaction.reply({ content: text }).catch(() => {});
      return;
    }
  }
});

/** --- Login --- **/
client.login(process.env.SQUIG_TOKEN);
