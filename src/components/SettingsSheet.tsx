import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { toast } from '../lib/ui';
import { t, useLang, type Lang } from '../lib/i18n';
import { NOTIF_ROWS, botLangName, syncNotificationLanguage } from '../lib/notifications';
import { ApiError, serverMessage, useSession } from '../lib/session';
import { refreshMe, updateMe, useMe } from '../lib/api';
import { loadMyBookings } from '../lib/appointments';
import { useHealthConsent } from '../lib/healthPassport';
import { closeApp, deleteAccount, downloadMyData, useDestructiveBusy, withDestructiveLock } from '../lib/myData';
import { RevokeDoor } from './HealthPassportSheet';
import { BotWriteAccess } from './BotWriteAccess';
import { useWriteAccess } from '../lib/writeAccess';

interface Props {
  lang: Lang;
  onLang: (l: Lang) => void;
  onStudio?: () => void;
}

/* Тексты «Моих данных» — ui-lines Законника (data.always,
   account.delete_confirm), переведённые на «ты», как весь интерфейс. */
const COPY = {
  myData: { ru: 'Мои данные', en: 'My data' },
  always: {
    ru: 'Скачать, посмотреть и удалить свои данные можно всегда — даже без согласия с новой редакцией.',
    en: 'You can always view, download and delete your data — even without accepting a new version.',
  },
  download: { ru: 'Скачать мои данные', en: 'Download my data' },
  downloadSub: { ru: 'Файл JSON со всем, что хранит приложение', en: 'A JSON file with everything the app stores' },
  downloading: { ru: 'Готовлю файл…', en: 'Preparing the file…' },
  downloaded: { ru: 'Файл готов', en: 'File ready' },
  deleteBtn: { ru: 'Удалить аккаунт', en: 'Delete account' },
  deleteSub: { ru: 'Необратимо', en: 'Cannot be undone' },
  /* account.delete_confirm — Законник, вторая вычитка 28.09 (_work/wave4/04,
     п.1): остаются и визиты, и приглашения (auth.js deleteMe их не стирает),
     счётчик приглашённых после возвращения прежний. Вариант A (решение John
     перед волной 3): покупки остаются на сервере, и после нового входа
     купленные разборы снова открыты — доступ решается по covers покупок
     (GET /me/purchases), а не по устройству. */
  deleteConfirm: {
    ru: 'Удалить аккаунт? Сотрём имя, ник, фото и контакты, анкету здоровья, твои комментарии к записям и заметки мастеров о тебе, отменим будущие записи. Останется — с привязкой к твоему Telegram ID, но без имени и контактов: история визитов (даты, процедуры, мастер, суммы) — для учёта салона; покупки — для учёта и возвратов; согласия и журнал просмотров анкеты — как подтверждение, что всё было по правилам; код приглашения и отметки, кто кого пригласил, — чтобы приглашение засчитывалось один раз. Если снова откроешь приложение с этого Telegram, аккаунт начнётся с чистого листа: прежние записи, анкета и заметки не вернутся, а купленные разборы, ссылка-приглашение и счётчик приглашённых останутся. Копию данных можно скачать выше — «Скачать мои данные».',
    en: 'Delete account? We’ll erase your name, username, photo and contacts, your health questionnaire, your booking comments and masters’ notes about you, and cancel future bookings. We keep, linked to your Telegram ID but without your name or contacts: visit history (dates, services, master, amounts) for the salon’s accounting; purchases for accounting and refunds; consents and the questionnaire view log as proof everything was done properly; your invite code and who invited whom, so an invite counts only once. If you open the app again with this Telegram account, it starts from scratch: past bookings, questionnaire and notes won’t come back, but purchased analyses, your invite link and invite count stay. You can download a copy above — “Download my data”.',
  },
  deleteYes: { ru: 'Да, удалить аккаунт', en: 'Yes, delete my account' },
  deleteNo: { ru: 'Не удалять', en: 'Keep my account' },
  deleting: { ru: 'Удаляю…', en: 'Deleting…' },
  deletedTitle: { ru: 'Аккаунт удалён', en: 'Account deleted' },
  /* Законник (_work/18, «Ещё строки»): разборов на сервере нет — «разборы
     стёрты» было неправдой. */
  deletedText: {
    ru: 'Профиль, контакты и анкета стёрты, будущие записи отменены. Данные приложения на этом устройстве тоже стёрты.',
    en: 'Your profile, contacts and questionnaire are erased, future bookings cancelled. App data on this device is erased too.',
  },
  /* Решение John (Хейтер №22): повторный вход оживляет профиль с чистого
     листа. Приложение открыто — значит, вход уже повторный: говорим, что
     не вернётся. */
  deletedAfter: {
    ru: 'Если продолжишь пользоваться приложением, аккаунт начнётся с чистого листа: прежние записи, анкета и заметки не вернутся, а купленные разборы, ссылка-приглашение и счётчик приглашённых останутся.',
    en: 'If you keep using the app, the account starts from scratch: past bookings, questionnaire and notes won’t come back, but purchased analyses, your invite link and invite count stay.',
  },
  /* 403 forbidden на DELETE /me (api/_domain/auth.js deleteMe): строка staff
     есть у владелицы и у мастера — в том числе у выключенного, чья Me.role
     'client'. Тексты по роли, как у сервера; обеим ролям — поддержка
     (решение John по находке Законника, волна 4): «Снять доступ» только
     выключает мастера (active=false), а запрет удаления находит и
     выключенного — совет мастеру просить владелицу о снятии доступа вёл
     в тупик. */
  refusalStaff: {
    ru: 'Пока ты числишься в команде салона, удалить профиль из приложения нельзя — напиши нам в поддержку.',
    en: 'While you’re listed on the salon team, you can’t delete your profile from the app — contact our support.',
  },
  refusalOwner: {
    ru: 'Пока ты владелица, удалить профиль из приложения нельзя — напиши нам в поддержку.',
    en: 'While you’re the owner, you can’t delete your profile from the app — contact our support.',
  },
  botLangSame: { ru: 'Уведомления бота — тоже на этом языке.', en: 'Bot notifications use this language too.' },
  botLangOther: { ru: 'Уведомления бота сейчас приходят на', en: 'Bot notifications currently arrive in' },
  botLangFix: { ru: 'Присылать на языке приложения', en: 'Use the app language' },
  botLangFailed: {
    ru: 'Язык приложения сменён, а язык уведомлений бота сохранить не удалось — попробуй ещё раз.',
    en: 'The app language changed, but the bot notification language was not saved — try again.',
  },
  close: { ru: 'Закрыть приложение', en: 'Close the app' },
  guestData: {
    ru: 'Твои данные хранятся на сервере, когда приложение открыто в Telegram. Выгрузка и удаление — там же.',
    en: 'Your data lives on our server when the app is opened in Telegram. Download and deletion are there too.',
  },
  /* КТ-7 С2: the Start hint (was `startBot`) moved into the shared block
     «Получать ответ в Telegram» — texts in lib/writeAccessCopy.ts (Т1 §2 = §5:
     `startBot`, `startBotNoLink`, `startBotOpen`). */
  notifGuest: { ru: 'Настраивается в приложении Telegram', en: 'Set it up in the Telegram app' },
  notifSaveFailed: {
    ru: 'Не удалось сохранить настройку — попробуй ещё раз',
    en: 'Could not save the setting — try again',
  },
} as const;

