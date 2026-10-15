import { Icon } from './Icon';
import { starsToUsd } from '../lib/payments';

// 🚨 КРУПНО — ДОЛЛАРЫ, МЕЛКО — ЗВЁЗДЫ (Роч, 15.10.2026).
//
// Было наоборот: «670 ★» крупно, «≈ $12.99» подписью в 10 px. Для человека,
// который впервые видит Stars, «670» — это не цена, а число без единиц: шестьсот
// семьдесят чего? Лари? Рублей? Курс звезды знают единицы, и подпись, набранная
// вдвое мельче, этого не чинит — её не читают.
//
// Доллар человек считает мгновенно, поэтому решение он принимает по доллару.
// Звёзды остаются — ими он платит, и в счёте Telegram он увидит именно их, —
// но становятся подписью: «670 ★ в Telegram».

export function StarPrice({
  stars,
  size = 'md',
  className = '',
}: {
  stars: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return (
    <span className={`star-price star-price--${size} ${className}`.trim()}>
      <span className="star-price-main">${starsToUsd(stars)}</span>
      <span className="star-price-stars">
        <Icon name="star" size={size === 'lg' ? 12 : 11} strokeWidth={2} fill="current" />
        {stars}
      </span>
    </span>
  );
}
