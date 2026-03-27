export const GRID_COLS = 22;
export const GRID_ROWS = 6;

export const SCRAMBLE_DURATION = 800;
export const FLIP_DURATION = 300;
export const STAGGER_DELAY = 25;
export const TOTAL_TRANSITION = 3800;
export const MESSAGE_INTERVAL = 4000;

export const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,-!?\'/: ';

export const SCRAMBLE_COLORS = [
  '#00AAFF', '#00FFCC', '#AA00FF',
  '#FF2D00', '#FFCC00', '#FFFFFF'
];

export const ACCENT_COLORS = [
  '#C850C0', '#8B5CF6', '#C850C0',
  '#8B5CF6', '#C850C0'
];

export const SCRAMBLE_EMOJIS = [
  '😀','❤️','⭐','🔥','✨','💫','🎉','🎯','💡','🚀',
  '🏆','💜','🌟','🎨','💎','🍀','🦋','🐬','🌈','☀️',
  '⚡','🌊','🎵','🍕','👑','🦊','🌺','🎪','💥','🔮',
];

export const EMOJI_CATEGORIES = [
  { label: 'Smileys', icon: '😀', emojis: ['😀','😊','😍','🤔','😎','🥳','🤩','😂','😢','😮','🥹','😴','🤗','🤭','😏','😤','🤯','🥺','😇','🤠','😈','👻','💀','🤖','👽'] },
  { label: 'Hearts',  icon: '❤️', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💖','💗','💝','💞','💕','❣️','💔','💓','💟','♥️','🫀','❤️‍🔥'] },
  { label: 'Hands',   icon: '👋', emojis: ['👍','👋','🙌','💪','🫶','🤝','✌️','🤞','🫰','👌','🤌','🖐️','✋','🤙','👏','🙏','🤲','👊','✊','🤛','🤜','👈','👉','☝️','👆'] },
  { label: 'Animals', icon: '🦊', emojis: ['🐶','🐱','🐭','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐙','🦋','🐬','🦄','🐧','🦅','🐝','🐢','🦎','🐍','🦖','🐳'] },
  { label: 'Food',    icon: '🍕', emojis: ['🍎','🍊','🍋','🍇','🍓','🍕','🍔','🌮','☕','🍰','🍩','🍦','🎂','🧁','🥑','🍣','🥐','🍜','🥗','🧃','🥤','🍺','🍷','🧉','🍾'] },
  { label: 'Objects', icon: '🚀', emojis: ['📌','📝','🎨','🎵','🔥','💡','⭐','🎯','🚀','🏆','🎉','✨','💬','🔮','🎪','🎭','🎬','📸','🎸','💎','🔑','💰','📱','💻','🖥️'] },
  { label: 'Symbols', icon: '✨', emojis: ['✅','❌','⚠️','🔴','🟡','🟢','🔵','💯','🆕','🆒','♻️','⬆️','⬇️','▶️','⏸️','🔁','💥','🌀','⚡','🌊','❄️','🌈','☀️','🌙','⭐'] },
];

export function splitGraphemes(str) {
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter !== 'undefined') {
    const seg = new Intl.Segmenter();
    return [...seg.segment(str)].map(s => s.segment);
  }
  return [...str];
}

export function isEmojiChar(char) {
  if (!char || char === ' ') return false;
  return /\p{Extended_Pictographic}/u.test(char);
}

export const MESSAGES = [
  [
    '',
    '',
    'I ❤️',
    'FLAPSTR',
    '',
    ''
  ],
  [
    '',
    '',
    'STAY HUNGRY',
    'STAY FOOLISH',
    '- STEVE JOBS',
    ''
  ],
  [
    '',
    '',
    'GOD IS IN',
    'THE DETAILS .',
    '- LUDWIG MIES',
    ''
  ],
  [
    '',
    '',
    'GOOD DESIGN IS',
    'GOOD BUSINESS',
    '- THOMAS WATSON',
    ''
  ],
  [
    '',
    'LESS IS MORE',
    '',
    '- MIES VAN DER ROHE',
    '',
    ''
  ],
  [
    '',
    '',
    'MAKE IT SIMPLE',
    'BUT SIGNIFICANT',
    '- DON DRAPER',
    ''
  ],
  [
    '',
    '',
    'HAVE NO FEAR OF',
    'PERFECTION',
    '- SALVADOR DALI',
    ''
  ]
];
