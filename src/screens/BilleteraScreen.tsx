import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BotonSecundario, PantallaBase, Tarjeta, COLOR_MENTA, COLOR_AMBAR } from '../components/ui';
import { FONT_MONTSERRAT_EXTRA } from '../constants/fonts';
import { useT } from '../i18n/useT';
import { useAppStore } from '../store/appStore';

export function BilleteraScreen() {
  const t = useT();
  const saldo = useAppStore(s => s.saldo);
  const perfil = useAppStore(s => s.perfil);
  const volverAtras = useAppStore(s => s.volverAtras);
  const irA = useAppStore(s => s.irA);
  const online = useAppStore(s => s.online);
  const sincronizar = useAppStore(s => s.sincronizar);

  useEffect(() => {
    if (online) void sincronizar();
  }, [online, sincronizar]);

  const verificada = perfil?.cuentaVerificada === true;

  return (
    <PantallaBase titulo={t('billetera')} onVolver={volverAtras}>
      <View style={styles.contenido}>
        <Tarjeta estilo={styles.tarjetaSaldo}>
          <Text style={styles.etiquetaSaldo}>{t('saldo')}</Text>
          <Text style={styles.saldo}>{saldo}</Text>
          <Text style={styles.unidades}>{t('creditos')}</Text>
        </Tarjeta>

        {!verificada && (
          <Pressable style={styles.aviso} onPress={() => irA('verificarCuenta')}>
            <Text style={styles.avisoTexto}>{t('recargaRequiereVerificacion')}</Text>
          </Pressable>
        )}

        <View style={styles.botones}>
          <BotonSecundario label={t('recargarSaldo')} onPress={() => irA('recargar')} disabled={!verificada} />
          <BotonSecundario label={t('historial')} onPress={() => irA('historial')} />
        </View>
      </View>
    </PantallaBase>
  );
}

const styles = StyleSheet.create({
  contenido: {
    padding: 20,
  },
  tarjetaSaldo: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  etiquetaSaldo: {
    color: COLOR_AMBAR,
    fontSize: 15,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  saldo: {
    color: '#ffffff',
    fontSize: 56,
    fontFamily: FONT_MONTSERRAT_EXTRA,
    marginTop: 8,
  },
  unidades: {
    color: COLOR_MENTA,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2,
  },
  botones: {
    marginTop: 24,
    gap: 12,
  },
  aviso: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(250,204,21,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.35)',
  },
  avisoTexto: {
    color: '#facc15',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});