// src/game/engine.test.ts

import {
  generarFichas,
  barajarFichas,
  repartirFichas,
  encontrarJugadorInicial,
  iniciarPartida,
  fichaEsJugable,
  obtenerFichasJugables,
  obtenerExtremosJugables,
  aplicarJugada,
  pasarTurno,
  robarDelPozo,
  verificarPartidaTrabada,
  obtenerGanadorTrabado,
  calcularPuntaje,
} from './engine';
import { FICHAS_POR_JUGADOR } from '../constants/gameConfig';
import { EstadoPartida, Ficha } from './types';

describe('generarFichas', () => {
  it('genera 28 fichas para set doble-6', () => {
    expect(generarFichas()).toHaveLength(28);
  });

  it('no genera fichas duplicadas', () => {
    const fichas = generarFichas();
    const ids = fichas.map(f => f.id);
    expect(new Set(ids).size).toBe(28);
  });

  it('incluye los 7 dobles', () => {
    const fichas = generarFichas();
    const dobles = fichas.filter(f => f.lado1 === f.lado2);
    expect(dobles).toHaveLength(7);
  });
});

describe('barajarFichas', () => {
  it('mantiene la misma cantidad de fichas', () => {
    const fichas = generarFichas();
    expect(barajarFichas(fichas)).toHaveLength(28);
  });

  it('no muta el arreglo original', () => {
    const fichas = generarFichas();
    const copiaOriginal = [...fichas];
    barajarFichas(fichas);
    expect(fichas).toEqual(copiaOriginal);
  });
});

describe('repartirFichas', () => {
  it('reparte 7 fichas por jugador con 4 jugadores', () => {
    const fichas = generarFichas();
    const { manos, pozo } = repartirFichas(fichas, 4);
    expect(manos).toHaveLength(4);
    manos.forEach(mano => expect(mano).toHaveLength(7));
    expect(pozo).toHaveLength(0); // 4*7=28, no sobra nada
  });

  it('reparte correctamente con 2 jugadores (sobra pozo)', () => {
    const fichas = generarFichas();
    const { manos, pozo } = repartirFichas(fichas, 2);
    expect(manos).toHaveLength(2);
    manos.forEach(mano => expect(mano).toHaveLength(7));
    expect(pozo).toHaveLength(14); // 28 - 14 = 14 sobran
  });

  it('siempre deja el doble-6 repartido en una mano', () => {
    for (let i = 0; i < 20; i++) {
      const { manos } = repartirFichas(generarFichas(), 2);
      expect(manos.some(mano => mano.some(f => f.id === '6-6'))).toBe(true);
    }
  });

  it('sin pozo reparte todas las fichas entre los jugadores', () => {
    const { manos, pozo } = repartirFichas(generarFichas(), 3, FICHAS_POR_JUGADOR, false);
    expect(pozo).toHaveLength(0);
    const total = manos.reduce((acc, mano) => acc + mano.length, 0);
    expect(total).toBe(28);
  });

  it('sin pozo las manos difieren en máximo 1 ficha', () => {
    for (let i = 0; i < 20; i++) {
      const { manos } = repartirFichas(generarFichas(), 3, FICHAS_POR_JUGADOR, false);
      const largos = manos.map(mano => mano.length);
      expect(Math.max(...largos) - Math.min(...largos)).toBeLessThanOrEqual(1);
    }
  });
});

describe('encontrarJugadorInicial', () => {
  it('elige al jugador con el doble más alto', () => {
    const jugadores = [
      { id: 'j0', nombre: 'A', mano: [{ id: '2-2', lado1: 2, lado2: 2 } as Ficha] },
      { id: 'j1', nombre: 'B', mano: [{ id: '5-5', lado1: 5, lado2: 5 } as Ficha] },
    ];
    expect(encontrarJugadorInicial(jugadores)).toBe(1);
  });

  it('prefiere siempre al jugador que tiene el doble-6', () => {
    const jugadores = [
      { id: 'j0', nombre: 'A', mano: [{ id: '5-5', lado1: 5, lado2: 5 } as Ficha] },
      { id: 'j1', nombre: 'B', mano: [{ id: '6-6', lado1: 6, lado2: 6 } as Ficha] },
    ];
    expect(encontrarJugadorInicial(jugadores)).toBe(1);
  });
});

