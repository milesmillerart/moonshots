// Render quality tiers. Phones default to Low, desktops to High; the pause-menu setting overrides (applies on reload).
// Settings live in warden.settings.v1 (not in save slots), so tiers never touch save data.
export const TIERS = {
  low: { name: 'low', label: 'Low (phones)', prCap: 1.0, shadowMap: 512, softShadows: false, ao: false, bloomDiv: 4, tex: '512', hdri: '512',
    rain: 1800, signLights: 2, lampLightEvery: 4, shafts: true, streaks: true, grain: false, aa: false, maxAniso: 2 },
  medium: { name: 'medium', label: 'Medium', prCap: 1.25, shadowMap: 1024, softShadows: true, ao: false, bloomDiv: 2, tex: '1k', hdri: '512',
    rain: 4000, signLights: 4, lampLightEvery: 3, shafts: true, streaks: true, grain: true, aa: false, maxAniso: 4 },
  high: { name: 'high', label: 'High', prCap: 1.5, shadowMap: 2048, softShadows: true, ao: true, bloomDiv: 2, tex: '1k', hdri: '1k',
    rain: 6000, signLights: 4, lampLightEvery: 2, shafts: true, streaks: true, grain: true, aa: true, maxAniso: 8 },
};
export const Q = { ...TIERS.high };
export function pickTier(settings, isTouch) {
  const n = settings?.quality && TIERS[settings.quality] ? settings.quality : (isTouch ? 'low' : 'high');
  Object.assign(Q, TIERS[n]);
  return Q;
}
