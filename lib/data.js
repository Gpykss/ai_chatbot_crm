// Sample data for the demo. In the full build this comes from OnlyFansAPI and the database.

export const workspaces = { owner: 'John', partner: 'Partner' };
export const langName = { EN: 'English', IT: 'Italian', FI: 'Finnish', EL: 'Greek' };

// A creator can speak several languages. The first one is her main language.
export const langsOf = (c) => (c?.langs?.length ? c.langs : [c?.lang || 'EN']);

// Starting point for a new persona. The admin replaces the parts in [brackets].
export const personaTemplate = {
  tone: 'Personality: [sweet / playful / bold / shy]\nHow she texts: [short messages, lowercase, lots of emojis like 🙈💕]\nPet names she uses: [babe, baby]\nAbout her: [age 18+, city or vibe she shares, hobbies]',
  content: 'Subscription: [what fans get]\nPPV: [type of video or set] from $[price]\nCustoms: [what she does] from $[price]\nExtras: [voice notes, sexting sessions, etc.] from $[price]',
  limits: '[No face in customs]\n[No content with other people]\nNo meetups. Never shares location, phone number or other socials.',
  examples: '[paste 5 to 10 real messages from her best chats, one per line]',
};

// Each creator's content vault: what she has actually made and can sell, newest first.
// In the full build this list syncs from OnlyFansAPI's vault. The AI only offers items from here.
const v = (id, title, type, price, added, desc) => ({ id, title, type, price, added, desc });

export const creators = [
  { id: 'bella', name: 'Bella Rae', handle: '@bellarae', langs: ['EN'], ws: 'owner', subs: 1840,
    tone: 'Playful, teasing, sweet. Calls fans babe. Uses emojis like 🙈 and 💕.',
    content: 'Shower and gym sets, lingerie, customs from $60',
    limits: 'No face in customs. No meetups. Never shares location.',
    vault: [
      v('b-1', 'Morning shower video', 'Video · 4 min', 25, 'Today', 'Slow shower video, steam and soap, teasing, ends with a wink to camera'),
      v('b-2', 'Red lace set', 'Photos · 12', 18, 'Tue', 'Red lace lingerie set on the bed, soft morning light'),
      v('b-3', 'Gym changing room', 'Video · 3 min', 22, 'Last week', 'After-workout changing room video, sports bra and leggings'),
    ],
  },
  { id: 'sofia', name: 'Sofia Conti', handle: '@sofiaconti', langs: ['IT', 'EN'], ws: 'owner', subs: 960,
    tone: 'Warm, romantic, a little shy at first.',
    content: 'Lingerie, bath sets, voice notes, customs from €50',
    limits: 'No meetups. No content with other people.',
    vault: [
      v('s-1', 'Bagno al tramonto', 'Video · 5 min', 20, 'Yesterday', 'Candlelit bath at sunset, bubbles, slow and romantic'),
      v('s-2', 'Black silk lingerie', 'Photos · 10', 15, 'Mon', 'Black silk lingerie by the window'),
    ],
  },
  { id: 'aino', name: 'Aino Virta', handle: '@ainovirta', langs: ['FI', 'EN'], ws: 'partner', subs: 610,
    tone: 'Calm, dry humour, short messages.',
    content: 'Sauna and outdoor sets, customs from $60',
    limits: 'No face in customs. No meetups.',
    vault: [
      v('a-1', 'Sauna evening', 'Video · 4 min', 22, 'Today', 'Sauna and snow plunge, towel only, playful'),
      v('a-2', 'Lake cabin set', 'Photos · 14', 16, 'Sat', 'Wooden cabin by the lake, oversized sweater and nothing else'),
    ],
  },
  { id: 'eleni', name: 'Eleni Mavri', handle: '@elenim', langs: ['EL', 'EN', 'IT'], ws: 'partner', subs: 1220,
    tone: 'Flirty, expressive, calls fans μωρό μου.',
    content: 'Beach sets, PPV videos, customs from $70',
    limits: 'No meetups. Never shares location.',
    vault: [
      v('e-1', 'Beach sunset video', 'Video · 6 min', 25, 'Today', 'Private beach at sunset, white bikini, comes off slowly'),
      v('e-2', 'Balcony set', 'Photos · 12', 18, 'Thu', 'Athens balcony, sheer dress, golden hour'),
    ],
  },
];

const m = (from, text, time, src) => ({ from, text, time, src });

