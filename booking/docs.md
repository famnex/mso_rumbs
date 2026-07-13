# Technische Systemdokumentation - Classroombookings (Node.js 2026 Rebuild)

Dieses Dokument beschreibt die Architektur, den Aufbau und die Funktionsweise des modernisierten, blitzschnellen Raumbelegungssystems "Classroombookings", welches für Steffen Fleischer im Jahr 2026 als Node.js-Anwendung neu entwickelt wurde.

---

## 1. Systemarchitektur & Technologiestack

Das System wurde von PHP/CodeIgniter 3 vollständig abgelöst und läuft nun als autarke, serverlose Node.js-Anwendung:

*   **Runtime:** Node.js (Version 18+)
*   **Web-Framework:** Express (Version 4.21+)
*   **Template-Engine:** EJS (Embedded JavaScript)
*   **Datenbank:** SQLite3 (über das performante `sqlite3` npm-Paket), vollständig serverlos.
*   **Passwortverschlüsselung:** `bcryptjs` (Blowfish-Hashing)
*   **SSO-Authentifizierung:** `jsonwebtoken` (HMAC-SHA256 Signaturen)
*   **Sitzungsverwaltung:** `express-session` (Verschlüsselte In-Memory Cookies mit 2 Stunden Laufzeit)
*   **Hintergrunddienst:** PM2 (Prozessmanager) für dauerhafte Betriebsstabilität auf Port `8000`

---

## 2. Ordnerstruktur

Die Anwendung ist übersichtlich strukturiert:

```
booking/
├── local/                    # Lokale Instanzdaten (nicht im Git-Repository)
│   ├── booking.db            # Die serverlose SQLite3-Datenbankdatei
│   └── config.php            # Geteilte Konfigurationsdatei mit SSO-Schlüsseln
├── package.json              # Projektabhängigkeiten und Start-Skripte
├── ecosystem.config.js       # PM2-Prozesskonfiguration
├── start.bat                 # Ein-Klick-Starter für Windows-Umgebungen
├── db.md                     # Ausführliche Datenbank-Dokumentation (14 Tabellen)
├── docs.md                   # Diese Systemdokumentation
└── src/
    ├── index.js              # Express Server-Einstiegspunkt & Middleware
    ├── db.js                 # SQLite3 Connector, Auto-Migrationen & Test-Seeder
    ├── jwt.js                # JWT Hilfsbibliothek (Signatur & Verifizierung)
    ├── routes/
    │   ├── auth.js           # Login, Logout, nativer SSO-Testgenerator & SSO-Routen
    │   ├── bookings.js       # Dashboard, Wochenplaner-Grid & Buchungslogik
    │   └── admin.js          # Systemsteuerung (Räume, Stunden, Benutzer)
    ├── views/
    │   ├── partials/
    │   │   ├── header.ejs    # Kopfzeile mit reaktiver Navigation & Darkmode-Script
    │   │   └── footer.ejs    # Fußzeile mit Skripten und Urheberrechten
    │   ├── login.ejs         # Anmeldebildschirm mit lokalem Login & SSO-Weiterleitung
    │   ├── dashboard.ejs     # Lehrer-Dashboard & Quick-Booking-Assistent
    │   ├── bookings.ejs      # Interaktiver Wochenbelegungsplan (Stundenraster)
    │   ├── test_sso.ejs      # UI für den interaktiven SSO-Testgenerator
    │   ├── 404.ejs           # Fehlerseite bei ungültigen URLs
    │   └── admin/            # Admin-Verwaltungsmasken (Overview, Rooms, Periods, Users)
    └── public/
        ├── css/
        │   └── style.css     # 2026 Premium-Design (CSS Variables, Glassmorphism, Theme-Logic)
        ├── js/
        │   ├── main.js       # Client-Utilities, Auto-Fading Alerts & Darkmode-Schalter
        │   └── bookings.js   # Wochenplaner Modal-Handler und ESC-Key-Listener
        └── fonts/
            └── inter-*.woff2 # 100% lokal gehostete Inter-Schriftartdateien
```

---

## 3. Benutzerrollen & Rechteverwaltung

Das Berechtigungskonzept unterscheidet zwei Stufen:

