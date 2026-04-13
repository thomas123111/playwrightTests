import { type TestInfo, type Page } from '@playwright/test';
import { type NetworkFailure, RechnerPage } from './rechner-page';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Struktur eines Diagnose-Reports, der bei Test-Fehlern erstellt wird
 */
export interface DiagnosticReport {
    testName: string;
    browser: string;
    device: string;
    viewport: { width: number; height: number };
    url: string;
    consoleErrors: string[];
    networkFailures: NetworkFailure[];
    rechnerState: object;
    screenshot: string;
    timestamp: string;
    duration: number;
    errorMessage?: string;
}

/**
 * Erstellt einen Diagnose-Report für fehlgeschlagene Tests.
 *
 * Wird als afterEach-Hook verwendet und sammelt automatisch
 * alle relevanten Informationen für die Fehleranalyse.
 */
export async function collectDiagnostics(
    page: Page,
    testInfo: TestInfo,
    rechnerPage?: RechnerPage
): Promise<DiagnosticReport | null> {
    // Nur bei fehlgeschlagenen Tests einen Report erstellen
    if (testInfo.status === 'passed' || testInfo.status === 'skipped') {
        return null;
    }

    const reportsDir = path.resolve(__dirname, '..', 'reports', 'diagnostics');
    fs.mkdirSync(reportsDir, { recursive: true });

    // Screenshot erstellen
    const screenshotName = `${sanitizeFilename(testInfo.title)}-${Date.now()}.png`;
    const screenshotPath = path.join(reportsDir, screenshotName);
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {
        // Screenshot kann fehlschlagen wenn die Seite schon geschlossen ist
    });

    // Aktuellen Rechner-State erfassen
    let rechnerState: object = {};
    if (rechnerPage) {
        rechnerState = await rechnerPage.captureState().catch(() => ({}));
    }

    // Viewport-Informationen ermitteln
    const viewportSize = page.viewportSize() ?? { width: 0, height: 0 };

    const report: DiagnosticReport = {
        testName: testInfo.title,
        browser: testInfo.project.name,
        device: testInfo.project.name,
        viewport: viewportSize,
        url: page.url(),
        consoleErrors: rechnerPage?.consoleErrors ?? [],
        networkFailures: rechnerPage?.networkFailures ?? [],
        rechnerState,
        screenshot: screenshotPath,
        timestamp: new Date().toISOString(),
        duration: testInfo.duration,
        errorMessage: testInfo.error?.message,
    };

    // Report als JSON speichern
    const reportFilename = `${sanitizeFilename(testInfo.title)}-${testInfo.project.name}-${Date.now()}.json`;
    const reportPath = path.join(reportsDir, reportFilename);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

    // Report auch als Test-Attachment anfügen (erscheint im HTML-Report)
    await testInfo.attach('diagnostic-report', {
        body: JSON.stringify(report, null, 2),
        contentType: 'application/json',
    });

    return report;
}

/**
 * Dateinamen-sichere Version eines Strings erzeugen
 */
function sanitizeFilename(name: string): string {
    return name
        .replace(/[^a-zA-Z0-9äöüÄÖÜß-]/g, '_')
        .replace(/_+/g, '_')
        .substring(0, 80);
}

/**
 * Prüft ob während des Tests schwerwiegende Konsolen-Fehler aufgetreten sind.
 * Filtert bekannte, unkritische Fehler heraus.
 */
export function filterCriticalErrors(errors: string[]): string[] {
    // Bekannte unkritische Fehler ignorieren (Liste bei Bedarf erweitern)
    const ignoredPatterns = [
        // TODO: Anpassen — bekannte unkritische Fehlermeldungen hier eintragen
        /favicon\.ico/i,
        /third-party cookie/i,
        /ResizeObserver loop/i,
    ];

    return errors.filter(
        (error) => !ignoredPatterns.some((pattern) => pattern.test(error))
    );
}
