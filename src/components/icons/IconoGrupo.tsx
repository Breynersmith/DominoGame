import React from 'react';
import { StyleSheet, View } from 'react-native';
import { IconoPersona } from './IconoPersona';

interface Props {
  color: string;
  size?: number;
}

export function IconoGrupo({ color, size = 24 }: Props) {
  const medida = size * 0.82;
  return (
    <View style={[styles.caja, { width: size, height: size }]}>
      <View
        style={[styles.persona, styles.personaTrasera, { width: medida, height: medida, left: 0, top: size * 0.12 }]}
      >
        <IconoPersona color={color} size={medida} />
      </View>
      <View style={[styles.persona, { width: medida, height: medida, right: 0, top: 0 }]}>
        <IconoPersona color={color} size={medida} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  caja: {
    position: 'relative',
  },
  persona: {
    position: 'absolute',
  },
  personaTrasera: {
    opacity: 0.55,
  },
});