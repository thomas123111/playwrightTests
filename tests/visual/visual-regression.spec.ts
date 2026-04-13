import { test, expect } from '@playwright/test';
import { RechnerPage } from '../../helpers/rechner-page';
import { collectDiagnostics } from '../../helpers/diagnostics';
import { TEST_DATA } from '../../fixtures/test-data';

/**
 * Visual-Regression-Tests: Screenshot-Vergleiche an definierten Punkten.
 * Separate Snapshots pro Browser/Device-Kombination werden automatisch
 * von Playwright verwaltet (Ordnerstruktur nach Projekt-Name).
 */
test.describe('Visual Regression', () => {
    let rechnerPage: RechnerPage;

    test.beforeEach(async ({ page }) => {
        rechnerPage = new RechnerPage(page);
    });

    test.afterEach(async ({ page }, testInfo) => {
        await collectDiagnostics(page, testInfo, rechnerPage);
    });

    test('Startseite — initialer Zustand', async ({ page }) => {
        await rechnerPage.goto();

        // Kurz warten bis alle Animationen/Lazy-Loads abgeschlossen sind
        await page.waitForTimeout(1_000);

        // TODO: Anpassen — ggf. Cookie-Banner oder andere Overlays schließen
        await expect(page).toHaveScreenshot('rechner-startseite.png', {
            fullPage: true,
            maxDiffPixelRatio: 0.002,
        });
    });

    test('Formular ausgefüllt — vor Berechnung', async ({ page }) => {
        await rechnerPage.goto();

        const input = TEST_DATA.validInputs[0];
        await rechnerPage.selectCategory(input.category);
        await rechnerPage.enterBusinessType(input.business);
        await rechnerPage.enterPostalCode(input.plz);
        await rechnerPage.enterRevenue(input.revenue);

        await page.waitForTimeout(500);

        await expect(page).toHaveScreenshot('rechner-formular-ausgefuellt.png', {
            fullPage: true,
            maxDiffPixelRatio: 0.002,
        });
    });

    test('Ergebnisliste — nach Berechnung', async ({ page }) => {
        await rechnerPage.goto();

        const input = TEST_DATA.validInputs[0];
        await rechnerPage.completeFlow(input);

        await page.waitForTimeout(1_000);

        await expect(page).toHaveScreenshot('rechner-ergebnisliste.png', {
            fullPage: true,
            maxDiffPixelRatio: 0.002,
        });
    });

    test('Fehler-State — ungültige Eingabe', async ({ page }) => {
        await rechnerPage.goto();

        // Ungültige PLZ eingeben, um einen Fehler-State zu provozieren
        await rechnerPage.selectCategory(TEST_DATA.validInputs[0].category);
        await rechnerPage.enterBusinessType(TEST_DATA.validInputs[0].business);
        await rechnerPage.enterPostalCode('00000');
        await rechnerPage.enterRevenue(50_000);
        await rechnerPage.clickCalculate();

        await page.waitForTimeout(3_000);

        await expect(page).toHaveScreenshot('rechner-fehler-state.png', {
            fullPage: true,
            maxDiffPixelRatio: 0.002,
        });
    });

    test('Mobile-Darstellung — Startseite', async ({ page }) => {
        // Explizit auf Mobile-Viewport setzen (ergänzend zu den Device-Projekten)
        await page.setViewportSize({ width: 375, height: 667 });
        await rechnerPage.goto();

        await page.waitForTimeout(1_000);

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
