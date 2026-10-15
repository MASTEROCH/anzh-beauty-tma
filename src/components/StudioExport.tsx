import { useState } from 'react';
import { Icon } from './Icon';
import { toast } from '../lib/ui';
import { notify, tap } from '../lib/haptics';
import { getStaffBookings } from '../lib/api/staff';
import { getClients } from '../lib/api/clients';
import { getStaffReviews } from '../lib/api/reviews';
import { STATUS_WORD } from '../lib/studio';
import { salonParts } from '../lib/appointments';
import { cabinetDenied } from '../lib/staff';

/* ВЫГРУЗКА ДАННЫХ (Роч 15.10: «за какой-то период или за всё время»).
   CSV, который открывается в Excel и Google Таблицах как есть: разделитель
   «;», BOM для кириллицы, даты в поясе салона. Три набора — записи и
   деньги, клиентки, отзывы.

   🚨 Комментарий клиентки к записи (client_note) НЕ выгружаем: он бывает
   о здоровье, а файл уходит в почту, мессенджеры и облака. Сервер помечает
   его «только на экран» (lib/api/staff.ts). Анкеты здоровья — тоже нет. */

type Kind = 'bookings' | 'clients' | 'reviews';
type Period = '7' | '30' | '90' | '365' | 'all' | 'custom';
const PERIODS: Array<[Period, string]> = [['7', '7 дней'], ['30', '30 дней'], ['90', '90 дней'], ['365', 'Год'], ['all', 'Всё время'], ['custom', 'Свои даты']];
const KINDS: Array<[Kind, string, string]> = [
  ['bookings', 'Записи и выручка', 'дата, клиентка, мастер, процедуры, статус, сумма, оплачено, скидка'],
  ['clients', 'Клиентки', 'имя, ник, визиты, неявки, первый и последний визит'],
  ['reviews', 'Отзывы', 'дата, оценка, текст, процедура, ответ студии, статус'],
];

const cell = (v: unknown) => {
  const t = v == null ? '' : String(v);
  return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
const csv = (rows: unknown[][]) => '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
const money = (minor: number | null | undefined) => (minor == null ? '' : (minor / 100).toFixed(2).replace('.', ','));
const localISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const atSalon = (iso?: string | null) => { if (!iso) return ''; const p = salonParts(iso); return p ? `${p.dateISO} ${p.slot}` : iso; };

function save(text: string, name: string): boolean {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return true;
  } catch { return false; }
}

