/* Dati di partenza: libreria immagini e scheda iniziale (rotazione A/B/C). */
(function (root) {
  const IMG_LIB = [
    ['Barbell_Squat', 'Squat bilanciere'],
    ['Barbell_Bench_Press_-_Medium_Grip', 'Panca piana bilanciere'],
    ['Seated_Dumbbell_Press', 'Lento manubri'],
    ['Seated_Cable_Rows', 'Pulley basso'],
    ['Cable_Crossover', 'Croci ai cavi'],
    ['Plank', 'Plank'],
    ['Romanian_Deadlift', 'Stacco rumeno'],
    ['Pullups', 'Trazioni'],
    ['Bent_Over_Barbell_Row', 'Rematore bilanciere'],
    ['Incline_Dumbbell_Press', 'Panca inclinata manubri'],
    ['Dumbbell_Bicep_Curl', 'Curl manubri'],
    ['Pallof_Press', 'Pallof press'],
    ['Split_Squat_with_Dumbbells', 'Affondi bulgari / split squat'],
    ['Barbell_Hip_Thrust', 'Hip thrust'],
    ['Close-Grip_Front_Lat_Pulldown', 'Lat machine presa stretta'],
    ['Leverage_Chest_Press', 'Chest press'],
    ['Face_Pull', 'Face pull'],
    ['Triceps_Pushdown', 'Pushdown tricipiti'],
    ['Leg_Press', 'Leg press'],
    ['Wide-Grip_Lat_Pulldown', 'Lat machine presa larga'],
    ['Dumbbell_Lunges', 'Affondi manubri'],
    ['Barbell_Deadlift', 'Stacco da terra'],
    ['Leg_Extensions', 'Leg extension'],
    ['Lying_Leg_Curls', 'Leg curl'],
    ['Standing_Calf_Raises', 'Calf raise'],
    ['Side_Lateral_Raise', 'Alzate laterali'],
    ['Dumbbell_Bench_Press', 'Panca piana manubri'],
    ['Hanging_Leg_Raise', 'Leg raise alla sbarra'],
    ['Dead_Bug', 'Dead bug'],
    ['Stiff-Legged_Dumbbell_Deadlift', 'Stacco rumeno manubri'],
    ['V-Bar_Pulldown', 'Lat machine presa neutra'],
    ['One-Arm_Dumbbell_Row', 'Rematore manubrio su panca']
  ].map(([id, label]) => ({ id, label }));

  // kind: main = fondamentale, sec = secondario, acc = complementare
  // mode: weight (kg x ripetizioni) | time (secondi, senza peso)
  const ex = (id, name, img, kind, sets, min, max, rest, inc, extra = {}) =>
    Object.assign({ id, name, img, kind, sets, min, max, rest, inc, mode: 'weight', legs: false, perSide: false }, extra);

  // Esercizi introdotti con la versione 2 della scheda (sostituiscono stacco bilanciere, trazioni, rematore bilanciere, hip thrust)
  const NEW = {
    rdlman: ex('rdlman', 'Stacco rumeno manubri', 'Stiff-Legged_Dumbbell_Deadlift', 'sec', 4, 8, 10, 120, 2, { legs: true }),
    latneutra: ex('latneutra', 'Lat machine presa neutra', 'V-Bar_Pulldown', 'sec', 4, 8, 10, 120, 2.5),
    remapanca: ex('remapanca', 'Rematore manubrio su panca piana', 'One-Arm_Dumbbell_Row', 'sec', 3, 8, 10, 90, 2, { perSide: true }),
    legcurl: ex('legcurl', 'Leg curl', 'Lying_Leg_Curls', 'sec', 3, 10, 12, 90, 2.5, { legs: true })
  };
  const REPLACE_V2 = { rdl: NEW.rdlman, trazioni: NEW.latneutra, rematore: NEW.remapanca, hipthrust: NEW.legcurl };

  const DEFAULT_PROGRAM = {
    block: 'base',
    sessions: [
      {
        id: 'A', name: 'Spinta + squat', legsHeavy: true,
        exercises: [
          ex('squat', 'Squat', 'Barbell_Squat', 'main', 4, 6, 8, 150, 2.5, { legs: true }),
          ex('panca', 'Panca piana', 'Barbell_Bench_Press_-_Medium_Grip', 'main', 4, 6, 8, 150, 2.5),
          ex('lento', 'Lento manubri', 'Seated_Dumbbell_Press', 'sec', 3, 8, 10, 90, 2),
          ex('pulley', 'Pulley basso', 'Seated_Cable_Rows', 'acc', 3, 10, 12, 90, 2.5),
          ex('croci', 'Croci ai cavi', 'Cable_Crossover', 'acc', 3, 10, 12, 60, 2.5),
          ex('plank', 'Plank', 'Plank', 'acc', 3, 45, 60, 60, 0, { mode: 'time' })
        ]
      },
      {
        id: 'B', name: 'Tirata + stacco manubri', legsHeavy: false,
        exercises: [
          NEW.rdlman,
          NEW.latneutra,
          NEW.remapanca,
          ex('inclinata', 'Panca inclinata manubri', 'Incline_Dumbbell_Press', 'sec', 3, 8, 10, 90, 2),
          ex('curl', 'Curl manubri', 'Dumbbell_Bicep_Curl', 'acc', 3, 10, 12, 60, 2),
          ex('pallof', 'Pallof press', 'Pallof_Press', 'acc', 3, 10, 12, 60, 2.5, { perSide: true })
        ]
      },
      {
        id: 'C', name: 'Unilaterale + complementari', legsHeavy: true,
        exercises: [
          ex('bulgari', 'Affondi bulgari', 'Split_Squat_with_Dumbbells', 'sec', 3, 8, 10, 90, 2, { legs: true, perSide: true }),
          NEW.legcurl,
          ex('latstretta', 'Lat machine presa stretta', 'Close-Grip_Front_Lat_Pulldown', 'acc', 3, 10, 12, 90, 2.5),
          ex('chestpress', 'Chest press', 'Leverage_Chest_Press', 'acc', 3, 10, 12, 90, 2.5),
          ex('facepull', 'Face pull', 'Face_Pull', 'acc', 3, 12, 15, 60, 2.5),
          ex('pushdown', 'Pushdown tricipiti', 'Triceps_Pushdown', 'acc', 3, 10, 12, 60, 2.5)
        ]
      }
    ]
  };

  // Parametri per tipo di esercizio in ogni blocco: [serie, rip. min, rip. max, recupero s]
  const BLOCKS = {
    base: {
      label: 'Ricondizionamento', desc: 'Tonificazione generale, sforzo controllato senza cedimento. Durata consigliata 4-6 settimane.',
      main: [4, 6, 8, 150], sec: [3, 8, 10, 90], acc: [3, 10, 12, 60]
    },
    forza: {
      label: 'Forza', desc: 'Carichi alti e poche ripetizioni sui fondamentali, recuperi lunghi.',
      main: [5, 4, 6, 180], sec: [3, 6, 8, 120], acc: [3, 8, 12, 60]
    },
    ipertrofia: {
      label: 'Ipertrofia', desc: 'Più volume e ripetizioni medie per la massa muscolare.',
      main: [4, 8, 10, 120], sec: [4, 8, 12, 90], acc: [3, 12, 15, 60]
    },
    ciclismo: {
      label: 'Supporto ciclismo', desc: 'Fondamentali pesanti ma con poco volume, più lavoro unilaterale sulle gambe: forza senza svuotare le gambe per la bici.',
      main: [3, 5, 6, 180], sec: [3, 8, 10, 90], acc: [3, 10, 12, 60], legsSecSets: 4
    }
  };

  root.GymData = { IMG_LIB, DEFAULT_PROGRAM, BLOCKS, REPLACE_V2 };
  if (typeof module !== 'undefined') module.exports = root.GymData;
})(typeof window !== 'undefined' ? window : globalThis);
