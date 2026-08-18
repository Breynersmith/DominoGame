import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PantallaBase, Tarjeta, COLOR_MENTA, COLOR_AMBAR } from '../components/ui';
import { Transaccion } from '../store/appStore';
import { useT } from '../i18n/useT';
import { useAppStore } from '../store/appStore';

const COLOR_ERROR = '#ff6b6b';

function formatearFecha(fecha: number): string {
  const d = new Date(fecha);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${mi}`;
}

export function HistorialScreen() {
  const t = useT();
  const transacciones = useAppStore(s => s.transacciones);
  const volverAtras = useAppStore(s => s.volverAtras);
  const online = useAppStore(s => s.online);
  const sincronizar = useAppStore(s => s.sincronizar);

  useEffect(() => {
    if (online) void sincronizar();
  }, [online, sincronizar]);

  return (
    <PantallaBase titulo={t('historial')} onVolver={volverAtras}>
      <ScrollView contentContainerStyle={styles.contenido} showsVerticalScrollIndicator={false}>
        <Text style={styles.etiqueta}>{t('transacciones')}</Text>
        {transacciones.length === 0 ? (
          <Text style={styles.vacio}>{t('historialVacio')}</Text>
        ) : (
          transacciones.map(tx => (
            <FilaTransaccion key={tx.id} tx={tx} />
          ))
        )}
      </ScrollView>
    </PantallaBase>
  );
}

function FilaTransaccion({ tx }: { tx: Transaccion }) {
  const positivo = tx.monto > 0;
  return (
    <Tarjeta estilo={styles.fila}>
      <View style={styles.info}>
        <Text style={styles.descripcion}>{tx.descripcion}</Text>
        <Text style={styles.fecha}>{formatearFecha(tx.fecha)}</Text>
      </View>
      <Text style={[styles.monto, positivo ? styles.positivo : styles.negativo]}>
        {positivo ? '+' : ''}
        {tx.monto}
      </Text>
    </Tarjeta>
  );
}

const styles = StyleSheet.create({
  contenido: {
    padding: 20,
  },
  etiqueta: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  vacio: {
    color: '#9ca3af',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 40,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 12,
  },
  info: {
    flex: 1,
  },
  descripcion: {
    color: '#ffffff',
    fontSize: 15,
  },
  fecha: {
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 2,
  },
  monto: {
    fontSize: 18,
    fontWeight: '700',
  },
  positivo: {
    color: COLOR_MENTA,
  },
  negativo: {
    color: COLOR_ERROR,
  },
});