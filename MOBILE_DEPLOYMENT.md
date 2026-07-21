# Inventory PRO Mobile 4.6.0 — uruchomienie KRUCZA

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
   zewnętrzne, Dysk Google i wyzwalacze) i skopiuj otrzymany URL.
7. Otwórz URL w Safari/Chrome na telefonie. Na iPhonie wybierz
   **Udostępnij → Dodaj do ekranu początkowego**.

Po kolejnych aktualizacjach użyj **Wdróż → Zarządzaj wdrożeniami → Edytuj →
Nowa wersja**, aby zachować ten sam mobilny adres.

PAWILONY i KRUCZA muszą mieć osobne wdrożenia oraz osobne adresy.

## Dyktafon i Gemini

- Nagraj inwenturę w aplikacji **Dyktafon** na iPhonie.
- Przy nagraniu wybierz **… → Udostępnij → Zachowaj w Plikach**.
- W Inventory PRO wybierz **Wybierz nagrania** i wskaż jeden albo kilka plików.
- Jedno nagranie może trwać maksymalnie 10 minut i po przygotowaniu zajmować
  maksymalnie 20 MB.
- Aplikacja obsługuje typowy format iPhone `.m4a` oraz WAV, MP3 i AAC.
- Podczas komunikatu „Przesyłam — pozostań w aplikacji” nie blokuj telefonu.
  Gdy pojawi się „bezpiecznie zapisano”, można zmienić kartę lub zablokować
  telefon. Wynik zostanie odtworzony po powrocie.
- Audio i transkrypt są zapisywane tymczasowo na prywatnym Dysku właściciela
  wdrożenia, a po 24 godzinach automatycznie przenoszone do kosza.
- Gemini zwraca tylko transkrypt. Dopasowanie i zapis nadal wykonuje
  kontrolowany parser Inventory PRO po zatwierdzeniu przez użytkownika.
- Klucza API nie należy wpisywać bezpośrednio do żadnego pliku `.gs` lub HTML.

## Zmiany w 4.6.0

- trwała kolejka transkrypcji i automatyczne wznowienie po powrocie,
- wybór wielu nagrań,
- zachowanie transkryptu, wyników analizy, wyborów oraz wykluczeń,
- własne okna potwierdzeń bez technicznego adresu przeglądarki,
- wyłącznie kontrolowana lista aktywnych produktów,
- liczby całkowite otrzymują format `0`, więc nie wyświetlają się jako `12,`,
- odznaczony lub usunięty wiersz nie blokuje i nie trafia do importu.
