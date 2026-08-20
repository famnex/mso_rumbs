# Datenbank-Dokumentation für Classroombookings

Diese Datei dokumentiert das Datenbankschema für die Raumbelegungssoftware (classroombookings) sowie alle künftigen Änderungen an der Datenbankstruktur.

## Tabellenübersicht

Die Datenbank besteht aus den folgenden 14 Tabellen:

### 1. `academicyears`
Speichert den Zeitraum des aktuellen Schuljahres.
- `date_start` (DATE, NOT NULL): Startdatum des Schuljahres.
- `date_end` (DATE, NOT NULL): Enddatum des Schuljahres.

### 2. `bookings`
Enthält alle getätigten Buchungen für Räume.
- `booking_id` (INT(6), unsigned, auto_increment, Primary Key): Eindeutige ID der Buchung.
- `period_id` (INT(6), unsigned, NOT NULL): ID des Unterrichtszeitraums (Stunde).
- `week_id` (INT(6), unsigned, NULL): ID der Woche (bei wöchentlich wiederkehrenden Plänen).
- `day_num` (TINYINT(1), unsigned, NULL): Wochentag als Nummer (1 = Mo, 5 = Fr).
- `room_id` (INT(6), unsigned, NOT NULL): ID des Raumes.
- `user_id` (INT(6), unsigned, NULL): ID des buchenden Benutzers.
- `date` (DATE, NULL): Konkretes Datum der Buchung (für Einzelbuchungen).
- `notes` (VARCHAR(100), NULL): Optionale Notiz/Bemerkung zur Buchung.
- `cancelled` (TINYINT(1), unsigned, NOT NULL, default '0'): Status, ob die Buchung storniert wurde.
- `date_start` (DATE, NULL): Gültig ab Datum bei Dauerbuchungen (Stundenplanblockierungen).
- `date_end` (DATE, NULL): Gültig bis Datum bei Dauerbuchungen (Stundenplanblockierungen).

### 3. `departments`
Speichert die Abteilungen/Fachbereiche der Schule.
- `department_id` (INT(6), unsigned, auto_increment, Primary Key): ID des Fachbereichs.
- `name` (VARCHAR(50), NOT NULL): Name des Fachbereichs.
- `description` (VARCHAR(255), NULL): Beschreibung.
- `icon` (VARCHAR(255), NULL): Icon-Dateiname oder Klasse.

### 4. `holidays`
Speichert Ferien und schulfreie Tage, an denen keine Buchungen möglich sind.
- `holiday_id` (INT(6), unsigned, auto_increment, Primary Key): ID des Eintrags.
- `name` (VARCHAR(50), NOT NULL): Name der Ferien.
- `date_start` (DATE, NOT NULL): Startdatum.
- `date_end` (DATE, NOT NULL): Enddatum.

### 5. `periods`
Definiert die Schulstunden bzw. Unterrichtszeiten.
- `period_id` (INT(6), unsigned, auto_increment, Primary Key): ID der Stunde.
- `time_start` (TIME, NOT NULL): Beginn der Stunde.
- `time_end` (TIME, NOT NULL): Ende der Stunde.
- `name` (VARCHAR(30), NOT NULL): Name der Stunde (z.B. "1. Stunde").
- `days` (INT(2), unsigned, NOT NULL): Bits/Tage, an denen diese Stunde aktiv ist.
- `bookable` (TINYINT(1), unsigned, NOT NULL, default '0'): Ob diese Stunde von regulären Nutzern gebucht werden darf.
- `color` (TEXT, NULL): Optionale Hex-Sonderfarbe zur optischen Hervorhebung der Stunde im Belegungsplan.

### 6. `roomfields`
Zusatzfelder für die Räume zur flexiblen Raumbeschreibung.
- `field_id` (INT(6), unsigned, auto_increment, Primary Key): ID des Zusatzfeldes.
- `name` (VARCHAR(64), NULL): Name des Feldes.
- `type` (VARCHAR(30), NULL): Datentyp des Feldes (z.B. text, select).

### 7. `roomoptions`
Optionen für Auswahlfelder bei Zusatzfeldern.
- `option_id` (INT(6), unsigned, auto_increment, Primary Key): ID der Option.
- `field_id` (INT(6), unsigned, NOT NULL): Zugehöriges Zusatzfeld.
- `value` (VARCHAR(64), NULL): Wert der Option.

### 8. `rooms`
Die eigentlichen buchbaren Räume.
- `room_id` (INTEGER, Primary Key, AUTOINCREMENT): Eindeutige ID des Raumes.
- `user_id` (INTEGER, NULL): ID des zuständigen Lehrers/Administrators (Raumverantwortung).
- `department_id` (INTEGER, NULL): Fremdschlüssel auf die zugeordnete Kategorie (`departments`).
- `name` (TEXT, NOT NULL): Name des Raumes (z.B. "R 101").
- `location` (TEXT, NULL): [Veraltet/Abgelöst durch department_id] Lage/Gebäude.
- `bookable` (INTEGER, NOT NULL, default '0'): Ob der Raum generell buchbar ist.
- `icon` (TEXT, NULL): Icon.
- `notes` (TEXT, NULL): Interne Hinweise/Ausstattung.
- `photo` (TEXT, NULL): Dateipfad zum Raumfoto.

### 9. `roomvalues`
Werte der Zusatzfelder pro Raum.
- `value_id` (INT(6), unsigned, auto_increment, Primary Key): ID.
- `room_id` (INT(6), unsigned, NOT NULL): Zugeordneter Raum.
- `field_id` (INT(6), unsigned, NOT NULL): Zugeordnetes Feld.
- `value` (VARCHAR(255), NULL): Eingetragener Wert.

