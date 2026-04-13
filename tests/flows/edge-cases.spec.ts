import { test, expect } from '@playwright/test';
import { RechnerPage } from '../../helpers/rechner-page';
import { collectDiagnostics, filterCriticalErrors } from '../../helpers/diagnostics';
import { TEST_DATA } from '../../fixtures/test-data';

/**
 * Edge-Case-Tests: Ungültige Eingaben dürfen den Rechner nicht crashen.
 */
test.describe('Rechner Edge Cases', () => {
    let rechnerPage: RechnerPage;

    test.beforeEach(async ({ page }) => {
        rechnerPage = new RechnerPage(page);
        await rechnerPage.goto();
        await rechnerPage.selectCategory('ebike');
    });

    test.afterEach(async ({ page }, testInfo) => {
        await collectDiagnostics(page, testInfo, rechnerPage);
    });

    // --- PLZ Edge Cases ---
    for (const plz of TEST_DATA.edgeCases.plz) {
        const label = plz === '' ? '(leer)' : `"${plz}"`;
        test(`PLZ ${label} — kein Crash`, async () => {
            await rechnerPage.enterPurchasePrice(3500);
            await rechnerPage.enterPostalCode(plz);
            await rechnerPage.enterPurchaseDate('10', '03', '2025');
            await rechnerPage.enterBirthDate('10', '03', '2000');
            await rechnerPage.clickViewOffers();
            await rechnerPage.page.waitForTimeout(5_000);

            const criticalErrors = filterCriticalErrors(rechnerPage.consoleErrors);
            expect(criticalErrors, `JS-Fehler bei PLZ ${label}:\n${criticalErrors.join('\n')}`).toHaveLength(0);
        });
    }

    // --- Kaufpreis Edge Cases ---
    for (const price of TEST_DATA.edgeCases.purchasePrice) {
        test(`Kaufpreis ${price}€ — kein Crash`, async () => {
            await rechnerPage.enterPurchasePrice(price);
            await rechnerPage.enterPostalCode('13465');
            await rechnerPage.enterPurchaseDate('10', '03', '2025');
            await rechnerPage.enterBirthDate('10', '03', '2000');
            await rechnerPage.clickViewOffers();
            await rechnerPage.page.waitForTimeout(5_000);

            const criticalErrors = filterCriticalErrors(rechnerPage.consoleErrors);
            expect(criticalErrors).toHaveLength(0);
        });
    }

    // --- Geburtsdatum Edge Cases ---
    test('Zu junges Geburtsdatum — kein Crash', async () => {
        const bd = TEST_DATA.edgeCases.birthDate.tooYoung;
        await rechnerPage.enterPurchasePrice(3500);
        await rechnerPage.enterPostalCode('13465');
        await rechnerPage.enterPurchaseDate('10', '03', '2025');
        await rechnerPage.enterBirthDate(bd.day, bd.month, bd.year);
        await rechnerPage.clickViewOffers();
        await rechnerPage.page.waitForTimeout(5_000);

        expect(filterCriticalErrors(rechnerPage.consoleErrors)).toHaveLength(0);
    });

    test('Ungültiges Geburtsdatum — kein Crash', async () => {
        const bd = TEST_DATA.edgeCases.birthDate.invalid;
        await rechnerPage.enterPurchasePrice(3500);
        await rechnerPage.enterPostalCode('13465');
        await rechnerPage.enterPurchaseDate('10', '03', '2025');
        await rechnerPage.enterBirthDate(bd.day, bd.month, bd.year);
        await rechnerPage.clickViewOffers();
        await rechnerPage.page.waitForTimeout(5_000);

        expect(filterCriticalErrors(rechnerPage.consoleErrors)).toHaveLength(0);
    });

    // --- XSS-Tests ---
    test('XSS-Payload in PLZ wird nicht ausgeführt', async ({ page }) => {
        let alertTriggered = false;
        page.on('dialog', () => { alertTriggered = true; });

        await rechnerPage.enterPostalCode('<script>alert(1)</script>');
        await rechnerPage.clickViewOffers();
        await page.waitForTimeout(3_000);

        expect(alertTriggered, 'XSS-Angriff wurde ausgeführt!').toBeFalsy();
    });

    // --- Leeres Formular ---
    test('Leeres Formular absenden — kein Crash', async () => {
        await rechnerPage.clickViewOffers();
        await rechnerPage.page.waitForTimeout(5_000);

        expect(filterCriticalErrors(rechnerPage.consoleErrors)).toHaveLength(0);
    });

    // --- Doppel-Submit ---
    test('Doppelklick auf "Angebote ansehen" — kein Crash', async () => {
        await rechnerPage.enterPurchasePrice(3500);
        await rechnerPage.enterPostalCode('13465');
        await rechnerPage.enterPurchaseDate('10', '03', '2025');
        await rechnerPage.enterBirthDate('10', '03', '2000');

        await rechnerPage.page.locator('button:has-text("Angebote ansehen")').dblclick();
        await rechnerPage.page.waitForTimeout(5_000);

        expect(filterCriticalErrors(rechnerPage.consoleErrors)).toHaveLength(0);
    });
});
