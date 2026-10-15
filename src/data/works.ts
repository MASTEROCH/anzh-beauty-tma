// Work photos of the studio's specialists (KT-7, K11a; owner's word 06.10 evening:
// "your own photos, old and new, in WebP"). Data only — imports are `import type` only,
// so a test can read this module without a browser.
//
// Each photo carries `published` — ONE place that decides whether it is shown. Since the
// owner's word 06.10 ("the consents are there, put all the photos"; Roman's portrait and the
// frames with a face — "he allowed it himself") every photo is shown (K11c). The switch stays:
// a photo set to `false` is not shown anywhere AND its file must be taken out of `public/`
// (a file in the bundle is published at a guessable address) — the test checks both.
// To add a photo: put the file from `_work/photos-webp/<id>.webp` (K11a) or `_work/photos-webp-2/`
// (K15) into `public/photos/works/`, with its 480 px copy next to it (`thumbOf`).
//
// Paths are relative to `public/` and live under `/photos/works/` only: vercel.json serves
// the app (index.html) for every top-level folder it does not list, so a new top-level
// folder would answer an image request with HTML in production. Readers wrap paths in
// `asset()` (lib/asset.ts) at render time.
//
// The "before → after" order of each collage follows Katya's reading of the frame
// (top / left — before), confirmed by John 06.10; the masters have not confirmed it yet.

export type WorkDirection = 'inj' | 'apparatus' | 'clean' | 'brows' | 'laser';
export type MasterId = 'anzhelika' | 'ekaterina' | 'roman';
/** How the frame reads — drives the tile badge and the order hint (Katya's table 4). */
export type WorkHint =
  | 'pairTb' // top — before, bottom — after
  | 'pairLr' // left — before, right — after
  | 'threeTb' // top to bottom: before, in progress, after
  | 'threeLr' // left to right: before, in progress, after
  | 'fourTb' // top to bottom: before, lightening, lamination, after
  | 'baked' // "ДО / ПОСЛЕ" are printed in the frame, in Russian
  | 'after' // a single "after" shot
  | 'process' // a single shot taken during or right after the treatment (K15)
  | 'collage'; // before and after in one photo, the order not stated (K15)

export type Work = {
  /** `<folder>/<n>` — the file name under /photos/works/ without the extension. */
  id: string;
  src: string;
  w: number;
  h: number;
  /** Catalog slug of the service the work belongs to. */
  slug: string;
  master: MasterId;
  hint: WorkHint;
  published: boolean;
  /** Sub-area inside the service ("chin", "bruxism") — added to the short title. */
  sub?: { ru: string; en: string };
};

/** A photo from the procedure folders (K15): no author — see PROCEDURE_AUTHOR. */
export type ProcedurePhoto = Omit<Work, 'master'>;

export type WorkGroup = {
  direction: WorkDirection;
  /** Short title for the tile and the photo caption (Katya: the full title up to the first "+"). */
  short: { ru: string; en: string };
  /** Full title for the sheet and the chat message when the service is not on the showcase. */
  full: { ru: string; en: string };
};

/* Titles — Katya's table 2 (T2 ed. 2 names). When the service IS on the showcase, the sheet
   and the chat message take the title of the catalog row instead (sTitle). */