/**
 * Слова отказа для «Моих данных». `deleting` — только у удаления аккаунта:
 * роль нужна, чтобы 403 сказал своё владелице и мастеру.
 */
function errorText(e: unknown, lang: Lang, deleting?: { role: string | undefined }): string {
  const ru = lang === 'ru';
  const code = e instanceof ApiError ? e.code : '';
  const status = e instanceof ApiError ? e.status : 0;
  if (code === 'busy') return ru ? 'Подожди — предыдущее действие ещё выполняется.' : 'Please wait — the previous action is still running.';
  if (status === 429) return ru ? 'Выгрузка доступна 5 раз в час — попробуй позже.' : 'Download is limited to 5 times an hour — try later.';
  if (status === 401) return ru ? 'Нет входа — открой приложение заново.' : 'Not signed in — reopen the app.';
  /* DELETE /me у человека из команды: 403 forbidden (api/_domain/auth.js
     deleteMe). Повтор не поможет — не «попробуй ещё раз». По-русски — слова
     сервера: роль он знает по строке staff, а Me.role выключенного мастера —
     'client' и может быть устаревшей. По-английски у сервера слов нет — свой
     текст по роли из Me: 'owner' — владелица, иначе — мастер. */
  if (deleting && status === 403 && code === 'forbidden' && e instanceof ApiError) {
    const own = (deleting.role === 'owner' ? COPY.refusalOwner : COPY.refusalStaff)[lang];
    return ru ? serverMessage(e) ?? own : own;
  }
  if (status === 0) return ru ? 'Нет связи — ничего не изменилось. Попробуй ещё раз.' : 'No connection — nothing changed. Try again.';
  return ru ? 'Не получилось — попробуй ещё раз.' : 'Something went wrong — try again.';
}

