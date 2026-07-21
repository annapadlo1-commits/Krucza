/**
 * Inventory PRO 4.3
 * Odporne wyszukiwanie arkuszy po nazwie i aliasach konfiguracji.
 */

function getConfiguredSheetAliases_(configuredName) {
  const canonical = String(configuredName || '').trim();
  const aliases = [canonical];
  const inventoryAliases = CONFIG.SHEET_ALIASES && CONFIG.SHEET_ALIASES.INVENTORY;

  if (
    normalizeText(canonical) === normalizeText(CONFIG.SHEETS.INVENTORY) &&
    Array.isArray(inventoryAliases)
  ) {
    aliases.push.apply(aliases, inventoryAliases);
  }

  const seen = {};
  return aliases.map(value => String(value || '').trim()).filter(value => {
    const key = normalizeText(value);
    if (!key || seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function isConfiguredSheetName_(actualName, configuredName) {
  const actualKey = normalizeText(actualName);
  if (!actualKey) return false;
  return getConfiguredSheetAliases_(configuredName).some(alias =>
    normalizeText(alias) === actualKey
  );
}

function getSheetByConfiguredName_(configuredName) {
  const spreadsheet = getInventorySpreadsheet_();
  const wanted = getConfiguredSheetAliases_(configuredName).map(normalizeText);

  const sheets = spreadsheet.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    if (wanted.indexOf(normalizeText(sheets[i].getName())) >= 0) {
      return sheets[i];
    }
  }

  return null;
}

function getOrCreateConfiguredSheet_(configuredName) {
  const spreadsheet = getInventorySpreadsheet_();
  let sheet = getSheetByConfiguredName_(configuredName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(configuredName);
  }

  return sheet;
}

function registerInventorySpreadsheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) return '';
  PropertiesService.getScriptProperties().setProperty(
    'INVENTORY_SPREADSHEET_ID',
    spreadsheet.getId()
  );
  return spreadsheet.getId();
}

function getInventorySpreadsheet_() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  const id = PropertiesService.getScriptProperties()
    .getProperty('INVENTORY_SPREADSHEET_ID');
  if (!id) {
    throw new Error(
      'Aplikacja mobilna nie jest jeszcze powiązana z arkuszem. Otwórz arkusz raz po instalacji.'
    );
  }
  return SpreadsheetApp.openById(id);
}
