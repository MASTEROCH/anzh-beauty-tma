import { useRef, useState } from 'react';
import { Icon } from './Icon';
import { toast } from '../lib/ui';
import { roundRect, wrapText } from '../lib/canvas';

// Анжелика: отзывы она сейчас скринит вручную и красивые выкладывает в сторис.
// Сценарий, который она описала, — женщина после процедуры показывает подруге
// «было / стало». Поэтому у отзыва есть парадная сторона: карточка, которую
// можно сохранить картинкой или отправить одним тапом.

export interface ReviewCardData {
  author: string;
  stars: number;
  text: string;
  service: string;
  date: string;
  photo?: string;
}

export function ReviewCard({ data }: { data: ReviewCardData }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  /** Рисуем карточку в canvas — так она сохраняется картинкой, а не скриншотом */
  const saveImage = async () => {
    const node = cardRef.current;
    if (!node) return;
    setSaving(true);
    try {
      const W = 1080, H = 1350;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d')!;

      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, '#08201f');
      bg.addColorStop(1, '#061417');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const halo = ctx.createRadialGradient(W, 0, 0, W, 0, W);
      halo.addColorStop(0, 'rgba(18,192,136,0.35)');
      halo.addColorStop(1, 'rgba(18,192,136,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, W, H);

      if (data.photo) {
        const img = new Image();
        img.src = data.photo;
        await img.decode().catch(() => {});
        const side = W - 140;
        ctx.save();
        roundRect(ctx, 70, 180, side, side * 0.72, 36);
        ctx.clip();
        ctx.drawImage(img, 70, 180, side, side * 0.72);
        ctx.restore();
      }

      ctx.fillStyle = '#F5C842';
      ctx.font = '600 52px Inter, system-ui, sans-serif';
      ctx.fillText('★'.repeat(data.stars), 70, 120);

      ctx.fillStyle = 'rgba(255,255,255,0.96)';
      ctx.font = '600 44px Inter, system-ui, sans-serif';
      wrapText(ctx, `«${data.text}»`, 70, data.photo ? 900 : 300, W - 140, 62);

      ctx.fillStyle = 'rgba(226,240,236,0.6)';
      ctx.font = '400 34px Inter, system-ui, sans-serif';
      ctx.fillText(`${data.author} · ${data.service}`, 70, H - 150);
      ctx.fillStyle = '#12C088';
      ctx.font = '600 32px Inter, system-ui, sans-serif';
      ctx.fillText('ANZH COSMETOLOGY · БАТУМИ', 70, H - 96);

      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `anzh-review-${Date.now()}.png`;
      a.click();
      toast('Карточка сохранена — можно в сторис', 'success');
    } finally {
      setSaving(false);
    }
  };

  const share = async () => {
    const text = `«${data.text}» — ${data.author}, ${data.service}. ANZH Cosmetology, Батуми`;
    const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> };
    if (nav.share) {
      nav.share({ title: 'ANZH Cosmetology', text, url: 'https://t.me/anzh_cosmetology' }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(text);
      toast('Отзыв скопирован — можно переслать', 'success');
    }
  };

  return (
    <>
      <div className="rc" ref={cardRef}>
        <div className="rc-glow" aria-hidden />
        <div className="rc-stars">{'★'.repeat(data.stars)}</div>
        {data.photo && <img src={data.photo} alt="" className="rc-photo" />}
        <p className="rc-text">«{data.text}»</p>
        <div className="rc-foot">
          <div>
            <div className="rc-author">{data.author}</div>
            <div className="rc-meta">{data.service} · {data.date}</div>
          </div>
          <img src="/brand/anzh-logo.svg" alt="ANZH" className="rc-logo" />
        </div>
      </div>

      <div className="row" style={{ gap: 8, marginTop: 14 }}>
        <button className="btn btn-secondary row-fill" onClick={saveImage} disabled={saving}>
          <Icon name="arrow-back" size={16} strokeWidth={2} style={{ transform: 'rotate(-90deg)' }} />
          {saving ? 'Рисую…' : 'Сохранить'}
        </button>
        <button className="btn btn-primary row-fill" onClick={share}>
          <Icon name="share" size={16} strokeWidth={2} /> Поделиться
        </button>
      </div>
    </>
  );
}