export function SettingsSheet({ onLang, onStudio }: Props) {
  const lang = useLang();
  const [deleted, setDeleted] = useState(false);
  const [langSyncing, setLangSyncing] = useState(false);

  /* Язык интерфейса = язык уведомлений бота: смена языка уходит на сервер
     (PATCH /me {language_code}). Интерфейс меняется сразу и без сервера;
     не сохранилось на сервере — говорим прямо, строка ниже покажет, на
     каком языке бот пишет на самом деле. */
  const syncBotLang = async (l: Lang) => {
    setLangSyncing(true);
    try {
      const r = await syncNotificationLanguage(l);
      if (r === 'failed') toast(COPY.botLangFailed[l], 'info');
    } finally {
      setLangSyncing(false);
    }
  };
  const pickLang = (l: Lang) => {
    onLang(l);
    toast(l === 'ru' ? 'Язык: русский' : 'Language: English', 'success');
    void syncBotLang(l);
  };

  // После удаления в шторке остаётся только итог и выход: остальное —
  // про аккаунт, которого больше нет
  if (deleted) return <DeletedNotice lang={lang} />;

  return (
    <div className="col settings-sheet" style={{ gap: 20 }}>
      {/* Язык */}
      <div>
        <div className="eyebrow set-eyebrow">{t('settings.lang', lang)}</div>
        <div className="seg">
          {(['ru', 'en'] as Lang[]).map((l) => (
            <button
              key={l}
              className={`seg-btn ${lang === l ? 'active' : ''}`}
              onClick={() => pickLang(l)}
            >
              <Icon name="globe" size={15} strokeWidth={1.9} />
              <span>{l === 'ru' ? 'Русский' : 'English'}</span>
              {lang === l && <Icon name="check" size={14} strokeWidth={2.6} className="seg-check" />}
            </button>
          ))}
        </div>
        <BotLangLine lang={lang} busy={langSyncing} onFix={() => void syncBotLang(lang)} />
      </div>

      <NotificationsBlock lang={lang} />

      {/* Кабинет мастера */}
      {onStudio && (
        <button className="set-row set-row-studio" onClick={onStudio}>
          <span className="set-row-icon"><Icon name="lotus" size={16} strokeWidth={1.8} /></span>
          <span className="set-row-label">
            Кабинет мастера
            <span className="set-row-sub">Заявки, расписание, база клиентов</span>
          </span>
          <Icon name="chevron-right" size={18} strokeWidth={2} style={{ color: 'var(--text-hint)' }} />
        </button>
      )}

      <MyDataBlock lang={lang} onDeleted={() => setDeleted(true)} />

      <div className="set-footer">
        <div className="set-footer-brand">{t('settings.about', lang)}</div>
        <div className="set-footer-ver">{t('settings.version', lang)}</div>
      </div>
    </div>
  );
}

/* Итог удаления аккаунта. Устройство уже стёрто (deleteAccount — только
   после {deleted:true}), а память этого запуска ещё держит прежний профиль
   и записи. Перечитываем их, когда человек ПРОДОЛЖАЕТ — закрыл эту шторку
   и остался в приложении: тогда вход оживит профиль с чистого листа
   (решение John, Хейтер №22), и на экранах будет новый пустой профиль, а
   не удалённый. Сразу после удаления не перечитываем: первый же запрос
   после удаления входит заново, и аккаунт создался бы сам, пока человек
   читает «Аккаунт удалён» и собирается закрыть приложение, — а текст
   подтверждения обещает новый аккаунт только если он «снова откроет».
   Закрыл приложение — ничего не перечитывается и ничего не создаётся.
   Таймер в уборке — против двойного монтирования StrictMode (там уборка
   сразу, и следом монтирование снова). */
