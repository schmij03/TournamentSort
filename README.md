# Tournamentsort

Digitales Legeschema für den Tournamentsort (Turniersortieren), gemacht für das iPad.
Schülerinnen und Schüler erfassen Instagram- oder TikTok-Profile und sortieren sie danach
Schritt für Schritt nach dem Tournamentsort-Algorithmus (mehr Follower gewinnt).

## Funktionen

- **Profile erfassen:** Benutzername oder Profil-Link, Follower-Zahl so wie in der App
  (z. B. «1,2 Mio.», «45.3K», «12'400»), optional ein Profilbild aus Foto oder Screenshot (mit Zuschneiden).
- **Mehrere Profile auf einmal einfügen** (eine Zeile pro Profil).
- **Als Link teilen:** Die Lehrperson kann ein Set vorbereiten und als Link verteilen (ohne Bilder).
- **Turnier:** Karten per Ziehen oder Antippen bewegen. Falsche Züge werden erklärt und gezählt.
  Tipp, Schritt zeigen, automatischer Ablauf, Rückgängig und Protokoll aller Zweikämpfe.
- Alles läuft im Browser. Die Daten bleiben lokal auf dem Gerät (localStorage).

Hinweis: Follower-Zahlen können nicht automatisch von Instagram oder TikTok abgerufen werden
(dafür braucht es ein Login). Deshalb werden sie abgeschrieben. Der Knopf «Bild aus dem Internet laden»
verwendet den externen Dienst unavatar.io und funktioniert nicht bei jedem Profil.

## Veröffentlichen mit GitHub Pages

1. Branch in `main` mergen.
2. Im Repository: **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   Branch `main`, Ordner `/ (root)`, speichern.
3. Nach ca. einer Minute ist die Seite unter `https://<benutzer>.github.io/<repo>/` erreichbar.

Tipp fürs iPad: In Safari über «Teilen → Zum Home-Bildschirm» wie eine App speichern.
