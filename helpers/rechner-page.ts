import { type Page, type Locator, type BrowserContext } from '@playwright/test';

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
 * Page Object Model für den Versicherungsrechner.
 *
 * Kapselt alle Interaktionen mit dem Rechner und sammelt
 * automatisch Konsolen-Fehler und fehlgeschlagene Netzwerk-Requests.
 *
 * HINWEIS: Selektoren sind Platzhalter und müssen angepasst werden,
 * sobald die echten DOM-Strukturen bekannt sind.
 */
export class RechnerPage {
    readonly page: Page;

    /** Gesammelte console.error-Einträge während der Session */
    consoleErrors: string[] = [];

    /** Gesammelte fehlgeschlagene Netzwerk-Requests */
    networkFailures: NetworkFailure[] = [];

    // --- Selektoren (TODO: Anpassen an echte DOM-Struktur) ---

    /** Hauptcontainer des Rechners */
    // TODO: Anpassen — Selektor für den äußeren Container des Rechners
    private readonly containerSelector = '[data-testid="rechner-container"], #rechner-container, .rechner-wrapper';

    /** Kategorie-Auswahl (z.B. Berufshaftpflicht, Inhaltsversicherung) */
    // TODO: Anpassen — Selektor für das Kategorie-Dropdown oder die Radio-Buttons
    private readonly categorySelector = '[data-testid="category-select"], #category-select, select[name="category"]';

    /** Berufsgruppe / Gewerbe-Eingabefeld */
    // TODO: Anpassen — Selektor für das Autocomplete-/Textfeld zur Berufsgruppe
    private readonly businessTypeSelector = '[data-testid="business-type"], #business-type, input[name="business"]';

    /** PLZ-Eingabefeld */
    // TODO: Anpassen — Selektor für das PLZ-Feld
    private readonly postalCodeSelector = '[data-testid="postal-code"], #postal-code, input[name="plz"]';

    /** Jahresumsatz-Eingabefeld */
    // TODO: Anpassen — Selektor für das Umsatz-Feld
    private readonly revenueSelector = '[data-testid="revenue"], #revenue, input[name="revenue"]';

    /** Mitarbeiteranzahl-Eingabefeld */
    // TODO: Anpassen — Selektor für das Mitarbeiter-Feld
    private readonly employeeCountSelector = '[data-testid="employee-count"], #employee-count, input[name="employees"]';

    /** "Berechnen" / "Vergleichen" Button */
    // TODO: Anpassen — Selektor für den Haupt-Submit-Button
    private readonly calculateButtonSelector = '[data-testid="calculate-btn"], #calculate-btn, button[type="submit"]';

    /** Ergebnisliste / Container */
    // TODO: Anpassen — Selektor für den Container mit den Tarif-Ergebnissen
    private readonly resultsContainerSelector = '[data-testid="results-container"], #results-container, .results-list';

    /** Einzelnes Tarif-Ergebnis */
    // TODO: Anpassen — Selektor für ein einzelnes Tarif-Ergebnis in der Liste
    private readonly resultItemSelector = '[data-testid="result-item"], .result-item, .tariff-card';

    /** Preis-Anzeige innerhalb eines Tarif-Ergebnisses */
    // TODO: Anpassen — Selektor für die Preisanzeige
    private readonly priceSelector = '[data-testid="price"], .price, .tariff-price';

    /** Fehlermeldungs-Container */
    // TODO: Anpassen — Selektor für sichtbare Fehlermeldungen
    private readonly errorMessageSelector = '[data-testid="error-message"], .error-message, .alert-danger, .rechner-error';

    /** "Vergleichen" / Weiterleiten-Button */
    // TODO: Anpassen — Selektor für den Vergleichs-/Detail-Button
    private readonly compareButtonSelector = '[data-testid="compare-btn"], .compare-btn, a.compare-link';

    /** Zeitstempel für Performance-Messungen */
    private apiCallStartTime = 0;
    private apiCallEndTime = 0;

