function extractDomains(text) {
  const t = String(text || '').toLowerCase();
  const urlLike = t.match(/(?:https?:\/\/)?(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s]*)?/g) || [];
  const domains = [];
  for (const u of urlLike) {
    try {
      const parsed = new URL(u.startsWith('http') ? u : `https://${u}`);
      domains.push(parsed.hostname.toLowerCase());
    } catch {
      // ignore malformed link-like text
    }
  }
  return [...new Set(domains)];
}

function looksLikeQuestion(text = '') {
  const t = text.toLowerCase().trim();
  return t.includes('?') || /^(how|what|why|where|when|who|can|could|should|do|does|did|is|are|will|would)\b/.test(t);
}

function looksLikeSeedPhraseRisk(text = '') {
  const t = text.toLowerCase();
  if (/(seed phrase|recovery phrase|mnemonic|private key|secret key)/.test(t)) return true;
  const hasWalletContext = /(wallet|metamask|phrase|seed|private|key|mnemonic|recovery)/.test(t);
  if (!hasWalletContext) return false;
  const words = t.replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
  return words.length >= 12;
}

function looksLikeBait(text = '', mentionsBot = false) {
  const t = text.toLowerCase();
  const nameHits = (t.match(/insquignito|squignito|in\s*squig/g) || []).length;
  return /(bot\s*say|say\s*something|talk\s*bot|speak\s*bot|dance monkey|perform)/.test(t) ||
    nameHits >= 2 ||
    (mentionsBot && /say something|talk|speak|respond/.test(t));
}

function hasSuspiciousDomain(domains, safeDomains = new Set()) {
  if (!domains.length) return false;
  const shorteners = new Set(['bit.ly', 'tinyurl.com', 't.co', 'cutt.ly', 'rebrand.ly', 'goo.su']);
  return domains.some((domain) => {
    if (safeDomains.has(domain)) return false;
    if (domain.startsWith('xn--')) return true;
    if (shorteners.has(domain)) return true;
    if (domain.includes('squigs') && !safeDomains.has(domain)) return true;
    if (domain.includes('uglydex') && !safeDomains.has(domain)) return true;
    return true;
  });
}

function classifyMessage(input = {}) {
  const content = String(input.content || '');
  const t = content.toLowerCase();
  const now = input.now || Date.now();
  const config = input.config || {};
  const safeDomains = config.safeDomains || new Set();
  const channelState = input.channelState || {};
  const userState = input.userState || {};
  const domains = extractDomains(content);
  const triggers = new Set();

  const mentionsName = /(?:^|\b)(insquignito|squignito|in\s*squig)(?:\b|$)/i.test(content);
  const direct = !!input.mentionsBot || mentionsName;
  if (direct) triggers.add('direct_mention');
  if (input.isReplyToBot) triggers.add('reply_to_bot');
  if (/\bgm\b|good morning/.test(t)) triggers.add('gm');
  if (/\bgn\b|good night|goodnight/.test(t)) triggers.add('gn');
  if (/\bfloor\b|floor price|fp\b/.test(t)) triggers.add('floor');
  if (/\bsweep|swept|sweeping\b/.test(t)) triggers.add('sweep');
  if (/\bmint|minting|allowlist|whitelist|claim\b/.test(t)) triggers.add('mint');
  if (/\bportal\b/.test(t)) triggers.add('portal');
  if (/\bugly|stay ugly\b/.test(t)) triggers.add('ugly');
  if (/\bsquigs?\b|space freak/.test(t)) triggers.add('squigs');
  if (/survival|hazard|boss fight|checkpoint|game/.test(t)) triggers.add('squig_survival');
  if (/creator portal|creator|generator|build|tool/.test(t)) triggers.add('creator_portal');
  if (/bullish|lets go|lfg|hype|send it|moon\b/.test(t)) triggers.add('hype');
  if (/fud|rug|dead project|scam project|doomed|concerned/.test(t)) triggers.add('fud');
  if (looksLikeQuestion(content)) triggers.add('question');
  if (domains.length) triggers.add('link');
  if (content.length >= (config.gates?.rantMinChars || 280)) triggers.add('long_rant');
  if (input.stickerIds?.includes(config.uglyDogStickerId)) triggers.add('sticker_ugly_dog');
  if (hasSuspiciousDomain(domains, safeDomains)) triggers.add('suspicious_link');
  if (looksLikeSeedPhraseRisk(content)) triggers.add('seed_phrase_risk');
  if (looksLikeBait(content, !!input.mentionsBot)) triggers.add('bait');

  if (userState.lastSeen && now - userState.lastSeen >= (config.gates?.returnInactivityMs || 86400000)) {
    triggers.add('returning_user');
  }

  const recent = channelState.recentMessages || [];
  const backWindow = now - (config.gates?.backAndForthWindowMs || 600000);
  const backRecent = recent.filter((m) => m.ts >= backWindow);
  if (backRecent.length >= (config.gates?.backAndForthMinMessages || 4) && new Set(backRecent.map((m) => m.userId)).size >= 2) {
    triggers.add('back_and_forth');
  }

  if (channelState.burstFromSilence &&
    channelState.burstCount >= (config.gates?.burstMinMessages || 6) &&
    now - (channelState.burstWindowStart || 0) <= (config.gates?.burstWindowMs || 900000)) {
    triggers.add('burst_after_silence');
  }

  let primary = 'ambient';
  if (triggers.has('seed_phrase_risk') || triggers.has('suspicious_link')) primary = 'moderation';
  else if (triggers.has('sticker_ugly_dog')) primary = 'dogPanic';
  else if (triggers.has('direct_mention') || triggers.has('reply_to_bot')) primary = 'direct';
  else if (triggers.has('gm')) primary = 'gm';
  else if (triggers.has('gn')) primary = 'gn';
  else if (triggers.has('mint')) primary = 'mint';
  else if (triggers.has('floor')) primary = 'floor';
  else if (triggers.has('sweep')) primary = 'sweep';
  else if (triggers.has('creator_portal')) primary = 'creatorPortal';
  else if (triggers.has('squig_survival')) primary = 'squigSurvival';
  else if (triggers.has('portal')) primary = 'portal';
  else if (triggers.has('ugly')) primary = 'ugly';
  else if (triggers.has('squigs')) primary = 'squigs';
  else if (triggers.has('hype')) primary = 'hype';
  else if (triggers.has('fud')) primary = 'fud';
  else if (triggers.has('returning_user')) primary = 'returningUser';
  else if (triggers.has('link')) primary = 'link';
  else if (triggers.has('long_rant')) primary = 'rant';
  else if (triggers.has('back_and_forth')) primary = 'backAndForth';
  else if (triggers.has('burst_after_silence')) primary = 'burstAfterSilence';

  return { triggers: [...triggers], primary, domains, isQuestion: triggers.has('question'), isDirect: primary === 'direct' };
}

module.exports = {
  classifyMessage,
  extractDomains,
  looksLikeQuestion,
  looksLikeSeedPhraseRisk,
  looksLikeBait,
  hasSuspiciousDomain
};
