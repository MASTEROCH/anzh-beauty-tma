/* Single source of truth for the studio's details — address, map, hours. */
export const clinic = {
  name: 'ANZH Cosmetology',
  street: 'Parnavaz Mepe 92/94',
  floor: { ru: '3 этаж · домофон 12', en: 'Floor 3 · intercom 12' },
  city: { ru: 'Батуми, Грузия', en: 'Batumi, Georgia' },
  lat: 41.6462,
  lon: 41.6324,
  instagram: 'https://instagram.com/dr.domnich',
  hours: { ru: 'вт–сб · 09:00–20:00', en: 'Tue–Sat · 09:00–20:00' },
} as const;

export function clinicAddress(lang: 'ru' | 'en') {
  return `${clinic.street}, ${clinic.floor[lang]}, ${clinic.city[lang]}`;
}

export const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${clinic.lat},${clinic.lon}`;
