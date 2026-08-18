import {
  calcularLayout,
  colocarFichas,
  valorLibre,
  LayoutResultado,
  FichaColocada,
} from './layoutTablero';
import { FichaEnTablero, ValorFicha } from '../game/types';

const PI = Math.PI;
const ROT_V = PI / 2;
const ROT_H_GIRO = PI;
const ROT_V_INV = PI + PI / 2;

function ficha(id: string, lado1: number, lado2: number, rotada = false): FichaEnTablero {
  return { id, lado1: lado1 as ValorFicha, lado2: lado2 as ValorFicha, rotada };
}

const C6 = ficha('6-6', 6, 6);

// Devuelve el pip de la ficha colocada que queda pegado a su origen
function pipDeConexion(p: FichaColocada): number {
  const f = p.ficha;
  if (p.rama === 'izquierda') {
    switch (p.direccion) {
      case 'izquierda': return p.rotZ === ROT_H_GIRO ? f.lado1 : f.lado2;
      case 'derecha': return p.rotZ === ROT_H_GIRO ? f.lado2 : f.lado1;
      case 'abajo': return p.rotZ === ROT_V ? f.lado2 : f.lado1;
      default: return -1;
    }
  } else {
    switch (p.direccion) {
      case 'derecha': return p.rotZ === ROT_H_GIRO ? f.lado2 : f.lado1;
      case 'izquierda': return p.rotZ === ROT_H_GIRO ? f.lado1 : f.lado2;
      case 'arriba': return p.rotZ === ROT_V ? f.lado1 : f.lado2;
      default: return -1;
    }
  }
}

// Verifica que cada ficha conecta por su pip con el valor libre del origen
function verificarConexiones(tablero: FichaEnTablero[]): string[] {
  const piezas = colocarFichas(tablero);
  const idxC = tablero.findIndex(t => t.id === '6-6');
  const errores: string[] = [];
  for (let k = 1; k < piezas.length; k++) {
    let origen: FichaColocada;
    if (k <= idxC) {
      origen = piezas[k - 1]; // rama izquierda, del centro hacia fuera
    } else if (k === idxC + 1) {
      origen = piezas[0]; // primera ficha de la rama derecha cuelga del centro
    } else {
      origen = piezas[k - 1];
    }
    const pip = pipDeConexion(piezas[k]);
    if (pip !== valorLibre(origen)) {
      errores.push(
        `${piezas[k].ficha.id}: pip ${pip} != ${valorLibre(origen)} (origen ${origen.ficha.id})`
      );
    }
  }
  return errores;
}

// Genera una cadena válida (cada ficha conecta por un pip) desde el doble-6,
// alternando extremos cuando ambos tienen candidatas. El array queda ordenado
// de extremo izquierdo a derecho.
function cadenaAleatoria(seed: number, n: number): FichaEnTablero[] {
  let s = seed;
  const rnd = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  const todas: [number, number][] = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) todas.push([a, b]);
  const usadas = new Set(['6-6']);
  const tablero: FichaEnTablero[] = [C6];
  let extremoIzq = 6;
  let extremoDer = 6;
  for (let i = 1; i < n; i++) {
    const filtro = (valor: number) =>
      todas.filter(([a, b]) => !usadas.has(`${a}-${b}`) && (a === valor || b === valor));
    const candIzq = filtro(extremoIzq);
    const candDer = filtro(extremoDer);
    const aLaIzquierda = candDer.length === 0 ? true : candIzq.length === 0 ? false : i % 2 === 0;
    const valor = aLaIzquierda ? extremoIzq : extremoDer;
    const candidatas = aLaIzquierda ? candIzq : candDer;
    if (candidatas.length === 0) break;
    const [a, b] = candidatas[Math.floor(rnd() * candidatas.length)];
    usadas.add(`${a}-${b}`);
    if (aLaIzquierda) {
      tablero.unshift({
        id: `f-${i}`,
        lado1: (b === valor ? b : a) as ValorFicha,
        lado2: (b === valor ? a : b) as ValorFicha,
        rotada: false,
      });
      extremoIzq = b === valor ? a : b;
    } else {
      tablero.push({
        id: `f-${i}`,
        lado1: (a === valor ? a : b) as ValorFicha,
        lado2: (a === valor ? b : a) as ValorFicha,
        rotada: false,
      });
      extremoDer = a === valor ? b : a;
    }
  }
  return tablero;
}

