import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PantallaBase, BotonPrincipal, Tarjeta, COLOR_MENTA, COLOR_AMBAR } from '../components/ui';
import {
  apiAgregarPago,
  apiEliminarPago,
  apiListarPagos,
  apiPagoPredeterminado,
  MetodoPagoApi,
} from '../services/api';
import { useT } from '../i18n/useT';
import { Traducciones } from '../i18n/traducciones';
import { useAppStore } from '../store/appStore';

const TIPOS = ['tarjeta', 'paypal', 'cripto'] as const;

const TEXTO_TIPO: Record<string, string> = {
  tarjeta: 'tipoTarjeta',
  paypal: 'tipoPaypal',
  cripto: 'tipoCripto',
};

export function PagosScreen() {
  const t = useT();
  const volverAtras = useAppStore(s => s.volverAtras);

  const [pagos, setPagos] = useState<MetodoPagoApi[]>([]);
  const [cargando, setCargando] = useState(true);
  const [agregando, setAgregando] = useState(false);
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>('tarjeta');
  const [datos, setDatos] = useState('');
  const [error, setError] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const recargar = useCallback(async () => {
    try {
      const r = await apiListarPagos();
      setPagos(r.pagos);
    } catch {
      setError(true);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const agregar = async () => {
    if (!datos.trim()) {
      setError(true);
      return;
    }
    setError(false);
    setMensaje('');
    setAgregando(true);
    try {
      await apiAgregarPago(tipo, datos.trim());
      setDatos('');
      setMensaje(t('pagoAgregado'));
      await recargar();
    } catch {
      setError(true);
    } finally {
      setAgregando(false);
    }
  };

  const eliminar = async (id: number) => {
    setMensaje('');
    try {
      await apiEliminarPago(id);
      setMensaje(t('pagoEliminado'));
      await recargar();
    } catch {
      setError(true);
    }
  };

  const marcarPredeterminado = async (id: number) => {
    try {
      await apiPagoPredeterminado(id);
      await recargar();
    } catch {
      setError(true);
    }
  };

  return (
    <PantallaBase titulo={t('metodosPago')} onVolver={volverAtras}>
      <ScrollView contentContainerStyle={styles.contenido} showsVerticalScrollIndicator={false}>
        <Text style={styles.descripcion}>{t('pagosDesc')}</Text>

        <Tarjeta>
          <Text style={styles.etiqueta}>{t('agregarMetodo')}</Text>
          <View style={styles.filaTipos}>
            {TIPOS.map(tt => (
              <Pressable
                key={tt}
                style={[styles.chip, tipo === tt && styles.chipActivo]}
                onPress={() => setTipo(tt)}
              >
                <Text style={[styles.textoChip, tipo === tt && styles.textoChipActivo]}>
                  {t(TEXTO_TIPO[tt] as never)}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.input}
            value={datos}
            placeholder={t('datosEnmascarados')}
            placeholderTextColor="#9ca3af"
            maxLength={120}
            onChangeText={text => {
              setDatos(text);
              setError(false);
            }}
          />
          <View style={styles.boton}>
            <BotonPrincipal label={agregando ? '…' : t('agregarMetodo')} onPress={agregar} disabled={agregando} />
          </View>
        </Tarjeta>

        {cargando ? (
          <ActivityIndicator color={COLOR_MENTA} style={styles.cargando} />
        ) : (
          pagos.map(p => (
            <View key={p.id} style={styles.filaPago}>
              <View style={styles.infoPago}>
                <Text style={styles.tipoPago}>{t((TEXTO_TIPO[p.tipo] ?? 'tipoTarjeta') as keyof Traducciones)}</Text>
                <Text style={styles.datosPago}>{p.datosEnmascarados}</Text>
                {p.predeterminada && <Text style={styles.predeterminada}>{t('predeterminado')}</Text>}
              </View>
              <Pressable style={styles.accion} onPress={() => marcarPredeterminado(p.id)}>
                <Text style={styles.textoAccion}>{t('marcarPredeterminado')}</Text>
              </Pressable>
              <Pressable style={styles.accionEliminar} onPress={() => eliminar(p.id)}>
                <Text style={styles.textoEliminar}>{t('eliminar')}</Text>
              </Pressable>
            </View>
          ))
        )}

        {error && <Text style={styles.error}>{t('kycError')}</Text>}
        {mensaje !== '' && <Text style={styles.mensaje}>{mensaje}</Text>}
      </ScrollView>
    </PantallaBase>
  );
}

const styles = StyleSheet.create({
  contenido: {
    padding: 20,
  },
  descripcion: {
    color: '#b0f0d6',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  etiqueta: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  filaTipos: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipActivo: {
    backgroundColor: 'rgba(111,251,190,0.15)',
    borderColor: COLOR_MENTA,
  },
  textoChip: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
  textoChipActivo: {
    color: COLOR_MENTA,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    color: '#ffffff',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  boton: {
    marginTop: 4,
  },
  cargando: {
    marginTop: 24,
  },
  filaPago: {
    marginTop: 16,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(111,251,190,0.15)',
    padding: 14,
  },
  infoPago: {
    marginBottom: 10,
  },
  tipoPago: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  datosPago: {
    color: '#d1d5db',
    fontSize: 14,
    marginTop: 2,
  },
  predeterminada: {
    color: COLOR_AMBAR,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  accion: {
    marginTop: 6,
  },
  textoAccion: {
    color: '#6ffbbe',
    fontSize: 14,
    fontWeight: '600',
  },
  accionEliminar: {
    marginTop: 6,
  },
  textoEliminar: {
    color: '#ff6b6b',
    fontSize: 14,
    fontWeight: '600',
  },
  error: {
    color: '#ff6b6b',
    fontSize: 14,
    marginTop: 16,
  },
  mensaje: {
    color: '#6ffbbe',
    fontSize: 14,
    marginTop: 16,
  },
});