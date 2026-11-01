# MORFIAI — existující publikovaný web

Tento repozitář je skutečný zdroj nasazení `morfiai.eu`. GitHub Pages publikuje větev `main`, kořen `/`. Pracovní větev se sama nepublikuje. Neměňte Pages nastavení ani produkční větev při kontrole návrhu.

## Obsah a společné komponenty

- `src/content.json`: český obsah šesti stránek.
- `templates/`: skutečné části původního publikovaného HTML, sdílené všemi stránkami — hlavička, hero, karty, rozdělená sekce, kontakt, patička.
- `src/components/interactive.tsx`: původní React komponenty z autorského repozitáře `nexversemino/cesky-drak-webove-krasy`, commit `fc39951cf18d1643afde79d003d5a375d0123b17`; zachované algoritmy průvodce, kurzoru, záře a pohybu. Změny řeší předání míčku mezi průvodcem a Arkanoidem.
- `src/client.tsx`: zapojení těchto komponent, původních Reveal/TypedTitle/Tilt/Magnetic efektů, navigace a omezeného pohybu.
- `assets/styles-Dsiogmp1.css`, `hero-video.css`, `dragon-viewer.css`, `mobile-fix.css`: původní design beze změny. Fonty Cormorant Garamond, Karla, JetBrains Mono zůstaly společné.
- `assets/site-navigation.css`: pouze navigace, přístupnost a nezbytné předávání kurzoru; žádná nová paleta ani typografický systém.

Produkční repozitář původně obsahoval jen sestavenou jednostránkovou React/TanStack prezentaci a pozdější nezávislé skripty. Starší autorský repozitář neobsahuje všechny živé úpravy. Proto se nepřestavuje podle jeho starší titulní stránky. Zachovává se skutečný nasazený markup a assety, z nichž se skládají skutečné statické stránky. React dál obsluhuje původní interaktivní komponenty. Nenačítá se starý jednostránkový router se serializovanými daty pouze pro `/` na nové cesty. Původní buildové soubory zůstávají zachované pro návrat a dohledání.

## Práce lokálně

```sh
npm ci
npm run build
npm test
npm run preview
```

Build klienta vyžaduje Node.js; sestavení statických stránek a náhled Python 3. Náhled běží jen na `http://127.0.0.1:4182`. Na Windows lze použít `Spustit-nahled.cmd`. Pokud už náhled běží, otevřete jeho adresu; nespouštějte další instanci na stejném portu.

HTML soubory v kořeni a adresářích `engine`, `command-center`, `milo`, `laya`, `blog` jsou generované. Obsah měňte ve společných zdrojích a potom spusťte build. Každá podstránka má vlastní `index.html`, společný `<base href="/">` a explicitní kotvy. GitHub Pages proto nepotřebuje hash router ani náhradní 404 pro obnovení podstránek. `.nojekyll` ponechává výstup jako statický web.

## Míček

`ScrollOrb` vytváří jediný `#morfiai-guide-ball`. Arkanoid jej nikdy nenahrazuje ani nekopíruje. Nahoře přebírá jeho transformaci hra; při odrolování pod více než 2 pixely se hra pozastaví a předá aktuální pozici zpět původnímu průvodci. Při návratu nahoru hra pokračuje. Tečka kurzoru je během hry skrytá, aby nevypadala jako druhý míček. Samotný kurzor nahrazuje plošinka, která sleduje myš v obou osách po celé uvítací obrazovce; po odrolování se skryje a vrátí běžný kurzor. Při omezeném pohybu se hra ani pohybující průvodce nespouští.

## Co se nezpřístupňuje

Stránky jsou prezentace. Nepřidávají účty, platby, falešná stažení ani spouštění nehotových produktů. Příběh MinoBuddy na blogu slouží k hledání partnerů; neobsahuje odkaz na platformu, registraci ani dětské účty.

Podrobnosti a omezení ověření: [docs/OVERENI.md](docs/OVERENI.md).
