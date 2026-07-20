/**
 * Inventory PRO 4.3.1 — audyt kontraktu formuł dla układu Kruczej.
 *
 * Audytuje wyłącznie fizyczne wiersze produktów wykryte przez
 * scanInventoryProducts_(). Dzięki temu nagłówki kategorii, puste separatory
 * i techniczne kolumny cenowe nie są traktowane jak komórki produktowe.
 */

function getInventoryFormulaContract_(product) {
  if (isDirectFinalInventoryProduct_(product)) return [];
  const row = Number(product && product.inventoryRow) || 0;
  const type = String(product && product.type || '').toUpperCase();
  const category = normalizeText(product && product.category || '');
  if (!row) return [];

  if (type === CONFIG.PRODUCT_TYPES.LOCATION) {
    return [{
      column: 'D',
      formula: '=SUM(B' + row + ',C' + row + ')',
      r1c1: '=SUM(RC[-2],RC[-1])'
    }];
  }

  return [
    {
      column: 'D',
      formula: '=B' + row + '-C' + row,
      r1c1: '=RC[-2]-RC[-1]'
    },
    {
      column: 'H',
      formula: '=F' + row + '*G' + row,
      r1c1: '=RC[-2]*RC[-1]'
    },
    {
      column: 'I',
      formula: category === 'piwo'
        ? '=SUM(D' + row + ',H' + row + ')'
        : '=SUM(D' + row + ',E' + row + ',H' + row + ')',
      r1c1: category === 'piwo'
        ? '=SUM(RC[-5],RC[-1])'
        : '=SUM(RC[-5],RC[-4],RC[-1])'
    }
  ];
}

function getCanonicalInventoryFormula_(product, column) {
  const wanted = String(column || '').toUpperCase();
  const entry = getInventoryFormulaContract_(product).find(item => item.column === wanted);
  return entry ? entry.formula : '';
}

function buildInventoryFormulaCellIndex_(products) {
  const index = {};
  (products || []).forEach(product => {
    getInventoryFormulaContract_(product).forEach(contract => {
      index[contract.column + product.inventoryRow] = {
        product: product.name,
        type: product.type,
        category: product.category,
        formula: contract.formula
      };
    });
  });
  return index;
}

function normalizeInventoryFormula_(formula) {
  return String(formula || '')
    .replace(/\s+/g, '')
    .replace(/;/g, ',')
    .toUpperCase();
}

function stripInventoryFormulaOuterParentheses_(formula) {
  let normalized = normalizeInventoryFormula_(formula);
  while (normalized.indexOf('=(') === 0 && normalized.charAt(normalized.length - 1) === ')') {
    normalized = '=' + normalized.slice(2, -1);
  }
  return normalized;
}

/** Akceptuje równoważny zapis SUM(A,B,C) jako A+B+C, bez zmiany komórki. */
function isEquivalentInventoryFormula_(actual, expected) {
  const left = stripInventoryFormulaOuterParentheses_(actual);
  const right = stripInventoryFormulaOuterParentheses_(expected);
  if (left === right) return true;
  const match = right.match(/^=SUM\(([^()]+)\)$/);
  if (!match) return false;
  const additive = '=' + match[1].split(',').map(part => part.trim()).filter(Boolean).join('+');
  return left === stripInventoryFormulaOuterParentheses_(additive);
}

function isSpreadsheetFormulaError_(displayValue) {
  return /^#(?:REF!|VALUE!|DIV\/0!|N\/A|NAME\?|NUM!|NULL!|ERROR!)$/i
    .test(String(displayValue || '').trim());
}

