import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { PantallaBase, COLOR_AMBAR, COLOR_MENTA } from '../components/ui';
import { useT } from '../i18n/useT';
import { useAppStore, Vista } from '../store/appStore';

export function PerfilScreen() {
  const t = useT();
  const perfil = useAppStore(s => s.perfil);
  const saldo = useAppStore(s => s.saldo);
  const volverAtras = useAppStore(s => s.volverAtras);
  const irA = useAppStore(s => s.irA);

  return (
    <PantallaBase titulo={t('perfil')} onVolver={volverAtras}>
      <ScrollView contentContainerStyle={styles.contenido} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.tarjetaCuenta} onPress={() => irA('editarPerfil')}>
          <Avatar
            foto={perfil?.foto}
            color={perfil?.color ?? '#006c49'}
            nombre={perfil?.nombre}
            tamano={80}
            estilo={styles.avatar}
          />
          <Text style={styles.nombre}>{perfil?.nombre ?? t('jugarInvitado')}</Text>
          <Text style={styles.saldo}>
            {saldo} {t('creditos')}
          </Text>
          <Text style={styles.cambiarFoto}>{t('cambiarFoto')}</Text>
        </Pressable>

        <View style={styles.seccion}>
          <Fila icono="b" label={t('billetera')} onPress={() => irA('billetera')} />
          <Fila icono="h" label={t('historial')} onPress={() => irA('historial')} />
          <Fila icono="a" label={t('amigos')} onPress={() => irA('amigos')} />
          <Fila icono="n" label={t('notificaciones')} onPress={() => irA('notificaciones')} />
        </View>

        <View style={styles.seccion}>
          <Fila icono="v" label={t('kycTitulo')} onPress={() => irA('kyc')} />
          <Fila icono="$" label={t('metodosPago')} onPress={() => irA('pagos')} />
        </View>

        <View style={styles.seccion}>
          <Fila icono="l" label={t('lobby')} onPress={() => irA('lobby')} />
          <Fila icono="e" label={t('editarPerfil')} onPress={() => irA('editarPerfil')} />
        </View>

        <View style={styles.seccion}>
          <Fila icono="s" label={t('soporteAyuda')} onPress={() => irA('ayuda')} />
          <Fila icono="t" label={t('terminos')} onPress={() => irA('terminos')} />
          <Fila icono="r" label={t('juegoResponsable')} onPress={() => irA('juegoResponsable')} />
        </View>
      </ScrollView>
    </PantallaBase>
  );
}

function Fila({ icono, label, onPress }: { icono: string; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.fila} onPress={onPress}>
      <View style={styles.iconoFila}>
        <Text style={styles.textoIcono}>{icono}</Text>
      </View>
      <Text style={styles.textoFila}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contenido: {
    padding: 20,
  },
  tarjetaCuenta: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  avatar: {
    borderWidth: 2,
    borderColor: 'rgba(111,251,190,0.4)',
  },
  cambiarFoto: {
    color: COLOR_MENTA,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
  },
  nombre: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 12,
  },
  saldo: {
    color: COLOR_AMBAR,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  seccion: {
    marginTop: 20,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(111,251,190,0.15)',
    overflow: 'hidden',
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  iconoFila: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(111,251,190,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoIcono: {
    color: COLOR_MENTA,
    fontSize: 15,
    fontWeight: '700',
  },
  textoFila: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  chevron: {
    color: '#9ca3af',
    fontSize: 22,
  },
});