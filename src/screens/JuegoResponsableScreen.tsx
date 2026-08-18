import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { PantallaBase, Tarjeta } from '../components/ui';
import { useT } from '../i18n/useT';
import { useAppStore } from '../store/appStore';

export function JuegoResponsableScreen() {
  const t = useT();
  const volverAtras = useAppStore(s => s.volverAtras);

  return (
    <PantallaBase titulo={t('juegoResponsableTitulo')} onVolver={volverAtras}>
      <ScrollView contentContainerStyle={styles.contenido} showsVerticalScrollIndicator={false}>
        <Tarjeta estilo={styles.tarjeta}>
          <Text style={styles.cuerpo}>{t('juegoResponsableCuerpo')}</Text>
        </Tarjeta>
      </ScrollView>
    </PantallaBase>
  );
}

const styles = StyleSheet.create({
  contenido: {
    padding: 20,
  },
  tarjeta: {
    padding: 20,
  },
  cuerpo: {
    color: '#d1d5db',
    fontSize: 15,
    lineHeight: 24,
  },
});