function buildInventoryFormulaAudit_(sheet, products) {
  const physicalProducts = Array.isArray(products) ? products : [];
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const width = 9;
  const range = sheet.getRange(1, 1, lastRow, width);
  const formulas = range.getFormulas();
  const displayValues = range.getDisplayValues();
  const missing = [];
  const invalid = [];
  const calculationErrors = [];
  let expectedFormulaCells = 0;
  let presentFormulaCells = 0;

  physicalProducts.forEach(product => {
    getInventoryFormulaContract_(product).forEach(contract => {
      expectedFormulaCells++;
      const row = Number(product.inventoryRow);
      const columnNumber = inventoryColumnLetterToNumber_(contract.column);
      const actual = formulas[row - 1] && formulas[row - 1][columnNumber - 1] || '';
      const displayed = displayValues[row - 1] && displayValues[row - 1][columnNumber - 1] || '';
      const issue = {
        cell: contract.column + row,
        row: row,
        column: contract.column,
        product: product.name,
        category: product.category,
        type: product.type,
        expectedFormula: contract.formula,
        actualFormula: actual,
        displayedValue: displayed
      };

      if (!actual) {
        missing.push(issue);
      } else {
        presentFormulaCells++;
        if (!isEquivalentInventoryFormula_(actual, contract.formula)) {
          invalid.push(issue);
        }
      }

      if (actual && isSpreadsheetFormulaError_(displayed)) {
        calculationErrors.push(issue);
      }
    });
  });

  return {
    safe: missing.length === 0 && invalid.length === 0 && calculationErrors.length === 0,
    sheetName: sheet.getName(),
    products: physicalProducts.length,
    expectedFormulaCells: expectedFormulaCells,
    presentFormulaCells: presentFormulaCells,
    missingFormulaCells: missing.length,
    invalidFormulaCells: invalid.length,
    errorFormulaCells: calculationErrors.length,
    missing: missing,
    invalid: invalid,
    calculationErrors: calculationErrors
  };
}

function auditInventoryFormulaCoverage_(options) {
  const settings = options || {};
  const sheet = settings.sheet || getSheetByConfiguredName_(CONFIG.SHEETS.INVENTORY);
  if (!sheet) throw new Error('Nie znaleziono arkusza: ' + CONFIG.SHEETS.INVENTORY);
  const products = settings.products || scanInventoryProducts_();
  const audit = buildInventoryFormulaAudit_(sheet, products);

  logInfo(
    'FormulaAudit',
    'auditInventoryFormulaCoverage_',
    audit.safe ? 'Kontrakt formuł jest kompletny.' : 'Wykryto brakujące lub błędne formuły.',
    {
      sheet: audit.sheetName,
      expected: audit.expectedFormulaCells,
      present: audit.presentFormulaCells,
      missing: audit.missingFormulaCells,
      invalid: audit.invalidFormulaCells,
      calculationErrors: audit.errorFormulaCells
    }
  );
  return audit;
}

function formatInventoryFormulaAudit_(audit) {
  const lines = [
    'Arkusz: ' + audit.sheetName,
    'Produkty: ' + audit.products,
    'Oczekiwane formuły: ' + audit.expectedFormulaCells,
    'Obecne formuły: ' + audit.presentFormulaCells,
    'Brakujące: ' + audit.missingFormulaCells,
    'Nieprawidłowe: ' + audit.invalidFormulaCells,
    'Błędy obliczeń: ' + audit.errorFormulaCells,
    '',
    audit.safe ? 'Status: OK' : 'Status: WYMAGA NAPRAWY'
  ];

  const sample = audit.missing.concat(audit.invalid, audit.calculationErrors).slice(0, 12);
  if (sample.length) {
    lines.push('', 'Przykładowe komórki:');
    sample.forEach(issue => lines.push('- ' + issue.cell + ' — ' + issue.product));
  }
  return lines.join('\n');
}

function auditInventoryFormulaCoverageWithDialog() {
  return runSafely_(
    'FormulaAudit',
    'auditInventoryFormulaCoverageWithDialog',
    function() {
      const audit = auditInventoryFormulaCoverage_();
      SpreadsheetApp.getUi().alert(
        'Inventory PRO — audyt formuł',
        formatInventoryFormulaAudit_(audit),
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      return audit;
    },
    'Nie udało się przeprowadzić audytu formuł.'
  );
}
