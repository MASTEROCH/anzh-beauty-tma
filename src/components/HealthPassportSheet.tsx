import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { openSheet, closeSheet, toast } from '../lib/ui';
import { QuizRunner } from './QuizRunner';
import { FREE_QUIZ } from '../data/quizzes';
import {
  useHealthPassport, updateHealthPassport,
  SKIN_TYPES, FITZPATRICK, SENSITIVITY_LABEL,
  type Sensitivity,
} from '../lib/healthPassport';

// Анкета, которую раньше нельзя было заполнить: кнопка «Редактировать» показывала
// тост-заглушку. При этом у каждой услуги в каталоге прописаны противопоказания —
// сверять их было не с чем.

const COMMON_ALLERGIES = ['Лидокаин', 'Гиалуроновая кислота', 'Рыба / морепродукты', 'Пыльца', 'Антибиотики'];

export function HealthPassportSheet({ onBook }: { onBook?: (id: string) => void }) {
  const saved = useHealthPassport();
  const [p, setP] = useState(saved);
  const [custom, setCustom] = useState('');

  // Форма правится черновиком (чтобы «Отмена» работала), но разбор пишет
  // напрямую в стор. Без этой синхронизации форма осталась бы со старыми
  // данными, а «Сохранить» затёрло бы то, что заполнил разбор.
  useEffect(() => { setP(saved); }, [saved]);

  // Разбор пишет в тот же стор — после него анкета открывается уже заполненной
  const openQuiz = () =>
    openSheet({
      title: 'ANZH Skin Intelligence',
      subtitle: `Skin Profile · ${FREE_QUIZ.questions.length} вопросов · бесплатно`,
      body: <QuizRunner quiz={FREE_QUIZ} onBook={onBook ?? (() => closeSheet())} />,
    });

  const patch = (fields: Partial<typeof p>) => setP((x) => ({ ...x, ...fields }));

  const toggleAllergy = (a: string) => {
    const has = p.allergies.some((x) => x.startsWith(a));
    patch({
      allergies: has ? p.allergies.filter((x) => !x.startsWith(a)) : [...p.allergies, a],
      noAllergies: false,
    });
  };

  const save = () => {
    updateHealthPassport(p);
    closeSheet();
    toast('Анкета сохранена — Анжелика увидит её перед процедурой', 'success');
  };

  return (
    <div className="hp-form">
      {/* Заполнять анкету руками хочет не каждый — разбор делает это за тебя */}
      {p.quizAt ? (
        <div className="hp-quiz-done">
          <Icon name="sparkles" size={16} strokeWidth={1.9} />
          <div>
            <div className="hp-quiz-done-title">
              Разбор пройден {new Date(p.quizAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
            </div>
            <div className="hp-quiz-done-sub">
              {[p.goal, p.experience, p.pace].filter(Boolean).join(' · ') || 'Тип кожи и чувствительность заполнены автоматически'}
            </div>
          </div>
          <button className="hp-quiz-again" onClick={openQuiz}>пройти заново</button>
        </div>
      ) : (
        <button className="hp-quiz-cta" onClick={openQuiz}>
          <div className="hp-quiz-icon"><Icon name="sparkles" size={20} strokeWidth={1.8} /></div>
          <div className="hp-quiz-text">
            <div className="hp-quiz-title">Не заполнять руками</div>
            <div className="hp-quiz-sub">
              Пройди Skin Profile — {FREE_QUIZ.questions.length} вопросов, и анкета заполнится сама
            </div>
          </div>
          <Icon name="chevron-right" size={20} strokeWidth={2} className="review-cta-arrow" />
        </button>
      )}

      <Row label="аллергии">
        <button
          className={`hp-chip ${p.noAllergies ? 'on' : ''}`}
          onClick={() => patch({ noAllergies: !p.noAllergies, allergies: [] })}
        >
          <Icon name={p.noAllergies ? 'check' : 'plus'} size={13} strokeWidth={2.4} />
          Аллергий нет
        </button>
        {!p.noAllergies && (
          <>
            {COMMON_ALLERGIES.map((a) => {
              const on = p.allergies.some((x) => x.startsWith(a));
              return (
                <button key={a} className={`hp-chip ${on ? 'warn' : ''}`} onClick={() => toggleAllergy(a)}>
                  {on && <Icon name="warning" size={12} strokeWidth={2.2} />}
                  {a}
                </button>
              );
            })}
            {p.allergies.filter((a) => !COMMON_ALLERGIES.some((c) => a.startsWith(c))).map((a) => (
              <button key={a} className="hp-chip warn" onClick={() => patch({ allergies: p.allergies.filter((x) => x !== a) })}>
                {a} <Icon name="x" size={11} strokeWidth={2.4} />
              </button>
            ))}
          </>
        )}
      </Row>

      {!p.noAllergies && (
        <div className="hp-inline">
          <input
            className="onb-input"
            placeholder="Другая аллергия"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && custom.trim()) {
                patch({ allergies: [...p.allergies, custom.trim()] });
                setCustom('');
              }
            }}
          />
          <button
            className="btn btn-ghost btn-sm"
            disabled={!custom.trim()}
            onClick={() => { patch({ allergies: [...p.allergies, custom.trim()] }); setCustom(''); }}
          >
            <Icon name="plus" size={15} strokeWidth={2.4} />
          </button>
        </div>
      )}

      <Row label="состояние">
        <Toggle on={p.pregnant} label="Беременность" onClick={() => patch({ pregnant: !p.pregnant })} />
        <Toggle on={p.lactating} label="Лактация" onClick={() => patch({ lactating: !p.lactating })} />
        <Toggle on={p.couperose} label="Купероз" onClick={() => patch({ couperose: !p.couperose })} />
      </Row>

      <label className="onb-field" style={{ marginTop: 14 }}>
        <span className="onb-label">хронические заболевания</span>
        <input
          className="onb-input"
          value={p.chronic}
          onChange={(e) => patch({ chronic: e.target.value })}
          placeholder="Если нет — оставь пустым"
        />
      </label>

      <label className="onb-field" style={{ marginTop: 12 }}>
        <span className="onb-label">препараты постоянно</span>
        <input
          className="onb-input"
          value={p.meds}
          onChange={(e) => patch({ meds: e.target.value })}
          placeholder="Антикоагулянты, ретиноиды…"
        />
      </label>

      <Row label="тип кожи">
        {SKIN_TYPES.map((s) => (
          <button key={s} className={`hp-chip ${p.skinType === s ? 'on' : ''}`} onClick={() => patch({ skinType: s })}>
            {s}
          </button>
        ))}
      </Row>

      <Row label="фототип (fitzpatrick)">
        {FITZPATRICK.map((f) => (
          <button key={f} className={`hp-chip ${p.fitzpatrick === f ? 'on' : ''}`} onClick={() => patch({ fitzpatrick: f })}>
            {f}
          </button>
        ))}
      </Row>

      <Row label="чувствительность">
        {(['low', 'medium', 'high'] as Sensitivity[]).map((s) => (
          <button key={s} className={`hp-chip ${p.sensitivity === s ? 'on' : ''}`} onClick={() => patch({ sensitivity: s })}>
            {SENSITIVITY_LABEL[s].ru}
          </button>
        ))}
      </Row>

      <label className="onb-field" style={{ marginTop: 14 }}>
        <span className="onb-label">что ещё важно знать</span>
        <textarea
          className="review-textarea"
          rows={3}
          value={p.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          placeholder="Реакции на прошлые процедуры, пожелания, страхи"
          maxLength={400}
        />
      </label>

      <div className="hp-privacy">
        <Icon name="shield-check" size={15} strokeWidth={1.9} />
        <span>Видит только Анжелика. Перед каждой записью я сверяю анкету с противопоказаниями процедуры.</span>
      </div>

      <div className="review-submit-row" style={{ marginTop: 16 }}>
        <button className="btn btn-primary btn-block" onClick={save}>Сохранить анкету</button>
        <button className="btn btn-quiet btn-block" onClick={closeSheet}>Отмена</button>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>{label}</div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>{children}</div>
    </div>
  );
}

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button className={`hp-chip ${on ? 'warn' : ''}`} onClick={onClick} aria-pressed={on}>
      <Icon name={on ? 'check' : 'plus'} size={12} strokeWidth={2.4} />
      {label}
    </button>
  );
}
