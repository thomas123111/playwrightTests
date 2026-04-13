import { type Page } from '@playwright/test';
import type { BikeCategory, ValidInput } from '../fixtures/test-data';
import { TEST_DATA } from '../fixtures/test-data';

/**
 * Gesammelte Informationen über einen fehlgeschlagenen Netzwerk-Request
 */
export interface NetworkFailure {
    url: string;
    method: string;
    errorText: string;
    timestamp: string;
}

/**
 * Page Object Model für den E-Bike-Versicherungsrechner (enscompare).
 *
 * ARCHITEKTUR:
 * - WordPress-Plugin "enscompare" → React/Mantine SPA
 * - Rendert im Shadow DOM unter #ensurance_view_root → .ensShadowMain
 * - Konfiguration in window.ensOptions + window.ensFieldsPreload
 * - Alle Formular-Elemente liegen IM Shadow DOM
 *
 * STARTSEITE:
 * - H1: "Ihre Bike-Versicherung"
 * - 3 Karten-Buttons: "Fahrrad" / "E-Bike" / "Gewerbliche Risiken"
 *   (selektierbar via aria-label)
 *
 * FORMULAR (nach Karten-Klick):
 * - Kaufpreis: .mantine-NumberInput-input (placeholder "1200 €")
 * - PLZ: label "Postleitzahl" → verknüpftes Input via for-Attribut
 * - Kaufdatum: 3 Felder mit placeholder "Tag"/"Monat"/"Jahr" (erste Gruppe)
 * - Geburtsdatum: 3 Felder mit placeholder "Tag"/"Monat"/"Jahr" (zweite Gruppe)
 * - Dropdowns: Bike-Bauart, Kaufart, Kauf als (Mantine Select)
 * - Radio-Buttons: Carbonteile, GPS-Tracker, Gutscheincode
 * - Submit: Button "Angebote ansehen"
 */
export class RechnerPage {
    readonly page: Page;

    /** Gesammelte console.error-Einträge während der Session */
    consoleErrors: string[] = [];

    /** Gesammelte fehlgeschlagene Netzwerk-Requests */
    networkFailures: NetworkFailure[] = [];

    /** Zeitstempel für Performance-Messungen */
    private apiCallStartTime = 0;
    private apiCallEndTime = 0;

    constructor(page: Page) {
        this.page = page;
        this.setupListeners();
    }

    private setupListeners(): void {
        this.page.on('console', (msg) => {
            if (msg.type() === 'error') {
                this.consoleErrors.push(
                    `[${new Date().toISOString()}] ${msg.text()}`
                );
            }
        });

        this.page.on('requestfailed', (request) => {
            this.networkFailures.push({
                url: request.url(),
                method: request.method(),
                errorText: request.failure()?.errorText ?? 'Unbekannter Fehler',
                timestamp: new Date().toISOString(),
            });
        });
    }

    // ========== Navigation ==========

    /** Rechner laden und warten bis die React-SPA gerendert hat */
    async goto(): Promise<void> {
        const domain = process.env.RECHNER_DOMAIN || 'ebikeversicherungen.net';
        const baseUrl = process.env.RECHNER_URL || 'https://ebikeversicherungen.net/vergleichsrechner/';

        // Schritt 1: Seite initial laden (etabliert Domain/Session-Cookies).
        // Volle URL verwenden, da der Proxy auf Browser-Ebene konfiguriert sein muss.
        await this.page.goto(baseUrl, { timeout: 60_000, waitUntil: 'load' }).catch(() => {});
        await this.page.waitForTimeout(3_000);

        // Schritt 2: Borlabs-Consent-Cookie setzen (nach dem ersten Load,
        // damit die Domain im Cookie-Store existiert).
        // Ohne diesen Cookie blockiert Borlabs das enscompare-JS.
        await this.page.context().addCookies([{
            name: 'borlabs-cookie',
            value: JSON.stringify({
                consents: {
                    essential: ['borlabs-cookie'],
                    statistics: ['matomo'],
                    marketing: ['facebook-pixel'],
                    'external-media': [],
                },
            }),
            domain,
            path: '/',
        }]);

        // Schritt 3: Seite neu laden — diesmal mit Consent → kein Banner → SPA rendert
        await this.page.reload({ timeout: 60_000, waitUntil: 'load' }).catch(() => {});

        // Schritt 4: SPA braucht Zeit zum Rendern (Shadow DOM + React)
        await this.page.waitForTimeout(10_000);

        // Schritt 5: Auf die SPA-Karten warten
        await this.page.locator('button[aria-label="E-Bike auswählen"]')
            .waitFor({ state: 'visible', timeout: 15_000 });
    }