export const WORK_GROUPS: Readonly<Record<string, WorkGroup>> = {
  /* K15: the procedure folders. Showcase titles = services.ts; the hidden ones — Sanya's K15 list */
  'lip-filler': {
    direction: 'inj',
    short: { ru: 'Увеличение губ', en: 'Lip enhancement' },
    full: { ru: 'Увеличение губ', en: 'Lip enhancement' },
  },
  'contour-plastic': {
    direction: 'inj',
    short: { ru: 'Контурная пластика', en: 'Facial contouring' },
    full: { ru: 'Контурная пластика', en: 'Facial contouring' },
  },
  'filler-dissolve': {
    direction: 'inj',
    short: { ru: 'Удаление филлера', en: 'Filler removal' },
    full: { ru: 'Удаление филлера', en: 'Filler removal' },
  },
  'biorevit': {
    direction: 'inj',
    short: { ru: 'Биоревитализация', en: 'Biorevitalization' },
    full: { ru: 'Биоревитализация', en: 'Biorevitalization' },
  },
  'botulinum': {
    direction: 'inj',
    short: { ru: 'Ботулинотерапия', en: 'Botulinum therapy' },
    full: { ru: 'Ботулинотерапия', en: 'Botulinum therapy' },
  },
  'collagen-stimulators': {
    direction: 'inj',
    short: { ru: 'Коллагеностимуляторы', en: 'Collagen stimulators' },
    full: { ru: 'Коллагеностимуляторы', en: 'Collagen stimulators' },
  },
  'mono-threads': {
    direction: 'inj',
    short: { ru: 'Армирующие мононити', en: 'Reinforcing mono threads' },
    full: { ru: 'Армирующие мононити', en: 'Reinforcing mono threads' },
  },
  'mesotherapy': {
    direction: 'inj',
    short: { ru: 'Мезотерапия', en: 'Mesotherapy' },
    full: { ru: 'Мезотерапия', en: 'Mesotherapy' },
  },
  'liquid-threads': {
    direction: 'inj',
    short: { ru: 'Жидкие нити', en: 'Liquid threads' },
    full: { ru: 'Жидкие нити', en: 'Liquid threads' },
  },
  'blanching': {
    direction: 'inj',
    short: { ru: 'Бланшинг', en: 'Blanching' },
    full: { ru: 'Бланшинг', en: 'Blanching' },
  },
  'lipolytics': {
    direction: 'inj',
    short: { ru: 'Липолитики', en: 'Lipolytics' },
    full: { ru: 'Липолитики', en: 'Lipolytics' },
  },
  'smas-lifting': {
    direction: 'apparatus',
    short: { ru: 'SMAS-лифтинг аппаратный', en: 'SMAS lifting (device)' },
    full: { ru: 'SMAS-лифтинг аппаратный', en: 'SMAS lifting (device)' },
  },
  'deep-cleansing': {
    direction: 'clean',
    short: { ru: 'Глубокая чистка лица', en: 'Deep facial cleansing' },
    full: { ru: 'Глубокая чистка лица', en: 'Deep facial cleansing' },
  },
  'brow-pmu': {
    direction: 'brows',
    short: { ru: 'Пудровые брови', en: 'Powder brows' },
    full: { ru: 'Пудровые брови', en: 'Powder brows' },
  },
  'brow-shape-tint': {
    direction: 'brows',
    short: { ru: 'Коррекция и окрашивание бровей', en: 'Brow shaping and tinting' },
    full: { ru: 'Коррекция и окрашивание бровей', en: 'Brow shaping and tinting' },
  },
  'brow-shape-or-tint': {
    direction: 'brows',
    short: { ru: 'Коррекция или окрашивание бровей', en: 'Brow shaping or tinting' },
    full: { ru: 'Коррекция или окрашивание бровей', en: 'Brow shaping or tinting' },
  },
  'brow-lamination': {
    direction: 'brows',
    short: { ru: 'Ламинирование бровей', en: 'Brow lamination' },
    full: { ru: 'Ламинирование бровей + коррекция и окрашивание', en: 'Brow lamination + shaping and tinting' },
  },
  'brow-lamination-lightening': {
    direction: 'brows',
    short: { ru: 'Ламинирование бровей + осветление', en: 'Brow lamination + lightening' },
    full: {
      ru: 'Ламинирование бровей + осветление + коррекция и окрашивание',
      en: 'Brow lamination + lightening + shaping and tinting',
    },
  },
  'brow-lightening': {
    direction: 'brows',
    short: { ru: 'Осветление бровей', en: 'Brow lightening' },
    full: { ru: 'Осветление бровей + коррекция и окрашивание', en: 'Brow lightening + shaping and tinting' },
  },
  'pmu-removal': {
    direction: 'laser',
    short: { ru: 'Лазерное удаление перманентного макияжа', en: 'Laser removal of permanent makeup' },
    full: { ru: 'Лазерное удаление перманентного макияжа', en: 'Laser removal of permanent makeup' },
  },
  'tattoo-removal': {
    direction: 'laser',
    short: { ru: 'Лазерное удаление татуировок', en: 'Laser tattoo removal' },
    full: { ru: 'Лазерное удаление татуировок', en: 'Laser tattoo removal' },
  },
  'pigment-removal': {
    direction: 'laser',
    short: { ru: 'Удаление пигментных пятен', en: 'Pigment spot removal' },
    full: { ru: 'Удаление пигментных пятен', en: 'Pigment spot removal' },
  },
};

