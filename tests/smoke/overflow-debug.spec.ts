import { test, expect } from '@playwright/test';
import { RechnerPage } from '../../helpers/rechner-page';
import { TEST_DATA } from '../../fixtures/test-data';
import * as fs from 'fs';
import * as path from 'path';

const screenshotDir = path.resolve(__dirname, '..', '..', 'reports', 'overflow-debug');

/**
 * Reproduziert den Hotjar-Bug: Horizontale Scrollbar auf kleinem Android-Phone.
 * Gerät: 324x587 Viewport, Firefox Mobile 149.0, Android 16
 */
test.describe('Overflow-Bug: Kleines Android Phone (324x587)', () => {
    let rechnerPage: RechnerPage;

    test.beforeAll(() => {
        fs.mkdirSync(screenshotDir, { recursive: true });
    });

    test.beforeEach(async ({ page }) => {
        rechnerPage = new RechnerPage(page);
    });

    test('Startseite: Overflow-Check', async ({ page }, testInfo) => {
        await rechnerPage.goto();
        await page.waitForTimeout(2000);

        await page.screenshot({ path: path.join(screenshotDir, `01-start-${testInfo.project.name}.png`), fullPage: true });

        // Prüfe horizontalen Overflow
        const overflow = await page.evaluate(() => {
            const docWidth = document.documentElement.clientWidth;
            const scrollWidth = document.documentElement.scrollWidth;
            const bodyScrollWidth = document.body?.scrollWidth ?? 0;

            // Finde alle Elemente die über den Viewport hinausragen
            const overflowingElements: Array<{
                tag: string; cls: string; id: string;
                rect: { left: number; right: number; width: number };
                overflow: number;
                text: string;
            }> = [];

            document.querySelectorAll('*').forEach(el => {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.right > docWidth + 1) {
                    overflowingElements.push({
                        tag: el.tagName,
                        cls: (typeof el.className === 'string' ? el.className : '').substring(0, 150),
                        id: el.id || '',
                        rect: { left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) },
                        overflow: Math.round(rect.right - docWidth),
                        text: el.textContent?.trim()?.substring(0, 60) || '',
                    });
                }
            });

            // Auch im Shadow DOM suchen
            const ensRoot = document.getElementById('ensurance_view_root');
            const shadow = ensRoot?.firstElementChild?.shadowRoot;
            if (shadow) {
                shadow.querySelectorAll('*').forEach(el => {
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 0 && rect.right > docWidth + 1) {
                        overflowingElements.push({
                            tag: 'SHADOW:' + el.tagName,
                            cls: (typeof el.className === 'string' ? el.className : '').substring(0, 150),
                            id: el.id || '',
                            rect: { left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) },
                            overflow: Math.round(rect.right - docWidth),
                            text: el.textContent?.trim()?.substring(0, 60) || '',
                        });
                    }
                });
            }

            // Nach Overflow sortieren (größter zuerst)
            overflowingElements.sort((a, b) => b.overflow - a.overflow);

            return {
                viewportWidth: docWidth,
                scrollWidth,
                bodyScrollWidth,
                hasHorizontalScroll: scrollWidth > docWidth || bodyScrollWidth > docWidth,
                overflowPx: Math.max(scrollWidth, bodyScrollWidth) - docWidth,
                overflowingElements: overflowingElements.slice(0, 20),
            };
        });

        console.log(`\n=== OVERFLOW-ANALYSE: ${testInfo.project.name} ===`);
        console.log(`Viewport: ${overflow.viewportWidth}px`);
        console.log(`ScrollWidth: ${overflow.scrollWidth}px | Body: ${overflow.bodyScrollWidth}px`);
        console.log(`Hat horizontalen Scroll: ${overflow.hasHorizontalScroll} (${overflow.overflowPx}px)`);
        if (overflow.overflowingElements.length > 0) {
            console.log(`\nÜberlaufende Elemente (${overflow.overflowingElements.length}):`);
            overflow.overflowingElements.forEach((el, i) => {
                console.log(`  ${i + 1}. ${el.tag} [${el.cls.substring(0, 80)}]`);
                console.log(`     Overflow: ${el.overflow}px | Right: ${el.rect.right}px | Width: ${el.rect.width}px`);
                console.log(`     Text: "${el.text}"`);
            });
        }

        expect(overflow.hasHorizontalScroll, 
            `Horizontaler Overflow von ${overflow.overflowPx}px! Elemente: ${overflow.overflowingElements.map(e => `${e.tag}(+${e.overflow}px)`).join(', ')}`
        ).toBeFalsy();
    });

    test('Formular: Overflow-Check nach E-Bike Klick', async ({ page }, testInfo) => {
        await rechnerPage.goto();
        await rechnerPage.selectCategory('ebike');
        await page.waitForTimeout(2000);

        await page.screenshot({ path: path.join(screenshotDir, `02-formular-${testInfo.project.name}.png`), fullPage: true });

        const overflow = await page.evaluate(() => {
            const docWidth = document.documentElement.clientWidth;
            const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0);
            const overflowing: string[] = [];

            // Shadow DOM durchsuchen
            const shadow = document.getElementById('ensurance_view_root')?.firstElementChild?.shadowRoot;
            if (shadow) {
                shadow.querySelectorAll('*').forEach(el => {
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 0 && rect.right > docWidth + 1) {
                        const cls = (typeof el.className === 'string' ? el.className : '').substring(0, 100);
                        overflowing.push(`${el.tagName}[${cls}] right=${Math.round(rect.right)}px (+${Math.round(rect.right - docWidth)}px)`);
                    }
                });
            }

            return { hasOverflow: scrollWidth > docWidth, overflowPx: scrollWidth - docWidth, elements: overflowing.slice(0, 15) };
        });

        console.log(`\n=== FORMULAR OVERFLOW: ${testInfo.project.name} ===`);
        console.log(`Overflow: ${overflow.hasOverflow} (${overflow.overflowPx}px)`);
        overflow.elements.forEach(e => console.log(`  ${e}`));

        expect(overflow.hasOverflow, `Formular: ${overflow.overflowPx}px Overflow! ${overflow.elements.join('; ')}`).toBeFalsy();
    });

    test('Ergebnisliste: Overflow-Check', async ({ page }, testInfo) => {
        await rechnerPage.goto();
        const input = TEST_DATA.validInputs[0];
        await rechnerPage.completeFlow(input);
        await page.waitForTimeout(3000);

        await page.screenshot({ path: path.join(screenshotDir, `03-ergebnisse-${testInfo.project.name}.png`), fullPage: true });

        const overflow = await page.evaluate(() => {
            const docWidth = document.documentElement.clientWidth;
            const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0);
            const overflowing: string[] = [];

            const shadow = document.getElementById('ensurance_view_root')?.firstElementChild?.shadowRoot;
            if (shadow) {
                shadow.querySelectorAll('*').forEach(el => {
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 0 && rect.right > docWidth + 1) {
                        const cls = (typeof el.className === 'string' ? el.className : '').substring(0, 100);
                        overflowing.push(`${el.tagName}[${cls}] right=${Math.round(rect.right)}px (+${Math.round(rect.right - docWidth)}px)`);
                    }
                });
            }

            return { hasOverflow: scrollWidth > docWidth, overflowPx: scrollWidth - docWidth, elements: overflowing.slice(0, 15) };
        });

        console.log(`\n=== ERGEBNISSE OVERFLOW: ${testInfo.project.name} ===`);
        console.log(`Overflow: ${overflow.hasOverflow} (${overflow.overflowPx}px)`);
        overflow.elements.forEach(e => console.log(`  ${e}`));

        expect(overflow.hasOverflow, `Ergebnisse: ${overflow.overflowPx}px Overflow! ${overflow.elements.join('; ')}`).toBeFalsy();
    });
});
