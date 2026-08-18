import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { IconoEngranaje } from '../components/icons/IconoEngranaje';
import { IconoFlecha } from '../components/icons/IconoFlecha';
import { IconoPersona } from '../components/icons/IconoPersona';
import { FONT_MONTSERRAT_EXTRA } from '../constants/fonts';
import { IDIOMAS } from '../i18n/traducciones';
import { useT } from '../i18n/useT';
import { useAppStore } from '../store/appStore';
import { reproducir } from '../services/sonido';

const COLOR_MENTA = '#6FFBBE';
const COLOR_DORADO = '#FACC15';

function FilaAjuste({
  titulo,
  descripcion,
  valor,
  onChange,
}: {
  titulo: string;
  descripcion: string;
  valor: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.tarjeta}>
      <View style={styles.infoAjuste}>
        <Text style={styles.tituloOpcion}>{titulo}</Text>
        <Text style={styles.descripcionOpcion}>{descripcion}</Text>
      </View>
      <Switch
        value={valor}
        onValueChange={onChange}
        trackColor={{ false: 'rgba(0,0,0,0.4)', true: 'rgba(111,251,190,0.55)' }}
        thumbColor="#ffffff"
        ios_backgroundColor="rgba(0,0,0,0.4)"
      />
    </View>
  );
}

export function AjustesScreen() {
  const t = useT();
  const ajustes = useAppStore(s => s.ajustes);
  const actualizarAjustes = useAppStore(s => s.actualizarAjustes);
  const volverInicio = useAppStore(s => s.volverInicio);
  const cerrarSesion = useAppStore(s => s.cerrarSesion);
  const perfil = useAppStore(s => s.perfil);

  return (
    <LinearGradient
      colors={['#0A4A33', '#022416']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.fondo}
    >
      <View style={styles.barraSuperior}>
        <Pressable style={styles.botonVolver} onPress={volverInicio}>
          <IconoFlecha direccion="izquierda" color={COLOR_MENTA} size={16} />
        </Pressable>
        <Text style={styles.tituloBarra}>{t('ajustes')}</Text>
        <View style={styles.reservaIcono} />
      </View>

      <ScrollView contentContainerStyle={styles.contenido} showsVerticalScrollIndicator={false}>
        <View style={styles.cabecera}>
          <View style={styles.iconoCabecera}>
            <IconoEngranaje color={COLOR_DORADO} size={32} />
          </View>
          <Text style={styles.tituloCabecera}>{t('ajustes')}</Text>
        </View>

        <View style={styles.seccion}>
          <Text style={styles.tituloSeccion}>{t('idioma')}</Text>
          <View style={styles.filaIdiomas}>
            {IDIOMAS.map(id => (
              <Pressable
                key={id.codigo}
                style={[styles.chipIdioma, ajustes.idioma === id.codigo && styles.chipIdiomaActivo]}
                onPress={() => actualizarAjustes({ idioma: id.codigo })}
              >
                <Text
                  style={[
                    styles.textoChip,
                    ajustes.idioma === id.codigo && styles.textoChipActivo,
                  ]}
                >
                  {t(id.etiquetaClave)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.seccion}>
          <Text style={styles.tituloSeccion}>{t('opcionesPartida')}</Text>
          <FilaAjuste
            titulo={t('sonido')}
            descripcion={t('sonidoDesc')}
            valor={ajustes.sonido}
            onChange={v => {
              actualizarAjustes({ sonido: v });
              if (v) reproducir('colocar');
            }}
          />
          <FilaAjuste
            titulo={t('animarTurno')}
            descripcion={t('animarTurnoDesc')}
            valor={ajustes.animarTurno}
            onChange={v => actualizarAjustes({ animarTurno: v })}
          />
          <FilaAjuste
            titulo={t('ayuda')}
            descripcion={t('ayudaDesc')}
            valor={ajustes.ayuda}
            onChange={v => actualizarAjustes({ ayuda: v })}
          />
        </View>

        <View style={styles.seccion}>
          <Text style={styles.tituloSeccion}>{t('cuenta')}</Text>
          <View style={styles.tarjeta}>
            <LinearGradient
              colors={[perfil?.color ?? '#2563eb', '#003527']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatar}
            >
              <IconoPersona color="#ffffff" size={22} />
            </LinearGradient>
            <View style={styles.infoAjuste}>
              <Text style={styles.tituloOpcion}>{perfil?.nombre ?? ''}</Text>
              <Text style={styles.descripcionOpcion}>{t('bienvenido')}</Text>
            </View>
          </View>
          <Pressable style={styles.botonCambiar} onPress={cerrarSesion}>
            <Text style={styles.textoCambiar}>{t('cambiarUsuario')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
  },
  barraSuperior: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 30,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  botonVolver: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  reservaIcono: {
    width: 40,
    height: 40,
  },
  tituloBarra: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: FONT_MONTSERRAT_EXTRA,
    letterSpacing: 2,
  },
  contenido: {
    paddingHorizontal: 16,
    paddingTop: 100,
    paddingBottom: 100,
  },
  cabecera: {
    alignItems: 'center',
    marginBottom: 8,
  },
  iconoCabecera: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(111,251,190,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  tituloCabecera: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    fontFamily: FONT_MONTSERRAT_EXTRA,
    letterSpacing: 1,
  },
  seccion: {
    marginTop: 20,
  },
  tituloSeccion: {
    color: '#d1d5db',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
  },
  filaIdiomas: {
    flexDirection: 'row',
    gap: 8,
  },
  chipIdioma: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipIdiomaActivo: {
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
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(111,251,190,0.15)',
    padding: 16,
    marginBottom: 10,
  },
  infoAjuste: {
    flex: 1,
  },
  tituloOpcion: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  descripcionOpcion: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 3,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(111,251,190,0.3)',
  },
  botonCambiar: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 14,
  },
  textoCambiar: {
    color: '#d1d5db',
    fontSize: 15,
    fontWeight: '600',
  },
});