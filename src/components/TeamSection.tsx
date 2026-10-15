import { t, type Lang } from '../lib/i18n';
import { asset } from '../lib/asset';
import { teamPhoto, TEAM } from '../data/team';

/** "Who you'll meet" (K15): round portraits, names without surnames, roles; no buttons.
    A member whose portrait may not be shown is not drawn (data/team.ts). */
export function TeamSection({ lang }: { lang: Lang }) {
  const team = TEAM.flatMap((m) => {
    const p = teamPhoto(m);
    return p ? [{ m, p }] : [];
  });
  if (team.length === 0) return null;
  return (
    <section className="section section-tight" data-testid="team-block">
      <div className="section-head">
        <div>
          <div className="eyebrow">{t('team.eyebrow', lang)}</div>
          <h2 className="section-title">{t('team.title', lang)}</h2>
        </div>
      </div>
      <ul className="team-strip" aria-label={t('team.label', lang)}>
        {team.map(({ m, p }) => (
          <li key={m.id} className="team-card" data-member={m.id}>
            <img className="team-photo" src={asset(p.src)} width={p.w} height={p.h} loading="lazy" decoding="async" alt="" />
            <span className="team-name">{m.name[lang]}</span>
            <span className="team-role">{m.role[lang]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