describe('iniciarPartida', () => {
  it('crea una partida con el número correcto de jugadores', () => {
    const estado = iniciarPartida(['Ana', 'Luis']);
    expect(estado.jugadores).toHaveLength(2);
    expect(estado.tablero).toHaveLength(0);
    expect(estado.ganador).toBeNull();
  });

  it('con pozo deja el sobrante en el pozo', () => {
    const estado = iniciarPartida(['Ana', 'Luis'], { robarPozo: true });
    expect(estado.pozo).toHaveLength(14);
    const repartidas = estado.jugadores.reduce((acc, j) => acc + j.mano.length, 0);
    expect(repartidas + estado.pozo.length).toBe(28);
  });

  it('sin pozo reparte las 28 fichas entre los jugadores', () => {
    const estado = iniciarPartida(['Ana', 'Luis'], { robarPozo: false });
    expect(estado.pozo).toHaveLength(0);
    const repartidas = estado.jugadores.reduce((acc, j) => acc + j.mano.length, 0);
    expect(repartidas).toBe(28);
  });
});

describe('fichaEsJugable', () => {
  it('con el tablero vacío solo permite el doble-6', () => {
    const estado: EstadoPartida = {
      jugadores: [], tablero: [], pozo: [], turnoActual: 0,
      extremoIzquierdo: null, extremoDerecho: null, ganador: null, partidaTrabada: false,
    };
    expect(fichaEsJugable({ id: '6-6', lado1: 6, lado2: 6 }, estado)).toBe(true);
    expect(fichaEsJugable({ id: '3-4', lado1: 3, lado2: 4 }, estado)).toBe(false);
  });

  it('valida coincidencia con los extremos', () => {
    const estado: EstadoPartida = {
      jugadores: [], tablero: [{ id: '3-4', lado1: 3, lado2: 4, rotada: false }], pozo: [],
      turnoActual: 0, extremoIzquierdo: 3, extremoDerecho: 4, ganador: null, partidaTrabada: false,
    };
    expect(fichaEsJugable({ id: '4-6', lado1: 4, lado2: 6 }, estado)).toBe(true);
    expect(fichaEsJugable({ id: '1-2', lado1: 1, lado2: 2 }, estado)).toBe(false);
  });
});

describe('aplicarJugada', () => {
  it('coloca la primera ficha (doble-6) y actualiza extremos', () => {
    let estado = iniciarPartida(['Ana', 'Luis']);
    estado = { ...estado, jugadores: [
      { id: 'jugador-0', nombre: 'Ana', mano: [{ id: '6-6', lado1: 6, lado2: 6 }] },
      { id: 'jugador-1', nombre: 'Luis', mano: [] },
    ], turnoActual: 0 };

    const nuevoEstado = aplicarJugada(estado, {
      jugadorId: 'jugador-0', ficha: { id: '6-6', lado1: 6, lado2: 6 }, extremo: 'derecho',
    });

    expect(nuevoEstado.tablero).toHaveLength(1);
    expect(nuevoEstado.extremoIzquierdo).toBe(6);
    expect(nuevoEstado.extremoDerecho).toBe(6);
    expect(nuevoEstado.turnoActual).toBe(1);
  });

  it('declara ganador cuando la mano queda vacía', () => {
    let estado = iniciarPartida(['Ana', 'Luis']);
    estado = { ...estado, jugadores: [
      { id: 'jugador-0', nombre: 'Ana', mano: [{ id: '6-6', lado1: 6, lado2: 6 }] },
      { id: 'jugador-1', nombre: 'Luis', mano: [] },
    ], turnoActual: 0 };

    const nuevoEstado = aplicarJugada(estado, {
      jugadorId: 'jugador-0', ficha: { id: '6-6', lado1: 6, lado2: 6 }, extremo: 'derecho',
    });

    expect(nuevoEstado.ganador).toBe('jugador-0');
  });

  it('lanza error si la jugada es inválida', () => {
    let estado = iniciarPartida(['Ana', 'Luis']);
    estado = { ...estado, tablero: [{ id: '3-4', lado1: 3, lado2: 4, rotada: false }],
      extremoIzquierdo: 3, extremoDerecho: 4 };
    estado.jugadores[0].mano = [{ id: '1-2', lado1: 1, lado2: 2 }];

    expect(() => aplicarJugada(estado, {
      jugadorId: estado.jugadores[0].id, ficha: { id: '1-2', lado1: 1, lado2: 2 }, extremo: 'derecho',
    })).toThrow();
  });

  it('lanza error si la ficha no coincide con el extremo elegido', () => {
    let estado = iniciarPartida(['Ana', 'Luis']);
    estado = { ...estado, tablero: [{ id: '3-4', lado1: 3, lado2: 4, rotada: false }],
      extremoIzquierdo: 3, extremoDerecho: 4 };
    estado.jugadores[0].mano = [{ id: '4-6', lado1: 4, lado2: 6 }];

    // La ficha solo coincide con el extremo derecho, elegir izquierdo debe fallar
    expect(() => aplicarJugada(estado, {
      jugadorId: estado.jugadores[0].id, ficha: { id: '4-6', lado1: 4, lado2: 6 }, extremo: 'izquierdo',
    })).toThrow();
  });

  it('permite jugar en un extremo aunque la ficha coincida con ambos', () => {
    let estado = iniciarPartida(['Ana', 'Luis']);
    estado = { ...estado, tablero: [{ id: '3-5', lado1: 3, lado2: 5, rotada: false }],
      extremoIzquierdo: 3, extremoDerecho: 5 };
    estado.jugadores[0].mano = [{ id: '3-5', lado1: 3, lado2: 5 }];

    const nuevoEstado = aplicarJugada(estado, {
      jugadorId: estado.jugadores[0].id, ficha: { id: '3-5', lado1: 3, lado2: 5 }, extremo: 'izquierdo',
    });

    expect(nuevoEstado.extremoIzquierdo).toBe(5);
    expect(nuevoEstado.tablero).toHaveLength(2);
  });
});

