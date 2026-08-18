import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BotonPrincipal, PantallaBase } from '../components/ui';
import { useT } from '../i18n/useT';
import { useAppStore } from '../store/appStore';

export function TerminosScreen() {
  const t = useT();
  const volverAtras = useAppStore(s => s.volverAtras);

  return (
    <PantallaBase titulo={t('terminosTitulo')} onVolver={volverAtras}>
      <ScrollView contentContainerStyle={styles.contenido} showsVerticalScrollIndicator={false}>
        <Text style={styles.cuerpo}>{t('terminosCuerpo')}</Text>
        <View style={styles.boton}>
          <BotonPrincipal label={t('aceptarTerminos')} onPress={volverAtras} />
        </View>
      </ScrollView>
    </PantallaBase>
  );
}

const styles = StyleSheet.create({
  contenido: {
    padding: 20,
  },
  cuerpo: {
    color: '#d1d5db',
    fontSize: 15,
    lineHeight: 24,
  },
  boton: {
    marginTop: 28,
  },
});