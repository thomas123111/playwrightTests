import { test, expect } from '@playwright/test';
import { RechnerPage } from '../../helpers/rechner-page';
import { collectDiagnostics, filterCriticalErrors } from '../../helpers/diagnostics';
import { TEST_DATA } from '../../fixtures/test-data';

/**
 * Happy-Path-Tests: Vollständige User-Flows mit gültigen Eingaben.
 * Klickt Kategorie-Karte → füllt Formular → klickt "Angebote ansehen" → prüft Ergebnisse.
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
        test(`Vollständiger Flow: ${input.description}`, async () => {
            await rechnerPage.completeFlow(input);

            // Mindestens ein Ergebnis muss angezeigt werden
            const resultCount = await rechnerPage.getResultCount();
            expect(
                resultCount,
                `Keine Ergebnisse für ${input.description}`
            ).toBeGreaterThanOrEqual(TEST_DATA.minExpectedResults);

            // Keine sichtbaren Fehlermeldungen
            const hasErrors = await rechnerPage.hasErrors();
            if (hasErrors) {
                const msgs = await rechnerPage.getVisibleErrorMessages();
                expect(hasErrors, `Fehlermeldungen: ${msgs.join(', ')}`).toBeFalsy();
            }

            // Performance-Assertion
            const duration = rechnerPage.getApiCallDuration();
            expect(
                duration,
                `API-Antwort dauerte ${duration}ms (max: ${TEST_DATA.maxApiResponseTime}ms)`
            ).toBeLessThan(TEST_DATA.maxApiResponseTime);

            // Keine kritischen Konsolen-Fehler
            const criticalErrors = filterCriticalErrors(rechnerPage.consoleErrors);
            expect(
                criticalErrors,
                `Konsolen-Fehler:\n${criticalErrors.join('\n')}`
            ).toHaveLength(0);
        });
    }
});
