import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { toast } from '../lib/ui';
import { tap } from '../lib/haptics';
import { roundRect, wrapText, paintBackdrop, paintFooter, downloadCanvas } from '../lib/canvas';
import { priceOf } from '../lib/studio';
import { formatShort, type Appointment } from '../lib/appointments';
import { findService } from '../data/services';
import { liveServices } from '../lib/catalog';
import { toISODate } from '../lib/appointments';

// Промо-студия: сторис для соцсетей из РЕАЛЬНЫХ данных кабинета.
//
// У Анжелики нет дизайнера, а постить надо регулярно — и главный её пост
// это не «красивая картинка вообще», а конкретный повод: освободилось окно
// на завтра, появилась новая процедура, действует офер. Такие посты она
// сейчас собирает руками в сторонних редакторах, подставляя цифры вручную.
//
// Поэтому макеты берут данные из самого кабинета: свободный слот — из
// расписания, цену — из живого прайса. Картинка, в которую надо вписывать
// цифры руками, через месяц начинает врать: прайс поменяли, а в сторис
// осталась старая цена.

type Kind = 'slot' | 'service' | 'offer';

const SIZE = { W: 1080, H: 1920 }; // формат сторис

interface Props {
  /** Записи на сегодня и завтра — из них собирается «свободное окно» */
  upcoming: Appointment[];
}

