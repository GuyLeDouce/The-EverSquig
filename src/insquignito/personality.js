const { pools, selectFromPool } = require('./responseLibrary');
const { answerKnownProjectQuestion, projectKnowledge } = require('./projectKnowledge');

const moods = ['lurking', 'judging', 'suspicious', 'impressed', 'offended', 'excited', 'confused', 'unhinged', 'helpful_weird', 'silent'];

function weightedPick(entries, random = Math.random) {
  const total = entries.reduce((sum, item) => sum + item.weight, 0);
  let roll = random() * total;
  for (const item of entries) {
    roll -= item.weight;
    if (roll <= 0) return item.value;
  }
  return entries[entries.length - 1].value;
}

function intensityMultiplier(intensity) {
  if (intensity === 'low') return 0.5;
  if (intensity === 'chaos') return 1.45;
  return 1;
}

function historyFrom(context) {
  return {
    recentResponses: [
      ...((context.state.global || {}).recentResponses || []),
      ...((context.channelState || {}).recentResponses || [])
    ],
    recentOpenings: [
      ...((context.state.global || {}).recentOpenings || []),
      ...((context.channelState || {}).recentOpenings || [])
    ]
  };
}

function directCategory(context, random) {
  if (context.classification.triggers.includes('bait')) {
    return random() < 0.85 ? 'silent' : 'directMention';
  }
  if (context.classification.isQuestion) {
    return weightedPick([
      { value: 'knownAnswer', weight: 45 },
      { value: 'directMention', weight: 25 },
      { value: 'questions', weight: 20 },
      { value: 'rareUnhinged', weight: 2 },
      { value: 'unknown', weight: 8 }
    ], random);
  }
  return weightedPick([
    { value: 'directMention', weight: 45 },
    { value: 'portal', weight: 25 },
    { value: 'questions', weight: 15 },
    { value: 'ugly', weight: 10 },
    { value: 'rareUnhinged', weight: 5 }
  ], random);
}

function ambientAllowedByProbability(context, random) {
  const category = context.classification.primary;
  const intensity = context.state.global.intensity || context.config.defaultIntensity;
  const base = {
    gm: 0.35,
    gn: 0.3,
    floor: 0.08,
    sweep: 0.12,
    mint: 0.22,
    portal: 0.1,
    ugly: 0.1,
    squigs: 0.1,
    squigSurvival: 0.1,
    creatorPortal: 0.1,
    hype: 0.12,
    fud: 0.18,
    returningUser: 0.08,
    link: 0.04,
    rant: 0.04,
    backAndForth: 0.04,
    burstAfterSilence: 0.06
  }[category] || 0.03;
  return random() < Math.min(0.7, base * intensityMultiplier(intensity));
}

function decideInSquignitoAction(context) {
  const random = context.random || Math.random;
  const classification = context.classification;
  const mood = context.state.global.mood || 'lurking';
  const vars = {
    user: context.userLabel || 'someone',
    timeSince: context.timeSince || '',
    mood
  };
  const history = historyFrom(context);

  if (mood === 'silent') {
    return { shouldSpeak: false, mode: 'silent', category: 'silent', mood, responseText: '', reason: 'mood_silent', cooldownKey: 'silent' };
  }

  if (classification.primary === 'moderation') {
    return { shouldSpeak: false, mode: 'moderation', category: 'tripwire', mood, responseText: '', reason: 'tripwire_only', cooldownKey: 'tripwire' };
  }

  if (classification.primary === 'dogPanic') {
    return {
      shouldSpeak: true,
      mode: 'direct',
      category: 'dogPanic',
      mood: 'offended',
      responseText: selectFromPool(pools.dogPanic, history, vars, random),
      reason: 'ugly_dog_sticker',
      cooldownKey: 'dogPanic'
    };
  }

  if (classification.primary === 'direct') {
    const category = directCategory(context, random);
    if (category === 'silent') {
      return { shouldSpeak: false, mode: 'silent', category: 'bait', mood, responseText: '', reason: 'bait_suppressed', cooldownKey: 'bait' };
    }
    let responseText = '';
    if (category === 'knownAnswer') responseText = answerKnownProjectQuestion(context.content) || projectKnowledge.unknownScroll;
    else responseText = selectFromPool(pools[category] || pools.directMention, history, vars, random);
    return { shouldSpeak: true, mode: 'direct', category, mood: category === 'knownAnswer' ? 'helpful_weird' : mood, responseText, reason: 'direct_path', cooldownKey: `direct:${context.userId}` };
  }

  if (!ambientAllowedByProbability(context, random)) {
    return { shouldSpeak: false, mode: 'silent', category: classification.primary, mood, responseText: '', reason: 'probability_skip', cooldownKey: classification.primary };
  }

  const category = classification.primary;
  const responseText = selectFromPool(pools[category] || pools.portal, history, vars, random);
  return {
    shouldSpeak: true,
    mode: 'ambient',
    category,
    mood,
    responseText,
    reason: 'ambient_trigger',
    cooldownKey: category
  };
}

module.exports = { moods, weightedPick, decideInSquignitoAction, intensityMultiplier };
