# HvSoldat

Självhostad prototyp av ett digitalt administrativt stödsystem för Hemvärnets kompani- och bataljonsförband. Syftet är att ersätta manuella processer (Excel-listor, pappersblanketter, e-post) med ett modernt webbgränssnitt anpassat för Hemvärnets organisationsstruktur och roller.

> **Status:** Aktiv prototyp — funktionell men inte produktionsklar. BankID-integration implementerad och testad (se `bankid`-branch). E-postnotifieringar via Resend. Publikt tillgänglig via Cloudflare Tunnel + Cloudflare Access (https://hvsoldat.jv10.se).

![HvSoldat dashboard](screenshot.png)

---

## Arkitektur

```
┌─────────────────────────────────────────────────────┐
│  Webbläsare                                         │
│  React 18 + Vite + Tailwind CSS                     │
└───────────────────┬─────────────────────────────────┘
                    │ HTTP/JSON (REST)
┌───────────────────▼─────────────────────────────────┐
│  Node.js 20 + Express                               │
│  JWT-autentisering · Rollbaserad åtkomstkontroll    │
└───────────────────┬─────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────┐
│  PostgreSQL 15                                      │
│  org_units · users · activities · reports           │
│  equipment · equipment_cases · inventory            │
└─────────────────────────────────────────────────────┘
```

**Stack:**
- **Frontend:** React 18, Vite, Tailwind CSS, React Router
- **Backend:** Node.js 20, Express, `pg` (PostgreSQL-klient), `jsonwebtoken`, `multer`, `xlsx`, `pdf-lib` (AFSE-generering), `resend` (e-post)
- **Databas:** PostgreSQL 15
- **Deploy:** LXC-container på Proxmox (Debian), systemd-tjänst

---

## Roller och behörigheter

| Kod | Roll | Behörighet |
|-----|------|-----------|
| `soldat` | Soldat | Egna ärenden, utrustning, kalender |
| `grpc` | Gruppchef | + Enhetssida (gruppens medlemmar) |
| `pc` | Plutonchef | + Granska km-ers/utlägg, skapa aktiviteter |
| `toc` | Troppchef | Som pc |
| `kompc` | Kompanichef | + Attestera rapporter, utrustningsärenden, personalimport |
| `kvm` | Komp-VKM | Som kompc |
| `s4` | S4 / Bat-VKM | Som kompc |
| `batc` | Bataljonschef | Som kompc |
| `s1` | S1 | Som kompc |

Inloggning sker idag via **simulerad BankID** (rollväljare) på `master`. Grenen `bankid` innehåller fullständig BankID-integration via **Idura/Criipto** (OIDC) — testad end-to-end med BankID för fil (Windows) och Mobilt BankID. Kräver Idura production-credentials och HTTPS för produktionsdrift.

---

## Implementerade förmågor

### Kalender
- Aktiviteter (övning, utbildning, möte, övrigt) kopplade till org-enhet
- OSA-svar: Ja / Nej / Kanske, per person
- Svarssummering visas direkt på aktivitetskortet (✓ / ✗ / ?)
- Expanderbar deltagarlista grupperad per org-enhet
- gruppchef+ kan skapa aktiviteter

### Redovisningar (Km-ers / Utlägg / SÄVA)
- **Km-ersättning** — antal kilometer
- **Utlägg** — belopp + syfte, påminnelse om originalkvitto
- **SÄVA** (Särskild Visstidsanställning) — antal timmar, används för säkerhetsintervjuer, bostadsbesiktningar, förrådsbesök m.m.
- Fritext-aktivitet ("Övrigt") när ingen kalenderaktivitet finns
- Godkännandekedja: **Soldat → Plutonchef (granskar) → Kompanichef (attesterar)**
- Plutonchef kan avfärda med motivering — visas för soldaten
- Soldaten kan redigera och skicka in igen
- Attesterade rapporter sparas som historik (sökbar av KompC)
- Excel-export av attesterade rapporter för MR-grupp (med datum­filter och markering av vad som skickats)
- Badge-notifikation i navigation för väntande ärenden

### Utrustningshantering
- Personlig utrustningslista per soldat med bilder
- Rapportera förlust eller begära byte (och ev. beställa transport)
- Ärendeflöde: soldat → KVM (godkänn/avslå)
- Förlustblankett (M7102-500360E) genereras för utskrift
- Kompaniinventering — KVM initierar med valfritt deadline-datum, soldater bekräftar sina artiklar

### Nyheter
- Nyhetsflöde på dashboarden synligt för alla inloggade
- Logistikroller (kompc/kvm/s4/batc/s1) kan skapa och redigera nyheter
- Stöd för bild, schemalagd publicering (publish_at) och omedelbar publicering

### Organisation
- Hierarkiskt org-träd: bataljon → kompani → pluton → Tropp → grupp
- Stöd för HvKomp-struktur: Chefsgrupp, Stab/TrossPluton, 1–4 Plutoner
- Import av personal från ODS/XLSX (PRIO-export)
  - Förhandsgranskning med möjlighet att redigera/ta bort rader
  - Automatisk mappning till org-enhet
  - Idempotent (re-import uppdaterar befintliga, skapar inte dubletter)
- Redigering av enskilda personer (namn, roll, enhet, kontakt)

### Dashboard / Översikt
- Personlig vy: nästa aktivitet, egna ärenden, utrustningsstatus
- Anpassad efter inloggad roll

---

## Databasschema (översikt)

```
org_units          — hierarkiskt träd (id, name, type, parent_id)
users              — personal (personal_number som nyckel, role, org_unit_id)
activities         — kalenderaktiviteter
activity_responses — OSA per person (ja/nej/kanske)
reports            — km-ers/utlägg/SÄVA (status: draft→submitted→reviewed→approved, mr_submitted_at)
equipment_templates — materialkatalog
equipment_items    — personlig utrustning
equipment_cases    — ärenden (förlust/byte)
inventory_sessions — inventeringsomgångar (med deadline)
inventory_items    — per-person-svar på inventering
news_posts         — nyheter (publish_at, image_url)
```

---

## Komma igång (lokal utveckling)

**Krav:** Node.js 20+, PostgreSQL 15

### 1. Klona och installera

```bash
git clone https://github.com/SGL70/hvsoldat.git
cd hvsoldat

cd backend && npm install
cd ../frontend && npm install
```

### 2. Konfigurera miljövariabler

```bash
cd backend
cp .env.example .env
# Redigera .env — sätt DATABASE_URL och ett slumpmässigt JWT_SECRET
```

### 3. Skapa databasen

```bash
# Skapa PostgreSQL-databas och användare
psql -U postgres <<'SQL'
CREATE USER bataljon WITH PASSWORD 'ditt-lösenord';
CREATE DATABASE bataljon OWNER bataljon;
SQL

# Kör schema, migrationer och seed-data i ett steg
cd backend
npm run db:setup
```

`db:setup` kör följande filer i ordning:

| Fil | Innehåll |
|-----|----------|
| `schema.sql` | Alla tabeller |
| `migrate_org_stab.sql` | Stöd för stab-enhetstyp |
| `migrate_catalog.sql` | Utökad materialkatalog |
| `migrate_inventory.sql` | Inventeringstabeller |
| `migrate_loss.sql` | Förlustärenden |
| `migrate_prio.sql` | PRIO-import |
| `migrate_mr.sql` | MR-spårning (mr_submitted_at på reports) |
| `migrate_sava.sql` | SÄVA-redovisning (dagslista, timmar) |
| `migrate_kvm_settings.sql` | KVM-inställningar för AFSE-förifyllning |
| `migrate_afse_tracking.sql` | AFSE-tidsstämplar och kvittering |
| `seed.sql` | Mock-användare + exempeldata |
| `seed_catalog.sql` | 73 standardartiklar (VSH033PG) |

### 4. Starta

```bash
# Backend (port 3000)
cd backend && npm start

# Frontend (nytt terminalfönster, port 5173)
cd frontend && npm run dev
```

Öppna `http://localhost:5173` — klicka på QR-koden för att välja testanvändare.

> **Obs:** Vite proxar `/api`-anrop till `http://localhost:3000`. Backend måste köra på port 3000 för att frontend ska fungera i dev-läge.

### Testanvändare

Klicka på QR-koden i inloggningsvyn för att öppna rollväljaren. Inga lösenord krävs i prototypläge.

| Namn | Personnummer | Roll |
|------|-------------|------|
| Erik Andersson | 199001010001 | Soldat |
| Sara Nilsson | 199001010002 | Gruppchef |
| Johan Lindqvist | 199001010003 | Plutonchef |
| Anna Bergström | 199001010004 | Kompanichef |
| Lars Eriksson | 199001010005 | Komp-KVM |
| Maria Karlsson | 199001010006 | S4/Bat-KVM |
| Peter Svensson | 199001010007 | Bataljonschef |

---

## Planerade förbättringar

### Nära (prototyp → MVP)
- [x] **BankID-integration** — implementerad via Idura/Criipto (OIDC) på `bankid`-branch. Testad med BankID för fil och Mobilt BankID. Kräver Idura production-credentials + HTTPS för merge till `master`.
- [x] **E-postnotifieringar** — Resend skickar notis vid ny aktivitet, nyhet, nytt ärende och statusändring
- [ ] Kalender: kategorisering i Avtalsövningar (KFÖ/SÖF/SÖB), Kompletteringsutbildning och Övrigt
- [ ] Kalender: SÖB-filtrering per roll (kompc/stf/fanjunkare/kvm)
- [ ] **Kalender: rikta aktivitet till specifik org-enhet** — idag skapas aktiviteter mot en fast enhet; behöver en enhetsväljarpe (bataljon/kompani/pluton/grupp) så t.ex. ett plutonsmöte bara syns för rätt pluton
- [ ] **Närvaro­registrering** — grpc och uppåt bokför faktisk närvaro efter genomförd aktivitet (separat från OSA-svar)
- [x] **Export km-ers → MR-Grupp HR** — Excel-export med datumfilter, attesterad-av och spårning av vad som skickats till MR
- [x] **AFSE PDF-ifyllning** — blankett M7102-500360E fylls i automatiskt från ärendedata + KVM-inställningar (myndighet, kostnadsställe m.m.); KVM laddar ned förifylld PDF med ett klick; AFSE-uppföljning visar status per ärende; soldat kvitterar mottagen materiel

### Funktionella tillägg
- [ ] Mobilanpassning / PWA (push-notiser)
- [ ] Befälsplanering / tjänstgöringslista
- [ ] Dokumenthantering (order, kallelser, instruktioner)
- [ ] Karta med övningsområden
- [ ] Skapa transportbeställningar

### Tekniska förbättringar
- [ ] Automatiserade tester (backend: Jest + supertest, frontend: Vitest)
- [ ] Säkerhetshärdning för exponering mot internet (rate limiting, CSP, audit log)
- [ ] Multi-kompani-stöd inom samma instans
- [ ] CI/CD-pipeline

### GDPR — krävs för produktionsdrift

Appen hanterar personuppgifter (namn, adress, telefon, personnummer, tjänstedata). Följande måste implementeras innan skarp drift:

- [ ] **Registerutdrag (Art. 15)** — exportfunktion (PDF/JSON) som samlar all data om en individ: profil, utrustningshistorik, ärenden, SÄVA-redovisningar, km-ersättning och aktivitetssvar
- [ ] **Rätten att bli glömd (Art. 17)** — anonymiserings­rutin som tar bort personidentifierande uppgifter men bevarar transaktioner (radering är inte alltid möjlig, se nedan)
- [ ] **Retention-policy och bakgrundsjobb:**
  - Kontaktuppgifter: aktiv + 1 år efter avslut
  - Aktivitetssvar: 2 år
  - SÄVA/km-ersättning: **7 år** (skattemässig preskription — *får ej raderas tidigare*)
  - Utrustningshistorik: hela tjänstgöringstiden
- [ ] **Integritetspolicy** — sida i appen som beskriver vilka uppgifter som behandlas, varför och hur länge
- [ ] **Personnummer som nyckel** — bör ersättas med ett internt Hv-ID; personnummer används idag som inloggnings-ID vilket ger onödig exponering
- [ ] **DPA-avtal** med serverleverantören om appen hostas externt

**Rättslig grund:** troligen *avtal* (Art. 6.1b) via hemvärnsavtalet och/eller *berättigat intresse* (Art. 6.1f). Kontakta Försvarsmaktens juridiska avdelning eller IMY för bekräftelse innan produktionssättning.

---

## API-översikt

Alla endpoints ligger under `/api/` och kräver JWT i `Authorization: Bearer`-headern om inget annat anges. Klientsidan finns i `frontend/src/api/client.js`.

| Fil | Prefix | Syfte |
|-----|--------|-------|
| `auth.js` | `/api/auth` | Inloggning — mock BankID-bypass och JWT-utfärdning |
| `bankid.js` *(branch)* | `/api/auth/bankid` | Riktig BankID via Idura/Criipto OIDC — `/login` och `/callback` |
| `activities.js` | `/api/activities` | Kalenderaktiviteter, OSA-svar (ja/nej/kanske) och närvaro |
| `reports.js` | `/api/reports` | Km-ers / utlägg / SÄVA — skapande, inskickning och godkännandekedja (pc → kompc) |
| `personal.js` | `/api/personal` | Personalregister — lista, redigera och importera från ODS/XLSX |
| `equipment.js` | `/api/equipment` | Personlig utrustning, förlust- och bytesärenden |
| `catalog.js` | `/api/catalog` | Materialkatalog med bilduppladdning (admin) |
| `inventory.js` | `/api/inventory` | Kompaniinventering — starta, besvara och följa upp |
| `organizations.js` | `/api/orgs` | Org-träd — CRUD för enheter och medlemskap |
| `prio.js` | `/api/prio` | Parser och import av PRIO-exportfiler (ODS/XLSX) |
| `kvm.js` | `/api/kvm` | KVM-inställningar, AFSE-generering (pdf-lib), AFSE-uppföljning |

---

## Skalbarhet — 25 000 användare, 40 bataljoner

Prototypen är testad i ensam-kompani-läge men datamodell och autentisering är designade för att hålla i skala. Nedan beskrivs de tre verkliga problemen och hur de löses.

### Problem 1: Multi-tenancy saknas (allvarligt)

Idag är org-trädet ett enda träd i databasen. 40 bataljoner i samma träd med delad åtkomstkontroll innebär att en bug i `getSubtreeIds` kan läcka data över bataljonsgränser.

**Lösning:** PostgreSQL Row-Level Security (RLS) med en `battalion_id`-kolumn på alla känsliga tabeller, vilket ger isolering nära datan snarare än i applikationslagret.

```sql
-- Exempel: RLS på reports
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY battalion_isolation ON reports
  USING (battalion_id = current_setting('app.battalion_id')::int);
```

### Problem 2: `pendingCount` pollas vid varje sidladdning

`/api/reports/pending-count` (3–4 DB-queries) anropas varje gång Layout.jsx renderas för samtliga inloggade användare. Vid 1 000 aktiva användare som navigerar flitigt ger det konstant onödig databasbelastning för data som sällan ändras.

**Lösning:** Server-Sent Events (SSE) eller WebSocket för push när status ändras, alternativt Redis-cache med kort TTL (30 s). SSE är enklast att lägga till utan att ändra frontend-arkitekturen.

### Problem 3: Anslutningspoolning vid horisontell skalning

`pg.Pool` defaultar till 10 connections per Node.js-process. Med flera parallella processer bakom en load balancer multipliceras antalet connections mot PostgreSQL snabbt.

**Lösning:** PgBouncer i transaction mode framför databasen absorberar connection-trycket och gör att Node.js-processerna kan skalas ut fritt.

### Planerat arkitekturlyft

```
Cloudflare / CDN
      │
  Static SPA (nginx)
      │
  Load balancer
  ├── Node.js (PM2 cluster, 4 workers)
  ├── Node.js (PM2 cluster, 4 workers)
  └── ...
        │
    PgBouncer
        │
  PostgreSQL 15 (primary + read replica)
        │
    Redis (cache + SSE pub/sub)
```

Realistisk concurrent load för Hemvärnet: ~500–1 000 användare under ett övningsveckoslut. Den nuvarande stacken klarar det med PgBouncer och PM2 utan omskrivning — multi-tenancy-isoleringen är det som *måste* på plats innan produktion.

---

## Licens

MIT — fri att använda, modifiera och dela. Prototypen är inte granskad för hantering av sekretessbelagd information.