### 10. `settings`
Globale Systemeinstellungen.
- `group` (VARCHAR(50), NOT NULL): Konfigurationsgruppe.
- `name` (VARCHAR(50), NOT NULL): Name des Einstellungs-Keys.
- `value` (TEXT, NULL): Wert der Einstellung.
- *Einzigartiger Index*: `group_name` auf (`group`, `name`).
- *SQLite3-Kompatibilität*: Umgestellt auf `CREATE UNIQUE INDEX IF NOT EXISTS group_name ON settings ("group", "name")`.

### 11. `users`
Benutzerkonten des Systems.
- `user_id` (INT(6), unsigned, auto_increment, Primary Key): Eindeutige ID des Benutzers.
- `department_id` (INT(6), unsigned, NULL): ID des Fachbereichs.
- `username` (VARCHAR(255), NOT NULL): Anmeldename.
- `firstname` (VARCHAR(255), NULL): Vorname.
- `lastname` (VARCHAR(255), NULL): Nachname.
- `email` (VARCHAR(255), NULL): E-Mail-Adresse.
- `password` (VARCHAR(255), NULL): Gehashtes Passwort.
- `authlevel` (TINYINT(1), unsigned, NOT NULL): Berechtigungsstufe (1 = ADMINISTRATOR, 2 = TEACHER).
- `displayname` (VARCHAR(255), NULL): Anzeigename.
- `ext` (VARCHAR(255), NULL): Durchwahl/Telefonnummer.
- `lastlogin` (DATETIME, NULL): Zeitstempel des letzten Logins.
- `enabled` (TINYINT(1), unsigned, NOT NULL, default '1'): Aktivierungsstatus (1 = Aktiv, 0 = Gesperrt).
- `created` (DATETIME, NULL): Erstellungszeitstempel.

### 12. `weekdates`
Mapping von Kalenderdaten zu Schulwochen (A/B-Wochen).
- `week_id` (INT(6), unsigned, NOT NULL): ID der Woche.
- `date` (DATE, NOT NULL): Datum des Wochentags.

### 13. `weeks`
Wochentypen für den Stundenplan (z.B. A-Woche, B-Woche).
- `week_id` (INT(6), unsigned, auto_increment, Primary Key): Eindeutige ID des Wochentyps.
- `name` (VARCHAR(20), NOT NULL): Name der Woche.
- `fgcol` (CHAR(6), NULL): Vordergrundfarbe (Hex).
- `bgcol` (CHAR(6), NULL): Hintergrundfarbe (Hex).
- `icon` (VARCHAR(255), NULL): Icon.

### 14. `migrations`
Versionierung von Schema-Updates.
- `version` (BIGINT(20)): Aktuelle Migrationsversion.

---

## Strukturänderungen und Updates (Historie)

### 2026-06-01: Migration von PDO/MySQL auf SQLite3
Das System wurde vollständig von MySQL auf SQLite3 umgestellt, um einen komplett autarken, serverlosen und wartungsfreien Betrieb zu ermöglichen.
- **Treiber**: Umgestellt auf `sqlite3` in `local/config.php`.
- **Datenbankdatei**: Wird unter `local/booking.db` als einzelne, portable Datenbankdatei abgelegt.
- **SQL-Kompatibilität**:
  - In `Install_model.php` (Zeile 235) und der Migrationsdatei `20181207215600_add_settings.php` (Zeile 31) wurde das MySQL-spezifische `ALTER TABLE settings ADD UNIQUE ...` durch ein treiberübergreifendes, SQLite-kompatibles `CREATE UNIQUE INDEX IF NOT EXISTS group_name ON settings (group, name)` ersetzt.
- **Auto-Bootstrapping**: Bei leerer Datenbankdatei wird die gesamte Tabellenstruktur beim ersten Seitenaufruf automatisch im Hintergrund durch einen in `MY_Controller.php` integrierten Bootstrapper angelegt.

### 2026-06-01: Umstellung von Raum-Lage auf Fachbereichs-Kategorien (department_id)
Um eine sauberere Zuordnung der Räume/Medien zu ermöglichen, wurde die klassische Spalte `location` (Lage/Gebäude) in den EJS-Views und Admin-Controllern durch eine direkte Relation zu Fachbereichs-Kategorien (`departments`) mittels `department_id` abgelöst.
- **Datenbank-Tabelle `rooms`**: Spalte `department_id INTEGER` hinzugefügt.
- **EJS-Views & Router**: `room.location` wurde überall durch `room.department_name` via SQL `LEFT JOIN departments d ON r.department_id = d.department_id` ersetzt.
- **Admin-Interface**: Im Raum-Erstellungs-Formular wurde das Freitext-Feld für die Lage durch ein dynamisches Kategorie-Auswahlmenü ersetzt.

### 2026-08-12: Zeitliche Begrenzung (date_start / date_end) für Stundenplan-Dauerbuchungen
- **Datenbank-Tabelle `bookings`**: Spalten `date_start TEXT` (Gültig ab) und `date_end TEXT` (Gültig bis) hinzugefügt.
- **Verwendungszweck**: Ermöglicht die zeitliche Begrenzung wiederkehrender Stundenplaneinträge auf bestimmte Zeiträume (z. B. 01.09.2026 bis 31.01.2027), ohne andere Zeiträume im selben Schuljahr zu blockieren.

### 2026-08-20: Sonderfarbe für Unterrichtsstunden (periods.color)
- **Datenbank-Tabelle `periods`**: Spalte `color TEXT` hinzugefügt.
- **Verwendungszweck**: Ermöglicht Administratoren die Zuweisung einer individuellen Sonderfarbe für Unterrichtsstunden (z. B. Mittagsband, Pause, Betreuung), um diese im Belegungsplan optisch hervorzuheben.
