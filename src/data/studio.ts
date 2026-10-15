// K15 (owner 07.10): the studio cover video and the studio photos on the main screen.
// Data only. Paths are relative to `public/` and live under /photos/studio/ (vercel.json:
// a new top-level folder would answer with index.html). Readers wrap them in `asset()`.
//
// The cover is the owner's route video (IMG_3732.MOV: the street, the sign, the call button,
// the stairs, the door), HDR → SDR, 540×960, 12 s, with its own street sound (AAC mono).
// The file name carries a version: vercel.json caches /photos/ for an hour in the browser
// (max-age=3600) and for a day at the CDN (s-maxage=86400, then stale-while-revalidate for a
// week) — a new cut gets a new name, not the same one. The same goes for any replaced photo
// here or in team.ts: a new file name, or the old one stays in caches (Censor C9).
// Size budget of the cover: ≤ 1.1 MB (k15-media checks the file) — it plays on the first screen.

export type StudioShot = {
  /** Source frame: `<n>` — about-anzh-studio/<n>.webp, `v<NN>` — the poster of video-<NN>. */
  id: string;
  src: string;
  /** The 480 px copy for the strip; the posters are 464 px already — the same file. */
  thumb: string;
  w: number;
  h: number;
  caption: { ru: string; en: string };
};

export const STUDIO_COVER = {
  video: '/photos/studio/cover-v1.mp4',
  poster: '/photos/studio/cover-v1-poster.webp',
  w: 540,
  h: 960,
} as const;

const frame = (n: string, ru: string, en: string, w = 900, h = 1600): StudioShot =>
  ({ id: n, src: `/photos/studio/${n}.webp`, thumb: `/photos/studio/${n}-480.webp`, w, h, caption: { ru, en } });
const poster = (n: string, ru: string, en: string): StudioShot =>
  ({ id: n, src: `/photos/studio/${n}.webp`, thumb: `/photos/studio/${n}.webp`, w: 464, h: 848, caption: { ru, en } });

/* Sanya's order: the way in → inside → details. Owner 07.10 (K15c, "bring it all back"): all 32
   studio photos are shown — the strip keeps its 12, every other photo is in "All photos". The
   captions name what is in the frame, never a brand. */
export const STUDIO_STRIP: readonly StudioShot[] = [
  poster('v38', 'Вывеска студии у входа', 'The studio sign at the entrance'),
  poster('v33', 'Ресепшен', 'Reception'),
  poster('v43', 'Зона ожидания', 'The waiting area'),
  frame('7', 'Кресла в зоне ожидания', 'Armchairs in the waiting area'),
  poster('v35', 'Кабинет: кресло и лампа', 'The treatment room: the chair and the lamp'),
  frame('16', 'Аппарат в кабинете', 'A device in the treatment room'),
  poster('v37', 'Стеллаж с сертификатами в рамках', 'A shelf with framed certificates'),
  frame('8', 'Роспись на стене', 'A mural on the wall'),
  frame('30', 'Губы на полке', 'Lips on a shelf'),
  frame('11', 'Зеркало в форме губ', 'A lip-shaped mirror'),
  frame('6', 'Бюст с мхом и ваза со шприцами', 'Bust with moss and a vase of syringes'),
  frame('14', 'Подготовка к процедуре', 'Preparing for a treatment'),
];

/** Only in the "All photos" sheet. */
export const STUDIO_MORE: readonly StudioShot[] = [
  frame('23', 'Ваза со шприцами', 'A vase of syringes'),
  frame('27', 'Шприцы на светлой поверхности', 'Syringes on a light surface'),
  frame('15', 'Ваза со шприцами у зеркала', 'A vase of syringes by the mirror'),
  frame('18', 'Лоток со шприцем, рука в перчатке', 'A tray with a syringe, a gloved hand'),
  // K15c: the 21 photos that did not stand before — decor, then the products, then the printed things
  frame('22', 'Бюст с мхом и лоток со шприцем', 'Bust with moss and a tray with a syringe'),
  frame('26', 'Губы и шприцы на столе', 'Lips and syringes on a table'),
  frame('28', 'Коробка, шприцы и губы', 'A box, syringes and lips'),
  frame('25', 'Бокал со шприцами', 'A glass bowl of syringes'),
  frame('3', 'Ваза с флаконами', 'A vase of vials'),
  frame('4', 'Пакет студии и ваза с флаконами', 'The studio bag and a vase of vials'),
  frame('31', 'Ваза с флаконами и коробки', 'A vase of vials and boxes'),
  frame('1', 'Флаконы в лотке', 'Vials in a tray'),
  frame('2', 'Флаконы в коробке', 'Vials in a box'),
  frame('12', 'Ампулы и коробка препарата', 'Ampoules and a product box'),
  frame('32', 'Коробка препарата в руке', 'A product box in a hand', 960, 1280),
  frame('5', 'Полка с препаратами', 'A shelf with products'),
  frame('13', 'Стопка коробок препаратов', 'A stack of product boxes'),
  frame('17', 'Коробки препаратов на полке', 'Product boxes on a shelf'),
  frame('9', 'Коробки препаратов в ряд', 'Product boxes in a row'),
  frame('10', 'Коробки препаратов на столе', 'Product boxes on a table'),
  frame('20', 'Лист рекомендаций косметолога', 'The cosmetologist’s recommendation sheet', 1200, 1600),
  frame('21', 'Плакат по анатомии лица', 'A facial anatomy poster'),
  frame('24', 'Плакат в студии', 'A poster in the studio'),
];

export const STUDIO_PHOTOS: readonly StudioShot[] = [...STUDIO_STRIP, ...STUDIO_MORE];
