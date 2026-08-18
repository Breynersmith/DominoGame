import { IDIOMAS, traducir, TRADUCCIONES } from './traducciones';

describe('traducciones', () => {
  it('traduce una clave sin parámetros', () => {
    expect(traducir('es', 'iniciarPartida')).toBe('INICIAR PARTIDA');
    expect(traducir('en', 'iniciarPartida')).toBe('START GAME');
  });

  it('sustituye los parámetros {n} y {name}', () => {
    expect(traducir('es', 'fichas', { n: 5 })).toBe('5 fichas');
    expect(traducir('en', 'gana', { name: 'Ana' })).toBe('Ana wins the game!');
    expect(traducir('cat', 'turnoDe', { name: 'Marc' })).toBe('Torn de Marc');
  });

  it('deja intactas las claves sin parámetros al pasar un objeto', () => {
    expect(traducir('es', 'cancelar', { n: 2 })).toBe('Cancelar');
  });

  it('los tres idiomas tienen exactamente las mismas claves', () => {
    const claves = (d: typeof TRADUCCIONES.es) => Object.keys(d).sort().join(',');
    const es = claves(TRADUCCIONES.es);
    const en = claves(TRADUCCIONES.en);
    const cat = claves(TRADUCCIONES.cat);
    expect(es).toBe(en);
    expect(es).toBe(cat);
  });

  it('ninguna traducción queda vacía o sin traducir (misma que el original)', () => {
    for (const idioma of ['es', 'en', 'cat'] as const) {
      for (const clave of Object.keys(TRADUCCIONES.es) as (keyof typeof TRADUCCIONES.es)[]) {
        expect(TRADUCCIONES[idioma][clave].length).toBeGreaterThan(0);
      }
    }
  });

  it('expone los idiomas es, en y cat con su etiqueta', () => {
    expect(IDIOMAS.map(i => i.codigo)).toEqual(['es', 'en', 'cat']);
    expect(IDIOMAS.map(i => traducir('es', i.etiquetaClave))).toEqual([
      'Español',
      'English',
      'Català',
    ]);
  });
});