function portrait(id: 'anzhelika' | 'ekaterina'): Work {
  return { id: `master-${id}/1`, src: `/photos/works/master-${id}/1.webp`, w: 480, h: 480, slug: '', master: id, hint: 'after', published: true };
}

/* Names in English as John fixed them 06.10 (Ekaterina, Roman); no surnames. */
export const MASTERS: Readonly<Record<MasterId, { name: { ru: string; en: string }; photo: Work | null }>> = {
  anzhelika: {
    name: { ru: 'Анжелика', en: 'Anjelika' },
    // K15: "Фото мастера и владелицы" from the team folder, a square crop (a new file: the old portrait has its own readers)
    photo: portrait('anzhelika'),
  },
  ekaterina: {
    name: { ru: 'Екатерина', en: 'Ekaterina' },
    photo: portrait('ekaterina'), // K15: "Фото мастера Екатерины", a square crop
  },
  roman: {
    name: { ru: 'Роман', en: 'Roman' },
    // Portrait: Roman sent it himself and allowed it (owner, 06.10 — K11c). Shown in the sheet of his works.
    photo: {
      id: 'master-roman/1', src: '/photos/works/master-roman/1.webp', w: 600, h: 600,
      slug: '', master: 'roman', hint: 'after', published: true,
    },
  },
};

/* The procedure photos (K15) and whose they are. Nobody has confirmed where the 85 frames of the
   procedure folders come from, who did the work, or that the clients consented (Hater K15-H1;
   the lawyer, K15 block 1). Until then (John 07.10): they are NOT works of our specialists —
   not in the "Works" block, no author line, no consent line; each one is shown only on the
   screen of its own service, in the "Treatment photos" block, captioned by its sub-area. A
   service that is not on the showcase has no screen, so its photos are not shown at all.
   Once the clinic confirms origin and consent, ONE line brings them back as works:
   PROCEDURE_AUTHOR = '<master id>' — then they join the "Works" block after the K11a works,
   credited to that master, with the consent line, and the "Treatment photos" block is gone. */
export const PROCEDURE_AUTHOR: MasterId | null = null;

/** The 480 px copy next to every work photo (`<n>-480.webp`) — tiles and strips; the full file opens on a tap. */
export const thumbOf = (w: { src: string }): string => w.src.replace(/\.webp$/, '-480.webp');

const SUBS: Readonly<Record<string, { ru: string; en: string }>> = {
  'contour-nasolabial': { ru: 'носогубные складки', en: 'nasolabial folds' },
  'contour-chin': { ru: 'подбородок', en: 'chin' },
  'contour-cheekbones': { ru: 'скулы', en: 'cheekbones' },
  'contour-jawline': { ru: 'линия челюсти', en: 'jawline' },
  'botulinum-bruxism': { ru: 'бруксизм', en: 'bruxism' },
  'botulinum-hyperhidrosis': { ru: 'гипергидроз', en: 'hyperhidrosis' },
  'botulinum-platysma': { ru: 'платизма', en: 'platysma' },
  'collagen-caha': { ru: 'гидроксиапатит кальция', en: 'calcium hydroxyapatite' },
  'collagen-plla': { ru: 'полимолочная кислота', en: 'poly-L-lactic acid' },
  'collagen-plla-eyes': { ru: 'полимолочная кислота, под глазами', en: 'poly-L-lactic acid, under the eyes' },
  'lipolytics-face': { ru: 'лицо', en: 'face' },
  'lipolytics-body': { ru: 'тело', en: 'body' },
};

