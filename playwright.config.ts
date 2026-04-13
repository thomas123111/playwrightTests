import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import path from 'path';

// .env-Datei laden (falls vorhanden)
dotenv.config({ path: path.resolve(__dirname, '.env') });

const BASE_URL = process.env.RECHNER_URL || 'https://ebikeversicherungen.net/vergleichsrechner/';

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: process.env.CI ? 2 : undefined,
    timeout: 30_000,
    expect: {
        timeout: 10_000,
        toHaveScreenshot: {
            // Erlaubte Pixel-Abweichung für Visual-Regression-Tests
            maxDiffPixelRatio: 0.002,
        },
    },

    reporter: [
        ['html', { outputFolder: 'reports/html', open: 'never' }],
        ['json', { outputFile: 'reports/results.json' }],
        ['list'],
    ],

    use: {
        baseURL: BASE_URL,
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        trace: 'retain-on-failure',
        actionTimeout: 15_000,
        navigationTimeout: 30_000,
    },

    /* Browser- und Device-Matrix */
    projects: [
        // --- Desktop-Browser ---
        {
            name: 'chromium-desktop',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'firefox-desktop',
            use: { ...devices['Desktop Firefox'] },
        },
        {
            name: 'webkit-desktop',
            use: { ...devices['Desktop Safari'] },
        },

        // --- Mobile Devices ---
        {
            name: 'iPhone 14',
            use: { ...devices['iPhone 14'] },
        },
        {
            name: 'iPhone SE',
            use: { ...devices['iPhone SE'] },
        },
        {
            name: 'Pixel 7',
            use: { ...devices['Pixel 7'] },
        },
        {
            name: 'Galaxy S21',
            use: {
                // Samsung Galaxy S21 — manuell konfiguriert
                userAgent:
                    'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
                viewport: { width: 360, height: 800 },
                deviceScaleFactor: 3,
                isMobile: true,
                hasTouch: true,
                defaultBrowserType: 'chromium',
            },
        },

        // --- Tablet ---
        {
            name: 'iPad Pro 11',
            use: { ...devices['iPad Pro 11'] },
        },
    ],
});
