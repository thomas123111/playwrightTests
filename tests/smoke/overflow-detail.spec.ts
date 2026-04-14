import { test, expect } from '@playwright/test';
import { RechnerPage } from '../../helpers/rechner-page';
import { TEST_DATA } from '../../fixtures/test-data';
import * as fs from 'fs';
import * as path from 'path';

const screenshotDir = path.resolve(__dirname, '..', '..', 'reports', 'overflow-debug');

/**
 * Detailanalyse: Welche Elemente auf der Ergebnisseite verursachen den Overflow?
 */
test.describe('Overflow Detail-Analyse (324x587 Firefox)', () => {
    test('Ergebnisseite: Alle überlaufenden Elemente identifizieren', async ({ page }) => {
        fs.mkdirSync(screenshotDir, { recursive: true });
        const rechnerPage = new RechnerPage(page);
        await rechnerPage.goto();
        await rechnerPage.completeFlow(TEST_DATA.validInputs[0]);
        await page.waitForTimeout(3000);

        // Jetzt die überlaufenden Elemente im Detail analysieren
        const analysis = await page.evaluate(() => {
            const vpWidth = document.documentElement.clientWidth;
            const shadow = document.getElementById('ensurance_view_root')?.firstElementChild?.shadowRoot;
            if (!shadow) return { error: 'Kein Shadow Root' };

            const results: Array<{
                tag: string; cls: string; 
                left: number; right: number; width: number; top: number;
                overflow: number;
                text: string;
                parentCls: string;
                computedOverflow: string;
                computedPosition: string;
                computedDisplay: string;
            }> = [];

            shadow.querySelectorAll('*').forEach(el => {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.right > vpWidth + 2) {
                    const style = getComputedStyle(el);
                    results.push({
                        tag: el.tagName,
                        cls: (typeof el.className === 'string' ? el.className : '').substring(0, 120),
                        left: Math.round(rect.left),
                        right: Math.round(rect.right),
                        width: Math.round(rect.width),
                        top: Math.round(rect.top),
                        overflow: Math.round(rect.right - vpWidth),
                        text: el.textContent?.trim()?.substring(0, 80) || '',
                        parentCls: (typeof el.parentElement?.className === 'string' ? el.parentElement.className : '').substring(0, 120),
                        computedOverflow: `${style.overflowX}/${style.overflowY}`,
                        computedPosition: style.position,
                        computedDisplay: style.display,
                    });
                }
            });

            // Nach Position (top) sortieren, damit wir sehen wo auf der Seite das Problem ist
            results.sort((a, b) => a.top - b.top);

            // Auch die Container-Elemente prüfen (mit overflow: hidden/auto)
            const containers: Array<{ cls: string; overflow: string; width: number }> = [];
            shadow.querySelectorAll('*').forEach(el => {
                const style = getComputedStyle(el);
                if (style.overflowX === 'hidden' || style.overflowX === 'auto' || style.overflowX === 'scroll') {
                    containers.push({
                        cls: (typeof el.className === 'string' ? el.className : '').substring(0, 120),
                        overflow: style.overflowX,
                        width: Math.round(el.getBoundingClientRect().width),
                    });
                }
            });

            return { vpWidth, totalOverflowing: results.length, elements: results.slice(0, 25), containers };
        });

        console.log(`\n========================================`);
        console.log(`OVERFLOW DETAIL-ANALYSE (VP: ${analysis.vpWidth}px)`);
        console.log(`========================================`);
        console.log(`Überlaufende Elemente: ${analysis.totalOverflowing}\n`);

        if ('error' in analysis) {
            console.log('FEHLER:', analysis.error);
            return;
        }

        // Gruppiere nach vertikaler Position (welche Bereiche der Seite sind betroffen)
        const sections = new Map<string, typeof analysis.elements>();
        for (const el of analysis.elements) {
            const section = el.top < 200 ? 'Header (0-200px)' :
                           el.top < 600 ? 'Filter-Bereich (200-600px)' :
                           el.top < 1000 ? 'Sortierung/Preisleiste (600-1000px)' :
                           `Tarif-Karten (${Math.floor(el.top / 500) * 500}+px)`;
            if (!sections.has(section)) sections.set(section, []);
            sections.get(section)!.push(el);
        }

        for (const [section, elements] of sections) {
            console.log(`--- ${section} ---`);
            for (const el of elements) {
                console.log(`  ${el.tag} | overflow: +${el.overflow}px | pos: ${el.computedPosition} | display: ${el.computedDisplay}`);
                console.log(`    class: ${el.cls.substring(0, 100)}`);
                console.log(`    text: "${el.text.substring(0, 60)}"`);
                console.log(`    left=${el.left} right=${el.right} width=${el.width} top=${el.top}`);
            }
            console.log('');
        }

        if (analysis.containers.length > 0) {
            console.log(`--- Container mit overflow: hidden/auto ---`);
            analysis.containers.forEach(c => console.log(`  ${c.cls.substring(0, 80)} | overflow-x: ${c.overflow} | width: ${c.width}px`));
        }

        // Screenshots der problematischen Bereiche
        await page.screenshot({ path: path.join(screenshotDir, `04-ergebnis-detail-top.png`), clip: { x: 0, y: 0, width: 324, height: 587 } });

        // Scroll nach unten zu den Tarif-Karten
        await page.evaluate(() => window.scrollBy(0, 600));
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(screenshotDir, `05-ergebnis-detail-cards.png`), clip: { x: 0, y: 0, width: 324, height: 587 } });

        // Assertion: Kein Element darf mehr als 20px überlaufen (tolerant für Schatten/Borders)
        const severeOverflows = analysis.elements.filter(el => el.overflow > 20);
        expect(
            severeOverflows.length,
            `${severeOverflows.length} Elemente ragen >20px über den Viewport:\n${severeOverflows.map(e => `  ${e.tag}[${e.cls.substring(0, 50)}] +${e.overflow}px "${e.text.substring(0, 40)}"`).join('\n')}`
        ).toBe(0);
    });
});
