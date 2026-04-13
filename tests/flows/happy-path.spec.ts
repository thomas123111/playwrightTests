import { test, expect } from '@playwright/test';
import { RechnerPage } from '../../helpers/rechner-page';
import { collectDiagnostics, filterCriticalErrors } from '../../helpers/diagnostics';
import { TEST_DATA } from '../../fixtures/test-data';

/**
 * Happy-Path-Tests: Vollständige User-Flows mit gültigen Eingaben.
 *
 * Flow des E-Bike-Versicherungsrechners:
 *   1. Gerätetyp wählen (Pedelec / E-Bike / Fahrrad / S-Pedelec)
 *   2. Kaufpreis eingeben
 *   3. Geburtsdatum eingeben
 *   4. Kaufdatum eingeben
 *   5. PLZ eingeben
 *   6. "Jetzt vergleichen" klicken
 *   7. Ergebnisliste prüfen
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
        test(`Vollständiger Flow: ${input.description ?? input.deviceMode} (PLZ ${input.plz})`, async () => {
            // Kompletten Rechner-Flow durchlaufen
            await rechnerPage.completeFlow(input);

            // Mindestens ein Ergebnis muss angezeigt werden
            const resultCount = await rechnerPage.getResultCount();
            expect(
                resultCount,
                `Keine Ergebnisse für ${input.deviceMode} / ${input.purchasePrice}€`
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
        test.skip(resultCount === 0, 'Keine Ergebnisse vorhanden — Test übersprungen');

        // Ersten Tarif auswählen
        await rechnerPage.selectTariff(0);

        // Kein Crash, kein Fehler nach Auswahl
        const hasErrors = await rechnerPage.hasErrors();
        expect(hasErrors, 'Fehler nach Tarif-Auswahl').toBeFalsy();
    });

    test('Alle verfügbaren Gerätetypen liefern Ergebnisse', async () => {
        for (const deviceMode of TEST_DATA.deviceModes) {
            rechnerPage.resetErrorCollectors();
            await rechnerPage.goto();

            await rechnerPage.completeFlow({
                deviceMode,
                purchasePrice: 3_500,
                birthDate: '10.03.2000',
                purchaseDate: '10.03.2025',
                plz: '13465',
            });

            const resultCount = await rechnerPage.getResultCount();
            expect(
                resultCount,
                `Keine Ergebnisse für Gerätetyp "${deviceMode}"`
            ).toBeGreaterThanOrEqual(1);
        }
    });

    test('Rechner mit deutschen Sonderzeichen im Hersteller-Feld', async () => {
        for (const hersteller of TEST_DATA.specialChars.hersteller) {
            rechnerPage.resetErrorCollectors();
            await rechnerPage.goto();

            await rechnerPage.selectDeviceMode('pedelec');
            await rechnerPage.enterManufacturer(hersteller);
            await rechnerPage.enterPurchasePrice(3_500);
            await rechnerPage.enterBirthDate('10.03.2000');
            await rechnerPage.enterPurchaseDate('10.03.2025');
            await rechnerPage.enterPostalCode('13465');
            await rechnerPage.clickCompare();

            // Rechner darf nicht crashen
            const criticalErrors = filterCriticalErrors(rechnerPage.consoleErrors);
            expect(
                criticalErrors,
                `Konsolen-Fehler bei Sonderzeichen "${hersteller}":\n${criticalErrors.join('\n')}`
            ).toHaveLength(0);
        }
    });
});