describe('colocarFichas', () => {
  test('el doble-6 inicial queda en el centro y en vertical', () => {
    const piezas = colocarFichas([C6]);
    expect(piezas).toHaveLength(1);
    const c = piezas[0];
    expect(c.x).toBe(0);
    expect(c.z).toBe(0);
    expect(c.rotZ).toBe(ROT_V);
    expect(c.direccion).toBe('centro');
    expect(c.rama).toBe('nada');
  });

  test('la primera ficha de cada rama cuelga del centro a ±1.5', () => {
    const tablero = [ficha('6-5', 6, 5), C6, ficha('6-4', 6, 4)];
    const piezas = colocarFichas(tablero);
    const izq = piezas[1];
    const der = piezas[2];
    expect(izq.x).toBeCloseTo(-1.5);
    expect(izq.z).toBe(0);
    expect(izq.direccion).toBe('izquierda');
    expect(izq.rama).toBe('izquierda');
    expect(der.x).toBeCloseTo(1.5);
    expect(der.z).toBe(0);
    expect(der.direccion).toBe('derecha');
    expect(der.rama).toBe('derecha');
  });

  test('las fichas siguientes de una rama siguen pegadas en la misma fila', () => {
    const tablero = [ficha('6-5', 6, 5), C6, ficha('6-4', 6, 4), ficha('4-2', 4, 2)];
    const piezas = colocarFichas(tablero);
    // Rama derecha: 6-4 a +1.5 y 4-2 a +3.5
    expect(piezas[2].x).toBeCloseTo(1.5);
    expect(piezas[3].x).toBeCloseTo(3.5);
    expect(piezas[3].z).toBe(0);
    expect(piezas[3].direccion).toBe('derecha');
  });

  test('la rama izquierda gira hacia abajo en la 6ª ficha', () => {
    const tablero = [
      ficha('1-0', 1, 0),
      ficha('2-1', 2, 1),
      ficha('3-2', 3, 2),
      ficha('4-3', 4, 3),
      ficha('5-4', 5, 4),
      ficha('6-5', 6, 5),
      C6,
    ];
    const piezas = colocarFichas(tablero);
    // Las 5 primeras van hacia la izquierda en z = 0
    for (let i = 1; i <= 5; i++) {
      expect(piezas[i].z).toBe(0);
      expect(piezas[i].direccion).toBe('izquierda');
    }
    expect(piezas[1].x).toBeCloseTo(-1.5);
    expect(piezas[5].x).toBeCloseTo(-9.5);
    // La 6ª baja a z = 1.5, debajo de la fila
    const l6 = piezas[6];
    expect(l6.x).toBeCloseTo(-10);
    expect(l6.z).toBeCloseTo(1.5);
    expect(l6.direccion).toBe('abajo');
    expect(l6.rama).toBe('izquierda');
  });

  test('la rama derecha gira hacia arriba en la 6ª ficha', () => {
    const tablero = [
      C6,
      ficha('6-5', 6, 5),
      ficha('5-4', 5, 4),
      ficha('4-3', 4, 3),
      ficha('3-2', 3, 2),
      ficha('2-1', 2, 1),
      ficha('1-0', 1, 0),
    ];
    const piezas = colocarFichas(tablero);
    for (let i = 1; i <= 5; i++) {
      expect(piezas[i].z).toBe(0);
      expect(piezas[i].direccion).toBe('derecha');
    }
    expect(piezas[1].x).toBeCloseTo(1.5);
    expect(piezas[5].x).toBeCloseTo(9.5);
    const r6 = piezas[6];
    expect(r6.x).toBeCloseTo(10);
    expect(r6.z).toBeCloseTo(-1.5);
    expect(r6.direccion).toBe('arriba');
    expect(r6.rama).toBe('derecha');
  });

  test('tras el giro la rama continúa en la dirección contraria', () => {
    // Rama izquierda: 6 fichas (gira abajo) + 2 que siguen a la derecha
    const tablero = [
      ficha('3-6', 3, 6),
      ficha('0-3', 0, 3),
      ficha('1-0', 1, 0),
      ficha('2-1', 2, 1),
      ficha('3-2', 3, 2),
      ficha('4-3', 4, 3),
      ficha('5-4', 5, 4),
      ficha('6-5', 6, 5),
      C6,
    ];
    const piezas = colocarFichas(tablero);
    const l7 = piezas[7];
    const l8 = piezas[8];
    // Tras el giro (ficha 6) la rama va hacia la derecha en la fila de abajo
    expect(l7.direccion).toBe('derecha');
    expect(l7.rama).toBe('izquierda');
    expect(l7.z).toBeCloseTo(3);
    expect(l8.direccion).toBe('derecha');
    expect(l8.x).toBeGreaterThan(l7.x);
  });

  test('las conexiones por pip son correctas en cadenas aleatorias', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const tablero = cadenaAleatoria(seed, 20);
      expect(verificarConexiones(tablero)).toEqual([]);
    }
  });

  test('las conexiones son correctas cuando una rama es larga', () => {
    // 18 fichas todas por la izquierda
    const tablero = [C6];
    let extremo = 6;
    let k = 0;
    const pares = [
      [6, 5], [5, 4], [4, 3], [3, 2], [2, 1], [1, 0], [0, 3], [3, 6], [6, 2],
      [2, 4], [4, 0], [0, 5], [5, 1], [1, 3], [3, 5], [5, 0], [0, 2],
    ];
    for (const [a, b] of pares) {
      const conecta = a === extremo ? b : a;
      tablero.unshift({
        id: `L${k++}`,
        lado1: conecta as ValorFicha,
        lado2: (a === extremo ? a : b) as ValorFicha,
        rotada: false,
      });
      extremo = a === extremo ? a : b;
    }
    expect(verificarConexiones(tablero)).toEqual([]);
  });
});