    constructor(page: Page) {
        this.page = page;
        this.setupListeners();
    }

    /**
     * Registriert Event-Listener für Konsolen-Fehler und Netzwerk-Failures.
     * Wird im Konstruktor automatisch aufgerufen.
     */
    private setupListeners(): void {
        // Konsolen-Fehler sammeln
        this.page.on('console', (msg) => {
            if (msg.type() === 'error') {
                this.consoleErrors.push(
                    `[${new Date().toISOString()}] ${msg.text()}`
                );
            }
        });

        // Fehlgeschlagene Netzwerk-Requests loggen
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

    /** Rechner direkt aufrufen */
    async goto(): Promise<void> {
        await this.page.goto('/', { waitUntil: 'domcontentloaded' });
        // TODO: Anpassen — Warten bis der Rechner-Container sichtbar ist
        await this.page.waitForSelector(this.containerSelector, {
            state: 'visible',
            timeout: 15_000,
        });
    }

    /** Rechner im iFrame-Kontext auf einer Host-Seite öffnen */
    async gotoEmbedded(hostUrl: string): Promise<void> {
        await this.page.goto(hostUrl, { waitUntil: 'domcontentloaded' });

        // TODO: Anpassen — iFrame-Selektor für den eingebetteten Rechner
        const iframeLocator = this.page.frameLocator(
            'iframe[src*="rechner"], iframe[src*="vergleichsrechner"], iframe#rechner-iframe'
        );
        await iframeLocator
            .locator(this.containerSelector)
            .waitFor({ state: 'visible', timeout: 15_000 });
    }

    // ========== Eingaben ==========

    /** Versicherungskategorie auswählen */
    async selectCategory(category: string): Promise<void> {
        // TODO: Anpassen — je nach Implementierung: Dropdown, Radio-Buttons oder Tabs
        const categoryElement = this.page.locator(this.categorySelector);
        await categoryElement.selectOption({ label: category });
    }

    /** Berufsgruppe / Gewerbe eingeben */
    async enterBusinessType(type: string): Promise<void> {
        const input = this.page.locator(this.businessTypeSelector);
        await input.click();
        await input.fill(type);
        // TODO: Anpassen — Autocomplete-Vorschlag auswählen, falls vorhanden
        // Warten auf Autocomplete-Dropdown und ersten Eintrag klicken
        const autocompleteItem = this.page.locator(
            // TODO: Anpassen — Selektor für Autocomplete-Vorschläge
            '.autocomplete-suggestion, .ui-menu-item, [data-testid="suggestion-item"]'
        );
        if (await autocompleteItem.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
            await autocompleteItem.first().click();
        }
    }

    /** Postleitzahl eingeben */
    async enterPostalCode(plz: string): Promise<void> {
        const input = this.page.locator(this.postalCodeSelector);
        await input.click();
        await input.fill(plz);
    }

    /** Jahresumsatz eingeben */
    async enterRevenue(amount: number): Promise<void> {
        const input = this.page.locator(this.revenueSelector);
        await input.click();
        await input.fill(String(amount));
    }

    /** Mitarbeiteranzahl eingeben */
    async enterEmployeeCount(count: number): Promise<void> {
        const input = this.page.locator(this.employeeCountSelector);
        await input.click();
        await input.fill(String(count));
    }

    /** Zusätzliche Felder befüllen (dynamisch, je nach Kategorie) */
    async fillAdditionalFields(data: Record<string, string>): Promise<void> {
        for (const [fieldName, value] of Object.entries(data)) {
            // TODO: Anpassen — Selektoren für dynamische Zusatzfelder
            const field = this.page.locator(
                `[data-testid="${fieldName}"], [name="${fieldName}"], #${fieldName}`
            );
            if (await field.isVisible({ timeout: 2_000 }).catch(() => false)) {
                await field.fill(value);
            }
        }
    }

    // ========== Aktionen ==========

    /** "Berechnen" / "Vergleichen" Button klicken und Performance-Messung starten */
    async clickCalculate(): Promise<void> {
        this.apiCallStartTime = Date.now();
        await this.page.locator(this.calculateButtonSelector).click();
    }

    /** Warten bis die Ergebnisliste geladen ist */
    async waitForResults(): Promise<void> {
        // TODO: Anpassen — ggf. Loading-Spinner abwarten
        await this.page.locator(this.resultsContainerSelector).waitFor({
            state: 'visible',
            timeout: 30_000,
        });
        this.apiCallEndTime = Date.now();
    }

    /** Einen bestimmten Tarif aus der Ergebnisliste auswählen */
    async selectTariff(index: number): Promise<void> {
        const items = this.page.locator(this.resultItemSelector);
        await items.nth(index).click();
    }

    /** Zum Vergleichslink / Detail-Seite weiterleiten */
    async clickCompare(): Promise<void> {
        await this.page.locator(this.compareButtonSelector).click();
    }

    // ========== Assertions / Diagnostics ==========

    /** Anzahl der angezeigten Ergebnisse ermitteln */
    async getResultCount(): Promise<number> {
        return this.page.locator(this.resultItemSelector).count();
    }

    /** Prüfen ob sichtbare Fehlermeldungen vorhanden sind */
    async hasErrors(): Promise<boolean> {
        return this.page.locator(this.errorMessageSelector).isVisible({ timeout: 2_000 }).catch(() => false);
    }

    /** Alle sichtbaren Fehlermeldungen auslesen */
    async getVisibleErrorMessages(): Promise<string[]> {
        const errorElements = this.page.locator(this.errorMessageSelector);
        const count = await errorElements.count();
        const messages: string[] = [];
        for (let i = 0; i < count; i++) {
            const text = await errorElements.nth(i).textContent();
            if (text) messages.push(text.trim());
        }
        return messages;
    }

    /** Aktuellen Zustand des Rechners für Debugging erfassen */
    async captureState(): Promise<object> {
        return this.page.evaluate(() => {
            // TODO: Anpassen — Zugriff auf den internen State des Rechners
            // Falls der Rechner ein globales State-Objekt exponiert (z.B. window.__RECHNER_STATE__)
            const win = window as unknown as Record<string, unknown>;
            return {
                url: window.location.href,
                title: document.title,
                // Versuche verschiedene State-Quellen zu lesen
                rechnerState: win.__RECHNER_STATE__ ?? null,
                formData: win.__RECHNER_FORM__ ?? null,
                visibleText: document.body?.innerText?.substring(0, 500) ?? '',
            };
        });
    }

    /** Dauer des letzten API-Calls in Millisekunden */
    async getApiCallDuration(): Promise<number> {
        if (this.apiCallStartTime === 0) return -1;
        return this.apiCallEndTime - this.apiCallStartTime;
    }

    /** Prüft ob Preise in den Ergebnissen angezeigt werden */
    async resultsContainPrices(): Promise<boolean> {
        const priceElements = this.page.locator(this.priceSelector);
        const count = await priceElements.count();
        return count > 0;
    }

    /**
     * Gesammelten Fehler-State zurücksetzen.
     * Nützlich wenn ein Test mehrere Szenarien nacheinander durchläuft.
     */
    resetErrorCollectors(): void {
        this.consoleErrors = [];
        this.networkFailures = [];
        this.apiCallStartTime = 0;
        this.apiCallEndTime = 0;
    }

    /**
     * Kompletten Rechner-Flow mit gegebenen Eingabedaten durchlaufen.
     * Convenience-Methode für häufig verwendete Test-Flows.
     */
    async completeFlow(input: {
        category: string;
        business: string;
        plz: string;
        revenue: number;
        employees?: number;
    }): Promise<void> {
        await this.selectCategory(input.category);
        await this.enterBusinessType(input.business);
        await this.enterPostalCode(input.plz);
        await this.enterRevenue(input.revenue);
        if (input.employees !== undefined) {
            await this.enterEmployeeCount(input.employees);
        }
        await this.clickCalculate();
        await this.waitForResults();
    }
}
