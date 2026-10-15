import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { openSheet, closeSheet, toast } from '../lib/ui';
import { QuizRunner } from './QuizRunner';
import { FREE_QUIZ } from '../data/quizzes';
import { useLang, type Lang, tr } from '../lib/i18n';
import { LegalLink } from './LegalFooter';
import { ApiError, useSession } from '../lib/session';
import { refreshMe, useMe } from '../lib/api';
import { HEALTH_LIMITS } from '../lib/api/medical';
import { grantConsent, isVersionMismatch, legalVersion } from '../lib/api/me';
import {
  useHealthState, useHealthConsent, ensureHealthLoaded,
  saveHealthForm, revokeHealthConsent, deleteHealthData,
  SKIN_TYPES, FITZPATRICK, SENSITIVITY_LABEL,
  type HealthPassport, type Sensitivity,
} from '../lib/healthPassport';
import { downloadMyData, useDestructiveBusy, withDestructiveLock } from '../lib/myData';

// Анкета здоровья. Правда — на сервере (lib/healthPassport.ts): форма
// показывается только поверх ЗАГРУЖЕННОЙ анкеты, потому что сохранение —
// полная замена документа. Не дочитали — ни формы, ни кнопки «Сохранить».

const COMMON_ALLERGIES = ['Лидокаин', 'Гиалуроновая кислота', 'Рыба / морепродукты', 'Пыльца', 'Антибиотики'];

/* Согласие на данные о здоровье — ОТДЕЛЬНОЕ от политики (онбординг) и
   спрашивается здесь, перед первым сохранением анкеты. Текст — короткая
   версия согласия Законника (16-legal-texts, health-consent SHORT) со
   строкой «Мне исполнилось 18 лет» (решение John). Место отзыва названо по
   НАСТОЯЩИМ кнопкам: здесь, в анкете, и в Настройках → «Мои данные»
   (раздела «Профиль» в приложении нет).
   Провод (решение John перед волной 2): POST /me/consents {kind:
   'health_data', version: Me.legal.health_data, lang: язык интерфейса}.
   Вид «согласие есть / нет» — по Me.consents.health_data (согласие ТЕКУЩЕЙ
   версии): вышла новая редакция — человек снова видит вопрос.
   [УТОЧНИТЬ: …] оставлен видимым: это черновик до слова владельца. */
