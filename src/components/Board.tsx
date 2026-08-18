import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { EstadoPartida } from '../game/types';
import { useT } from '../i18n/useT';
import { calcularLayout, LayoutResultado } from './layoutTablero';
import { Tile } from './Tile';

interface Props {
  estado: EstadoPartida;
  onLayoutListo?: (layout: LayoutResultado) => void;
}

export function Board({ estado, onLayoutListo }: Props) {
  const t = useT();
  const [tamano, setTamano] = useState({ ancho: 0, alto: 0 });
  const tamanoRef = useRef({ ancho: 0, alto: 0 });
  const fichasLogueadas = useRef<Set<string>>(new Set());

  const layout = useMemo(
    () =>
      tamano.ancho > 0
        ? calcularLayout(estado.tablero, tamano.ancho, tamano.alto)
        : null,
    [estado.tablero, tamano]
  );

  useEffect(() => {
    const { ancho, alto } = tamanoRef.current;
    if (ancho > 0) onLayoutListo?.(calcularLayout(estado.tablero, ancho, alto));
  }, [estado.tablero, onLayoutListo]);

  useEffect(() => {
    if (!layout) return;
    for (const f of layout.fichas) {
      if (fichasLogueadas.current.has(f.id)) continue;
      fichasLogueadas.current.add(f.id);
      const ficha = estado.tablero.find(t => t.id === f.id);
      if (!ficha) continue;
      const esDoble = ficha.lado1 === ficha.lado2;
      console.log(
        `[Ficha colocada] ${ficha.id} (${ficha.lado1}-${ficha.lado2}) | ` +
          `orientación: ${f.horizontal ? 'horizontal' : 'vertical'} | ` +
          `tipo: ${esDoble ? 'doble' : 'no doble'} | ` +
          `posición: x=${Math.round(f.left)}, y=${Math.round(f.top)} | ` +
          `centro: x=${Math.round(f.left + f.width / 2)}, y=${Math.round(f.top + f.height / 2)}`
      );
    }
  }, [layout, estado.tablero]);

  if (estado.tablero.length === 0) {
    return (
      <View
        style={styles.contenedor}
        onLayout={e => {
          const { width, height } = e.nativeEvent.layout;
          tamanoRef.current = { ancho: width, alto: height };
          setTamano({ ancho: width, alto: height });
          onLayoutListo?.(calcularLayout(estado.tablero, width, height));
        }}
      >
        <Text style={styles.textoVacio}>
          {t('comienzaPartida', { name: estado.jugadores[estado.turnoActual]?.nombre ?? '' })}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={styles.contenedor}
      onLayout={e => {
        const { width, height } = e.nativeEvent.layout;
        tamanoRef.current = { ancho: width, alto: height };
        setTamano({ ancho: width, alto: height });
        onLayoutListo?.(calcularLayout(estado.tablero, width, height));
      }}
    >
      {layout &&
        layout.fichas.map(f => {
          const ficha = estado.tablero.find(t => t.id === f.id);
          if (!ficha) return null;
          return (
            <View
              key={f.id}
              style={{
                position: 'absolute',
                left: f.left,
                top: f.top,
                width: f.width,
                height: f.height,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Tile
                valores={ficha.rotada !== f.invertida ? [ficha.lado2, ficha.lado1] : [ficha.lado1, ficha.lado2]}
                size={layout.tamano}
                horizontal={f.horizontal}
              />
            </View>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: '#1e3a2f',
    borderRadius: 18,
  },
  textoVacio: {
    color: '#d1fae5',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
});