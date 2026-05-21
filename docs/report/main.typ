#set document(title: "Dictos - Local-First Text Processing App", author: "Yaroslav Zubakha")

// Page Setup matching san.cls margins
#set page(
  paper: "a4",
  margin: (left: 3cm, right: 2cm, top: 2.5cm, bottom: 2.5cm),
)

// Text Setup matching san.cls (Times 12pt, 1.5 line spacing)
#set text(
  font: "New Computer Modern", // Standard LaTeX-like font built into Typst
  size: 12pt,
  lang: "pl",
)

#set par(
  justify: true,
  first-line-indent: 1.25cm,
  leading: 0.8em, // Approximation of 1.5 line spacing
)

// Heading config
#set heading(numbering: "1.1")

// Ensure each top-level heading starts on a new page (like \pretocmd{\section}{\clearpage})
#show heading.where(level: 1): it => {
  pagebreak(weak: true)
  v(1em)
  it
  v(1em)
}

// Title Page
#align(center)[
  #v(1.5cm)
  #text(size: 18pt, weight: "bold")[Społeczna Akademia Nauk]\
  #v(0.5cm)
  #text(size: 14pt)[Instytut Technologii Informatycznych]\
  #v(0.5cm)
  Kierunek studiów:\
  #text(weight: "bold")[INFORMATYKA]\
  #v(0.5cm)
  Przedmiot:\
  #text(weight: "bold")[Systemy Szkieletowe]\
  #v(1cm)
  #text(size: 18pt, weight: "bold")[Dictos - Local-First Text Processing App]\
  #v(1cm)
  #text(weight: "bold")[Yaroslav Zubakha]\
  Nr albumu: 121546\
  Grupa: 2
]

#v(1fr)

#align(right)[
  #box(width: 45%, align(left)[
    Prowadzący:\
    #text(weight: "bold")[mgr inż. Krystian Gumiński]
  ])
]

#v(1fr)

#align(center)[Łódź 2026]

#pagebreak()

// Table of Contents
#outline(title: "Spis treści", indent: auto)

// Reset paragraph spacing for the rest of the document to avoid indent on first paragraphs after headings
#show heading: it => {
  it
  par(text(size:0pt, ""))
}

= Wstęp

Praca dotyczy zaprojektowania i implementacji aplikacji o nazwie Dictos. To narzędzie, które pomaga organizować własne słowniki i notatki z tekstów czytanych na czytnikach. Od początku założyliśmy architekturę "local-first". Oznacza to po prostu, że wszystko działa offline, a dane trzymane są na twoim dysku, a nie na serwerach zewnętrznych firm. W kolejnych rozdziałach opisałem jak to zbudowaliśmy, z naciskiem na środowisko Bun i framework ElysiaJS @knuth1984.

= Cel projektu

Zależało mi na rozwiązaniu bardzo konkretnego problemu: osoby uczące się z e-booków marnują dużo czasu na ręczne przepisywanie słówek do programów takich jak Anki. Dictos ma ten proces przyspieszyć. Podstawowe cele były jasne od początku:
- Szybkie dodawanie słów bezpośrednio z terminala.
- Generowanie definicji przez API (w tym wypadku Gemini).
- Eksport bazy prosto do formatów obsługiwanych przez Anki.
- Utrzymanie pełnej niezależności od chmury.

= Przegląd istniejących rozwiązań

Istnieje wiele narzędzi do nauki słówek, ale większość ma wady z perspektywy kogoś, kto chce po prostu szybko przetwarzać własne teksty i zachować nad nimi kontrolę @website_example.

== Aplikacje oparte o chmurę (np. Quizlet)
Działają wszędzie i fajnie się z nich korzysta. Niestety, zmuszają do trzymania swoich zestawów na ich serwerach. W ostatnich latach zaczęli chować podstawowe funkcje za płatnymi subskrypcjami. Jak padnie im serwer, to w ogóle nie poćwiczysz.

== Desktopowe kombajny (np. Anki)
Anki to świetny algorytm powtórek (Spaced Repetition System). Gorzej wypada przy tworzeniu samego materiału. Ręczne wpisywanie słówek z notatek wyciągniętych z czytnika to praca żmudna, której większość ludzi nie lubi. Brak tu warstwy automatyzującej to pierwsze „złapanie” i zdefiniowanie słowa.

== Słowniki przeglądarkowe
Rozszerzenia w przeglądarkach pozwalają na błyskawiczne tłumaczenie tekstów ze stron internetowych. Problem polega na tym, że zwykle zapisują słówka w postaci płaskiej listy. Ciężko to zorganizować w katalogi czy sprawnie zintegrować z nawykami kogoś, kto większość czasu spędza w terminalu, a czyta pliki TXT z e-inkowych czytników.

= Opis architektury

