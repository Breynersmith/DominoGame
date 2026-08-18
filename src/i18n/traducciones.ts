// src/i18n/traducciones.ts

export type Idioma = 'es' | 'en' | 'cat';

export interface Traducciones {
  appName: string;
  subtitulo: string;
  cuantosJugadores: string;
  jugadorLabel: string;
  humano: string;
  bot: string;
  botBadge: string;
  opcionesPartida: string;
  robarDelPozo: string;
  robarDescOn: string;
  robarDescOff: string;
  robarPozo: string;
  sinConexion: string;
  anfitrion: string;
  soloAnfitrion: string;
  partidaEnCurso: string;
  movimientoInvalido: string;
  iniciarPartida: string;
  turnoDe: string;
  partidaTerminada: string;
  pozo: string;
  pasarTurno: string;
  coincideExtremos: string;
  izquierda: string;
  derecha: string;
  cancelar: string;
  gana: string;
  empatada: string;
  trabada: string;
  puntos: string;
  jugarDeNuevo: string;
  cambiarJugadores: string;
  fichas: string;
  pensando: string;
  comienzaPartida: string;
  tileNoEnMano: string;
  tileNoJugable: string;
  soloOtroExtremo: string;
  noPuedesRobar: string;
  pozoVacioPasar: string;
  sinPozo: string;
  noPuedesPasar: string;
  pozoDebesRobar: string;
  jugadaInvalida: string;
  crearCuenta: string;
  bienvenido: string;
  experienciaPremium: string;
  registrarseIniciar: string;
  jugarInvitado: string;
  terminosPrivacidad: string;
  codigoAcceso: string;
  creaCodigo: string;
  pinInvalido: string;
  verificaIdentidad: string;
  verificaDesc: string;
  codigoIncorrecto: string;
  eligeNombre: string;
  nombrePlaceholder: string;
  eligeColor: string;
  continuar: string;
  nombreRequerido: string;
  ajustes: string;
  idioma: string;
  sonido: string;
  sonidoDesc: string;
  animarTurno: string;
  animarTurnoDesc: string;
  ayuda: string;
  ayudaDesc: string;
  cuenta: string;
  cambiarUsuario: string;
  volver: string;
  idiomaEs: string;
  idiomaEn: string;
  idiomaCat: string;
  iniciarSesion: string;
  usuario: string;
  contrasena: string;
  olvidasteContrasena: string;
  noTienesCuenta: string;
  crearCuentaLink: string;
  credencialesIncorrectas: string;
  recuperarContrasena: string;
  recuperarDesc: string;
  nuevaContrasena: string;
  confirmarContrasena: string;
  contrasenasNoCoinciden: string;
  contrasenaActualizada: string;
  usuarioNoEncontrado: string;
  nombreCompleto: string;
  nombreUsuario: string;
  email: string;
  telefono: string;
  fechaNacimiento: string;
  dia: string;
  mes: string;
  anio: string;
  pais: string;
  paisRequerido: string;
  terminosAceptar: string;
  terminosRequerido: string;
  verificacionSms: string;
  codigoSms: string;
  enviarCodigo: string;
  reenviarCodigo: string;
  codigoEnviado: string;
  verificarYCrear: string;
  emailONombre: string;
  emailInvalido: string;
  telefonoInvalido: string;
  passwordDebil: string;
  menorDeEdad: string;
  emailEnUso: string;
  telefonoEnUso: string;
  nombreEnUso: string;
  otpInvalido: string;
  otpExpirado: string;
  billetera: string;
  saldo: string;
  creditos: string;
  recargarSaldo: string;
  historial: string;
  historialVacio: string;
  recargar: string;
  montoRecarga: string;
  recargaExitosa: string;
  transacciones: string;
  lobby: string;
  salasDisponibles: string;
  crearSala: string;
  unirseSalaPrivada: string;
  salaPrivada: string;
  codigoSala: string;
  nombreSala: string;
  apuesta: string;
  jugadores: string;
  salaLlena: string;
  sinSalas: string;
  sinSaldo: string;
  unirseBtn: string;
  codigoInvalido: string;
  salaCreada: string;
  invitacion: string;
  esperandoJugadores: string;
  salirSala: string;
  salaEnEspera: string;
  apuestaPartida: string;
  apuestaDesc: string;
  sinApuesta: string;
  pagoResultado: string;
  ganaste: string;
  perdiste: string;
  reembolsoDesc: string;
  apuestaDescTx: string;
  gananciaDescTx: string;
  recargaDescTx: string;
  perfil: string;
  editarPerfil: string;
  amigos: string;
  notificaciones: string;
  soporteAyuda: string;
  terminos: string;
  juegoResponsable: string;
  sinAmigos: string;
  agregarAmigo: string;
  nombreAmigo: string;
  amigoAgregado: string;
  amigoYaExiste: string;
  amigoNoEncontrado: string;
  eliminar: string;
  sinNotificaciones: string;
  marcarLeidas: string;
  soporteDesc: string;
  disputas: string;
  disputaDesc: string;
  enviar: string;
  guardar: string;
  mensajeSoporte: string;
  soporteEnviado: string;
  preguntasFrecuentes: string;
  faq1P: string;
  faq1R: string;
  faq2P: string;
  faq2R: string;
  contacto: string;
  terminosTitulo: string;
  terminosCuerpo: string;
  juegoResponsableTitulo: string;
  juegoResponsableCuerpo: string;
  aceptarTerminos: string;
  preguntaSeguridad: string;
  respuestaSeguridad: string;
  respuestaSeguridadRequerida: string;
  dosFactoresDesc: string;
  preguntaMascota: string;
  preguntaCiudad: string;
  preguntaComida: string;
  preguntaColegio: string;
  verificacion2fa: string;
  codigo2fa: string;
  codigo2faDesc: string;
  codigo2faIncorrecto: string;
  kycTitulo: string;
  kycDesc: string;
  kycTipoDocumento: string;
  kycNumeroDocumento: string;
  kycSelfie: string;
  kycTomarSelfie: string;
  kycEnviar: string;
  kycEstadoNoEnviado: string;
  kycEstadoPendiente: string;
  kycEstadoAprobado: string;
  kycEstadoRechazado: string;
  kycEnviado: string;
  kycError: string;
  tipoDni: string;
  tipoNie: string;
  tipoPasaporte: string;
  metodosPago: string;
  pagosDesc: string;
  agregarMetodo: string;
  tipoTarjeta: string;
  tipoPaypal: string;
  tipoCripto: string;
  datosEnmascarados: string;
  pagoAgregado: string;
  predeterminado: string;
  marcarPredeterminado: string;
  pagoEliminado: string;
}

