import { test, expect } from '@playwright/test';
import { RechnerPage } from '../../helpers/rechner-page';
import { collectDiagnostics, filterCriticalErrors } from '../../helpers/diagnostics';
import { TEST_DATA } from '../../fixtures/test-data';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Embed-Context-Tests: E-Bike-Versicherungsrechner im iFrame-Kontext.
 * Prüft, dass der Rechner korrekt eingebettet funktioniert.
 *
 * Der Rechner wird auch per iFrame auf Drittseiten eingebettet
 * (z.B. auf Händler-Websites). Diese Tests simulieren diesen Kontext.
 */

const RECHNER_URL = process.env.RECHNER_URL || 'https://ebikeversicherungen.net/vergleichsrechner/';

/**
 * Erstellt eine minimale Test-HTML-Seite mit dem eingebetteten Rechner.
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
    <title>E-Bike Rechner Embed Test</title>
    ${cspMeta}
    <style>
        body { margin: 0; padding: 20px; font-family: sans-serif; background: #f5f5f5; }
        .embed-container {
            max-width: 1200px; margin: 0 auto;
            background: white; border: 1px solid #ddd;
            border-radius: 4px; overflow: hidden;
        }
        iframe { width: 100%; border: none; min-height: 800px; }
        h1 { font-size: 1.2rem; color: #333; }
    </style>
</head>
<body>
    <h1>Embed Test: E-Bike Versicherungsrechner</h1>
    <div class="embed-container">
        <iframe
            id="rechner-iframe"
            src="${RECHNER_URL}"
            title="E-Bike Versicherungsrechner"
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

        const iframe = page.frameLocator('#rechner-iframe');

        // Warten bis die React-App im iFrame gerendert hat
        const container = iframe.locator(
            '.ensShadowMain, .ensPortalRoot, #ens_compare_table_input_fields'
        );
        await expect(container.first()).toBeVisible({ timeout: 20_000 });
    });

    test('Happy Path im iFrame-Kontext', async ({ page }) => {
        await page.goto(`file://${embedPagePath}`);

        const iframe = page.frameLocator('#rechner-iframe');
        const input = TEST_DATA.validInputs[0];

        // Gerätetyp wählen (im iFrame)
        // TODO: Anpassen — Selektor für devicemode-Auswahl im iFrame
        await iframe.getByText('Pedelec', { exact: false }).first().click();

        // Kaufpreis eingeben
        const priceInput = iframe.locator(
            'input[aria-label*="Kaufpreis" i], label:has-text("Kaufpreis") ~ input'
        ).first();
        if (await priceInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
            await priceInput.fill(String(input.purchasePrice));
        }

        // Geburtsdatum eingeben
        const birthInput = iframe.locator(
            'input[aria-label*="Geburtsdatum" i], label:has-text("Geburtsdatum") ~ input'
        ).first();
        if (await birthInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await birthInput.fill(input.birthDate);
        }

        // Kaufdatum eingeben
        const purchaseDateInput = iframe.locator(
            'input[aria-label*="Kaufdatum" i], label:has-text("Kaufdatum") ~ input'
        ).first();
        if (await purchaseDateInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await purchaseDateInput.fill(input.purchaseDate);
        }

        // PLZ eingeben
        const plzInput = iframe.locator(
            'input[aria-label*="Postleitzahl" i], label:has-text("Postleitzahl") ~ input'
        ).first();
        if (await plzInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await plzInput.fill(input.plz);
        }

        // Vergleichen klicken
        const compareBtn = iframe.locator(
            'button:has-text("Jetzt vergleichen"), button:has-text("Angebot anfordern"), button[class*="vergleicherButton"]'
        ).first();
        await compareBtn.click();

        // Auf Ergebnisse warten
        const results = iframe.locator(
            '#ens_compare_table_input_fields, [class*="compareTable"], [class*="ensName"]'
        ).first();
        await expect(results).toBeVisible({ timeout: 30_000 });
    });

    test('iFrame-Breite passt sich an verschiedene Viewports an', async ({ page }) => {
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
        const cspPagePath = createEmbedTestPage({
            csp: "default-src 'self'; frame-src *; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
        });

        await page.goto(`file://${cspPagePath}`);

        const iframe = page.locator('#rechner-iframe');
        await expect(iframe).toBeVisible();

        // Rechner im iFrame sollte trotz Host-CSP laden
        // (CSP der Host-Seite betrifft den iFrame-Inhalt nicht direkt)
        const iframeLocator = page.frameLocator('#rechner-iframe');
        const container = iframeLocator.locator(
            '.ensShadowMain, .ensPortalRoot, #ens_compare_table_input_fields'
        );
        await expect(container.first()).toBeVisible({ timeout: 20_000 });
    });
});
