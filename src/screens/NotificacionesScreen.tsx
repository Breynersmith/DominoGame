import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BotonSecundario, PantallaBase, Tarjeta, COLOR_MENTA } from '../components/ui';
import { useT } from '../i18n/useT';
import { useAppStore } from '../store/appStore';

function formatearFecha(fecha: number): string {
  const d = new Date(fecha);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${mi}`;
}

export function NotificacionesScreen() {
  const t = useT();
  const notificaciones = useAppStore(s => s.notificaciones);
  const marcarNotificacionLeida = useAppStore(s => s.marcarNotificacionLeida);
  const limpiarNotificaciones = useAppStore(s => s.limpiarNotificaciones);
  const volverAtras = useAppStore(s => s.volverAtras);

  return (
    <PantallaBase titulo={t('notificaciones')} onVolver={volverAtras}>
      <ScrollView contentContainerStyle={styles.contenido} showsVerticalScrollIndicator={false}>
        {notificaciones.length > 0 && (
          <View style={styles.botonMarcar}>
            <BotonSecundario label={t('marcarLeidas')} onPress={limpiarNotificaciones} />
          </View>
        )}

        {notificaciones.length === 0 ? (
          <Text style={styles.vacio}>{t('sinNotificaciones')}</Text>
        ) : (
          notificaciones.map(n => (
            <Pressable key={n.id} onPress={() => !n.leida && marcarNotificacionLeida(n.id)}>
              <Tarjeta estilo={[styles.notificacion, !n.leida && styles.noLeida]}>
                <View style={[styles.puntoEstado, n.leida && styles.puntoLeida]} />
                <View style={styles.info}>
                  <Text style={styles.titulo}>{n.titulo}</Text>
                  <Text style={styles.cuerpo}>{n.cuerpo}</Text>
                  <Text style={styles.fecha}>{formatearFecha(n.fecha)}</Text>
                </View>
              </Tarjeta>
            </Pressable>
          ))
        )}
      </ScrollView>
    </PantallaBase>
  );
}

const styles = StyleSheet.create({
  contenido: {
    padding: 20,
  },
  botonMarcar: {
    marginBottom: 16,
  },
  vacio: {
    color: '#9ca3af',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 40,
  },
  notificacion: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    opacity: 0.7,
  },
  noLeida: {
    opacity: 1,
    borderColor: 'rgba(111,251,190,0.45)',
  },
  puntoEstado: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLOR_MENTA,
    marginTop: 6,
    marginRight: 10,
  },
  puntoLeida: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  info: {
    flex: 1,
  },
  titulo: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  cuerpo: {
    color: '#d1d5db',
    fontSize: 14,
    marginTop: 2,
    lineHeight: 19,
  },
  fecha: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 4,
  },
});