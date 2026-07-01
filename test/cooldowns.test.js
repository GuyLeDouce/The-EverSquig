const test = require('node:test');
const assert = require('node:assert/strict');
const { canSpeak } = require('../src/insquignito/cooldowns');

const config = {
  channelNameDenyContains: ['rules', 'admin'],
  channelAllowlist: [],
  channelDenylist: [],
  cooldowns: { channelMs: 1000, directUserMs: 1000, categoryMs: 1000 },
  gates: { minHumanMessagesAfterBot: 3 }
};

test('quiet mode blocks ambient', () => {
  const result = canSpeak({
    mode: 'ambient',
    category: 'portal',
    channel: { id: 'c1', name: 'general' },
    channelState: { humanMessagesSinceBot: 99, lastBotSpeakTs: 0 },
    userState: {},
    state: { global: { quietUntilTs: Date.now() + 100000, categoryLastTs: {} } },
    config
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'quiet_mode');
});

test('denied channel blocks automatic speech', () => {
  const result = canSpeak({
    mode: 'ambient',
    category: 'portal',
    channel: { id: 'c1', name: 'rules' },
    channelState: { humanMessagesSinceBot: 99, lastBotSpeakTs: 0 },
    userState: {},
    state: { global: { quietUntilTs: 0, ambientNextEligibleTs: 0, categoryLastTs: {} } },
    config
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'channel_blocked');
});
