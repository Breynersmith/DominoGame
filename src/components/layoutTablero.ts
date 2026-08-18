import { FichaEnTablero } from '../game/types';

export interface FichaLayout {
  id: string;
  horizontal: boolean;
  invertida: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface LayoutResultado {
  tamano: number;
  fichas: FichaLayout[];
  centroDerecha: { x: number; y: number } | null;
  centroDerechaVertical?: boolean;
  centroIzquierda: { x: number; y: number } | null;
  centroIzquierdaVertical?: boolean;
  ancho: number;
  alto: number;
}

// Padding interior que aplica Tile a cada ficha
export function paddingFicha(s: number): number {
  return Math.round(s * 0.12);
}

// Padding extra en el eje largo de la ficha (margen del divisor interno)
export function extraLargoFicha(_s: number): number {
  return 0;
}

// Dimensiones exactas que renderiza Tile para un tamaño dado
export function dimensionesFicha(horizontal: boolean, s: number): { width: number; height: number } {
  const pad = paddingFicha(s);
  const extra = extraLargoFicha(s);
  const largo = 2 * s + 1 + 4 * pad + 2 * extra;
  const corto = s + 2 * pad;
  return horizontal ? { width: largo, height: corto } : { width: corto, height: largo };
}

// =====================================================================
// Lógica de colocación del tablero. Puerto de JS/Domino_Ficha.js del
// repositorio devildrey33/Domino: cada ficha se coloca respecto a la
// ficha de la que cuelga (la "origen"), en coordenadas de tablero
// (x = derecha, z = abajo) donde el largo de una ficha vale 2.0 y el
// ancho 1.0.
// =====================================================================

const PI = Math.PI;
const ROT_V = PI / 2;          // Ficha vertical
const ROT_H_GIRO = PI;         // Ficha horizontal girada 180º
const ROT_V_INV = PI + PI / 2; // Ficha vertical girada 180º (270º)

type Direccion = 'centro' | 'izquierda' | 'derecha' | 'arriba' | 'abajo';
type Rama = 'nada' | 'izquierda' | 'derecha';

export interface FichaColocada {
  ficha: FichaEnTablero;
  x: number;
  z: number;
  rotZ: number;
  direccion: Direccion;
  rama: Rama;
}

function esDoble(f: FichaEnTablero): boolean {
  return f.lado1 === f.lado2;
}

// Valor que queda libre (el pip expuesto) de una ficha ya colocada.
export function valorLibre(p: FichaColocada): number {
  const f = p.ficha;
  switch (p.direccion) {
    case 'centro': return f.lado1;
    case 'izquierda': return p.rotZ === ROT_H_GIRO ? f.lado2 : f.lado1;
    case 'derecha': return p.rotZ === ROT_H_GIRO ? f.lado1 : f.lado2;
    case 'arriba': return p.rotZ === ROT_V ? f.lado2 : f.lado1;
    case 'abajo': return p.rotZ === ROT_V ? f.lado1 : f.lado2;
  }
  return -1;
}

// BuscarPos* del repo de referencia. Las fichas del tablero miden 2.0 de
// largo por 1.0 de ancho.
function buscarPosIzq(f: FichaEnTablero, o: FichaColocada): { x: number; z: number; rotZ: number } {
  if (esDoble(f)) return { x: o.x - 1.5, z: o.z, rotZ: ROT_V };
  return {
    x: esDoble(o.ficha) && o.rotZ !== 0 ? o.x - 1.5 : o.x - 2.0,
    z: o.z,
    rotZ: f.lado1 === valorLibre(o) ? ROT_H_GIRO : 0,
  };
}

function buscarPosDer(f: FichaEnTablero, o: FichaColocada): { x: number; z: number; rotZ: number } {
  if (esDoble(f)) return { x: o.x + 1.5, z: o.z, rotZ: ROT_V };
  return {
    x: esDoble(o.ficha) && o.rotZ !== 0 ? o.x + 1.5 : o.x + 2.0,
    z: o.z,
    rotZ: f.lado2 === valorLibre(o) ? ROT_H_GIRO : 0,
  };
}

function buscarPosSup(f: FichaEnTablero, o: FichaColocada): { x: number; z: number; rotZ: number } {
  const rotZ = f.lado1 === valorLibre(o) ? ROT_V : ROT_V_INV;
  if (esDoble(o.ficha)) return { x: o.x, z: o.z - 2.0, rotZ };
  return { x: o.x + 0.5, z: o.z - 1.5, rotZ };
}

function buscarPosInf(f: FichaEnTablero, o: FichaColocada): { x: number; z: number; rotZ: number } {
  const rotZ = f.lado1 === valorLibre(o) ? ROT_V_INV : ROT_V;
  if (esDoble(o.ficha)) return { x: o.x, z: o.z + 2.0, rotZ };
  return { x: o.x - 0.5, z: o.z + 1.5, rotZ };
}

function buscarPosSupIzq(f: FichaEnTablero, o: FichaColocada): { x: number; z: number; rotZ: number } {
  if (esDoble(f)) return { x: o.x, z: o.z - 1.5, rotZ: 0 };
  return { x: o.x - 0.5, z: o.z - 1.5, rotZ: f.lado1 === valorLibre(o) ? ROT_H_GIRO : 0 };
}

function buscarPosInfDer(f: FichaEnTablero, o: FichaColocada): { x: number; z: number; rotZ: number } {
  if (esDoble(f)) return { x: o.x, z: o.z + 1.5, rotZ: 0 };
  return { x: o.x + 0.5, z: o.z + 1.5, rotZ: f.lado1 === valorLibre(o) ? 0 : ROT_H_GIRO };
}

// Simula Domino_Ficha.Colocar() para una rama concreta. Devuelve la ficha
// ya colocada (posición, rotación, dirección y rama) sin mutar el estado.
function colocar(
  f: FichaEnTablero,
  origen: FichaColocada,
  rama: 'izquierda' | 'derecha',
  contador: number
): FichaColocada {
  let pos: { x: number; z: number; rotZ: number };
  let direccion: Direccion;

  if (rama === 'izquierda') {
    switch (origen.direccion) {
      case 'centro':
        pos = buscarPosIzq(f, origen);
        direccion = 'izquierda';
        break;
      case 'izquierda':
        // Al llegar a 5 fichas la rama izquierda gira hacia abajo
        if (origen.rama === 'izquierda' && contador === 5) {
          pos = buscarPosInf(f, origen);
          direccion = 'abajo';
        } else {
          pos = buscarPosIzq(f, origen);
          direccion = 'izquierda';
        }
        break;
      case 'abajo':
        pos = buscarPosInfDer(f, origen);
        direccion = 'derecha';
        break;
      case 'derecha':
        pos = buscarPosDer(f, origen);
        direccion = 'derecha';
        break;
      default:
        pos = buscarPosIzq(f, origen);
        direccion = 'izquierda';
    }
  } else {
    switch (origen.direccion) {
      case 'centro':
        pos = buscarPosDer(f, origen);
        direccion = 'derecha';
        break;
      case 'derecha':
        // Al llegar a 5 fichas la rama derecha gira hacia arriba
        if (origen.rama === 'derecha' && contador === 5) {
          pos = buscarPosSup(f, origen);
          direccion = 'arriba';
        } else {
          pos = buscarPosDer(f, origen);
          direccion = 'derecha';
        }
        break;
      case 'arriba':
        pos = buscarPosSupIzq(f, origen);
        direccion = 'izquierda';
        break;
      case 'izquierda':
        pos = buscarPosIzq(f, origen);
        direccion = 'izquierda';
        break;
      default:
        pos = buscarPosDer(f, origen);
        direccion = 'derecha';
    }
  }

  const ramaNueva: Rama =
    origen.rama !== 'nada' ? origen.rama : rama === 'izquierda' ? 'izquierda' : 'derecha';

  return { ficha: f, x: pos.x, z: pos.z, rotZ: pos.rotZ, direccion, rama: ramaNueva };
}

// La ficha de reserva sirve solo para calcular dónde caería la siguiente
// ficha (indicadores de arrastre). Es una ficha no doble cualquiera.
const FICHA_RESERVA: FichaEnTablero = { id: '__reserva__', lado1: 0, lado2: 1, rotada: false };

export interface ColocacionTablero {
  piezas: FichaColocada[];
  extremoIzquierdo: FichaColocada;
  extremoDerecho: FichaColocada;
  contadorIzq: number;
  contadorDer: number;
}

// Reconstruye la colocación completa del tablero a partir del array de
// fichas (ordenado de extremo izquierdo a extremo derecho). La ficha del
// centro es siempre el doble-6 que abre la partida.
export function colocarFichas(tablero: FichaEnTablero[]): FichaColocada[] {
  return colocarTablero(tablero).piezas;
}

function colocarTablero(tablero: FichaEnTablero[]): ColocacionTablero {
  const idxCentro = tablero.findIndex(t => t.id === '6-6');
  const idx = idxCentro >= 0 ? idxCentro : 0;

  const centro: FichaColocada = {
    ficha: tablero[idx],
    x: 0,
    z: 0,
    rotZ: ROT_V,
    direccion: 'centro',
    rama: 'nada',
  };
  const piezas: FichaColocada[] = [centro];

  let extremoIzq: FichaColocada = centro;
  let extremoDer: FichaColocada = centro;
  let contadorIzq = 0;
  let contadorDer = 0;

  // Rama izquierda: fichas que cuelgan del centro hacia la izquierda
  for (let i = idx - 1; i >= 0; i--) {
    const p = colocar(tablero[i], extremoIzq, 'izquierda', contadorIzq);
    piezas.push(p);
    extremoIzq = p;
    contadorIzq++;
  }

  // Rama derecha: fichas que cuelgan del centro hacia la derecha
  for (let i = idx + 1; i < tablero.length; i++) {
    const p = colocar(tablero[i], extremoDer, 'derecha', contadorDer);
    piezas.push(p);
    extremoDer = p;
    contadorDer++;
  }

  return { piezas, extremoIzquierdo: extremoIzq, extremoDerecho: extremoDer, contadorIzq, contadorDer };
}

interface Bbox {
  w: number;
  h: number;
  minLeft: number;
  minTop: number;
}

function bboxPiezas(piezas: FichaColocada[], s: number, unitPx: number): Bbox {
  let minLeft = Infinity;
  let minTop = Infinity;
  let maxRight = -Infinity;
  let maxBottom = -Infinity;
  for (const p of piezas) {
    const horizontal = p.rotZ === 0 || p.rotZ === ROT_H_GIRO;
    const dims = dimensionesFicha(horizontal, s);
    const cx = p.x * unitPx;
    const cy = p.z * unitPx;
    minLeft = Math.min(minLeft, cx - dims.width / 2);
    maxRight = Math.max(maxRight, cx + dims.width / 2);
    minTop = Math.min(minTop, cy - dims.height / 2);
    maxBottom = Math.max(maxBottom, cy + dims.height / 2);
  }
  return { w: maxRight - minLeft, h: maxBottom - minTop, minLeft, minTop };
}

function esHorizontal(rotZ: number): boolean {
  return rotZ === 0 || rotZ === ROT_H_GIRO;
}

export function calcularLayout(
  tablero: FichaEnTablero[],
  ancho: number,
  alto: number,
  tamanoMax = 32,
  tamanoMin = 2
): LayoutResultado {
  const padX = 12;
  const padY = 16;
  const dispX = Math.max(1, ancho - padX * 2);
  const dispY = Math.max(1, alto - padY * 2);

  if (tablero.length === 0) {
    return {
      tamano: tamanoMax,
      fichas: [],
      centroDerecha: { x: dispX / 2 + padX, y: dispY / 2 + padY },
      centroIzquierda: null,
      ancho,
      alto,
    };
  }

  const col = colocarTablero(tablero);
  const piezas = col.piezas;
  // Indica dónde caería la siguiente ficha de cada extremo
  const sigueIzq = colocar(FICHA_RESERVA, col.extremoIzquierdo, 'izquierda', col.contadorIzq);
  const sigueDer = colocar(FICHA_RESERVA, col.extremoDerecho, 'derecha', col.contadorDer);

  // Elige el tamaño más grande que quepa en el área visible
  let tamano = tamanoMin;
  for (let s = tamanoMax; s >= tamanoMin; s--) {
    const unitPx = dimensionesFicha(true, s).width / 2;
    const bbox = bboxPiezas(piezas, s, unitPx);
    if (bbox.w <= dispX + 0.5 && bbox.h <= dispY + 0.5) {
      tamano = s;
      break;
    }
  }

  const unitPx = dimensionesFicha(true, tamano).width / 2;
  const bbox = bboxPiezas(piezas, tamano, unitPx);
  const offsetX = padX + (dispX - bbox.w) / 2 - bbox.minLeft;
  const offsetY = padY + (dispY - bbox.h) / 2 - bbox.minTop;

  const fichas: FichaLayout[] = piezas.map(p => {
    const horizontal = esHorizontal(p.rotZ);
    const dims = dimensionesFicha(horizontal, tamano);
    // La ficha se muestra invertida ([lado2, lado1]) según su rotación
    const swapped = horizontal ? p.rotZ === ROT_H_GIRO : p.rotZ === ROT_V;
    const invertida = p.ficha.rotada !== swapped;
    return {
      id: p.ficha.id,
      horizontal,
      invertida,
      left: p.x * unitPx + offsetX - dims.width / 2,
      top: p.z * unitPx + offsetY - dims.height / 2,
      width: dims.width,
      height: dims.height,
    };
  });

  const xDel = (p: FichaColocada) => p.x * unitPx + offsetX;
  const yDel = (p: FichaColocada) => p.z * unitPx + offsetY;

  const clampa = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const centroDerecha = {
    x: clampa(xDel(sigueDer), padX + 4, ancho - padX - 4),
    y: clampa(yDel(sigueDer), padY + 4, alto - padY - 4),
  };
  const centroDerechaVertical = !esHorizontal(sigueDer.rotZ);
  const centroIzquierda = {
    x: clampa(xDel(sigueIzq), padX + 4, ancho - padX - 4),
    y: clampa(yDel(sigueIzq), padY + 4, alto - padY - 4),
  };
  const centroIzquierdaVertical = !esHorizontal(sigueIzq.rotZ);

  return {
    tamano,
    fichas,
    centroDerecha,
    centroDerechaVertical,
    centroIzquierda,
    centroIzquierdaVertical,
    ancho,
    alto,
  };
}