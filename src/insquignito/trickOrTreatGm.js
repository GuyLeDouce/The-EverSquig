// Toronto is UTC-04:00 throughout this October event. The end is exclusive.
const TRICK_OR_TREAT_GM_START_DATE = '2026-10-01T00:00:00-04:00';
const TRICK_OR_TREAT_GM_END_DATE = '2026-10-31T00:00:00-04:00';
const TRICK_OR_TREAT_CHANNEL_URL = 'https://discord.com/channels/1290584204689801267/1555224471839838348';
const TRICK_OR_TREAT_GM_MODE = 'trickOrTreatGm';
const TRICK_OR_TREAT_GM_STICKER_IDS = ['1458788269088313355', '1509562739947737188'];

const responses = [
  `GM ☕️ Looking extra Ugly this morning 👀\n\nI left you a TREAT 🍬`,
  `GM Ugly Fkrs ☕️\n\nI filled the candy bowl again 🍬 Try not to eat it all at once.`,
  `GM ☕️\n\nI brought the TREAT. You bring the Ugly. 🤝`,
  `GM 👀\n\nI see you scrolling. Go get your TREAT 🍭`,
  `GM ☕️\n\nCoffee for me. Candy for you. Seems fair. 🍬`,
  `GM you Ugly Fkr ☕️\n\nI saved you some candy. Barely. 😂`,
  `GM ☕️\n\nI woke up Ugly again. Nailed it. 😎\n\nDon't forget your TREAT 🍬`,
  `GM 👀\n\nI'm watching that candy bowl... you better come get yours. 🍬`,
  `GM ☕️\n\nYou made it through another night. Have some candy. 😂🍭`,
  `GM Ugly Crew ☕️\n\nI've got TREATs. You know where to find me. 👀`,
  `GM ☕️\n\nI'm feeling generous today. Don't get used to it. 🍬`,
  `GM 👀\n\nYou look like you could use some candy. And maybe coffee. Definitely coffee. ☕️`,
  `GM ☕️\n\nI hid your TREAT in the most obvious place possible. 😂`,
  `GM Ugly Fkrs ☕️\n\nCandy bowl is OPEN. 🍬 Come get yours before I change my mind.`,
  `GM ☕️\n\nI checked. You're still Ugly. Congratulations, you get a TREAT. 🍭`,
  `GM 👀☕️\n\nStop pretending to work for 10 seconds and get your TREAT. 😂`,
  `GM ☕️\n\nI put fresh TREATs out. Don't make me come find you. 👀🍬`,
  `GM you beautiful Ugly bastard ☕️\n\nI got candy for you. 🍭`,
  `GM ☕️\n\nAnother day, another excuse for me to hand out candy. 🍬`,
  `GM 👀\n\nI know you saw this. Now go collect your TREAT. 😂`,
  `GM ☕️\n\nNo TRICK from me this morning. Probably. 😈🍬`,
  `GM Ugly ☕️\n\nI've been guarding your candy all damn night. Come get it. 😂`,
  `GM ☕️\n\nRise and shine, Ugly Fkrs. The candy isn't gonna collect itself. 🍬`,
  `GM 👀☕️\n\nI've got coffee. You've got a TREAT waiting. Everybody wins.`,
  `GM ☕️\n\nI made it another day without getting fired. Celebrate with a TREAT. 😂🍭`,
  `GM Ugly Fkrs 👀\n\nI counted the candy. I'll know if you take two. Probably. 🍬`,
  `GM ☕️\n\nYour daily dose of caffeine and questionable decisions starts now.\n\nFirst, TREAT. 🍭`,
  `GM 👀\n\nI dragged myself outta bed to give you this TREAT. Least you can do is collect it. 😂`,
  `GM ☕️\n\nLooking Ugly. Feeling Ugly. Handing out candy. Life is good. 🍬`,
  `GM you Ugly Fkrs ☕️\n\nI'm awake. The candy bowl is full. Let's cause some shit. 😈🍬`
].map((text) => `${text}\n${TRICK_OR_TREAT_CHANNEL_URL}`);

function isTrickOrTreatGmActive(now = Date.now()) {
  return now >= Date.parse(TRICK_OR_TREAT_GM_START_DATE) && now < Date.parse(TRICK_OR_TREAT_GM_END_DATE);
}

module.exports = {
  TRICK_OR_TREAT_GM_START_DATE,
  TRICK_OR_TREAT_GM_END_DATE,
  TRICK_OR_TREAT_CHANNEL_URL,
  TRICK_OR_TREAT_GM_MODE,
  TRICK_OR_TREAT_GM_STICKER_IDS,
  responses,
  isTrickOrTreatGmActive
};
