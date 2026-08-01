import type { AppState } from '../domain/types';
import { uuid } from '../domain/util';

/** Leerer Ausgangszustand mit einem Objekt und einem Abrechnungszeitraum. */
export function leererZustand(): AppState {
  const objektId = uuid();
  const zeitraumId = uuid();
  const jahr = new Date().getFullYear() - 1;

  return {
    version: 1,
    objekt: {
      id: objektId,
      bezeichnung: '',
      strasse: '',
      plz: '',
      ort: '',
      leerstandPersonenFiktiv: 1,
      vermieter: { name: '', strasse: '', plz: '', ort: '' },
    },
    einheiten: [],
    mietverhaeltnisse: [],
    abrechnungszeitraeume: [
      {
        id: zeitraumId,
        objektId,
        bezeichnung: `Betriebskostenabrechnung ${jahr}`,
        von: `${jahr}-01-01`,
        bis: `${jahr}-12-31`,
      },
    ],
    kostenpositionen: [],
    verbraeuche: [],
    leerstandsverbraeuche: [],
    heizkosten: [
      {
        abrechnungszeitraumId: zeitraumId,
        aktiv: true,
        verbrauchsanteilHeizung: 70,
        verbrauchsanteilWarmwasser: 70,
        warmwasserErmittlung: 'FORMEL_9_2',
        warmwasserTemperaturC: 60,
        verbrauchsabhaengigAbgerechnet: true,
        verbrauchsinformationErteilt: true,
      },
    ],
    aktiverZeitraumId: zeitraumId,
  };
}
