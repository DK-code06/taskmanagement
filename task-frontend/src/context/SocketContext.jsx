import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { jwtDecode } from 'jwt-decode';
import { BACKEND_URL } from '../config';

const SocketContext = createContext();

export const useSocket = () => {
    return useContext(SocketContext);
};

const SOCKET_URL = BACKEND_URL;

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const token = localStorage.getItem('token');

    useEffect(() => {
        if (token) {
            // Pass auth token in handshake options for backend middleware authentication
            const newSocket = io(SOCKET_URL, {
                auth: { token },
                transports: ['websocket', 'polling']
            });
            
            newSocket.on('connect', () => {
                try {
                    const decodedToken = jwtDecode(token);
                    const normalizedId = decodedToken._id ?? decodedToken.id ?? decodedToken.userId;
                    newSocket.emit('authenticate', normalizedId);
                } catch (error) {
                    console.error("Invalid token on socket auth:", error);
                }
            });

            setSocket(newSocket);

            // This cleans up the connection when the user logs out or the app closes
            return () => newSocket.close();
        }
    }, [token]);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};

