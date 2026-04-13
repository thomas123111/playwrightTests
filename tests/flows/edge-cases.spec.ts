import { test, expect } from '@playwright/test';
import { RechnerPage } from '../../helpers/rechner-page';
import { collectDiagnostics, filterCriticalErrors } from '../../helpers/diagnostics';
import { TEST_DATA } from '../../fixtures/test-data';

/**
 * Edge-Case-Tests: Ungültige und ungewöhnliche Eingaben.
 * Prüft, dass der E-Bike-Versicherungsrechner graceful reagiert und nicht crasht.
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
                await rechnerPage.selectDeviceMode('pedelec');
                await rechnerPage.enterPurchasePrice(3_500);
                await rechnerPage.enterBirthDate('10.03.2000');
                await rechnerPage.enterPurchaseDate('10.03.2025');
                await rechnerPage.enterPostalCode(plz);
                await rechnerPage.clickCompare();

                // Warten auf Reaktion
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

    // --- Kaufpreis Edge Cases ---
    test.describe('Kaufpreis-Validierung', () => {
        for (const price of TEST_DATA.edgeCases.purchasePrice) {
            const displayPrice = String(price);

            test(`Kaufpreis ${displayPrice}€ — Rechner crasht nicht`, async () => {
                await rechnerPage.selectDeviceMode('pedelec');
                await rechnerPage.enterPurchasePrice(price);
                await rechnerPage.enterBirthDate('10.03.2000');
                await rechnerPage.enterPurchaseDate('10.03.2025');
                await rechnerPage.enterPostalCode('13465');
                await rechnerPage.clickCompare();

                await rechnerPage.page.waitForTimeout(3_000);

                const criticalErrors = filterCriticalErrors(rechnerPage.consoleErrors);
                expect(
                    criticalErrors,
                    `Unhandled Exceptions bei Kaufpreis ${displayPrice}€:\n${criticalErrors.join('\n')}`
                ).toHaveLength(0);
            });
        }
    });

    // --- Geburtsdatum Edge Cases ---
    test.describe('Geburtsdatum-Validierung', () => {
        for (const date of TEST_DATA.edgeCases.birthDate) {
            const displayDate = date === '' ? '(leer)' : `"${date}"`;

            test(`Geburtsdatum ${displayDate} — Rechner crasht nicht`, async () => {
                await rechnerPage.selectDeviceMode('pedelec');
                await rechnerPage.enterPurchasePrice(3_500);
                await rechnerPage.enterBirthDate(date);
                await rechnerPage.enterPurchaseDate('10.03.2025');
                await rechnerPage.enterPostalCode('13465');
                await rechnerPage.clickCompare();

                await rechnerPage.page.waitForTimeout(3_000);

                const criticalErrors = filterCriticalErrors(rechnerPage.consoleErrors);
                expect(
                    criticalErrors,
                    `Unhandled Exceptions bei Geburtsdatum ${displayDate}:\n${criticalErrors.join('\n')}`
                ).toHaveLength(0);
            });
        }
    });

    // --- Kaufdatum Edge Cases ---
    test.describe('Kaufdatum-Validierung', () => {
        for (const date of TEST_DATA.edgeCases.purchaseDate) {
            const displayDate = date === '' ? '(leer)' : `"${date}"`;

            test(`Kaufdatum ${displayDate} — Rechner crasht nicht`, async () => {
                await rechnerPage.selectDeviceMode('pedelec');
                await rechnerPage.enterPurchasePrice(3_500);
                await rechnerPage.enterBirthDate('10.03.2000');
                await rechnerPage.enterPurchaseDate(date);
                await rechnerPage.enterPostalCode('13465');
                await rechnerPage.clickCompare();

                await rechnerPage.page.waitForTimeout(3_000);

                const criticalErrors = filterCriticalErrors(rechnerPage.consoleErrors);
                expect(
                    criticalErrors,
                    `Unhandled Exceptions bei Kaufdatum ${displayDate}:\n${criticalErrors.join('\n')}`
                ).toHaveLength(0);
            });
        }
    });

    // --- XSS-Tests ---
    test.describe('XSS-Prävention', () => {
        for (const payload of TEST_DATA.edgeCases.xssPayloads) {
            test(`XSS-Payload "${payload.substring(0, 30)}..." wird nicht ausgeführt`, async ({ page }) => {
                // XSS-Payload in alle verfügbaren Felder eingeben
                await rechnerPage.enterManufacturer(payload);
                await rechnerPage.enterModel(payload);
                await rechnerPage.enterPostalCode(payload);

                // Prüfen ob ein Alert-Dialog erscheint (sollte NICHT passieren)
                let alertTriggered = false;
                page.on('dialog', () => {
                    alertTriggered = true;
                });

                await rechnerPage.clickCompare();
                await page.waitForTimeout(3_000);

                expect(alertTriggered, `XSS-Angriff wurde ausgeführt: ${payload}`).toBeFalsy();
            });
        }
    });

    // --- Doppel-Submit ---
    test('Doppelter Klick auf Vergleichen crasht nicht', async () => {
        await rechnerPage.selectDeviceMode('pedelec');
        await rechnerPage.enterPurchasePrice(3_500);
        await rechnerPage.enterBirthDate('10.03.2000');
        await rechnerPage.enterPurchaseDate('10.03.2025');
        await rechnerPage.enterPostalCode('13465');

        // Schnell zweimal klicken
        const compareBtn = rechnerPage.page.locator(
            'button:has-text("Jetzt vergleichen"), button:has-text("Angebot anfordern"), button[class*="vergleicherButton"]'
        ).first();
        await compareBtn.dblclick();

        await rechnerPage.page.waitForTimeout(5_000);

        const criticalErrors = filterCriticalErrors(rechnerPage.consoleErrors);
        expect(
            criticalErrors,
            `Fehler bei Doppelklick:\n${criticalErrors.join('\n')}`
        ).toHaveLength(0);
    });

    // --- Leeres Formular absenden ---
    test('Leeres Formular absenden — graceful Handling', async () => {
        // Ohne Eingaben direkt vergleichen klicken
        await rechnerPage.clickCompare();

        await rechnerPage.page.waitForTimeout(3_000);

        // Kein Crash — Fehlermeldung oder keine Reaktion ist akzeptabel
        const criticalErrors = filterCriticalErrors(rechnerPage.consoleErrors);
        expect(
            criticalErrors,
            `Fehler bei leerem Formular:\n${criticalErrors.join('\n')}`
        ).toHaveLength(0);
    });

    // --- Extremer Kaufpreis ---
    test('Sehr hoher Kaufpreis (999.999€) wird verarbeitet', async () => {
        await rechnerPage.selectDeviceMode('ebike');
        await rechnerPage.enterPurchasePrice(999_999);
        await rechnerPage.enterBirthDate('10.03.2000');
        await rechnerPage.enterPurchaseDate('10.03.2025');
        await rechnerPage.enterPostalCode('13465');
        await rechnerPage.clickCompare();

        await rechnerPage.page.waitForTimeout(5_000);

        // Entweder Ergebnisse oder eine sinnvolle Meldung — aber kein Crash
        const criticalErrors = filterCriticalErrors(rechnerPage.consoleErrors);
        expect(criticalErrors).toHaveLength(0);
    });
});
