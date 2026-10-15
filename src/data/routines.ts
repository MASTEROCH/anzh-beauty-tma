// Домашний уход из результатов разборов: аптечная полка и профессиональная,
// каждая разложена на утро и вечер.
//
// Это перенос с anzh.store — там в каждом результате лежал полный протокол
// ухода, а сюда в первый заход попал только короткий список `prods`. Разница
// принципиальная: `prods` отвечает «что купить», а протокол — «в каком
// порядке этим пользоваться», и именно за вторым человек и платит.
//
// ⚠️ Названия средств реальные и намеренно не переведены: La Roche-Posay на
// полке в аптеке подписана латиницей, и переводить её — значит мешать
// человеку найти товар.

export interface RoutineItem { n: string; d: string; }
export interface RoutineSlot { type: 'morning' | 'evening'; items: RoutineItem[]; }
export interface RoutineGroup { type: 'pharmacy' | 'professional'; sub: RoutineSlot[]; }

export const ROUTINE_LABEL = {
  pharmacy:     { ru: 'Аптечный уход',        en: 'Pharmacy routine' },
  professional: { ru: 'Профессиональный уход', en: 'Professional routine' },
  morning:      { ru: 'Утро',   en: 'Morning' },
  evening:      { ru: 'Вечер',  en: 'Evening' },
} as const;

