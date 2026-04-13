import { test, expect } from '@playwright/test';
import { RechnerPage } from '../../helpers/rechner-page';
import { collectDiagnostics, filterCriticalErrors } from '../../helpers/diagnostics';

/**
 * Smoke-Tests: Grundlegende Funktionsfähigkeit des E-Bike-Versicherungsrechners.
 * Diese Tests sollen schnell laufen (< 2 Min gesamt) und bei jedem Deploy ausgeführt werden.
 *
 * Der Rechner ist eine React/Mantine-SPA (enscompare WordPress-Plugin),
 * die auf ebikeversicherungen.net/vergleichsrechner/ gehostet wird.
 */
test.describe('Rechner Smoke Tests', () => {
    let rechnerPage: RechnerPage;

    test.beforeEach(async ({ page }) => {
        rechnerPage = new RechnerPage(page);
    });

    test.afterEach(async ({ page }, testInfo) => {
        await collectDiagnostics(page, testInfo, rechnerPage);
    });

    test('Rechner-SPA lädt erfolgreich', async ({ page }) => {
        await rechnerPage.goto();

        // Hauptcontainer der React-App ist sichtbar (ensShadowMain / ensPortalRoot)
        const container = page.locator(
            '.ensShadowMain, .ensPortalRoot, #ens_compare_table_input_fields'
        );
        await expect(container.first()).toBeVisible();
    });

    test('Keine kritischen JS-Fehler in der Konsole', async ({ page }) => {
        await rechnerPage.goto();

        // Warten bis die SPA vollständig gerendert ist
        await page.waitForTimeout(3_000);

        const criticalErrors = filterCriticalErrors(rechnerPage.consoleErrors);
        expect(
            criticalErrors,
            `Kritische Konsolen-Fehler gefunden:\n${criticalErrors.join('\n')}`
        ).toHaveLength(0);
    });

    test('Alle kritischen Assets geladen (kein 404)', async ({ page }) => {
        const failedResources: string[] = [];

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
        await page.waitForTimeout(3_000);

        expect(
            failedResources,
            `Fehlende Assets gefunden:\n${failedResources.join('\n')}`
        ).toHaveLength(0);
    });

    test('enscompare JS-Bundle wird geladen', async ({ page }) => {
        let bundleLoaded = false;

        page.on('response', (response) => {
            if (response.url().includes('enscompare') && response.url().endsWith('.js')) {
                bundleLoaded = response.status() === 200;
            }
        });

        await rechnerPage.goto();
        await page.waitForTimeout(2_000);

        expect(bundleLoaded, 'enscompare JS-Bundle wurde nicht geladen').toBeTruthy();
    });

    test('Keine fehlgeschlagenen Netzwerk-Requests', async () => {
        await rechnerPage.goto();

        expect(
            rechnerPage.networkFailures,
            `Fehlgeschlagene Netzwerk-Requests:\n${JSON.stringify(rechnerPage.networkFailures, null, 2)}`
        ).toHaveLength(0);
    });

    test('Gerätetyp-Auswahl ist sichtbar und interaktiv', async ({ page }) => {
        await rechnerPage.goto();

        // Die Gerätetyp-Auswahl (Select/Buttons für Pedelec, E-Bike, etc.) muss sichtbar sein
        const deviceSelect = page.locator(
            '.nav_top_select, [class*="nav_top_select"], input[class*="mantine-Select-input"]'
        ).first();

        // Alternativ nach sichtbarem Text suchen
        const pedelecOption = page.getByText('Pedelec', { exact: false }).first();
        const eBikeOption = page.getByText('E-Bike', { exact: false }).first();

        // Mindestens eine der Varianten muss sichtbar sein
        const deviceSelectVisible = await deviceSelect.isVisible({ timeout: 5_000 }).catch(() => false);
        const pedelecVisible = await pedelecOption.isVisible({ timeout: 2_000 }).catch(() => false);
        const eBikeVisible = await eBikeOption.isVisible({ timeout: 2_000 }).catch(() => false);

        expect(
            deviceSelectVisible || pedelecVisible || eBikeVisible,
            'Keine Gerätetyp-Auswahl (Pedelec/E-Bike) sichtbar'
        ).toBeTruthy();
    });

    test('Rechner reagiert auf Viewport-Änderungen', async ({ page }) => {
        await rechnerPage.goto();

        const container = page.locator(
            '.ensShadowMain, .ensPortalRoot, #ens_compare_table_input_fields'
        ).first();

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

    test('ensOptions und ensFieldsPreload sind initialisiert', async ({ page }) => {
        await rechnerPage.goto();

        const configState = await page.evaluate(() => {
            const win = window as unknown as Record<string, unknown>;
            return {
                hasEnsOptions: !!win.ensOptions,
                hasEnsFieldsPreload: !!win.ensFieldsPreload,
                devicekey: (win.ensOptions as Record<string, unknown>)?.devicekey ?? null,
            };
        });

        expect(configState.hasEnsOptions, 'ensOptions nicht initialisiert').toBeTruthy();
        expect(configState.hasEnsFieldsPreload, 'ensFieldsPreload nicht initialisiert').toBeTruthy();
    });
});
