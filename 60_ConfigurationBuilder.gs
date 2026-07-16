/**
 * Inventory PRO 4.3 — automatyczna konfiguracja produktów.
 * Mapowanie kolumn jest odczytywane z fizycznych nagłówków arkusza,
 * a CONFIG.INVENTORY_LAYOUT pozostaje bezpiecznym fallbackiem.
 */

function rebuildProductConfiguration() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Odbuduj konfigurację',
    'Skrypt wyczyści konfigurację w kolumnach D:L arkusza SŁOWNIK i zbuduje ją ponownie z arkusza ' + CONFIG.SHEETS.INVENTORY + '. Aliasy w A:B pozostaną bez zmian. Kontynuować?',
    ui.ButtonSet.YES_NO
  );
  if (response !== ui.Button.YES) return;

  try {
    const products = scanInventoryProducts_();
    if (!products.length) throw new Error('Nie znaleziono produktów w arkuszu ' + CONFIG.SHEETS.INVENTORY + '.');
    writeFullProductConfiguration_(products);
    invalidateProductCatalogCache_();
    ui.alert('Configuration Builder', 'Zbudowano konfigurację dla ' + products.length + ' produktów.', ui.ButtonSet.OK);
  } catch (error) {
    ui.alert('Błąd Configuration Builder', error.message || String(error), ui.ButtonSet.OK);
  }
}

function syncProductConfiguration() {
  const ui = SpreadsheetApp.getUi();
  try {
    const scannedProducts = scanInventoryProducts_();
    const existingIndex = getExistingConfigurationIndex_();
    const newProducts = scannedProducts.filter(product => !existingIndex[product.normalizedName]);
    if (!newProducts.length) {
      ui.alert('Synchronizacja zakończona', 'Nie znaleziono nowych produktów.', ui.ButtonSet.OK);
      return;
    }
    appendProductConfigurations_(newProducts);
    invalidateProductCatalogCache_();
    ui.alert('Synchronizacja zakończona', 'Dodano nowych produktów: ' + newProducts.length, ui.ButtonSet.OK);
  } catch (error) {
    ui.alert('Błąd synchronizacji', error.message || String(error), ui.ButtonSet.OK);
  }
}

function scanInventoryProducts_() {
  const sheet = getSheetByConfiguredName_(CONFIG.SHEETS.INVENTORY);
  if (!sheet) throw new Error('Nie znaleziono arkusza: ' + CONFIG.SHEETS.INVENTORY);

  const lastRow = sheet.getLastRow();
  const lastColumn = Math.max(sheet.getLastColumn(), 9);
  if (lastRow < 1) return [];

  const dataRange = sheet.getRange(1, 1, lastRow, lastColumn);
  const values = dataRange.getDisplayValues();
  const mergedHeaderRows = buildMergedHeaderRowMap_(dataRange);
  const normalColumns = detectInventoryInputColumnsFromHeaderRow_(
    values[0] || [], CONFIG.PRODUCT_TYPES.NORMAL,
    getInputColumnsForProductType_(CONFIG.PRODUCT_TYPES.NORMAL)
  );
  const kegColumns = detectInventoryInputColumnsFromHeaderRow_(
    values[0] || [], CONFIG.PRODUCT_TYPES.KEG,
    getInputColumnsForProductType_(CONFIG.PRODUCT_TYPES.KEG)
  );

  const products = [];
  const usedNames = {};
  let currentCategory = '';
  let currentType = CONFIG.PRODUCT_TYPES.NORMAL;
  let currentLocationColumns = getInputColumnsForProductType_(CONFIG.PRODUCT_TYPES.LOCATION);

  for (let rowIndex = 0; rowIndex < values.length; rowIndex++) {
    const sheetRow = rowIndex + 1;
    const rowValues = values[rowIndex] || [];
    const productName = String(rowValues[0] || '').trim();
    const rowText = rowValues.filter(Boolean).join(' ').trim();
    if (!rowText) continue;

    const detectedHeader = detectSectionHeader_(
      rowText, sheetRow, mergedHeaderRows, productName, rowValues
    );
    if (detectedHeader.isHeader) {
      currentCategory = detectedHeader.category;
      currentType = detectedHeader.type;
      if (currentType === CONFIG.PRODUCT_TYPES.LOCATION) {
        currentLocationColumns = detectInventoryInputColumnsFromHeaderRow_(
          rowValues, CONFIG.PRODUCT_TYPES.LOCATION,
          getInputColumnsForProductType_(CONFIG.PRODUCT_TYPES.LOCATION)
        );
      }
      continue;
    }

    if (!productName || isIgnoredInventoryText_(productName)) continue;
    const normalizedName = normalizeText(productName);
    if (!normalizedName) continue;
    if (usedNames[normalizedName]) {
      logWarning('ConfigurationBuilder', 'scanInventoryProducts_', 'Pominięto zduplikowaną nazwę produktu.', {
        product: productName, row: sheetRow
      });
      continue;
    }
    if (!currentCategory) {
      logWarning('ConfigurationBuilder', 'scanInventoryProducts_', 'Pominięto produkt bez fizycznej kategorii.', {
        product: productName, row: sheetRow
      });
      continue;
    }

    const effectiveType = inferInventoryProductType_(
      currentType, currentCategory, productName, rowValues
    );
    const columns = effectiveType === CONFIG.PRODUCT_TYPES.LOCATION
      ? currentLocationColumns
      : effectiveType === CONFIG.PRODUCT_TYPES.KEG
        ? kegColumns
        : normalColumns;

    usedNames[normalizedName] = true;
    products.push(createConfigurationProduct_(
      productName, normalizedName, currentCategory, effectiveType, sheetRow, columns
    ));
  }

  return products;
}