const COPY = {
  consentTitle: { ru: 'Согласие на данные о здоровье', en: 'Health data consent' },
  why: {
    ru: 'Зачем: чтобы Анжелика учла противопоказания перед процедурой. В приложении анкету видит только Анжелика, каждый просмотр записывается.',
    en: 'Purpose: so Anjelika can check contraindications before a procedure. In the app, only Anjelika sees it; every view is logged.',
  },
  where: {
    ru: 'Храним в ЕС (Ирландия) до отзыва, но не дольше [УТОЧНИТЬ: срок].',
    en: 'Stored in the EU (Ireland) until I withdraw, but no longer than [TO CONFIRM].',
  },
  /* revoke и revokeConfirm — Законник, редакция 2026-09-25-draft2 (_work/18):
     разборов на сервере нет, стирается анкета вместе с итогами разборов в ней. */
  revoke: {
    ru: 'Отозвать можно в любой момент — здесь, в анкете, или в Настройках → «Мои данные»: анкета будет стёрта полностью, вместе с итогами разборов в ней.',
    en: 'I can withdraw any time — here, in the questionnaire, or in Settings → “My data”: the questionnaire will be erased in full, together with the analysis outcomes in it.',
  },
  full: { ru: 'Полный текст согласия', en: 'Full consent text' },
  check: {
    ru: 'Я даю согласие на обработку данных о здоровье из анкеты и разборов: аллергии, беременность и кормление грудью, хронические заболевания, лекарства, особенности кожи. Мне исполнилось 18 лет.',
    en: 'I consent to the processing of my health data from the questionnaire and analyses: allergies, pregnancy and breastfeeding, chronic conditions, medications, skin features. I am 18 or older.',
  },
  refuseOk: {
    ru: 'Без согласия анкета не сохранится, а запись работает как обычно — противопоказания Анжелика уточнит на приёме.',
    en: 'Without consent the questionnaire is not saved, and booking works as usual — Anjelika will check contraindications at the appointment.',
  },
  noVersion: {
    ru: 'Согласие пока нельзя дать: текст согласия ещё не утверждён. Записаться можно и без анкеты.',
    en: 'Consent cannot be given yet: the consent text is not approved. You can still book without the questionnaire.',
  },
  edition: { ru: 'Редакция', en: 'Version' },
  stale: {
    ru: 'Текст согласия обновился — открой новую редакцию, прочитай и отметь согласие заново.',
    en: 'The consent text has changed — open the new version, read it and tick consent again.',
  },
  seen: {
    ru: 'В приложении анкету видит только Анжелика — она смотрит её перед процедурой.',
    en: 'In the app, only Anjelika sees it — she reviews it before your treatment.',
  },
  given: { ru: 'Согласие на данные о здоровье дано', en: 'Health data consent given' },
  saved: {
    ru: 'Анкета сохранена — Анжелика посмотрит её перед процедурой',
    en: 'Saved — Anjelika will review it before your treatment',
  },
  revokeBtn: { ru: 'Отозвать согласие и удалить анкету', en: 'Withdraw consent and delete' },
  deleteBtn: { ru: 'Удалить анкету', en: 'Delete questionnaire' },
  revokeConfirm: {
    ru: 'Отозвать согласие? Анкета будет стёрта полностью — на сервере и на этом устройстве, вместе с итогами разборов в ней. Покупки останутся. Сначала можно скачать копию.',
    en: 'Withdraw consent? The questionnaire will be erased in full — on the server and on this device, together with the analysis outcomes in it. Purchases stay. You can download a copy first.',
  },
  deleteConfirm: {
    ru: 'Удалить анкету? Она будет стёрта на сервере и на этом устройстве. Сначала можно скачать копию.',
    en: 'Delete the questionnaire? It will be erased on the server and on this device. You can download a copy first.',
  },
  download: { ru: 'Скачать копию', en: 'Download a copy' },
  confirmYes: { ru: 'Удалить', en: 'Delete' },
  confirmNo: { ru: 'Не удалять', en: 'Keep it' },
  revoked: { ru: 'Согласие отозвано, анкета удалена', en: 'Consent withdrawn, questionnaire deleted' },
  deleted: { ru: 'Анкета удалена', en: 'Questionnaire deleted' },
  guest: {
    ru: 'Анкета хранится на сервере и заполняется в приложении ANZH в Telegram. Записаться можно и без неё — Анжелика спросит всё на приёме.',
    en: 'The questionnaire is stored on our server and filled in inside the ANZH app in Telegram. You can book without it — Anjelika will ask at the visit.',
  },
  signinFailed: {
    ru: 'Не удалось войти — анкета сейчас недоступна. Открой приложение заново.',
    en: 'Could not sign in — the questionnaire is unavailable right now. Reopen the app.',
  },
  loading: { ru: 'Загружаю анкету…', en: 'Loading the questionnaire…' },
  loadFailed: {
    ru: 'Не удалось загрузить анкету. Пока она не загружена, сохранять нельзя — иначе можно затереть сохранённое.',
    en: 'Could not load the questionnaire. Saving is off until it loads, so nothing saved gets overwritten.',
  },
  retry: { ru: 'Повторить', en: 'Retry' },
  soon: {
    ru: 'Анкета здоровья скоро появится. Записаться можно и без неё — Анжелика спросит всё на приёме.',
    en: 'The health questionnaire is coming soon. You can book without it — Anjelika will ask at the visit.',
  },
  soonHasDoc: {
    ru: 'У тебя сохранена анкета. Её можно удалить — это работает всегда.',
    en: 'You have a saved questionnaire. You can delete it — that always works.',
  },
} as const;

/** Слова для отказа сервера — по коду, без текста сервера на экране. */
function errorText(e: unknown, lang: Lang): string {
  const ru = lang === 'ru';
  const code = e instanceof ApiError ? e.code : '';
  const status = e instanceof ApiError ? e.status : 0;
  if (code === 'busy') return ru ? 'Подожди — предыдущее действие ещё выполняется.' : 'Please wait — the previous action is still running.';
  if (isVersionMismatch(e)) return COPY.stale[lang];
  if (code === 'not_configured') return COPY.noVersion[lang];
  if (code === 'consent_required') return ru ? 'Сервер не нашёл согласия — отметь его ещё раз.' : 'The server has no consent on record — tick it again.';
  if (code === 'feature_disabled') return COPY.soon[lang];
  if (code === 'not_loaded') return COPY.loadFailed[lang];
  if (status === 401) return COPY.signinFailed[lang];
  if (status === 422) return ru ? 'Анкета не сохранилась: слишком длинный текст в одном из полей.' : 'Not saved: one of the fields is too long.';
  if (status === 429) return ru ? 'Слишком часто — попробуй через минуту.' : 'Too many attempts — try again in a minute.';
  if (status === 0) return ru ? 'Нет связи — ничего не изменилось. Попробуй ещё раз.' : 'No connection — nothing changed. Try again.';
  return ru ? 'Не получилось — попробуй ещё раз.' : 'Something went wrong — try again.';
}

