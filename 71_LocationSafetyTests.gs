/** Testy 4.3.7: odpowiedniki lokalizacyjne Kruczej bez dostępu do arkusza. */
function runLocationSafetyTests437() {
  const context = createParserTestContext_([
    'Fritz Kola', 'Bombilla', 'Litovel Ciemny Lager', 'Inne Beczki Pilsner'
  ]);
  const cases = [
    { input: 'bar Fritz Kola zaplecze 4', product: 'Fritz Kola', value: 4, location: 'zaplecze', category: 'SOFTY' },
    { input: 'zaplecze Bombilla bar 7', product: 'Bombilla', value: 7, location: 'bar', category: 'SOFTY' },
    { input: 'bar Litovel Ciemny Lager zaplecze 12', product: 'Litovel Ciemny Lager', value: 12, location: 'zaplecze', category: 'PIWO BUTELKI' },
    { input: 'magazyn Inne Beczki Pilsner 2', product: 'Inne Beczki Pilsner', value: 2, location: 'zaplecze', category: 'PIWO BUTELKI' }
  ];
  cases.forEach(testCase => {
    const parsed = parseInventoryText(testCase.input, context);
    assertCondition_(parsed.length === 1, testCase.category + ': oczekiwano jednej pozycji.');
    assertCondition_(parsed[0].product === testCase.product, testCase.category + ': błędny produkt.');
    assertCondition_(parsed[0].value === testCase.value, testCase.category + ': błędna ilość.');
    assertCondition_(parsed[0].location === testCase.location, testCase.category + ': błędna lokalizacja.');
  });
  const multiline = parseInventoryText(
    'bar Fritz Kola 1\nzaplecze Fritz Kola 1\nbar Fritz Kola 1\nJurajska Pomarancza 12\nBombilla 1',
    createParserTestContext_(['Fritz Kola', 'Jurajska Pomarancza', 'Bombilla'])
  );
  assertCondition_(multiline.length === 5, 'Wielowierszowy wpis powinien zwrócić pięć pozycji.');
  assertCondition_(multiline[0].location === 'bar' && multiline[1].location === 'zaplecze',
    'Jawne lokalizacje w pierwszych wierszach są błędne.');
  assertCondition_(multiline[2].location === 'bar' && multiline[3].location === 'bar' && multiline[4].location === 'bar',
    'Kontekst Bar nie przeszedł na kolejne wiersze.');
  return { passed: true, location: CONFIG.LOCATION.ID, cases: cases.length + 1 };
}