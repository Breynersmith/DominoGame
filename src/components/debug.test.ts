import { calcularLayout } from './layoutTablero';
import { FichaEnTablero, ValorFicha } from '../game/types';

function cadenaConGiro(): FichaEnTablero[] {
  const sec: number[] = [
    6, 6, 6, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5, 5, 3, 3, 6, 6, 2, 2, 4, 4, 1, 1, 6, 6, 0, 0, 3, 3, 1,
  ];
  const tiles: FichaEnTablero[] = [];
  for (let i = 0; i < sec.length - 1; i++) {
    const invertido = i % 5 === 3;
    tiles.push({
      id: `t${i}`,
      lado1: (invertido ? sec[i + 1] : sec[i]) as ValorFicha,
      lado2: (invertido ? sec[i] : sec[i + 1]) as ValorFicha,
      rotada: invertido,
    });
  }
  return tiles;
}

test('debug', () => {
  const tablero = cadenaConGiro();
  const layout = calcularLayout(tablero, 400, 200);
  for (const f of layout.fichas) {
    const t = tablero.find(x => x.id === f.id)!;
    console.log(
      `${f.id} | h=${f.horizontal} inv=${f.invertida} rot=${t.rotada} | ` +
        `left=${f.left} top=${f.top} w=${f.width} h=${f.height} | ` +
        `cx=${(f.left + f.width / 2).toFixed(1)} cy=${(f.top + f.height / 2).toFixed(1)} | ` +
        `vals=${t.lado1}-${t.lado2}`
    );
  }
});