describe('obtenerExtremosJugables', () => {
  it('devuelve solo el extremo derecho si el tablero está vacío', () => {
    const estado = iniciarPartida(['Ana', 'Luis']);
    expect(obtenerExtremosJugables({ id: '3-4', lado1: 3, lado2: 4 }, estado)).toEqual(['derecho']);
  });

  it('devuelve ambos extremos cuando la ficha coincide con los dos', () => {
    const estado: EstadoPartida = {
      ...iniciarPartida(['Ana', 'Luis']),
      tablero: [{ id: '3-5', lado1: 3, lado2: 5, rotada: false }],
      extremoIzquierdo: 3, extremoDerecho: 5,
    };
    expect(obtenerExtremosJugables({ id: '3-5', lado1: 3, lado2: 5 }, estado)).toEqual(['izquierdo', 'derecho']);
  });
});

describe('robarDelPozo', () => {
  it('roba una ficha y la agrega a la mano del jugador en turno', () => {
    const estado: EstadoPartida = {
      jugadores: [
        { id: 'j0', nombre: 'A', mano: [] },
        { id: 'j1', nombre: 'B', mano: [] },
      ],
      tablero: [], pozo: [{ id: '1-2', lado1: 1, lado2: 2 }, { id: '3-3', lado1: 3, lado2: 3 }],
      turnoActual: 0, extremoIzquierdo: null, extremoDerecho: null,
      ganador: null, partidaTrabada: false,
    };

    const nuevoEstado = robarDelPozo(estado);
    expect(nuevoEstado.jugadores[0].mano).toHaveLength(1);
    expect(nuevoEstado.jugadores[0].mano[0].id).toBe('1-2');
    expect(nuevoEstado.pozo).toHaveLength(1);
  });

  it('no hace nada si el pozo está vacío', () => {
    const estado: EstadoPartida = {
      jugadores: [{ id: 'j0', nombre: 'A', mano: [] }],
      tablero: [], pozo: [], turnoActual: 0,
      extremoIzquierdo: null, extremoDerecho: null, ganador: null, partidaTrabada: false,
    };
    expect(robarDelPozo(estado)).toEqual(estado);
  });
});

describe('obtenerGanadorTrabado', () => {
  it('elige al jugador con menos puntos cuando la partida queda trabada', () => {
    const estado: EstadoPartida = {
      jugadores: [
        { id: 'j0', nombre: 'A', mano: [{ id: '6-6', lado1: 6, lado2: 6 }] },
        { id: 'j1', nombre: 'B', mano: [{ id: '1-2', lado1: 1, lado2: 2 }] },
      ],
      tablero: [], pozo: [], turnoActual: 0,
      extremoIzquierdo: null, extremoDerecho: null, ganador: null, partidaTrabada: true,
    };
    expect(obtenerGanadorTrabado(estado)).toBe('j1');
  });

  it('devuelve null si hay empate en puntos', () => {
    const estado: EstadoPartida = {
      jugadores: [
        { id: 'j0', nombre: 'A', mano: [{ id: '2-2', lado1: 2, lado2: 2 }] },
        { id: 'j1', nombre: 'B', mano: [{ id: '1-3', lado1: 1, lado2: 3 }] },
      ],
      tablero: [], pozo: [], turnoActual: 0,
      extremoIzquierdo: null, extremoDerecho: null, ganador: null, partidaTrabada: true,
    };
    expect(obtenerGanadorTrabado(estado)).toBeNull();
  });
});

describe('calcularPuntaje', () => {
  it('suma correctamente los valores de las fichas', () => {
    const mano: Ficha[] = [{ id: '3-4', lado1: 3, lado2: 4 }, { id: '2-2', lado1: 2, lado2: 2 }];
    expect(calcularPuntaje(mano)).toBe(11);
  });
});
