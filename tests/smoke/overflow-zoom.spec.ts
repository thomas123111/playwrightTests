import { test } from '@playwright/test';
import { RechnerPage } from '../../helpers/rechner-page';
import { TEST_DATA } from '../../fixtures/test-data';
import * as fs from 'fs';
import * as path from 'path';

const dir = path.resolve(__dirname, '..', '..', 'reports', 'overflow-debug');

test('Overflow-Zoom: Preisleiste auf 324px', async ({ page }) => {
    fs.mkdirSync(dir, { recursive: true });
    const rechnerPage = new RechnerPage(page);
    await rechnerPage.goto();
    await rechnerPage.completeFlow(TEST_DATA.validInputs[0]);
    await page.waitForTimeout(3000);

    // Scroll zur Preisleiste (die Chips sind bei y~478)
    await page.evaluate(() => window.scrollTo(0, 350));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(dir, '06-preisleiste-324px.png'), clip: { x: 0, y: 0, width: 324, height: 587 } });

    // Viewport auf 400px verbreitern — tritt das Problem auch dort auf?
    await page.setViewportSize({ width: 400, height: 587 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(dir, '07-preisleiste-400px.png'), clip: { x: 0, y: 0, width: 400, height: 587 } });

    // Und auf 375px (iPhone-typisch)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(dir, '08-preisleiste-375px.png'), clip: { x: 0, y: 0, width: 375, height: 667 } });

    // Detail: Den horizontalen Scrollcontainer und die Chips analysieren
    const chipInfo = await page.evaluate(() => {
        const shadow = document.getElementById('ensurance_view_root')?.firstElementChild?.shadowRoot;
        if (!shadow) return null;

        // Den overflow-x:auto Container finden
        const scrollContainer = shadow.querySelector('[class*="s-fr3yli"], [style*="overflow"]');
        const chips = shadow.querySelectorAll('.mantine-Chip-root');
        
        const chipData = Array.from(chips).map(chip => {
            const rect = chip.getBoundingClientRect();
            const label = chip.querySelector('.mantine-Chip-label');
            return {
                text: chip.textContent?.trim()?.substring(0, 40) || '',
                left: Math.round(rect.left),
                right: Math.round(rect.right),
                width: Math.round(rect.width),
                top: Math.round(rect.top),
                labelWidth: label ? Math.round(label.getBoundingClientRect().width) : 0,
            };
        });

        const scrollInfo = scrollContainer ? {
            cls: (typeof scrollContainer.className === 'string' ? scrollContainer.className : '').substring(0, 100),
            width: Math.round(scrollContainer.getBoundingClientRect().width),
            scrollWidth: (scrollContainer as HTMLElement).scrollWidth,
            overflowX: getComputedStyle(scrollContainer).overflowX,
        } : null;

        return { vpWidth: document.documentElement.clientWidth, chipData, scrollInfo };
    });

    if (chipInfo) {
        console.log(`\n=== CHIP/PREISLEISTE ANALYSE (VP: ${chipInfo.vpWidth}px) ===`);
        console.log('Scroll-Container:', JSON.stringify(chipInfo.scrollInfo, null, 2));
        console.log('\nChips:');
        chipInfo.chipData.forEach((c, i) => {
            const overflow = c.right > chipInfo.vpWidth ? ` ⚠️  +${c.right - chipInfo.vpWidth}px OVERFLOW` : '';
            console.log(`  ${i}: "${c.text}" | left=${c.left} right=${c.right} width=${c.width}${overflow}`);
        });
    }
});
