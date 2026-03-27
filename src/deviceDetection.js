export function detectDevice() {
  const w = window.innerWidth;
  const ua = navigator.userAgent.toLowerCase();

  // Check for TV-like user agents only — screen width alone is NOT enough
  // because laptops and desktop monitors commonly exceed 1200px
  const isTVAgent =
    /smart-tv|smarttv|googletv|appletv|hbbtv|pov_tv|netcast|viera|nettv|roku|dlnadoc|ce-html|tizen|webos/i.test(ua);

  // Mobile detection
  const isMobileAgent = /android|iphone|ipad|ipod|mobile|phone/i.test(ua);

  // Fine pointer (mouse) means laptop/desktop — never classify as TV
  const hasFinePointer = window.matchMedia('(pointer: fine)').matches;

  if (isMobileAgent || w < 768) return 'mobile';
  if (isTVAgent && !hasFinePointer) return 'tv';
  return 'desktop';
}

export function isMobile() {
  return detectDevice() === 'mobile';
}

export function isTV() {
  return detectDevice() === 'tv';
}