export function HealthPassportSheet({ onBook }: { onBook?: (id: string) => void }) {
  const lang = useLang();
  const session = useSession();
  const { me, loading: meLoading } = useMe();
  const health = useHealthState();

  if (session.status === 'guest') {
    return (
      <div className="hp-form">
        <Info text={session.reason === 'outside_telegram' ? COPY.guest[lang] : COPY.signinFailed[lang]} />
      </div>
    );
  }
  if (session.status === 'pending' || (!me && meLoading) || health.load === 'idle' || health.load === 'loading') {
    return <div className="hp-form"><Info text={COPY.loading[lang]} role="status" /></div>;
  }
  if (!me) {
    return <div className="hp-form"><Info text={COPY.signinFailed[lang]} role="alert" /></div>;
  }
  if (health.load === 'error') {
    return (
      <div className="hp-form">
        <Info text={COPY.loadFailed[lang]} role="alert" />
        <div className="review-submit-row mt-md">
          <button className="btn btn-secondary btn-block" onClick={() => void ensureHealthLoaded(true)}>{COPY.retry[lang]}</button>
        </div>
      </div>
    );
  }
  // Флаг сервера выключен — анкета «скоро», без сроков. Своё удалить можно всегда.
  if (me.features?.health !== true) {
    return (
      <div className="hp-form" data-health="soon">
        <Info text={COPY.soon[lang]} />
        {health.hasServerDoc && (
          <>
            <Info text={COPY.soonHasDoc[lang]} />
            <DeleteDoor lang={lang} />
          </>
        )}
      </div>
    );
  }
  return <HealthForm onBook={onBook} saved={health.passport} hasServerDoc={health.hasServerDoc} consentVersion={legalVersion(me, 'health_data')} />;
}

