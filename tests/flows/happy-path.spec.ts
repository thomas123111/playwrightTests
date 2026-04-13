import { test, expect } from '@playwright/test';
import { RechnerPage } from '../../helpers/rechner-page';
import { collectDiagnostics, filterCriticalErrors } from '../../helpers/diagnostics';
import { TEST_DATA } from '../../fixtures/test-data';

/**
 * Happy-Path-Tests: Vollständige User-Flows mit gültigen Eingaben.
 * Prüft, dass der Rechner für alle Standardszenarien korrekte Ergebnisse liefert.
 */
test.describe('Rechner Happy Path', () => {
    let rechnerPage: RechnerPage;

    test.beforeEach(async ({ page }) => {
        rechnerPage = new RechnerPage(page);
        await rechnerPage.goto();
    });

    test.afterEach(async ({ page }, testInfo) => {
        await collectDiagnostics(page, testInfo, rechnerPage);
    });

    for (const input of TEST_DATA.validInputs) {
        test(`Vollständiger Flow: ${input.category} — ${input.business} (PLZ ${input.plz})`, async () => {
            // Kompletten Rechner-Flow durchlaufen
            await rechnerPage.completeFlow(input);

            // Mindestens ein Ergebnis muss angezeigt werden
            const resultCount = await rechnerPage.getResultCount();
            expect(
                resultCount,
                `Keine Ergebnisse für ${input.category} / ${input.business}`
            ).toBeGreaterThanOrEqual(TEST_DATA.minExpectedResults);

            // Ergebnis enthält Preisinformation
            const hasPrices = await rechnerPage.resultsContainPrices();
            expect(hasPrices, 'Ergebnisse enthalten keine Preisangaben').toBeTruthy();

            // Keine sichtbaren Fehlermeldungen
            const hasErrors = await rechnerPage.hasErrors();
            expect(hasErrors, 'Sichtbare Fehlermeldung trotz gültiger Eingaben').toBeFalsy();

            // Performance-Assertion: API-Antwort unter maxApiResponseTime
            const duration = await rechnerPage.getApiCallDuration();
            expect(
                duration,
                `API-Antwort dauerte ${duration}ms (max: ${TEST_DATA.maxApiResponseTime}ms)`
            ).toBeLessThan(TEST_DATA.maxApiResponseTime);

            // Keine kritischen Konsolen-Fehler während des Flows
            const criticalErrors = filterCriticalErrors(rechnerPage.consoleErrors);
            expect(
                criticalErrors,
                `Konsolen-Fehler während des Flows:\n${criticalErrors.join('\n')}`
            ).toHaveLength(0);
        });
    }

    test('Ergebnis-Tarif kann ausgewählt werden', async () => {
        const input = TEST_DATA.validInputs[0];
        await rechnerPage.completeFlow(input);

        const resultCount = await rechnerPage.getResultCount();
        // Nur testen wenn Ergebnisse vorhanden sind
        test.skip(resultCount === 0, 'Keine Ergebnisse vorhanden — Test übersprungen');

        // Ersten Tarif auswählen
        await rechnerPage.selectTariff(0);

        // TODO: Anpassen — Prüfen ob die Tarif-Details/Weiterleitung funktioniert
        // Erwartung: Seite crasht nicht, kein Fehler wird angezeigt
        const hasErrors = await rechnerPage.hasErrors();
        expect(hasErrors, 'Fehler nach Tarif-Auswahl').toBeFalsy();
    });

    test('Rechner mit deutschen Sonderzeichen', async () => {
        for (const specialBusiness of TEST_DATA.specialChars) {
            rechnerPage.resetErrorCollectors();

            await rechnerPage.goto();
            await rechnerPage.selectCategory(TEST_DATA.validInputs[0].category);
            await rechnerPage.enterBusinessType(specialBusiness);
            await rechnerPage.enterPostalCode('10115');
            await rechnerPage.enterRevenue(50_000);
            await rechnerPage.clickCalculate();

            // Rechner darf nicht crashen — Ergebnis oder Fehlermeldung ist akzeptabel
            const criticalErrors = filterCriticalErrors(rechnerPage.consoleErrors);
            expect(
                criticalErrors,
                `Konsolen-Fehler bei Sonderzeichen "${specialBusiness}":\n${criticalErrors.join('\n')}`
            ).toHaveLength(0);
        }
    });
});
