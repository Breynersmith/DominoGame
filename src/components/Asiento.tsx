import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Jugador } from '../game/types';
import { useT } from '../i18n/useT';
import { Avatar } from './Avatar';
import { FichaBocaAbajo } from './icons/FichaBocaAbajo';

const COLOR_MENTA = '#6FFBBE';
const COLOR_AMBAR = '#ffb95f';

interface Props {
  jugador: Jugador;
  color: string;
  activo?: boolean;
  pensando?: boolean;
  orientacion?: 'horizontal' | 'vertical';
  soloAvatar?: boolean;
}

export function Asiento({
  jugador,
  color,
  activo = false,
  pensando = false,
  orientacion = 'horizontal',
  soloAvatar = false,
}: Props) {
  const t = useT();
  const vertical = orientacion === 'vertical';

  if (soloAvatar) {
    return (
      <View
        style={[
          styles.avatarSolo,
          activo && styles.activo,
          pensando && styles.pensando,
          { backgroundColor: color },
        ]}
      >
        <Avatar foto={jugador.foto} color={color} nombre={jugador.nombre} tamano={36} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.asiento,
        vertical && styles.vertical,
        activo && styles.activo,
        pensando && styles.pensando,
      ]}
    >
      <View style={[styles.avatar, vertical && styles.avatarVertical, { backgroundColor: color }]}>
        <Avatar foto={jugador.foto} color={color} nombre={jugador.nombre} tamano={vertical ? 28 : 38} />
      </View>
      <View style={vertical ? styles.infoVertical : styles.info}>
        <Text style={[styles.nombre, activo && styles.nombreActivo]} numberOfLines={1}>
          {jugador.nombre}
          {jugador.esBot ? ` (${t('bot')})` : ''}
        </Text>
        <View style={styles.filaFichas}>
          <View style={styles.iconoFicha}>
            <FichaBocaAbajo size={11} opacidad={1} />
          </View>
          <Text style={styles.fichas}>{t('fichas', { n: jugador.mano.length })}</Text>
        </View>
        {pensando && <Text style={styles.pensandoTexto}>{t('pensando')}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  asiento: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  avatarSolo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  vertical: {
    flexDirection: 'column',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  activo: {
    borderColor: COLOR_MENTA,
    backgroundColor: 'rgba(111,251,190,0.12)',
  },
  pensando: {
    opacity: 0.85,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarVertical: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  info: {
    flexShrink: 1,
  },
  infoVertical: {
    alignItems: 'center',
    width: '100%',
  },
  nombre: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  nombreActivo: {
    color: COLOR_MENTA,
  },
  filaFichas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 1,
  },
  iconoFicha: {
    opacity: 0.9,
  },
  fichas: {
    fontSize: 13,
    color: COLOR_AMBAR,
    fontWeight: '500',
  },
  pensandoTexto: {
    fontSize: 12,
    color: COLOR_AMBAR,
    fontStyle: 'italic',
    marginTop: 2,
  },
});