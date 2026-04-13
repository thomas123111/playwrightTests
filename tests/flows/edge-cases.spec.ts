import { test, expect } from '@playwright/test';
import { RechnerPage } from '../../helpers/rechner-page';
import { collectDiagnostics, filterCriticalErrors } from '../../helpers/diagnostics';
import { TEST_DATA } from '../../fixtures/test-data';

/**
 * Edge-Case-Tests: Ungültige und ungewöhnliche Eingaben.
 * Prüft, dass der Rechner graceful reagiert und nicht crasht.
 */
test.describe('Rechner Edge Cases', () => {
    let rechnerPage: RechnerPage;

    test.beforeEach(async ({ page }) => {
        rechnerPage = new RechnerPage(page);
        await rechnerPage.goto();
    });

    test.afterEach(async ({ page }, testInfo) => {
        await collectDiagnostics(page, testInfo, rechnerPage);
    });

    // --- PLZ Edge Cases ---
    test.describe('PLZ-Validierung', () => {
        for (const plz of TEST_DATA.edgeCases.plz) {
            const displayPlz = plz === '' ? '(leer)' : `"${plz}"`;

            test(`PLZ ${displayPlz} — Rechner crasht nicht`, async () => {
                await rechnerPage.selectCategory(TEST_DATA.validInputs[0].category);
                await rechnerPage.enterBusinessType(TEST_DATA.validInputs[0].business);
                await rechnerPage.enterPostalCode(plz);
                await rechnerPage.enterRevenue(50_000);
                await rechnerPage.clickCalculate();

                // Rechner soll entweder eine Fehlermeldung zeigen oder das Ergebnis anzeigen
                // — aber NICHT crashen
                await rechnerPage.page.waitForTimeout(3_000);

                // Keine unhandled Exceptions in der Konsole
                const criticalErrors = filterCriticalErrors(rechnerPage.consoleErrors);
                expect(
                    criticalErrors,
                    `Unhandled Exceptions bei PLZ ${displayPlz}:\n${criticalErrors.join('\n')}`
                ).toHaveLength(0);
            });
        }
    });

    // --- Umsatz Edge Cases ---
    test.describe('Umsatz-Validierung', () => {
        for (const revenue of TEST_DATA.edgeCases.revenue) {
            const displayRevenue = String(revenue);

            test(`Umsatz ${displayRevenue} — Rechner crasht nicht`, async () => {
                await rechnerPage.selectCategory(TEST_DATA.validInputs[0].category);
                await rechnerPage.enterBusinessType(TEST_DATA.validInputs[0].business);
                await rechnerPage.enterPostalCode('10115');
                await rechnerPage.enterRevenue(revenue);
                await rechnerPage.clickCalculate();

                await rechnerPage.page.waitForTimeout(3_000);

                const criticalErrors = filterCriticalErrors(rechnerPage.consoleErrors);
                expect(
                    criticalErrors,
                    `Unhandled Exceptions bei Umsatz ${displayRevenue}:\n${criticalErrors.join('\n')}`
                ).toHaveLength(0);
            });
        }
    });

    // --- Berufsgruppe Edge Cases ---
    test.describe('Berufsgruppe-Validierung', () => {
        for (const business of TEST_DATA.edgeCases.business) {
            const displayBusiness = business === '' ? '(leer)' : `"${business}"`;

            test(`Berufsgruppe ${displayBusiness} — Rechner crasht nicht`, async () => {
                await rechnerPage.selectCategory(TEST_DATA.validInputs[0].category);
                await rechnerPage.enterBusinessType(business);
                await rechnerPage.enterPostalCode('10115');
                await rechnerPage.enterRevenue(50_000);
                await rechnerPage.clickCalculate();

                await rechnerPage.page.waitForTimeout(3_000);

                const criticalErrors = filterCriticalErrors(rechnerPage.consoleErrors);
                expect(
                    criticalErrors,
                    `Unhandled Exceptions bei Berufsgruppe ${displayBusiness}:\n${criticalErrors.join('\n')}`
                ).toHaveLength(0);
            });
        }
    });

    // --- XSS-Tests ---
    test.describe('XSS-Prävention', () => {
        test('Script-Tags werden nicht ausgeführt', async ({ page }) => {
            const xssPayload = '<script>alert(1)</script>';

            // XSS-Payload in alle Felder eingeben
            await rechnerPage.enterBusinessType(xssPayload);
            await rechnerPage.enterPostalCode(xssPayload);

            // Prüfen ob ein Alert-Dialog erscheint (sollte NICHT passieren)
            let alertTriggered = false;
            page.on('dialog', () => {
                alertTriggered = true;
            });

            await rechnerPage.clickCalculate();
            await page.waitForTimeout(3_000);

            expect(alertTriggered, 'XSS-Angriff wurde ausgeführt!').toBeFalsy();

            // Prüfen ob der Script-Tag im DOM escaped dargestellt wird
            const bodyText = await page.locator('body').textContent();
            expect(
                bodyText,
                'Script-Tag wurde nicht escaped'
            ).not.toContain('<script>');
        });

        test('Event-Handler in Eingaben werden nicht ausgeführt', async ({ page }) => {
            const xssPayload = '" onmouseover="alert(1)" data-x="';

            await rechnerPage.enterBusinessType(xssPayload);

            let alertTriggered = false;
            page.on('dialog', () => {
                alertTriggered = true;
            });

            // Hover über das Eingabefeld
            // TODO: Anpassen — Selektor für das Berufsgruppe-Feld
            await page.hover('[data-testid="business-type"], #business-type, input[name="business"]');
            await page.waitForTimeout(1_000);

            expect(alertTriggered, 'XSS via Event-Handler wurde ausgeführt!').toBeFalsy();
        });
    });

    // --- Doppel-Submit ---
    test('Doppelter Klick auf Berechnen crasht nicht', async () => {
        await rechnerPage.selectCategory(TEST_DATA.validInputs[0].category);
        await rechnerPage.enterBusinessType(TEST_DATA.validInputs[0].business);
        await rechnerPage.enterPostalCode('10115');
        await rechnerPage.enterRevenue(50_000);

        // Doppelklick auf den Button
        // TODO: Anpassen — Selektor für den Calculate-Button
        await rechnerPage.page.locator(
            '[data-testid="calculate-btn"], #calculate-btn, button[type="submit"]'
        ).dblclick();

        await rechnerPage.page.waitForTimeout(5_000);

        const criticalErrors = filterCriticalErrors(rechnerPage.consoleErrors);
        expect(
            criticalErrors,
            `Fehler bei Doppelklick:\n${criticalErrors.join('\n')}`
        ).toHaveLength(0);
    });

    // --- Leeres Formular absenden ---
    test('Leeres Formular absenden — graceful Handling', async () => {
        // Ohne Eingaben direkt auf Berechnen klicken
        await rechnerPage.clickCalculate();

        await rechnerPage.page.waitForTimeout(3_000);

        // Erwartung: Fehlermeldung wird angezeigt ODER nichts passiert
        // Aber kein Crash
        const criticalErrors = filterCriticalErrors(rechnerPage.consoleErrors);
        expect(
            criticalErrors,
            `Fehler bei leerem Formular:\n${criticalErrors.join('\n')}`
        ).toHaveLength(0);
    });
});
