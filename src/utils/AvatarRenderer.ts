// Represents the user's selected parts
export interface AvatarConfig {
  skin: number;
  hairColor: number;
  hair: number;
  eyes: number;
  mouth: number;
  glasses: number;
  shirt: number;
  hat: number;
}

declare global {
  interface Window {
    CUP_AVATAR: any;
  }
}

export function renderAvatarSvg(avatar: Partial<AvatarConfig> = {}): string {
  const data = window.CUP_AVATAR;
  if (!data) return ''; // Loading fallback

  const part = (key: string) => data.parts[key][(avatar as any)[key] || 0] || data.parts[key][0];
  
  const head = data.base; // In pinplay it's data.base, wait, let me check avatar-runtime.js again.
  // "const part = key => data.parts[key][avatar[key] || 0] || data.parts[key][0];"
  // "const head = part('head')" => Wait! In avatar-parts.js, base is `data.base` but the runtime says `part('head')`. Let me double check avatar-parts.js.
  // Actually, I looked at avatar-parts.js. It has `"base":{"neck":"...","ears":"...","head":"...","cheeks":"..."}`. It doesn't have a `parts.head`. It is `data.base`.
  
  const skinColor = data.skins[avatar.skin || 0] || data.skins[0];
  const hairColorHex = data.hairColors[avatar.hairColor || 0] || data.hairColors[0];

  const base = data.base;
  const hair = part('hair');
  
  const bodyParts = [
    part('shirt').svg || '', 
    base.neck, 
    hair.back || '', 
    base.ears, 
    base.head, 
    base.cheeks,
    part('eyes').svg || '', 
    part('mouth')?.svg || '', 
    hair.front || '', 
    part('glasses')?.svg || '', 
    part('hat')?.svg || ''
  ].join('');

  const coloredBody = bodyParts
    .replace(/#00FFFF/gi, skinColor)
    .replace(/#FF00FF/gi, hairColorHex);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${data.viewBox}">${coloredBody}</svg>`;
}
