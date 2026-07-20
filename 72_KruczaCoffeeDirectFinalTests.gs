/** Testy wyjątku KAWA Kruczej: B jest wejściem i stanem finalnym. */
function runKruczaCoffeeDirectFinalTests4310() {
  const products = [
    { name: 'KAWA COFFELAB SANTOS 1KG', inventoryRow: 562, type: 'NORMAL', category: 'KAWA', columns: { quantity: 'F', weight: 'B' } },
    { name: 'KAWA COFFELAB PRZELEW 0,5KG', inventoryRow: 563, type: 'NORMAL', category: 'KAWA', columns: { quantity: 'F', weight: 'B' } }
  ];
  products.forEach(product => {
    assertCondition_(isDirectFinalInventoryProduct_(product), 'Nie rozpoznano wyjątku: ' + product.name);
    assertCondition_(getDirectFinalInventoryColumn_(product) === 'B', 'Wyjątek KAWA musi wskazywać B.');
    assertCondition_(resolveTargetColumn_(product, 7, '') === 'B', 'Import liczby całkowitej musi trafić do B.');
    assertCondition_(resolveTargetColumn_(product, 0.75, '') === 'B', 'Import wartości dziesiętnej musi trafić do B.');
    assertCondition_(getInventoryFormulaContract_(product).length === 0, 'Audyt nie może oczekiwać formuł dla KAWA.');
  });

  const matrix = Array.from({length: 563}, () => []);
  matrix[561][1] = 7;
  matrix[562][1] = 6;
  const santos = readInventorySummaryItemFromMatrix_(matrix, products[0], 'KAWA');
  const przelew = readInventorySummaryItemFromMatrix_(matrix, products[1], 'KAWA');
  assertCondition_(santos.finalTotal === 7 && santos.cells.finalTotal === 'B562', 'Raport Santos nie czyta B562.');
  assertCondition_(przelew.finalTotal === 6 && przelew.cells.finalTotal === 'B563', 'Raport Przelew nie czyta B563.');
  return { passed: true, products: 2, cells: ['B562', 'B563'] };
}
