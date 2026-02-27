'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { io, Socket } from 'socket.io-client';
import { authService } from '@/lib/api/auth.service';

const SOCKET_BASE_URL =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/api\/?$/, '')
    : '';

interface MeetingSocketContextValue {
  socket: Socket | null;
  connected: boolean;
}

const MeetingSocketContext = createContext<MeetingSocketContextValue>({
  socket: null,
  connected: false,
});

export function MeetingSocketProvider({
  children,
  meetingId,
  organizationId,
}: {
  children: ReactNode;
  meetingId: string | null;
  organizationId: string | null;
}) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!meetingId || !organizationId || typeof window === 'undefined' || !SOCKET_BASE_URL) {
      return;
    }

    const token = authService.getToken();
    if (!token) {
      return;
    }

    const socketInstance = io(SOCKET_BASE_URL, {
      path: '/api/socket.io',
      auth: { token },
      transports: ['polling', 'websocket'],
      upgrade: true,
    });

    socketInstance.on('connect', () => {
      setConnected(true);
      socketInstance.emit('join_meeting', { meetingId, organizationId });
    });

    socketInstance.on('disconnect', () => {
      setConnected(false);
    });

    socketInstance.on('error', (err: { message?: string }) => {
      console.warn('[MeetingSocket]', err?.message || err);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.removeAllListeners();
      socketInstance.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [meetingId, organizationId]);

  const value = useMemo(
    () => ({
      socket,
      connected,
    }),
    [socket, connected]
  );

  return (
    <MeetingSocketContext.Provider value={value}>
      {children}
    </MeetingSocketContext.Provider>
  );
}

export function useMeetingSocket() {
  return useContext(MeetingSocketContext);
}
