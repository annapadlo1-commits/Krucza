/** Inventory PRO 4.3 — jedno źródło prawdy dla układu INWENTURY. */

/**
 * Wyjątki Kruczej: dwa końcowe produkty KAWA nie korzystają z formuł.
 * Wartość wpisana do B jest jednocześnie wartością finalną raportu.
 */
function isDirectFinalInventoryProduct_(product) {
  const name = normalizeText(product && (product.name || product.product) || '');
  return [
    'kawa coffelab santos 1kg',
    'kawa coffelab santos 1 kg',
    'kawa coffelab przelew 0 5kg',
    'kawa coffelab przelew 0 5 kg'
  ].indexOf(name) >= 0;
}

function getDirectFinalInventoryColumn_(product) {
  return isDirectFinalInventoryProduct_(product) ? 'B' : '';
}

function getConfiguredInventoryLayout_(productType) {
  const type = String(productType || '').trim().toUpperCase();
  const configured = CONFIG.INVENTORY_LAYOUT && CONFIG.INVENTORY_LAYOUT[type];
  if (!configured) return null;
  const copy = {};
  Object.keys(configured).forEach(key => {
    copy[key] = Array.isArray(configured[key]) ? configured[key].slice() : configured[key];
  });
  return copy;
}

function getInputColumnsForProductType_(productType) {
  const type = String(productType || '').trim().toUpperCase();
  const layout = getConfiguredInventoryLayout_(type) || {};
  if (type === CONFIG.PRODUCT_TYPES.LOCATION) {
    return {
      quantity: '', weight: '',
      warehouse: String(layout.warehouse || '').toUpperCase(),
      darkroom: String(layout.darkroom || '').toUpperCase(),
      fridges: String(layout.fridges || '').toUpperCase()
    };
  }
  return {
    quantity: String(layout.fullUnits || '').toUpperCase(),
    weight: String(layout.grossWeight || '').toUpperCase(),
    warehouse: '', darkroom: '', fridges: ''
  };
}

function getFormulaColumnsForProductType_(productType) {
  const layout = getConfiguredInventoryLayout_(productType) || {};
  return (layout.formulaColumns || []).map(normalizeColumnLetter_).filter(Boolean);
}

function getAllowedInputColumnsForProductType_(productType) {
  const columns = getInputColumnsForProductType_(productType);
  return Array.from(new Set([
    columns.quantity, columns.weight, columns.warehouse,
    columns.darkroom, columns.fridges
  ].map(normalizeColumnLetter_).filter(Boolean)));
}

function isFormulaColumnForProductType_(productType, column) {
  const wanted = normalizeColumnLetter_(column);
  return Boolean(wanted && getFormulaColumnsForProductType_(productType).indexOf(wanted) >= 0);
}

function isAllowedInputColumnForProductType_(productType, column) {
  const wanted = normalizeColumnLetter_(column);
  return Boolean(wanted && getAllowedInputColumnsForProductType_(productType).indexOf(wanted) >= 0);
}

function assertSafeInventoryTargetColumn_(product, column) {
  const directFinal = getDirectFinalInventoryColumn_(product);
  const wantedDirect = normalizeColumnLetter_(column);
  if (directFinal) {
    if (wantedDirect !== directFinal) {
      throw new Error('Produkty KAWA Kruczej z wierszy 562–563 mogą być zapisywane wyłącznie do kolumny B.');
    }
    return directFinal;
  }
  const type = String(product && product.type || '').trim().toUpperCase();
  const wanted = normalizeColumnLetter_(column);
  const name = String(product && product.name || '').trim() || 'nieznany produkt';
  if (!wanted) throw new Error('Nie ustalono kolumny docelowej dla produktu „' + name + '”.');
  if (isFormulaColumnForProductType_(type, wanted)) {
    throw new Error('Zablokowano zapis produktu „' + name + '” do kolumny obliczeniowej ' + wanted + '.');
  }
  if (!isAllowedInputColumnForProductType_(type, wanted)) {
    throw new Error('Kolumna ' + wanted + ' nie jest dozwolonym polem wejściowym dla typu ' + type + '.');
  }
  return wanted;
}

function cloneProductColumns_(columns) {
  const source = columns || {};
  return {
    quantity: String(source.quantity || '').toUpperCase(),
    weight: String(source.weight || '').toUpperCase(),
    warehouse: String(source.warehouse || '').toUpperCase(),
    darkroom: String(source.darkroom || '').toUpperCase(),
    fridges: String(source.fridges || '').toUpperCase()
  };
}

