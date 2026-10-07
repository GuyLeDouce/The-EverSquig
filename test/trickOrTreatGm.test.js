const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyMessage, shouldIgnoreMessage } = require('../src/insquignito/triggerClassifier');
const { decideInSquignitoAction } = require('../src/insquignito/personality');
const { canSpeak, recordResponse } = require('../src/insquignito/cooldowns');
const { speak } = require('../src/insquignito/speaker');
const { pools } = require('../src/insquignito/responseLibrary');
const { mergeState } = require('../src/stateStore');
const {
  responses, isTrickOrTreatGmActive, TRICK_OR_TREAT_GM_MODE,
  TRICK_OR_TREAT_GM_START_DATE, TRICK_OR_TREAT_GM_END_DATE, TRICK_OR_TREAT_CHANNEL_URL
} = require('../src/insquignito/trickOrTreatGm');

const october = Date.parse('2026-10-30T12:00:00-04:00');
const config = {
  defaultIntensity: 'normal',
  channelNameDenyContains: ['rules', 'admin'],
  channelAllowlist: [],
  channelDenylist: [],
  cooldowns: { channelMs: 2700000, directUserMs: 120000, categoryMs: 3600000, ambientGlobalMinMs: 21600000, ambientGlobalMaxMs: 43200000 },
  gates: { minHumanMessagesAfterBot: 8, burstAfterSilenceMs: 100000, burstWindowMs: 10000 }
};

function context(overrides = {}) {
  return {
    classification: classifyMessage({ content: 'GM everyone', config }),
    content: 'GM everyone',
    channelState: { humanMessagesSinceBot: 99, recentResponses: [], recentOpenings: [] },
    userState: {},
    state: mergeState({}),
    config,
    now: october,
    random: () => 0.1,
    ...overrides
  };
}

function gate(ctx, overrides = {}) {
  return canSpeak({ ...ctx, mode: TRICK_OR_TREAT_GM_MODE, category: TRICK_OR_TREAT_GM_MODE, channel: { id: 'c1', name: 'general' }, ...overrides });
}

function delivery(ctx = context()) {
  const calls = [];
  return {
    ...ctx,
    action: decideInSquignitoAction(ctx),
    message: { author: { id: 'u1', bot: false }, client: { user: { id: 'bot' } }, reply: async (payload) => { calls.push(payload); return {}; } },
    channel: { id: 'c1', name: 'general', send: async (payload) => { calls.push(payload); return {}; } },
    store: { markDirty: () => {} },
    calls
  };
}

for (const content of ['GM', 'gm', 'Gm', 'gM', 'GoOd MoRnInG', 'Good Morning', 'GOOD MORNING', 'good morning everyone', 'GM everyone', 'GM ugly fkrs', 'Good morning!', 'Good morning everyone ☕️', '☕️GM!!!', '**GM**', 'hey, gm everyone', 'good   morning']) {
  test(`GM matching: ${content}`, () => {
    assert.equal(classifyMessage({ content, config }).primary, 'gm');
  });
}

for (const stickerId of ['1458788269088313355', '1509562739947737188']) {
  test(`sticker-only ${stickerId} uses the same GM pool without a cooldown`, async () => {
    const classification = classifyMessage({ content: '', stickerIds: [stickerId], now: october, config });
    assert.equal(classification.primary, 'gm');
    const args = delivery(context({ content: '', classification }));
    assert.deepEqual(args.action, decideInSquignitoAction(context()));
    assert.equal(await speak(args), true);
    args.action = decideInSquignitoAction(context({ state: args.state }));
    assert.equal(await speak(args), true);
    assert.equal(args.calls.length, 2);
  });
}

test('both stickers plus GM still produce only one greeting trigger', () => {
  const result = classifyMessage({ content: 'gM ☕️', stickerIds: ['1458788269088313355', '1509562739947737188'], now: october, config });
  assert.equal(result.triggers.filter((trigger) => trigger === 'gm').length, 1);
});

