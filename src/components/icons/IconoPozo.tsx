import React from 'react';
import { StyleSheet, View } from 'react-native';

interface Props {
  size?: number;
}

export function IconoPozo({ size = 24 }: Props) {
  return (
    <View style={[styles.caja, { width: size, height: size }]}>
      <View
        style={[
          styles.fichaAtras,
          { width: size * 0.5, height: size * 0.42, left: size * 0.06, top: size * 0.42 },
        ]}
      />
      <View
        style={[
          styles.fichaAtras,
          { width: size * 0.56, height: size * 0.46, left: size * 0.16, top: size * 0.3 },
        ]}
      />
      <View
        style={[
          styles.fichaFrente,
          { width: size * 0.6, height: size * 0.48, left: size * 0.3, top: size * 0.12 },
        ]}
      >
        <View style={[styles.punto, { width: size * 0.12, height: size * 0.12, borderRadius: size * 0.06 }]} />
        <View style={[styles.divisor, { width: 1, height: size * 0.26 }]} />
        <View style={[styles.punto, { width: size * 0.12, height: size * 0.12, borderRadius: size * 0.06 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  caja: {
    position: 'relative',
  },
  fichaAtras: {
    position: 'absolute',
    backgroundColor: '#cbd5e1',
    borderWidth: 1,
    borderColor: '#94a3b8',
    borderRadius: 4,
  },
  fichaFrente: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#94a3b8',
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 2,
  },
  divisor: {
    backgroundColor: '#cbd5e1',
  },
  punto: {
    backgroundColor: '#1f2937',
  },
});