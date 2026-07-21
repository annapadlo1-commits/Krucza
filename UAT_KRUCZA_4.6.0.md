# Inventory PRO KRUCZA 4.6.0 — UAT

## Zakres wydania

Wydanie łączy poprawki mobilne od wersji 4.5.5 z trwałą kolejką audio, wieloma nagraniami, limitem 10 minut, własnymi popupami, kontrolowaną listą produktów, zachowaniem sesji i formatowaniem liczb całkowitych bez końcowego przecinka.

## Testy automatyczne

- Nowe kontrakty mobilne i bezpieczeństwa: 25/25 PASS.
- Parser przykładowych wypowiedzi: 13/13 PASS.
- Wykluczony wiersz z błędem nie blokuje importu: PASS.
- Aktywny wiersz z błędem nadal blokuje zapis: PASS.
- Ochrona rodzin aliasów i niejednoznacznych pojemności: 5/5 PASS.
- Składnia wszystkich plików Apps Script i JavaScript UI: PASS.
- Format liczby całkowitej: 12 → format `0`: PASS.
- Format wartości dziesiętnej: 1,12 → format `0.###`: PASS.
- Rollback przywraca poprzednią wartość i format komórki: PASS.

## Scenariusze UAT na telefonie

1. Wybierz jedno nagranie 30–60 s. Nie blokuj telefonu do komunikatu „bezpiecznie zapisano”. Następnie zablokuj telefon na minutę, wróć i potwierdź pojawienie się transkryptu.
2. Wybierz trzy nagrania jednocześnie. Potwierdź kolejność w kolejce i połączenie wszystkich transkryptów bez duplikowania tekstu.
3. Wyłącz internet podczas transkrypcji, wróć do aplikacji, włącz internet i użyj „Ponów”, jeżeli zadanie ma status błędu.
4. Przeanalizuj `fernet branka 1` oraz `fernet branka 0,7 12`. Dla niejednoznacznej nazwy bez pojemności wybierz produkt z kontrolowanej listy.
5. Odznacz wiersz z aktywnym błędem. Zapis powinien dopuścić pozostałe poprawne pozycje i wykluczyć odznaczony wiersz.
6. Usuń wiersz przyciskiem „Usuń”. Nie może znaleźć się w imporcie.
7. Zamknij kartę po analizie i otwórz ponownie link. Transkrypt, pozycje, wybory produktów, wartości i odznaczenia powinny wrócić.
8. Zapisz całkowite wartości 12, 16 i 4. W arkuszu mają być liczbami wyświetlanymi bez końcowego przecinka.
9. Zapisz wartość 1,12. W arkuszu ma pozostać liczbą dziesiętną i uczestniczyć w formułach.
10. Anuluj własny popup zapisu. Żadna komórka nie może zostać zmieniona.

## Kryteria akceptacji

- Brak utraty sesji po zmianie karty po zakończonym przesłaniu.
- Brak systemowych popupów z adresem technicznym.
- Brak dowolnego tekstowego wyboru produktu poza aktywnym katalogiem.
- Brak zapisu odznaczonych lub usuniętych wierszy.
- Brak nadpisywania formuł i zachowanie transakcyjnego rollbacku.
- Nagrania tymczasowe usuwane automatycznie po 24 godzinach.

Uwaga: testy lokalne nie wysyłają danych do żywego arkusza. Ostatnie dziesięć scenariuszy należy wykonać po wdrożeniu jako kontrolowany test akceptacyjny na kopii arkusza albo na wyznaczonych wierszach testowych.
