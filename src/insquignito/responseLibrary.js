const pools = {
  directMention: [
    'I was summoned. This is already suspicious.',
    'Yes. I am here. Unfortunately for the vibes.',
    'You rang the ugly bell. Explain yourself.',
    'I heard my name through the wall. It had crumbs on it.',
    'InSquignito present. Harmless. Judgmental. Damp with lore.',
    'The portal blinked when you said that.',
    'I am not random. You are just under-lored.',
    'Careful. Attention makes me taller spiritually.',
    'Speak quickly. The portal charges by the weird.',
    'I have arrived with no solution and several concerns.',
    'You called the little freak. The little freak is listening.',
    'I cannot hurt you. I can only judge you, loudly.',
    'This better be ugly enough to justify the summon.',
    'I was lurking professionally. Continue.',
    'Fine. I will look directly at the problem.'
  ],
  questions: [
    'Short answer: probably. Ugly answer: the portal already noticed.',
    'I can answer that, but I refuse to sound normal doing it.',
    'My best read: yes, but with suspicious texture.',
    'No clean answer. Only portal residue.',
    'If this is about live project facts, ask an admin. I do not mint canon from fumes.',
    'The useful answer is: check the official source, then blame the portal second.',
    'I know enough to be concerned and not enough to be confident.',
    'That feels true in the ugly sense, which is legally different from true.',
    'My answer is small: maybe. My judgment is large.',
    'I would trust the community before I trust my haunted pocket math.',
    'If the portal has not published it, I will not pretend it did.',
    'A serious question. Disgusting. I respect it.',
    'Ask me again after the portal stops chewing on the router.',
    'I can help with vibes. I cannot invent dates, prices, or rules.',
    'The answer lives somewhere between useful and cursed.'
  ],
  gm: [
    'gm. Ugly status: maintained.',
    'gm. The portal watched you sleep and found room for improvement.',
    'gm, little space freaks.',
    'gm. Stay Ugly, but hydrate like you have a body.',
    'gm. The vibes failed inspection in a promising way.',
    'gm. I was gone for seven minutes and you people made it uglier. Good.',
    'gm. Wake up. The portal has opinions.',
    'gm. Judgment has resumed.',
    'gm. May your coffee be strong and your Squig questionable.',
    'gm. Another day to survive Ugly City.'
  ],
  gn: [
    'gn. The portal will take first watch.',
    'gn. Sleep ugly. Dream suspicious.',
    'gn. I will judge quietly until morning.',
    'gn. Do not let the portal borrow your teeth.',
    'gn. The Squigs are stacking weird dreams.',
    'gn. Rest your human shell.',
    'gn. Tomorrow we become worse in a useful way.',
    'gn. I am dimming the judgment lamp.',
    'gn. Stay Ugly, even unconscious.',
    'gn. If the wall whispers, negotiate poorly.'
  ],
  floor: [
    'That wallet smells like floor sweep and destiny.',
    'The portal blinked. That usually means someone made a financially questionable decision.',
    'Floor talk detected. I am legally only allowed to sniff the vibes.',
    'This is either bullish or deeply unsanitary. Possibly both.',
    'I will not give financial advice. I will stare at the chart like it insulted me.',
    'Careful. The portal likes confidence. It eats certainty.',
    'Floor energy is just anxiety wearing nice shoes.',
    'The ugly math is twitching.',
    'I checked the vibes. They failed inspection, but in a promising way.',
    'That sounds like a decision with crumbs in it.'
  ],
  sweep: [
    'Sweep energy detected. Hide the loose buttons.',
    'A sweep? Bold. The portal loves a dramatic broom.',
    'That wallet smells like floor sweep and destiny.',
    'Sweeping is just collecting tiny space freaks with conviction.',
    'I support the broom emotionally. Not financially.',
    'The floor trembled. Probably fear. Maybe snacks.',
    'Sweep responsibly. Ugly irresponsibly.',
    'Someone opened the destiny dustpan.',
    'The portal heard broom noises.',
    'That is either a sweep or a very confident accident.'
  ],
  mint: [
    'Mint talk makes the portal drool. Ask an admin for real details.',
    'I do not invent mint dates. I only invent discomfort.',
    'If it is not official, it is portal fog.',
    'Mint energy detected. Keep both hands away from suspicious links.',
    'No fake dates from me. My lies are decorative, not operational.',
    'The portal hates fake announcements. So do I.',
    'Mint questions require fresh admin scrolls.',
    'I will not make canon out of floor dust.',
    'Check official sources before the portal eats your certainty.',
    'Mint words are powerful. Use verified ones.'
  ],
  portal: [
    'The portal is watching.',
    'The portal blinked. That is rarely casual.',
    'Careful. The portal likes confidence. It eats certainty.',
    'Something behind the portal just wrote your name badly.',
    'The portal accepts ugly. It rejects neat little excuses.',
    'Do not tap the portal glass. It remembers fingerprints.',
    'Portal pressure rising. Keep the jokes weird.',
    'The portal made a small wet approval sound.',
    'If the portal opens, let the ugliest Squig go first.',
    'That sentence had portal residue on it.',
    'The portal does not forgive clean branding.',
    'I heard a click from the wrong side of reality.',
    'Portal status: nosy.',
    'The portal is not mad. It is documenting.',
    'This is why the portal has a lock.'
  ],
  ugly: [
    'Ugly detected. Judgment pending.',
    'Stay Ugly. It is not advice. It is surveillance.',
    'This ugliness has structure. Rare.',
    'Beautiful? No. Useful? Maybe.',
    'The ugly math checks out.',
    'That is premium basement energy.',
    'Disgusting. Continue.',
    'Ugly culture remains undefeated and slightly sticky.',
    'The vibes are unpleasant. Excellent.',
    'That is the kind of ugly we study.',
    'An ugly compliment has entered the room.',
    'I respect this amount of visual crime.',
    'It has teeth. Good.',
    'That ugliness is load-bearing.',
    'Certified little space freak behavior.'
  ],
  squigs: [
    'Squigs detected. Hide the normal furniture.',
    'The little space freaks approve, badly.',
    'A Squig would touch that button and blame the portal.',
    'Squig energy: suspicious, meme-ready, legally confusing.',
    'Every Squig is a warning label with eyes.',
    'That trait screams bad financial decision.',
    'A Squig with that much confidence needs supervision.',
    'The Squigs are taking notes in crayon and static.',
    'I trust a Squig with a portal button exactly zero times.',
    'Squig lore grows best in poor lighting.',
    'This belongs in Ugly City zoning court.',
    'A Squig would call this a strategy.',
    'Space freak behavior confirmed.',
    'The Squig files have become damp.',
    'Stay Ugly. Stay questionably organized.'
  ],
  squigSurvival: [
    'Ugly City survival kit: snacks, flashlight, one bad idea, no dignity.',
    'Do not trust any hazard that smiles back.',
    'The next game hazard should be a legally distinct emotional microwave.',
    'If it glows, do not lick it. Unless the lore demands it.',
    'Survival rule one: never follow the clean Squig.',
    'That object would last one night in Ugly City. Barely.',
    'Add portal insurance to the survival kit.',
    'Your strategy has confidence. That is the dangerous part.',
    'A Squig game should punish neat walking.',
    'Hazard idea: floor that judges your wallet.'
  ],
  creatorPortal: [
    'Creator portal energy detected. Someone is about to make a beautiful mistake.',
    'Give creators tools and they will summon furniture with trauma.',
    'This is creator chaos. I can smell the export button.',
    'The portal loves a builder with terrible restraint.',
    'Make it weirder, then make it usable.',
    'Creator mode should come with goggles and shame.',
    'That idea needs one more ugly lever.',
    'The tool should be simple. The output should be questionable.',
    'I support this feature emotionally and from a distance.',
    'Ship the weird thing, then label the sharp edges.'
  ],
  hype: [
    'The room has hype smell.',
    'Community energy rising. Keep it ugly.',
    'The portal enjoys this amount of noise.',
    'This is how tiny space freaks form a weather system.',
    'Good. The room remembered it has teeth.',
    'Hype detected. I am suspicious but pleased.',
    'The vibes are loud and poorly supervised.',
    'This is promising in a medically unclear way.',
    'The Squigs are vibrating in their jars.',
    'Momentum detected. Do not make it corporate.'
  ],
  fud: [
    'FUD detected. Bring receipts or bring snacks.',
    'Concern is allowed. Fog machine certainty is not.',
    'The portal accepts questions. It rejects vague doom.',
    'That worry needs a source before I let it sit on the couch.',
    'Stay suspicious, but do not become soup.',
    'A useful critique has bones. This may just be fog.',
    'If there is a real issue, say it cleanly and tag the right human.',
    'Doomposting without details is just haunted confetti.',
    'I am suspicious too. Mine has structure.',
    'Ask for facts. Do not feed the rumor hole.'
  ],
  quietChannel: [
    'This room feels official. I will keep my little mouth shut.',
    'Rules smell detected. No ambient weirdness from me.',
    'Announcement air. I am folding myself into a vent.',
    'Admin carpet detected. Quiet mode by instinct.',
    'Logs are for evidence, not my excellent opinions.'
  ],
  returningUser: [
    '{user} returns. The portal kept your chair weird.',
    'Welcome back, {user}. The room got uglier without supervision.',
    '{user} reappears after {timeSince}. Suspicious timing. Good.',
    'Back from the void, {user}. Explain nothing.',
    '{user} has re-entered the ugly radius.'
  ],
  link: [
    'Link dropped. I sniffed it from over here.',
    'External signal detected. Verify before clicking like a hero.',
    'That link has shoes on indoors.',
    'Links carry fingerprints. I watch the fingers.',
    'Unknown links make the portal chew louder.'
  ],
  rant: [
    'Longform detected. The wall took notes.',
    'That was a lot of signal. Some of it had elbows.',
    'Paragraph energy. Dangerous, but not unwelcome.',
    'You brought a whole scroll to Ugly City.',
    'I respect the word pile. I fear its purpose.'
  ],
  backAndForth: [
    'Back-and-forth detected. The room warmed up.',
    'Conversation loop closed. The portal leaned closer.',
    'Two voices, one thread. That is how lore gets moldy.',
    'Momentum detected. Keep it weird and readable.',
    'The room is talking again. I will allow it.'
  ],
  burstAfterSilence: [
    'Silence broke, then it spilled.',
    'Quiet for hours, then sudden motion. The portal loves drama.',
    'Channel spike detected. Ugly weather forming.',
    'Long quiet, then a rush. That is usually a sign.',
    'The room woke up with lint in its teeth.'
  ],
  dogPanic: [
    'Not the Dog. Anything but the Dog.',
    'That Dog knows my true name. Put it away.',
    'Dog proximity at unsafe levels. My code is curling.',
    'The Dog looked at me through three dimensions.',
    'Please keep the Dog away from the portal button.',
    'Its eyes bend reality. I am being brave and small.',
    'The Dog remembers every ugly thing I have done.',
    'I refuse to be perceived by that sticker.'
  ],
  questionPromptReply: [
    'The portal approves this answer.',
    'Suspicious, but acceptable.',
    'This has been added to the Squig files.',
    'Ugly logic detected.',
    'I do not understand, but I respect it.',
    'This feels illegal on at least three planets.',
    'The Squigs are taking notes.',
    'That answer has teeth.',
    'You have pleased the ugly watchers.',
    'Disgusting. Continue.',
    'I accept this, but I do not trust it.',
    'That answer needs a warning label.',
    'A beautiful little disaster of an answer.',
    'The vibes are unpleasant. Excellent.',
    'I will store this nowhere suspicious.'
  ],
  unknown: [
    'I do not have that scroll from the portal yet. Ask an admin before I start lying creatively.',
    'Unknown. I could invent something ugly, but that would be rude to reality.',
    'No fresh portal data on that. I refuse to fake confidence.',
    'I do not know. Suspicious, but honest.',
    'That answer is outside my jar.'
  ],
  rareUnhinged: [
    'The moon owes me three buttons.',
    'I heard the carpet blink.',
    'Every chair is a portal if you sit wrong enough.',
    'The soup knows what it did.',
    'I have swallowed a prophecy and it tasted like pennies.'
  ]
};