test('unrelated stickers and sticker IDs pasted as text are not GM greetings', () => {
  for (const input of [{ stickerIds: ['123'] }, { content: '1458788269088313355 1509562739947737188' }]) {
    assert.equal(classifyMessage({ ...input, now: october, config }).triggers.includes('gm'), false);
  }
});

test('sticker detection respects October boundaries and higher-priority behavior', () => {
  const stickerIds = ['1458788269088313355'];
  for (const now of [Date.parse(TRICK_OR_TREAT_GM_START_DATE) - 1, Date.parse(TRICK_OR_TREAT_GM_END_DATE)]) {
    assert.equal(classifyMessage({ stickerIds, now, config }).triggers.includes('gm'), false);
  }
  for (const now of [Date.parse(TRICK_OR_TREAT_GM_START_DATE), Date.parse(TRICK_OR_TREAT_GM_END_DATE) - 1]) {
    assert.equal(classifyMessage({ stickerIds, now, config }).primary, 'gm');
  }
  assert.equal(classifyMessage({ stickerIds, mentionsBot: true, now: october, config }).primary, 'direct');
  assert.equal(classifyMessage({ stickerIds, content: 'my seed phrase', now: october, config }).primary, 'moderation');
  assert.equal(classifyMessage({ stickerIds: [...stickerIds, 'dog'], now: october, config: { ...config, uglyDogStickerId: 'dog' } }).primary, 'dogPanic');
});

for (const content of ['segment', 'dogma', 'sigma', 'pragmatic', 'gmorning', 'gm123', '_gm_', 'égm', 'good mornings', 'notgood morning', 'hello everyone']) {
  test(`does not mistake a substring for a greeting: ${content}`, () => {
    assert.equal(classifyMessage({ content, config }).triggers.includes('gm'), false);
  });
}

test('all 30 unique reminders have the exact plain URL and preserved example text', () => {
  assert.equal(responses.length, 30);
  assert.equal(new Set(responses).size, 30);
  for (const response of responses) {
    assert.ok(response.endsWith(`\n${TRICK_OR_TREAT_CHANNEL_URL}`));
    assert.equal(response.split(TRICK_OR_TREAT_CHANNEL_URL).length, 2);
  }
  assert.equal(responses[0], `GM ☕️ Looking extra Ugly this morning 👀\n\nI left you a TREAT 🍬\n${TRICK_OR_TREAT_CHANNEL_URL}`);
  assert.equal(responses[26], `GM ☕️\n\nYour daily dose of caffeine and questionable decisions starts now.\n\nFirst, TREAT. 🍭\n${TRICK_OR_TREAT_CHANNEL_URL}`);
});

test('Toronto October boundaries are inclusive through October 30 and never recur', () => {
  const start = Date.parse(TRICK_OR_TREAT_GM_START_DATE);
  const end = Date.parse(TRICK_OR_TREAT_GM_END_DATE);
  assert.equal(isTrickOrTreatGmActive(start - 1), false);
  assert.equal(isTrickOrTreatGmActive(start), true);
  assert.equal(isTrickOrTreatGmActive(october), true);
  assert.equal(isTrickOrTreatGmActive(end - 1), true);
  assert.equal(isTrickOrTreatGmActive(end), false);
  assert.equal(isTrickOrTreatGmActive(Date.parse('2027-10-10T12:00:00Z')), false);
  assert.equal(isTrickOrTreatGmActive(Date.parse('2026-10-31T03:00:00Z')), true);
});

test('every ordinary GM text or supported sticker replies at every intensity and random roll', () => {
  for (const intensity of ['low', 'normal', 'chaos']) {
    for (const roll of [0, 0.35, 0.7, 0.999999]) {
      for (const input of [{ content: 'gM' }, { content: 'GoOd MoRnInG ☕️' }, { stickerIds: ['1458788269088313355'] }, { stickerIds: ['1509562739947737188'] }]) {
        const ctx = context({ classification: classifyMessage({ ...input, config, now: october }), random: () => roll });
        ctx.state.global.intensity = intensity;
        const action = decideInSquignitoAction(ctx);
        assert.equal(action.shouldSpeak, true);
        assert.equal(action.mode, TRICK_OR_TREAT_GM_MODE);
        assert.ok(responses.includes(action.responseText));
      }
    }
  }
});