/* K15 registry (every frame of the 102 opened, Frodo 07.10). Owner 07.10 (K15c, "bring it all
   back"): every frame the clinic sent is shown — the 101 entries below cover all 102 source files
   (plla/1 = source 1 + 2 side by side, one woman, two files). K15 had left out 16 of them; they
   are back with a hint by what the frame shows: posters with one face (caha/5, plla/10, mono/6,
   smas/5) — 'after'; a poster with two lips (lips/1) and a promo collage (lips/3) — 'collage';
   packs (biorevit/9, botulinum/6, mono/5) and stock shots of an injection (botulinum/7–8) —
   'process'; illustrations with ДО / ПОСЛЕ printed (hyperhidrosis/3–5) — 'baked', like
   hyperhidrosis/1; the single frames blanching/1 (a smooth forehead, a selfie) — 'after',
   blanching/2 (the wheals on the couch) — 'process'. Collages without a written order are 'collage'. */
const proc = (id: string, w: number, h: number, slug: string, hint: WorkHint, published = true): ProcedurePhoto => ({
  id, src: `/photos/works/${id}.webp`, w, h, slug, hint, published,
  ...(SUBS[id.split('/')[0]] ? { sub: SUBS[id.split('/')[0]] } : {}),
});

const work = (id: string, w: number, h: number, slug: string, master: MasterId, hint: WorkHint, published: boolean): Work =>
  ({ id, src: `/photos/works/${id}.webp`, w, h, slug, master, hint, published });

/* K15 — injectables (showcase first, the body lipolytics last), the device, cleansing.
   Nothing hidden (owner 07.10, K15c). K15b had hidden botulinum-bruxism/1–2 (Hater K15-H2: a
   slimmer lower face next to "does not slim the face") and, by the lawyer, collagen-plla/1, /4
   and smas-lifting/1 — the owner brought all five back. */