function buildMergedHeaderRowMap_(dataRange) {
  const map = {};
  if (!dataRange || typeof dataRange.getMergedRanges !== 'function') return map;
  dataRange.getMergedRanges().forEach(range => {
    if (range.getNumColumns() <= 1) return;
    for (let row = range.getRow(); row <= range.getLastRow(); row++) map[row] = true;
  });
  return map;
}

function detectSectionHeader_(rowText, sheetRow, mergedHeaderRows, firstCell, rowValues) {
  const primary = String(firstCell === undefined ? rowText : firstCell || '').trim();
  const normalizedPrimary = normalizeText(primary);
  const normalizedRow = normalizeText(rowText);
  const exactCategory = normalizeBusinessCategory_(primary);
  const isMergedHeader = Boolean((mergedHeaderRows || {})[sheetRow]);

  const isExactCategory = exactCategory &&
    normalizeText(exactCategory) === normalizedPrimary;
  const isKeg = normalizedPrimary === 'keg' || normalizedPrimary === 'piwo keg' ||
    normalizedPrimary === 'piwa keg';
  const isBottleBeer = normalizedPrimary.indexOf('piwo butel') === 0 ||
    normalizedPrimary.indexOf('piwa butel') === 0;
  const isSoft = exactCategory === 'SOFTY' || normalizedPrimary === 'softy' ||
    normalizedPrimary.indexOf('softy na szt') === 0;
  const isGenericBeer = exactCategory === 'PIWO' || normalizedPrimary === 'piwo' ||
    normalizedPrimary === 'piwa';

  if (isKeg) {
    return { isHeader: true, category: 'PIWO KEG', type: CONFIG.PRODUCT_TYPES.KEG };
  }
  if (isBottleBeer) {
    return { isHeader: true, category: 'PIWO BUTELKI', type: CONFIG.PRODUCT_TYPES.LOCATION };
  }
  if (isSoft) {
    return { isHeader: true, category: 'SOFTY', type: CONFIG.PRODUCT_TYPES.LOCATION };
  }
  if (isGenericBeer) {
    return { isHeader: true, category: 'PIWO', type: CONFIG.PRODUCT_TYPES.NORMAL };
  }
  if (isExactCategory || (isMergedHeader && exactCategory)) {
    return { isHeader: true, category: exactCategory, type: CONFIG.PRODUCT_TYPES.NORMAL };
  }

  // Zgodność ze starszymi arkuszami, w których pełny tekst nagłówka był scalony.
  const rowCategory = isMergedHeader ? normalizeBusinessCategory_(normalizedRow) : '';
  if (rowCategory) {
    return {
      isHeader: true,
      category: rowCategory,
      type: rowCategory === 'SOFTY' || rowCategory === 'PIWO BUTELKI'
        ? CONFIG.PRODUCT_TYPES.LOCATION
        : rowCategory === 'PIWO KEG'
          ? CONFIG.PRODUCT_TYPES.KEG
          : CONFIG.PRODUCT_TYPES.NORMAL
    };
  }

  return { isHeader: false, category: '', type: '' };
}

