import { t, type Lang } from '../lib/i18n';
import { asset } from '../lib/asset';
import { openSheet, closeSheet } from '../lib/ui';
import { tap } from '../lib/haptics';
import { openExternal } from '../lib/telegram';
import { telegramUrl, instagramUrl } from '../data/location';
import { useStudio } from '../lib/studioProfile';
import { findService, sTitle } from '../data/services';
import { servicePrice } from '../lib/money';
import { Icon } from './Icon';
import { useTeamView, type TeamView } from '../lib/teamLive';

/** "Who you'll meet" (K15): round portraits, names without surnames, roles.
    A member whose portrait may not be shown is not drawn (data/team.ts).

    🚨 Кружок — ВХОД, а не украшение. Был просто портретом с подписью, и на
    вопрос «кто меня примет» отвечал наполовину: лицо есть, а чем человек
    занимается — нет. Тап открывает карточку: крупный портрет, регалии,
    чем занимается, и выход к его услугам.

    Кнопки разные по смыслу, а не по шаблону:
    · специалист — «его услуги» и «записаться»: к нему приходят за работой;
    · администратор — только связь со студией. Записаться «к администратору»
      нельзя, и кнопка, ведущая в пустоту, хуже её отсутствия. */
export function TeamSection({
  lang,
  onOpenService,
  onBook,
}: {
  lang: Lang;
  onOpenService: (id: string) => void;
  onBook: (serviceId?: string) => void;
}) {
  const ru = lang === 'ru';
  const studio = useStudio();
  const team = useTeamView();
  if (team.length === 0) return null;
  const shortOf = (m: TeamView) => (m.short ?? m.role)[lang];

  const openMember = (m: TeamView) => {
    tap();
    const photo = m.photo;
    const bio = { cred: m.cred, does: m.does };
    /* Только то, что реально на витрине: услуга без цены или длительности
       туда не попала, и строка о ней вела бы на пустой экран. */
    const services = m.services
      .map((id) => findService(id))
      .filter((s): s is NonNullable<typeof s> => !!s);
    const full = m.surname ? `${m.name[lang]} ${m.surname[lang]}` : m.name[lang];

    openSheet({
      title: full,
      subtitle: m.role[lang],
      body: (
        <div className="member">
          {photo ? (
            <img
              className="member-photo"
              src={asset(photo.src)}
              width={photo.w}
              height={photo.h}
              style={{ objectPosition: `${m.focus.x}% ${m.focus.y}%` }}
              alt={`${full} — ${m.role[lang]}`}
              decoding="async"
            />
          ) : <div className="member-photo member-photo--ini" aria-hidden>{m.name[lang].slice(0, 1)}</div>}

          {bio.cred && <p className="member-cred">{bio.cred[lang]}</p>}

          {bio.does[lang].length > 0 && (
            <>
              <div className="eyebrow sub-head">{ru ? 'чем занимается' : 'what they do'}</div>
              <ul className="info-list">
                {bio.does[lang].map((line) => <li key={line}>{line}</li>)}
              </ul>
            </>
          )}

          {services.length > 0 && (
            <>
              <div className="eyebrow sub-head">{ru ? 'услуги на витрине' : 'on the showcase'}</div>
              <div className="member-services">
                {services.map((s) => (
                  <button
                    key={s.id}
                    className="member-service"
                    onClick={() => { tap(); closeSheet(); onOpenService(s.id); }}
                  >
                    <span className="member-service-title">{sTitle(s, lang)}</span>
                    <span className="member-service-price">{servicePrice(s, lang)}</span>
                    <Icon name="chevron-right" size={14} strokeWidth={2.4} />
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="member-actions">
            {services.length > 0 ? (
              <button
                className="btn btn-primary btn-block"
                onClick={() => { tap(); closeSheet(); onBook(services[0].id); }}
              >
                <Icon name="calendar" size={16} strokeWidth={2} />
                {ru ? 'Записаться' : 'Book a visit'}
              </button>
            ) : (
              /* Нет услуг на витрине — значит записываться не к чему:
                 ведём в студию, там подскажут и запишут. */
              <button
                className="btn btn-primary btn-block"
                onClick={() => {
                  tap();
                  closeSheet();
                  openExternal(telegramUrl(ru ? `Здравствуйте! Вопрос к специалисту: ${full}` : `Hello! A question for ${full}`));
                }}
              >
                <Icon name="message" size={16} strokeWidth={2} />
                {ru ? 'Написать студии' : 'Message the studio'}
              </button>
            )}
            {/* Личные контакты — только если владелица разрешила их показывать */}
            {m.telegram && (
              <button className="btn btn-secondary btn-block" onClick={() => { tap(); openExternal(`https://t.me/${m.telegram}`); }}>
                <Icon name="send" size={15} strokeWidth={2} /> @{m.telegram}
              </button>
            )}
            {(m.instagram || studio.instagram) && (
              <button
                className="btn btn-secondary btn-block"
                onClick={() => { tap(); openExternal(instagramUrl(m.instagram ?? studio.instagram)); }}
              >
                <Icon name="camera" size={15} strokeWidth={2} />
                @{m.instagram ?? studio.instagram}
              </button>
            )}
          </div>
        </div>
      ),
    });
  };

  return (
    <section className="section section-tight" data-testid="team-block">
      <div className="section-head">
        <div>
          <div className="eyebrow">{t('team.eyebrow', lang)}</div>
          <h2 className="section-title">{t('team.title', lang)}</h2>
        </div>
      </div>
      <ul className="team-strip" aria-label={t('team.label', lang)}>
        {team.map((m) => (
          <li key={m.key} className="team-card" data-member={m.key}>
            <button className="team-open" onClick={() => openMember(m)} aria-label={`${m.name[lang]} — ${m.role[lang]}`}>
              {m.photo ? (
                <img
                  className="team-photo"
                  src={asset(m.photo.src)}
                  width={m.photo.w}
                  height={m.photo.h}
                  style={{ objectPosition: `${m.focus.x}% ${m.focus.y}%` }}
                  loading="lazy"
                  decoding="async"
                  alt=""
                />
              ) : <span className="team-photo team-photo--ini" aria-hidden>{m.name[lang].slice(0, 1)}</span>}
              <span className="team-name">{m.name[lang]}</span>
              <span className="team-role">{shortOf(m)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
