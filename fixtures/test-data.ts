/**
 * Testdaten für den E-Bike-Versicherungsrechner (enscompare).
 *
 * Der Rechner zeigt auf der Startseite 3 Karten:
 *   - "Fahrrad (ohne Motor)" → aria-label="Fahrrad auswählen"
 *   - "E-Bike (mit Motor)" → aria-label="E-Bike auswählen"
 *   - "Gewerbliche Risiken" → aria-label="Gewerbliche Risiken auswählen"
 *
 * Nach Auswahl erscheint das Formular mit:
 *   - Kaufpreis inkl. Zubehör (NumberInput, placeholder "1200 €")
 *   - Postleitzahl (TextInput, placeholder "10115")
 *   - Gekauft am (3x TextInput: Tag/Monat/Jahr)
 *   - Bike-Bauart (Select: Mountainbike, etc.)
 *   - Kaufart (Select: Neukauf, Gebrauchtkauf)
 *   - Kauf als (Select: Privatperson, Gewerblich)
 *   - Carbonteile verbaut? (Radio: Nein/Ja)
 *   - GPS-Tracker? (Radio: Nein/Ja)
 *   - Geburtsdatum (3x TextInput: Tag/Monat/Jahr)
 *   - Gutscheincode (Radio + TextInput)
 *   - Button "Angebote ansehen"
 *
 * Die App rendert im Shadow DOM unter #ensurance_view_root.
 */

export type BikeCategory = 'fahrrad' | 'ebike' | 'gewerblich';

export interface ValidInput {
    /** Kategorie-Karte auf der Startseite */
    category: BikeCategory;
    /** aria-label des Karten-Buttons */
    ariaLabel: string;
    /** Kaufpreis in Euro */
    purchasePrice: number;
    /** Postleitzahl */
    plz: string;
    /** Kaufdatum (Tag, Monat, Jahr als Strings) */
    purchaseDay: string;
    purchaseMonth: string;
    purchaseYear: string;
    /** Geburtsdatum (Tag, Monat, Jahr als Strings) */
    birthDay: string;
    birthMonth: string;
    birthYear: string;
    /** Beschreibung für Testbenennung */
    description: string;
}

export const TEST_DATA = {
    /** Gültige Eingabedaten für Happy-Path-Tests */
    validInputs: [
        {
            category: 'ebike',
            ariaLabel: 'E-Bike auswählen',
            purchasePrice: 3500,
            plz: '13465',
            purchaseDay: '10', purchaseMonth: '03', purchaseYear: '2025',
            birthDay: '10', birthMonth: '03', birthYear: '2000',
            description: 'E-Bike Berlin, 3.500€',
        },
        {
            category: 'fahrrad',
            ariaLabel: 'Fahrrad auswählen',
            purchasePrice: 2000,
            plz: '80331',
            purchaseDay: '15', purchaseMonth: '02', purchaseYear: '2025',
            birthDay: '22', birthMonth: '11', birthYear: '1990',
            description: 'Fahrrad München, 2.000€',
        },
        {
            category: 'ebike',
            ariaLabel: 'E-Bike auswählen',
            purchasePrice: 8000,
            plz: '50667',
            purchaseDay: '01', purchaseMonth: '01', purchaseYear: '2025',
            birthDay: '15', birthMonth: '06', birthYear: '1985',
            description: 'E-Bike Köln, 8.000€',
        },
    ] satisfies ValidInput[],

    /** Edge-Case-Eingaben */
    edgeCases: {
        plz: ['00000', '99999', '', '1234', 'ABCDE', '  13465  '],
        purchasePrice: [0, -1, 999999, 1],
        birthDate: {
            tooYoung: { day: '01', month: '01', year: '2020' },
            tooOld: { day: '01', month: '01', year: '1900' },
            invalid: { day: '32', month: '13', year: '2000' },
            empty: { day: '', month: '', year: '' },
        },
        purchaseDate: {
            future: { day: '01', month: '01', year: '2030' },
            veryOld: { day: '01', month: '01', year: '2010' },
            invalid: { day: '00', month: '00', year: '0000' },
        },
        xssPayloads: [
            '<script>alert(1)</script>',
            '" onmouseover="alert(1)"',
        ],
    },

    /** Wartezeit nach Seitenladung bis SPA gerendert hat (ms) */
    spaRenderWait: 15_000,

    /** Wartezeit nach "Angebote ansehen" Klick (ms) */
    resultsWait: 15_000,

    /** Erwartete Minimal-Anzahl an Ergebnissen */
    minExpectedResults: 1,

    /** Maximale erlaubte API-Antwortzeit in Millisekunden */
    maxApiResponseTime: 30_000,
} as const;
