import React, { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

/**
 * VideoConsultation – browser-native WebRTC video call component.
 *
 * Props:
 *   roomId  – unique consultation room identifier (e.g. patientId + dieticianId)
 *   onClose – callback when the call ends
 */
export default function VideoConsultation({ roomId, onClose }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);

  const [status, setStatus] = useState('Connecting…');
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
    socketRef.current?.disconnect();
  }, []);

  useEffect(() => {
    const serverUrl = process.env.REACT_APP_API_URL || window.location.origin;
    const socket = io(serverUrl, { transports: ['websocket'] });
    socketRef.current = socket;

    let pc;

    const createPeerConnection = () => {
      pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      localStreamRef.current?.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });

      pc.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('webrtc-ice-candidate', { roomId, candidate: event.candidate });
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === 'connected') setStatus('Connected');
        else if (state === 'disconnected' || state === 'failed') setStatus('Disconnected');
      };
    };

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        socket.emit('join-consultation', roomId);
        setStatus('Waiting for other participant…');
      } catch {
        setStatus('Camera/microphone access denied');
      }
    };

    socket.on('room-full', () => setStatus('Room is full'));

    socket.on('ready', async () => {
      setStatus('Starting call…');
      createPeerConnection();
      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);
      socket.emit('webrtc-offer', { roomId, offer });
    });

    socket.on('webrtc-offer', async (offer) => {
      createPeerConnection();
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(answer);
      socket.emit('webrtc-answer', { roomId, answer });
    });

    socket.on('webrtc-answer', async (answer) => {
      await pcRef.current?.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('webrtc-ice-candidate', async (candidate) => {
      try {
        await pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
      } catch { /* ignore stale candidates */ }
    });

    socket.on('peer-left', () => {
      setStatus('The other participant has left');
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    });

    start();

    return () => {
      socket.emit('leave-consultation', roomId);
      cleanup();
    };
  }, [roomId, cleanup]);

  const toggleMute = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMuted(!audioTrack.enabled);
    }
  };

  const toggleCamera = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCameraOff(!videoTrack.enabled);
    }
  };

  const hangUp = () => {
    socketRef.current?.emit('leave-consultation', roomId);
    cleanup();
    onClose?.();
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        <div style={styles.statusBar}>{status}</div>

        <div style={styles.videoArea}>
          <video ref={remoteVideoRef} autoPlay playsInline style={styles.remoteVideo} />
          <video ref={localVideoRef} autoPlay playsInline muted style={styles.localVideo} />
        </div>

        <div style={styles.controls}>
          <button onClick={toggleMute} style={styles.controlBtn}>
            {muted ? 'Unmute' : 'Mute'}
          </button>
          <button onClick={toggleCamera} style={styles.controlBtn}>
            {cameraOff ? 'Camera On' : 'Camera Off'}
          </button>
          <button onClick={hangUp} style={{ ...styles.controlBtn, ...styles.hangUpBtn }}>
            End Call
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999,
  },
  container: {
    background: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    width: '90vw', maxWidth: 720,
    display: 'flex', flexDirection: 'column', gap: 16,
  },
  statusBar: {
    color: '#a0aec0', fontSize: 14, textAlign: 'center',
  },
  videoArea: {
    position: 'relative',
    background: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    height: 360,
  },
  remoteVideo: {
    width: '100%', height: '100%', objectFit: 'cover',
  },
  localVideo: {
    position: 'absolute', bottom: 12, right: 12,
    width: 120, height: 90,
    borderRadius: 8, objectFit: 'cover',
    border: '2px solid #c44033',
  },
  controls: {
    display: 'flex', gap: 12, justifyContent: 'center',
  },
  controlBtn: {
    padding: '10px 20px',
    borderRadius: 8,
    border: 'none',
    background: '#2d3748',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 14,
  },
  hangUpBtn: {
    background: '#c44033',
  },
};
