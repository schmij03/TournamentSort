# Tournamentsort

Digitales Legeschema für den Tournamentsort (Turniersortieren), gemacht für das iPad.
Schülerinnen und Schüler erfassen Instagram- oder TikTok-Profile und sortieren sie danach
Schritt für Schritt nach dem Tournamentsort-Algorithmus (mehr Follower gewinnt).

## Funktionen

- **Beliebte Accounts laden:** rund 50 bekannte TikTok-Accounts mit Follower-Zahl, Anzahl Beiträge und Profilbild.
  Eine GitHub Action (`.github/workflows/update-accounts.yml`) aktualisiert sie jeden Montag automatisch.
  Die Liste steht in `data/accounts-list.txt`. Dort können Accounts ergänzt werden, bei Bedarf mit Werten von Hand
  (`instagram name 1234 56`) und eigenem Bild unter `img/accounts/<plattform>_<name>.jpg`.
  Instagram blockiert den automatischen Abruf von den GitHub-Servern aus, deshalb TikTok.
- **Turniergrösse:** 2 bis 32 Karten (Baum mit 8, 16 oder 32 Startplätzen).
- **Sortieren** nach Follower oder Beiträgen, grösste oder kleinste zuerst.
- **Profile erfassen:** Benutzername oder Profil-Link, Follower-Zahl so wie in der App
  (z. B. «1,2 Mio.», «45.3K», «12'400»), optional ein Profilbild aus Foto oder Screenshot (mit Zuschneiden).
- **Mehrere Profile auf einmal einfügen** (eine Zeile pro Profil).
- **Als Link teilen:** Die Lehrperson kann ein Set vorbereiten und als Link verteilen (ohne Bilder).
- **Turnier:** Karten per Ziehen oder Antippen bewegen. Falsche Züge werden erklärt und gezählt.
  Die Karte zuoberst wird automatisch in die Rangliste eingeordnet. Tipp, Schritt zeigen, automatischer Ablauf, Rückgängig und Protokoll aller Zweikämpfe.
- Alles läuft im Browser. Die Daten bleiben lokal auf dem Gerät (localStorage).

Hinweis: Eigene Profile erfassen die Schülerinnen und Schüler von Hand. Der Knopf «Bild aus dem Internet laden»
verwendet den externen Dienst unavatar.io und funktioniert nicht bei jedem Profil.

## Veröffentlichen mit GitHub Pages

1. Branch in `main` mergen.
2. Im Repository: **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   Branch `main`, Ordner `/ (root)`, speichern.
3. Nach ca. einer Minute ist die Seite unter `https://<benutzer>.github.io/<repo>/` erreichbar.

Tipp fürs iPad: In Safari über «Teilen → Zum Home-Bildschirm» wie eine App speichern.
