# NBA-Daten auf dem Windows-PC aktualisieren

Die NBA sperrt Cloud-Server, deshalb laufen die NBA-Daten nur auf einem normalen PC. Nötig einmal pro Jahr, nach den Finals (Juni). Git oder Programmierkenntnisse braucht es nicht.

> **Neu seit November 2026: Playoffs.** Das Skript lädt jetzt auch die Playoff-Werte. Beim ersten Lauf danach werden deshalb alle Spieler neu abgefragt – das dauert etwas länger als bisher (rechne mit einer ganzen Nacht). Bis dieser Lauf hochgeladen ist, ist im Spiel der Schalter «Mit Playoffs» grau.

## 1. Python installieren (einmalig)

1. Auf [python.org/downloads](https://www.python.org/downloads/) den gelben Knopf «Download Python» klicken und die Datei öffnen.
2. **Unten im ersten Fenster «Add python.exe to PATH» anhaken**, dann «Install Now».

## 2. Projekt herunterladen

1. Auf GitHub das Repo **TotalGuesser** öffnen (eingeloggt).
2. Grüner Knopf **«Code» → «Download ZIP»**.
3. Die ZIP-Datei mit Rechtsklick → «Alle extrahieren» z. B. in `Dokumente` entpacken.

Für ein späteres Update immer zuerst eine frische ZIP-Datei holen, damit die Skripte aktuell sind.

## 3. Daten laden

1. Im entpackten Ordner `scripts` öffnen und **`nba_windows.bat` doppelklicken**.
   - Meldet Windows «Der Computer wurde durch Windows geschützt»: «Weitere Informationen» → «Trotzdem ausführen».
2. Ein schwarzes Fenster zeigt den Fortschritt (`[123/5000] Spielername`). Alle Spieler zu laden dauert **mehrere Stunden** – am besten abends starten und über Nacht laufen lassen.
   - Damit der PC nicht einschläft: Einstellungen → System → Energie → «Bildschirm und Energiesparmodus» → Energiesparmodus auf «Nie» (danach wieder zurückstellen).
3. Bricht der Lauf ab (Internet weg, PC neu gestartet): einfach nochmals doppelklicken. Was schon geladen ist, wird nicht nochmals abgefragt.
4. Am Ende steht «Fertig». Fenster mit einer Taste schliessen.

## 4. Zu GitHub hochladen

1. Auf GitHub im Repo in den Ordner **`web/public/data/nba`** klicken.
2. Oben rechts **«Add file» → «Upload files»**.
3. Im Windows-Explorer den Ordner `web\public\data\nba` öffnen und **`meta.json` und den Ordner `teams`** zusammen ins Browserfenster ziehen.
4. Unten **«Create a new branch for this commit and start a pull request»** wählen, «Propose changes», dann «Create pull request».
5. Claude kann den Pull Request prüfen; danach «Merge» – nach ein paar Minuten ist das Spiel aktuell.

## 5. Kurz prüfen

1. Das Spiel öffnen, «Basketball (NBA)» wählen und «Mehr Optionen» aufklappen.
2. Unter **«Playoffs»** sollte «Mit Playoffs» jetzt anklickbar sein (nicht mehr grau).
3. Ist es noch grau: Seite neu laden. Bleibt es grau, hat der Lauf keine Playoff-Werte geschrieben – Claude das schwarze Fenster (oder einen Screenshot davon) zeigen.
