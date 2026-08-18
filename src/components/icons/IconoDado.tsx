import React from 'react';
import { StyleSheet, View } from 'react-native';

interface Props {
  color: string;
  size?: number;
}

export function IconoDado({ color, size = 24 }: Props) {
  const pip = size * 0.16;
  return (
    <View
      style={[
        styles.dado,
        {
          width: size,
          height: size,
          borderRadius: size * 0.22,
        },
      ]}
    >
      <View style={styles.fila}>
        <View style={[styles.punto, { width: pip, height: pip, borderRadius: pip / 2, backgroundColor: color }]} />
        <View style={[styles.punto, { width: pip, height: pip, borderRadius: pip / 2, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dado: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  punto: {
    margin: 0,
  },
});