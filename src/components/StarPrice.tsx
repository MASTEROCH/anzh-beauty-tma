import { Icon } from './Icon';
import { starsToUsd } from '../lib/payments';

// Цена в звёздах не говорит клиентке ничего: «750★» — это много или мало?
// Пересчёт в доллары рядом с крупной цифрой снимает этот вопрос, не отнимая
// у звёзд роли основной валюты (платит она всё равно звёздами).

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
      <span className="star-price-main">
        <Icon name="star" size={size === 'lg' ? 16 : size === 'md' ? 14 : 12} strokeWidth={2} fill="current" />
        {stars}
      </span>
      <span className="star-price-usd">≈ ${starsToUsd(stars)}</span>
    </span>
  );
}
