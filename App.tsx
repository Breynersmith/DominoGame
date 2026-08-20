import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { BackHandler, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Montserrat_700Bold, Montserrat_800ExtraBold } from '@expo-google-fonts/montserrat';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { AjustesScreen } from './src/screens/AjustesScreen';
import { AmigosScreen } from './src/screens/AmigosScreen';
import { AyudaScreen } from './src/screens/AyudaScreen';
import { BienvenidaScreen } from './src/screens/BienvenidaScreen';
import { BilleteraScreen } from './src/screens/BilleteraScreen';
import { EditarPerfilScreen } from './src/screens/EditarPerfilScreen';
import { GameScreen } from './src/screens/GameScreen';
import { HistorialScreen } from './src/screens/HistorialScreen';
import { JuegoResponsableScreen } from './src/screens/JuegoResponsableScreen';
import { LobbyScreen } from './src/screens/LobbyScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { NotificacionesScreen } from './src/screens/NotificacionesScreen';
import { PerfilScreen } from './src/screens/PerfilScreen';
import { RecargarSaldoScreen } from './src/screens/RecargarSaldoScreen';
import { RecuperarContrasenaScreen } from './src/screens/RecuperarContrasenaScreen';
import { RegistroScreen } from './src/screens/RegistroScreen';
import { SalaScreen } from './src/screens/SalaScreen';
import { SetupScreen } from './src/screens/SetupScreen';
import { TerminosScreen } from './src/screens/TerminosScreen';
import { KycScreen } from './src/screens/KycScreen';
import { PagosScreen } from './src/screens/PagosScreen';
import { VerificarCuentaScreen } from './src/screens/VerificarCuentaScreen';
import { useAppStore } from './src/store/appStore';
import { useGameStore } from './src/store/gameStore';
import { useOnlineStore } from './src/store/onlineStore';

const ANCHO_COLUMNA = 500;

export default function App() {
  const fase = useGameStore(s => s.fase);
  const vista = useAppStore(s => s.vista);
  const cargado = useAppStore(s => s.cargado);
  const cargar = useAppStore(s => s.cargar);
  const { width } = useWindowDimensions();
  const esWebGrande = Platform.OS === 'web' && width >= 640;
  const [fuentesCargadas] = useFonts({
    Montserrat_700Bold,
    Montserrat_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!BackHandler?.addEventListener) return;
    const suscripcion = BackHandler.addEventListener('hardwareBackPress', () => {
      const estado = useAppStore.getState();

      if (estado.vista === 'partidaOnline') {
        useOnlineStore.getState().salirSala();
        useOnlineStore.getState().desconectar();
        if (estado.historial.length > 0) estado.volverAtras();
        return true;
      }

      const juego = useGameStore.getState();
      if (juego.fase === 'jugando') {
        juego.reiniciar();
        return true;
      }

      if (estado.historial.length === 0) return false;
      estado.volverAtras();
      return true;
    });
    return () => suscripcion.remove();
  }, []);

  if (!fuentesCargadas || !cargado) return null;

  let pantalla: React.ReactNode;
  switch (vista) {
    case 'bienvenida':
      pantalla = <BienvenidaScreen />;
      break;
    case 'registro':
      pantalla = <RegistroScreen />;
      break;
    case 'login':
      pantalla = <LoginScreen />;
      break;
    case 'recuperar':
      pantalla = <RecuperarContrasenaScreen />;
      break;
    case 'ajustes':
      pantalla = <AjustesScreen />;
      break;
    case 'billetera':
      pantalla = <BilleteraScreen />;
      break;
    case 'recargar':
      pantalla = <RecargarSaldoScreen />;
      break;
    case 'historial':
      pantalla = <HistorialScreen />;
      break;
    case 'lobby':
      pantalla = <LobbyScreen />;
      break;
    case 'sala':
      pantalla = <SalaScreen />;
      break;
    case 'perfil':
      pantalla = <PerfilScreen />;
      break;
    case 'editarPerfil':
      pantalla = <EditarPerfilScreen />;
      break;
    case 'kyc':
      pantalla = <KycScreen />;
      break;
    case 'verificarCuenta':
      pantalla = <VerificarCuentaScreen />;
      break;
    case 'pagos':
      pantalla = <PagosScreen />;
      break;
    case 'amigos':
      pantalla = <AmigosScreen />;
      break;
    case 'notificaciones':
      pantalla = <NotificacionesScreen />;
      break;
    case 'ayuda':
      pantalla = <AyudaScreen />;
      break;
    case 'terminos':
      pantalla = <TerminosScreen />;
      break;
    case 'juegoResponsable':
      pantalla = <JuegoResponsableScreen />;
      break;
    case 'partidaOnline':
      pantalla = <GameScreen modo="online" />;
      break;
    default:
      pantalla = fase === 'configuracion' ? <SetupScreen /> : <GameScreen />;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={[styles.columna, esWebGrande && styles.columnaWeb]}>{pantalla}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#022416',
    alignItems: 'center',
  },
  columna: {
    flex: 1,
    width: '100%',
    maxWidth: ANCHO_COLUMNA,
  },
  columnaWeb: {
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(111,251,190,0.08)',
  },
});