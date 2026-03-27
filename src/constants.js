export const GRID_COLS = 22;
export const GRID_ROWS = 6;

export const SCRAMBLE_DURATION = 800;
export const FLIP_DURATION = 300;
export const STAGGER_DELAY = 25;
export const TOTAL_TRANSITION = 3800;
export const MESSAGE_INTERVAL = 4000;
/** Pause between board messages on the homepage (desktop/mobile site) before the next flip. */
export const HOME_MESSAGE_PAUSE_MS = 2000;

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
  ]
];

/** Board lines for clock mode (TV + mobile remote); matches split-flap layout. */
export function getClockLines() {
  const now = new Date();
  const h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  const timeStr = `${h12}:${m} ${ampm}`;
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  return ['', '', timeStr.toUpperCase(), dateStr.toUpperCase().slice(0, 22), '', ''];
}
