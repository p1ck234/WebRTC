import React, { useRef, useState, useEffect } from "react";
import "./App.css";

const App: React.FC = () => {
  const [inCall, setInCall] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [messageInput, setMessageInput] = useState("");

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  const configuration = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };

  const handleJoin = () => {
    console.log('Кнопка "Присоединиться" нажата');
    if (roomId) {
      const ws = new WebSocket("ws://localhost:8000");
      setWs(ws);
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "join", room: roomId }));
      };
      ws.onmessage = handleMessage;
      setInCall(true);
      console.log('inCall:', inCall);
    }
  };

  const handleMessage = async (message: MessageEvent) => {
    const data = JSON.parse(message.data);

    switch (data.type) {
      case "signal":
        if (data.offer) {
          await peerConnectionRef.current?.setRemoteDescription(
            new RTCSessionDescription(data.offer)
          );
          const answer = await peerConnectionRef.current?.createAnswer();
          await peerConnectionRef.current?.setLocalDescription(answer!);
          ws?.send(JSON.stringify({ type: "signal", answer }));
        } else if (data.answer) {
          await peerConnectionRef.current?.setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );
        } else if (data.iceCandidate) {
          await peerConnectionRef.current?.addIceCandidate(
            new RTCIceCandidate(data.iceCandidate)
          );
        }
        break;
      case "chat":
        setMessages((prev) => [...prev, `Собеседник: ${data.message}`]);
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    if (inCall) {
      const startConnection = async () => {
        localStreamRef.current = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        peerConnectionRef.current = new RTCPeerConnection(configuration);

        peerConnectionRef.current.onicecandidate = (event) => {
          if (event.candidate) {
            ws?.send(
              JSON.stringify({ type: "signal", iceCandidate: event.candidate })
            );
          }
        };

        peerConnectionRef.current.ontrack = (event) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };

        localStreamRef.current?.getTracks().forEach((track) => {
          peerConnectionRef.current?.addTrack(track, localStreamRef.current!);
        });

        const offer = await peerConnectionRef.current?.createOffer();
        await peerConnectionRef.current?.setLocalDescription(offer!);
        ws?.send(JSON.stringify({ type: "signal", offer }));
      };

      startConnection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inCall]);

  const sendMessage = () => {
    if (messageInput) {
      const message = `Вы: ${messageInput}`;
      setMessages((prev) => [...prev, message]);
      ws?.send(JSON.stringify({ type: "chat", message: messageInput }));
      setMessageInput("");
    }
  };

  const chatWindowStyle: React.CSSProperties = {
    width: "90%",
    height: "200px",
    border: "1px solid #ccc",
    margin: "0 auto",
    overflowY: "scroll",
    padding: "10px",
    textAlign: "left",
  };

  return (
    <div style={{ textAlign: "center" }}>
      {!inCall ? (
        <div>
          <h2>Введите идентификатор комнаты</h2>
          <input
            type="text"
            placeholder="ID комнаты"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button onClick={handleJoin}>Присоединиться</button>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              style={{ width: "45%", margin: "10px" }}
            />
            <video
              ref={remoteVideoRef}
              autoPlay
              style={{ width: "45%", margin: "10px" }}
            />
          </div>
          <div>
            <div id="chatWindow" style={chatWindowStyle}>
              {messages.map((msg, index) => (
                <div key={index}>{msg}</div>
              ))}
            </div>
            <input
              type="text"
              placeholder="Введите сообщение"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
            />
            <button onClick={sendMessage}>Отправить</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