function HealthForm({
  onBook, saved, hasServerDoc, consentVersion,
}: {
  onBook?: (id: string) => void;
  saved: HealthPassport;
  hasServerDoc: boolean;
  /** Текущая редакция согласия (Me.legal.health_data); null — сервер её не назвал. */
  consentVersion: string | null;
}) {
  const lang = useLang();
  const ru = lang === 'ru';
  const consent = useHealthConsent();
  const [p, setP] = useState(saved);
  const [custom, setCustom] = useState('');
  // Галочка согласия НЕ отмечена заранее
  const [agree, setAgree] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Форма правится черновиком (чтобы «Отмена» работала), но разбор и сервер
  // пишут в стор. Без синхронизации «Сохранить» затёрло бы то, что пришло.
  useEffect(() => { setP(saved); }, [saved]);

  // Разбор дописывает свои поля в анкету — после него форма уже заполнена
  const openQuiz = () =>
    openSheet({
      title: 'ANZH Skin Intelligence',
      subtitle: tr(`Skin Profile · ${FREE_QUIZ.questions.length} вопросов · бесплатно`, `Skin Profile · ${FREE_QUIZ.questions.length} questions · free`),
      body: <QuizRunner quiz={FREE_QUIZ} onBook={onBook ?? (() => closeSheet())} />,
    });

  const patch = (fields: Partial<HealthPassport>) => setP((x) => ({ ...x, ...fields }));

  const toggleAllergy = (a: string) => {
    const has = p.allergies.some((x) => x.startsWith(a));
    if (!has && p.allergies.length >= HEALTH_LIMITS.allergiesMax) return;
    patch({
      allergies: has ? p.allergies.filter((x) => !x.startsWith(a)) : [...p.allergies, a],
      noAllergies: false,
    });
  };
  const addCustom = () => {
    const v = custom.trim();
    if (!v || p.allergies.length >= HEALTH_LIMITS.allergiesMax) return;
    patch({ allergies: [...p.allergies, v] });
    setCustom('');
  };

  const canConsent = !!consentVersion;
  const canSave = !saving && (!!consent || (agree && canConsent));

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setErr(null);
    try {
      // Согласие — ОТДЕЛЬНЫМ шагом до записи анкеты, а не «заодно»: сервер
      // без него ответит consent_required, а человек дал его явно. Версия —
      // та редакция, что сейчас на экране (Me.legal.health_data).
      if (!consent) {
        if (!consentVersion) throw new ApiError(503, 'not_configured', 'согласие: версия текста не задана');
        await grantConsent('health_data', consentVersion, lang);
        // Правда о согласии — у сервера: Me.consents перечитан до записи анкеты
        await refreshMe();
      }
      await saveHealthForm(p);
      closeSheet();
      toast(COPY.saved[lang], 'success');
    } catch (e) {
      if (isVersionMismatch(e)) {
        // Пока человек читал, вышла новая редакция: галочка на СТАРЫЙ текст
        // не переносится; перечитанный Me.legal показывает новую редакцию.
        setAgree(false);
        await refreshMe();
      }
      setErr(errorText(e, lang));
    } finally {
      setSaving(false);
    }
  };

  const allergyFull = p.allergies.length >= HEALTH_LIMITS.allergiesMax;

  return (
    <div className="hp-form">
      {/* Заполнять анкету руками хочет не каждый — разбор делает это за тебя */}
      {p.quizAt ? (
        <div className="hp-quiz-done">
          <Icon name="sparkles" size={16} strokeWidth={1.9} />
          <div>
            <div className="hp-quiz-done-title">
              Разбор пройден {new Date(p.quizAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
            </div>
            <div className="hp-quiz-done-sub">
              {[p.goal, p.experience, p.pace].filter(Boolean).join(' · ') || 'Тип кожи и чувствительность заполнены автоматически'}
            </div>
          </div>
          <button className="hp-quiz-again" onClick={openQuiz}>пройти заново</button>
        </div>
      ) : (
        <button className="hp-quiz-cta" onClick={openQuiz}>
          <div className="hp-quiz-icon"><Icon name="sparkles" size={20} strokeWidth={1.8} /></div>
          <div className="hp-quiz-text">
            <div className="hp-quiz-title">Не заполнять руками</div>
            <div className="hp-quiz-sub">
              Пройди Skin Profile — {FREE_QUIZ.questions.length} вопросов, и анкета заполнится сама
            </div>
          </div>
          <Icon name="chevron-right" size={20} strokeWidth={2} className="review-cta-arrow" />
        </button>
      )}

      <Row label="аллергии">
        <button
          className={`hp-chip ${p.noAllergies ? 'on' : ''}`}
          onClick={() => patch({ noAllergies: !p.noAllergies, allergies: [] })}
        >
          <Icon name={p.noAllergies ? 'check' : 'plus'} size={13} strokeWidth={2.4} />
          Аллергий нет
        </button>
        {!p.noAllergies && (
          <>
            {COMMON_ALLERGIES.map((a) => {
              const on = p.allergies.some((x) => x.startsWith(a));
              return (
                <button key={a} className={`hp-chip ${on ? 'warn' : ''}`} onClick={() => toggleAllergy(a)}>
                  {on && <Icon name="warning" size={12} strokeWidth={2.2} />}
                  {a}
                </button>
              );
            })}
            {p.allergies.filter((a) => !COMMON_ALLERGIES.some((c) => a.startsWith(c))).map((a) => (
              <button key={a} className="hp-chip warn" onClick={() => patch({ allergies: p.allergies.filter((x) => x !== a) })}>
                {a} <Icon name="x" size={11} strokeWidth={2.4} />
              </button>
            ))}
          </>
        )}
      </Row>

      {!p.noAllergies && (
        <div className="hp-inline">
          <input
            className="onb-input"
            placeholder={allergyFull ? `Не больше ${HEALTH_LIMITS.allergiesMax}` : 'Другая аллергия'}
            value={custom}
            maxLength={HEALTH_LIMITS.allergyLen}
            disabled={allergyFull}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addCustom(); }}
          />
          <button className="btn btn-secondary btn-sm" disabled={!custom.trim() || allergyFull} onClick={addCustom}>
            <Icon name="plus" size={15} strokeWidth={2.4} />
          </button>
        </div>
      )}

      <Row label="состояние">
        <Toggle on={p.pregnant} label="Беременность" onClick={() => patch({ pregnant: !p.pregnant })} />
        <Toggle on={p.lactating} label="Лактация" onClick={() => patch({ lactating: !p.lactating })} />
        <Toggle on={p.couperose} label="Купероз" onClick={() => patch({ couperose: !p.couperose })} />
      </Row>

      <label className="onb-field mt">
        <span className="onb-label">хронические заболевания</span>
        <input
          className="onb-input"
          value={p.chronic}
          maxLength={HEALTH_LIMITS.chronicLen}
          onChange={(e) => patch({ chronic: e.target.value })}
          placeholder="Если нет — оставь пустым"
        />
      </label>

      <label className="onb-field mt">
        <span className="onb-label">препараты постоянно</span>
        <input
          className="onb-input"
          value={p.meds}
          maxLength={HEALTH_LIMITS.medsLen}
          onChange={(e) => patch({ meds: e.target.value })}
          placeholder="Антикоагулянты, ретиноиды…"
        />
      </label>

      <Row label="тип кожи">
        {SKIN_TYPES.map((s) => (
          <button key={s} className={`hp-chip ${p.skinType === s ? 'on' : ''}`} onClick={() => patch({ skinType: s })}>
            {s}
          </button>
        ))}
      </Row>

      <Row label="фототип (fitzpatrick)">
        {FITZPATRICK.map((f) => (
          <button key={f} className={`hp-chip ${p.fitzpatrick === f ? 'on' : ''}`} onClick={() => patch({ fitzpatrick: f })}>
            {f}
          </button>
        ))}
      </Row>

      <Row label="чувствительность">
        {(['low', 'medium', 'high'] as Sensitivity[]).map((s) => (
          <button key={s} className={`hp-chip ${p.sensitivity === s ? 'on' : ''}`} onClick={() => patch({ sensitivity: s })}>
            {SENSITIVITY_LABEL[s].ru}
          </button>
        ))}
      </Row>

      <label className="onb-field mt">
        <span className="onb-label">что ещё важно знать</span>
        <textarea
          className="review-textarea"
          rows={3}
          value={p.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          placeholder="Реакции на прошлые процедуры, пожелания, страхи"
          maxLength={400}
        />
      </label>

      {consent ? (
        /* Здесь было личное обязательство приложения сверять анкету перед
           каждой записью — его никто не исполняет: сверку по словам делает
           код, решает Анжелика на приёме (разбор Законника А.7). */
        <div className="hp-privacy" data-consent="given">
          <Icon name="shield-check" size={15} strokeWidth={1.9} />
          <span>
            {COPY.seen[lang]}{' '}
            {COPY.given[lang]}
            {consent.grantedAt ? ` ${new Date(consent.grantedAt).toLocaleDateString(ru ? 'ru-RU' : 'en-US')}` : ''}.{' '}
            <LegalLink doc="health-consent" version={consentVersion}>{COPY.full[lang]}</LegalLink>
          </span>
        </div>
      ) : (
        <>
          <div className="hp-privacy" role="group" aria-labelledby="hp-consent-title" data-consent="ask">
            <Icon name="shield-check" size={15} strokeWidth={1.9} />
            <div className="stack-tight">
              <strong id="hp-consent-title" style={{ color: 'var(--text-primary)' }}>{COPY.consentTitle[lang]}</strong>
              <span>{COPY.why[lang]}</span>
              <span>{COPY.where[lang]}</span>
              <span>{COPY.revoke[lang]}</span>
              <span>
                <LegalLink doc="health-consent" version={consentVersion}>{COPY.full[lang]}</LegalLink>
                {consentVersion && <span data-consent-version>{` · ${COPY.edition[lang]} ${consentVersion}`}</span>}
              </span>
            </div>
          </div>
          {canConsent ? (
            <button
              type="button"
              role="checkbox"
              aria-checked={agree}
              className={`onb-agree hp-consent-check ${agree ? 'on' : ''}`}
              onClick={() => setAgree(!agree)}
              style={{ width: '100%', marginTop: 'var(--sp-sm)' }}
            >
              <span className="onb-check">{agree && <Icon name="check" size={14} strokeWidth={2.4} />}</span>
              <span className="onb-agree-text">{COPY.check[lang]}</span>
            </button>
          ) : (
            <p className="onb-hint" role="note" style={{ marginTop: 'var(--sp-sm)' }}>{COPY.noVersion[lang]}</p>
          )}
          {canConsent && !agree && (
            <p className="onb-hint" style={{ marginTop: 'var(--sp-sm)' }}>{COPY.refuseOk[lang]}</p>
          )}
        </>
      )}

      {err && <p className="onb-hint" role="alert" style={{ marginTop: 'var(--sp-sm)', color: 'var(--text-primary)' }}>{err}</p>}

      <div className="review-submit-row mt-md">
        <button className="btn btn-primary btn-block" onClick={() => void save()} disabled={!canSave} data-health-save>
          {saving ? (ru ? 'Сохраняю…' : 'Saving…') : 'Сохранить анкету'}
        </button>
        <button className="btn btn-quiet btn-block" onClick={closeSheet}>Отмена</button>
      </div>

      {/* Отзыв согласия и удаление — те самые кнопки, которые называют текст
          согласия и онбординг. Деструктив — только после второго, явного
          нажатия и под общим замком деструктивных дверей (lib/myData.ts). */}
      {(consent || hasServerDoc) && (consent ? <RevokeDoor lang={lang} /> : <DeleteDoor lang={lang} />)}
    </div>
  );
}

