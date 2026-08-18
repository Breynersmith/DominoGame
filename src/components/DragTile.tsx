import React, { useMemo, useRef } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import { ValorFicha } from '../game/types';
import { Tile } from './Tile';

interface Props {
  valores: [ValorFicha, ValorFicha];
  size?: number;
  seleccionada?: boolean;
  jugable?: boolean;
  oculta?: boolean;
  deshabilitada?: boolean;
  onPress?: () => void;
  onDragInicio?: (x: number, y: number) => void;
  onDragMover?: (x: number, y: number) => void;
  onDragSoltar?: (x: number, y: number) => void;
  onDragCancelar?: () => void;
}

export function DragTile({
  valores,
  size = 26,
  seleccionada = false,
  jugable = true,
  oculta = false,
  deshabilitada = false,
  onPress,
  onDragInicio,
  onDragMover,
  onDragSoltar,
  onDragCancelar,
}: Props) {
  const estadoRef = useRef({
    puedeArrastrar: jugable && !deshabilitada,
    onDragInicio,
    onDragMover,
    onDragSoltar,
    onDragCancelar,
  });

  estadoRef.current = {
    puedeArrastrar: jugable && !deshabilitada,
    onDragInicio,
    onDragMover,
    onDragSoltar,
    onDragCancelar,
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponderCapture: (_evt, g) =>
          estadoRef.current.puedeArrastrar && Math.abs(g.dy) > 8,
        onPanResponderGrant: (_evt, g) => estadoRef.current.onDragInicio?.(g.moveX, g.moveY),
        onPanResponderMove: (_evt, g) => estadoRef.current.onDragMover?.(g.moveX, g.moveY),
        onPanResponderRelease: (_evt, g) => estadoRef.current.onDragSoltar?.(g.moveX, g.moveY),
        onPanResponderTerminate: () => estadoRef.current.onDragCancelar?.(),
        onPanResponderTerminationRequest: () => false,
      }),
    []
  );

  return (
    <View style={oculta && styles.oculta} {...responder.panHandlers}>
      <Tile
        valores={valores}
        size={size}
        seleccionada={seleccionada}
        jugable={jugable}
        onPress={onPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  oculta: {
    opacity: 0,
  },
});