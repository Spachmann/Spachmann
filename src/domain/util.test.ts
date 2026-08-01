import { describe, expect, it } from 'vitest';
import {
  addMonate,
  angefangeneMonate,
  parseEuroZuCent,
  parseDezimal,
  tageInZeitraum,
  ueberschneidungTage,
  verteileCent,
} from './util';

describe('Datumsfunktionen', () => {
  it('zählt beide Randtage mit', () => {
    expect(tageInZeitraum('2024-01-01', '2024-01-01')).toBe(1);
    expect(tageInZeitraum('2024-01-01', '2024-01-31')).toBe(31);
  });

  it('berücksichtigt Schaltjahre', () => {
    expect(tageInZeitraum('2024-01-01', '2024-12-31')).toBe(366);
    expect(tageInZeitraum('2023-01-01', '2023-12-31')).toBe(365);
  });

  it('liefert 0 bei umgekehrter Reihenfolge', () => {
    expect(tageInZeitraum('2024-12-31', '2024-01-01')).toBe(0);
  });

  it('ermittelt Überschneidungen', () => {
    expect(ueberschneidungTage({ von: '2024-01-01', bis: '2024-06-30' }, { von: '2024-06-01', bis: '2024-12-31' })).toBe(30);
    expect(ueberschneidungTage({ von: '2024-01-01', bis: '2024-01-31' }, { von: '2024-02-01', bis: '2024-12-31' })).toBe(0);
  });

  it('zählt angefangene Monate', () => {
    expect(angefangeneMonate('2024-01-01', '2024-12-31')).toBe(12);
    expect(angefangeneMonate('2024-04-15', '2024-12-31')).toBe(9);
    expect(angefangeneMonate('2024-01-01', '2024-01-31')).toBe(1);
  });

  it('addiert Monate über Monatsenden hinweg', () => {
    expect(addMonate('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonate('2024-12-31', 12)).toBe('2025-12-31');
  });
});

describe('parseEuroZuCent', () => {
  it('versteht deutsche und englische Schreibweise', () => {
    expect(parseEuroZuCent('1.234,56')).toBe(123456);
    expect(parseEuroZuCent('1234,56')).toBe(123456);
    expect(parseEuroZuCent('1234.56')).toBe(123456);
    expect(parseEuroZuCent('  89,90 € ')).toBe(8990);
    expect(parseEuroZuCent('')).toBe(0);
    expect(parseEuroZuCent('abc')).toBe(0);
  });

  it('rundet auf volle Cent', () => {
    expect(parseEuroZuCent('0,005')).toBe(1);
    expect(parseEuroZuCent('0,004')).toBe(0);
  });
});

describe('parseDezimal', () => {
  it('liest deutsche Dezimalzahlen', () => {
    expect(parseDezimal('72,5')).toBe(72.5);
    expect(parseDezimal('1.250,75')).toBe(1250.75);
    expect(parseDezimal('80')).toBe(80);
  });
});

describe('verteileCent', () => {
  it('verteilt verlustfrei', () => {
    const teile = verteileCent(10000, [1, 1, 1]);
    expect(teile.reduce((a, b) => a + b, 0)).toBe(10000);
    expect(teile).toEqual([3334, 3333, 3333]);
  });

  it('verteilt gewichtet', () => {
    expect(verteileCent(100000, [60, 40])).toEqual([60000, 40000]);
  });

  it('behält die Summe auch bei krummen Gewichten', () => {
    const gewichte = [72.34, 55.1, 88.9, 13.7, 101.11];
    for (const betrag of [1, 7, 99, 123457, 999999]) {
      const teile = verteileCent(betrag, gewichte);
      expect(teile.reduce((a, b) => a + b, 0)).toBe(betrag);
    }
  });

  it('gibt Nullen zurück, wenn kein Gewicht vorhanden ist', () => {
    expect(verteileCent(5000, [0, 0])).toEqual([0, 0]);
    expect(verteileCent(5000, [])).toEqual([]);
  });

  it('verteilt auch negative Beträge verlustfrei (Gutschriften)', () => {
    const teile = verteileCent(-10000, [1, 1, 1]);
    expect(teile.reduce((a, b) => a + b, 0)).toBe(-10000);
  });
});
