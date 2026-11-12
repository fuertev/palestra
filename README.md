# Palestra – diario di allenamento

PWA offline con scheda dinamica. Tutti i dati restano sul telefono (IndexedDB); backup con export/import JSON.

## Pubblicare su GitHub Pages
1. Crea un repository pubblico su github.com (es. `palestra`).
2. "Add file" → "Upload files": trascina **il contenuto** di questa cartella (non la cartella stessa) e conferma.
3. Settings → Pages → Source: "Deploy from a branch", branch `main`, cartella `/ (root)` → Save.
4. Dopo un minuto l'app è su `https://<tuo-utente>.github.io/palestra/`.
5. Sull'iPhone aprila con Safari → Condividi → "Aggiungi alla schermata Home".

## Aggiornare l'app
Dopo aver modificato i file, cambia `VERSION` in `sw.js` (es. `palestra-v2`), così il telefono scarica la nuova versione.

## Crediti
Immagini degli esercizi: Free Exercise DB (github.com/yuhonas/free-exercise-db), dominio pubblico (Unlicense).