/** Отозвать согласие (сервер стирает анкету) — с подтверждением. */
export function RevokeDoor({ lang }: { lang: Lang }) {
  return (
    <ConfirmDoor
      lang={lang}
      label={COPY.revokeBtn[lang]}
      confirmText={COPY.revokeConfirm[lang]}
      run={() => revokeHealthConsent()}
      done={COPY.revoked[lang]}
      testId="revoke"
    />
  );
}

/** Удалить только анкету (без отзыва согласия) — с подтверждением. */
function DeleteDoor({ lang }: { lang: Lang }) {
  return (
    <ConfirmDoor
      lang={lang}
      label={COPY.deleteBtn[lang]}
      confirmText={COPY.deleteConfirm[lang]}
      run={() => deleteHealthData()}
      done={COPY.deleted[lang]}
      testId="delete"
    />
  );
}

function ConfirmDoor({
  lang, label, confirmText, run, done, testId,
}: {
  lang: Lang;
  label: string;
  confirmText: string;
  run: () => Promise<unknown>;
  done: string;
  testId: string;
}) {
  const busy = useDestructiveBusy();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const go = async () => {
    setErr(null);
    try {
      await withDestructiveLock(run);
      setOpen(false);
      closeSheet();
      toast(done, 'success');
    } catch (e) {
      setErr(errorText(e, lang));
    }
  };
  const copy = async () => {
    setErr(null);
    try {
      const name = await downloadMyData();
      toast(lang === 'ru' ? `Копия: ${name}` : `Copy: ${name}`, 'success');
    } catch (e) {
      setErr(errorText(e, lang));
    }
  };

  return (
    <div className="review-submit-row mt-md" data-door={testId}>
      {open ? (
        <>
          <p className="onb-hint" role="alert">{confirmText}</p>
          <button className="btn btn-quiet btn-block" onClick={() => void copy()} disabled={busy}>{COPY.download[lang]}</button>
          <button className="btn btn-secondary btn-block" onClick={() => void go()} disabled={busy} data-confirm-yes>
            {COPY.confirmYes[lang]}
          </button>
          <button className="btn btn-quiet btn-block" onClick={() => setOpen(false)} disabled={busy}>{COPY.confirmNo[lang]}</button>
        </>
      ) : (
        <button className="btn btn-quiet btn-block" onClick={() => setOpen(true)} disabled={busy}>{label}</button>
      )}
      {err && <p className="onb-hint" role="alert">{err}</p>}
    </div>
  );
}

function Info({ text, role }: { text: string; role?: 'status' | 'alert' }) {
  return (
    <div className="hp-privacy" role={role}>
      <Icon name="info" size={15} strokeWidth={1.9} />
      <span>{text}</span>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 'var(--sp-md)' }}>
      <div className="eyebrow mb-sm">{label}</div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--sp-tight)' }}>{children}</div>
    </div>
  );
}

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button className={`hp-chip ${on ? 'warn' : ''}`} onClick={onClick} aria-pressed={on}>
      <Icon name={on ? 'check' : 'plus'} size={12} strokeWidth={2.4} />
      {label}
    </button>
  );
}