export function StudioExport() {
  const [kind, setKind] = useState<Kind>('bookings');
  const [period, setPeriod] = useState<Period>('30');
  const today = localISO(new Date());
  const [from, setFrom] = useState(localISO(new Date(Date.now() - 30 * 86_400_000)));
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string | null>(null);

  const range = (): { from?: string; to?: string; label: string } => {
    if (period === 'all') return { label: 'всё-время' };
    if (period === 'custom') return { from: new Date(`${from}T00:00:00+04:00`).toISOString(), to: new Date(`${to}T23:59:59+04:00`).toISOString(), label: `${from}_${to}` };
    const f = new Date(Date.now() - Number(period) * 86_400_000);
    return { from: f.toISOString(), to: new Date().toISOString(), label: `${localISO(f)}_${today}` };
  };
  const badCustom = period === 'custom' && (!from || !to || from > to);
  const inRange = (iso: string | null | undefined, r: { from?: string; to?: string }) =>
    !!iso && (!r.from || iso >= r.from) && (!r.to || iso <= r.to);

  const run = async () => {
    if (busy || badCustom) return;
    tap(); setBusy(true);
    const r = range();
    try {
      let rows: unknown[][] = [];
      if (kind === 'bookings') {
        const { bookings } = await getStaffBookings({ from: r.from, to: r.to, scope: 'all' });
        rows = [['Дата и время (Батуми)', 'Клиентка', 'ID клиентки', 'Мастер', 'Процедуры', 'Длительность, мин', 'Статус', 'Сумма по прайсу', 'Оплачено', 'Валюта', 'Скидка, %', 'Причина отказа', 'Создана'],
          ...bookings.sort((a, b) => a.starts_at.localeCompare(b.starts_at)).map((b) => [
            atSalon(b.starts_at), b.client_name ?? '', b.telegram_id, b.staff_name ?? '', b.items.map((i) => i.title_ru ?? i.slug).join(' + '),
            b.duration_min, STATUS_WORD[b.status] ?? b.status, money(b.total_minor), money(b.paid_minor), b.currency, b.discount_percent ?? 0,
            b.decline_reason ?? '', atSalon(b.created_at),
          ])];
      } else if (kind === 'clients') {
        const list = (await getClients({ limit: 5000 })).filter((c) => period === 'all' || inRange(c.last_visit, r));
        rows = [['Имя', 'Ник Telegram', 'ID', 'Визитов', 'Неявок', 'Отмен', 'Первый визит', 'Последний визит', 'Сегменты'],
          ...list.map((c) => [[c.first_name, c.last_name].filter(Boolean).join(' '), c.username ? `@${c.username}` : '', c.telegram_id, c.visits ?? 0, c.no_shows ?? 0, c.cancelled ?? 0,
            atSalon(c.first_visit), atSalon(c.last_visit), (c.segments ?? []).map((s) => ({ due: 'пора вернуть', lapsed: 'давно не была', new: 'новая' })[s]).join(', ')])];
      } else {
        const list = (await getStaffReviews()).filter((x) => period === 'all' || inRange(x.created_at, r));
        rows = [['Дата', 'Имя', 'Оценка', 'Текст', 'Процедура', 'Была на процедуре', 'Ответ студии', 'Статус', 'Можно публиковать'],
          ...list.map((x) => [atSalon(x.created_at), x.name, x.rating, x.text, x.service_slug ?? '', x.verified ? 'да' : 'нет', x.reply ?? '',
            ({ new: 'новый', published: 'на витрине', hidden: 'скрыт' } as Record<string, string>)[x.state ?? 'new'], x.publish_consent === false ? 'нет' : 'да'])];
      }
      const n = rows.length - 1;
      if (n === 0) { notify('warning'); toast('За этот период пусто — выберите другой'); return; }
      const name = `anzh-${kind}-${r.label}.csv`;
      const ok = save(csv(rows), name);
      notify(ok ? 'success' : 'error');
      setLast(ok ? `${name} · ${n} строк` : null);
      toast(ok ? `Готово: ${n} строк` : 'Браузер не дал сохранить файл — откройте кабинет в браузере телефона', ok ? 'success' : undefined);
    } catch (e) {
      cabinetDenied(e); notify('error'); toast('Не выгрузилось — проверьте интернет');
    } finally { setBusy(false); }
  };

  return (
    <section className="section section-tight ex">
      <div className="eyebrow mb-sm">что выгрузить</div>
      <div className="ex-kinds" role="radiogroup" aria-label="Что выгрузить">
        {KINDS.map(([id, t, sub]) => (
          <button key={id} role="radio" aria-checked={kind === id} className={`ex-kind${kind === id ? ' on' : ''}`} onClick={() => { tap(); setKind(id); }}>
            <span className="ex-radio" aria-hidden />
            <span className="ex-kind-body"><b>{t}</b><span>{sub}</span></span>
          </button>
        ))}
      </div>
      <div className="eyebrow mb-sm" style={{ marginTop: 18 }}>за какой период</div>
      <div className="rv-filters">
        {PERIODS.map(([id, t]) => (
          <button key={id} className={`chip${period === id ? ' chip-gold' : ''}`} onClick={() => { tap(); setPeriod(id); }}>{t}</button>
        ))}
      </div>
      {period === 'custom' && (
        <div className="se-two ex-dates">
          <label className="se-field"><span>С</span><input type="date" className="input" value={from} max={to || today} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="se-field"><span>По</span><input type="date" className="input" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
      )}
      {badCustom && <p className="form-why">Дата «с» должна быть раньше даты «по»</p>}
      <button className="btn btn-primary btn-block ex-go" onClick={run} disabled={busy || badCustom} aria-busy={busy}>
        <Icon name="upload" size={16} strokeWidth={2} /> {busy ? 'Собираю файл…' : 'Выгрузить CSV'}
      </button>
      {last && <p className="faint ex-last">Последний файл: {last}</p>}
      <p className="faint ex-fine">Открывается в Excel, Numbers и Google Таблицах. Комментарии к записям и анкеты здоровья в файл не попадают — это медицинские данные.</p>
    </section>
  );
}