function isLikelyCategoryHeader_(rowText) {
  const normalized = normalizeText(rowText);
  if (!normalized) return false;
  return Boolean(normalizeBusinessCategory_(normalized));
}

function isIgnoredInventoryText_(text) {
  return [
    'produkt', 'produkty', 'nazwa produktu', 'wpis uzytkownika',
    'razem', 'suma', 'waga szt w butelce kegu'
  ].includes(normalizeText(text));
}

function createConfigurationProduct_(name, normalizedName, category, type, inventoryRow, detectedColumns) {
  const columns = cloneProductColumns_(
    detectedColumns || getInputColumnsForProductType_(type)
  );
  return {
    name: name,
    normalizedName: normalizedName,
    type: type,
    category: requireBusinessCategory_(category, name, inventoryRow),
    inventoryRow: inventoryRow,
    columns: columns,
    active: true
  };
}

function writeFullProductConfiguration_(
  products
) {
  const sheet = getDictionarySheet_();

  ensureConfigurationHeaders_(sheet);

  const rowsToClear = Math.max(
    sheet.getMaxRows() - 1,
    1
  );

  sheet
    .getRange(2, 4, rowsToClear, 9)
    .clearContent();

  const output = products.map(
    configurationToRow_
  );

  if (output.length) {
    sheet
      .getRange(
        2,
        4,
        output.length,
        9
      )
      .setValues(output);
  }

  formatConfigurationTable_(
    sheet,
    output.length
  );
}

function appendProductConfigurations_(
  products
) {
  const sheet = getDictionarySheet_();

  ensureConfigurationHeaders_(sheet);

  const output = products.map(
    configurationToRow_
  );

  if (!output.length) return;

  const startRow =
    findNextConfigurationRow_(sheet);

  sheet
    .getRange(
      startRow,
      4,
      output.length,
      9
    )
    .setValues(output);

  formatConfigurationTable_(
    sheet,
    startRow + output.length - 2
  );
}

function configurationToRow_(product) {
  return [
    product.name,
    product.type,
    product.category,
    product.columns.quantity,
    product.columns.weight,
    product.columns.warehouse,
    product.columns.darkroom,
    product.columns.fridges,
    product.active ? 'TAK' : 'NIE'
  ];
}

function getExistingConfigurationIndex_() {
  const index = {};

  loadProductConfigurations()
    .forEach(product => {
      index[product.normalizedName] = true;
    });

  return index;
}

function findNextConfigurationRow_(sheet) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return 2;

  const values = sheet
    .getRange(
      2,
      4,
      lastRow - 1,
      1
    )
    .getDisplayValues();

  for (
    let index = 0;
    index < values.length;
    index++
  ) {
    if (
      !String(values[index][0] || '')
        .trim()
    ) {
      return index + 2;
    }
  }

  return lastRow + 1;
}

function ensureConfigurationHeaders_(sheet) {
  const labels = getLocationColumnLabelMap_();
  sheet
    .getRange(1, 4, 1, 9)
    .setValues([[
      'Produkt',
      'Typ',
      'Kategoria',
      'Kolumna sztuk',
      'Kolumna wagi',
      labels.warehouse || 'Lokalizacja 1',
      labels.darkroom || 'Lokalizacja 2',
      labels.fridges || 'Lokalizacja 3',
      'Aktywny'
    ]])
    .setFontWeight('bold')
    .setBackground('#d9ead3');
}

function formatConfigurationTable_(
  sheet,
  productCount
) {
  sheet.autoResizeColumns(4, 9);

  if (productCount > 0) {
    sheet
      .getRange(
        2,
        4,
        productCount,
        9
      )
      .setVerticalAlignment('middle');
  }
}

function cleanCategoryName_(rowText) {
  return String(rowText || '')
    .replace(/\s+/g, ' ')
    .trim();
}
