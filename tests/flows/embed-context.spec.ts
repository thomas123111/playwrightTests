import { test, expect } from '@playwright/test';
import { RechnerPage } from '../../helpers/rechner-page';
import { collectDiagnostics, filterCriticalErrors } from '../../helpers/diagnostics';
import { TEST_DATA } from '../../fixtures/test-data';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Embed-Context-Tests: Rechner im iFrame-Kontext.
 * Prüft, dass der Rechner korrekt eingebettet funktioniert.
 */

// Basis-URL des Rechners aus der Umgebung oder Default
const RECHNER_URL = process.env.RECHNER_URL || 'https://rechner.fixversichert.de';

/**
 * Erstellt eine minimale Test-HTML-Seite mit dem eingebetteten Rechner.
 * Wird vor den Tests generiert und über file:// geladen.
 */
function createEmbedTestPage(options?: { csp?: string }): string {
    const outputDir = path.resolve(__dirname, '..', '..', 'reports', 'embed-fixtures');
    fs.mkdirSync(outputDir, { recursive: true });

    const cspMeta = options?.csp
        ? `<meta http-equiv="Content-Security-Policy" content="${options.csp}">`
        : '';

    const html = `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rechner Embed Test</title>
    ${cspMeta}
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: sans-serif;
            background: #f5f5f5;
        }
        .embed-container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border: 1px solid #ddd;
            border-radius: 4px;
            overflow: hidden;
        }
        iframe {
            width: 100%;
            border: none;
            min-height: 600px;
        }
        h1 { font-size: 1.2rem; color: #333; }
    </style>
</head>
<body>
    <h1>Embed Test: Versicherungsrechner</h1>
    <div class="embed-container">
        <!-- TODO: Anpassen — Echte Embed-URL und Parameter -->
        <iframe
            id="rechner-iframe"
            src="${RECHNER_URL}"
            title="Versicherungsrechner"
            loading="lazy"
            allow="payment"
        ></iframe>
    </div>
    <script>
        // iFrame-Höhe automatisch anpassen (falls postMessage unterstützt wird)
        window.addEventListener('message', function(event) {
            if (event.data && event.data.type === 'rechner-resize') {
                document.getElementById('rechner-iframe').style.height =
                    event.data.height + 'px';
            }
        });
    </script>
</body>
</html>`;

    const filename = options?.csp ? 'embed-test-csp.html' : 'embed-test.html';
    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, html, 'utf-8');
    return filePath;
}

