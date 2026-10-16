/**
 * Icon — лёгкий SVG-набор в стиле Lucide / Phosphor.
 * Все иконки в одном файле для простоты, используют currentColor + stroke.
 */

export type IconName =
  | 'lotus' | 'sparkles' | 'calendar' | 'user' | 'shopping-bag'
  | 'chevron-right' | 'chevron-left' | 'arrow-right' | 'arrow-up-right' | 'arrow-back'
  | 'x' | 'check' | 'star' | 'heart' | 'heart-filled' | 'share' | 'settings' | 'pencil' | 'search'
  | 'lip' | 'droplet' | 'leaf' | 'wave' | 'bolt' | 'sun' | 'moon' | 'syringe' | 'bottle' | 'cream' | 'mask'
  | 'send' | 'mic' | 'message' | 'globe' | 'pin' | 'clock' | 'gift' | 'crown' | 'shield-check'
  | 'plus' | 'minus' | 'info' | 'warning' | 'flower' | 'lash' | 'stethoscope'
  | 'play' | 'volume' | 'volume-off'
  | 'graduation' | 'layers' | 'cannula' | 'trash' | 'image' | 'upload' | 'edit' | 'tag' | 'grip' | 'menu' | 'phone' | 'camera' | 'chat-ai' | 'paperclip' | 'check-double' | 'bell' | 'whatsapp';

interface Props {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
  fill?: 'none' | 'current';
}

