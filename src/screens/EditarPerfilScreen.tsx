import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BotonPrincipal, CampoTexto, PantallaBase } from '../components/ui';
import { useT } from '../i18n/useT';
import { useAppStore } from '../store/appStore';

const COLORES = ['#006c49', '#0f766e', '#1d4ed8', '#7c3aed', '#be185d', '#c2410c', '#a16207', '#334155'];

export function EditarPerfilScreen() {
  const t = useT();
  const perfil = useAppStore(s => s.perfil);
  const editarPerfil = useAppStore(s => s.editarPerfil);
  const volverAtras = useAppStore(s => s.volverAtras);

  const [nombre, setNombre] = useState(perfil?.nombre ?? '');
  const [color, setColor] = useState(perfil?.color ?? COLORES[0]);

  const guardar = () => {
    if (!nombre.trim()) return;
    editarPerfil({ nombre: nombre.trim(), color });
    volverAtras();
  };

  return (
    <PantallaBase titulo={t('editarPerfil')} onVolver={volverAtras}>
      <ScrollView contentContainerStyle={styles.contenido} showsVerticalScrollIndicator={false}>
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