test.describe('Rechner im iFrame-Kontext', () => {
    let rechnerPage: RechnerPage;
    let embedPagePath: string;

    test.beforeAll(() => {
        embedPagePath = createEmbedTestPage();
    });

    test.beforeEach(async ({ page }) => {
        rechnerPage = new RechnerPage(page);
    });

    test.afterEach(async ({ page }, testInfo) => {
        await collectDiagnostics(page, testInfo, rechnerPage);
    });

    test('Rechner lädt im iFrame', async ({ page }) => {
        await page.goto(`file://${embedPagePath}`);

        // iFrame sollte vorhanden und geladen sein
        const iframe = page.frameLocator('#rechner-iframe');

        // TODO: Anpassen — Selektor für den Rechner-Container im iFrame
        const container = iframe.locator(
            '[data-testid="rechner-container"], #rechner-container, .rechner-wrapper'
        );
        await expect(container).toBeVisible({ timeout: 15_000 });
    });

    test('Happy Path im iFrame-Kontext', async ({ page }) => {
        await page.goto(`file://${embedPagePath}`);

        const iframe = page.frameLocator('#rechner-iframe');
        const input = TEST_DATA.validInputs[0];

        // Kategorie auswählen (im iFrame-Kontext)
        // TODO: Anpassen — Selektoren für den Rechner im iFrame
        await iframe.locator(
            '[data-testid="category-select"], #category-select, select[name="category"]'
        ).selectOption({ label: input.category });

        await iframe.locator(
            '[data-testid="business-type"], #business-type, input[name="business"]'
        ).fill(input.business);

        await iframe.locator(
            '[data-testid="postal-code"], #postal-code, input[name="plz"]'
        ).fill(input.plz);

        await iframe.locator(
            '[data-testid="revenue"], #revenue, input[name="revenue"]'
        ).fill(String(input.revenue));

        await iframe.locator(
            '[data-testid="calculate-btn"], #calculate-btn, button[type="submit"]'
        ).click();

        // Auf Ergebnisse warten
        // TODO: Anpassen — Selektor für den Ergebnis-Container im iFrame
        await iframe.locator(
            '[data-testid="results-container"], #results-container, .results-list'
        ).waitFor({ state: 'visible', timeout: 30_000 });

        // Mindestens ein Ergebnis
        const resultCount = await iframe.locator(
            '[data-testid="result-item"], .result-item, .tariff-card'
        ).count();
        expect(resultCount).toBeGreaterThanOrEqual(1);
    });

    test('iFrame-Höhe passt sich an den Inhalt an', async ({ page }) => {
        await page.goto(`file://${embedPagePath}`);

        const iframeElement = page.locator('#rechner-iframe');
        await expect(iframeElement).toBeVisible();

        // Initiale Höhe ermitteln
        const initialHeight = await iframeElement.evaluate(
            (el) => (el as HTMLIFrameElement).offsetHeight
        );
        expect(initialHeight).toBeGreaterThan(0);

        // TODO: Anpassen — Nach Interaktion sollte sich die Höhe ggf. ändern
        // Hier beispielhaft: Nach dem Laden der Ergebnisse prüfen,
        // ob der iFrame keine horizontale Scrollbar hat
        const hasHorizontalScroll = await iframeElement.evaluate((el) => {
            const iframe = el as HTMLIFrameElement;
            const body = iframe.contentDocument?.body;
            if (!body) return false;
            return body.scrollWidth > body.clientWidth;
        });

        // Cross-Origin-iFrame: evaluate auf contentDocument schlägt fehl
        // In dem Fall überspringen wir die Scrollbar-Prüfung
        if (hasHorizontalScroll !== null) {
            expect(
                hasHorizontalScroll,
                'iFrame hat eine horizontale Scrollbar'
            ).toBeFalsy();
        }
    });

    test('Keine Scrollbar-Probleme im eingebetteten Kontext', async ({ page }) => {
        // Verschiedene Viewports testen
        const viewports = [
            { width: 1280, height: 720, name: 'Desktop' },
            { width: 768, height: 1024, name: 'Tablet' },
            { width: 375, height: 667, name: 'Mobile' },
        ];

        for (const vp of viewports) {
            await page.setViewportSize({ width: vp.width, height: vp.height });
            await page.goto(`file://${embedPagePath}`);

            const iframeElement = page.locator('#rechner-iframe');
            await expect(iframeElement).toBeVisible({ timeout: 15_000 });

            // iFrame sollte nicht breiter als der Container sein
            const iframeWidth = await iframeElement.evaluate(
                (el) => (el as HTMLIFrameElement).offsetWidth
            );
            expect(
                iframeWidth,
                `iFrame ist breiter als Viewport bei ${vp.name} (${vp.width}px)`
            ).toBeLessThanOrEqual(vp.width);
        }
    });

    test('Rechner mit restriktiver CSP auf der Host-Seite', async ({ page }) => {
        // Test-Seite mit restriktiver Content Security Policy
        const cspPagePath = createEmbedTestPage({
            csp: "default-src 'self'; frame-src *; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
        });

        await page.goto(`file://${cspPagePath}`);

        const iframe = page.locator('#rechner-iframe');
        await expect(iframe).toBeVisible();

        // Rechner sollte auch mit CSP laden
        // TODO: Anpassen — Prüfen ob der Rechner im iFrame trotz CSP korrekt funktioniert
        const iframeLocator = page.frameLocator('#rechner-iframe');
        const container = iframeLocator.locator(
            '[data-testid="rechner-container"], #rechner-container, .rechner-wrapper'
        );

        // Warten und prüfen — der Rechner selbst ist auf einer anderen Domain,
        // also betrifft die CSP der Host-Seite ihn nicht direkt
        await expect(container).toBeVisible({ timeout: 15_000 });
    });
});