export function Icon({ name, size = 22, strokeWidth = 1.8, className, style, fill = 'none' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill === 'current' ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

const PATHS: Record<IconName, React.ReactNode> = {
  // Navigation
  'lotus': (
    <>
      <path d="M12 22c0-4-2-7-5-7 0-3 2-5 5-5s5 2 5 5c-3 0-5 3-5 7z" />
      <path d="M12 10c-3-2-5-5-5-7 3 0 5 2 5 4 0-2 2-4 5-4 0 2-2 5-5 7z" />
    </>
  ),
  'sparkles': (
    <>
      <path d="M12 3l1.8 4.6L18 9.4l-4.2 1.8L12 16l-1.8-4.8L6 9.4l4.2-1.8L12 3z" />
      <path d="M19 14l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1z" />
      <path d="M5 17l.7 1.4 1.3.6-1.3.6L5 21l-.7-1.4L3 19l1.3-.6L5 17z" />
    </>
  ),
  'calendar': (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <circle cx="8" cy="14" r="0.5" fill="currentColor" />
      <circle cx="12" cy="14" r="0.5" fill="currentColor" />
      <circle cx="16" cy="14" r="0.5" fill="currentColor" />
    </>
  ),
  'user': (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
    </>
  ),
  'shopping-bag': (
    <>
      <path d="M5 9h14l-1 11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 9z" />
      <path d="M9 9V6a3 3 0 0 1 6 0v3" />
    </>
  ),
  // Arrows
  'chevron-right': <path d="M9 6l6 6-6 6" />,
  'chevron-left': <path d="M15 6l-6 6 6 6" />,
  'arrow-right': <path d="M5 12h14M13 6l6 6-6 6" />,
  'arrow-up-right': <path d="M7 17L17 7M9 7h8v8" />,
  'arrow-back': <path d="M19 12H5M11 6l-6 6 6 6" />,
  // Actions
  'x': <path d="M6 6l12 12M6 18L18 6" />,
  'play': <path d="M8 5.5v13l10.5-6.5L8 5.5z" />,
  'volume': <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5zM15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" />,
  'volume-off': <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5zM16 9.5l5 5M21 9.5l-5 5" />,
  'check': <path d="M5 12l5 5L19 7" />,
  'whatsapp': (
    <>
      <path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.3z" />
      <path d="M9 8.6c.2-.5.6-.6.9-.6h.5c.2 0 .4.1.5.4l.7 1.6c.1.3 0 .5-.1.7l-.5.6c.6 1.2 1.6 2.2 2.8 2.8l.6-.5c.2-.2.5-.2.7-.1l1.6.7c.3.1.4.3.4.5v.5c0 .4-.2.8-.6.9-1.2.5-3.1.2-4.9-1.6S8.5 9.8 9 8.6z" />
    </>
  ),
  'bell': (
    <>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>
  ),
  'star': <path d="M12 3l2.6 6 6.4.6-4.8 4.4 1.4 6.4L12 17.3 6.4 20.4l1.4-6.4L3 9.6l6.4-.6L12 3z" />,
  'heart': <path d="M12 21s-7-4.5-7-10a4.5 4.5 0 0 1 7-3.5A4.5 4.5 0 0 1 19 11c0 5.5-7 10-7 10z" />,
  'heart-filled': <path d="M12 21s-7-4.5-7-10a4.5 4.5 0 0 1 7-3.5A4.5 4.5 0 0 1 19 11c0 5.5-7 10-7 10z" fill="currentColor" />,
  'share': (
    <>
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="5" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4" />
    </>
  ),
  'settings': (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12c0 .6-.05 1.2-.14 1.78l2.05 1.6-2 3.46-2.45-.86c-.95.78-2.05 1.38-3.25 1.74L13 22h-4l-.21-2.28a8.13 8.13 0 0 1-3.25-1.74l-2.45.86-2-3.46 2.05-1.6A8.13 8.13 0 0 1 3 12c0-.6.05-1.2.14-1.78l-2.05-1.6 2-3.46 2.45.86c.95-.78 2.05-1.38 3.25-1.74L9 2h4l.21 2.28c1.2.36 2.3.96 3.25 1.74l2.45-.86 2 3.46-2.05 1.6c.09.58.14 1.18.14 1.78z" />
    </>
  ),
  'pencil': (
    <>
      <path d="M14 4l6 6L8 22H2v-6L14 4z" />
      <path d="M13 5l6 6" />
    </>
  ),
  'search': (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.5-4.5" />
    </>
  ),
  // Beauty / procedures
  'lip': (
    <>
      <path d="M3 12c1-3 4-5 9-5s8 2 9 5c-2 2-5 4-9 4s-7-2-9-4z" />
      <path d="M3 12c1.5 1.2 4 2 6 2s4.5-.8 6-2" />
      <path d="M8 9c1.5-1 3-1.5 4-1.5s2.5.5 4 1.5" />
    </>
  ),
  'droplet': <path d="M12 3s7 7 7 12a7 7 0 0 1-14 0c0-5 7-12 7-12z" />,
  'leaf': (
    <>
      <path d="M21 3c0 9-6 16-13 16-3 0-5-2-5-5 0-7 7-13 16-13l2 2z" />
      <path d="M3 19c4-4 9-7 14-9" />
    </>
  ),
  'wave': (
    <>
      <path d="M3 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
      <path d="M3 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
    </>
  ),
  'bolt': <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />,
  'moon': <path d="M20.5 14.3A8.5 8.5 0 019.7 3.5a8.5 8.5 0 1010.8 10.8z" />,
  'sun': (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </>
  ),
  /* 🚨 Прежний шприц читался как карандаш: корпус был одной ломаной без
     поршня и без иглы, и на 24 px у него не оставалось ни одного
     признака шприца. Нынешний — корпус, шкала, поршень с упором и игла;
     форма та же, что у Lucide (ISC): её узнают без подписи. */
  'syringe': (
    <>
      <path d="m18 2 4 4" />
      <path d="m17 7 3-3" />
      <path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5" />
      <path d="m9 11 4 4" />
      <path d="m5 19-3 3" />
      <path d="m14 4 6 6" />
    </>
  ),
  /* Обучение: шапочка выпускника. Одна на все курсы — как знак раздела,
     а не как картинка конкретного курса. */
  'graduation': (
    <>
      <path d="M21.4 10.9a1 1 0 0 0 0-1.8L12.8 5.2a2 2 0 0 0-1.6 0L2.6 9.1a1 1 0 0 0 0 1.8l8.6 3.9a2 2 0 0 0 1.6 0z" />
      <path d="M22 10v6" />
      <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
    </>
  ),
  /* Слои — коллагеностимуляторы создают каркас внутри кожи */
  'layers': (
    <>
      <path d="M12.8 2.2a2 2 0 0 0-1.6 0L2.6 6.1a1 1 0 0 0 0 1.8l8.6 3.9a2 2 0 0 0 1.6 0l8.6-3.9a1 1 0 0 0 0-1.8z" />
      <path d="M2 12a1 1 0 0 0 .6.9l8.6 3.9a2 2 0 0 0 1.6 0l8.6-3.9A1 1 0 0 0 22 12" />
      <path d="M2 17a1 1 0 0 0 .6.9l8.6 3.9a2 2 0 0 0 1.6 0l8.6-3.9A1 1 0 0 0 22 17" />
    </>
  ),
  /* Канюля — тупая игла: длинный тонкий стержень, ОКРУГЛЫЙ кончик (в этом
     и отличие от обычной иглы: он не режет, а раздвигает ткань), муфта на
     конце и два крылышка под luer-замок. Рисуется горизонтально и
     поворачивается на 45° одной трансформацией — так легче править, чем
     считать диагонали руками. Первая версия была набором ломаных линий и
     читалась как перо со сломанным хвостом. */
  'cannula': (
    <g transform="rotate(-45 12 12)">
      <rect x="15" y="9.6" width="6" height="4.8" rx="1.3" />
      <path d="M17.6 7.4v2.2M17.6 14.4v2.2" />
      <path d="M15 12H4.4" />
      <circle cx="3.3" cy="12" r="0.95" />
    </g>
  ),
  /* Корзина с отдельной крышкой (.trash-lid): при протяжке строки в
     SwipeRow крышка приподнимается по прогрессу — человек видит, что
     произойдёт, ещё до того, как отпустил. */
  'trash': (
    <>
      <g className="trash-lid">
        <path d="M3 6h18" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      </g>
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  'image': (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <circle cx="8.5" cy="8.5" r="1.6" />
      <path d="m21 15-4.6-4.6a1.5 1.5 0 0 0-2.1 0L5 19.5" />
    </>
  ),
  'upload': (
    <>
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </>
  ),
  'edit': (
    <>
      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" />
      <path d="m14.5 6.5 3 3" />
    </>
  ),
  'tag': (
    <>
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
      <circle cx="7.5" cy="7.5" r="1.3" />
    </>
  ),
  'grip': (
    <>
      <circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" />
      <circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" />
      <circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" />
    </>
  ),
  /* Три полоски: раздел «Студия» в кабинете — это меню управления, а не
     «настройки»; шестерёнка обещала переключатели, а за ней живут процедуры,
     команда, контакты и акции. */
  'menu': (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </>
  ),
  'bottle': (
    <>
      <path d="M9 3h6v3l1.5 2c.3.5.5 1 .5 1.5V20a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9.5c0-.5.2-1 .5-1.5L9 6V3z" />
      <path d="M9 13h6" />
    </>
  ),
  'cream': (
    <>
      <rect x="5" y="8" width="14" height="13" rx="2" />
      <path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M8 13h8" />
    </>
  ),
  'mask': (
    <>
      <path d="M4 9c0-3 3-5 8-5s8 2 8 5v3c0 4-3 7-8 7s-8-3-8-7V9z" />
      <circle cx="9" cy="11" r="0.8" fill="currentColor" />
      <circle cx="15" cy="11" r="0.8" fill="currentColor" />
    </>
  ),
  // Chat / actions
  'send': <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />,
  'mic': (
    <>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </>
  ),
  'paperclip': (
    <>
      <path d="M20.5 11.5l-8.2 8.2a5.2 5.2 0 0 1-7.4-7.4l8.6-8.6a3.5 3.5 0 0 1 4.9 4.9l-8.4 8.4a1.7 1.7 0 0 1-2.5-2.5l7.8-7.8" />
    </>
  ),
  'check-double': (
    <>
      <path d="M2.5 12.5l4 4 8-9M10.5 15.5l1 1 8-9" />
    </>
  ),
  'phone': (
    <>
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
    </>
  ),
  'camera': (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" />
    </>
  ),
  'chat-ai': (
    <>
      <path d="M21 12c0 4.5-4 8-9 8-1.5 0-2.9-.3-4.2-.9L3 21l1.4-3.6A8.1 8.1 0 0 1 3 12c0-4.5 4-8 9-8s9 3.5 9 8z" />
      <path d="M12 8.2l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z" />
    </>
  ),
  'message': (
    <>
      <path d="M21 12c0 4.5-4 8-9 8-1.5 0-2.9-.3-4.2-.9L3 21l1.4-3.6A8.1 8.1 0 0 1 3 12c0-4.5 4-8 9-8s9 3.5 9 8z" />
    </>
  ),
  'globe': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </>
  ),
  'pin': (
    <>
      <path d="M12 22s7-8 7-13a7 7 0 0 0-14 0c0 5 7 13 7 13z" />
      <circle cx="12" cy="9" r="2.5" />
    </>
  ),
  'clock': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  'gift': (
    <>
      <rect x="3" y="8" width="18" height="13" rx="2" />
      <path d="M3 12h18M12 8v13M8 8a2 2 0 0 1 0-4c2 0 4 4 4 4s-2 0-4 0zM16 8a2 2 0 0 0 0-4c-2 0-4 4-4 4s2 0 4 0z" />
    </>
  ),
  'crown': <path d="M3 18l2-10 5 5 2-8 2 8 5-5 2 10H3z" />,
  'shield-check': (
    <>
      <path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5l8-3z" />
      <path d="M8 12l3 3 5-5" />
    </>
  ),
  'plus': <path d="M12 5v14M5 12h14" />,
  'minus': <path d="M5 12h14" />,
  'info': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 8v0.5" />
    </>
  ),
  'warning': (
    <>
      <path d="M12 3l10 18H2L12 3z" />
      <path d="M12 10v4M12 17v0.5" />
    </>
  ),
  // Бровь с волосками — ламинирование и окрашивание
  'lash': (
    <>
      <path d="M3 13c3-5 7-7 10-7s6 1.6 8 4.6" />
      <path d="M6 11.3L4.6 8.2M9.4 9.6L8.6 6.3M13 9.2l.2-3.3M16.6 9.9l1.1-3.1" />
    </>
  ),
  // Стетоскоп — врачебный приём, не косметологическая процедура
  'stethoscope': (
    <>
      <path d="M5 3v5a4.5 4.5 0 0 0 9 0V3" />
      <path d="M3.4 3h3.2M12.4 3h3.2" />
      <path d="M9.5 12.5v2a5.5 5.5 0 0 0 11 0v-2.2" />
      <circle cx="20.5" cy="10.2" r="2.1" />
    </>
  ),
  'flower': (
    <>
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 9.5c-1-3-1-5 0-7 1 2 1 4 0 7zM12 14.5c-1 3-1 5 0 7 1-2 1-4 0-7zM9.5 12c-3-1-5-1-7 0 2 1 4 1 7 0zM14.5 12c3-1 5-1 7 0-2 1-4 1-7 0z" />
      <path d="M10.2 10.2c-2-2-3-3.5-3.5-5 1.5.5 3 1.5 5 3.5zM13.8 13.8c2 2 3 3.5 3.5 5-1.5-.5-3-1.5-5-3.5zM13.8 10.2c2-2 3.5-3 5-3.5-.5 1.5-1.5 3-3.5 5zM10.2 13.8c-2 2-3.5 3-5 3.5.5-1.5 1.5-3 3.5-5z" />
    </>
  ),
};
