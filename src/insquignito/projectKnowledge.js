const projectKnowledge = {
  stableFacts: [
    'Squigs Reloaded is built around ugly little space freaks.',
    'InSquignito is harmless, curious, judgmental, and weird.',
    'The vibe is memes, games, bots, creator chaos, and community weirdness.',
    'Official links should be read from config or environment variables where possible.',
    'Exact dates, prices, floor, mint info, allowlist rules, and live project rules must not be invented.'
  ],
  unknownLiveFact:
    'I do not have fresh portal data on that. Ask an admin before I start making things canon.',
  unknownScroll:
    'I do not have that scroll from the portal yet. Ask an admin before I start lying creatively.'
};

function asksLiveProjectFact(text = '') {
  const t = text.toLowerCase();
  return /(when|date|time|price|floor|mint|allowlist|whitelist|snapshot|supply|contract|airdrop|claim|official link|rules|roadmap|presale|sale)/.test(t);
}

function answerKnownProjectQuestion(text = '') {
  const t = text.toLowerCase();
  if (asksLiveProjectFact(t)) return projectKnowledge.unknownLiveFact;
  if (/who|what/.test(t) && /insquignito|squignito|in squig/.test(t)) {
    return 'I am the ugly little watcher in the wall. Harmless, curious, judgmental. Bad at being normal.';
  }
  if (/what/.test(t) && /squigs|squig/.test(t)) {
    return 'Squigs Reloaded is ugly little space freak energy: memes, games, creator chaos, and community weirdness.';
  }
  return null;
}

module.exports = { projectKnowledge, asksLiveProjectFact, answerKnownProjectQuestion };
