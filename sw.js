/* Service worker: tutto in cache per l'uso offline. Cambia VERSION a ogni aggiornamento. */
const VERSION = 'palestra-v3';
const FILES = [
  './',
  'index.html',
  'style.css',
  'data.js',
  'logic.js',
  'app.js',
  'manifest.webmanifest',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'img/Barbell_Bench_Press_-_Medium_Grip/0.jpg',
  'img/Barbell_Bench_Press_-_Medium_Grip/1.jpg',
  'img/Barbell_Deadlift/0.jpg',
  'img/Barbell_Deadlift/1.jpg',
  'img/Barbell_Hip_Thrust/0.jpg',
  'img/Barbell_Hip_Thrust/1.jpg',
  'img/Barbell_Squat/0.jpg',
  'img/Barbell_Squat/1.jpg',
  'img/Bent_Over_Barbell_Row/0.jpg',
  'img/Bent_Over_Barbell_Row/1.jpg',
  'img/Cable_Crossover/0.jpg',
  'img/Cable_Crossover/1.jpg',
  'img/Cable_Seated_Lateral_Raise/0.jpg',
  'img/Cable_Seated_Lateral_Raise/1.jpg',
  'img/Close-Grip_Front_Lat_Pulldown/0.jpg',
  'img/Close-Grip_Front_Lat_Pulldown/1.jpg',
  'img/Dead_Bug/0.jpg',
  'img/Dead_Bug/1.jpg',
  'img/Dumbbell_Bench_Press/0.jpg',
  'img/Dumbbell_Bench_Press/1.jpg',
  'img/Dumbbell_Bicep_Curl/0.jpg',
  'img/Dumbbell_Bicep_Curl/1.jpg',
  'img/Dumbbell_Lunges/0.jpg',
  'img/Dumbbell_Lunges/1.jpg',
  'img/Face_Pull/0.jpg',
  'img/Face_Pull/1.jpg',
  'img/Hack_Squat/0.jpg',
  'img/Hack_Squat/1.jpg',
  'img/Hanging_Leg_Raise/0.jpg',
  'img/Hanging_Leg_Raise/1.jpg',
  'img/Hyperextensions_Back_Extensions/0.jpg',
  'img/Hyperextensions_Back_Extensions/1.jpg',
  'img/Incline_Dumbbell_Press/0.jpg',
  'img/Incline_Dumbbell_Press/1.jpg',
  'img/Leg_Extensions/0.jpg',
  'img/Leg_Extensions/1.jpg',
  'img/Leg_Press/0.jpg',
  'img/Leg_Press/1.jpg',
  'img/Leverage_Chest_Press/0.jpg',
  'img/Leverage_Chest_Press/1.jpg',
  'img/Lying_Leg_Curls/0.jpg',
  'img/Lying_Leg_Curls/1.jpg',
  'img/One-Arm_Dumbbell_Row/0.jpg',
  'img/One-Arm_Dumbbell_Row/1.jpg',
  'img/One-Legged_Cable_Kickback/0.jpg',
  'img/One-Legged_Cable_Kickback/1.jpg',
  'img/Pallof_Press/0.jpg',
  'img/Pallof_Press/1.jpg',
  'img/Plank/0.jpg',
  'img/Plank/1.jpg',
  'img/Pull_Through/0.jpg',
  'img/Pull_Through/1.jpg',
  'img/Pullups/0.jpg',
  'img/Pullups/1.jpg',
  'img/Romanian_Deadlift/0.jpg',
  'img/Romanian_Deadlift/1.jpg',
  'img/Seated_Cable_Rows/0.jpg',
  'img/Seated_Cable_Rows/1.jpg',
  'img/Seated_Calf_Raise/0.jpg',
  'img/Seated_Calf_Raise/1.jpg',
  'img/Seated_Dumbbell_Press/0.jpg',
  'img/Seated_Dumbbell_Press/1.jpg',
  'img/Side_Lateral_Raise/0.jpg',
  'img/Side_Lateral_Raise/1.jpg',
  'img/Split_Squat_with_Dumbbells/0.jpg',
  'img/Split_Squat_with_Dumbbells/1.jpg',
  'img/Standing_Calf_Raises/0.jpg',
  'img/Standing_Calf_Raises/1.jpg',
  'img/Stiff-Legged_Dumbbell_Deadlift/0.jpg',
  'img/Stiff-Legged_Dumbbell_Deadlift/1.jpg',
  'img/Thigh_Abductor/0.jpg',
  'img/Thigh_Abductor/1.jpg',
  'img/Triceps_Pushdown/0.jpg',
  'img/Triceps_Pushdown/1.jpg',
  'img/V-Bar_Pulldown/0.jpg',
  'img/V-Bar_Pulldown/1.jpg',
  'img/Wide-Grip_Lat_Pulldown/0.jpg',
  'img/Wide-Grip_Lat_Pulldown/1.jpg',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match('index.html')))
  );
});