    // ========== Eingaben ==========

    /**
     * Kategorie-Karte auf der Startseite klicken.
     * Die Karten haben stabile aria-labels:
     *   - "Fahrrad auswählen"
     *   - "E-Bike auswählen"
     *   - "Gewerbliche Risiken auswählen"
     */
    async selectCategory(category: BikeCategory): Promise<void> {
        const ariaLabels: Record<BikeCategory, string> = {
            fahrrad: 'Fahrrad auswählen',
            ebike: 'E-Bike auswählen',
            gewerblich: 'Gewerbliche Risiken auswählen',
        };
        await this.page.locator(`button[aria-label="${ariaLabels[category]}"]`).click();
        // Warten bis das Formular erscheint
        await this.page.locator('.mantine-NumberInput-input').first()
            .waitFor({ state: 'visible', timeout: 10_000 });
    }

    /** Kaufpreis eingeben (Mantine NumberInput mit placeholder "1200 €") */
    async enterPurchasePrice(price: number): Promise<void> {
        const input = this.page.locator('.mantine-NumberInput-input').first();
        await input.click();
        await input.fill(String(price));
    }

    /** PLZ eingeben (Feld mit placeholder "10115") */
    async enterPostalCode(plz: string): Promise<void> {
        await this.page.locator('input[placeholder="10115"]').fill(plz);
    }

    /**
     * Kaufdatum eingeben (3 Felder: Tag, Monat, Jahr).
     * Die ersten 3 Datums-Felder auf der Seite gehören zum Kaufdatum.
     */
    async enterPurchaseDate(day: string, month: string, year: string): Promise<void> {
        const dayInputs = this.page.locator('input[placeholder="Tag"]');
        const monthInputs = this.page.locator('input[placeholder="Monat"]');
        const yearInputs = this.page.locator('input[placeholder="Jahr"]');
        // Erstes Auftreten = Kaufdatum
        await dayInputs.nth(0).fill(day);
        await monthInputs.nth(0).fill(month);
        await yearInputs.nth(0).fill(year);
    }

    /**
     * Geburtsdatum eingeben (3 Felder: Tag, Monat, Jahr).
     * Die zweiten 3 Datums-Felder auf der Seite gehören zum Geburtsdatum.
     */
    async enterBirthDate(day: string, month: string, year: string): Promise<void> {
        const dayInputs = this.page.locator('input[placeholder="Tag"]');
        const monthInputs = this.page.locator('input[placeholder="Monat"]');
        const yearInputs = this.page.locator('input[placeholder="Jahr"]');
        // Zweites Auftreten = Geburtsdatum
        await dayInputs.nth(1).fill(day);
        await monthInputs.nth(1).fill(month);
        await yearInputs.nth(1).fill(year);
    }

    // ========== Aktionen ==========

    /** "Angebote ansehen" klicken und Performance-Messung starten */
    async clickViewOffers(): Promise<void> {
        this.apiCallStartTime = Date.now();
        await this.page.locator('button:has-text("Angebote ansehen")').click();
    }

    /** Warten bis die Ergebnisseite geladen ist */
    async waitForResults(): Promise<void> {
        // Warten bis sich die Seite ändert — neue Elemente erscheinen
        await this.page.waitForTimeout(TEST_DATA.resultsWait);
        this.apiCallEndTime = Date.now();
    }

    // ========== Assertions / Diagnostics ==========