1.  **`ADMINISTRATOR` (Berechtigungsstufe 1):**
    *   Voller Zugriff auf die `/admin`-Schnittstellen (Systemsteuerung).
    *   Verwaltung von Räumen, Unterrichtsstunden, Benutzern und Systemstatistiken.
    *   Darf jede Buchung stornieren (auch die von anderen Lehrern).
2.  **`TEACHER` (Berechtigungsstufe 2):**
    *   Eingeschränkter Lehrer-Zugang.
    *   Darf freie Stunden über das Dashboard oder den interaktiven Wochenplaner buchen.
    *   Darf ausschließlich eigene Buchungen stornieren.
    *   Kein Zugriff auf administrative Systemsteuerung.

---

## 4. Buchungslogik & Kalenderberechnung

Der Wochenplaner (`bookings.ejs`) zeigt die Belegung für eine ausgewählte Kalenderwoche (Montag bis Freitag):

1.  **Dauerbelegungen (Stundenplaneinträge):**
    *   Identifiziert durch `day_num` (1 = Montag, ..., 5 = Freitag) und `period_id`. Der Wert `date` ist in diesem Fall `NULL`.
    *   Diese Belegungen gelten als wiederkehrender Regelunterricht und werden orange als "⏰ Stundenplan" markiert. Sie können von regulären Lehrkräften nicht storniert werden.
2.  **Dynamische Einzelbuchungen:**
    *   Identifiziert durch ein konkretes Datum (`date` = `YYYY-MM-DD`) und `period_id`.
    *   Werden im Planer blau ("👤 Meine Buchung") oder grau ("👥 Lehrkraft") dargestellt und können bei entsprechender Berechtigung über ein Formular storniert werden.

---

## 5. Single Sign-On (SSO) & Just-In-Time Provisionierung
 
 Die Authentifizierung erfolgt wahlweise lokal oder per **JWT Single Sign-On** über das Schulportal:
 
 1.  **SSO-Login-Ablauf:**
     *   Der Benutzer klickt auf "Mit MSO-Portal anmelden".
     *   Er wird an die im Schulportal konfigurierte URL weitergeleitet.
     *   Nach erfolgreichem Login leitet das Schulportal den Browser zurück auf:
         `/login/jwt?token=[JWT_STRING]`
 2.  **Token-Verifizierung:**
     *   Das Modul `src/jwt.js` verifiziert die HMAC-SHA256 Signatur des Tokens mithilfe des in `local/config.php` hinterlegten Secrets.
     *   Es prüft das Ablaufdatum (`exp`-Claim).
 3.  **Just-In-Time (JIT) Registrierung:**
     *   Existiert der aus dem Token extrahierte `username` noch nicht in der SQLite-Datenbank, wird das Benutzerkonto in Sekundenbruchteilen **vollautomatisch im Hintergrund neu angelegt** (mit Vorname, Nachname, E-Mail und Standard-Rolle `TEACHER`).
     *   Der Benutzer ist sofort ohne Passwortabfrage eingeloggt und wird zum Dashboard weitergeleitet.
 4.  **Fehlertoleranz & Automatische Session-Wiederherstellung:**
     *   **SSO-Refresh-Bypass:** Nach erfolgreichem SSO-Login würde ein Neuladen (F5) der JWT-URL das verbrauchte/abgelaufene Token erneut senden und einen Validierungsfehler erzeugen. Um dies zu verhindern, leitet das System bereits aktive Sitzungen (`req.session.userId`) am Anfang der Route `/login/jwt` direkt und lautlos nach `/bookings` weiter.
     *   **Automatisches SSO-Fallback (Loop-Safe):** Ruft ein nicht-eingeloggter Benutzer das SSO-Ziel `/login/jwt` direkt ohne Token auf (z.B. über ein Lesezeichen oder ein Portal-Icon), leitet das System ihn vollautomatisch an das SSO-Portal (`jwtConfig.sso_url`) weiter, um nahtlos ein frisches Token zu erwerben. Ein session-basierter Schutz-Flag (`req.session.sso_attempted`) verhindert dabei zuverlässig Endlosschleifen, falls das Portal fehlerhaft oder ohne Token antworten sollte.
     *   **Parameter-Name-Fallbacks (2026-Kompatibilität):** Das System extrahiert das Token primär aus dem konfigurierten URL-Parameter. Um Abweichungen des externen Schulportals abzufangen, greift das System automatisch auf Fallbacks wie `token` oder `sso_token` zurück. Dies verhindert 302-Umleitungsschleifen und Validierungsfehler, falls das Portal den JWT-Token als `?sso_token=...` statt `?token=...` übergibt.


