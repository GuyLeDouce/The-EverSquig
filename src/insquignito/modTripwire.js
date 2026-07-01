const { extractDomains, hasSuspiciousDomain, looksLikeSeedPhraseRisk } = require('./triggerClassifier');

const userCooldowns = new Map();

function looksLikeImpersonationOrDMScam(text = '') {
  const t = text.toLowerCase();
  return /(dm me|dm you|check your dm|message me|support team|admin here|mod here|verify here|airdrop|free mint|claim now|limited time|connect your wallet)/.test(t);
}

function detectTripwire(message, config) {
  const content = message.content || '';
  const domains = extractDomains(content);
  if (looksLikeSeedPhraseRisk(content)) return { hit: true, reason: 'Possible seed/private key exposure', domains };
  if (hasSuspiciousDomain(domains, config.safeDomains)) return { hit: true, reason: 'Suspicious or untrusted domain', domains };
  if (looksLikeImpersonationOrDMScam(content)) return { hit: true, reason: 'Possible impersonation/DM/claim scam language', domains };
  return { hit: false, reason: '', domains };
}

async function maybeSendTripwireAlert(message, config, logger) {
  const hit = detectTripwire(message, config);
  if (!hit.hit) return false;
  const now = Date.now();
  const last = userCooldowns.get(message.author.id) || 0;
  if (now - last < config.cooldowns.tripwireUserMs) return true;
  userCooldowns.set(message.author.id, now);

  const payload = [
    '**InSquignito Tripwire**',
    `**Reason:** ${hit.reason}`,
    `**User:** <@${message.author.id}>`,
    `**Channel:** <#${message.channel.id}>`,
    `**Message Link:** ${message.url}`,
    hit.domains.length ? `**Domains:** ${hit.domains.join(', ')}` : null,
    '',
    'Suggested action: verify link safety / warn user / remove if needed.'
  ].filter(Boolean).join('\n');

  if (config.modAlertChannelId) {
    const channel = message.guild?.channels?.cache?.get(config.modAlertChannelId) ||
      await message.guild?.channels?.fetch(config.modAlertChannelId).catch(() => null);
    if (channel?.isTextBased()) {
      await channel.send(payload).catch(() => {});
      return true;
    }
  }
  logger.warn(payload);
  return true;
}

module.exports = { detectTripwire, maybeSendTripwireAlert, looksLikeImpersonationOrDMScam };
