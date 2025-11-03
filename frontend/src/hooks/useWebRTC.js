import { useEffect, useRef, useState } from 'react';
import Peer from 'simple-peer';

export function useWebRTC(roomId, localStream, socket) {
  const [remoteStreams, setRemoteStreams] = useState({});
  const peersRef = useRef({});

  useEffect(() => {
    if (!localStream || !socket) {
      console.log('⏳ Waiting for stream and socket...');
      return;
    }

    console.log('🌐 WebRTC: Setting up for room', roomId);

    // Handle existing users (when you join a room with people already in it)
    const handleExistingUsers = (users) => {
      console.log('👥 Found existing users:', users);
      users.forEach(({ socketId, userName }) => {
        console.log('📞 Will call existing user:', userName, socketId);
        // YOU initiate the call to existing users
        setTimeout(() => {
          if (!peersRef.current[socketId]) {
            createPeer(socketId, true);
          }
        }, 1000);
      });
    };

    // Handle new user joining (YOU ARE ALREADY IN THE ROOM, SOMEONE NEW JOINS)
    const handleUserJoinedWebRTC = ({ socketId, userName }) => {
      console.log('👋 New user joined:', userName, socketId);
      console.log('📞 INITIATING CALL to new user:', socketId);
      
      // IMPORTANT: WE initiate the call to the new user
      setTimeout(() => {
        if (!peersRef.current[socketId]) {
          createPeer(socketId, true);
        }
      }, 1000);
    };

    // Handle WebRTC signaling
    const handleWebRTCSignal = ({ signal, from }) => {
      console.log('📡 Received WebRTC signal from:', from);
      
      const peer = peersRef.current[from];
      if (peer) {
        console.log('✅ Signaling existing peer:', from);
        try {
          peer.signal(signal);
        } catch (error) {
          console.error('❌ Error signaling peer:', error);
        }
      } else {
        console.log('🆕 Creating new peer from signal (answer):', from);
        // They sent us an offer, we create answering peer
        createPeer(from, false, signal);
      }
    };

    // Handle user leaving
    const handleUserLeft = ({ socketId }) => {
      console.log('🚪 User left, cleaning peer:', socketId);
      if (peersRef.current[socketId]) {
        try {
          peersRef.current[socketId].destroy();
        } catch (e) {
          console.error('Error destroying peer:', e);
        }
        delete peersRef.current[socketId];
      }
      
      setRemoteStreams(prev => {
        const newStreams = { ...prev };
        delete newStreams[socketId];
        return newStreams;
      });
    };

    // Register socket listeners
    socket.on('existing-users', handleExistingUsers);
    socket.on('user-joined-webrtc', handleUserJoinedWebRTC);
    socket.on('webrtc-signal', handleWebRTCSignal);
    socket.on('user-left', handleUserLeft);

    return () => {
      console.log('🧹 Cleaning up WebRTC...');
      socket.off('existing-users', handleExistingUsers);
      socket.off('user-joined-webrtc', handleUserJoinedWebRTC);
      socket.off('webrtc-signal', handleWebRTCSignal);
      socket.off('user-left', handleUserLeft);
      
      // Destroy all peers
      Object.values(peersRef.current).forEach(peer => {
        try {
          peer.destroy();
        } catch (e) {
          console.error('Error destroying peer:', e);
        }
      });
      peersRef.current = {};
    };
  }, [localStream, socket, roomId]);

  const createPeer = (targetSocketId, initiator, incomingSignal = null) => {
    // Don't create duplicate peers
    if (peersRef.current[targetSocketId]) {
      console.log('⚠️ Peer already exists for:', targetSocketId);
      return;
    }

    try {
      console.log(`${initiator ? '📞 CALLING (initiator=true)' : '📲 ANSWERING (initiator=false)'} peer:`, targetSocketId);

      const peer = new Peer({
        initiator,
        trickle: false,
        stream: localStream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ]
        }
      });

      peer.on('signal', signal => {
        console.log(`📤 Sending ${initiator ? 'OFFER' : 'ANSWER'} signal to:`, targetSocketId);
        socket.emit('webrtc-signal', {
          signal,
          to: targetSocketId,
          roomId
        });
      });

      peer.on('stream', stream => {
        console.log('📺 ✅✅✅ STREAM RECEIVED from:', targetSocketId);
        console.log('   Stream tracks:', stream.getTracks().map(t => t.kind));
        setRemoteStreams(prev => ({
          ...prev,
          [targetSocketId]: stream
        }));
      });

      peer.on('connect', () => {
        console.log('🔗 ✅ Peer DATA CHANNEL connected:', targetSocketId);
      });

      peer.on('error', err => {
        console.error('❌ WebRTC peer error:', targetSocketId, err.message);
      });

      peer.on('close', () => {
        console.log('🔌 Peer connection closed:', targetSocketId);
        delete peersRef.current[targetSocketId];
        setRemoteStreams(prev => {
          const newStreams = { ...prev };
          delete newStreams[targetSocketId];
          return newStreams;
        });
      });

      // If we received an incoming signal (someone called us), signal back
      if (incomingSignal) {
        console.log('📥 Processing incoming signal for:', targetSocketId);
        peer.signal(incomingSignal);
      }

      peersRef.current[targetSocketId] = peer;
    } catch (error) {
      console.error('❌ Error creating peer:', error);
    }
  };

  return { remoteStreams };
}
