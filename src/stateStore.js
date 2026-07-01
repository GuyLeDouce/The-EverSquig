const fs = require('fs');
const path = require('path');

const DEFAULT_STATE = {
  users: {},
  channels: {},
  global: {
    mood: 'lurking',
    intensity: 'normal',
    ambientLastTs: 0,
    ambientNextEligibleTs: 0,
    quietUntilTs: 0,
    promptsEnabled: true,
    triggerLastTs: {},
    categoryLastTs: {},
    recentResponses: [],
    recentOpenings: [],
    questionPrompts: {
      enabled: true,
      nextAskTs: 0,
      lastActivityTs: 0,
      lastMessageWasQuestion: false,
      order: [],
      activeMessages: {},
      responseLastTs: 0
    }
  }
};

function cloneDefault() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function mergeState(parsed, defaults = cloneDefault()) {
  return {
    ...defaults,
    ...parsed,
    users: parsed.users || {},
    channels: parsed.channels || {},
    global: {
      ...defaults.global,
      ...(parsed.global || {}),
      questionPrompts: {
        ...defaults.global.questionPrompts,
        ...((parsed.global || {}).questionPrompts || {})
      }
    }
  };
}

function createStateStore(statePath, seed = {}) {
  let saveTimer = null;
  let state = load();

  function load() {
    try {
      if (!fs.existsSync(statePath)) return mergeState(seed);
      const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      return mergeState({ ...seed, ...parsed });
    } catch {
      return mergeState(seed);
    }
  }

  function scheduleSave() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      saveNow();
    }, 500);
  }

  function saveNow() {
    const dir = path.dirname(statePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
  }

  function getState() {
    return state;
  }

  function getUser(userId) {
    if (!state.users[userId]) {
      state.users[userId] = {
        lastSeen: 0,
        messageCount: 0,
        lastDirectTs: 0,
        persona: 'quiet_observer'
      };
    }
    return state.users[userId];
  }

  function getChannel(channelId) {
    if (!state.channels[channelId]) {
      state.channels[channelId] = {
        lastBotSpeakTs: 0,
        humanMessagesSinceBot: 999,
        lastHumanMsgTs: 0,
        recentMessages: [],
        recentResponses: [],
        recentOpenings: [],
        burstWindowStart: 0,
        burstCount: 0,
        burstFromSilence: false,
        allow: null
      };
    }
    return state.channels[channelId];
  }

  function markDirty() {
    scheduleSave();
  }

  return { getState, getUser, getChannel, markDirty, saveNow };
}

module.exports = { createStateStore, DEFAULT_STATE, mergeState };