export const initialFans = [
  { id: 'f1', name: 'Jake', creator: 'bella', lang: 'EN', spend: 412, last: 'Fri', since: 'Mar 2026',
    tags: ['Big spender', 'Night owl'],
    notes: 'Works nights in Texas. Likes shower and gym content. Usually buys PPV on Fridays.',
    msgs: [m('fan', 'hey gorgeous 😍 just got off shift', 'Yesterday'),
      m('me', 'Hey babe 💕 long night? you deserve a treat', 'Yesterday', 'ai'),
      m('fan', 'haha always. any new videos? the shower one you teased 👀', '11:42')] },
  { id: 'f2', name: 'Ryan', creator: 'bella', lang: 'EN', spend: 86, last: 'Today', since: 'Oct 2026',
    tags: ['New sub'], notes: 'Subscribed this week from the Reddit promo.',
    msgs: [m('fan', "just subscribed, you're stunning", 'Yesterday'),
      m('me', "Welcome Ryan 🙈 so happy you're here. I saved something special for new subs 💕", 'Yesterday', 'script'),
      m('fan', 'what are you up to tonight?', '11:30')] },
  { id: 'f6', name: 'Daniel', creator: 'bella', lang: 'EN', spend: 1240, last: 'Wed', since: 'Jan 2026',
    tags: ['Big spender', 'Customs'], notes: 'Top fan. Orders a custom every month. Prefers longer replies.',
    msgs: [m('fan', 'loved the last custom, worth every cent', '10:05'),
      m('me', "You spoil me Daniel 💕 next one is already in my head, I'll tell you soon", '10:07', 'ai')] },
  { id: 'f3', name: 'Marco', creator: 'sofia', lang: 'IT', spend: 230, last: 'Mon', since: 'May 2026',
    tags: ['Regular'], notes: 'From Milan. Likes voice notes. Responds best in the evening.',
    msgs: [m('fan', 'Buongiorno Sofia ☀️', 'Yesterday'),
      m('me', 'Buongiorno Marco 😘 dormito bene?', 'Yesterday', 'ai'),
      m('fan', 'Ciao bella, come stai stasera?', '11:20')] },
  { id: 'f7', name: 'Luca', creator: 'sofia', lang: 'IT', spend: 40, last: 'Today', since: 'Oct 2026',
    tags: ['New sub'], notes: '',
    msgs: [m('fan', 'Grazie per il benvenuto!', '09:12'),
      m('me', 'Figurati Luca 💕 sono felice che tu sia qui', '09:15', 'script')] },
  { id: 'f8', name: 'Tom', creator: 'sofia', lang: 'EN', spend: 95, last: 'Sun', since: 'Aug 2026',
    tags: ['Regular'], notes: 'From London. Writes in English.',
    msgs: [m('fan', 'hey Sofia, how is Italy today?', '10:40')] },
  { id: 'f9', name: 'Chris', creator: 'bella', lang: 'EN', spend: 310, last: '2 wks', since: 'Apr 2026', quietDays: 12, sub: 'expired', expired: 'Oct 8',
    tags: ['Regular'], notes: 'Used to buy every week, went quiet. Subscription ran out Oct 8.',
    msgs: [m('fan', 'night babe', 'Oct 3'), m('me', 'Night Chris 💕 sweet dreams', 'Oct 3', 'ai')] },
  { id: 'f10', name: 'Sam', creator: 'bella', lang: 'EN', spend: 640, last: '9 days', since: 'Dec 2025', quietDays: 9,
    tags: ['Big spender'], notes: 'Likes gym sets. Busy with work lately.',
    msgs: [m('me', 'Hope work is treating you okay Sam 🙈', 'Oct 6', 'ai')] },
  { id: 'f4', name: 'Mikko', creator: 'aino', lang: 'FI', spend: 145, last: 'Sat', since: 'Jul 2026',
    tags: ['Customs'], notes: 'Helsinki. Asked about customs twice before.',
    msgs: [m('fan', 'Moi Aino, ihana uusi kuva 😍', 'Yesterday'),
      m('me', 'Kiitos Mikko 😊 otin sen just saunan jälkeen', 'Yesterday', 'ai'),
      m('fan', 'Paljonko maksaa custom video?', '11:05')] },
  { id: 'f5', name: 'Nikos', creator: 'eleni', lang: 'EL', spend: 520, last: 'Thu', since: 'Feb 2026',
    tags: ['Big spender'], notes: 'Athens. Tips well after voice notes.',
    msgs: [m('fan', 'Καληνύχτα κούκλα', 'Yesterday'),
      m('me', 'Καληνύχτα μωρό μου 💋', 'Yesterday', 'ai'),
      m('fan', 'Καλημέρα κούκλα μου, σε σκεφτόμουν', '10:50')] },
];

