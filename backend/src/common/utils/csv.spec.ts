import { escapeCell, toCsv } from './csv';

describe('csv', () => {
  it('comillas, comas y saltos de línea se escapan', () => {
    expect(escapeCell('a,b')).toBe('"a,b"');
    expect(escapeCell('dice "hola"')).toBe('"dice ""hola"""');
    expect(escapeCell('línea1\nlínea2')).toBe('"línea1\nlínea2"');
  });

  it('neutraliza fórmulas (CSV injection)', () => {
    expect(escapeCell('=CMD("calc")')).toBe(`"'=CMD(""calc"")"`);
    expect(escapeCell('+1+1')).toBe(`'+1+1`);
    expect(escapeCell('@SUM(A1)')).toBe(`'@SUM(A1)`);
    expect(escapeCell('-2+3')).toBe(`'-2+3`);
  });

  it('los números negativos reales no se alteran', () => {
    expect(escapeCell(-5)).toBe('-5');
  });

  it('null, undefined, booleanos y fechas', () => {
    expect(escapeCell(null)).toBe('');
    expect(escapeCell(undefined)).toBe('');
    expect(escapeCell(true)).toBe('Sí');
    expect(escapeCell(false)).toBe('No');
    expect(escapeCell(new Date('2026-01-02T03:04:05Z'))).toBe('2026-01-02T03:04:05.000Z');
  });

  it('toCsv agrega BOM UTF-8 y usa CRLF', () => {
    const csv = toCsv([{ a: 'x', b: 1 }], [
      { header: 'A', value: (r) => r.a },
      { header: 'B', value: (r) => r.b },
    ]);
    expect(csv).toBe('﻿A,B\r\nx,1\r\n');
  });
});