const es: Traducciones = {
  appName: 'Domino',
  subtitulo: 'Juego multijugador local',
  cuantosJugadores: '¿Cuántos jugadores?',
  jugadorLabel: 'Jugador {n}',
  humano: 'Humano',
  bot: 'Bot',
  botBadge: 'BOT',
  opcionesPartida: 'Opciones de partida',
  robarDelPozo: 'Robar del pozo',
  robarDescOn: 'Si no puedes jugar, roba fichas del pozo hasta encontrar una válida.',
  robarDescOff: 'Si no puedes jugar, pasarás el turno directamente.',
  robarPozo: 'Robar del pozo',
  sinConexion: 'Sin conexión con el servidor',
  anfitrion: 'anfitrión',
  soloAnfitrion: 'Solo el anfitrión puede iniciar la partida',
  partidaEnCurso: 'La partida ya está en curso',
  movimientoInvalido: 'Movimiento no válido',
  iniciarPartida: 'INICIAR PARTIDA',
  turnoDe: 'Turno de {name}',
  partidaTerminada: 'Partida terminada',
  pozo: 'Pozo: {n}',
  pasarTurno: 'Pasar turno',
  coincideExtremos: 'La ficha coincide en ambos extremos. ¿Dónde la colocas?',
  izquierda: 'Izquierda',
  derecha: 'Derecha',
  cancelar: 'Cancelar',
  gana: '{name} gana la partida!',
  empatada: '¡Partida empatada!',
  trabada: 'La partida quedó trabada',
  puntos: '{n} pts',
  jugarDeNuevo: 'Jugar de nuevo',
  cambiarJugadores: 'Cambiar jugadores',
  fichas: '{n} fichas',
  pensando: 'Pensando…',
  comienzaPartida: '{name} comienza la partida',
  tileNoEnMano: 'Esa ficha no está en tu mano',
  tileNoJugable: 'Esa ficha no se puede jugar ahora',
  soloOtroExtremo: 'Solo puedes jugarla en el otro extremo',
  noPuedesRobar: 'Tienes fichas jugables, no puedes robar',
  pozoVacioPasar: 'El pozo está vacío, debes pasar',
  sinPozo: 'Esta partida no tiene pozo',
  noPuedesPasar: 'Tienes fichas jugables, no puedes pasar',
  pozoDebesRobar: 'Aún hay fichas en el pozo, debes robar',
  jugadaInvalida: 'Jugada inválida',
  crearCuenta: 'Crear cuenta',
  bienvenido: 'Bienvenido al Domino Club',
  experienciaPremium: 'La experiencia de juego más premium',
  registrarseIniciar: 'Registrarse o Iniciar Sesión',
  jugarInvitado: 'Jugar como Invitado',
  terminosPrivacidad: 'Términos y Privacidad',
  codigoAcceso: 'Código de acceso',
  creaCodigo: 'Crea tu código de 4 dígitos',
  pinInvalido: 'El código debe tener 4 dígitos',
  verificaIdentidad: 'Verifica tu identidad',
  verificaDesc: 'Introduce tu código para continuar',
  codigoIncorrecto: 'Código incorrecto, inténtalo de nuevo',
  eligeNombre: 'Elige tu nombre',
  nombrePlaceholder: 'Tu nombre',
  eligeColor: 'Elige el color de tu ficha',
  continuar: 'Continuar',
  nombreRequerido: 'Escribe un nombre para continuar',
  ajustes: 'Configuración',
  idioma: 'Idioma',
  sonido: 'Sonido',
  sonidoDesc: 'Reproducir sonidos mientras juegas',
  animarTurno: 'Animar turno',
  animarTurnoDesc: 'Efectos al pasar el turno',
  ayuda: 'Mostrar ayuda',
  ayudaDesc: 'Indicadores de arrastre y fichas jugables',
  cuenta: 'Cuenta',
  cambiarUsuario: 'Cambiar de usuario',
  volver: 'Volver',
  idiomaEs: 'Español',
  idiomaEn: 'English',
  idiomaCat: 'Català',
  iniciarSesion: 'Iniciar Sesión',
  usuario: 'Usuario',
  contrasena: 'Código',
  olvidasteContrasena: '¿Olvidaste tu código?',
  noTienesCuenta: '¿No tienes cuenta?',
  crearCuentaLink: 'Créala aquí',
  credencialesIncorrectas: 'Usuario o código incorrecto',
  recuperarContrasena: 'Recuperar código',
  recuperarDesc: 'Introduce tu teléfono, verifica con el código SMS y crea una contraseña nueva',
  nuevaContrasena: 'Nueva contraseña',
  confirmarContrasena: 'Repetir contraseña',
  contrasenasNoCoinciden: 'Las contraseñas no coinciden',
  contrasenaActualizada: 'Contraseña actualizada',
  usuarioNoEncontrado: 'No se encontró un usuario con ese nombre',
  nombreCompleto: 'Nombre completo',
  nombreUsuario: 'Nombre de usuario (nick)',
  email: 'Correo electrónico',
  telefono: 'Teléfono (para verificación por SMS)',
  fechaNacimiento: 'Fecha de nacimiento',
  dia: 'Día',
  mes: 'Mes',
  anio: 'Año',
  pais: 'País de residencia',
  paisRequerido: 'Indica tu país de residencia',
  terminosAceptar: 'He leído y acepto los términos y condiciones',
  terminosRequerido: 'Debes aceptar los términos y condiciones',
  verificacionSms: 'Verificación por SMS',
  codigoSms: 'Código de verificación',
  enviarCodigo: 'Enviar código',
  reenviarCodigo: 'Reenviar código',
  codigoEnviado: 'Código enviado',
  verificarYCrear: 'Crear cuenta',
  emailONombre: 'Correo o nombre de usuario',
  emailInvalido: 'Correo electrónico inválido',
  telefonoInvalido: 'Teléfono inválido',
  passwordDebil: 'Mínimo 8 caracteres con letras y números',
  menorDeEdad: 'Debes tener al menos 18 años',
  emailEnUso: 'Ese correo ya está registrado',
  telefonoEnUso: 'Ese teléfono ya está registrado',
  nombreEnUso: 'Ese nombre de usuario ya está en uso',
  otpInvalido: 'Código SMS incorrecto',
  otpExpirado: 'El código ha expirado, pide uno nuevo',
  billetera: 'Billetera',
  saldo: 'Saldo',
  creditos: 'créditos',
  recargarSaldo: 'Recargar saldo',
  historial: 'Historial',
  historialVacio: 'Todavía no hay transacciones',
  recargar: 'Recargar',
  montoRecarga: 'Cantidad a recargar',
  recargaExitosa: 'Saldo recargado correctamente',
  transacciones: 'Transacciones',
  lobby: 'Lobby',
  salasDisponibles: 'Salas disponibles',
  crearSala: 'Crear sala',
  unirseSalaPrivada: 'Unirse a sala privada',
  salaPrivada: 'Sala privada',
  codigoSala: 'Código de la sala',
  nombreSala: 'Nombre de la sala',
  apuesta: 'Apuesta por jugador',
  jugadores: 'Jugadores',
  salaLlena: 'Sala llena',
  sinSalas: 'No hay salas disponibles',
  sinSaldo: 'No tienes saldo suficiente para esta apuesta',
  unirseBtn: 'Unirse',
  codigoInvalido: 'Código de sala inválido',
  salaCreada: 'Sala creada',
  invitacion: 'Invita a tus amigos con este código',
  esperandoJugadores: 'Esperando jugadores...',
  salirSala: 'Salir de la sala',
  salaEnEspera: 'La partida empezará cuando el anfitrión la inicie',
  apuestaPartida: 'Apuesta por jugador',
  apuestaDesc: 'Cada jugador aporta {monto} {creditos} al pozo',
  sinApuesta: 'Sin apuesta',
  pagoResultado: 'Resultado de la partida',
  ganaste: 'Has ganado {monto} {creditos}',
  perdiste: 'Has perdido {monto} {creditos}',
  reembolsoDesc: 'Reembolso por partida trabada',
  apuestaDescTx: 'Apuesta en partida',
  gananciaDescTx: 'Premio de la partida',
  recargaDescTx: 'Recarga de saldo',
  perfil: 'Perfil',
  editarPerfil: 'Editar perfil',
  amigos: 'Amigos',
  notificaciones: 'Notificaciones',
  soporteAyuda: 'Ayuda y soporte',
  terminos: 'Términos y condiciones',
  juegoResponsable: 'Juego responsable',
  sinAmigos: 'Aún no tienes amigos. Añade a un jugador por su nombre.',
  agregarAmigo: 'Añadir amigo',
  nombreAmigo: 'Nombre del jugador',
  amigoAgregado: 'Amigo añadido',
  amigoYaExiste: 'Ese jugador ya está en tu lista',
  amigoNoEncontrado: 'No existe un jugador con ese nombre',
  eliminar: 'Eliminar',
  sinNotificaciones: 'No tienes notificaciones',
  marcarLeidas: 'Marcar todas como leídas',
  soporteDesc: 'Preguntas frecuentes, soporte y disputas',
  disputas: 'Abrir disputa',
  disputaDesc: '¿Problemas con un pago o una partida?',
  enviar: 'Enviar',
  guardar: 'Guardar',
  mensajeSoporte: 'Describe tu problema',
  soporteEnviado: 'Hemos recibido tu consulta. Te responderemos pronto.',
  preguntasFrecuentes: 'Preguntas frecuentes',
  faq1P: '¿Cómo recupero mi saldo?',
  faq1R: 'El saldo se muestra en tu billetera y se recarga desde la sección "Recargar saldo".',
  faq2P: '¿Cómo se paga una partida?',
  faq2R: 'Cada jugador aporta su apuesta y el ganador recibe el pozo completo.',
  contacto: 'Contacto',
  terminosTitulo: 'Términos y condiciones',
  terminosCuerpo:
    'Este juego usa moneda ficticia ("créditos") con fines de entretenimiento. No representa dinero real. Al usarlo aceptas las reglas de la plataforma, el trato justo entre jugadores y la moderación del juego. Los créditos no son reembolsables ni convertibles en dinero.',
  juegoResponsableTitulo: 'Juego responsable',
  juegoResponsableCuerpo:
    'El juego debe ser una diversión. Establece límites de saldo, no apuestes más de lo que puedes permitirte y descansa cuando lo necesites. Si crees que tienes un problema con el juego, busca ayuda profesional.',
  aceptarTerminos: 'Aceptar términos',
  preguntaSeguridad: 'Pregunta de seguridad',
  respuestaSeguridad: 'Tu respuesta',
  respuestaSeguridadRequerida: 'Escribe tu respuesta de seguridad',
  dosFactoresDesc: 'Activar autenticación en dos pasos (2FA): pedirá un código SMS al iniciar sesión',
  preguntaMascota: 'Nombre de tu mascota',
  preguntaCiudad: 'Ciudad de nacimiento',
  preguntaComida: 'Comida favorita',
  preguntaColegio: 'Nombre de tu colegio',
  verificacion2fa: 'Verificación en dos pasos',
  codigo2fa: 'Código de verificación',
  codigo2faDesc: 'Te hemos enviado un código SMS a {telefono} para completar el inicio de sesión',
  codigo2faIncorrecto: 'Código incorrecto, inténtalo de nuevo',
  kycTitulo: 'Verificación de identidad',
  kycDesc: 'Envía tu documento de identidad oficial y una selfie para verificar tu cuenta. Tus datos están protegidos.',
  kycTipoDocumento: 'Tipo de documento',
  kycNumeroDocumento: 'Número de documento',
  kycSelfie: 'Selfie de verificación',
  kycTomarSelfie: 'Tomar selfie',
  kycEnviar: 'Enviar verificación',
  kycEstadoNoEnviado: 'No verificado',
  kycEstadoPendiente: 'En revisión',
  kycEstadoAprobado: 'Verificado',
  kycEstadoRechazado: 'Rechazado',
  kycEnviado: 'Verificación enviada. La revisaremos pronto.',
  kycError: 'No se pudo enviar la verificación. Revisa los datos.',
  tipoDni: 'DNI',
  tipoNie: 'NIE',
  tipoPasaporte: 'Pasaporte',
  metodosPago: 'Métodos de pago',
  pagosDesc: 'Añade métodos de pago opcionales para operar con créditos. Solo se guardan datos enmascarados.',
  agregarMetodo: 'Añadir método',
  tipoTarjeta: 'Tarjeta',
  tipoPaypal: 'PayPal',
  tipoCripto: 'Cripto',
  datosEnmascarados: 'Datos enmascarados (ej. •••• 1234)',
  pagoAgregado: 'Método de pago añadido',
  predeterminado: 'Predeterminado',
  marcarPredeterminado: 'Usar por defecto',
  pagoEliminado: 'Método eliminado',
};