export const PROCEDURE_PHOTOS: readonly ProcedurePhoto[] = [
  proc('contour-lips/1', 1206, 1597, 'lip-filler', 'collage'),
  proc('contour-lips/2', 908, 1600, 'lip-filler', 'collage'),
  proc('contour-lips/3', 926, 1600, 'lip-filler', 'collage'),
  proc('contour-lips/4', 1206, 1201, 'lip-filler', 'collage'),
  proc('contour-lips/5', 1206, 1194, 'lip-filler', 'collage'),
  proc('contour-nasolabial/1', 1206, 1143, 'contour-plastic', 'collage'),
  proc('contour-nasolabial/2', 1138, 1127, 'contour-plastic', 'collage'),
  proc('contour-nasolabial/3', 916, 1600, 'contour-plastic', 'collage'),
  proc('contour-nasolabial/4', 985, 1600, 'contour-plastic', 'collage'),
  proc('contour-chin/1', 1206, 1165, 'contour-plastic', 'collage'),
  proc('contour-chin/2', 1101, 1600, 'contour-plastic', 'after'),
  proc('contour-chin/3', 836, 1600, 'contour-plastic', 'collage'),
  proc('contour-cheekbones/1', 1206, 1198, 'contour-plastic', 'collage'),
  proc('contour-cheekbones/2', 1206, 965, 'contour-plastic', 'collage'),
  proc('contour-jawline/1', 1206, 1177, 'contour-plastic', 'collage'),
  proc('contour-jawline/2', 1206, 1506, 'contour-plastic', 'collage'),
  proc('contour-jawline/3', 1206, 1179, 'contour-plastic', 'collage'),
  proc('filler-dissolve/1', 1175, 1422, 'filler-dissolve', 'collage'),
  proc('filler-dissolve/2', 850, 1070, 'filler-dissolve', 'collage'),
  proc('filler-dissolve/3', 1089, 1444, 'filler-dissolve', 'collage'),
  proc('filler-dissolve/4', 1157, 1360, 'filler-dissolve', 'collage'),
  proc('biorevit/1', 1206, 1397, 'biorevit', 'collage'),
  proc('biorevit/2', 1160, 1448, 'biorevit', 'collage'),
  proc('biorevit/3', 1206, 1358, 'biorevit', 'collage'),
  proc('biorevit/4', 1134, 1401, 'biorevit', 'process'),
  proc('biorevit/5', 1157, 1456, 'biorevit', 'collage'),
  proc('biorevit/6', 1193, 1148, 'biorevit', 'collage'),
  proc('biorevit/7', 1136, 1120, 'biorevit', 'collage'),
  proc('biorevit/8', 1206, 1127, 'biorevit', 'collage'),
  proc('biorevit/9', 900, 1600, 'biorevit', 'process'),
  proc('botulinum/1', 1206, 1493, 'botulinum', 'collage'),
  proc('botulinum/2', 1140, 1506, 'botulinum', 'collage'),
  proc('botulinum/3', 1173, 1491, 'botulinum', 'collage'),
  proc('botulinum/4', 1206, 1193, 'botulinum', 'collage'),
  proc('botulinum/5', 1206, 1162, 'botulinum', 'collage'),
  proc('botulinum/6', 900, 1600, 'botulinum', 'process'),
  proc('botulinum/7', 1280, 848, 'botulinum', 'process'),
  proc('botulinum/8', 1280, 848, 'botulinum', 'process'),
  proc('botulinum-bruxism/1', 1189, 1158, 'botulinum', 'collage'),
  proc('botulinum-bruxism/2', 1157, 1439, 'botulinum', 'collage'),
  proc('botulinum-hyperhidrosis/1', 1206, 1294, 'botulinum', 'baked'),
  proc('botulinum-hyperhidrosis/2', 1206, 1291, 'botulinum', 'process'),
  proc('botulinum-hyperhidrosis/3', 1536, 1024, 'botulinum', 'baked'),
  proc('botulinum-hyperhidrosis/4', 1536, 1024, 'botulinum', 'baked'),
  proc('botulinum-hyperhidrosis/5', 1536, 1024, 'botulinum', 'baked'),
  proc('botulinum-platysma/1', 1206, 1258, 'botulinum', 'collage'),
  proc('botulinum-platysma/2', 1114, 1113, 'botulinum', 'collage'),
  proc('collagen-caha/1', 1101, 984, 'collagen-stimulators', 'collage'),
  proc('collagen-caha/2', 1111, 1367, 'collagen-stimulators', 'collage'),
  proc('collagen-caha/3', 960, 1129, 'collagen-stimulators', 'collage'),
  proc('collagen-caha/4', 1086, 937, 'collagen-stimulators', 'collage'),
  proc('collagen-caha/5', 720, 1280, 'collagen-stimulators', 'after'),
  proc('collagen-plla/1', 1600, 1323, 'collagen-stimulators', 'collage'),
  proc('collagen-plla/3', 908, 1600, 'collagen-stimulators', 'collage'),
  proc('collagen-plla/4', 1206, 1371, 'collagen-stimulators', 'collage'),
  proc('collagen-plla/5', 1206, 1143, 'collagen-stimulators', 'baked'),
  proc('collagen-plla/6', 1108, 1295, 'collagen-stimulators', 'collage'),
  proc('collagen-plla/7', 1068, 1075, 'collagen-stimulators', 'collage'),
  proc('collagen-plla/8', 1139, 1532, 'collagen-stimulators', 'collage'),
  proc('collagen-plla/9', 819, 1600, 'collagen-stimulators', 'collage'),
  proc('collagen-plla/10', 720, 1280, 'collagen-stimulators', 'after'),
  proc('collagen-plla-eyes/1', 891, 1600, 'collagen-stimulators', 'collage'),
  proc('mono-threads/1', 1186, 1140, 'mono-threads', 'collage'),
  proc('mono-threads/2', 1254, 1254, 'mono-threads', 'collage'),
  proc('mono-threads/3', 1177, 982, 'mono-threads', 'collage'),
  proc('mono-threads/4', 1206, 718, 'mono-threads', 'collage'),
  proc('mono-threads/5', 900, 1600, 'mono-threads', 'process'),
  proc('mono-threads/6', 720, 1280, 'mono-threads', 'after'),
  proc('mesotherapy/1', 1206, 1165, 'mesotherapy', 'collage'),
  proc('mesotherapy/2', 1147, 1416, 'mesotherapy', 'process'),
  proc('mesotherapy/3', 1192, 1174, 'mesotherapy', 'collage'),
  proc('mesotherapy/4', 1206, 1118, 'mesotherapy', 'collage'),
  proc('liquid-threads/1', 1206, 1191, 'liquid-threads', 'collage'),
  proc('liquid-threads/2', 1206, 1188, 'liquid-threads', 'collage'),
  proc('liquid-threads/3', 1125, 1007, 'liquid-threads', 'collage'),
  proc('liquid-threads/4', 719, 1280, 'liquid-threads', 'collage'),
  proc('blanching/1', 1600, 1200, 'blanching', 'after'),
  proc('blanching/2', 1600, 1200, 'blanching', 'process'),
  proc('blanching/3', 1600, 1200, 'blanching', 'process'),
  proc('blanching/4', 1197, 1454, 'blanching', 'collage'),
  proc('blanching/5', 1139, 1116, 'blanching', 'collage'),
  proc('blanching/6', 800, 1600, 'blanching', 'collage'),
  proc('lipolytics-face/1', 1187, 1320, 'lipolytics', 'collage'),
  proc('lipolytics-face/2', 1118, 1145, 'lipolytics', 'collage'),
  proc('lipolytics-face/3', 1148, 1435, 'lipolytics', 'collage'),
  proc('lipolytics-body/1', 1206, 1342, 'lipolytics', 'collage'),
  proc('lipolytics-body/2', 1600, 1600, 'lipolytics', 'collage'),
  proc('lipolytics-body/3', 1025, 592, 'lipolytics', 'collage'),
  proc('smas-lifting/1', 1162, 1039, 'smas-lifting', 'collage'),
  proc('smas-lifting/2', 1160, 1600, 'smas-lifting', 'collage'),
  proc('smas-lifting/3', 896, 1600, 'smas-lifting', 'collage'),
  proc('smas-lifting/4', 896, 1600, 'smas-lifting', 'collage'),
  proc('smas-lifting/5', 720, 1280, 'smas-lifting', 'after'),
  proc('deep-cleansing/1', 1206, 1554, 'deep-cleansing', 'collage'),
  proc('deep-cleansing/2', 1206, 1285, 'deep-cleansing', 'collage'),
  proc('deep-cleansing/3', 1206, 1152, 'deep-cleansing', 'collage'),
  proc('deep-cleansing/4', 1206, 1561, 'deep-cleansing', 'collage'),
  proc('deep-cleansing/5', 1206, 1198, 'deep-cleansing', 'collage'),
  proc('deep-cleansing/6', 1180, 1152, 'deep-cleansing', 'collage'),
  proc('deep-cleansing/7', 900, 1600, 'deep-cleansing', 'process'),
  proc('deep-cleansing/8', 900, 1600, 'deep-cleansing', 'process'),
];