/** Centralna walidacja mapowania używana również przez Product Manager. */
function validateProductColumnMapping_(productType, columns, product) {
  const type = String(productType || '').trim().toUpperCase();
  const source = cloneProductColumns_(columns);
  const errors = [];

  if (isDirectFinalInventoryProduct_(product)) {
    const directColumn = getDirectFinalInventoryColumn_(product);
    if (source.quantity !== directColumn) {
      errors.push('Wyjątek finalny musi mieć kolumnę sztuk ' + directColumn + '.');
    }
    ['weight', 'warehouse', 'darkroom', 'fridges'].forEach(key => {
      if (source[key]) errors.push('Wyjątek finalny nie może używać pola „' + key + '”.');
    });
    return { valid: errors.length === 0, errors: errors, columns: source };
  }

  const allowed = getAllowedInputColumnsForProductType_(type);
  const formulas = getFormulaColumnsForProductType_(type);
  const used = {};
  Object.keys(source).forEach(key => {
    const column = normalizeColumnLetter_(source[key]);
    if (!column) return;
    if (formulas.indexOf(column) >= 0) {
      errors.push('Pole „' + key + '” wskazuje kolumnę formuły ' + column + '.');
    }
    if (allowed.indexOf(column) < 0) {
      errors.push('Pole „' + key + '” wskazuje niedozwoloną kolumnę ' + column + '.');
    }
    if (used[column]) {
      errors.push('Kolumna ' + column + ' została przypisana do więcej niż jednego pola.');
    }
    used[column] = key;
  });

  if (type === CONFIG.PRODUCT_TYPES.LOCATION) {
    if (!source.warehouse && !source.darkroom && !source.fridges) {
      errors.push('Produkt LOCATION musi mieć co najmniej jedną kolumnę lokalizacji.');
    }
    if (source.quantity || source.weight) {
      errors.push('Produkt LOCATION nie może korzystać z pól ilości/wagi.');
    }
  } else {
    if (!source.quantity && !source.weight) {
      errors.push('Produkt ' + type + ' musi mieć kolumnę sztuk lub wagi.');
    }
    if (source.warehouse || source.darkroom || source.fridges) {
      errors.push('Produkt ' + type + ' nie może korzystać z kolumn lokalizacji.');
    }
  }
  return { valid: errors.length === 0, errors: errors, columns: source };
}

function detectInventoryInputColumnsFromHeaderRow_(rowValues, productType, fallbackColumns) {
  const type = String(productType || '').trim().toUpperCase();
  const detected = cloneProductColumns_(fallbackColumns || getInputColumnsForProductType_(type));
  const values = rowValues || [];

  if (type === CONFIG.PRODUCT_TYPES.LOCATION) {
    values.forEach((value, index) => {
      const area = resolveLocationArea_(value);
      if (area && area.columnKey) detected[area.columnKey] = columnNumberToLetter_(index + 1);
    });
    return detected;
  }

  values.forEach((value, index) => {
    const normalized = normalizeText(value || '');
    if (!normalized) return;
    const column = columnNumberToLetter_(index + 1);
    if (isGrossInventoryHeader_(normalized)) detected.weight = column;
    if (isFullUnitsInventoryHeader_(normalized, type)) detected.quantity = column;
  });
  return detected;
}

function isGrossInventoryHeader_(normalizedHeader) {
  const value = String(normalizedHeader || '');
  return value.indexOf('waga szt w butelce') >= 0 ||
    value.indexOf('waga brutto') >= 0 ||
    value === 'waga w kegu' || value.indexOf('waga w kegu') >= 0;
}

function isFullUnitsInventoryHeader_(normalizedHeader, productType) {
  const value = String(normalizedHeader || '');
  if (String(productType || '').toUpperCase() === CONFIG.PRODUCT_TYPES.KEG) {
    return value.indexOf('pelne kegi') >= 0 || value.indexOf('pelne keg') >= 0;
  }
  return value.indexOf('pelne btlk szt') >= 0 ||
    value.indexOf('pelne butelki szt') >= 0 || value.indexOf('pelne szt') >= 0;
}

function inferInventoryProductType_(sectionType, category, productName, rowValues) {
  const normalizedName = normalizeText(productName || '');
  const normalizedCategory = normalizeText(category || '');
  const currentType = String(sectionType || CONFIG.PRODUCT_TYPES.NORMAL).toUpperCase();

  if (currentType === CONFIG.PRODUCT_TYPES.LOCATION) return CONFIG.PRODUCT_TYPES.LOCATION;
  if (/(^|\s)keg(\s|$)/.test(normalizedName)) return CONFIG.PRODUCT_TYPES.KEG;
  if (normalizedCategory === 'piwo keg') return CONFIG.PRODUCT_TYPES.KEG;
  if (normalizedCategory === 'piwo' && isLikelyKegInventoryRow_(rowValues)) {
    return CONFIG.PRODUCT_TYPES.KEG;
  }
  return currentType === CONFIG.PRODUCT_TYPES.KEG ? CONFIG.PRODUCT_TYPES.KEG : CONFIG.PRODUCT_TYPES.NORMAL;
}

function isLikelyKegInventoryRow_(rowValues) {
  if (!Array.isArray(rowValues) || !rowValues.length) return false;
  const layout = getConfiguredInventoryLayout_(CONFIG.PRODUCT_TYPES.KEG) || {};
  const capacityIndex = inventoryColumnLetterToNumber_(String(layout.unitCapacity || '')) - 1;
  if (capacityIndex < 0 || capacityIndex >= rowValues.length) return false;
  const raw = String(rowValues[capacityIndex] || '').trim().replace(',', '.');
  const capacity = Number(raw);
  return Number.isFinite(capacity) && capacity > 5;
}

function inventoryColumnLetterToNumber_(letters) {
  return String(letters || '').toUpperCase().split('').reduce((total, character) => {
    const code = character.charCodeAt(0) - 64;
    return code >= 1 && code <= 26 ? total * 26 + code : total;
  }, 0);
}

function columnNumberToLetter_(columnNumber) {
  let number = Number(columnNumber) || 0;
  let result = '';
  while (number > 0) {
    const remainder = (number - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    number = Math.floor((number - 1) / 26);
  }
  return result;
}
