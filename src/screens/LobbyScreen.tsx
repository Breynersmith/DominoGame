import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BotonSecundario, PantallaBase, Tarjeta, COLOR_MENTA, COLOR_AMBAR } from '../components/ui';
import { useT } from '../i18n/useT';
import { apiListarSalas, SalaApi } from '../services/api';
import { useAppStore } from '../store/appStore';
import { useOnlineStore } from '../store/onlineStore';

interface SalaMock {
  id: string;
  nombre: string;
  apuesta: number;
  jugadores: number;
  max: number;
  codigo?: string;
}

const SALAS_MOCK: SalaMock[] = [
  { id: 's1', nombre: 'Sala de Ana', apuesta: 10, jugadores: 2, max: 4 },
  { id: 's2', nombre: 'Partida rápida', apuesta: 50, jugadores: 1, max: 4 },
  { id: 's3', nombre: 'Pote grande', apuesta: 100, jugadores: 4, max: 4 },
  { id: 's4', nombre: 'Mesa tranquila', apuesta: 0, jugadores: 3, max: 4 },
];

function mapear(sala: SalaApi): SalaMock {
  return {
    id: sala.codigo,
    nombre: sala.nombre,
    apuesta: sala.apuesta,
    jugadores: typeof sala.jugadores === 'number' ? sala.jugadores : sala.jugadores.length,
    max: 4,
    codigo: sala.codigo,
  };
}

export function LobbyScreen() {
  const t = useT();
  const volverAtras = useAppStore(s => s.volverAtras);
  const irA = useAppStore(s => s.irA);
  const setSalaModo = useAppStore(s => s.setSalaModo);
  const setModoAmigos = useAppStore(s => s.setModoAmigos);
  const online = useAppStore(s => s.online);
  const onlineStore = useOnlineStore();

  const [salas, setSalas] = useState<SalaMock[]>([]);

  useEffect(() => {
    let activo = true;
    if (online) {
      void apiListarSalas()
        .then(r => {
          if (activo) setSalas(r.salas.map(mapear));
        })
        .catch(() => {
          if (activo) setSalas(SALAS_MOCK);
        });
    } else {
      setSalas(SALAS_MOCK);
    }
    return () => {
      activo = false;
    };
  }, [online]);

  const unirse = (sala: SalaMock) => {
    if (sala.jugadores >= sala.max) return;
    if (sala.codigo) {
      onlineStore.conectarse();
      onlineStore.unirseSala(sala.codigo);
      irA('partidaOnline');
      return;
    }
    setSalaConfigLocal(sala);
  };

  const setSalaConfigLocal = (sala: SalaMock) => {
    const setSalaConfig = useAppStore.getState().setSalaConfig;
    setSalaConfig({ nombre: sala.nombre, apuesta: sala.apuesta, codigo: sala.codigo ?? '' });
    irA('inicio');
  };

  return (
    <PantallaBase titulo={t('lobby')} onVolver={volverAtras}>
      <ScrollView contentContainerStyle={styles.contenido} showsVerticalScrollIndicator={false}>
        <Text style={styles.etiqueta}>{t('salasDisponibles')}</Text>

        {salas.map(sala => {
          const llena = sala.jugadores >= sala.max;
          return (
            <Pressable
              key={sala.id}
              style={({ pressed }) => [styles.salaPresionable, pressed && styles.salaPresionada]}
              onPress={() => unirse(sala)}
            >
              <Tarjeta estilo={styles.sala}>
                <View style={styles.infoSala}>
                  <Text style={styles.nombreSala}>{sala.nombre}</Text>
                  <Text style={styles.detalleSala}>
                    {t('apuesta')}: {sala.apuesta} {t('creditos')}
                  </Text>
                  <Text style={styles.jugadores}>
                    {t('jugadores')}: {sala.jugadores}/{sala.max}
                  </Text>
                </View>
                <View style={[styles.chipEstado, llena ? styles.chipLlena : styles.chipDisponible]}>
                  <Text style={[styles.textoEstado, llena && styles.textoLlena]}>
                    {llena ? t('salaLlena') : t('unirseBtn')}
                  </Text>
                </View>
              </Tarjeta>
            </Pressable>
          );
        })}

        <View style={styles.botones}>
          <BotonSecundario
            label={t('crearSala')}
            onPress={() => {
              setSalaModo('crear');
              irA('sala');
            }}
          />
          <BotonSecundario
            label={t('unirseSalaPrivada')}
            onPress={() => {
              setSalaModo('unirse');
              irA('sala');
            }}
          />
          <BotonSecundario
            label={t('jugarConAmigo')}
            onPress={() => {
              setModoAmigos('invitar');
              irA('amigos');
            }}
          />
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
  sala: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  salaPresionable: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  salaPresionada: {
    opacity: 0.6,
  },
  infoSala: {
    flex: 1,
  },
  nombreSala: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  detalleSala: {
    color: COLOR_AMBAR,
    fontSize: 14,
    marginTop: 2,
  },
  jugadores: {
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 2,
  },
  chipEstado: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipDisponible: {
    backgroundColor: 'rgba(111,251,190,0.15)',
    borderWidth: 1,
    borderColor: COLOR_MENTA,
  },
  chipLlena: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  textoEstado: {
    color: COLOR_MENTA,
    fontSize: 13,
    fontWeight: '700',
  },
  textoLlena: {
    color: '#9ca3af',
  },
  botones: {
    marginTop: 20,
    gap: 12,
  },
});