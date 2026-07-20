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
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
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
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = getSheetByConfiguredName_(configuredName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(configuredName);
  }

  return sheet;
}