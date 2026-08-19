import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FONT_INTER_MEDIUM, FONT_INTER_SEMIBOLD, FONT_MONTSERRAT_EXTRA } from '../constants/fonts';
import { useT } from '../i18n/useT';
import { useOnlineStore, MensajeChat } from '../store/onlineStore';
import { Avatar } from './Avatar';
import { IconoChat } from './icons/IconoChat';
import { IconoFlecha } from './icons/IconoFlecha';

const COLOR_MENTA = '#6FFBBE';
const COLOR_AMBAR = '#ffb95f';

interface Props {
  visible: boolean;
  onCerrar: () => void;
}

export function ChatSala({ visible, onCerrar }: Props) {
  const t = useT();
  const mensajes = useOnlineStore(s => s.chatMensajes);
  const chatError = useOnlineStore(s => s.chatError);
  const conectado = useOnlineStore(s => s.conectado);
  const enviarChat = useOnlineStore(s => s.enviarChat);

  const [texto, setTexto] = useState('');
  const listaRef = useRef<FlatList<MensajeChat>>(null);

  useEffect(() => {
    if (visible) setTexto('');
  }, [visible]);

  const enviar = () => {
    if (!texto.trim()) return;
    enviarChat(texto);
    setTexto('');
  };

  const traducirError = (codigo: string): string => {
    if (codigo === 'chat_demasiado_rapido') return t('chatDemasiadoRapido');
    return t('mensajeInvalido');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
      <KeyboardAvoidingView
        style={styles.fondo}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.tarjeta}>
          <View style={styles.cabecera}>
            <View style={styles.tituloFila}>
              <IconoChat color={COLOR_MENTA} size={20} />
              <Text style={styles.titulo}>{t('chatTitulo')}</Text>
            </View>
            <Pressable style={styles.botonCerrar} onPress={onCerrar} accessibilityLabel="cerrar chat">
              <Text style={styles.iconoCerrar}>✕</Text>
            </Pressable>
          </View>

          {!conectado && <Text style={styles.aviso}>{t('sinConexion')}</Text>}

          <FlatList
            ref={listaRef}
            data={mensajes}
            keyExtractor={m => String(m.id)}
            style={styles.lista}
            contentContainerStyle={styles.contenidoLista}
            onContentSizeChange={() => listaRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <Text style={styles.vacio}>{t('chatVacio')}</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.fila}>
                <Avatar
                  foto={item.foto ?? undefined}
                  color={item.color}
                  nombre={item.nombre}
                  tamano={34}
                />
                <View style={styles.burbuja}>
                  <Text style={styles.nombre} numberOfLines={1}>
                    {item.nombre}
                  </Text>
                  <Text style={styles.texto}>{item.texto}</Text>
                </View>
              </View>
            )}
          />

          {chatError ? <Text style={styles.error}>{traducirError(chatError)}</Text> : null}

          <View style={styles.entrada}>
            <TextInput
              style={styles.input}
              value={texto}
              placeholder={t('chatPlaceholder')}
              placeholderTextColor="#9ca3af"
              maxLength={300}
              multiline
              onChangeText={setTexto}
              onSubmitEditing={enviar}
            />
            <Pressable
              style={({ pressed }) => [
                styles.botonEnviar,
                (!texto.trim() || !conectado) && styles.botonEnviarDeshabilitado,
                pressed && styles.botonPresionado,
              ]}
              onPress={enviar}
              disabled={!texto.trim() || !conectado}
            >
              <IconoFlecha direccion="derecha" color="#002113" size={18} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  tarjeta: {
    backgroundColor: '#0A4A33',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(111,251,190,0.3)',
    height: '80%',
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 16,
  },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  tituloFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titulo: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    fontFamily: FONT_MONTSERRAT_EXTRA,
  },
  botonCerrar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  iconoCerrar: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  aviso: {
    color: COLOR_AMBAR,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  lista: {
    flex: 1,
  },
  contenidoLista: {
    paddingVertical: 6,
    flexGrow: 1,
    justifyContent: 'flex-start',
  },
  vacio: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  burbuja: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  nombre: {
    color: COLOR_MENTA,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONT_INTER_SEMIBOLD,
    marginBottom: 2,
  },
  texto: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 20,
    fontFamily: FONT_INTER_MEDIUM,
  },
  error: {
    color: '#ff6b6b',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  entrada: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14,
    color: '#ffffff',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxHeight: 110,
    fontFamily: FONT_INTER_MEDIUM,
  },
  botonEnviar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLOR_MENTA,
  },
  botonEnviarDeshabilitado: {
    opacity: 0.4,
  },
  botonPresionado: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
});