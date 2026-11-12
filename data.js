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
    ['One-Arm_Dumbbell_Row', 'Rematore manubrio su panca'],
    ['Hack_Squat', 'Hack squat'],
    ['Hyperextensions_Back_Extensions', 'Iperestensioni 45°'],
    ['Pull_Through', 'Pull-through ai cavi'],
    ['Thigh_Abductor', 'Abduttori alla macchina'],
    ['One-Legged_Cable_Kickback', 'Kickback ai cavi'],
    ['Seated_Calf_Raise', 'Calf raise seduto'],
    ['Cable_Seated_Lateral_Raise', 'Alzate laterali ai cavi']
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

  // Versione 3: squat e panca senza bilanciere, più glutei, esercizi opzionali ("se ho tempo")
  const opt = { optional: true };
  const V3 = {
    legpress: ex('legpress', 'Leg press', 'Leg_Press', 'main', 4, 8, 10, 150, 5, { legs: true }),
    pancaman: ex('pancaman', 'Panca piana manubri', 'Dumbbell_Bench_Press', 'main', 4, 6, 8, 150, 2),
    iper: ex('iper', 'Iperestensioni 45° (glutei)', 'Hyperextensions_Back_Extensions', 'sec', 3, 10, 12, 90, 2.5, { legs: true }),
    alzate: ex('alzate', 'Alzate laterali', 'Side_Lateral_Raise', 'acc', 3, 12, 15, 60, 1, opt),
    calf: ex('calf', 'Calf raise in piedi', 'Standing_Calf_Raises', 'acc', 3, 12, 15, 60, 5, opt),
    pullthrough: ex('pullthrough', 'Pull-through ai cavi (glutei)', 'Pull_Through', 'acc', 3, 12, 15, 60, 2.5, Object.assign({ legs: true }, opt)),
    abduttori: ex('abduttori', 'Abduttori alla macchina (glutei)', 'Thigh_Abductor', 'acc', 3, 15, 20, 60, 5, opt),
    calfseduto: ex('calfseduto', 'Calf raise seduto', 'Seated_Calf_Raise', 'acc', 3, 12, 15, 60, 5, opt),
    alzatecavi: ex('alzatecavi', 'Alzate laterali ai cavi', 'Cable_Seated_Lateral_Raise', 'acc', 3, 12, 15, 60, 1, Object.assign({ perSide: true }, opt))
  };
  // Istruzioni per aggiornare una scheda già salvata alla versione 3
  const MIGRATE_V3 = {
    replace: { squat: V3.legpress, panca: V3.pancaman },
    insertAfter: { C: [['legcurl', V3.iper]] },
    append: { A: [V3.alzate, V3.calf], B: [V3.pullthrough, V3.abduttori], C: [V3.calfseduto, V3.alzatecavi] },
    makeOptional: ['pushdown'],
    rename: { A: ['Spinta + squat', 'Spinta + gambe'] }
  };

  const DEFAULT_PROGRAM = {
    block: 'base',
    sessions: [
      {
        id: 'A', name: 'Spinta + gambe', legsHeavy: true,
        exercises: [
          V3.legpress,
          V3.pancaman,
          ex('lento', 'Lento manubri', 'Seated_Dumbbell_Press', 'sec', 3, 8, 10, 90, 2),
          ex('pulley', 'Pulley basso', 'Seated_Cable_Rows', 'acc', 3, 10, 12, 90, 2.5),
          ex('croci', 'Croci ai cavi', 'Cable_Crossover', 'acc', 3, 10, 12, 60, 2.5),
          ex('plank', 'Plank', 'Plank', 'acc', 3, 45, 60, 60, 0, { mode: 'time' }),
          V3.alzate,
          V3.calf
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
          ex('pallof', 'Pallof press', 'Pallof_Press', 'acc', 3, 10, 12, 60, 2.5, { perSide: true }),
          V3.pullthrough,
          V3.abduttori
        ]
      },
      {
        id: 'C', name: 'Unilaterale + complementari', legsHeavy: true,
        exercises: [
          ex('bulgari', 'Affondi bulgari', 'Split_Squat_with_Dumbbells', 'sec', 3, 8, 10, 90, 2, { legs: true, perSide: true }),
          NEW.legcurl,
          V3.iper,
          ex('latstretta', 'Lat machine presa stretta', 'Close-Grip_Front_Lat_Pulldown', 'acc', 3, 10, 12, 90, 2.5),
          ex('chestpress', 'Chest press', 'Leverage_Chest_Press', 'acc', 3, 10, 12, 90, 2.5),
          ex('facepull', 'Face pull', 'Face_Pull', 'acc', 3, 12, 15, 60, 2.5),
          ex('pushdown', 'Pushdown tricipiti', 'Triceps_Pushdown', 'acc', 3, 10, 12, 60, 2.5, opt),
          V3.calfseduto,
          V3.alzatecavi
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

  root.GymData = { IMG_LIB, DEFAULT_PROGRAM, BLOCKS, REPLACE_V2, MIGRATE_V3 };
  if (typeof module !== 'undefined') module.exports = root.GymData;
})(typeof window !== 'undefined' ? window : globalThis);
