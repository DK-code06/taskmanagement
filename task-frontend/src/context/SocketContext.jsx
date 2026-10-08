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
            // This creates the single, main connection for the app
            const newSocket = io(SOCKET_URL);
            
            newSocket.on('connect', () => {
                try {
                    const decodedToken = jwtDecode(token);
                    newSocket.emit('authenticate', decodedToken.id);
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