// Saved scripts, sent exactly as written. A script can be a storyline of several steps:
// step 1 goes out when a trigger word matches, and each next step goes out on the fan's next message.
const step = (label, text, price = 0) => ({ label, text, price });
export const scripts = [
  { id: 's1', name: 'Shower video storyline', lang: 'EN', creator: 'bella', triggers: ['video', 'shower', 'new content'], enabled: true,
    steps: [
      step('Tease', 'Funny you ask {name}… I filmed something in the shower this morning 🫣 want a little peek?'),
      step('Build', "It's steamy babe… just me, the water and a slow little show 🙈 I only share it with my favourites"),
      step('Sell', "Okay you've been so sweet, here it is 💕 unlocked just for you", 25),
    ] },
  { id: 's2', name: 'Custom price list', lang: 'EN', creator: 'all', triggers: ['custom', 'how much', 'price'], enabled: true,
    steps: [step('Message', "Customs start at $60 {name} 😘 tell me exactly what you'd like and I'll make it just for you")] },
  { id: 's3', name: 'Welcome new sub', lang: 'EN', creator: 'all', triggers: ['just subscribed', 'new here'], enabled: true, welcome: true,
    steps: [step('Message', "Welcome {name} 🙈 so happy you're here. I saved something special for new subs 💕")] },
  { id: 's4', name: 'Video nuovo PPV', lang: 'IT', creator: 'sofia', triggers: ['video', 'nuovo'], enabled: true,
    steps: [step('Tease', 'Ho appena girato un video nuovo {name} 🫣 vuoi vederlo?'), step('Sell', 'Eccolo, solo per te 💕', 20)] },
  { id: 's5', name: 'Custom hinnasto', lang: 'FI', creator: 'aino', triggers: ['custom', 'paljonko', 'hinta'], enabled: true,
    steps: [step('Message', 'Hei {name} 😊 custom-videot alkaen 60 $. Kerro mitä toivot, niin teen sen just sulle 💋')] },
  { id: 's6', name: 'Νέο βίντεο PPV', lang: 'EL', creator: 'eleni', triggers: ['βίντεο', 'καινούριο'], enabled: true,
    steps: [step('Tease', 'Μόλις τράβηξα κάτι καινούριο {name} 🫣 θες να το δεις;'), step('Sell', 'Ορίστε μωρό μου, μόνο για σένα 💕', 25)] },
  { id: 's7', name: 'Win back quiet fan', lang: 'EN', creator: 'all', triggers: [], enabled: true,
    steps: [step('Message', "Hey {name}, haven't heard from you in a while… I saved something for you 👀", 15)] },
];

// Older saved scripts had a single text and price.
export const normalizeScript = (s) => (s?.steps?.length ? s : { ...s, steps: [step('Message', s?.text || '', s?.price || 0)] });

// Accounts that would come back from OnlyFansAPI when connecting a new creator (demo only).
export const availableAccounts = [
  { handle: '@miaskye', name: 'Mia Skye', subs: 2310 },
  { handle: '@laurabianchi', name: 'Laura Bianchi', subs: 740 },
  { handle: '@kaisa.n', name: 'Kaisa Niemi', subs: 455 },
  { handle: '@daphne.k', name: 'Daphne Kosta', subs: 1105 },
];

// Sample incoming messages for the "Simulate fan message" button.
export const incoming = {
  EN: ['can I get a custom? how much?', "you're so beautiful", 'can we meet up irl sometime?', 'any new content this week?', 'what are you up to tonight?'],
  IT: ['Hai qualche video nuovo?', 'Che fai stasera?', 'Sei bellissima'],
  FI: ['Mitä teet tänään?', 'Oot tosi kaunis', 'Paljonko hinta on customille?'],
  EL: ['Έχεις κανένα καινούριο βίντεο;', 'Τι κάνεις απόψε;', 'Είσαι πανέμορφη'],
};

// Used only when no OpenRouter key is set.
export const mockReplies = {
  EN: ['Haha you always know how to make me smile {name} 😊 lazy night for me. what about you?', 'Mmm I was literally just thinking about you 🙈 how was your day babe?', "You're sweet {name} 💕 tell me something you've never told anyone"],
  IT: ['Ciao {name} 😘 stanchissima, ma ora che mi scrivi va meglio… tu che fai di bello?', 'Mi fai sempre sorridere {name} 🙈 raccontami la tua giornata'],
  FI: ['Moi {name} 😊 kiva kuulla susta! Mitä sulle kuuluu tänään?', 'Haha sä oot ihana 🙈 mitä teet just nyt?'],
  EL: ['Καλημέρα {name} μου 🥰 κι εγώ σε σκεφτόμουν… τι κάνεις σήμερα;', 'Χαχα με κάνεις πάντα να χαμογελάω 🙈 πώς πέρασες τη μέρα σου;'],
};