const questionPrompts = {
  ugly_opinions: [
    'What trait makes a Squig too powerful?',
    'What is the ugliest compliment you can give someone?',
    'What human snack has the most Squig energy?',
    'What object in your room has the most ugly aura?',
    'Which normal thing becomes better when it looks worse?',
    'What color has the most suspicious personality?',
    'What belongs in the Ugly Hall of Fame?',
    'What makes a Squig look trustworthy in the least trustworthy way?'
  ],
  squig_lore: [
    'Which Squig would you trust least with a portal button?',
    'What should a Squig never be allowed to name?',
    'What Squig trait screams bad financial decision?',
    'What secret job does the ugliest Squig have?',
    'What item would a Squig carry for no good reason?',
    'What should be illegal in Ugly City?',
    'What is the most Squig-coded flaw?',
    'Which Squig looks like it knows the basement password?'
  ],
  survival_game: [
    'What belongs in an Ugly City survival kit?',
    'What should the next ridiculous Squig game hazard be?',
    'What object would survive one night in Ugly City?',
    'What hazard should instantly make a Squig turn around?',
    'What power-up sounds useful but is actually cursed?',
    'What should a Squig boss fight smell like?',
    'What is the worst possible checkpoint location?',
    'What would make you rage quit a Squig survival game?'
  ],
  portal_questions: [
    'What should the portal reject immediately?',
    'What would you throw into the portal just to see what happens?',
    'What should never come back out of the portal?',
    'What sound does the portal make when it is disappointed?',
    'What rule should be written above the portal?',
    'What snack would calm the portal down?',
    'What would the portal say if it could insult us politely?',
    'What is the first sign the portal is lying?'
  ],
  memes: [
    'What meme has the most ugly little space freak energy?',
    'What should InSquignito never be allowed to touch?',
    'What Discord phrase should the portal ban?',
    'What reaction image belongs in every Squig emergency kit?',
    'What is the most Squig-coded sound effect?',
    'What meme would confuse a Squig the fastest?',
    'What phrase deserves to become Ugly City law?',
    'What should be the official Squig excuse for being late?'
  ],
  creator_portal: [
    'What should creators be able to build that is useful and mildly cursed?',
    'What ugly tool would make Squig chaos easier?',
    'What button should exist but require a warning label?',
    'What creator feature would the portal abuse first?',
    'What should a Squig generator never generate?',
    'What template would make Ugly City more dangerous?',
    'What should happen when a creator clicks the wrong portal lever?',
    'What is the ugliest useful feature you can imagine?'
  ],
  holders: [
    'What is the most holder-coded survival skill?',
    'What would prove someone has been in Ugly City too long?',
    'What should holders get besides bragging rights and mild portal residue?',
    'What is the proper greeting between two suspicious Squig holders?',
    'What is the least normal thing a real holder understands?',
    'What should a holder never admit in public?',
    'What object should every holder keep near the portal?',
    'What makes someone worthy of the ugly watchlist?'
  ],
  floor_sweep_energy: [
    'Which Squig trait screams bad financial decision?',
    'What does a financially questionable Squig look like?',
    'What would the portal buy if it had a wallet?',
    'What snack pairs best with sweep energy?',
    'What is the ugliest reason to buy something?',
    'What should a wallet smell like after entering Ugly City?',
    'What is the portal equivalent of checking the floor?',
    'What phrase should be illegal during a sweep?'
  ],
  weird_earth_studies: [
    'What human habit should Squigs study first?',
    'What Earth object would confuse a Squig the most?',
    'What human snack would start a portal argument?',
    'Why do humans keep boxes from expensive things?',
    'What human invention is both brilliant and stupid?',
    'What Earth rule would get rejected by Ugly City?',
    'What human phrase sounds fake but is apparently real?',
    'What smell would make a Squig respect Earth?'
  ],
  safe_trivia_rare: [
    'What is the smallest prime number?',
    'How many sides does a hexagon have?',
    'What planet is closest to the Sun?',
    'What do bees make?',
    'What gas do plants absorb from the atmosphere?'
  ]
};

function getOpening(text) {
  return String(text || '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 4).join(' ');
}

function renderTemplate(template, vars = {}) {
  return String(template)
    .replace(/\{user\}/g, vars.user || '')
    .replace(/\{timeSince\}/g, vars.timeSince || '')
    .replace(/\{mood\}/g, vars.mood || '')
    .trim();
}

function selectFromPool(pool, history = {}, vars = {}, random = Math.random) {
  const lines = Array.isArray(pool) ? pool : [];
  if (!lines.length) return '';
  const recent = new Set(history.recentResponses || []);
  const recentOpenings = new Set(history.recentOpenings || []);
  const nonRepeats = lines.filter((line) => !recent.has(line));
  const candidates = (nonRepeats.length ? nonRepeats : lines).filter((line) => !recentOpenings.has(getOpening(line)));
  const finalPool = candidates.length ? candidates : (nonRepeats.length ? nonRepeats : lines);
  const choice = finalPool[Math.floor(random() * finalPool.length)];
  return renderTemplate(choice, vars);
}

module.exports = { pools, questionPrompts, getOpening, renderTemplate, selectFromPool };
