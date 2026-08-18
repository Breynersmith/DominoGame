import AsyncStorage from '@react-native-async-storage/async-storage';
import { AJUSTES_DEFECTO, idiomaActual, useAppStore } from './appStore';

const PERFIL = { nombre: 'Ana', color: '#2563eb' };

beforeEach(async () => {
  await AsyncStorage.clear();
  useAppStore.setState({
    cargado: false,
    perfil: null,
    token: null,
    online: false,
    login2fa: null,
    ajustes: { ...AJUSTES_DEFECTO },
    vista: 'bienvenida',
    historial: [],
    salaModo: 'crear',
    salaConfig: null,
    saldo: 1000,
    transacciones: [],
    amigos: [],
    notificaciones: [],
  });
});

describe('appStore', () => {
  it('arranca sin cargar y con la vista de bienvenida', () => {
    expect(useAppStore.getState().cargado).toBe(false);
    expect(useAppStore.getState().vista).toBe('bienvenida');
    expect(useAppStore.getState().perfil).toBeNull();
  });

  it('cargar sin datos guardados deja la vista de bienvenida', async () => {
    await useAppStore.getState().cargar();
    const s = useAppStore.getState();
    expect(s.cargado).toBe(true);
    expect(s.perfil).toBeNull();
    expect(s.vista).toBe('bienvenida');
  });

  it('registrar guarda el perfil, entra al inicio y persiste', async () => {
    useAppStore.getState().registrar(PERFIL);
    let s = useAppStore.getState();
    expect(s.perfil).toEqual(PERFIL);
    expect(s.vista).toBe('inicio');
    await new Promise(r => setTimeout(r, 0));
    const guardado = await AsyncStorage.getItem('domino:preferencias');
    expect(guardado).toBeTruthy();
    expect(JSON.parse(guardado as string).perfil.nombre).toBe('Ana');

    useAppStore.setState({ cargado: false, vista: 'bienvenida' });
    await useAppStore.getState().cargar();
    s = useAppStore.getState();
    expect(s.perfil).toEqual(PERFIL);
    expect(s.vista).toBe('inicio');
  });

  it('actualizarAjustes aplica cambios parciales y los persiste', async () => {
    useAppStore.getState().registrar(PERFIL);
    useAppStore.getState().actualizarAjustes({ idioma: 'en', sonido: false });
    const s = useAppStore.getState();
    expect(s.ajustes.idioma).toBe('en');
    expect(s.ajustes.sonido).toBe(false);
    expect(s.ajustes.animarTurno).toBe(true);
    expect(idiomaActual()).toBe('en');
  });

  it('abrirAjustes y volverInicio navegan entre vistas', () => {
    useAppStore.getState().registrar(PERFIL);
    useAppStore.getState().abrirAjustes();
    expect(useAppStore.getState().vista).toBe('ajustes');
    useAppStore.getState().volverInicio();
    expect(useAppStore.getState().vista).toBe('inicio');
  });

  it('cerrarSesion borra el perfil y vuelve a la bienvenida', async () => {
    useAppStore.getState().registrar(PERFIL);
    useAppStore.getState().cerrarSesion();
    const s = useAppStore.getState();
    expect(s.perfil).toBeNull();
    expect(s.vista).toBe('bienvenida');
    await new Promise(r => setTimeout(r, 0));
    expect(await AsyncStorage.getItem('domino:preferencias')).toBeNull();
  });

  it('irARegistro y jugarComoInvitado navegan desde la bienvenida', () => {
    useAppStore.getState().irARegistro();
    expect(useAppStore.getState().vista).toBe('registro');
    useAppStore.getState().jugarComoInvitado();
    expect(useAppStore.getState().vista).toBe('inicio');
  });

  it('iniciarSesion entra al inicio con credenciales del servidor', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: 'tk-1', usuario: { id: 1, nombre: 'Ana', color: '#2563eb', saldo: 1000, kycEstado: 'no_enviado' } }),
    } as Response);
    const ok = await useAppStore.getState().iniciarSesion('ana@test.com', 'Clave123');
    expect(ok).toBe('ok');
    expect(useAppStore.getState().vista).toBe('inicio');
    expect(useAppStore.getState().online).toBe(true);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'credenciales_invalidas' }),
    } as Response);
    expect(await useAppStore.getState().iniciarSesion('ana@test.com', 'Mala')).toBe('error');
  });

  it('con 2FA el login queda pendiente y completar2fa termina la sesión', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ requiere2fa: true, telefonoEnmascarado: '+34••••0001', demo: true, codigo: '654321' }),
    } as Response);
    const r = await useAppStore.getState().iniciarSesion('Ana', 'Clave123');
    expect(r).toBe('2fa');
    expect(useAppStore.getState().login2fa).toMatchObject({ identificador: 'Ana', demo: true, codigo: '654321' });
    expect(useAppStore.getState().online).toBe(false);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: 'tk-2fa', usuario: { id: 1, nombre: 'Ana', color: '#2563eb', saldo: 1000, kycEstado: 'no_enviado' } }),
    } as Response);
    expect(await useAppStore.getState().completar2fa('654321')).toBe(true);
    expect(useAppStore.getState().login2fa).toBeNull();
    expect(useAppStore.getState().online).toBe(true);
    expect(useAppStore.getState().vista).toBe('inicio');
  });

  it('recuperarContrasena cambia la contraseña verificando el teléfono por OTP', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: 'tk-2', usuario: { id: 1, nombre: 'Ana', color: '#2563eb', saldo: 1000 } }),
    } as Response);
    expect(await useAppStore.getState().recuperarContrasena('+34600000001', '123456', 'NuevaClave1')).toBe(true);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'otp_invalido' }),
    } as Response);
    expect(await useAppStore.getState().recuperarContrasena('+34600000001', '000000', 'NuevaClave1')).toBe(false);
  });

  it('recuperarPorPregunta recupera con la respuesta de seguridad', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: 'tk-3', usuario: { id: 1, nombre: 'Ana', color: '#2563eb', saldo: 1000 } }),
    } as Response);
    expect(await useAppStore.getState().recuperarPorPregunta('Ana', 'nombre_mascota', 'Rex', 'NuevaClave1')).toBe(true);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'respuesta_seguridad_invalida' }),
    } as Response);
    expect(await useAppStore.getState().recuperarPorPregunta('Ana', 'nombre_mascota', 'Otro', 'NuevaClave1')).toBe(false);
  });

  it('enviarKyc actualiza el estado del perfil', async () => {
    useAppStore.getState().registrar(PERFIL);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({ estado: 'pendiente' }),
    } as Response);
    expect(await useAppStore.getState().enviarKyc('dni', '12345678A', 'data:image/jpeg;base64,AAAA')).toBe(true);
    expect(useAppStore.getState().perfil?.kycEstado).toBe('pendiente');

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'numero_documento_invalido' }),
    } as Response);
    expect(await useAppStore.getState().enviarKyc('dni', 'x!', 'data:image/jpeg;base64,AAAA')).toBe(false);
  });

  it('recargarSaldo suma saldo y registra una transacción', () => {
    const antes = useAppStore.getState().saldo;
    useAppStore.getState().recargarSaldo(500, 'Recarga');
    const s = useAppStore.getState();
    expect(s.saldo).toBe(antes + 500);
    expect(s.transacciones[0]).toMatchObject({ tipo: 'recarga', monto: 500, descripcion: 'Recarga' });
  });

  it('cobrarApuesta descuenta y abonarResultado abona', () => {
    const antes = useAppStore.getState().saldo;
    useAppStore.getState().cobrarApuesta(100, 'Apuesta');
    expect(useAppStore.getState().saldo).toBe(antes - 100);
    useAppStore.getState().abonarResultado('ganancia', 400, 'Premio');
    expect(useAppStore.getState().saldo).toBe(antes + 300);
  });

  it('agregarAmigo evita duplicados y eliminarAmigo quita de la lista', () => {
    expect(useAppStore.getState().agregarAmigo('Luis')).toBe(true);
    expect(useAppStore.getState().agregarAmigo('Luis')).toBe(false);
    expect(useAppStore.getState().amigos).toEqual(['Luis']);
    useAppStore.getState().eliminarAmigo('Luis');
    expect(useAppStore.getState().amigos).toEqual([]);
  });

  it('notificar crea avisos y marcarNotificacionLeida los actualiza', () => {
    useAppStore.getState().notificar('Título', 'Cuerpo');
    const id = useAppStore.getState().notificaciones[0].id;
    expect(useAppStore.getState().notificaciones[0].leida).toBe(false);
    useAppStore.getState().marcarNotificacionLeida(id);
    expect(useAppStore.getState().notificaciones[0].leida).toBe(true);
    useAppStore.getState().limpiarNotificaciones();
    expect(useAppStore.getState().notificaciones).toEqual([]);
  });

  it('irA y volverAtras mantienen un historial de navegación', () => {
    useAppStore.getState().registrar(PERFIL);
    useAppStore.getState().irA('billetera');
    useAppStore.getState().irA('recargar');
    expect(useAppStore.getState().vista).toBe('recargar');
    useAppStore.getState().volverAtras();
    expect(useAppStore.getState().vista).toBe('billetera');
    useAppStore.getState().volverAtras();
    expect(useAppStore.getState().vista).toBe('inicio');
    useAppStore.getState().volverAtras();
    expect(useAppStore.getState().vista).toBe('inicio');
  });

  it('editarPerfil cambia nombre y color', () => {
    useAppStore.getState().registrar(PERFIL);
    useAppStore.getState().editarPerfil({ nombre: 'Ana Maria', color: '#7c3aed' });
    const s = useAppStore.getState();
    expect(s.perfil?.nombre).toBe('Ana Maria');
    expect(s.perfil?.color).toBe('#7c3aed');
  });

  it('setSalaModo y setSalaConfig guardan la configuración transitoria de sala', () => {
    useAppStore.getState().setSalaModo('unirse');
    expect(useAppStore.getState().salaModo).toBe('unirse');
    useAppStore.getState().setSalaConfig({ nombre: 'Sala', apuesta: 25, codigo: 'ABC123' });
    expect(useAppStore.getState().salaConfig).toEqual({ nombre: 'Sala', apuesta: 25, codigo: 'ABC123' });
  });
});