const en: Traducciones = {
  appName: 'Domino',
  subtitulo: 'Local multiplayer game',
  cuantosJugadores: 'How many players?',
  jugadorLabel: 'Player {n}',
  humano: 'Human',
  bot: 'Bot',
  botBadge: 'BOT',
  opcionesPartida: 'Game options',
  robarDelPozo: 'Draw from the pile',
  robarDescOn: "If you can't play, draw tiles from the pile until you find a valid one.",
  robarDescOff: "If you can't play, you'll pass the turn directly.",
  robarPozo: 'Draw from the pile',
  sinConexion: 'No connection to the server',
  anfitrion: 'host',
  soloAnfitrion: 'Only the host can start the game',
  partidaEnCurso: 'The game is already in progress',
  movimientoInvalido: 'Invalid move',
  iniciarPartida: 'START GAME',
  turnoDe: "{name}'s turn",
  partidaTerminada: 'Game over',
  pozo: 'Pile: {n}',
  pasarTurno: 'Pass turn',
  coincideExtremos: 'The tile matches both ends. Where do you place it?',
  izquierda: 'Left',
  derecha: 'Right',
  cancelar: 'Cancel',
  gana: '{name} wins the game!',
  empatada: 'Tied game!',
  trabada: 'The game was blocked',
  puntos: '{n} pts',
  jugarDeNuevo: 'Play again',
  cambiarJugadores: 'Change players',
  fichas: '{n} tiles',
  pensando: 'Thinking…',
  comienzaPartida: '{name} starts the game',
  tileNoEnMano: "That tile isn't in your hand",
  tileNoJugable: "That tile can't be played right now",
  soloOtroExtremo: 'You can only play it on the other end',
  noPuedesRobar: "You have playable tiles, you can't draw",
  pozoVacioPasar: 'The pile is empty, you must pass',
  sinPozo: 'This game has no pile',
  noPuedesPasar: "You have playable tiles, you can't pass",
  pozoDebesRobar: 'There are still tiles in the pile, you must draw',
  jugadaInvalida: 'Invalid move',
  crearCuenta: 'Create account',
  bienvenido: 'Welcome to Domino Club',
  experienciaPremium: 'The most premium gaming experience',
  registrarseIniciar: 'Sign up or Log in',
  jugarInvitado: 'Play as Guest',
  terminosPrivacidad: 'Terms and Privacy',
  codigoAcceso: 'Access code',
  creaCodigo: 'Create your 4-digit code',
  pinInvalido: 'The code must have 4 digits',
  verificaIdentidad: 'Verify your identity',
  verificaDesc: 'Enter your code to continue',
  codigoIncorrecto: 'Incorrect code, try again',
  eligeNombre: 'Choose your name',
  nombrePlaceholder: 'Your name',
  eligeColor: 'Choose your tile color',
  continuar: 'Continue',
  nombreRequerido: 'Enter a name to continue',
  ajustes: 'Settings',
  idioma: 'Language',
  sonido: 'Sound',
  sonidoDesc: 'Play sounds while playing',
  animarTurno: 'Animate turn',
  animarTurnoDesc: 'Motion when the turn changes',
  ayuda: 'Show help',
  ayudaDesc: 'Drag indicators and playable highlight',
  cuenta: 'Account',
  cambiarUsuario: 'Switch user',
  volver: 'Back',
  idiomaEs: 'Spanish',
  idiomaEn: 'English',
  idiomaCat: 'Catalan',
  iniciarSesion: 'Sign in',
  usuario: 'Username',
  contrasena: 'Code',
  olvidasteContrasena: 'Forgot your code?',
  noTienesCuenta: "Don't have an account?",
  crearCuentaLink: 'Create one here',
  credencialesIncorrectas: 'Incorrect username or code',
  recuperarContrasena: 'Recover code',
  recuperarDesc: 'Enter your phone, verify with the SMS code and set a new password',
  nuevaContrasena: 'New password',
  confirmarContrasena: 'Repeat password',
  contrasenasNoCoinciden: 'Passwords do not match',
  contrasenaActualizada: 'Password updated',
  usuarioNoEncontrado: 'No user found with that name',
  nombreCompleto: 'Full name',
  nombreUsuario: 'Username (nick)',
  email: 'Email address',
  telefono: 'Phone (for SMS verification)',
  fechaNacimiento: 'Date of birth',
  dia: 'Day',
  mes: 'Month',
  anio: 'Year',
  pais: 'Country of residence',
  paisRequerido: 'Select your country of residence',
  terminosAceptar: 'I have read and accept the terms and conditions',
  terminosRequerido: 'You must accept the terms and conditions',
  verificacionSms: 'SMS verification',
  codigoSms: 'Verification code',
  enviarCodigo: 'Send code',
  reenviarCodigo: 'Resend code',
  codigoEnviado: 'Code sent',
  verificarYCrear: 'Create account',
  emailONombre: 'Email or username',
  emailInvalido: 'Invalid email address',
  telefonoInvalido: 'Invalid phone number',
  passwordDebil: 'Minimum 8 characters with letters and numbers',
  menorDeEdad: 'You must be at least 18 years old',
  emailEnUso: 'That email is already registered',
  telefonoEnUso: 'That phone is already registered',
  nombreEnUso: 'That username is already taken',
  otpInvalido: 'Incorrect SMS code',
  otpExpirado: 'The code has expired, request a new one',
  billetera: 'Wallet',
  saldo: 'Balance',
  creditos: 'credits',
  recargarSaldo: 'Add balance',
  historial: 'History',
  historialVacio: 'There are no transactions yet',
  recargar: 'Add funds',
  montoRecarga: 'Amount to add',
  recargaExitosa: 'Balance added successfully',
  transacciones: 'Transactions',
  lobby: 'Lobby',
  salasDisponibles: 'Available rooms',
  crearSala: 'Create room',
  unirseSalaPrivada: 'Join private room',
  salaPrivada: 'Private room',
  codigoSala: 'Room code',
  nombreSala: 'Room name',
  apuesta: 'Bet per player',
  jugadores: 'Players',
  salaLlena: 'Room full',
  sinSalas: 'No rooms available',
  sinSaldo: 'You do not have enough balance for this bet',
  unirseBtn: 'Join',
  codigoInvalido: 'Invalid room code',
  salaCreada: 'Room created',
  invitacion: 'Invite your friends with this code',
  esperandoJugadores: 'Waiting for players...',
  salirSala: 'Leave room',
  salaEnEspera: 'The game will start when the host launches it',
  apuestaPartida: 'Bet per player',
  apuestaDesc: 'Each player puts {monto} {creditos} into the pot',
  sinApuesta: 'No bet',
  pagoResultado: 'Game result',
  ganaste: 'You won {monto} {creditos}',
  perdiste: 'You lost {monto} {creditos}',
  reembolsoDesc: 'Refund for a blocked game',
  apuestaDescTx: 'Game bet',
  gananciaDescTx: 'Game prize',
  recargaDescTx: 'Balance top-up',
  perfil: 'Profile',
  editarPerfil: 'Edit profile',
  amigos: 'Friends',
  notificaciones: 'Notifications',
  soporteAyuda: 'Help and support',
  terminos: 'Terms and conditions',
  juegoResponsable: 'Responsible gaming',
  sinAmigos: "You don't have friends yet. Add a player by name.",
  agregarAmigo: 'Add friend',
  nombreAmigo: 'Player name',
  amigoAgregado: 'Friend added',
  amigoYaExiste: 'That player is already on your list',
  amigoNoEncontrado: 'There is no player with that name',
  eliminar: 'Remove',
  sinNotificaciones: 'No notifications',
  marcarLeidas: 'Mark all as read',
  soporteDesc: 'FAQ, support and disputes',
  disputas: 'Open dispute',
  disputaDesc: 'Issues with a payment or a game?',
  enviar: 'Send',
  guardar: 'Save',
  mensajeSoporte: 'Describe your issue',
  soporteEnviado: 'We received your request. We will reply soon.',
  preguntasFrecuentes: 'Frequently asked questions',
  faq1P: 'How do I recover my balance?',
  faq1R: 'Your balance is shown in your wallet and can be topped up from "Add balance".',
  faq2P: 'How is a game paid?',
  faq2R: 'Each player puts in their bet and the winner takes the whole pot.',
  contacto: 'Contact',
  terminosTitulo: 'Terms and conditions',
  terminosCuerpo:
    'This game uses fictional currency ("credits") for entertainment purposes. It is not real money. By using it you accept the platform rules, fair play between players and game moderation. Credits are non-refundable and cannot be converted into money.',
  juegoResponsableTitulo: 'Responsible gaming',
  juegoResponsableCuerpo:
    'Gaming should be fun. Set balance limits, do not bet more than you can afford and take breaks when you need them. If you think you have a gambling problem, seek professional help.',
  aceptarTerminos: 'Accept terms',
  preguntaSeguridad: 'Security question',
  respuestaSeguridad: 'Your answer',
  respuestaSeguridadRequerida: 'Type your security answer',
  dosFactoresDesc: 'Enable two-step authentication (2FA): it will ask for an SMS code at sign in',
  preguntaMascota: "Your pet's name",
  preguntaCiudad: 'Birth city',
  preguntaComida: 'Favorite food',
  preguntaColegio: 'Your school name',
  verificacion2fa: 'Two-step verification',
  codigo2fa: 'Verification code',
  codigo2faDesc: 'We sent an SMS code to {telefono} to complete sign in',
  codigo2faIncorrecto: 'Incorrect code, try again',
  kycTitulo: 'Identity verification',
  kycDesc: 'Send your official ID and a selfie to verify your account. Your data is protected.',
  kycTipoDocumento: 'Document type',
  kycNumeroDocumento: 'Document number',
  kycSelfie: 'Verification selfie',
  kycTomarSelfie: 'Take selfie',
  kycEnviar: 'Submit verification',
  kycEstadoNoEnviado: 'Not verified',
  kycEstadoPendiente: 'Under review',
  kycEstadoAprobado: 'Verified',
  kycEstadoRechazado: 'Rejected',
  kycEnviado: 'Verification submitted. We will review it soon.',
  kycError: 'Could not submit the verification. Check the data.',
  tipoDni: 'ID card',
  tipoNie: 'NIE',
  tipoPasaporte: 'Passport',
  metodosPago: 'Payment methods',
  pagosDesc: 'Add optional payment methods to operate with credits. Only masked data is stored.',
  agregarMetodo: 'Add method',
  tipoTarjeta: 'Card',
  tipoPaypal: 'PayPal',
  tipoCripto: 'Crypto',
  datosEnmascarados: 'Masked data (e.g. •••• 1234)',
  pagoAgregado: 'Payment method added',
  predeterminado: 'Default',
  marcarPredeterminado: 'Use as default',
  pagoEliminado: 'Method removed',
};