test('non-event GM and other ambient categories retain probability skipping', () => {
  const after = context({ now: Date.parse(TRICK_OR_TREAT_GM_END_DATE), random: () => 0.99 });
  assert.equal(decideInSquignitoAction(after).reason, 'probability_skip');
  const portal = context({ classification: classifyMessage({ content: 'portal', config }), random: () => 0.99 });
  assert.equal(decideInSquignitoAction(portal).reason, 'probability_skip');
});

test('random selection can reach every reminder and excludes last event even with exhausted history', () => {
  const selected = new Set();
  for (let i = 0; i < responses.length; i++) {
    const action = decideInSquignitoAction(context({ random: () => (i + 0.5) / responses.length }));
    selected.add(action.responseText);
  }
  assert.deepEqual(selected, new Set(responses));
  const ctx = context({ random: () => 0 });
  ctx.state.global.recentResponses = [...responses];
  ctx.state.global.trickOrTreatGmLastResponse = responses[0];
  assert.notEqual(decideInSquignitoAction(ctx).responseText, responses[0]);
});

test('outside event, original GM pool and ambient gates resume', () => {
  for (const now of [Date.parse(TRICK_OR_TREAT_GM_START_DATE) - 1, Date.parse(TRICK_OR_TREAT_GM_END_DATE)]) {
    const ctx = context({ now });
    const action = decideInSquignitoAction(ctx);
    assert.equal(action.mode, 'ambient');
    assert.equal(action.category, 'gm');
    assert.ok(pools.gm.includes(action.responseText));
    ctx.state.global.ambientNextEligibleTs = now + 1;
    assert.equal(gate(ctx, { mode: action.mode, category: action.category }).reason, 'global_ambient_cooldown');
  }
});

test('direct, moderation, dog, GN and other existing priorities remain identical during event', () => {
  for (const content of ['GM InSquignito', 'GM my seed phrase', 'GN', 'portal is watching', 'GM https://bad.example']) {
    const classification = classifyMessage({ content, config });
    const during = decideInSquignitoAction(context({ content, classification }));
    const after = decideInSquignitoAction(context({ content, classification, now: Date.parse(TRICK_OR_TREAT_GM_END_DATE) }));
    assert.deepEqual(during, after);
  }
  const dog = context({ classification: { primary: 'dogPanic', triggers: ['gm', 'sticker_ugly_dog'] } });
  assert.equal(decideInSquignitoAction(dog).category, 'dogPanic');
  const silent = context();
  silent.state.global.mood = 'silent';
  assert.equal(decideInSquignitoAction(silent).shouldSpeak, false);
});

test('event reuses quiet and channel gates without 6–12 hour ambient/category blocking', () => {
  const ctx = context();
  ctx.state.global.ambientNextEligibleTs = october + 43200000;
  ctx.state.global.categoryLastTs.gm = october;
  assert.equal(gate(ctx).ok, true);
  ctx.state.global.quietUntilTs = october + 1;
  assert.equal(gate(ctx).reason, 'quiet_mode');
  ctx.state.global.quietUntilTs = 0;
  assert.equal(gate(ctx, { channel: { id: 'c1', name: 'rules' } }).reason, 'channel_blocked');
  assert.equal(gate(ctx, { config: { ...config, channelDenylist: ['c1'] } }).ok, false);
  assert.equal(gate(ctx, { config: { ...config, channelAllowlist: ['other'] } }).ok, false);
  ctx.channelState.allow = false;
  assert.equal(gate(ctx).ok, false);
});

