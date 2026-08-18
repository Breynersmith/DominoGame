import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PantallaBase, BotonPrincipal, Tarjeta, COLOR_MENTA, COLOR_AMBAR } from '../components/ui';
import * as ImagePicker from 'expo-image-picker';
import { useT } from '../i18n/useT';
import { Traducciones } from '../i18n/traducciones';
import { useAppStore } from '../store/appStore';

const TIPOS = ['dni', 'nie', 'pasaporte'] as const;
const NUMERO_REGEX = /^[A-Za-z0-9-]{5,20}$/;

const TEXTO_ESTADO: Record<string, string> = {
  no_enviado: 'kycEstadoNoEnviado',
  pendiente: 'kycEstadoPendiente',
  aprobado: 'kycEstadoAprobado',
  rechazado: 'kycEstadoRechazado',
};

const TEXTO_TIPO: Record<string, string> = {
  dni: 'tipoDni',
  nie: 'tipoNie',
  pasaporte: 'tipoPasaporte',
};

export function KycScreen() {
  const t = useT();
  const volverAtras = useAppStore(s => s.volverAtras);
  const perfil = useAppStore(s => s.perfil);
  const enviarKyc = useAppStore(s => s.enviarKyc);

  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>('dni');
  const [numero, setNumero] = useState('');
  const [selfie, setSelfie] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(false);
  const [error, setError] = useState(false);

  const estado = perfil?.kycEstado ?? 'no_enviado';

  const tomarSelfie = async () => {
    setError(false);
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      setError(true);
      return;
    }
    const r = await ImagePicker.launchCameraAsync({
      quality: 0.6,
      base64: true,
    });
    if (!r.canceled && r.assets[0]?.base64) {
      setSelfie(`data:image/jpeg;base64,${r.assets[0].base64}`);
    }
  };

  const enviar = async () => {
    setError(false);
    setExito(false);
    if (!NUMERO_REGEX.test(numero.trim()) || !selfie) {
      setError(true);
      return;
    }
    setEnviando(true);
    const ok = await enviarKyc(tipo, numero.trim(), selfie);
    setEnviando(false);
    if (ok) setExito(true);
    else setError(true);
  };

  return (
    <PantallaBase titulo={t('kycTitulo')} onVolver={volverAtras}>
      <ScrollView contentContainerStyle={styles.contenido} showsVerticalScrollIndicator={false}>
        <Text style={styles.descripcion}>{t('kycDesc')}</Text>

        <Tarjeta>
          <View style={styles.filaEstado}>
            <Text style={styles.etiquetaEstado}>Estado</Text>
            <Text style={styles.estadoActual}>{t(TEXTO_ESTADO[estado] as keyof Traducciones)}</Text>
          </View>

          <Text style={styles.etiqueta}>{t('kycTipoDocumento')}</Text>
          <View style={styles.filaTipos}>
            {TIPOS.map(tt => (
              <Pressable
                key={tt}
                style={[styles.chip, tipo === tt && styles.chipActivo]}
                onPress={() => setTipo(tt)}
              >
                <Text style={[styles.textoChip, tipo === tt && styles.textoChipActivo]}>
                  {t(TEXTO_TIPO[tt] as keyof Traducciones)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.etiqueta}>{t('kycNumeroDocumento')}</Text>
          <TextInput
            style={styles.input}
            value={numero}
            placeholder="12345678A"
            placeholderTextColor="#9ca3af"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={20}
            onChangeText={text => {
              setNumero(text);
              setError(false);
            }}
          />

          <Text style={styles.etiqueta}>{t('kycSelfie')}</Text>
          {selfie ? (
            <Pressable onPress={tomarSelfie}>
              <Image source={{ uri: selfie }} style={styles.selfie} />
            </Pressable>
          ) : (
            <Pressable style={styles.botonSelfie} onPress={tomarSelfie}>
              <Text style={styles.textoBotonSelfie}>{t('kycTomarSelfie')}</Text>
            </Pressable>
          )}

          {error && <Text style={styles.error}>{t('kycError')}</Text>}
          {exito && <Text style={styles.exito}>{t('kycEnviado')}</Text>}

          <View style={styles.boton}>
            <BotonPrincipal label={enviando ? '…' : t('kycEnviar')} onPress={enviar} disabled={enviando} />
          </View>
        </Tarjeta>
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
  filaEstado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  etiquetaEstado: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
  estadoActual: {
    color: COLOR_AMBAR,
    fontSize: 14,
    fontWeight: '700',
  },
  etiqueta: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 4,
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
  botonSelfie: {
    alignItems: 'center',
    paddingVertical: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(111,251,190,0.4)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(111,251,190,0.06)',
    marginBottom: 12,
  },
  textoBotonSelfie: {
    color: COLOR_MENTA,
    fontSize: 15,
    fontWeight: '700',
  },
  selfie: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(111,251,190,0.4)',
    marginBottom: 12,
  },
  error: {
    color: '#ff6b6b',
    fontSize: 14,
    marginBottom: 8,
  },
  exito: {
    color: '#6ffbbe',
    fontSize: 14,
    marginBottom: 8,
  },
  boton: {
    marginTop: 4,
  },
});