import { useState } from 'react';
import { toast } from '../lib/ui';
import { notify, select } from '../lib/haptics';
import { cabinetDenied } from '../lib/staff';
import { patchStudio } from '../lib/api/studio';
import { useStudio, applyStudio } from '../lib/studioProfile';

/* Владелица решает, дарить ли главы паспорта и сколько подруг за главу.
   Глава за пройденную процедуру — всегда, пока подарки включены. */
export function StudioPassportRules() {
  const studio = useStudio();
  const cur = studio.passportRules ?? { enabled: true, friendsPerChapter: 2 };
  const [enabled, setEnabled] = useState(cur.enabled);
  const [n, setN] = useState(cur.friendsPerChapter);
  const [busy, setBusy] = useState(false);
  const dirty = enabled !== cur.enabled || n !== cur.friendsPerChapter;

  const save = async () => {
    setBusy(true);
    try {
      applyStudio(await patchStudio({ passport_rules: { enabled, friends_per_chapter: n } }));
      notify('success');
      toast('Правила глав сохранены', 'success');
    } catch (e) {
      cabinetDenied(e);
      notify('error');
      toast('Не сохранилось — повторите');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="section" style={{ paddingTop: 4 }}>
      <div className="pe-sect">
        <div className="pe-sect-head"><span className="eyebrow">Паспорт кожи · главы в подарок</span></div>
        <label className="pe-toggle">
          <input type="checkbox" checked={enabled} onChange={(e) => { select(); setEnabled(e.target.checked); }} />
          <span className="pe-toggle-box" aria-hidden />
          <span className="pe-toggle-text">Дарить главы<small>+1 разбор за каждую проведённую процедуру и за подруг, которые пришли на процедуру</small></span>
        </label>
        {enabled && (
          <div className="me-order">
            <span className="faint">Подруг за одну главу: <b>{n}</b></span>
            <button className="chip" disabled={n <= 1} onClick={() => { select(); setN(n - 1); }} aria-label="Меньше">−</button>
            <button className="chip" disabled={n >= 10} onClick={() => { select(); setN(n + 1); }} aria-label="Больше">+</button>
          </div>
        )}
        <p className="faint pe-hint">Подруга засчитывается после её первой проведённой процедуры — не за регистрацию.</p>
        {dirty && (
          <button className="btn btn-primary btn-block" disabled={busy} onClick={() => { void save(); }}>
            {busy ? 'Сохраняем…' : 'Сохранить правила'}
          </button>
        )}
      </div>
    </section>
  );
}
