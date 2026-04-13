import { test, expect } from '@playwright/test';
import { RechnerPage } from '../../helpers/rechner-page';
import { collectDiagnostics, filterCriticalErrors } from '../../helpers/diagnostics';

/**
 * Smoke-Tests für den E-Bike-Versicherungsrechner.
 * Prüft die grundlegende Funktionsfähigkeit: Seite lädt, SPA rendert,
 * Karten sind klickbar, keine JS-Fehler.
 */
test.describe('Rechner Smoke Tests', () => {
    let rechnerPage: RechnerPage;

    test.beforeEach(async ({ page }) => {
        rechnerPage = new RechnerPage(page);
    });

    test.afterEach(async ({ page }, testInfo) => {
        await collectDiagnostics(page, testInfo, rechnerPage);
    });

    test('Rechner-SPA lädt und zeigt Startseite', async () => {
        await rechnerPage.goto();
        const isVisible = await rechnerPage.isStartPageVisible();
        expect(isVisible, 'Startseite mit Kategoriekarten nicht sichtbar').toBeTruthy();
    });

    test('ensOptions und ensFieldsPreload sind initialisiert', async () => {
        await rechnerPage.goto();
        const initialized = await rechnerPage.isAppInitialized();
        expect(initialized, 'enscompare Konfiguration nicht initialisiert').toBeTruthy();
    });

    test('Alle 3 Kategorie-Karten sind sichtbar', async ({ page }) => {
        await rechnerPage.goto();

        const fahrrad = page.locator('button[aria-label="Fahrrad auswählen"]');
        const ebike = page.locator('button[aria-label="E-Bike auswählen"]');
        const gewerblich = page.locator('button[aria-label="Gewerbliche Risiken auswählen"]');

        await expect(fahrrad).toBeVisible();
        await expect(ebike).toBeVisible();
        await expect(gewerblich).toBeVisible();
    });

    test('Keine kritischen JS-Fehler in der Konsole', async () => {
        await rechnerPage.goto();
        const criticalErrors = filterCriticalErrors(rechnerPage.consoleErrors);
        expect(
            criticalErrors,
            `Kritische Konsolen-Fehler:\n${criticalErrors.join('\n')}`
        ).toHaveLength(0);
    });

    test('enscompare JS-Bundle wird erfolgreich geladen', async ({ page }) => {
        let bundleLoaded = false;
        page.on('response', (response) => {
            if (response.url().includes('enscompare') && response.url().endsWith('.js')) {
                if (response.status() === 200) bundleLoaded = true;
            }
        });

        await rechnerPage.goto();
        expect(bundleLoaded, 'enscompare JS-Bundle nicht geladen').toBeTruthy();
    });

    test('Keine fehlgeschlagenen Netzwerk-Requests (eigene Assets)', async () => {
        await rechnerPage.goto();
        // Nur Requests zu eigenen Assets prüfen (Tracking/CDN-Telemetrie ignorieren)
        const ownAssetFailures = rechnerPage.networkFailures.filter(f => {
            try {
                const hostname = new URL(f.url).hostname;
                const isOwnDomain = hostname.includes('ebikeversicherungen.net') || hostname.includes('fahrsicherung.de');
                // Cloudflare CDN-Telemetrie und Tracking ausschließen
                const isCdnTelemetry = f.url.includes('/cdn-cgi/');
                return isOwnDomain && !isCdnTelemetry;
            } catch { return false; }
        });
        expect(
            ownAssetFailures,
            `Fehlgeschlagene Requests (eigene Assets):\n${JSON.stringify(ownAssetFailures, null, 2)}`
        ).toHaveLength(0);
    });

    test('E-Bike Karte klickbar — Formular erscheint', async ({ page }) => {
        await rechnerPage.goto();
        await rechnerPage.selectCategory('ebike');

        // Prüfen ob das Kaufpreis-Feld erscheint
        const priceInput = page.locator('.mantine-NumberInput-input').first();
        await expect(priceInput).toBeVisible();
    });

    test('Fahrrad Karte klickbar — Formular erscheint', async ({ page }) => {
        await rechnerPage.goto();
        await rechnerPage.selectCategory('fahrrad');

        const priceInput = page.locator('.mantine-NumberInput-input').first();
        await expect(priceInput).toBeVisible();
    });
});
