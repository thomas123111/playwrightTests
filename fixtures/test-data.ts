/**
 * Testdaten für den E-Bike-Versicherungsrechner
 *
 * Enthält gültige Eingaben, Edge Cases und Sonderzeichen-Tests.
 * Der Rechner ist eine React/Mantine-SPA mit folgenden Schritten:
 *   1. Gerätetyp wählen (devicemode: pedelec | ebike | bike | spedelec)
 *   2. Bike-Daten eingeben (Kaufpreis, Kaufdatum, Geburtsdatum)
 *   3. PLZ eingeben
 *   4. Ergebnisliste / Vergleichstabelle
 */

/** Gerätetypen die im Rechner zur Auswahl stehen */
export type DeviceMode = 'pedelec' | 'ebike' | 'bike' | 'spedelec';

export interface ValidInput {
    /** Gerätetyp (Pedelec, E-Bike, Fahrrad, S-Pedelec) */
    deviceMode: DeviceMode;
    /** Kaufpreis in Euro */
    purchasePrice: number;
    /** Geburtsdatum (Format: TT.MM.JJJJ) */
    birthDate: string;
    /** Kaufdatum (Format: TT.MM.JJJJ) */
    purchaseDate: string;
    /** Postleitzahl */
    plz: string;
    /** Optionale Beschreibung für Testbenennung */
    description?: string;
}

export const TEST_DATA = {
    /** Gültige Eingabedaten für Happy-Path-Tests */
    validInputs: [
        {
            deviceMode: 'pedelec',
            purchasePrice: 3_500,
            birthDate: '10.03.2000',
            purchaseDate: '10.03.2025',
            plz: '13465',
            description: 'Pedelec Standardfall',
        },
        {
            deviceMode: 'ebike',
            purchasePrice: 5_000,
            birthDate: '15.06.1985',
            purchaseDate: '01.01.2025',
            plz: '80331',
            description: 'E-Bike München',
        },
        {
            deviceMode: 'bike',
            purchasePrice: 2_000,
            birthDate: '22.11.1990',
            purchaseDate: '15.02.2025',
            plz: '50667',
            description: 'Fahrrad Köln',
        },
        {
            deviceMode: 'spedelec',
            purchasePrice: 8_000,
            birthDate: '01.01.1975',
            purchaseDate: '01.03.2025',
            plz: '20095',
            description: 'S-Pedelec Hamburg',
        },
    ] satisfies ValidInput[],

    /** Edge-Case-Eingaben — sollen zu Fehlermeldungen führen, aber nicht crashen */
    edgeCases: {
        plz: ['00000', '99999', '', '1234', 'ABCDE', '  13465  '],
        purchasePrice: [0, -1, 999_999, 0.5],
        birthDate: ['', '00.00.0000', '32.13.2000', '01.01.1900', '01.01.2030'],
        purchaseDate: ['', '01.01.2015', '32.13.2025', '01.01.2030'],
        xssPayloads: [
            '<script>alert(1)</script>',
            '" onmouseover="alert(1)" data-x="',
            "'; DROP TABLE bikes; --",
        ],
    },

    /** Deutsche Umlaute und Sonderzeichen — Encoding-Tests */
    specialChars: {
        hersteller: ['Müller Bikes', 'Straßenrad GmbH', 'Büchel & Söhne'],
        modell: ['Citybike Größe L', 'Lastenrad für Straße', 'E-Mountainbike Überland'],
    },

    /** Verfügbare Gerätetypen im Rechner */
    deviceModes: ['pedelec', 'ebike', 'bike', 'spedelec'] as const,

    /** Verfügbare Versicherungsanbieter (aus der Konfiguration) */
    knownInsurers: [
        'Ammerlaender',
        'Fahrsicher',
        'BarmeniaEndkunden',
        'Haeger',
        'HanseMerkur',
        'Helden',
        'PentagonSecure',
    ],

    /** Erwartete Minimal-Anzahl an Ergebnissen für gültige Eingaben */
    minExpectedResults: 1,

    /** Maximale erlaubte API-Antwortzeit in Millisekunden */
    maxApiResponseTime: 10_000,
} as const;