function DeletedNotice({ lang }: { lang: Lang }) {
  const leave = useRef<number | null>(null);
  useEffect(() => {
    if (leave.current !== null) {
      window.clearTimeout(leave.current);
      leave.current = null;
    }
    return () => {
      leave.current = window.setTimeout(() => {
        leave.current = null;
        void refreshMe();
        void loadMyBookings();
      }, 0);
    };
  }, []);
  return (
    <div className="col settings-sheet" style={{ gap: 16 }} data-account="deleted">
      <div className="hp-privacy" role="status">
        <Icon name="check" size={15} strokeWidth={2.2} />
        <div className="stack-tight">
          <strong style={{ color: 'var(--text-primary)' }}>{COPY.deletedTitle[lang]}</strong>
          <span>{COPY.deletedText[lang]}</span>
          <span data-account-after>{COPY.deletedAfter[lang]}</span>
        </div>
      </div>
      <button className="btn btn-primary btn-block" onClick={closeApp}>{COPY.close[lang]}</button>
    </div>
  );
}

/* На каком языке бот пишет НА САМОМ ДЕЛЕ — по Me.language_code, а не по
   нажатию. Язык сменили плавающим переключателем, а сервер об этом не
   знает, — строка скажет и даст одну кнопку. Гостю строки нет. */
function BotLangLine({ lang, busy, onFix }: { lang: Lang; busy: boolean; onFix: () => void }) {
  const session = useSession();
  const { me } = useMe();
  if (session.status !== 'user' || !me) return null;
  if (me.language_code === lang) {
    return <p className="onb-hint" data-hint="bot-lang" data-state="same" style={{ marginTop: 'var(--sp-sm)' }}>{COPY.botLangSame[lang]}</p>;
  }
  return (
    <div data-hint="bot-lang" data-state="other" style={{ marginTop: 'var(--sp-sm)' }}>
      <p className="onb-hint">{COPY.botLangOther[lang]} {botLangName(me.language_code, lang)}.</p>
      <button className="btn btn-quiet btn-block" onClick={onFix} disabled={busy} data-action="sync-bot-lang">
        {COPY.botLangFix[lang]}
      </button>
    </div>
  );
}

/* Уведомления — только то, что сервер реально шлёт (lib/notifications).
   Тумблер показывает и меняет НАСТРОЙКУ СЕРВЕРА (Me.notifications, PATCH /me):
   положение берётся из ответа сервера, а не из нажатия — не сохранилось,
   значит не переключилось. */
