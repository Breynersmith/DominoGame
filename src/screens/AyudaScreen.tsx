import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BotonPrincipal, CampoTexto, PantallaBase, Tarjeta, COLOR_AMBAR, COLOR_MENTA } from '../components/ui';
import { useT } from '../i18n/useT';
import { useAppStore } from '../store/appStore';

export function AyudaScreen() {
  const t = useT();
  const volverAtras = useAppStore(s => s.volverAtras);
  const notificar = useAppStore(s => s.notificar);

  const [mensaje, setMensaje] = useState('');
  const [enviado, setEnviado] = useState(false);

  const enviar = () => {
    if (!mensaje.trim()) return;
    notificar(t('disputas'), mensaje.trim());
    setEnviado(true);
    setMensaje('');
  };

  return (
    <PantallaBase titulo={t('soporteAyuda')} onVolver={volverAtras}>
      <ScrollView contentContainerStyle={styles.contenido} showsVerticalScrollIndicator={false}>
        <Text style={styles.titulo}>{t('preguntasFrecuentes')}</Text>

        <Tarjeta estilo={styles.faq}>
          <Text style={styles.pregunta}>{t('faq1P')}</Text>
          <Text style={styles.respuesta}>{t('faq1R')}</Text>
        </Tarjeta>
        <Tarjeta estilo={styles.faq}>
          <Text style={styles.pregunta}>{t('faq2P')}</Text>
          <Text style={styles.respuesta}>{t('faq2R')}</Text>
        </Tarjeta>

        <Text style={styles.titulo}>{t('disputas')}</Text>
        <Text style={styles.descripcion}>{t('disputaDesc')}</Text>
        <CampoTexto
          etiqueta={t('mensajeSoporte')}
          value={mensaje}
          multiline
          numberOfLines={4}
          onChangeText={text => {
            setMensaje(text);
            setEnviado(false);
          }}
        />
        {enviado && <Text style={styles.exito}>{t('soporteEnviado')}</Text>}
        <View style={styles.boton}>
          <BotonPrincipal label={t('enviar')} onPress={enviar} disabled={!mensaje.trim()} />
        </View>
      </ScrollView>
    </PantallaBase>
  );
}

const styles = StyleSheet.create({
  contenido: {
    padding: 20,
  },
  titulo: {
    color: COLOR_AMBAR,
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 12,
  },
  descripcion: {
    color: '#b0f0d6',
    fontSize: 14,
    marginBottom: 12,
  },
  faq: {
    marginBottom: 10,
  },
  pregunta: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  respuesta: {
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 20,
  },
  exito: {
    color: COLOR_MENTA,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  boton: {
    marginTop: 4,
  },
});