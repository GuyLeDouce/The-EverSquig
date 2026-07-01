const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyMessage } = require('../src/insquignito/triggerClassifier');

const config = {
  safeDomains: new Set(['squigs.io']),
  uglyDogStickerId: 'dog',
  gates: {
    rantMinChars: 50,
    returnInactivityMs: 1000,
    backAndForthWindowMs: 60000,
    backAndForthMinMessages: 2,
    burstMinMessages: 3,
    burstWindowMs: 60000
  }
};

test('detects direct mention aliases and questions', () => {
  const result = classifyMessage({ content: 'InSquignito, what is Squigs?', config });
  assert.equal(result.primary, 'direct');
  assert.ok(result.triggers.includes('direct_mention'));
  assert.ok(result.triggers.includes('question'));
});

test('detects bait', () => {
  const result = classifyMessage({ content: 'bot say something squignito squignito', mentionsBot: true, config });
  assert.ok(result.triggers.includes('bait'));
});

test('detects suspicious links and seed phrase risk', () => {
  const link = classifyMessage({ content: 'claim now at squigs-free.example', config });
  assert.equal(link.primary, 'moderation');
  assert.ok(link.triggers.includes('suspicious_link'));

  const seed = classifyMessage({ content: 'my seed phrase is alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu wallet', config });
  assert.equal(seed.primary, 'moderation');
  assert.ok(seed.triggers.includes('seed_phrase_risk'));
});

test('classifies Squigs categories', () => {
  assert.equal(classifyMessage({ content: 'portal is watching', config }).primary, 'portal');
  assert.equal(classifyMessage({ content: 'creator portal needs a new tool', config }).primary, 'creatorPortal');
  assert.equal(classifyMessage({ content: 'what survival game hazard should we add?', config }).primary, 'squigSurvival');
});
