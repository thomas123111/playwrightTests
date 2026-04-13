import { test, expect } from '@playwright/test';
import { RechnerPage } from '../../helpers/rechner-page';
import { collectDiagnostics, filterCriticalErrors } from '../../helpers/diagnostics';

/**
 * Smoke-Tests: Grundlegende Funktionsfähigkeit des Rechners prüfen.
 * Diese Tests sollen schnell laufen (< 2 Min gesamt) und bei jedem Deploy ausgeführt werden.
 */
test.describe('Rechner Smoke Tests', () => {
    let rechnerPage: RechnerPage;

    test.beforeEach(async ({ page }) => {
        rechnerPage = new RechnerPage(page);
    });

    test.afterEach(async ({ page }, testInfo) => {
        await collectDiagnostics(page, testInfo, rechnerPage);
    });

    test('Rechner-Seite lädt erfolgreich', async ({ page }) => {
        await rechnerPage.goto();

        // Hauptcontainer ist sichtbar
        // TODO: Anpassen — Selektor für den Rechner-Container
        const container = page.locator(
            '[data-testid="rechner-container"], #rechner-container, .rechner-wrapper'
        );
        await expect(container).toBeVisible();
    });

    test('Keine kritischen JS-Fehler in der Konsole', async ({ page }) => {
        await rechnerPage.goto();

        // Kurz warten, damit eventuelle asynchrone Fehler auftreten können
        await page.waitForTimeout(2_000);

        const criticalErrors = filterCriticalErrors(rechnerPage.consoleErrors);
        expect(
            criticalErrors,
            `Kritische Konsolen-Fehler gefunden:\n${criticalErrors.join('\n')}`
        ).toHaveLength(0);
    });

    test('Alle kritischen Assets geladen (kein 404)', async ({ page }) => {
        const failedResources: string[] = [];

        // Netzwerk-Responses überwachen
        page.on('response', (response) => {
            if (response.status() === 404) {
                const url = response.url();
                // Nur relevante Assets prüfen (JS, CSS, Bilder)
                if (/\.(js|css|png|jpg|svg|woff2?)(\?|$)/i.test(url)) {
                    failedResources.push(`404: ${url}`);
                }
            }
        });

        await rechnerPage.goto();
        await page.waitForTimeout(2_000);

        expect(
            failedResources,
            `Fehlende Assets gefunden:\n${failedResources.join('\n')}`
        ).toHaveLength(0);
    });

    test('Keine fehlgeschlagenen Netzwerk-Requests', async () => {
        await rechnerPage.goto();

        expect(
            rechnerPage.networkFailures,
            `Fehlgeschlagene Netzwerk-Requests:\n${JSON.stringify(rechnerPage.networkFailures, null, 2)}`
        ).toHaveLength(0);
    });

    test('Erstes Eingabefeld ist klickbar und interaktiv', async ({ page }) => {
        await rechnerPage.goto();

        // TODO: Anpassen — Selektor für das erste interaktive Element
        const firstInput = page.locator(
            '[data-testid="category-select"], #category-select, select[name="category"], input:visible'
        ).first();

        await expect(firstInput).toBeVisible();
        await expect(firstInput).toBeEnabled();

        // Klicken ohne Fehler
        await firstInput.click();
    });

    test('Rechner reagiert auf Viewport-Änderungen', async ({ page }) => {
        await rechnerPage.goto();

        // Container muss bei verschiedenen Viewports sichtbar bleiben
        const container = page.locator(
            '[data-testid="rechner-container"], #rechner-container, .rechner-wrapper'
        );

        // Desktop-Viewport
        await page.setViewportSize({ width: 1280, height: 720 });
        await expect(container).toBeVisible();

        // Tablet-Viewport
        await page.setViewportSize({ width: 768, height: 1024 });
        await expect(container).toBeVisible();

        // Mobile-Viewport
        await page.setViewportSize({ width: 375, height: 667 });
        await expect(container).toBeVisible();
    });
});