/* K11a — brows and laser, the works of our specialists (the "Works" block).
   Sizes — _work/photos-webp/manifest.json. All shown (owner 06.10, K11c). Until then K11a kept
   hidden the recognisable ones: a face — brows-pmu 1–3, laser-brow-removal/1; partly —
   brows-lamination-correction-tint 1–2, brows-correction/1, brows-lightening-correction-tint/2;
   a tattoo — laser-tattoo-removal/1. Still open with the masters: "restored" in the source
   name of laser-brow-removal/1 (Roman: not retouched?) and the order hints marked below. */
export const WORKS: readonly Work[] = [
  work('brows-correction/1', 960, 1280, 'brow-shape-or-tint', 'ekaterina', 'threeTb', true),
  work('brows-correction/2', 960, 1280, 'brow-shape-or-tint', 'ekaterina', 'pairLr', true),
  work('brows-correction-tint/1', 960, 1280, 'brow-shape-tint', 'ekaterina', 'pairTb', true),
  work('brows-correction-tint/2', 960, 1280, 'brow-shape-tint', 'ekaterina', 'pairLr', true),
  work('brows-correction-tint/3', 960, 1280, 'brow-shape-tint', 'ekaterina', 'pairLr', true),
  // The circle on /1 may be "before" — until Ekaterina confirms, it is a single "after" (Katya, block 2)
  work('brows-lamination-correction-tint/1', 966, 1280, 'brow-lamination', 'ekaterina', 'after', true),
  work('brows-lamination-correction-tint/2', 1280, 1280, 'brow-lamination', 'ekaterina', 'pairTb', true),
  work('brows-lamination-lightening-correction-tint/1', 960, 1280, 'brow-lamination-lightening', 'ekaterina', 'fourTb', true),
  work('brows-lamination-lightening-correction-tint/2', 960, 1280, 'brow-lamination-lightening', 'ekaterina', 'pairLr', true),
  work('brows-lightening-correction-tint/1', 960, 1280, 'brow-lightening', 'ekaterina', 'threeLr', true),
  work('brows-lightening-correction-tint/2', 960, 1280, 'brow-lightening', 'ekaterina', 'pairLr', true),
  work('brows-pmu/1', 960, 1280, 'brow-pmu', 'ekaterina', 'after', true),
  work('brows-pmu/2', 960, 1280, 'brow-pmu', 'ekaterina', 'after', true),
  work('brows-pmu/3', 960, 1280, 'brow-pmu', 'ekaterina', 'after', true),
  work('laser-brow-removal/1', 900, 1600, 'pmu-removal', 'roman', 'baked', true),
  work('laser-brow-removal/2', 640, 853, 'pmu-removal', 'roman', 'pairLr', true),
  // "mid-course" waits for Roman; the fallback "top — before, bottom — after" is what the lawyer allows
  work('laser-tattoo-removal/1', 900, 1600, 'tattoo-removal', 'roman', 'pairTb', true),
  work('laser-pigment-removal/1', 720, 1280, 'pigment-removal', 'roman', 'baked', true),
];

/** The procedure photos as works — only once PROCEDURE_AUTHOR names their master. */
const creditedProcedures = (): Work[] => {
  const master = PROCEDURE_AUTHOR;
  return master === null ? [] : PROCEDURE_PHOTOS.map((p) => ({ ...p, master }));
};

/** Every work that may be shown, in data order: K11a first. A group with none of them is not drawn. */
export const shownWorks = (): Work[] => [...WORKS, ...creditedProcedures()].filter((x) => x.published);

/** Shown works of one service (the "Examples of work" block on its screen). */
export const worksFor = (slug: string): Work[] => shownWorks().filter((x) => x.slug === slug);

/** Shown procedure photos of one service (its "Treatment photos" block) — none once they are credited. */
export const procedurePhotosFor = (slug: string): ProcedurePhoto[] =>
  PROCEDURE_AUTHOR === null ? PROCEDURE_PHOTOS.filter((x) => x.published && x.slug === slug) : [];

/** The master's portrait if it may be shown, else null. */
export const masterPhoto = (id: MasterId): Work | null => {
  const p = MASTERS[id].photo;
  return p && p.published ? p : null;
};