function NotificationsBlock({ lang }: { lang: Lang }) {
  const session = useSession();
  const { me } = useMe();
  const [saving, setSaving] = useState(false);
  const signedIn = session.status === 'user' && !!me;
  const writeAccess = useWriteAccess(signedIn ? me?.can_message : undefined);

  const toggle = async (pref: 'reminders') => {
    if (!me || saving) return;
    const next = !(me.notifications?.[pref] === true);
    setSaving(true);
    try {
      await updateMe({ notifications: { [pref]: next } });
    } catch {
      toast(COPY.notifSaveFailed[lang], 'info');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="eyebrow set-eyebrow">{t('settings.notif', lang)}</div>
      <div className="set-rows">
        {NOTIF_ROWS.map((n) => {
          const on = me?.notifications?.[n.pref] === true;
          return signedIn ? (
            <button
              key={n.kind}
              type="button"
              className="set-row"
              role="switch"
              aria-checked={on}
              disabled={saving}
              data-notif={n.pref}
              onClick={() => void toggle(n.pref)}
            >
              <span className="set-row-icon"><Icon name="clock" size={16} strokeWidth={1.8} /></span>
              <span className="set-row-label">
                {n.label[lang]}
                <span className="set-row-sub">{n.sub[lang]}</span>
              </span>
              <span className={`toggle ${on ? 'on' : ''}`} aria-hidden><span className="toggle-knob" /></span>
            </button>
          ) : (
            <div key={n.kind} className="set-row" style={{ cursor: 'default' }}>
              <span className="set-row-icon"><Icon name="clock" size={16} strokeWidth={1.8} /></span>
              <span className="set-row-label">
                {n.label[lang]}
                <span className="set-row-sub">{session.status === 'guest' ? COPY.notifGuest[lang] : n.sub[lang]}</span>
              </span>
            </div>
          );
        })}
      </div>
      {/* Бот пишет только тем, кто его запускал или разрешил писать: иначе «напомним» —
          неправда. КТ-7 С2: the block «Получать ответ в Telegram» shows while
          `can_message === false` (and «done» after it); a server that did not send the
          field does not know — silence, as before. No booking here: Т1 column «decided». */}
      {signedIn && <BotWriteAccess ui={writeAccess} link={me?.bot_link} lang={lang} context="decided" variant="settings" />}
    </div>
  );
}

function MyDataBlock({ lang, onDeleted }: { lang: Lang; onDeleted: () => void }) {
  const session = useSession();
  const { me } = useMe();
  const consent = useHealthConsent();
  const busy = useDestructiveBusy();
  const [downloading, setDownloading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (session.status !== 'user' || !me) {
    return (
      <div>
        <div className="eyebrow set-eyebrow">{COPY.myData[lang]}</div>
        <p className="onb-hint" role="note">{COPY.guestData[lang]}</p>
      </div>
    );
  }

  const download = async () => {
    if (downloading) return;
    setErr(null);
    setDownloading(true);
    try {
      const name = await downloadMyData();
      toast(`${COPY.downloaded[lang]}: ${name}`, 'success');
    } catch (e) {
      setErr(errorText(e, lang));
    } finally {
      setDownloading(false);
    }
  };

  const remove = async () => {
    setErr(null);
    setDeleting(true);
    try {
      // Устройство чистится внутри deleteAccount — только после {deleted:true}
      await withDestructiveLock(() => deleteAccount());
    } catch (e) {
      // Сервер не подтвердил — на устройстве ничего не стёрто
      setErr(errorText(e, lang, { role: me.role }));
      setDeleting(false);
      return;
    }
    // Профиль перечитывается не здесь, а когда человек продолжит (DeletedNotice)
    onDeleted();
  };

  return (
    <div data-block="my-data">
      <div className="eyebrow set-eyebrow">{COPY.myData[lang]}</div>
      <p className="onb-hint" style={{ marginBottom: 'var(--sp-sm)' }}>{COPY.always[lang]}</p>
      <div className="set-rows">
        <button className="set-row" onClick={() => void download()} disabled={downloading} data-action="export">
          <span className="set-row-icon"><Icon name="arrow-up-right" size={16} strokeWidth={1.8} /></span>
          <span className="set-row-label">
            {COPY.download[lang]}
            <span className="set-row-sub">{downloading ? COPY.downloading[lang] : COPY.downloadSub[lang]}</span>
          </span>
        </button>
      </div>

      {/* Отзыв согласия — здесь тоже: полный текст согласия называет
          «Мои данные» местом отзыва */}
      {consent && <RevokeDoor lang={lang} />}

      <div className="review-submit-row mt-md" data-door="account">
        {confirm ? (
          <>
            <p className="onb-hint" role="alert">{COPY.deleteConfirm[lang]}</p>
            <button className="btn btn-secondary btn-block" onClick={() => void remove()} disabled={busy || deleting} data-confirm-yes>
              {deleting ? COPY.deleting[lang] : COPY.deleteYes[lang]}
            </button>
            <button className="btn btn-quiet btn-block" onClick={() => setConfirm(false)} disabled={deleting}>
              {COPY.deleteNo[lang]}
            </button>
          </>
        ) : (
          <button className="btn btn-quiet btn-block" onClick={() => { setErr(null); setConfirm(true); }} disabled={busy}>
            {COPY.deleteBtn[lang]} · {COPY.deleteSub[lang]}
          </button>
        )}
      </div>
      {err && <p className="onb-hint" role="alert" style={{ marginTop: 'var(--sp-sm)' }}>{err}</p>}
    </div>
  );
}
