// server/src/game/engine.ts
// Mismo motor que el cliente (domino/domino-multijugador/src/game/engine.ts).
// Solo depende de ./types y no tiene dependencias de React.

import {
  Ficha,
  FichaEnTablero,
  Jugador,
  EstadoPartida,
  Jugada,
  ValorFicha,
  OpcionesPartida,
} from './types';

export const FICHAS_POR_JUGADOR = 7;

// Genera el set completo de fichas (doble-6 = 28 fichas)
export function generarFichas(): Ficha[] {
  const fichas: Ficha[] = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      fichas.push({ id: `${i}-${j}`, lado1: i as ValorFicha, lado2: j as ValorFicha });
    }
  }
  return fichas;
}

// Mezcla las fichas (Fisher-Yates)
export function barajarFichas(fichas: Ficha[]): Ficha[] {
  const copia = [...fichas];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// Reparte fichas entre jugadores. Con pozo: 7 fichas c/u y el resto al pozo.
// Sin pozo: se reparten todas las fichas por rondas.
// Garantiza que el doble-6 quede repartido para que la partida siempre inicie con él.
export function repartirFichas(
  fichas: Ficha[],
  cantidadJugadores: number,
  fichasPorJugador = FICHAS_POR_JUGADOR,
  conPozo = true,
): { manos: Ficha[][], pozo: Ficha[] } {
  const barajadas = barajarFichas(fichas);
  const manos: Ficha[][] = [];
  let indice = 0;

  if (conPozo) {
    for (let i = 0; i < cantidadJugadores; i++) {
      manos.push(barajadas.slice(indice, indice + fichasPorJugador));
      indice += fichasPorJugador;
    }
  } else {
    for (let i = 0; i < cantidadJugadores; i++) manos.push([]);
    for (let k = 0; k < barajadas.length; k++) {
      manos[k % cantidadJugadores].push(barajadas[k]);
    }
    indice = barajadas.length;
  }

  const pozo = barajadas.slice(indice);

  // Si el doble-6 quedó en el pozo, lo intercambiamos con una ficha de una mano
  if (pozo.length > 0) {
    const tieneSeis = manos.some(mano => mano.some(f => f.id === '6-6'));
    if (!tieneSeis) {
      const indicePozo = pozo.findIndex(f => f.id === '6-6');
      if (indicePozo >= 0) {
        const manoTarget = manos[Math.floor(Math.random() * manos.length)];
        const indiceMano = Math.floor(Math.random() * manoTarget.length);
        const intercambiada = manoTarget[indiceMano];
        manoTarget[indiceMano] = pozo[indicePozo];
        pozo[indicePozo] = intercambiada;
      }
    }
  }

  return { manos, pozo };
}

// Encuentra el jugador que inicia: siempre el que tiene el doble-6 (si nadie lo
// tiene, se usa el doble más alto como respaldo)
export function encontrarJugadorInicial(jugadores: Jugador[]): number {
  const conDobleSeis = jugadores.findIndex(j => j.mano.some(f => f.id === '6-6'));
  if (conDobleSeis >= 0) return conDobleSeis;

  let mejorIndice = 0;
  let mejorValor = -1;

  jugadores.forEach((jugador, indice) => {
    jugador.mano.forEach(ficha => {
      if (ficha.lado1 === ficha.lado2 && ficha.lado1 > mejorValor) {
        mejorValor = ficha.lado1;
        mejorIndice = indice;
      }
    });
  });

  return mejorIndice;
}

// Inicializa una partida nueva
export function iniciarPartida(
  nombresJugadores: string[],
  opciones: OpcionesPartida = { robarPozo: true },
): EstadoPartida {
  const fichas = generarFichas();
  const { manos, pozo } = repartirFichas(
    fichas,
    nombresJugadores.length,
    FICHAS_POR_JUGADOR,
    opciones.robarPozo,
  );

  const jugadores: Jugador[] = nombresJugadores.map((nombre, i) => ({
    id: `jugador-${i}`,
    nombre,
    mano: manos[i],
  }));

  const turnoInicial = encontrarJugadorInicial(jugadores);

  return {
    jugadores,
    tablero: [],
    pozo,
    turnoActual: turnoInicial,
    extremoIzquierdo: null,
    extremoDerecho: null,
    ganador: null,
    partidaTrabada: false,
  };
}

// Verifica si una ficha puede jugarse en el estado actual
export function fichaEsJugable(ficha: Ficha, estado: EstadoPartida): boolean {
  if (estado.tablero.length === 0) {
    // La partida siempre inicia con el doble-6
    return ficha.lado1 === 6 && ficha.lado2 === 6;
  }

  const { extremoIzquierdo, extremoDerecho } = estado;
  return (
    ficha.lado1 === extremoIzquierdo ||
    ficha.lado2 === extremoIzquierdo ||
    ficha.lado1 === extremoDerecho ||
    ficha.lado2 === extremoDerecho
  );
}

// Devuelve todas las fichas jugables de la mano de un jugador
export function obtenerFichasJugables(jugadorId: string, estado: EstadoPartida): Ficha[] {
  const jugador = estado.jugadores.find(j => j.id === jugadorId);
  if (!jugador) return [];
  return jugador.mano.filter(ficha => fichaEsJugable(ficha, estado));
}

// Devuelve en qué extremos puede colocarse una ficha en el estado actual
export function obtenerExtremosJugables(ficha: Ficha, estado: EstadoPartida): ('izquierdo' | 'derecho')[] {
  if (estado.tablero.length === 0) return ['derecho'];
  const extremos: ('izquierdo' | 'derecho')[] = [];
  if (ficha.lado1 === estado.extremoIzquierdo || ficha.lado2 === estado.extremoIzquierdo) {
    extremos.push('izquierdo');
  }
  if (ficha.lado1 === estado.extremoDerecho || ficha.lado2 === estado.extremoDerecho) {
    extremos.push('derecho');
  }
  return extremos;
}

// Aplica una jugada al estado (retorna nuevo estado, no muta el original)
export function aplicarJugada(estado: EstadoPartida, jugada: Jugada): EstadoPartida {
  const jugador = estado.jugadores.find(j => j.id === jugada.jugadorId);
  if (!jugador) throw new Error('Jugador no encontrado');

  if (!fichaEsJugable(jugada.ficha, estado)) {
    throw new Error('Jugada inválida: la ficha no coincide con ningún extremo');
  }

  if (estado.tablero.length > 0 && !obtenerExtremosJugables(jugada.ficha, estado).includes(jugada.extremo)) {
    throw new Error('Jugada inválida: la ficha no coincide con el extremo elegido');
  }

  const nuevaMano = jugador.mano.filter(f => f.id !== jugada.ficha.id);
  const nuevosJugadores = estado.jugadores.map(j =>
    j.id === jugada.jugadorId ? { ...j, mano: nuevaMano } : j
  );

  let nuevoExtremoIzquierdo = estado.extremoIzquierdo;
  let nuevoExtremoDerecho = estado.extremoDerecho;
  let fichaEnTablero: FichaEnTablero;

  if (estado.tablero.length === 0) {
    fichaEnTablero = { ...jugada.ficha, rotada: false };
    nuevoExtremoIzquierdo = jugada.ficha.lado1;
    nuevoExtremoDerecho = jugada.ficha.lado2;
  } else if (jugada.extremo === 'izquierdo') {
    const coincide = jugada.ficha.lado2 === estado.extremoIzquierdo;
    fichaEnTablero = { ...jugada.ficha, rotada: !coincide };
    nuevoExtremoIzquierdo = coincide ? jugada.ficha.lado1 : jugada.ficha.lado2;
  } else {
    const coincide = jugada.ficha.lado1 === estado.extremoDerecho;
    fichaEnTablero = { ...jugada.ficha, rotada: !coincide };
    nuevoExtremoDerecho = coincide ? jugada.ficha.lado2 : jugada.ficha.lado1;
  }

  const nuevoTablero = jugada.extremo === 'izquierdo' && estado.tablero.length > 0
    ? [fichaEnTablero, ...estado.tablero]
    : [...estado.tablero, fichaEnTablero];

  const ganador = nuevaMano.length === 0 ? jugada.jugadorId : null;
  const siguienteTurno = (estado.turnoActual + 1) % estado.jugadores.length;

  return {
    ...estado,
    jugadores: nuevosJugadores,
    tablero: nuevoTablero,
    extremoIzquierdo: nuevoExtremoIzquierdo,
    extremoDerecho: nuevoExtremoDerecho,
    turnoActual: siguienteTurno,
    ganador,
  };
}

// Pasa el turno (cuando el jugador no tiene fichas jugables y no puede robar)
export function pasarTurno(estado: EstadoPartida): EstadoPartida {
  const siguienteTurno = (estado.turnoActual + 1) % estado.jugadores.length;
  return { ...estado, turnoActual: siguienteTurno };
}

// Roba una ficha del pozo para el jugador en turno (retorna nuevo estado)
export function robarDelPozo(estado: EstadoPartida): EstadoPartida {
  if (estado.pozo.length === 0) return estado;
  const ficha = estado.pozo[0];
  const jugadorActual = estado.jugadores[estado.turnoActual];
  const nuevosJugadores = estado.jugadores.map(j =>
    j.id === jugadorActual.id ? { ...j, mano: [...j.mano, ficha] } : j
  );
  return {
    ...estado,
    jugadores: nuevosJugadores,
    pozo: estado.pozo.slice(1),
  };
}

// En partida trabada: gana quien tenga menos puntos en la mano (null si hay empate)
export function obtenerGanadorTrabado(estado: EstadoPartida): string | null {
  const puntosPorJugador = estado.jugadores.map(jugador => ({
    id: jugador.id,
    puntos: calcularPuntaje(jugador.mano),
  }));
  const minimo = Math.min(...puntosPorJugador.map(p => p.puntos));
  const ganadores = puntosPorJugador.filter(p => p.puntos === minimo);
  return ganadores.length === 1 ? ganadores[0].id : null;
}

// Verifica si la partida está trabada (nadie puede jugar)
export function verificarPartidaTrabada(estado: EstadoPartida): boolean {
  return estado.jugadores.every(jugador =>
    obtenerFichasJugables(jugador.id, estado).length === 0
  );
}

// Calcula puntaje de una mano (suma de los valores de las fichas restantes)
export function calcularPuntaje(mano: Ficha[]): number {
  return mano.reduce((total, ficha) => total + ficha.lado1 + ficha.lado2, 0);
}