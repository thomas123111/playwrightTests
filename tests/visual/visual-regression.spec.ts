import { test, expect } from '@playwright/test';
import { RechnerPage } from '../../helpers/rechner-page';
import { collectDiagnostics } from '../../helpers/diagnostics';
import { TEST_DATA } from '../../fixtures/test-data';

/**
 * Visual-Regression-Tests: Screenshot-Vergleiche an definierten Punkten.
 * Separate Snapshots pro Browser/Device-Kombination werden automatisch
 * von Playwright verwaltet (Ordnerstruktur nach Projekt-Name).
 *
 * Der E-Bike-Versicherungsrechner ist eine React/Mantine-SPA.
 */
test.describe('Visual Regression', () => {
    let rechnerPage: RechnerPage;

    test.beforeEach(async ({ page }) => {
        rechnerPage = new RechnerPage(page);
    });

    test.afterEach(async ({ page }, testInfo) => {
        await collectDiagnostics(page, testInfo, rechnerPage);
    });

    test('Startseite — initialer Zustand mit Geräteauswahl', async ({ page }) => {
        await rechnerPage.goto();

        // Warten bis die SPA vollständig gerendert hat
        await page.waitForTimeout(2_000);

        await expect(page).toHaveScreenshot('rechner-startseite.png', {
            fullPage: true,
            maxDiffPixelRatio: 0.002,
        });
    });

    test('Formular ausgefüllt — Pedelec mit allen Feldern', async ({ page }) => {
        await rechnerPage.goto();

        const input = TEST_DATA.validInputs[0]; // E-Bike Standardfall
        await rechnerPage.selectCategory(input.category);
        await rechnerPage.enterPurchasePrice(input.purchasePrice);
        await rechnerPage.enterBirthDate(input.birthDay, input.birthMonth, input.birthYear);
        await rechnerPage.enterPurchaseDate(input.purchaseDay, input.purchaseMonth, input.purchaseYear);
        await rechnerPage.enterPostalCode(input.plz);

        await page.waitForTimeout(500);

        await expect(page).toHaveScreenshot('rechner-formular-ausgefuellt.png', {
            fullPage: true,
            maxDiffPixelRatio: 0.002,
        });
    });

    test('Ergebnisliste — Vergleichstabelle nach Berechnung', async ({ page }) => {
        await rechnerPage.goto();

        const input = TEST_DATA.validInputs[0];
        await rechnerPage.completeFlow(input);

        await page.waitForTimeout(1_000);

        await expect(page).toHaveScreenshot('rechner-ergebnisliste.png', {
            fullPage: true,
            maxDiffPixelRatio: 0.002,
        });
    });

    test('Fehler-State — ungültige PLZ', async ({ page }) => {
        await rechnerPage.goto();

        await rechnerPage.selectCategory('ebike');
        await rechnerPage.enterPurchasePrice(3_500);
        await rechnerPage.enterBirthDate('10', '03', '2000');
        await rechnerPage.enterPurchaseDate('10', '03', '2025');
        await rechnerPage.enterPostalCode('00000');
        await rechnerPage.clickViewOffers();

        await page.waitForTimeout(3_000);

        await expect(page).toHaveScreenshot('rechner-fehler-state.png', {
            fullPage: true,
            maxDiffPixelRatio: 0.002,
        });
    });

    test('Mobile-Darstellung — Startseite', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await rechnerPage.goto();

        await page.waitForTimeout(2_000);

        await expect(page).toHaveScreenshot('rechner-mobile-startseite.png', {
            fullPage: true,
            maxDiffPixelRatio: 0.002,
        });
    });

    test('Mobile-Darstellung — Ergebnisliste', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await rechnerPage.goto();

        const input = TEST_DATA.validInputs[0];
        await rechnerPage.completeFlow(input);

        await page.waitForTimeout(1_000);

        await expect(page).toHaveScreenshot('rechner-mobile-ergebnisse.png', {
            fullPage: true,
            maxDiffPixelRatio: 0.002,
        });
    });
});