// "Get to know her" questionnaire on the Creators page. The answers go into every AI reply,
// so the AI talks about her life, boundaries and selling style the way the agency wants.
export const PROFILE_QUESTIONS = [
  { group: 'About her', key: 'age', q: 'How old does she say she is?', ph: '24' },
  { group: 'About her', key: 'from', q: 'Where does she say she is from or lives?', ph: 'From Athens, lives near the sea. Never the exact area.' },
  { group: 'About her', key: 'life', q: 'What does she say about her daily life or job?', ph: 'Studies design, works out every morning, loves lazy Sundays' },
  { group: 'About her', key: 'hobbies', q: 'Hobbies and favourite things?', ph: 'Gym, beach, cooking pasta, reggaeton, Netflix thrillers' },
  { group: 'About her', key: 'relationship', q: 'Relationship status she tells fans?', ph: 'Single' },
  { group: 'About her', key: 'family', q: 'Can she talk about her family? What does she say?', ph: 'Only that she has a younger sister. Nothing else.' },
  { group: 'About her', key: 'pets', q: 'Pets?', ph: 'A cat called Luna' },
  { group: 'How she texts', key: 'personality', q: 'Her personality in a few words?', ph: 'Sweet, teasing, a bit bratty' },
  { group: 'How she texts', key: 'petNames', q: 'Pet names she calls fans?', ph: 'babe, baby, handsome' },
  { group: 'How she texts', key: 'emojis', q: 'Emojis she uses (and ones she never uses)?', ph: 'Uses 🙈 😏 💕. Never 😂' },
  { group: 'How she texts', key: 'spice', q: 'How explicit can she get?', options: [['explicit', 'Fully explicit when he is'], ['flirty', 'Sexy, but explicit only if he starts it'], ['soft', 'Flirty and suggestive, never graphic']] },
  { group: 'How she texts', key: 'length', q: 'How long are her messages?', options: [['short', 'Short: 1–2 sentences'], ['medium', 'Medium: 2–4 sentences']] },
  { group: 'Boundaries', key: 'neverTopics', q: 'Topics she never talks about?', ph: 'Politics, religion, her ex, her real name' },
  { group: 'Boundaries', key: 'neverShare', q: 'Things she must never say or share?', ph: 'Her location, school, workplace, family names' },
  { group: 'Boundaries', key: 'doesDont', q: 'Content she does and doesn’t do?', ph: 'Does: solo, toys, lingerie, feet. Doesn’t: boy/girl, face in explicit content' },
  { group: 'Selling', key: 'customs', q: 'Customs she makes, and prices?', ph: 'Videos from $70, pics from $30, dick ratings $15' },
  { group: 'Selling', key: 'push', q: 'How hard should she sell?', options: [['normal', 'Normal'], ['gentle', 'Gentle: only when he asks'], ['hard', 'Hard: look for chances to sell']] },
  { group: 'Selling', key: 'discounts', q: 'Discounts allowed?', ph: 'Never. Or: up to 20% for big spenders' },
  { group: 'Contact & socials', key: 'telegram', q: 'Telegram username', ph: '@bellarae', social: true },
  { group: 'Contact & socials', key: 'instagram', q: 'Instagram', ph: '@bellarae', social: true },
  { group: 'Contact & socials', key: 'snapchat', q: 'Snapchat', ph: 'bellarae', social: true },
  { group: 'Contact & socials', key: 'twitter', q: 'X / Twitter', ph: '@bellarae', social: true },
  { group: 'Contact & socials', key: 'otherSocial', q: 'Other (WhatsApp, link…)', ph: 'linktr.ee/bellarae', social: true },
  { group: 'Situations', key: 'calls', q: 'If he asks for a video call or voice note?', ph: 'No calls. Voice notes as a custom for $20' },
  { group: 'Situations', key: 'botAnswer', q: 'If he asks whether she’s real or a bot?', ph: 'Her team helps her keep up with messages, but everything you get here is hers' },
  { group: 'Situations', key: 'rude', q: 'If a fan is rude or insulting?', ph: 'Stay calm and playful once; if he keeps going, stop replying' },
  { group: 'Situations', key: 'other', q: 'Anything else the AI should know?', ph: 'She just got back from Mykonos. Birthday in March.' },
];
