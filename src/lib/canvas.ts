// Общие примитивы рисования по canvas.
//
// Были продублированы внутри ReviewCard и понадобились второй раз в
// промо-студии. Вынесены до того, как копия успела разойтись с оригиналом:
// две реализации переноса строк в одном проекте — это две разные вёрстки
// одного и того же текста.

export function roundRect(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Переносит текст по словам. Возвращает Y под последней строкой */
export function wrapText(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number,
): number {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else {
      line = test;
    }
  }
  if (line) { ctx.fillText(line, x, yy); yy += lh; }
  return yy;
}

/** Фирменный фон ANZH: петроль с изумрудным свечением из угла */
export function paintBackdrop(ctx: CanvasRenderingContext2D, W: number, H: number) {
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
}

/** Подпись студии — одна на все макеты, чтобы не разъезжалась */
export function paintFooter(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.fillStyle = '#12C088';
  ctx.font = '700 32px Inter, system-ui, sans-serif';
  ctx.fillText('ANZH COSMETOLOGY · БАТУМИ', 70, H - 96);
  ctx.fillStyle = 'rgba(226,240,236,0.45)';
  ctx.font = '400 28px Inter, system-ui, sans-serif';
  ctx.fillText('@dr.domnich · запись в Telegram', 70, H - 52);
}

/** Сохраняет холст файлом. Возвращает false, если браузер не дал скачать */
export function downloadCanvas(canvas: HTMLCanvasElement, name: string): boolean {
  try {
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = name;
    a.click();
    return true;
  } catch {
    return false;
  }
}
