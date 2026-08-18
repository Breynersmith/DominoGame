import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Pips } from './Pips';

interface Props {
  size?: number;
}

export function Logo({ size = 96 }: Props) {
  const pips = Math.round(size * 0.26);
  const pad = Math.round(size * 0.055);
  const margen = Math.round(size * 0.045);
  const radio = Math.round(pips * 0.22);

  return (
    <View style={[styles.caja, { width: size, height: size, borderRadius: size * 0.22 }]}>
      <View
        style={[
          styles.ficha,
          { padding: pad, borderRadius: radio, transform: [{ rotate: '-10deg' }] },
        ]}
      >
        <Pips valor={6} size={pips} />
        <View style={[styles.divisor, { height: 1, width: '100%', marginVertical: margen }]} />
        <Pips valor={6} size={pips} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  caja: {
    backgroundColor: '#14532d',
    borderWidth: 2,
    borderColor: '#166534',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 10,
  },
  ficha: {
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  divisor: {
    backgroundColor: '#d1d5db',
  },
});