const cat: Traducciones = {
  appName: 'Dòmino',
  subtitulo: 'Joc multijugador local',
  cuantosJugadores: 'Quants jugadors?',
  jugadorLabel: 'Jugador {n}',
  humano: 'Humà',
  bot: 'Bot',
  botBadge: 'BOT',
  opcionesPartida: 'Opcions de partida',
  robarDelPozo: 'Robar de la bassa',
  robarDescOn: "Si no pots jugar, roba fitxes de la bassa fins a trobar-ne una de vàlida.",
  robarDescOff: "Si no pots jugar, passaràs el torn directament.",
  robarPozo: 'Robar de la bassa',
  sinConexion: 'Sense connexió amb el servidor',
  anfitrion: 'amfitrió',
  soloAnfitrion: "Només l'amfitrió pot iniciar la partida",
  partidaEnCurso: 'La partida ja està en curs',
  movimientoInvalido: 'Moviment no vàlid',
  iniciarPartida: 'COMENÇAR PARTIDA',
  turnoDe: 'Torn de {name}',
  partidaTerminada: 'Partida acabada',
  pozo: 'Bassa: {n}',
  pasarTurno: 'Passar torn',
  coincideExtremos: 'La fitxa coincideix amb els dos extrems. On la col·loques?',
  izquierda: 'Esquerra',
  derecha: 'Dreta',
  cancelar: 'Cancel·lar',
  gana: '{name} guanya la partida!',
  empatada: 'Partida empatada!',
  trabada: 'La partida ha quedat bloquejada',
  puntos: '{n} pts',
  jugarDeNuevo: 'Jugar de nou',
  cambiarJugadores: 'Canviar jugadors',
  fichas: '{n} fitxes',
  pensando: 'Pensant…',
  comienzaPartida: '{name} comença la partida',
  tileNoEnMano: "Aquesta fitxa no està a la teva mà",
  tileNoJugable: 'Aquesta fitxa no es pot jugar ara',
  soloOtroExtremo: "Només pots jugar-la a l'altre extrem",
  noPuedesRobar: 'Tens fitxes jugables, no pots robar',
  pozoVacioPasar: 'La bassa és buida, has de passar',
  sinPozo: 'Aquesta partida no té bassa',
  noPuedesPasar: 'Tens fitxes jugables, no pots passar',
  pozoDebesRobar: 'Encara hi ha fitxes a la bassa, has de robar',
  jugadaInvalida: 'Jugada invàlida',
  crearCuenta: 'Crear compte',
  bienvenido: 'Benvingut al Dòmino Club',
  experienciaPremium: "L'experiència de joc més premium",
  registrarseIniciar: "Registra't o Inicia sessió",
  jugarInvitado: 'Jugar com a Convidat',
  terminosPrivacidad: 'Termes i Privacitat',
  codigoAcceso: "Codi d'accés",
  creaCodigo: 'Crea el teu codi de 4 dígits',
  pinInvalido: 'El codi ha de tenir 4 dígits',
  verificaIdentidad: 'Verifica la teva identitat',
  verificaDesc: "Introdueix el teu codi per continuar",
  codigoIncorrecto: 'Codi incorrecte, torna-ho a provar',
  eligeNombre: 'Tria el teu nom',
  nombrePlaceholder: 'El teu nom',
  eligeColor: 'Tria el color de la teva fitxa',
  continuar: 'Continuar',
  nombreRequerido: 'Escriu un nom per continuar',
  ajustes: 'Configuració',
  idioma: 'Idioma',
  sonido: 'So',
  sonidoDesc: 'Reprodueix sons mentre jugues',
  animarTurno: 'Animar torn',
  animarTurnoDesc: 'Moviment en canviar el torn',
  ayuda: 'Mostrar ajuda',
  ayudaDesc: "Indicadors d'arrossegament i fitxes jugables",
  cuenta: 'Compte',
  cambiarUsuario: "Canviar d'usuari",
  volver: 'Tornar',
  idiomaEs: 'Espanyol',
  idiomaEn: 'Anglès',
  idiomaCat: 'Català',
  iniciarSesion: 'Iniciar sessió',
  usuario: 'Usuari',
  contrasena: 'Codi',
  olvidasteContrasena: "Has oblidat el teu codi?",
  noTienesCuenta: 'No tens compte?',
  crearCuentaLink: 'Crea-la aquí',
  credencialesIncorrectas: 'Usuari o codi incorrecte',
  recuperarContrasena: 'Recuperar codi',
  recuperarDesc: "Introdueix el teu telèfon, verifica amb el codi SMS i crea una contrasenya nova",
  nuevaContrasena: 'Nova contrasenya',
  confirmarContrasena: 'Repetir contrasenya',
  contrasenasNoCoinciden: 'Les contrasenyes no coincideixen',
  contrasenaActualizada: 'Contrasenya actualitzada',
  usuarioNoEncontrado: "No s'ha trobat cap usuari amb aquest nom",
  nombreCompleto: 'Nom complet',
  nombreUsuario: "Nom d'usuari (nick)",
  email: 'Correu electrònic',
  telefono: 'Telèfon (per verificació per SMS)',
  fechaNacimiento: 'Data de naixement',
  dia: 'Dia',
  mes: 'Mes',
  anio: 'Any',
  pais: 'País de residència',
  paisRequerido: 'Indica el teu país de residència',
  terminosAceptar: "He llegit i accepto els termes i condicions",
  terminosRequerido: "Has d'acceptar els termes i condicions",
  verificacionSms: 'Verificació per SMS',
  codigoSms: 'Codi de verificació',
  enviarCodigo: 'Envia el codi',
  reenviarCodigo: 'Reenvia el codi',
  codigoEnviado: 'Codi enviat',
  verificarYCrear: 'Crea el compte',
  emailONombre: 'Correu o nom d\'usuari',
  emailInvalido: 'Correu electrònic invàlid',
  telefonoInvalido: 'Telèfon invàlid',
  passwordDebil: 'Mínim 8 caràcters amb lletres i números',
  menorDeEdad: 'Has de tenir com a mínim 18 anys',
  emailEnUso: 'Aquest correu ja està registrat',
  telefonoEnUso: 'Aquest telèfon ja està registrat',
  nombreEnUso: "Aquest nom d'usuari ja està en ús",
  otpInvalido: 'Codi SMS incorrecte',
  otpExpirado: 'El codi ha expirat, demana un de nou',
  billetera: 'Billetera',
  saldo: 'Saldo',
  creditos: 'crèdits',
  recargarSaldo: 'Recarregar saldo',
  historial: 'Historial',
  historialVacio: 'Encara no hi ha transaccions',
  recargar: 'Recarregar',
  montoRecarga: 'Quantitat a recarregar',
  recargaExitosa: 'Saldo recarregat correctament',
  transacciones: 'Transaccions',
  lobby: 'Lobby',
  salasDisponibles: 'Sales disponibles',
  crearSala: 'Crear sala',
  unirseSalaPrivada: "Unir-se a una sala privada",
  salaPrivada: 'Sala privada',
  codigoSala: 'Codi de la sala',
  nombreSala: 'Nom de la sala',
  apuesta: 'Aposta per jugador',
  jugadores: 'Jugadors',
  salaLlena: 'Sala plena',
  sinSalas: 'No hi ha sales disponibles',
  sinSaldo: 'No tens prou saldo per a aquesta aposta',
  unirseBtn: 'Unir-se',
  codigoInvalido: 'Codi de sala invàlid',
  salaCreada: 'Sala creada',
  invitacion: 'Convida els teus amics amb aquest codi',
  esperandoJugadores: 'Esperant jugadors...',
  salirSala: 'Sortir de la sala',
  salaEnEspera: "La partida començarà quan l'amfitrió la iniciï",
  apuestaPartida: 'Aposta per jugador',
  apuestaDesc: 'Cada jugador aporta {monto} {creditos} a la bassa',
  sinApuesta: 'Sense aposta',
  pagoResultado: 'Resultat de la partida',
  ganaste: 'Has guanyat {monto} {creditos}',
  perdiste: 'Has perdut {monto} {creditos}',
  reembolsoDesc: 'Reemborsament per partida bloquejada',
  apuestaDescTx: 'Aposta en partida',
  gananciaDescTx: 'Premi de la partida',
  recargaDescTx: 'Recàrrega de saldo',
  perfil: 'Perfil',
  editarPerfil: 'Editar perfil',
  amigos: 'Amics',
  notificaciones: 'Notificacions',
  soporteAyuda: 'Ajuda i suport',
  terminos: 'Termes i condicions',
  juegoResponsable: 'Joc responsable',
  sinAmigos: 'Encara no tens amics. Afegeix un jugador pel seu nom.',
  agregarAmigo: 'Afegir amic',
  nombreAmigo: 'Nom del jugador',
  amigoAgregado: 'Amic afegit',
  amigoYaExiste: 'Aquest jugador ja és a la teva llista',
  amigoNoEncontrado: 'No existeix cap jugador amb aquest nom',
  eliminar: 'Eliminar',
  sinNotificaciones: 'No tens notificacions',
  marcarLeidas: 'Marcar totes com a llegides',
  soporteDesc: 'Preguntes freqüents, suport i disputes',
  disputas: 'Obrir disputa',
  disputaDesc: 'Problemes amb un pagament o una partida?',
  enviar: 'Enviar',
  guardar: 'Desar',
  mensajeSoporte: 'Descriu el teu problema',
  soporteEnviado: "Hem rebut la teva consulta. Et respondrem aviat.",
  preguntasFrecuentes: 'Preguntes freqüents',
  faq1P: 'Com recupero el meu saldo?',
  faq1R: 'El saldo es mostra a la teva billetera i es recarrega des de la secció "Recarregar saldo".',
  faq2P: 'Com es paga una partida?',
  faq2R: 'Cada jugador aporta la seva aposta i el guanyador rep tota la bassa.',
  contacto: 'Contacte',
  terminosTitulo: 'Termes i condicions',
  terminosCuerpo:
    'Aquest joc utilitza moneda fictícia ("crèdits") amb finalitats d\'entreteniment. No representa diners reals. En utilitzar-lo acceptes les regles de la plataforma, el joc net entre jugadors i la moderació. Els crèdits no són reemborsables ni convertibles en diners.',
  juegoResponsableTitulo: 'Joc responsable',
  juegoResponsableCuerpo:
    'El joc ha de ser una diversió. Estableix límits de saldo, no apostis més del que et pots permetre i descansa quan ho necessitis. Si creus que tens un problema amb el joc, busca ajuda professional.',
  aceptarTerminos: 'Acceptar termes',
  preguntaSeguridad: 'Pregunta de seguretat',
  respuestaSeguridad: 'La teva resposta',
  respuestaSeguridadRequerida: "Escriu la teva resposta de seguretat",
  dosFactoresDesc: "Activa l'autenticació en dos passos (2FA): demanarà un codi SMS en iniciar sessió",
  preguntaMascota: 'Nom de la teva mascota',
  preguntaCiudad: 'Ciutat de naixement',
  preguntaComida: 'Menjar preferit',
  preguntaColegio: 'Nom de la teva escola',
  verificacion2fa: 'Verificació en dos passos',
  codigo2fa: 'Codi de verificació',
  codigo2faDesc: "T'hem enviat un codi SMS a {telefono} per completar l'inici de sessió",
  codigo2faIncorrecto: 'Codi incorrecte, torna-ho a provar',
  kycTitulo: 'Verificació d\'identitat',
  kycDesc: "Envia el teu document d'identitat oficial i una selfie per verificar el teu compte. Les teves dades estan protegides.",
  kycTipoDocumento: 'Tipus de document',
  kycNumeroDocumento: 'Número de document',
  kycSelfie: 'Selfie de verificació',
  kycTomarSelfie: 'Fer selfie',
  kycEnviar: 'Enviar verificació',
  kycEstadoNoEnviado: 'No verificat',
  kycEstadoPendiente: 'En revisió',
  kycEstadoAprobado: 'Verificat',
  kycEstadoRechazado: 'Rebutjat',
  kycEnviado: 'Verificació enviada. La revisarem aviat.',
  kycError: "No s'ha pogut enviar la verificació. Revisa les dades.",
  tipoDni: 'DNI',
  tipoNie: 'NIE',
  tipoPasaporte: 'Passaport',
  metodosPago: 'Mètodes de pagament',
  pagosDesc: "Afegeix mètodes de pagament opcionals per operar amb crèdits. Només es desen dades emmascarades.",
  agregarMetodo: 'Afegir mètode',
  tipoTarjeta: 'Targeta',
  tipoPaypal: 'PayPal',
  tipoCripto: 'Cripto',
  datosEnmascarados: 'Dades emmascarades (ex. •••• 1234)',
  pagoAgregado: 'Mètode de pagament afegit',
  predeterminado: 'Per defecte',
  marcarPredeterminado: 'Utilitzar per defecte',
  pagoEliminado: 'Mètode eliminat',
};

export const TRADUCCIONES: Record<Idioma, Traducciones> = { es, en, cat };

export function traducir(
  idioma: Idioma,
  clave: keyof Traducciones,
  params?: Record<string, string | number>,
): string {
  let texto = TRADUCCIONES[idioma][clave];
  if (params) {
    for (const k of Object.keys(params)) {
      texto = texto.split(`{${k}}`).join(String(params[k]));
    }
  }
  return texto;
}

export const IDIOMAS: { codigo: Idioma; etiquetaClave: keyof Traducciones }[] = [
  { codigo: 'es', etiquetaClave: 'idiomaEs' },
  { codigo: 'en', etiquetaClave: 'idiomaEn' },
  { codigo: 'cat', etiquetaClave: 'idiomaCat' },
];