    /** Prüft ob die Startseiten-Karten sichtbar sind */
    async isStartPageVisible(): Promise<boolean> {
        return this.page.locator('button[aria-label="E-Bike auswählen"]')
            .isVisible({ timeout: 5_000 }).catch(() => false);
    }

    /** Prüft ob das enscompare JS-Bundle geladen wurde */
    async isAppInitialized(): Promise<boolean> {
        return this.page.evaluate(() => {
            const win = window as unknown as Record<string, unknown>;
            return !!win.ensOptions && !!win.ensFieldsPreload;
        });
    }

    /** Zählt die Tarif-Ergebniskarten (mantine-Card-root mit Preisangabe) */
    async getResultCount(): Promise<number> {
        return this.page.evaluate(() => {
            const root = document.getElementById('ensurance_view_root');
            const shadow = root?.firstElementChild?.shadowRoot;
            if (!shadow) return 0;
            // Jeder Tarif ist eine mantine-Card mit €-Preisangabe und Höhe > 100px
            const cards = shadow.querySelectorAll('.mantine-Card-root');
            let count = 0;
            cards.forEach(card => {
                const hasPrice = (card.textContent || '').includes('€');
                const isVisible = card.getBoundingClientRect().height > 100;
                if (hasPrice && isVisible) count++;
            });
            return count;
        });
    }

    /** Prüft ob Fehlermeldungen sichtbar sind */
    async hasErrors(): Promise<boolean> {
        return this.page.evaluate(() => {
            const root = document.getElementById('ensurance_view_root');
            const shadow = root?.firstElementChild?.shadowRoot;
            if (!shadow) return false;
            const alerts = shadow.querySelectorAll('.mantine-Alert-root, [class*="error"]');
            return alerts.length > 0;
        });
    }

    /** Sichtbare Fehlermeldungen auslesen */
    async getVisibleErrorMessages(): Promise<string[]> {
        return this.page.evaluate(() => {
            const root = document.getElementById('ensurance_view_root');
            const shadow = root?.firstElementChild?.shadowRoot;
            if (!shadow) return [];
            const msgs: string[] = [];
            shadow.querySelectorAll('.mantine-Alert-root, [class*="error"]').forEach(el => {
                const text = el.textContent?.trim();
                if (text) msgs.push(text.substring(0, 200));
            });
            return msgs;
        });
    }

    /** Aktuellen Zustand des Rechners für Debugging erfassen */
    async captureState(): Promise<object> {
        return this.page.evaluate(() => {
            const win = window as unknown as Record<string, unknown>;
            const root = document.getElementById('ensurance_view_root');
            const shadow = root?.firstElementChild?.shadowRoot;
            return {
                url: window.location.href,
                hasEnsOptions: !!win.ensOptions,
                hasEnsFieldsPreload: !!win.ensFieldsPreload,
                shadowRootExists: !!shadow,
                shadowElementCount: shadow?.querySelectorAll('*').length ?? 0,
                visibleText: shadow?.textContent?.substring(0, 500) ?? document.body?.innerText?.substring(0, 500) ?? '',
            };
        });
    }

    /** Dauer des letzten API-Calls in Millisekunden */
    getApiCallDuration(): number {
        if (this.apiCallStartTime === 0) return -1;
        return this.apiCallEndTime - this.apiCallStartTime;
    }

    /** Gesammelten Fehler-State zurücksetzen */
    resetErrorCollectors(): void {
        this.consoleErrors = [];
        this.networkFailures = [];
        this.apiCallStartTime = 0;
        this.apiCallEndTime = 0;
    }

    /**
     * Kompletten Rechner-Flow durchlaufen:
     * Kategorie wählen → Formular ausfüllen → Angebote ansehen
     */
    async completeFlow(input: ValidInput): Promise<void> {
        await this.selectCategory(input.category);
        await this.enterPurchasePrice(input.purchasePrice);
        await this.enterPostalCode(input.plz);
        await this.enterPurchaseDate(input.purchaseDay, input.purchaseMonth, input.purchaseYear);
        await this.enterBirthDate(input.birthDay, input.birthMonth, input.birthYear);
        await this.clickViewOffers();
        await this.waitForResults();
    }
}
