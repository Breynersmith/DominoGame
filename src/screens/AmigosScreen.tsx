import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BotonPrincipal, CampoTexto, PantallaBase, Tarjeta, COLOR_MENTA } from '../components/ui';
import { useT } from '../i18n/useT';
import { apiAgregarAmigo, apiAmigos, apiEliminarAmigo, ErrorApi } from '../services/api';
import { useAppStore } from '../store/appStore';

export function AmigosScreen() {
  const t = useT();
  const amigos = useAppStore(s => s.amigos);
  const online = useAppStore(s => s.online);
  const set = useAppStore.setState;
  const volverAtras = useAppStore(s => s.volverAtras);

  const [nombre, setNombre] = useState('');
  const [exito, setExito] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!online) return;
    let activo = true;
    void apiAmigos()
      .then(r => {
        if (activo) set({ amigos: r.amigos.map(a => a.nombre) });
      })
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, [online, set]);

  const anadir = () => {
    setError('');
    setExito(false);
    if (!online) {
      if (useAppStore.getState().agregarAmigo(nombre)) {
        setExito(true);
        setNombre('');
      } else {
        setError(t('amigoYaExiste'));
      }
      return;
    }
    void apiAgregarAmigo(nombre.trim())
      .then(r => {
        set({ amigos: r.amigos.map(a => a.nombre) });
        setExito(true);
        setNombre('');
      })
      .catch((err: unknown) => {
        const codigo = err instanceof ErrorApi ? err.codigo : '';
        setError(codigo === 'usuario_no_encontrado' ? t('amigoYaExiste') : t('sinConexion'));
      });
  };

  const eliminar = (a: string) => {
    if (!online) {
      useAppStore.getState().eliminarAmigo(a);
      return;
    }
    void apiEliminarAmigo(a)
      .then(r => set({ amigos: r.amigos.map(x => x.nombre) }))
      .catch(() => {});
  };

  return (
    <PantallaBase titulo={t('amigos')} onVolver={volverAtras}>
      <ScrollView contentContainerStyle={styles.contenido} showsVerticalScrollIndicator={false}>
        <Text style={styles.etiqueta}>{t('nombreAmigo')}</Text>
        <View style={styles.filaAgregar}>
          <View style={styles.inputFlex}>
            <CampoTexto
              etiqueta=""
              value={nombre}
              placeholder={t('nombreAmigo')}
              maxLength={18}
              autoCapitalize="none"
              onChangeText={text => {
                setNombre(text);
                setError('');
                setExito(false);
              }}
            />
          </View>
        </View>
        <View style={styles.botonAgregar}>
          <BotonPrincipal label={t('agregarAmigo')} onPress={anadir} disabled={!nombre.trim()} />
        </View>
        {exito && <Text style={styles.exito}>{t('amigoAgregado')}</Text>}
        {error !== '' && <Text style={styles.error}>{error}</Text>}

        <Text style={styles.tituloLista}>{t('amigos')}</Text>
        {amigos.length === 0 ? (
          <Text style={styles.vacio}>{t('sinAmigos')}</Text>
        ) : (
          amigos.map(a => (
            <Tarjeta key={a} estilo={styles.filaAmigo}>
              <View style={styles.avatarAmigo}>
                <Text style={styles.inicialAmigo}>{a.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={styles.nombreAmigo}>{a}</Text>
              <Pressable style={styles.botonEliminar} onPress={() => eliminar(a)}>
                <Text style={styles.textoEliminar}>{t('eliminar')}</Text>
              </Pressable>
            </Tarjeta>
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
  etiqueta: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  filaAgregar: {
    flexDirection: 'row',
    gap: 10,
  },
  inputFlex: {
    flex: 1,
  },
  botonAgregar: {
    marginTop: 4,
    marginBottom: 8,
  },
  exito: {
    color: COLOR_MENTA,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  error: {
    color: '#ff6b6b',
    fontSize: 14,
    marginBottom: 8,
  },
  tituloLista: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 10,
  },
  vacio: {
    color: '#9ca3af',
    fontSize: 14,
    lineHeight: 20,
  },
  filaAmigo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarAmigo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(111,251,190,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inicialAmigo: {
    color: COLOR_MENTA,
    fontSize: 18,
    fontWeight: '700',
  },
  nombreAmigo: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  botonEliminar: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,107,107,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.35)',
  },
  textoEliminar: {
    color: '#ff6b6b',
    fontSize: 13,
    fontWeight: '600',
  },
});