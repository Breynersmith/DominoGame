// src/constants/gameConfig.ts

export const FICHAS_POR_JUGADOR = 7;
export const TOTAL_FICHAS = 28;
export const FICHAS_POR_JUGADOR_OPCIONES = [7, 9, 14] as const;
export const MIN_JUGADORES = 2;
export const MAX_JUGADORES = 4;
export const VALOR_MAXIMO_FICHA = 6;
export const NOMBRES_BOT = ['Bot Azul', 'Bot Verde', 'Bot Rojo'];

// Número de fichas por jugador posible según cuántos jugadores haya
export function fichasPorJugadorPermitidas(cantidadJugadores: number): number[] {
  return FICHAS_POR_JUGADOR_OPCIONES.filter(n => n * cantidadJugadores <= TOTAL_FICHAS);
}
