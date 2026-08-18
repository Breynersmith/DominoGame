// server/src/game/types.ts

export type ValorFicha = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Ficha {
  id: string;        // ej: "3-5"
  lado1: ValorFicha;
  lado2: ValorFicha;
}

export interface FichaEnTablero extends Ficha {
  rotada: boolean;   // si se colocó invertida (lado2-lado1)
}

export interface Jugador {
  id: string;
  nombre: string;
  mano: Ficha[];
  esBot?: boolean;
}

export interface EstadoPartida {
  jugadores: Jugador[];
  tablero: FichaEnTablero[];
  pozo: Ficha[];          // fichas sin repartir
  turnoActual: number;    // índice del jugador en curso
  extremoIzquierdo: ValorFicha | null;
  extremoDerecho: ValorFicha | null;
  ganador: string | null;
  partidaTrabada: boolean;
}

export interface Jugada {
  jugadorId: string;
  ficha: Ficha;
  extremo: 'izquierdo' | 'derecho';
}

export interface OpcionesPartida {
  robarPozo: boolean;
  apuesta?: number;
}