test('event ignores global, channel, user, category and message-count cooldown state', () => {
  const ctx = context();
  ctx.state.global.ambientNextEligibleTs = october + 43200000;
  ctx.state.global.categoryLastTs.gm = october;
  ctx.state.global.categoryLastTs[TRICK_OR_TREAT_GM_MODE] = october;
  ctx.channelState.lastBotSpeakTs = october;
  ctx.channelState.humanMessagesSinceBot = 0;
  ctx.userState.lastTrickOrTreatGmTs = october;
  ctx.userState.lastDirectTs = october;
  assert.equal(gate(ctx).ok, true);
  recordResponse({ ...ctx, text: responses[0], mode: TRICK_OR_TREAT_GM_MODE, category: TRICK_OR_TREAT_GM_MODE });
  assert.equal(gate(ctx).ok, true);
  assert.equal(ctx.state.global.trickOrTreatGmLastResponse, responses[0]);
  assert.equal(ctx.state.global.ambientNextEligibleTs, october + 43200000);
  assert.equal(ctx.userState.lastDirectTs, october);
});

test('message guard and speaker ignore bots, self even without bot flag, and webhooks', async () => {
  for (const changes of [{ author: { id: 'otherBot', bot: true } }, { author: { id: 'bot', bot: false } }, { webhookId: 'hook' }]) {
    const args = delivery();
    Object.assign(args.message, changes);
    assert.equal(shouldIgnoreMessage(args.message, 'bot'), true);
    assert.equal(await speak(args), false);
    assert.equal(args.calls.length, 0);
  }
  assert.equal(shouldIgnoreMessage(delivery().message, 'bot'), false);
});

test('repeated GM replies have no cooldown, no ping and no recursive trigger', async () => {
  const args = delivery();
  assert.equal(await speak(args), true);
  assert.deepEqual(args.calls, [{ content: args.action.responseText, allowedMentions: { parse: [], repliedUser: false } }]);
  assert.equal(args.state.global.trickOrTreatGmLastResponse, args.action.responseText);
  assert.equal(await speak(args), true);
  assert.equal(args.calls.length, 2);
  assert.equal(shouldIgnoreMessage({ author: { id: 'bot', bot: true }, content: args.calls[0].content }, 'bot'), true);
});

test('a pending GM send does not suppress another GM reply', async () => {
  const args = delivery();
  let finish;
  args.message.reply = () => new Promise((resolve) => { finish = resolve; });
  const first = speak(args);
  const other = delivery(context({ state: args.state }));
  assert.equal(await speak(other), true);
  finish({});
  assert.equal(await first, true);
  assert.equal(other.calls.length, 1);
});

test('Discord rejection records no cooldown and allows retry', async () => {
  const args = delivery();
  args.message.reply = async () => { throw new Error('missing permissions'); };
  assert.equal(await speak(args), false);
  assert.equal(args.userState.lastTrickOrTreatGmTs, undefined);
  const retry = delivery(context({ state: args.state }));
  assert.equal(await speak(retry), true);
});

test('send-time expiry blocks action selected just before midnight', async () => {
  const args = delivery(context({ now: Date.parse(TRICK_OR_TREAT_GM_END_DATE) - 1 }));
  args.now = Date.parse(TRICK_OR_TREAT_GM_END_DATE);
  assert.equal(await speak(args), false);
  assert.equal(args.calls.length, 0);
});

test('speaker retains original direct replies and ambient channel sends', async () => {
  for (const mode of ['direct', 'ambient']) {
    const args = delivery();
    args.action = { shouldSpeak: true, mode, category: 'portal', responseText: 'original response' };
    args.message.reply = async (text) => { args.calls.push(['reply', text]); return {}; };
    args.channel.send = async (text) => { args.calls.push(['send', text]); return {}; };
    assert.equal(await speak(args), true);
    assert.deepEqual(args.calls, [[mode === 'direct' ? 'reply' : 'send', 'original response']]);
  }
});