export function PromoStudio({ upcoming }: Props) {
  const services = liveServices();
  const [kind, setKind] = useState<Kind>('slot');
  const [serviceId, setServiceId] = useState(() => services[0]?.id ?? '');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* Свободное окно ищем в завтрашнем дне: сегодняшнее уже не продать —
     человеку нужно время доехать */
  const tomorrow = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toISODate(d);
  })();
  const busy = new Set(
    upcoming.filter((a) => a.dateISO === tomorrow && a.status === 'confirmed').map((a) => a.slot),
  );
  const freeSlot = ['11:00', '13:00', '15:00', '16:30', '18:00'].find((s) => !busy.has(s));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = SIZE.W;
    canvas.height = SIZE.H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    paintBackdrop(ctx, SIZE.W, SIZE.H);
    const svc = findService(serviceId);

    // Крупная строка-повод — то, ради чего сторис вообще открывают
    ctx.fillStyle = '#F5C842';
    ctx.font = '800 38px Inter, system-ui, sans-serif';
    ctx.letterSpacing = '6px';

    if (kind === 'slot') {
      ctx.fillText('СВОБОДНОЕ ОКНО', 70, 260);
      ctx.letterSpacing = '0px';
      ctx.fillStyle = 'rgba(255,255,255,0.97)';
      ctx.font = '800 150px Inter, system-ui, sans-serif';
      ctx.fillText(freeSlot ?? 'занято', 70, 430);
      ctx.fillStyle = 'rgba(226,240,236,0.72)';
      ctx.font = '500 52px Inter, system-ui, sans-serif';
      ctx.fillText(freeSlot ? `завтра · ${formatShort(tomorrow)}` : 'всё расписано', 70, 520);

      if (svc) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = '700 62px Inter, system-ui, sans-serif';
        const y = wrapText(ctx, svc.title, 70, 700, SIZE.W - 140, 78);
        ctx.fillStyle = '#12C088';
        ctx.font = '800 72px Inter, system-ui, sans-serif';
        ctx.fillText(`$${priceOf(svc.id)}`, 70, y + 40);
      }
    }

    if (kind === 'service' && svc) {
      ctx.fillText('НОВОЕ В КАБИНЕТЕ', 70, 260);
      ctx.letterSpacing = '0px';
      ctx.fillStyle = 'rgba(255,255,255,0.97)';
      ctx.font = '800 92px Inter, system-ui, sans-serif';
      const y = wrapText(ctx, svc.title, 70, 400, SIZE.W - 140, 106);
      ctx.fillStyle = 'rgba(226,240,236,0.72)';
      ctx.font = '400 46px Inter, system-ui, sans-serif';
      const y2 = wrapText(ctx, svc.short, 70, y + 40, SIZE.W - 140, 62);
      ctx.fillStyle = '#12C088';
      ctx.font = '800 80px Inter, system-ui, sans-serif';
      ctx.fillText(`$${priceOf(svc.id)}`, 70, y2 + 70);
      ctx.fillStyle = 'rgba(226,240,236,0.55)';
      ctx.font = '400 40px Inter, system-ui, sans-serif';
      ctx.fillText(`${svc.duration} минут`, 70, y2 + 140);
    }

    if (kind === 'offer') {
      ctx.fillText('ДЛЯ ПОДПИСЧИКОВ', 70, 260);
      ctx.letterSpacing = '0px';
      ctx.fillStyle = 'rgba(255,255,255,0.97)';
      ctx.font = '800 190px Inter, system-ui, sans-serif';
      ctx.fillText('−30%', 70, 470);
      ctx.fillStyle = 'rgba(226,240,236,0.78)';
      ctx.font = '500 50px Inter, system-ui, sans-serif';
      wrapText(ctx, 'на разборы кожи ANZH — за отзыв, сторис или приглашение подруги', 70, 580, SIZE.W - 140, 66);
    }

    // Плашка с адресом — единственное, что одинаково во всех макетах
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    roundRect(ctx, 70, SIZE.H - 320, SIZE.W - 140, 140, 28);
    ctx.fill();
    ctx.fillStyle = 'rgba(226,240,236,0.8)';
    ctx.font = '500 38px Inter, system-ui, sans-serif';
    ctx.fillText('Батуми · Parnavaz Mepe 92/94', 110, SIZE.H - 240);

    paintFooter(ctx, SIZE.W, SIZE.H);
  }, [kind, serviceId, freeSlot, tomorrow]);

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    tap('medium');
    const ok = downloadCanvas(canvas, `anzh-${kind}-${Date.now()}.png`);
    toast(
      ok ? 'Сторис сохранена — можно выкладывать' : 'Не удалось сохранить: скачивание заблокировано',
      ok ? 'success' : 'info',
    );
  };

  /* Каталог пуст — все процедуры в архиве. Рисовать сторис не из чего, и
     показывать пустой холст хуже, чем честно сказать, чего не хватает. */
  if (services.length === 0) {
    return (
      <div className="card empty-state">
        <div className="empty-icon"><Icon name="sparkles" size={26} strokeWidth={1.7} /></div>
        <div className="empty-title">Не из чего собрать сторис</div>
        <div className="empty-sub">
          В каталоге нет ни одной активной процедуры. Верни её во вкладке «Прайс» —
          и макеты соберутся сами, с ценой и временем из расписания.
        </div>
      </div>
    );
  }

  return (
    <div className="ps">
      <div className="ps-kinds" role="tablist">
        {([
          ['slot', 'Свободное окно'],
          ['service', 'Процедура'],
          ['offer', 'Офер −30%'],
        ] as Array<[Kind, string]>).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={kind === id}
            className={`ps-kind${kind === id ? ' active' : ''}`}
            onClick={() => setKind(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {kind !== 'offer' && (
        <label className="ps-pick">
          <span>Процедура на макете</span>
          <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.title} · ${priceOf(s.id)}</option>
            ))}
          </select>
        </label>
      )}

      {kind === 'slot' && !freeSlot && (
        <div className="ps-note">
          <Icon name="info" size={14} strokeWidth={2} />
          Завтра свободных окон нет — на макете это будет видно честно.
        </div>
      )}

      {/* Живой предпросмотр: цена и время подставляются из кабинета, а не
          вписываются руками — иначе через месяц сторис начнёт врать */}
      <canvas ref={canvasRef} className="ps-canvas" aria-label="Предпросмотр сторис" />

      <button className="btn btn-primary btn-block" onClick={save}>
        <Icon name="share" size={16} strokeWidth={2} /> Сохранить для сторис
      </button>
      <p className="ps-hint">
        Формат 1080×1920 — вертикальная сторис. Цена и время берутся из твоего
        прайса и расписания на момент сохранения.
      </p>
    </div>
  );
}
