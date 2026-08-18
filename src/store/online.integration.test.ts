import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiLogin, apiRecargar, actualizarToken, ErrorApi, obtenerToken } from '../services/api';
import { AJUSTES_DEFECTO, useAppStore } from './appStore';

const fetchMock = global.fetch as jest.Mock;

beforeEach(async () => {
  await AsyncStorage.clear();
  actualizarToken(null);
  useAppStore.setState({
    cargado: false,
    perfil: null,
    token: null,
    online: false,
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
  fetchMock.mockReset();
});

function responder(estado: number, cuerpo: unknown) {
  fetchMock.mockResolvedValue({
    ok: estado >= 200 && estado < 300,
    status: estado,
    json: async () => cuerpo,
  } as Response);
}

describe('servicio api', () => {
  it('apiLogin devuelve token y usuario y manda el header de autorización', async () => {
    responder(200, { token: 'tk-123', usuario: { id: 7, nombre: 'Ana', color: '#2563eb', saldo: 500 } });
    const r = await apiLogin('Ana', '1234');
    if ('requiere2fa' in r) throw new Error('se esperaba un login completo');
    expect(r.token).toBe('tk-123');
    expect(r.usuario.id).toBe(7);

    actualizarToken('tk-123');
    responder(200, { saldo: 900, transacciones: [] });
    await apiRecargar(100);
    const [, opciones] = fetchMock.mock.calls[1];
    expect((opciones as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tk-123' });
  });

  it('errores del servidor lanzan ErrorApi con el código', async () => {
    responder(400, { error: 'usuario_no_encontrado' });
    await expect(apiLogin('Ana', '0000')).rejects.toThrowError('usuario_no_encontrado');
    await expect(apiLogin('Ana', '0000')).rejects.toMatchObject({ status: 400, codigo: 'usuario_no_encontrado' });
  });

  it('sin red lanza ErrorApi sin_conexion', async () => {
    fetchMock.mockRejectedValueOnce(new Error('net'));
    await expect(apiLogin('Ana', '1234')).rejects.toMatchObject({ codigo: 'sin_conexion' });
  });

  it('obtenerToken refleja el token actual', () => {
    expect(obtenerToken()).toBeNull();
    actualizarToken('abc');
    expect(obtenerToken()).toBe('abc');
  });
});

describe('appStore online', () => {
  it('sincronizar con token válido actualiza saldo y transacciones', async () => {
    responder(200, {
      usuario: { id: 3, nombre: 'Ana', color: '#2563eb', saldo: 900 },
      transacciones: [
        { id: 1, tipo: 'recarga', monto: 100, descripcion: 'Recarga', fecha: 123 },
      ],
    });
    useAppStore.setState({ token: 'tk' });
    await useAppStore.getState().sincronizar();
    const s = useAppStore.getState();
    expect(s.online).toBe(true);
    expect(s.saldo).toBe(900);
    expect(s.perfil?.id).toBe(3);
    expect(s.transacciones[0].tipo).toBe('recarga');
  });

  it('sincronizar con token inválido limpia la sesión', async () => {
    responder(401, { error: 'token_invalido' });
    useAppStore.setState({ token: 'malo' });
    await useAppStore.getState().sincronizar();
    const s = useAppStore.getState();
    expect(s.online).toBe(false);
    expect(s.token).toBeNull();
    expect(await AsyncStorage.getItem('domino:token')).toBeNull();
  });

  it('registrar configura la sesión en el servidor sin PIN', async () => {
    useAppStore
      .getState()
      .registrar(
        { nombre: 'Ana', color: '#2563eb' },
        {
          yaRegistrado: { token: 'tk-9', usuario: { id: 9, nombre: 'Ana', color: '#2563eb', saldo: 1000, kycEstado: 'no_enviado' } },
        },
      );
    expect(useAppStore.getState().vista).toBe('inicio');
    await new Promise(r => setTimeout(r, 10));
    const s = useAppStore.getState();
    expect(s.online).toBe(true);
    expect(s.perfil?.id).toBe(9);
    expect(s.perfil?.kycEstado).toBe('no_enviado');
  });
});