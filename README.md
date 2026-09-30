# Tournamentsort

Digitales Legeschema für den Tournamentsort (Turniersortieren), gemacht für das iPad.
Schülerinnen und Schüler erfassen Instagram- oder TikTok-Profile und sortieren sie danach
Schritt für Schritt nach dem Tournamentsort-Algorithmus (mehr Follower gewinnt).

## Funktionen

- **Accounts wählen:** Die Startseite zeigt rund 50 beliebte TikTok-Accounts mit Profilbild, Follower-Zahl und Anzahl Beiträge.
  Antippen wählt einen Account aus (2 bis 32), oder «🎲 Zufällig 8 / 16 / 32».
- **Automatisch aktuell:** Die GitHub Action `.github/workflows/update-accounts.yml` holt die Zahlen und Bilder jeden Montag neu.
  Die Liste steht in `data/accounts-list.txt`. Accounts, die nicht gefunden werden, erscheinen nicht auf der Seite.
  Instagram blockiert den automatischen Abruf, deshalb TikTok.
- **Turnier:** Baum mit 8, 16 oder 32 Startplätzen. Sortieren nach Follower oder Beiträgen, grösste oder kleinste zuerst.
  Karten per Ziehen oder Antippen bewegen, falsche Züge werden erklärt und gezählt.
  Die Karte zuoberst wird automatisch in die Rangliste eingeordnet.
  Tipp, Schritt zeigen, automatischer Ablauf, Rückgängig und Protokoll aller Zweikämpfe.
- Alles läuft im Browser, ohne Login. Die Auswahl bleibt auf dem Gerät gespeichert.

## Veröffentlichen mit GitHub Pages

1. Branch in `main` mergen.
2. Im Repository: **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   Branch `main`, Ordner `/ (root)`, speichern.
3. Nach ca. einer Minute ist die Seite unter `https://<benutzer>.github.io/<repo>/` erreichbar.

Tipp fürs iPad: In Safari über «Teilen → Zum Home-Bildschirm» wie eine App speichern.
