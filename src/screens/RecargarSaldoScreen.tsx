import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BotonPrincipal, PantallaBase, Tarjeta, COLOR_MENTA } from '../components/ui';
import { FONT_INTER_SEMIBOLD } from '../constants/fonts';
import { useT } from '../i18n/useT';
import { useAppStore } from '../store/appStore';

const MONTOS = [100, 500, 1000, 5000];

export function RecargarSaldoScreen() {
  const t = useT();
  const recargarSaldo = useAppStore(s => s.recargarSaldo);
  const notificar = useAppStore(s => s.notificar);
  const volverAtras = useAppStore(s => s.volverAtras);

  const [monto, setMonto] = useState(MONTOS[1]);
  const [exito, setExito] = useState(false);

  const recargar = () => {
    recargarSaldo(monto, t('recargaDescTx'));
    notificar(t('billetera'), t('recargaExitosa'));
    setExito(true);
    setTimeout(volverAtras, 1200);
  };

  return (
    <PantallaBase titulo={t('recargarSaldo')} onVolver={volverAtras}>
      <ScrollView contentContainerStyle={styles.contenido} showsVerticalScrollIndicator={false}>
        <Text style={styles.etiqueta}>{t('montoRecarga')}</Text>
        <View style={styles.filaMontos}>
          {MONTOS.map(m => (
            <Pressable
              key={m}
              style={[styles.chip, m === monto && styles.chipActivo]}
              onPress={() => setMonto(m)}
            >
              <Text style={[styles.textoChip, m === monto && styles.textoChipActivo]}>{m}</Text>
            </Pressable>
          ))}
        </View>

        <Tarjeta estilo={styles.resumen}>
          <Text style={styles.resumenTexto}>
            {t('saldo')}: <Text style={styles.resumenMonto}>{monto}</Text> {t('creditos')}
          </Text>
        </Tarjeta>

        {exito && <Text style={styles.exito}>{t('recargaExitosa')}</Text>}

        <View style={styles.boton}>
          <BotonPrincipal label={t('recargar')} onPress={recargar} disabled={exito} />
        </View>
      </ScrollView>
    </PantallaBase>
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
  filaMontos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  chip: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  chipActivo: {
    borderColor: COLOR_MENTA,
    backgroundColor: 'rgba(111,251,190,0.15)',
  },
  textoChip: {
    color: '#d1d5db',
    fontSize: 18,
    fontFamily: FONT_INTER_SEMIBOLD,
  },
  textoChipActivo: {
    color: COLOR_MENTA,
  },
  resumen: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  resumenTexto: {
    color: '#d1d5db',
    fontSize: 16,
  },
  resumenMonto: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 20,
  },
  exito: {
    color: COLOR_MENTA,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 16,
  },
  boton: {
    marginTop: 24,
  },
});