/** Ключ — `${quizId}:${resultKey}` */
const ROUTINES: Record<string, { ru: RoutineGroup[]; en?: RoutineGroup[] }> = 
{
  "skintype:normal": {
    "ru": [
      {
        "type": "pharmacy",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "CeraVe Hydrating Cleanser",
                "d": "Мягкое очищение, не нарушает барьер"
              },
              {
                "n": "La Roche-Posay Pure Vitamin C10",
                "d": "Антиоксидантная защита и сияние"
              },
              {
                "n": "La Roche-Posay Anthelios SPF50+",
                "d": "Ежедневная защита от фотостарения"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "CeraVe Hydrating Cleanser",
                "d": "Повторное очищение"
              },
              {
                "n": "La Roche-Posay Hyalu B5 Serum",
                "d": "Гиалуроновая кислота — поддержание увлажнённости"
              },
              {
                "n": "CeraVe Moisturising Cream",
                "d": "Лёгкое питание с керамидами"
              }
            ]
          }
        ]
      },
      {
        "type": "professional",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "Medik8 C-Tetra",
                "d": "Профессиональный липосомальный витамин C"
              },
              {
                "n": "Medik8 Advanced Day Total Protect SPF30",
                "d": "Защита + антиоксиданты в одном шаге"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "Medik8 Bakuchiol Peptides",
                "d": "Мягкий растительный аналог ретинола"
              },
              {
                "n": "Medik8 Hydr8 B5",
                "d": "Гиалуроновая кислота + витамин B5"
              }
            ]
          }
        ]
      }
    ]
  },
  "skintype:dry": {
    "ru": [
      {
        "type": "pharmacy",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "Avene Tolerance Extremely Gentle Cleanser",
                "d": "Ультра-мягкое очищение без пенообразования"
              },
              {
                "n": "Vichy Mineral 89",
                "d": "Бустер гидратации на основе гиалуроновой кислоты"
              },
              {
                "n": "La Roche-Posay Toleriane Sensitive Riche",
                "d": "Насыщенный крем для восстановления барьера"
              },
              {
                "n": "La Roche-Posay Anthelios SPF50+",
                "d": "Ежедневная защита — обязательно"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "Avene Tolerance Extremely Gentle Cleanser",
                "d": "Бережное вечернее очищение"
              },
              {
                "n": "La Roche-Posay Hyalu B5 Serum",
                "d": "Глубокое увлажнение за ночь"
              },
              {
                "n": "CeraVe Moisturising Cream",
                "d": "Запечатывание влаги с керамидами"
              }
            ]
          }
        ]
      },
      {
        "type": "professional",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "SkinCeuticals H.A. Intensifier",
                "d": "Профессиональный усилитель гиалуроновой кислоты"
              },
              {
                "n": "Medik8 Advanced Day Total Protect SPF30",
                "d": "Дневная защита + антиоксиданты"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "Medik8 Bakuchiol Peptides",
                "d": "Мягкий anti-age без раздражения"
              },
              {
                "n": "SkinCeuticals Triple Lipid Restore 2:4:2",
                "d": "Восстановление липидного барьера"
              }
            ]
          }
        ]
      }
    ]
  },
  "skintype:oily": {
    "ru": [
      {
        "type": "pharmacy",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "La Roche-Posay Effaclar Gel Moussant",
                "d": "Гель с цинком — контроль себума"
              },
              {
                "n": "La Roche-Posay Effaclar Mat",
                "d": "Матирующий крем без масел"
              },
              {
                "n": "La Roche-Posay Anthelios Invisible SPF50+",
                "d": "Невидимый SPF для жирной кожи"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "La Roche-Posay Effaclar Gel Moussant",
                "d": "Глубокое очищение пор вечером"
              },
              {
                "n": "The Ordinary Niacinamide 10% + Zinc 1%",
                "d": "Сужение пор и контроль себума"
              },
              {
                "n": "La Roche-Posay Effaclar Duo+",
                "d": "Точечное воздействие на воспаления"
              }
            ]
          }
        ]
      },
      {
        "type": "professional",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "pHformula AC.CALM",
                "d": "Себорегулирующая сыворотка без раздражения"
              },
              {
                "n": "Medik8 Advanced Day Total Protect SPF30",
                "d": "Лёгкая текстура + защита"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "Medik8 Blemish Control Pads",
                "d": "BHA-диски — профилактика акне и очищение пор"
              },
              {
                "n": "pHformula A.C.N.E. solution",
                "d": "Профессиональная коррекция акне"
              }
            ]
          }
        ]
      }
    ]
  },
  "skintype:combo": {
    "ru": [
      {
        "type": "pharmacy",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "Bioderma Sensibio Gel Moussant",
                "d": "Мягкое очищение для всего лица"
              },
              {
                "n": "The Ordinary Niacinamide 10% + Zinc 1%",
                "d": "Контроль Т-зоны, сужение пор"
              },
              {
                "n": "La Roche-Posay Toleriane Sensitive Fluide (щёки)",
                "d": "Увлажнение без утяжеления"
              },
              {
                "n": "La Roche-Posay Anthelios Invisible SPF50+",
                "d": "SPF без закупорки пор"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "Bioderma Micellar Water H2O",
                "d": "Снятие SPF и макияжа"
              },
              {
                "n": "Paula's Choice BHA 2% Skin Perfecting Toner",
                "d": "Очищение пор Т-зоны"
              },
              {
                "n": "CeraVe Moisturising Cream (щёки) + Effaclar Mat (Т-зона)",
                "d": "Зональное увлажнение"
              }
            ]
          }
        ]
      },
      {
        "type": "professional",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "SkinCeuticals C E Ferulic",
                "d": "Золотой стандарт антиоксидантной защиты"
              },
              {
                "n": "Medik8 Advanced Day Total Protect SPF30",
                "d": "Профессиональная дневная защита"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "Medik8 Crystal Retinal 3",
                "d": "Ретинальдегид — мягкий anti-age"
              },
              {
                "n": "Medik8 Hydr8 B5",
                "d": "Гиалуроновая кислота для щёк"
              }
            ]
          }
        ]
      }
    ]
  },
  "skintype:dehydrated": {
    "ru": [
      {
        "type": "pharmacy",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "CeraVe Hydrating Cleanser",
                "d": "Очищение без потери влаги"
              },
              {
                "n": "Vichy Mineral 89",
                "d": "72-часовой бустер гидратации"
              },
              {
                "n": "La Roche-Posay Hyalu B5 Serum",
                "d": "Многослойное увлажнение"
              },
              {
                "n": "La Roche-Posay Anthelios SPF50+",
                "d": "Защита от иссушения UV"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "CeraVe Hydrating Cleanser",
                "d": "Бережное вечернее очищение"
              },
              {
                "n": "La Roche-Posay Hyalu B5 Serum",
                "d": "Насыщение влагой за ночь"
              },
              {
                "n": "Bioderma Hydrabio Gel-Crème",
                "d": "Лёгкое ночное увлажнение"
              }
            ]
          }
        ]
      },
      {
        "type": "professional",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "SkinCeuticals H.A. Intensifier",
                "d": "Профессиональный усилитель HA × 30%"
              },
              {
                "n": "Medik8 Advanced Day Total Protect SPF30",
                "d": "Защита и поддержание влажности"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "Medik8 Hydr8 B5 Intense",
                "d": "Концентрат гиалуроновой кислоты"
              },
              {
                "n": "SkinCeuticals Triple Lipid Restore 2:4:2",
                "d": "Восстановление барьера и задержка влаги"
              }
            ]
          }
        ]
      }
    ]
  },
  "skintype:sensitive": {
    "ru": [
      {
        "type": "pharmacy",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "Avene Tolerance Extremely Gentle Cleanser",
                "d": "Очищение без раздражения"
              },
              {
                "n": "Avene Tolerance Control Soothing Cream",
                "d": "Успокоение и защита барьера"
              },
              {
                "n": "La Roche-Posay Anthelios UVMune 400 SPF50+",
                "d": "Минеральная защита без раздражителей"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "Avene Tolerance Extremely Gentle Cleanser",
                "d": "Повторное мягкое очищение"
              },
              {
                "n": "Avene Cicalfate+ Restorative Cream",
                "d": "Заживление и восстановление за ночь"
              }
            ]
          }
        ]
      },
      {
        "type": "professional",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "SkinCeuticals Physical Fusion UV Defense SPF50",
                "d": "Минеральный SPF без раздражителей"
              },
              {
                "n": "Medik8 Calmwise",
                "d": "Укрепляющая сыворотка с ниацинамидом"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "Medik8 Hydr8 B5",
                "d": "Увлажнение без потенциальных раздражителей"
              },
              {
                "n": "Medik8 Bakuchiol Peptides",
                "d": "Мягкий anti-age для чувствительной кожи"
              }
            ]
          }
        ]
      }
    ]
  },
  "skintype:acne": {
    "ru": [
      {
        "type": "pharmacy",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "La Roche-Posay Effaclar Gel Moussant",
                "d": "Очищение с цинком без пересушивания"
              },
              {
                "n": "The Ordinary Niacinamide 10% + Zinc 1%",
                "d": "Себорегуляция и профилактика воспалений"
              },
              {
                "n": "La Roche-Posay Anthelios Invisible SPF50+",
                "d": "Некомедогенный SPF"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "La Roche-Posay Effaclar Gel Moussant",
                "d": "Глубокое вечернее очищение"
              },
              {
                "n": "Paula's Choice BHA 2% Skin Perfecting Toner",
                "d": "BHA для очищения пор"
              },
              {
                "n": "La Roche-Posay Effaclar Duo+",
                "d": "Локально на воспаления"
              }
            ]
          }
        ]
      },
      {
        "type": "professional",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "pHformula AC.CALM",
                "d": "Успокаивающая себорегулирующая сыворотка"
              },
              {
                "n": "Medik8 Advanced Day Total Protect SPF30",
                "d": "Лёгкая профессиональная защита"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "Medik8 Blemish Control Pads",
                "d": "Кислотные диски — профилактика акне"
              },
              {
                "n": "pHformula A.C.N.E. solution",
                "d": "Профессиональная коррекция акне"
              }
            ]
          }
        ]
      }
    ]
  },
  "skintype:aging": {
    "ru": [
      {
        "type": "pharmacy",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "CeraVe Hydrating Cleanser",
                "d": "Мягкое очищение"
              },
              {
                "n": "Vichy Liftactiv Vitamin C Serum",
                "d": "Антиоксидантная защита + сияние"
              },
              {
                "n": "La Roche-Posay Anthelios SPF50+",
                "d": "Главный антивозрастной шаг"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "CeraVe Hydrating Cleanser",
                "d": "Вечернее очищение"
              },
              {
                "n": "La Roche-Posay Retinol B3 Serum",
                "d": "Мягкий ретинол — обновление кожи"
              },
              {
                "n": "Vichy Liftactiv Collagen Specialist",
                "d": "Пептидный крем для плотности"
              }
            ]
          }
        ]
      },
      {
        "type": "professional",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "SkinCeuticals C E Ferulic",
                "d": "Золотой стандарт антиоксидантной защиты"
              },
              {
                "n": "Medik8 Advanced Day Total Protect SPF30",
                "d": "Профессиональная защита + антиоксиданты"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "Medik8 Crystal Retinal 3",
                "d": "Ретинальдегид — быстрее ретинола, мягче"
              },
              {
                "n": "SkinCeuticals Triple Lipid Restore 2:4:2",
                "d": "Питание и восстановление структуры"
              }
            ]
          }
        ]
      }
    ]
  },
  "aging:prevention": {
    "ru": [
      {
        "type": "pharmacy",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "CeraVe Hydrating Cleanser",
                "d": "Базовое мягкое очищение"
              },
              {
                "n": "La Roche-Posay Pure Vitamin C10",
                "d": "Антиоксидант — шаг №1 против фотостарения"
              },
              {
                "n": "La Roche-Posay Hyalu B5 Serum",
                "d": "Гиалуроновая кислота для упругости"
              },
              {
                "n": "La Roche-Posay Anthelios SPF50+",
                "d": "SPF — важнее любого крема"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "CeraVe Hydrating Cleanser",
                "d": "Очищение"
              },
              {
                "n": "La Roche-Posay Hyalu B5 Serum",
                "d": "Восстановление уровня влаги"
              },
              {
                "n": "CeraVe Moisturising Cream",
                "d": "Питание с керамидами"
              }
            ]
          }
        ]
      },
      {
        "type": "professional",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "Medik8 C-Tetra",
                "d": "Профессиональный липосомальный витамин C"
              },
              {
                "n": "Medik8 Advanced Day Total Protect SPF30",
                "d": "Защита + антиоксиданты в одном"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "Medik8 Bakuchiol Peptides",
                "d": "Мягкий anti-age — первый шаг к ретиноидам"
              },
              {
                "n": "Medik8 Hydr8 B5",
                "d": "Поддержание уровня гидратации"
              }
            ]
          }
        ]
      }
    ]
  },
  "aging:first_changes": {
    "ru": [
      {
        "type": "pharmacy",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "CeraVe Hydrating Cleanser",
                "d": "Очищение"
              },
              {
                "n": "Vichy Liftactiv Vitamin C Serum",
                "d": "Яркость + антиоксидантная защита"
              },
              {
                "n": "Vichy Liftactiv Collagen Specialist",
                "d": "Пептиды для плотности"
              },
              {
                "n": "La Roche-Posay Anthelios SPF50+",
                "d": "Ежедневный SPF обязателен"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "CeraVe Hydrating Cleanser",
                "d": "Вечернее очищение"
              },
              {
                "n": "La Roche-Posay Retinol B3 Serum",
                "d": "Мягкий ретинол — начало коррекции"
              },
              {
                "n": "Vichy Liftactiv Collagen Specialist",
                "d": "Ночное питание"
              }
            ]
          }
        ]
      },
      {
        "type": "professional",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "SkinCeuticals C E Ferulic",
                "d": "Золотой стандарт антиоксидантной защиты"
              },
              {
                "n": "Medik8 Advanced Day Total Protect SPF30",
                "d": "Профессиональная защита"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "Medik8 Crystal Retinal 3",
                "d": "Ретинальдегид — мягче ретинола, эффективнее"
              },
              {
                "n": "Medik8 Liquid Peptides",
                "d": "Пептидная поддержка плотности"
              }
            ]
          }
        ]
      }
    ]
  },
  "aging:pronounced": {
    "ru": [
      {
        "type": "pharmacy",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "CeraVe Hydrating Cleanser",
                "d": "Очищение"
              },
              {
                "n": "Vichy Liftactiv Peptide-C Ampoules",
                "d": "Интенсивная пептидная + витамин C коррекция"
              },
              {
                "n": "La Roche-Posay Anthelios SPF50+",
                "d": "Защита с антиоксидантами"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "CeraVe Hydrating Cleanser",
                "d": "Очищение"
              },
              {
                "n": "Avene RetrinAL 0.1",
                "d": "Аптечный ретинальдегид — интенсивное обновление"
              },
              {
                "n": "Vichy Liftactiv Collagen Specialist",
                "d": "Ночное питание"
              }
            ]
          }
        ]
      },
      {
        "type": "professional",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "SkinCeuticals C E Ferulic",
                "d": "Профессиональный антиоксидантный стандарт"
              },
              {
                "n": "Medik8 Advanced Day Total Protect SPF30",
                "d": "Защита"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "Medik8 Crystal Retinal 6",
                "d": "Ретинальдегид средней силы — коррекция морщин"
              },
              {
                "n": "SkinCeuticals A.G.E. Interrupter Advanced",
                "d": "Интенсивный anti-age крем"
              },
              {
                "n": "Medik8 Liquid Peptides",
                "d": "Пептиды для плотности"
              }
            ]
          }
        ]
      }
    ]
  },
  "aging:intensive": {
    "ru": [
      {
        "type": "pharmacy",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "CeraVe Hydrating Cleanser",
                "d": "Деликатное очищение"
              },
              {
                "n": "Vichy Liftactiv Peptide-C Ampoules",
                "d": "Концентрированная сыворотка для коррекции"
              },
              {
                "n": "La Roche-Posay Anthelios SPF50+",
                "d": "Обязательно — кожа уязвима при интенсивном уходе"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "CeraVe Hydrating Cleanser",
                "d": "Очищение"
              },
              {
                "n": "Vichy Liftactiv Collagen Specialist",
                "d": "Питательный ночной крем"
              }
            ]
          }
        ]
      },
      {
        "type": "professional",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "SkinCeuticals C E Ferulic",
                "d": "Максимальная антиоксидантная защита"
              },
              {
                "n": "Medik8 Super C Ferulic",
                "d": "Усиленная формула витамина C + феруловая"
              },
              {
                "n": "Medik8 Advanced Day Total Protect SPF30",
                "d": "Защита"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "SkinCeuticals Retinol 1.0",
                "d": "Интенсивный ретинол — для опытных"
              },
              {
                "n": "SkinCeuticals A.G.E. Interrupter Advanced",
                "d": "Глубокая коррекция структуры"
              },
              {
                "n": "Medik8 Crystal Retinal 10",
                "d": "Максимальный ретинальдегид"
              }
            ]
          }
        ]
      }
    ]
  },
  "sensitivity:stable": {
    "ru": [
      {
        "type": "pharmacy",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "CeraVe Hydrating Cleanser",
                "d": "Мягкое очищение без нарушения барьера"
              },
              {
                "n": "La Roche-Posay Toleriane Sensitive Fluide",
                "d": "Лёгкое увлажнение без тяжёлых масел"
              },
              {
                "n": "La Roche-Posay Anthelios UVMune 400 SPF50+",
                "d": "Защита нового поколения"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "CeraVe Hydrating Cleanser",
                "d": "Вечернее очищение"
              },
              {
                "n": "The Ordinary Azelaic Acid 10%",
                "d": "Мягкое выравнивание тона и пор"
              },
              {
                "n": "CeraVe Moisturising Cream",
                "d": "Ночное увлажнение"
              }
            ]
          }
        ]
      },
      {
        "type": "professional",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "Medik8 C-Tetra",
                "d": "Антиоксидантная сыворотка"
              },
              {
                "n": "Medik8 Advanced Day Total Protect SPF30",
                "d": "Защита + антиоксиданты"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "Medik8 Crystal Retinal 3",
                "d": "Мягкий ретиноид для профилактики"
              },
              {
                "n": "Medik8 Hydr8 B5",
                "d": "Гиалуроновая кислота"
              }
            ]
          }
        ]
      }
    ]
  },
  "sensitivity:moderate": {
    "ru": [
      {
        "type": "pharmacy",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "Avene Tolerance Extremely Gentle Cleanser",
                "d": "Очищение без раздражения"
              },
              {
                "n": "Avene Tolerance Control Soothing Cream",
                "d": "Успокоение и поддержание барьера"
              },
              {
                "n": "La Roche-Posay Anthelios UVMune 400 SPF50+",
                "d": "Мягкая минеральная защита"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "Avene Tolerance Extremely Gentle Cleanser",
                "d": "Мягкое вечернее очищение"
              },
              {
                "n": "La Roche-Posay Cicaplast Baume B5+",
                "d": "SOS-восстановление барьера"
              },
              {
                "n": "Avene Tolerance Control Soothing Cream",
                "d": "Успокаивающий уход на ночь"
              }
            ]
          }
        ]
      },
      {
        "type": "professional",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "SkinCeuticals Physical Fusion UV Defense SPF50",
                "d": "Минеральный SPF без потенциальных раздражителей"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "Medik8 Calmwise",
                "d": "Успокаивающая сыворотка с ниацинамидом"
              },
              {
                "n": "Medik8 Bakuchiol Peptides",
                "d": "Мягкий anti-age вместо раздражающего ретинола"
              }
            ]
          }
        ]
      }
    ]
  },
  "sensitivity:pronounced": {
    "ru": [
      {
        "type": "pharmacy",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "La Roche-Posay Toleriane Dermo-Cleanser",
                "d": "Очищение без раздражения — без SLS и отдушек"
              },
              {
                "n": "Avene Cicalfate+ Restorative Cream",
                "d": "Восстановление и защита барьера"
              },
              {
                "n": "La Roche-Posay Anthelios UVMune 400 SPF50+",
                "d": "Минеральный SPF — безопасно"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "La Roche-Posay Toleriane Dermo-Cleanser",
                "d": "Повторное деликатное очищение"
              },
              {
                "n": "La Roche-Posay Cicaplast Baume B5+",
                "d": "Интенсивное восстановление барьера за ночь"
              }
            ]
          }
        ]
      },
      {
        "type": "professional",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "SkinCeuticals Physical Fusion UV Defense SPF50",
                "d": "Минеральный SPF — единственно безопасный вариант"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "Medik8 Calmwise Colour Correct",
                "d": "Успокоение + нейтрализация покраснений"
              }
            ]
          }
        ]
      }
    ]
  },
  "sensitivity:hyper": {
    "ru": [
      {
        "type": "pharmacy",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "Avene Tolerance Extremely Gentle Cleanser",
                "d": "Максимально мягкое очищение"
              },
              {
                "n": "Avene Thermal Water Spray",
                "d": "Успокоение после очищения"
              },
              {
                "n": "Bioderma Sensibio AR Cream",
                "d": "Снижение реактивности и покраснений"
              },
              {
                "n": "La Roche-Posay Anthelios UVMune 400 SPF50+",
                "d": "Минеральная защита — обязательно"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "Avene Tolerance Extremely Gentle Cleanser",
                "d": "Бережное очищение"
              },
              {
                "n": "La Roche-Posay Cicaplast Baume B5+",
                "d": "Интенсивное ночное восстановление"
              }
            ]
          }
        ]
      },
      {
        "type": "professional",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "SkinCeuticals Physical Fusion UV Defense SPF50",
                "d": "Только минеральный SPF при гиперреактивности"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "Medik8 Calmwise",
                "d": "Экстренное успокоение и восстановление барьера"
              }
            ]
          }
        ]
      }
    ]
  },
  "glow:high": {
    "ru": [
      {
        "type": "pharmacy",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "CeraVe Hydrating Cleanser",
                "d": "Мягкое очищение без нарушения барьера"
              },
              {
                "n": "La Roche-Posay Pure Vitamin C10 Serum",
                "d": "Поддержание сияния + антиоксидант"
              },
              {
                "n": "La Roche-Posay Anthelios UVMune 400 SPF50+",
                "d": "Защита достигнутого результата"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "CeraVe Hydrating Cleanser",
                "d": "Очищение"
              },
              {
                "n": "Bioderma Hydrabio Gel-Crème",
                "d": "Лёгкое увлажнение без утяжеления"
              }
            ]
          }
        ]
      },
      {
        "type": "professional",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "Medik8 C-Tetra",
                "d": "Профессиональный витамин C"
              },
              {
                "n": "pHformula VITA C cream",
                "d": "Brightening + антиоксидантная поддержка"
              },
              {
                "n": "Medik8 Advanced Day Total Protect SPF30",
                "d": "Профессиональная защита"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "Medik8 Crystal Retinal 3",
                "d": "2-3 раза в неделю — профилактический ретиноид"
              },
              {
                "n": "Medik8 Hydr8 B5",
                "d": "Поддержание гидратации"
              }
            ]
          }
        ]
      }
    ]
  },
  "glow:medium": {
    "ru": [
      {
        "type": "pharmacy",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "SVR Sensifine Gel Moussant",
                "d": "Бережное очищение"
              },
              {
                "n": "La Roche-Posay Hyalu B5 Serum",
                "d": "Коррекция обезвоженности"
              },
              {
                "n": "Vichy Liftactiv Vitamin C Serum",
                "d": "Возвращение сияния"
              },
              {
                "n": "ISDIN Fusion Water SPF50",
                "d": "Лёгкая текстура + высокая защита"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "SVR Sensifine Gel Moussant",
                "d": "Вечернее очищение"
              },
              {
                "n": "La Roche-Posay Hyalu B5 Serum",
                "d": "Ночное увлажнение"
              },
              {
                "n": "CeraVe Moisturising Cream",
                "d": "Питание"
              }
            ]
          }
        ]
      },
      {
        "type": "professional",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "pHformula VITA C serum",
                "d": "Профессиональная антиоксидантная коррекция"
              },
              {
                "n": "Medik8 Advanced Day Total Protect SPF30",
                "d": "Профессиональная защита"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "Medik8 Crystal Retinal 3",
                "d": "Коррекция текстуры и тона"
              },
              {
                "n": "pHformula A.G.E. solution",
                "d": "Профессиональная anti-age поддержка"
              }
            ]
          }
        ]
      }
    ]
  },
  "glow:low": {
    "ru": [
      {
        "type": "pharmacy",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "Avene Tolerance Extremely Gentle Cleanser",
                "d": "Очищение без стресса для кожи"
              },
              {
                "n": "La Roche-Posay Cicaplast B5+ Serum",
                "d": "Восстановление барьера — приоритет"
              },
              {
                "n": "Bioderma Photoderm AR SPF50+",
                "d": "SPF для чувствительной и покрасневшей кожи"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "Avene Tolerance Extremely Gentle Cleanser",
                "d": "Мягкое очищение"
              },
              {
                "n": "La Roche-Posay Cicaplast B5+ Serum",
                "d": "Барьерная защита на ночь"
              }
            ]
          }
        ]
      },
      {
        "type": "professional",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "pHformula HYDRA serum",
                "d": "Глубокая гидратация повреждённой кожи"
              },
              {
                "n": "Medik8 Advanced Day Total Protect SPF30",
                "d": "Профессиональная защита"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "pHformula P.O.S.T. recovery cream",
                "d": "Профессиональное восстановление"
              },
              {
                "n": "Medik8 Bakuchiol Peptides",
                "d": "Вводить только после стабилизации барьера"
              }
            ]
          }
        ]
      }
    ]
  },
  "glow:problem": {
    "ru": [
      {
        "type": "pharmacy",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "Avene Tolerance Cleanser",
                "d": "Очищение без нагрузки"
              },
              {
                "n": "Avene Cicalfate+ Restorative Cream",
                "d": "Восстановление на первом этапе"
              },
              {
                "n": "La Roche-Posay Anthelios SPF50+",
                "d": "SPF обязателен с первого дня"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "Avene Tolerance Cleanser",
                "d": "Деликатное очищение"
              },
              {
                "n": "La Roche-Posay Hyalu B5 Serum",
                "d": "Восстановление уровня влаги"
              },
              {
                "n": "Avene Cicalfate+ Restorative Cream",
                "d": "Ночное заживление"
              }
            ]
          }
        ]
      },
      {
        "type": "professional",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "pHformula SOS rescue cream",
                "d": "Экстренное восстановление"
              },
              {
                "n": "Medik8 Advanced Day Total Protect SPF30",
                "d": "Защита истощённой кожи"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "pHformula P.O.S.T. recovery cream",
                "d": "Профессиональный восстанавливающий крем"
              }
            ]
          }
        ]
      }
    ]
  },
  "homecare:pro": {
    "ru": [
      {
        "type": "pharmacy",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "Очищающий гель под тип кожи (CeraVe / Effaclar / Avene)",
                "d": "Одно средство — без ротации"
              },
              {
                "n": "Целевая сыворотка (Vitamin C или HA)",
                "d": "Один актив утром под основной запрос"
              },
              {
                "n": "La Roche-Posay Anthelios SPF50+",
                "d": "Ежедневный SPF — без исключений"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "То же очищающее средство",
                "d": "Последовательность сохраняется"
              },
              {
                "n": "Активная сыворотка вечером (ретинол или AHA/BHA)",
                "d": "Один актив вечером под задачу"
              },
              {
                "n": "Ночной крем под тип кожи",
                "d": "Финальный слой"
              }
            ]
          }
        ]
      },
      {
        "type": "professional",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "SkinCeuticals C E Ferulic",
                "d": "Апгрейд аптечного витамина C"
              },
              {
                "n": "Medik8 Advanced Day Total Protect SPF30",
                "d": "Высший уровень дневной защиты"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "Medik8 Crystal Retinal 3–6",
                "d": "Ретинальдегид — апгрейд ретинола под ваш уровень"
              },
              {
                "n": "Medik8 Liquid Peptides",
                "d": "Пептидная поддержка для любого запроса"
              }
            ]
          }
        ]
      }
    ]
  },
  "homecare:medium": {
    "ru": [
      {
        "type": "pharmacy",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "CeraVe Hydrating Cleanser",
                "d": "Зафиксировать одно очищение — без ротации"
              },
              {
                "n": "La Roche-Posay Hyalu B5 Serum",
                "d": "Одна целевая сыворотка — не менять 4 недели"
              },
              {
                "n": "La Roche-Posay Anthelios SPF50+",
                "d": "SPF ввести как обязательный шаг"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "CeraVe Hydrating Cleanser",
                "d": "Повторить утреннее очищение"
              },
              {
                "n": "The Ordinary Niacinamide 10%",
                "d": "Один актив вечером (или ретинол / азелаиновая — не всё сразу)"
              },
              {
                "n": "CeraVe Moisturising Cream",
                "d": "Завершить крем — всегда последний шаг"
              }
            ]
          }
        ]
      },
      {
        "type": "professional",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "Medik8 C-Tetra",
                "d": "Первый профессиональный продукт — начать с витамина C"
              },
              {
                "n": "Medik8 Advanced Day Total Protect SPF30",
                "d": "Апгрейд SPF"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "Medik8 Bakuchiol Peptides",
                "d": "Безопасное начало anti-age — перед ретинолом"
              },
              {
                "n": "Medik8 Crystal Retinal 3",
                "d": "Следующий шаг после стабилизации рутины"
              }
            ]
          }
        ]
      }
    ]
  },
  "homecare:beginner": {
    "ru": [
      {
        "type": "pharmacy",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "CeraVe Hydrating Cleanser",
                "d": "Шаг 1: одно мягкое очищение — не менять"
              },
              {
                "n": "CeraVe AM Facial Moisturising Lotion SPF30",
                "d": "Шаг 2: крем + SPF в одном — упрощает рутину"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "CeraVe Hydrating Cleanser",
                "d": "То же средство — последовательность сохраняется"
              },
              {
                "n": "CeraVe Moisturising Cream",
                "d": "Шаг 2: один крем — и всё. Больше ничего пока"
              }
            ]
          }
        ]
      },
      {
        "type": "professional",
        "sub": [
          {
            "type": "morning",
            "items": [
              {
                "n": "Medik8 C-Tetra",
                "d": "Добавить ТОЛЬКО после 4+ недель стабильной базы"
              },
              {
                "n": "Medik8 Advanced Day Total Protect SPF30",
                "d": "Апгрейд SPF — следующий шаг"
              }
            ]
          },
          {
            "type": "evening",
            "items": [
              {
                "n": "Medik8 Bakuchiol Peptides",
                "d": "Первый профессиональный продукт вечером — мягко и без риска"
              }
            ]
          }
        ]
      }
    ]
  }
}
;

export function routineFor(quizId: string, resultKey: string, lang: 'ru' | 'en'): RoutineGroup[] | null {
  const rec = ROUTINES[`${quizId}:${resultKey}`];
  if (!rec) return null;
  // Английского протокола может не быть — русский лучше, чем пустой экран
  return (lang === 'en' ? rec.en ?? rec.ru : rec.ru) ?? null;
}
