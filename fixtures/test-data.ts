/**
 * Testdaten für den Versicherungsrechner
 *
 * Enthält gültige Eingaben, Edge Cases und Sonderzeichen-Tests.
 * Die Kategorien und Berufsgruppen entsprechen den im Rechner verfügbaren Optionen.
 */

export interface ValidInput {
    category: string;
    business: string;
    plz: string;
    revenue: number;
    employees?: number;
}

export const TEST_DATA = {
    /** Gültige Eingabedaten für Happy-Path-Tests */
    validInputs: [
        {
            category: 'Berufshaftpflicht',
            business: 'Friseur',
            plz: '10115',
            revenue: 50_000,
        },
        {
            category: 'Berufshaftpflicht',
            business: 'Kosmetikstudio',
            plz: '80331',
            revenue: 80_000,
        },
        {
            category: 'Inhaltsversicherung',
            business: 'Nagelstudio',
            plz: '50667',
            revenue: 30_000,
        },
        {
            category: 'Betriebshaftpflicht',
            business: 'E-Zigaretten Handel',
            plz: '20095',
            revenue: 120_000,
        },
    ] satisfies ValidInput[],

    /** Edge-Case-Eingaben — sollen zu Fehlermeldungen führen, aber nicht crashen */
    edgeCases: {
        plz: ['00000', '99999', '', '1234', 'ABCDE', '  10115  '],
        revenue: [0, -1, 999_999_999, 0.5, NaN],
        business: [
            '',
            '  ',
            'Nicht existierender Beruf 12345',
            '<script>alert(1)</script>',
        ],
    },

    /** Deutsche Umlaute und Sonderzeichen — Encoding-Tests */
    specialChars: ['Bäckerei', 'Straßenbau', 'Büro & Mehr GmbH'],

    /** Erwartete Minimal-Anzahl an Ergebnissen für gültige Eingaben */
    minExpectedResults: 1,

    /** Maximale erlaubte API-Antwortzeit in Millisekunden */
    maxApiResponseTime: 10_000,
} as const;