describe('calcularLayout', () => {
  const ancho = 400;
  const alto = 200;

  test('tablero vacío devuelve un indicador en el centro', () => {
    const layout = calcularLayout([], ancho, alto);
    expect(layout.fichas).toHaveLength(0);
    expect(layout.centroDerecha).not.toBeNull();
    expect(layout.centroIzquierda).toBeNull();
  });

  test('una cadena corta usa el tamaño máximo', () => {
    const tablero = [ficha('6-5', 6, 5), C6, ficha('6-4', 6, 4)];
    const layout = calcularLayout(tablero, ancho, alto);
    expect(layout.fichas).toHaveLength(3);
    expect(layout.tamano).toBe(32);
  });

  test('una cadena larga reduce el tamaño para que quepa', () => {
    const corta = calcularLayout(cadenaAleatoria(7, 4), ancho, alto);
    const tableroLargo = cadenaAleatoria(8, 27);
    const larga = calcularLayout(tableroLargo, ancho, alto);
    expect(corta.tamano).toBe(32);
    expect(larga.fichas.length).toBe(tableroLargo.length);
    if (tableroLargo.length > 12) {
      expect(larga.tamano).toBeLessThan(32);
    }
  });

  test('todas las fichas quedan dentro del área', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const layout = calcularLayout(cadenaAleatoria(seed, 27), ancho, alto);
      for (const f of layout.fichas) {
        expect(f.left).toBeGreaterThanOrEqual(-1);
        expect(f.top).toBeGreaterThanOrEqual(-1);
        expect(f.left + f.width).toBeLessThanOrEqual(ancho + 1);
        expect(f.top + f.height).toBeLessThanOrEqual(alto + 1);
      }
    }
  });

  test('en un área pequeña (partida de 4 jugadores) las fichas no salen del tablero', () => {
    const anchoPequeno = 220;
    const altoPequeno = 260;
    for (let seed = 1; seed <= 30; seed++) {
      const tablero = cadenaAleatoria(seed, 27);
      const layout = calcularLayout(tablero, anchoPequeno, altoPequeno);
      expect(layout.fichas.length).toBe(tablero.length);
      for (const f of layout.fichas) {
        expect(f.left).toBeGreaterThanOrEqual(-1);
        expect(f.top).toBeGreaterThanOrEqual(-1);
        expect(f.left + f.width).toBeLessThanOrEqual(anchoPequeno + 1);
        expect(f.top + f.height).toBeLessThanOrEqual(altoPequeno + 1);
      }
    }
  });

  test('ninguna ficha se solapa', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const layout = calcularLayout(cadenaAleatoria(seed, 27), ancho, alto);
      const fichas = layout.fichas;
      for (let i = 0; i < fichas.length; i++) {
        for (let j = i + 1; j < fichas.length; j++) {
          const a = fichas[i];
          const b = fichas[j];
          const solapan =
            a.left < b.left + b.width - 1 &&
            b.left < a.left + a.width - 1 &&
            a.top < b.top + b.height - 1 &&
            b.top < a.top + a.height - 1;
          expect(solapan).toBe(false);
        }
      }
    }
  });

  test('los indicadores apuntan a la posición de la siguiente ficha', () => {
    const tablero = [ficha('6-5', 6, 5), C6, ficha('6-4', 6, 4)];
    const layout = calcularLayout(tablero, ancho, alto);
    expect(layout.centroIzquierda).not.toBeNull();
    expect(layout.centroDerecha).not.toBeNull();
    expect(layout.centroIzquierda!.x).toBeLessThan(layout.centroDerecha!.x);
  });

  test('el indicador derecho es vertical justo antes del giro de la rama derecha', () => {
    // 5 fichas a la derecha: la siguiente giraría hacia arriba (vertical)
    const tablero = [
      C6,
      ficha('6-5', 6, 5),
      ficha('5-4', 5, 4),
      ficha('4-3', 4, 3),
      ficha('3-2', 3, 2),
      ficha('2-1', 2, 1),
    ];
    const layout = calcularLayout(tablero, ancho, alto);
    expect(layout.centroDerechaVertical).toBe(true);
  });
});