Całość opiera się na architekturze heksagonalnej (Hexagonal Architecture). Wybraliśmy to podejście, żeby odciąć logikę od technologii. Dzięki temu kod odpowiadający za biznes (obsługa słówek) nic nie wie o tym, czy uruchamiamy to w terminalu, czy na serwerze webowym.

#figure(
  table(
    columns: (auto, 1fr, 1fr),
    align: (center, left, center),
    [*Lp.*], [*Komponent*], [*Warstwa*],
    [1], [ElysiaJS Server], [Logika / API],
    [2], [OpenTUI], [Prezentacja (Terminal)],
    [3], [libSQL (SQLite)], [Baza Danych]
  ),
  caption: [Główne komponenty architektury systemu]
)

= Opis implementacji

Aplikację podzielono na pakiety wewnątrz monorepo. Użyliśmy narzędzia Bun, które pełni tu rolę menedżera pakietów, runtime'u oraz frameworka testowego w jednym.

== Frontend
Postawiłem na TUI (Terminal User Interface). Użyłem biblioteki OpenTUI, która umożliwia pisanie interfejsów terminalowych w React. Ekran główny to prosty dwupanelowy układ: po lewej drzewo katalogów, po prawej panel podglądu definicji. Prawie wszystko da się obsłużyć z klawiatury. Jeśli dużo czytasz i masz w nawyku pracować z terminalem, jest to o wiele szybsze niż przeklikiwanie się przez graficzne aplikacje.

== Backend
Sercem backendu jest aplikacja napisana w ElysiaJS uruchamiana w Bun. Serwer zajmuje się przyjmowaniem zapytań (na razie lokalnych), obsługą logiki biznesowej i komunikacją z API Gemini, żeby automatycznie pobierać definicje.
Co ważne, nie używam wyjątków do obsługi błędów. Zaimportowałem bibliotekę `errore` i korzystam z wzorca znanego z języka Go. Jeśli jakaś funkcja może zwrócić błąd, to go po prostu zwraca jako wartość. Eliminuje to zagmatwane bloki try-catch i sprawia, że łatwiej czyta się kod od góry do dołu.

== Baza Danych
Zamiast tradycyjnego serwera SQL wdrożyliśmy lokalną bazę libSQL (odmiana SQLite). Przechowujemy tam wszystko: przechwycone teksty (Captures), wygenerowane definicje (Definitions), katalogi oraz szablony zapytań do AI (Prompts). Skoro baza to tak naprawdę jeden plik u użytkownika na dysku, w przyszłości o wiele łatwiej będzie nam dodać prostą synchronizację.

== Docker
Część serwerową wsadziliśmy w kontenery Dockera. Sam Dockerfile opiera się na oficjalnym obrazie `oven/bun`. Dołączyliśmy też plik `docker-compose.yml`. Jeśli ktoś chce sprawdzić działanie serwera, po prostu wpisuje `docker-compose up` i wszystko się buduje. Odpada cały ból z ręcznym instalowaniem i ustawianiem środowiska od nowa.

== Testy
Testowanie logiki było niezbędne. Ponieważ aplikacja działa w ekosystemie Bun, zdecydowałem się na ich natywny runner (`bun test`). Wymaga zera konfiguracji, odpala się od razu i jest niezwykle szybki. Przygotowałem testy dla głównych serwisów (np. `CaptureService`) oraz dla samego serwera Elysia, testując między innymi czy nowo dodany moduł statusu zwraca poprawne kody HTTP.

== Monitoring
Monitorowanie aplikacji to zwykle domena dużych systemów rozproszonych, ale dla tej aplikacji też ma sens. Dodałem na serwerze endpoint `/health`. Jeśli w niego uderzysz, dowiesz się, czy serwer żyje i jak długo działa (uptime). Dodatkowo podpięliśmy podstawowy logger frameworka, więc po stronie terminala (lub w logach dockera) dokładnie widać przychodzące żądania. To wystarczy, żeby zdiagnozować ewentualny problem z wdrożeniem czy zapytaniami z frontendu.

= Podsumowanie i wnioski

Aplikacja Dictos w obecnej formie realizuje wszystkie założone cele pierwszej wersji. Zbudowanie stabilnego rdzenia z interfejsem terminalowym było konieczne, aby w przyszłości bez problemu dołożyć wariant mobilny oraz webowy. Docelowo system ma integrować się z przeglądarką i telefonem, by przechwytywanie słówek nie wymagało przełączania okien. Wdrożona lokalna baza danych oraz konteneryzacja ułatwią późniejszą implementację synchronizacji między urządzeniami.

#pagebreak()
#outline(title: "Spis tabel", target: figure.where(kind: table))
#outline(title: "Spis rysunków", target: figure.where(kind: image))

#bibliography("bibliografia.bib", style: "ieee")
