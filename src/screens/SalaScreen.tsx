import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BotonPrincipal, CampoTexto, PantallaBase, Tarjeta, COLOR_AMBAR, COLOR_MENTA } from '../components/ui';
import { useT } from '../i18n/useT';
import { apiCrearSala } from '../services/api';
import { useAppStore } from '../store/appStore';
import { useOnlineStore } from '../store/onlineStore';

const APUESTAS = [0, 10, 25, 50, 100];

function generarCodigo(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let codigo = '';
  for (let i = 0; i < 6; i++) codigo += chars[Math.floor(Math.random() * chars.length)];
  return codigo;
}

export function SalaScreen() {
  const t = useT();
  const salaModo = useAppStore(s => s.salaModo);
  const perfil = useAppStore(s => s.perfil);
  const online = useAppStore(s => s.online);
  const setSalaConfig = useAppStore(s => s.setSalaConfig);
  const volverAtras = useAppStore(s => s.volverAtras);
  const irA = useAppStore(s => s.irA);
  const notificar = useAppStore(s => s.notificar);
  const onlineStore = useOnlineStore();

  const [nombre, setNombre] = useState(perfil ? `Sala de ${perfil.nombre}` : 'Sala privada');
  const [apuesta, setApuesta] = useState(25);
  const [codigo, setCodigo] = useState('');
  const [codigoGenerado] = useState(generarCodigo);
  const [error, setError] = useState(false);

  const crear = () => {
    const nombreSala = nombre.trim() || 'Sala privada';
    if (online) {
      void apiCrearSala(nombreSala, apuesta)
        .then(({ sala }) => {
          setSalaConfig({ nombre: sala.nombre, apuesta: sala.apuesta, codigo: sala.codigo });
          onlineStore.conectarse();
          onlineStore.unirseSala(sala.codigo);
          irA('partidaOnline');
        })
        .catch(() => {
          // sin conexión: se juega localmente
          setSalaConfig({ nombre: nombreSala, apuesta, codigo: codigoGenerado });
          notificar(t('salaCreada'), t('invitacion') + ': ' + codigoGenerado);
          irA('inicio');
        });
    } else {
      setSalaConfig({ nombre: nombreSala, apuesta, codigo: codigoGenerado });
      notificar(t('salaCreada'), t('invitacion') + ': ' + codigoGenerado);
      irA('inicio');
    }
  };

  const unirse = () => {
    const codigoLimpio = codigo.trim().toUpperCase();
    if (codigoLimpio.length < 4) {
      setError(true);
      return;
    }
    if (online) {
      onlineStore.conectarse();
      onlineStore.unirseSala(codigoLimpio);
      irA('partidaOnline');
    } else {
      setSalaConfig({ nombre: t('salaPrivada'), apuesta: 50, codigo: codigoLimpio });
      irA('inicio');
    }
  };

  return (
    <PantallaBase
      titulo={salaModo === 'crear' ? t('crearSala') : t('unirseSalaPrivada')}
      onVolver={volverAtras}
    >
      <ScrollView contentContainerStyle={styles.contenido} showsVerticalScrollIndicator={false}>
        {salaModo === 'crear' ? (
          <>
            <CampoTexto
              etiqueta={t('nombreSala')}
              value={nombre}
              maxLength={24}
              onChangeText={setNombre}
            />
            <Text style={styles.etiqueta}>{t('apuesta')}</Text>
            <View style={styles.filaApuestas}>
              {APUESTAS.map(valor => (
                <ChipApuesta
                  key={valor}
                  label={valor === 0 ? t('sinApuesta') : `${valor}`}
                  activo={apuesta === valor}
                  onPress={() => setApuesta(valor)}
                />
              ))}
            </View>
            <Tarjeta estilo={styles.tarjetaCodigo}>
              <Text style={styles.labelCodigo}>{t('codigoSala')}</Text>
              <Text style={styles.textoCodigo}>{codigoGenerado}</Text>
              <Text style={styles.avisoCodigo}>{t('invitacion')}</Text>
            </Tarjeta>
            <View style={styles.boton}>
              <BotonPrincipal label={t('crearSala')} onPress={crear} />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.descripcion}>{t('invitacion')}</Text>
            <CampoTexto
              etiqueta={t('codigoSala')}
              value={codigo}
              placeholder="ABC123"
              maxLength={8}
              autoCapitalize="characters"
              onChangeText={text => {
                setCodigo(text);
                if (error) setError(false);
              }}
            />
            {error && <Text style={styles.error}>{t('codigoInvalido')}</Text>}
            <View style={styles.boton}>
              <BotonPrincipal label={t('unirseBtn')} onPress={unirse} />
            </View>
          </>
        )}
      </ScrollView>
    </PantallaBase>
  );
}

function ChipApuesta({ label, activo, onPress }: { label: string; activo: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, activo && styles.chipActivo]} onPress={onPress}>
      <Text style={[styles.textoChip, activo && styles.textoChipActivo]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contenido: {
    padding: 20,
  },
  etiqueta: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 4,
  },
  descripcion: {
    color: '#b0f0d6',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  filaApuestas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  chipActivo: {
    borderColor: COLOR_AMBAR,
    backgroundColor: 'rgba(255,185,95,0.15)',
  },
  textoChip: {
    color: '#d1d5db',
    fontSize: 16,
    fontWeight: '600',
  },
  textoChipActivo: {
    color: COLOR_AMBAR,
  },
  tarjetaCodigo: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  labelCodigo: {
    color: '#9ca3af',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  textoCodigo: {
    color: COLOR_MENTA,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 6,
    marginTop: 8,
  },
  avisoCodigo: {
    color: '#d1d5db',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  error: {
    color: '#ff6b6b',
    fontSize: 14,
    marginBottom: 8,
  },
  boton: {
    marginTop: 12,
  },
});