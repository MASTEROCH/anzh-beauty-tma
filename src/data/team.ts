// K15 (owner 07.10, "все свои фотки выкладывай"): the studio team on the main screen.
// Data only. Names without surnames (works.ts); no buttons. The three masters with works take
// their portrait through masterPhoto(), so the `published` switch of works.ts rules here too;
// Maria and Daria have their own file and switch. Portraits — square crops of
// "Фото мастера …" from the team folder, 480 px, under /photos/works/ or /photos/team/.

import { masterPhoto, MASTERS, type MasterId } from './works';

export type TeamPhoto = { src: string; w: number; h: number; published: boolean };
export type TeamMember = {
  id: 'anzhelika' | 'ekaterina' | 'roman' | 'mariya' | 'darya';
  name: { ru: string; en: string };
  role: { ru: string; en: string };
  /** A master with works: the portrait is read through masterPhoto() at render time. */
  master?: MasterId;
  /** Everyone else: an own file and switch. */
  photo?: TeamPhoto;
};

/** The portrait that may be shown now, or null. */
export const teamPhoto = (m: TeamMember): TeamPhoto | null => {
  if (m.master) {
    const p = masterPhoto(m.master);
    return p ? { src: p.src, w: p.w, h: p.h, published: p.published } : null;
  }
  return m.photo && m.photo.published ? m.photo : null;
};

/* Order and roles — Sanya's K15 §3, the lawyer's table (roles «как есть»). */
export const TEAM: readonly TeamMember[] = [
  { id: 'anzhelika', name: MASTERS.anzhelika.name, role: { ru: 'Косметолог, владелица', en: 'Cosmetologist, owner' }, master: 'anzhelika' },
  { id: 'ekaterina', name: MASTERS.ekaterina.name, role: { ru: 'Бровист', en: 'Brow artist' }, master: 'ekaterina' },
  { id: 'roman', name: MASTERS.roman.name, role: { ru: 'Лазерное удаление', en: 'Laser removal' }, master: 'roman' },
  { id: 'mariya', name: { ru: 'Мария', en: 'Maria' }, role: { ru: 'Дерматолог', en: 'Dermatologist' }, photo: { src: '/photos/team/mariya.webp', w: 480, h: 480, published: true } },
  { id: 'darya', name: { ru: 'Дарья', en: 'Daria' }, role: { ru: 'Администратор', en: 'Receptionist' }, photo: { src: '/photos/team/darya.webp', w: 480, h: 480, published: true } },
];
