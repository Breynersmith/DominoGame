import React, { useState } from 'react';
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { BotonPrincipal, CampoTexto, PantallaBase } from '../components/ui';
import { FONT_MONTSERRAT_EXTRA } from '../constants/fonts';
import { useT } from '../i18n/useT';
import { apiEditarPerfil } from '../services/api';
import { useAppStore } from '../store/appStore';
import { useOnlineStore } from '../store/onlineStore';

const COLORES = ['#006c49', '#0f766e', '#1d4ed8', '#7c3aed', '#be185d', '#c2410c', '#a16207', '#334155'];

export function EditarPerfilScreen() {
  const t = useT();
  const perfil = useAppStore(s => s.perfil);
  const online = useAppStore(s => s.online);
  const editarPerfil = useAppStore(s => s.editarPerfil);
  const volverAtras = useAppStore(s => s.volverAtras);

  const [nombre, setNombre] = useState(perfil?.nombre ?? '');
  const [color, setColor] = useState(perfil?.color ?? COLORES[0]);
  const [foto, setFoto] = useState(perfil?.foto ?? '');

  const aplicarResultado = (resultado: ImagePicker.ImagePickerResult) => {
    if (resultado.canceled || !resultado.assets[0]?.base64) return;
    setFoto(`data:image/jpeg;base64,${resultado.assets[0].base64}`);
  };

  const seleccionarDeGaleria = async () => {
    try {
      const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permiso.granted) {
        Alert.alert(t('cambiarFoto'), t('permisoFotosDenegado'));
        return;
      }
      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.4,
        base64: true,
      });
      aplicarResultado(resultado);
    } catch {
      // si el selector no está disponible, se mantiene la foto actual
    }
  };

  const tomarFoto = async () => {
    try {
      const permiso = await ImagePicker.requestCameraPermissionsAsync();
      if (!permiso.granted) {
        Alert.alert(t('tomarFoto'), t('permisoCamaraDenegado'));
        return;
      }
      const resultado = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.4,
        base64: true,
      });
      aplicarResultado(resultado);
    } catch {
      // si la cámara no está disponible, se mantiene la foto actual
    }
  };

  const guardar = async () => {
    if (!nombre.trim()) return;
    const cambios = { nombre: nombre.trim(), color, foto };
    if (!online) {
      editarPerfil(cambios);
      volverAtras();
      return;
    }
    try {
      const r = await apiEditarPerfil(cambios);
      useAppStore.setState({
        perfil: { ...(useAppStore.getState().perfil as NonNullable<typeof perfil>), nombre: r.usuario.nombre, color: r.usuario.color, foto: r.usuario.foto },
      });
      useOnlineStore.getState().actualizarPerfil();
      volverAtras();
    } catch {
      Alert.alert(t('editarPerfil'), t('guardarPerfilError'));
    }
  };

  return (
    <PantallaBase titulo={t('editarPerfil')} onVolver={volverAtras}>
      <ScrollView contentContainerStyle={styles.contenido} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.avatarContenedor} onPress={seleccionarDeGaleria}>
          {foto ? (
            <Image source={{ uri: foto }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: color }]}>
              <Text style={styles.avatarInicial}>{(nombre || '?').charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.textoCambiarFoto}>{t('cambiarFoto')}</Text>
        </Pressable>

        <View style={styles.filaAccionesFoto}>
          <Pressable style={styles.botonFoto} onPress={seleccionarDeGaleria}>
            <Text style={styles.textoBotonFoto}>{t('galeria')}</Text>
          </Pressable>
          {Platform.OS !== 'web' ? (
            <Pressable style={styles.botonFoto} onPress={tomarFoto}>
              <Text style={styles.textoBotonFoto}>{t('tomarFoto')}</Text>
            </Pressable>
          ) : null}
        </View>

        {foto ? (
          <Pressable style={styles.quitarFoto} onPress={() => setFoto('')}>
            <Text style={styles.textoQuitarFoto}>{t('quitarFoto')}</Text>
          </Pressable>
        ) : null}

        <CampoTexto
          etiqueta={t('usuario')}
          value={nombre}
          placeholder={t('nombrePlaceholder')}
          maxLength={18}
          autoCapitalize="none"
          onChangeText={setNombre}
        />

        <Text style={styles.etiqueta}>Color</Text>
        <View style={styles.filaColores}>
          {COLORES.map(c => (
            <Pressable key={c} style={[styles.color, { backgroundColor: c }]} onPress={() => setColor(c)}>
              {c === color && <Text style={styles.marcaColor}>✓</Text>}
            </Pressable>
          ))}
        </View>

        <View style={styles.boton}>
          <BotonPrincipal
            label={t('guardar')}
            onPress={guardar}
            disabled={!nombre.trim()}
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
  avatarContenedor: {
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(111,251,190,0.4)',
    backgroundColor: '#0f766e',
  },
  avatarInicial: {
    color: '#ffffff',
    fontSize: 40,
    fontFamily: FONT_MONTSERRAT_EXTRA,
  },
  textoCambiarFoto: {
    color: '#6FFBBE',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  filaAccionesFoto: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 12,
  },
  botonFoto: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(111,251,190,0.4)',
  },
  textoBotonFoto: {
    color: '#6FFBBE',
    fontSize: 13,
    fontWeight: '600',
  },
  quitarFoto: {
    alignSelf: 'center',
    marginBottom: 16,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.4)',
  },
  textoQuitarFoto: {
    color: '#ff6b6b',
    fontSize: 13,
    fontWeight: '600',
  },
  etiqueta: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 4,
  },
  filaColores: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  color: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  marcaColor: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  boton: {
    marginTop: 12,
  },
});