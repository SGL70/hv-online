import React from 'react';
import { Link } from 'react-router-dom';

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-bold text-military-navy mb-2">{title}</h2>
      <div className="text-sm text-gray-600 space-y-2">{children}</div>
    </div>
  );
}

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-xl font-bold text-military-navy mb-1">Integritetspolicy</h1>
        <p className="text-sm text-gray-500 mb-6">Hur HvOnline behandlar dina personuppgifter.</p>

        <Section title="Personuppgiftsansvarig">
          <p>
            [Ange förbandets/enhetens namn och kontaktuppgifter här — t.ex. e-postadress till S4
            eller motsvarande funktion som ansvarar för personuppgiftsbehandlingen.]
          </p>
        </Section>

        <Section title="Ändamål med behandlingen">
          <p>
            Uppgifterna används för att administrera tjänstgöring inom Hemvärnet: kalla till
            aktiviteter, föra närvaro, hantera personlig utrustning och ärenden kring den,
            samt handlägga ersättningar (km-ersättning, utlägg, SÄVA-redovisning).
          </p>
        </Section>

        <Section title="Vilka uppgifter som lagras">
          <ul className="list-disc list-inside space-y-1">
            <li>Kontaktuppgifter: namn, personnummer, e-post, mobilnummer, adress</li>
            <li>Ett internt Hv-ID används i stället för personnummer i de flesta listor och exporter</li>
            <li>Organisationstillhörighet och roll (bataljon/kompani/pluton/grupp)</li>
            <li>Utrustningshistorik och ärenden kopplade till den</li>
            <li>Svar på aktiviteter (OSA) och rapporterad närvaro</li>
            <li>Redovisningar för km-ersättning, utlägg och SÄVA</li>
          </ul>
        </Section>

        <Section title="Lagringstider">
          <ul className="list-disc list-inside space-y-1">
            <li>Kontaktuppgifter: aktiv tjänstgöring + 1 år efter avslut</li>
            <li>Aktivitetssvar (OSA): 2 år</li>
            <li>SÄVA-redovisning och km-ersättning: 7 år (skattemässig preskriptionstid)</li>
            <li>Utrustningshistorik: hela tjänstgöringstiden</li>
          </ul>
        </Section>

        <Section title="Dina rättigheter">
          <p>
            Du har rätt att få ut allt som är registrerat om dig (registerutdrag) och rätt att
            bli glömd (anonymisering av dina personuppgifter, med undantag för sådant som måste
            sparas enligt lag under en viss tid, t.ex. skatteunderlag).
          </p>
          <p>
            Ladda ned dina egna uppgifter under{' '}
            <Link to="/profil" className="text-military-navy underline hover:no-underline">
              Min profil
            </Link>. För att bli anonymiserad, kontakta din enhets S4 eller motsvarande.
          </p>
        </Section>

        <Section title="Kontakt">
          <p>
            Frågor om personuppgiftsbehandlingen riktas till personuppgiftsansvarig enligt ovan.
          </p>
        </Section>
      </div>
    </div>
  );
}
