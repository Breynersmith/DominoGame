// src/game/types.ts

export type ValorFicha = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Ficha {
  id: string;        // ej: "3-5"
  lado1: ValorFicha;
  lado2: ValorFicha;
}

export interface FichaEnTablero extends Ficha {
  rotada: boolean;   // si se colocó invertida (lado2-lado1)
  jugadorId?: string; // quién colocó la ficha (para colorear el tablero)
}

export interface Jugador {
  id: string;
  nombre: string;
  mano: Ficha[];
  esBot?: boolean;
  color?: string;   // color del jugador (fichas en pantalla de juego)
  racha?: number;   // racha de victorias consecutivas (solo en línea)
  foto?: string;    // foto de perfil (data URI, solo en línea)
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
  robarPozo: boolean;   // si es false, se reparten todas las fichas y se pasa turno
  apuesta?: number;     // créditos que aporta cada jugador (0 o ausente = sin apuesta)
  fichasPorJugador?: number; // fichas que recibe cada jugador (7 por defecto)
}