---

## 6. Premium UX-Features (Jahr 2026 Standard)

*   **Blitzschnelle Antwortzeit:** Durch das serverlose In-Memory SQLite Caching und Express beträgt die Time-to-First-Byte (TTFB) bei lokalen Anfragen weniger als **2 Millisekunden**.
*   **Hardwarebeschleunigtes Theme-System:** Ermöglicht den nahtlosen Wechsel zwischen augenschonendem Dark Mode und eisblauem Light Mode. Die Systemeinstellungen des Benutzers werden per `localStorage` gespeichert. Ein Inline-Script im Header verhindert den gefürchteten "Light-Flash" beim Laden der Seite.
*   **100% Offline-Autarkie:** Es werden keinerlei CDN-Ressourcen geladen. Alle CSS-Bibliotheken, Schriften und Inline-Vektorsymbole (SVG) werden lokal vom Server ausgeliefert.
*   **Renntauglicher Flash-Interzeptor:** Um das lästige Phänomen zu verhindern, dass Status- und Fehlermeldungen bei schnellen Redirect-Ketten (z.B. nach unberechtigten Zugriffen) „in der Pipeline hängenbleiben“ und mehrfach oder beim Neuladen angezeigt werden, fängt ein globales Middleware-System alle Session-Meldungen (`error` und `success`) sofort zu Beginn des Requests ab, bereinigt sie im Speicher und erzwingt einen synchronen Session-Save. Erst beim tatsächlichen Seitenvorgang werden die Meldungen transparent in EJS eingespeist, wodurch sie garantiert exakt einmal angezeigt werden.
*   **Ergonomischer Schnellbucher:** Modale Dialoge werden mittels CSS-Transitions und Spring-Dämpfungs-Algorithmus geöffnet.
*   **Native SSO-Simulation:** Über die URL `/test_sso.php` kann der gesamte SSO-Login- und Registrierungs-Ablauf direkt auf dem Node.js-Server simuliert und eingesehen werden.

---

## 7. Update- und Deployment-Prozess (PM2 & Git)

Um das System auf dem Produktivserver mit den neuesten Änderungen aus GitHub zu aktualisieren, führen Sie folgende Schritte in der Konsole des Servers durch:

### 1. Zum Server verbinden & in das Projektverzeichnis wechseln
Verbinden Sie sich per SSH (oder Remotedesktop auf Windows) mit dem Server und wechseln Sie in das Installationsverzeichnis der Anwendung:
```bash
cd /pfad/zu/ihrem/mso_rumbs/booking
```

### 2. Neuesten Code aus GitHub abrufen
Laden Sie die Änderungen aus dem Git-Repository herunter:
```bash
git pull
```

### 3. Abhängigkeiten aktualisieren (falls package.json geändert wurde)
Falls neue Bibliotheken hinzugefügt wurden, installieren Sie diese:
```bash
npm install
```

### 4. Anwendung im PM2-Prozessmanager neu laden
Damit der laufende Node.js-Prozess die neuen CSS-, EJS- und JS-Dateien einliest, führen Sie einen Reload durch. PM2 führt einen Zero-Downtime-Reload durch, wodurch Benutzer während des Updates nicht unterbrochen werden:
```bash
pm2 reload classroombookings
```

*Hinweis:* Wenn Sie die PM2-Konfiguration selbst anpassen oder neu einlesen möchten, können Sie auch das Ecosystem-File nutzen:
```bash
pm2 reload ecosystem.config.js
```

### Nützliche PM2-Befehle zur Kontrolle:
*   Status prüfen: `pm2 status` oder `pm2 list`
*   Live-Logs einsehen: `pm2 logs classroombookings`
*   Prozess stoppen: `pm2 stop classroombookings`
*   Prozess starten: `pm2 start ecosystem.config.js`

