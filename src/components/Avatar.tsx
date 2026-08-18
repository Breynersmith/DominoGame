import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { FONT_MONTSERRAT_EXTRA } from '../constants/fonts';
import { IconoJugador } from './icons/IconoJugador';

interface Props {
  foto?: string;
  color: string;
  nombre?: string;
  tamano: number;
  estilo?: object;
}

export function Avatar({ foto, color, nombre, tamano, estilo }: Props) {
  if (foto) {
    return (
      <Image
        source={{ uri: foto }}
        style={[styles.imagen, { width: tamano, height: tamano, borderRadius: tamano / 2 }, estilo]}
      />
    );
  }
  return (
    <View
      style={[
        styles.contenedor,
        { width: tamano, height: tamano, borderRadius: tamano / 2, backgroundColor: color },
        estilo,
      ]}
    >
      {nombre ? (
        <Text style={[styles.inicial, { fontSize: tamano * 0.48 }]}>
          {nombre.charAt(0).toUpperCase()}
        </Text>
      ) : (
        <IconoJugador color="#ffffff" size={tamano * 0.66} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  imagen: {
    backgroundColor: '#0f766e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  contenedor: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  inicial: {
    color: '#ffffff',
    fontFamily: FONT_MONTSERRAT_EXTRA,
  },
});