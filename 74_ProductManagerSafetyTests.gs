/** UAT 4.3.14: Product Manager nie może zapisać konfiguracji do kolumn formuł. */
function runKruczaProductManagerSafetyTests4314() {
  const normal = { name:'Produkt testowy', type:'NORMAL' };
  assertCondition_(validateProductColumnMapping_('NORMAL', {
    quantity:'F', weight:'B', warehouse:'', darkroom:'', fridges:''
  }, normal).valid, 'Poprawne mapowanie NORMAL B/F zostało odrzucone.');
  assertCondition_(!validateProductColumnMapping_('NORMAL', {
    quantity:'H', weight:'B', warehouse:'', darkroom:'', fridges:''
  }, normal).valid, 'Product Manager musi blokować formułę H.');

  const location = { name:'Soft testowy', type:'LOCATION' };
  assertCondition_(validateProductColumnMapping_('LOCATION', {
    quantity:'', weight:'', warehouse:'B', darkroom:'C', fridges:''
  }, location).valid, 'Poprawne mapowanie LOCATION B/C zostało odrzucone.');
  assertCondition_(!validateProductColumnMapping_('LOCATION', {
    quantity:'', weight:'', warehouse:'B', darkroom:'D', fridges:''
  }, location).valid, 'Product Manager musi blokować formułę D dla LOCATION.');

  ['KAWA COFFELAB SANTOS 1KG', 'KAWA COFFELAB PRZELEW 0,5KG'].forEach(name => {
    const coffee = { name:name, type:'NORMAL' };
    const display = getProductManagerDisplayColumns_({
      name:name, type:'NORMAL', columns:{ quantity:'F', weight:'B' }
    });
    assertCondition_(display.quantity === 'B' && !display.weight,
      'Product Manager musi pokazywać wyłącznie B dla: ' + name);
    assertCondition_(validateProductColumnMapping_('NORMAL', {
      quantity:'B', weight:'', warehouse:'', darkroom:'', fridges:''
    }, coffee).valid, 'Product Manager musi akceptować direct-final B: ' + name);
    assertCondition_(!validateProductColumnMapping_('NORMAL', {
      quantity:'F', weight:'B', warehouse:'', darkroom:'', fridges:''
    }, coffee).valid, 'Zwykłe mapowanie musi być odrzucone dla: ' + name);
  });
  return { passed:true, protectedFormulaColumns:['D','H','I'], coffeeProducts:2 };
}
