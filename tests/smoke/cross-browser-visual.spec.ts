import { test, expect } from '@playwright/test';
import { RechnerPage } from '../../helpers/rechner-page';
import { TEST_DATA } from '../../fixtures/test-data';

/**
 * Cross-Browser/Device Visual-Check: Macht Screenshots an kritischen
 * Stellen des Rechners und prüft auf Rendering-Probleme.
 */
test.describe('Cross-Browser Visual Check', () => {
    let rechnerPage: RechnerPage;

    test.beforeEach(async ({ page }) => {
        rechnerPage = new RechnerPage(page);
    });

    test('Startseite — Kategorieauswahl', async ({ page }, testInfo) => {
        await rechnerPage.goto();
        await page.waitForTimeout(2000);
        
        const screenshot = await page.screenshot({ fullPage: true });
        await testInfo.attach(`startseite-${testInfo.project.name}`, {
            body: screenshot,
            contentType: 'image/png',
        });

        // Prüfe ob alle 3 Karten sichtbar sind
        const fahrrad = page.locator('button[aria-label="Fahrrad auswählen"]');
        const ebike = page.locator('button[aria-label="E-Bike auswählen"]');
        const gewerblich = page.locator('button[aria-label="Gewerbliche Risiken auswählen"]');
        await expect(fahrrad).toBeVisible();
        await expect(ebike).toBeVisible();
        await expect(gewerblich).toBeVisible();

        // Prüfe ob Karten nicht abgeschnitten sind (Mindesthöhe)
        const eBikeBox = await ebike.boundingBox();
        expect(eBikeBox, 'E-Bike Karte hat keine BoundingBox').not.toBeNull();
        expect(eBikeBox!.height, 'E-Bike Karte ist zu klein (< 100px)').toBeGreaterThan(100);
        expect(eBikeBox!.width, 'E-Bike Karte ist zu schmal (< 80px)').toBeGreaterThan(80);
    });

    test('Formular — nach E-Bike Auswahl', async ({ page }, testInfo) => {
        await rechnerPage.goto();
        await rechnerPage.selectCategory('ebike');
        await page.waitForTimeout(2000);

        const screenshot = await page.screenshot({ fullPage: true });
        await testInfo.attach(`formular-${testInfo.project.name}`, {
            body: screenshot,
            contentType: 'image/png',
        });

        // Prüfe ob Kaufpreis-Feld sichtbar und nicht verdeckt
        const priceInput = page.locator('.mantine-NumberInput-input').first();
        await expect(priceInput).toBeVisible();
        const priceBox = await priceInput.boundingBox();
        expect(priceBox, 'Kaufpreis-Feld hat keine BoundingBox').not.toBeNull();
        expect(priceBox!.width, 'Kaufpreis-Feld zu schmal (< 100px)').toBeGreaterThan(100);
        expect(priceBox!.height, 'Kaufpreis-Feld zu flach (< 30px)').toBeGreaterThan(30);

        // Prüfe ob PLZ-Feld sichtbar
        const plzInput = page.locator('input[placeholder="10115"]');
        await expect(plzInput).toBeVisible();

        // Prüfe ob "Angebote ansehen" Button sichtbar
        const submitBtn = page.locator('button:has-text("Angebote ansehen")');
        await expect(submitBtn).toBeVisible();
        const btnBox = await submitBtn.boundingBox();
        expect(btnBox!.width, '"Angebote ansehen" Button zu schmal').toBeGreaterThan(150);

        // Prüfe ob Felder nicht überlappen (Kaufpreis über PLZ)
        const plzBox = await plzInput.boundingBox();
        if (priceBox && plzBox) {
            expect(
                plzBox.y,
                'PLZ-Feld überlappt mit Kaufpreis-Feld'
            ).toBeGreaterThan(priceBox.y + priceBox.height - 5);
        }
    });

    test('Ergebnisliste — nach Berechnung', async ({ page }, testInfo) => {
        await rechnerPage.goto();
        const input = TEST_DATA.validInputs[0];
        await rechnerPage.completeFlow(input);
        await page.waitForTimeout(2000);

        const screenshot = await page.screenshot({ fullPage: true });
        await testInfo.attach(`ergebnisse-${testInfo.project.name}`, {
            body: screenshot,
            contentType: 'image/png',
        });

        // Ergebnisse müssen vorhanden sein
        const count = await rechnerPage.getResultCount();
        expect(count, 'Keine Tarif-Ergebnisse angezeigt').toBeGreaterThan(0);

        // Prüfe Viewport-Breite: Kein horizontaler Overflow
        const hasHorizontalScroll = await page.evaluate(() => {
            return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        expect(hasHorizontalScroll, 'Seite hat horizontalen Scrollbar (Overflow-Problem)').toBeFalsy();
    });
});
