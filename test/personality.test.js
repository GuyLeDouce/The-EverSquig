const test = require('node:test');
const assert = require('node:assert/strict');
const { decideInSquignitoAction, intensityMultiplier } = require('../src/insquignito/personality');
const { selectFromPool } = require('../src/insquignito/responseLibrary');

function baseContext(overrides = {}) {
  return {
    classification: { primary: 'direct', triggers: ['direct_mention'], isQuestion: false, isDirect: true },
    content: 'InSquignito',
    channelState: { recentResponses: [], recentOpenings: [], humanMessagesSinceBot: 99 },
    userState: {},
    state: {
      global: {
        mood: 'lurking',
        intensity: 'normal',
        recentResponses: [],
        recentOpenings: []
      }
    },
    config: { defaultIntensity: 'normal' },
    userId: 'u1',
    userLabel: '<@u1>',
    random: () => 0.1,
    ...overrides
  };
}

test('direct mention gets a response', () => {
  const action = decideInSquignitoAction(baseContext());
  assert.equal(action.shouldSpeak, true);
  assert.equal(action.mode, 'direct');
  assert.ok(action.responseText.length > 0);
});

test('bait is usually suppressed', () => {
  const action = decideInSquignitoAction(baseContext({
    classification: { primary: 'direct', triggers: ['direct_mention', 'bait'], isQuestion: false, isDirect: true },
    random: () => 0.1
  }));
  assert.equal(action.shouldSpeak, false);
  assert.equal(action.category, 'bait');
});

test('unknown live project facts do not hallucinate', () => {
  const action = decideInSquignitoAction(baseContext({
    classification: { primary: 'direct', triggers: ['direct_mention', 'question'], isQuestion: true, isDirect: true },
    content: 'when is mint and what is the floor?',
    random: () => 0.1
  }));
  assert.equal(action.shouldSpeak, true);
  assert.match(action.responseText, /admin|portal data|canon/i);
});

test('response selection avoids recent exact repeats', () => {
  const text = selectFromPool(['one ugly thing', 'two ugly thing'], {
    recentResponses: ['one ugly thing'],
    recentOpenings: []
  }, {}, () => 0);
  assert.equal(text, 'two ugly thing');
});

test('category selection respects intensity multiplier', () => {
  assert.equal(intensityMultiplier('low') < intensityMultiplier('normal'), true);
  assert.equal(intensityMultiplier('chaos') > intensityMultiplier('normal'), true);
});
