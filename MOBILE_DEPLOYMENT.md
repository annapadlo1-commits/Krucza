# Inventory PRO Mobile — uruchomienie KRUCZA

1. Wgraj wszystkie pliki projektu, w tym `UI_Mobile.html`.
2. Zapisz projekt Apps Script i odśwież arkusz KRUCZEJ jeden raz.
   To bezpiecznie wiąże aplikację mobilną z tym konkretnym arkuszem.
3. W arkuszu wybierz **INVENTORY PRO → Administracja → Skonfiguruj
   transkrypcję Gemini** i wklej klucz utworzony w Google AI Studio.
4. W Apps Script wybierz **Wdróż → Nowe wdrożenie → Aplikacja internetowa**.
5. Ustaw:
   - **Wykonuj jako:** właściciel aplikacji,
   - **Dostęp:** użytkownicy organizacji albo wskazani użytkownicy Google.
     Nie udostępniaj anonimowo, ponieważ aplikacja zapisuje inwenturę.
6. Kliknij **Wdróż**, zaakceptuj wymagane uprawnienia (w tym połączenia
   zewnętrzne) i skopiuj otrzymany URL.
7. Otwórz URL w Safari/Chrome na telefonie. Na iPhonie wybierz
   **Udostępnij → Dodaj do ekranu początkowego**.

Po kolejnych aktualizacjach użyj **Wdróż → Zarządzaj wdrożeniami → Edytuj →
Nowa wersja**, aby zachować ten sam mobilny adres.

PAWILONY i KRUCZA muszą mieć osobne wdrożenia oraz osobne adresy.

## Nagrywanie Gemini

- Jedno nagranie może trwać maksymalnie 3 minuty.
- Audio jest przetwarzane w pamięci i nie jest zapisywane w Dysku ani arkuszu.
- Gemini zwraca tylko transkrypt. Dopasowanie i zapis nadal wykonuje
  kontrolowany parser Inventory PRO po zatwierdzeniu przez użytkownika.
- Klucza API nie należy wpisywać bezpośrednio do żadnego pliku `.gs` lub HTML.
