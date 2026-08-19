import React, { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { IconoFlecha } from './icons/IconoFlecha';
import { FONT_INTER_MEDIUM, FONT_INTER_SEMIBOLD, FONT_MONTSERRAT_EXTRA } from '../constants/fonts';

export const COLOR_MENTA = '#6FFBBE';
export const COLOR_AMBAR = '#ffb95f';
export const COLOR_DORADO = '#FACC15';

interface PantallaBaseProps {
  titulo?: string;
  onVolver?: () => void;
  derecho?: ReactNode;
  children: ReactNode;
  pie?: ReactNode;
}

export function PantallaBase({ titulo, onVolver, derecho, children, pie }: PantallaBaseProps) {
  return (
    <LinearGradient
      colors={['#0A4A33', '#022416']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.fondo}
    >
      <View style={styles.orbSupIzq} />
      <View style={styles.orbInfDer} />
      {titulo && (
        <View style={styles.barra}>
          <Pressable
            style={styles.botonVolver}
            onPress={onVolver}
            disabled={!onVolver}
            accessibilityLabel="volver"
          >
            <IconoFlecha direccion="izquierda" color={COLOR_MENTA} size={16} />
          </Pressable>
          <Text style={styles.tituloBarra} numberOfLines={1}>
            {titulo}
          </Text>
          <View style={styles.slotDerecho}>{derecho}</View>
        </View>
      )}
      <View style={styles.cuerpo}>{children}</View>
      {pie && <View style={styles.pie}>{pie}</View>}
    </LinearGradient>
  );
}

export function BotonPrincipal({
  label,
  onPress,
  icono,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  icono?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.contBoton,
        pressed && styles.presionado,
        disabled && styles.deshabilitado,
      ]}
    >
      <LinearGradient
        colors={['#00B96B', '#007A44']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradienteBoton}
      >
        {icono}
        <Text style={styles.textoBoton}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

export function BotonSecundario({
  label,
  onPress,
  icono,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  icono?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.botonSecundario,
        pressed && styles.presionado,
        disabled && styles.deshabilitado,
      ]}
    >
      {icono}
      <Text style={styles.textoSecundario}>{label}</Text>
    </Pressable>
  );
}

export function Tarjeta({ children, estilo }: { children: ReactNode; estilo?: object }) {
  return <View style={[styles.tarjeta, estilo]}>{children}</View>;
}

export function CabeceraSeccion({ children }: { children: ReactNode }) {
  return <Text style={styles.cabeceraSeccion}>{children}</Text>;
}

export function CampoTexto({
  etiqueta,
  ...props
}: TextInputProps & { etiqueta: string }) {
  return (
    <View style={styles.campo}>
      <Text style={styles.etiquetaCampo}>{etiqueta}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor="#9ca3af"
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    overflow: 'hidden',
  },
  orbSupIzq: {
    position: 'absolute',
    top: -90,
    left: -90,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(108,248,187,0.12)',
  },
  orbInfDer: {
    position: 'absolute',
    bottom: -90,
    right: -90,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(149,211,186,0.12)',
  },
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 30,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    zIndex: 2,
  },
  botonVolver: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  slotDerecho: {
    width: 40,
    height: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  tituloBarra: {
    flex: 1,
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: FONT_MONTSERRAT_EXTRA,
    letterSpacing: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  cuerpo: {
    flex: 1,
    paddingTop: 100,
    paddingBottom: 100,
    zIndex: 1,
  },
  pie: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    zIndex: 1,
  },
  contBoton: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  gradienteBoton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(111,251,190,0.5)',
    borderRadius: 28,
    shadowColor: '#00B96B',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  textoBoton: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: FONT_MONTSERRAT_EXTRA,
    letterSpacing: 1,
  },
  botonSecundario: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  textoSecundario: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: FONT_INTER_SEMIBOLD,
  },
  tarjeta: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(111,251,190,0.15)',
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cabeceraSeccion: {
    color: COLOR_AMBAR,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FONT_INTER_SEMIBOLD,
    marginTop: 20,
    marginBottom: 10,
  },
  campo: {
    marginBottom: 14,
  },
  etiquetaCampo: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
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
    fontFamily: FONT_INTER_MEDIUM,
  },
  presionado: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  deshabilitado: {
    opacity: 0.4,
  },
});