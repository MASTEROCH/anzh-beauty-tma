import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { tap, select, notify } from '../lib/haptics';

// Строка, которую тянут справа налево, чтобы убрать.
//
// Решение владельца 15.10.2026: кнопки «×» рядом с каждой процедурой больше
// нет. Она стояла на одной линии с ценой и названием, нажималась по
// ошибке и не спрашивала «точно?». Убирает теперь жест, и жест не бывает
// случайным: надо потянуть строку на полшага и ещё раз подтвердить.
//
// Как это работает (вдохновлено iOS Mail, но с нашей физикой):
//   · строка едет за пальцем, под ней проступает красная панель; корзина
//     растёт и приоткрывает крышку по мере протяжки — человек видит, КУДА
//     он тянет и что случится;
//   · порог (≈ 40 % ширины или быстрый бросок) даёт тактильный щелчок и
//     подсвечивает панель ярче: «отпустишь — сработает»;
//   · отпустил за порогом — строка не исчезает сразу, а отскакивает на
//     место, и вызывается `onCommit` — владелец экрана открывает
//     подтверждение. Строка остаётся на месте, пока человек не согласится;
//   · до порога — упругий возврат.
// Вертикальную прокрутку жест не блокирует: ось фиксируется один раз за
// касание (порог 8 px), и пока она не решена, страница едет как обычно.
//
// `reduced-motion`: возврат и схлопывание без пружины.

const AXIS_LOCK = 8;      // px до решения, куда повёл человек
const COMMIT = 0.4;       // доля ширины, после которой отпускание срабатывает
const FLICK = 0.55;       // px/мс — быстрый бросок срабатывает и до порога
const MAX = 0.62;         // дальше строка не уезжает: резина

export function SwipeRow({
  children,
  onCommit,
  label,
  disabled = false,
  collapsing = false,
  instant = false,
}: {
  children: ReactNode;
  /** Протянули достаточно и отпустили — открыть подтверждение. */
  onCommit: () => void;
  /** Что случится, словами: «Убрать» / «Удалить». */
  label: string;
  disabled?: boolean;
  /** Подтвердили — строка схлопывается по высоте и гаснет. */
  collapsing?: boolean;
  /**
   * Без подтверждения: строка улетает влево, схлопывается и только потом
   * вызывает `onCommit`. Для обратимого — снять доп. процедуру с визита
   * (вернуть её можно тем же тапом в подсказках), а не для удаления данных.
   */
  instant?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const st = useRef<{ x: number; y: number; t: number; axis: 'x' | 'y' | null; w: number; armed: boolean } | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [flying, setFlying] = useState(false);
  const gone = collapsing || flying;

  // Замеряем высоту, когда пора схлопывать: height: auto не анимируется
  useEffect(() => {
    if (gone && box.current) setHeight(box.current.offsetHeight);
  }, [gone]);

  /* Улёт без подтверждения: строка уезжает за край (200 мс), затем
     схлопывается по высоте (220 мс), и только тогда владелец её убирает —
     иначе соседи прыгают вверх раньше, чем глаз увидел, что исчезло. */
  const flyAway = () => {
    const w = box.current?.offsetWidth ?? 320;
    setDx(-w);
    setFlying(true);
    window.setTimeout(onCommit, 380);
  };

  const reset = () => { setDx(0); setDragging(false); st.current = null; };

  const onDown = (e: React.PointerEvent) => {
    if (disabled || e.button > 0) return;
    const w = box.current?.offsetWidth ?? 320;
    st.current = { x: e.clientX, y: e.clientY, t: performance.now(), axis: null, w, armed: false };
  };

  const onMove = (e: React.PointerEvent) => {
    const s = st.current;
    if (!s) return;
    const mx = e.clientX - s.x;
    const my = e.clientY - s.y;
    if (s.axis === null) {
      if (Math.abs(mx) < AXIS_LOCK && Math.abs(my) < AXIS_LOCK) return;
      s.axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
      if (s.axis === 'x') {
        setDragging(true);
        try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ok */ }
      }
    }
    if (s.axis !== 'x') return;
    // Только влево. Вправо — резина: тянуть незачем, но палец не должен
    // упираться в стену, иначе жест кажется сломанным.
    let v = mx;
    if (v > 0) v = v * 0.18;
    const max = s.w * MAX;
    if (-v > max) v = -(max + (-v - max) * 0.2);
    setDx(v);
    const armed = -v >= s.w * COMMIT;
    if (armed !== s.armed) {
      s.armed = armed;
      select(); // щелчок на пороге — и обратно, если передумал
    }
  };

  const onUp = () => {
    const s = st.current;
    if (!s) return;
    const dt = Math.max(1, performance.now() - s.t);
    const v = -dx / dt;                       // px/мс влево
    const fire = s.axis === 'x' && (-dx >= s.w * COMMIT || (v >= FLICK && -dx > 28));
    if (fire && instant) {
      setDragging(false);
      st.current = null;
      notify('success');
      flyAway();
      return;
    }
    reset();
    if (fire) {
      notify('warning');
      onCommit();
    }
  };

  const progress = Math.min(1, -dx / ((box.current?.offsetWidth ?? 320) * COMMIT));
  const armed = progress >= 1;

  return (
    <div
      ref={box}
      className={`swipe${gone ? ' swipe--gone' : ''}${flying ? ' swipe--fly' : ''}`}
      style={gone && height !== null ? { height } : undefined}
      data-armed={armed ? '' : undefined}
    >
      {/* Панель занимает РОВНО то место, которое освободила строка (её
          ширина = смещение). Так красный не просвечивает сквозь полупрозрачную
          карточку и не виден по краю в покое: его просто нет, пока строка
          не сдвинулась. */}
      <div
        className="swipe-under"
        aria-hidden
        style={{ width: Math.max(0, -dx), ['--p' as string]: progress }}
      >
        <span className="swipe-under-ic">
          <Icon name="trash" size={22} strokeWidth={1.9} />
        </span>
        <span className="swipe-under-label">{label}</span>
      </div>

      <div
        ref={row}
        className="swipe-row"
        style={{ transform: `translate3d(${dx}px,0,0)`, transition: dragging ? 'none' : undefined }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={reset}
        onClickCapture={(e) => {
          // Жест закончился отпусканием на строке — это не нажатие на неё
          if (Math.abs(dx) > 6) { e.preventDefault(); e.stopPropagation(); }
        }}
      >
        {children}
      </div>

      {/* Для тех, кто не тянет (клавиатура, скринридер): то же действие
          доступно кнопкой, видимой только при фокусе */}
      <button className="swipe-kbd" onClick={() => { tap(); if (instant) flyAway(); else onCommit(); }} disabled={disabled}>
        {label}
      </button>
    </div>
  );
}
