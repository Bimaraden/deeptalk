/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Music, 
  Lock, 
  LogOut, 
  ChevronDown, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  Smile,
  Info,
  ShieldCheck,
  X,
  Radio
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  db, 
  auth, 
  initAuth, 
  signInWithGoogle,
  handleFirestoreError, 
  OperationType 
} from './firebase';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp, 
  addDoc,
  deleteDoc,
  updateDoc,
  Timestamp
} from 'firebase/firestore';

import axios from 'axios';

// --- Types ---
type Message = {
  id: string;
  senderId: string;
  sender: 'me' | 'partner' | 'system';
  nickname?: string;
  text: string;
  timestamp: string;
};

type Track = {
  title: string;
  artist: string;
  duration: string;
  totalSeconds: number;
  audioUrl?: string;
  spotifyId?: string;
};

type PresenceData = {
  userId: string;
  nickname: string;
  lastSeen: any;
  isTyping?: boolean;
};

// --- Constants ---
// --- DEVELOPER PLAYLIST CONFIGURATION ---
// Tambahkan atau ubah lagu di sini. Ini akan menjadi playlist default untuk semua ruangan.
// Untuk lagu lokal: Letakkan di public/audio/ lalu ganti url menjadi "/audio/file.mp3"
const PLAYLIST: Track[] = [
  { 
    title: "Midnight Chill", 
    artist: "DeepTalk Radio", 
    duration: "6:12", 
    totalSeconds: 372,
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" 
  },
  { 
    title: "Lofi Dreams", 
    artist: "Aesthetic Room", 
    duration: "7:05", 
    totalSeconds: 425,
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" 
  },
  { 
    title: "Quiet Night", 
    artist: "Silent Duo", 
    duration: "5:20", 
    totalSeconds: 320,
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" 
  },
  { 
    title: "Starlight", 
    artist: "Celestial", 
    duration: "4:45", 
    totalSeconds: 285,
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3" 
  },
];

const SESSION_DURATION = 7200; // 2 hours in seconds
const PARTNER_DEMO_MESSAGES = [
  { delay: 3000, text: "hei, akhirnya ada ruang buat kita ngobrol beneran 🌙" },
  { delay: 12000, text: "gimana harimu tadi?" },
  { delay: 28000, text: "aku kangen kamu tau" },
  { delay: 65000, text: "lagi dengerin lagu yang sama gak?" },
  { delay: 90000, text: "seneng banget ada tempat kayak gini cuma buat kita" },
];

// --- Helpers ---
const formatTimer = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const generateCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

const getTimestamp = () => {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// --- Main App ---
export default function App() {
  const [appState, setAppState] = useState<'join' | 'chat' | 'end'>('join');
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [partnerPresence, setPartnerPresence] = useState<PresenceData | null>(null);
  const [timeLeft, setTimeLeft] = useState(SESSION_DURATION);
  
  const [roomHostId, setRoomHostId] = useState<string | null>(null);
  
  // Music State
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [musicProgress, setMusicProgress] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMusicPanelOpen, setIsMusicPanelOpen] = useState(false);
  
  // Modals
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const introAudioRef = useRef<HTMLAudioElement | null>(null);
  const outroAudioRef = useRef<HTMLAudioElement | null>(null);

  // Radio Effect Listener
  useEffect(() => {
    if (appState !== 'chat' || !roomCode) return;

    const unsub = onSnapshot(doc(db, `rooms/${roomCode}/music/effects`), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const effect = data.activeEffect;
        const triggerId = data.triggerId;
        
        // Use a local ref to track if we already played this trigger
        if ((window as any)._lastTriggerId === triggerId) return;
        (window as any)._lastTriggerId = triggerId;

        const musicAudio = audioRef.current;
        let effectAudio = null;

        if (effect === 'opening') effectAudio = introAudioRef.current;
        if (effect === 'closing') effectAudio = outroAudioRef.current;

        if (effectAudio) {
          if (musicAudio) musicAudio.volume = 0.2;
          effectAudio.currentTime = 0;
          effectAudio.play().catch(e => console.log("Effect blocked:", e));
          effectAudio.onended = () => {
            if (musicAudio) musicAudio.volume = 1.0;
          };
        }
      }
    });

    return unsub;
  }, [appState, roomCode]);

  // Music Simulation
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setMusicProgress((prev) => {
        const activePlaylist = (window as any)._activePlaylist || PLAYLIST;
        const currentTrack = activePlaylist[currentTrackIndex] || activePlaylist[0];
        if (prev >= currentTrack.totalSeconds) {
          return currentTrack.totalSeconds; 
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, currentTrackIndex]);

  // Audio Player Sync
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }

    const audio = audioRef.current;
    const activePlaylist = (window as any)._activePlaylist || PLAYLIST;
    const currentTrack = activePlaylist[currentTrackIndex] || activePlaylist[0];

    if (audio.src !== currentTrack.audioUrl) {
      audio.src = currentTrack.audioUrl;
      audio.load();
    }

    if (isPlaying) {
      if (Math.abs(audio.currentTime - musicProgress) > 2) {
        audio.currentTime = musicProgress;
      }
      audio.play().catch(e => console.warn("Autoplay blocked:", e));
    } else {
      audio.pause();
    }
  }, [currentTrackIndex, isPlaying, musicProgress]);

  // Volume Sync
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  // Initialize Auth
  useEffect(() => {
    initAuth().catch(err => {
      console.warn("Auto-login failed, manual login may be required.");
    });
  }, []);

  // Presence Tracking
  useEffect(() => {
    if (appState !== 'chat' || !auth.currentUser) return;

    const presenceRef = doc(db, `rooms/${roomCode}/presence/${auth.currentUser.uid}`);
    
    const updatePresence = async (typing = false) => {
      try {
        await setDoc(presenceRef, {
          userId: auth.currentUser?.uid,
          nickname,
          lastSeen: serverTimestamp(),
          isTyping: typing
        }, { merge: true });
      } catch (err) {
        console.error("Presence update failed:", err);
      }
    };

    updatePresence();
    const interval = setInterval(() => updatePresence(inputMessage.length > 0), 30000);

    return () => {
      clearInterval(interval);
      deleteDoc(presenceRef).catch(() => {});
    };
  }, [appState, nickname, roomCode, inputMessage, auth.currentUser]);

  // Firestore Listeners
  useEffect(() => {
    if (appState !== 'chat' || !auth.currentUser) return;

    const uid = auth.currentUser.uid;

    // 1. Messages Listener
    const messagesQuery = query(
      collection(db, `rooms/${roomCode}/messages`),
      orderBy('timestamp', 'asc')
    );

    const unsubMessages = onSnapshot(messagesQuery, (snapshot) => {
      const newMessages = snapshot.docs.map(doc => {
        const data = doc.data();
        let sender: 'me' | 'partner' | 'system' = 'partner';
        if (data.type === 'system') sender = 'system';
        else if (data.senderId === uid) sender = 'me';

        const ts = data.timestamp as Timestamp;
        const timeStr = ts ? ts.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...';

        return {
          id: doc.id,
          senderId: data.senderId,
          sender,
          nickname: data.nickname,
          text: data.text,
          timestamp: timeStr
        };
      });
      setMessages(newMessages);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `rooms/${roomCode}/messages`));

    // 2. Presence Listener (Partner)
    const presenceUnsub = onSnapshot(collection(db, `rooms/${roomCode}/presence`), (snapshot) => {
      const partners = snapshot.docs
        .map(doc => doc.data() as PresenceData)
        .filter(p => p.userId !== uid);
      
      if (partners.length > 0) {
        setPartnerPresence(partners[0]);
      } else {
        setPartnerPresence(null);
      }
    });

    // 3. Music Listener
    const musicUnsub = onSnapshot(doc(db, `rooms/${roomCode}/music/current`), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setCurrentTrackIndex(data.currentTrackIndex);
        setIsPlaying(data.isPlaying);
        
        // Only sync progress if it's a significant jump (to avoid fight between clients)
        const remoteProgress = data.progress;
        if (Math.abs(remoteProgress - musicProgress) > 5) {
          setMusicProgress(remoteProgress);
        }
      }
    });

    // 4. Room Metadata (Timer sync)
    const roomSnap = onSnapshot(doc(db, `rooms/${roomCode}`), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setRoomHostId(data.hostId);
        const expiresAt = (data.expiresAt as Timestamp).toDate();
        const now = new Date();
        const diff = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
        setTimeLeft(diff);
      }
    });

    return () => {
      unsubMessages();
      presenceUnsub();
      musicUnsub();
      roomSnap();
    };
  }, [appState, roomCode, auth.currentUser]);

  // Session Timer (Local decrement)
  useEffect(() => {
    if (appState !== 'chat') return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) {
          setAppState('end');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [appState]);

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, partnerPresence?.isTyping]);

  const addSystemMessage = async (text: string) => {
    try {
      await addDoc(collection(db, `rooms/${roomCode}/messages`), {
        senderId: 'system',
        nickname: 'System',
        text,
        timestamp: serverTimestamp(),
        type: 'system'
      });
    } catch (err) {
      console.error("System message failed:", err);
    }
  };

  const handleJoin = async () => {
    if (!nickname.trim() || roomCode.trim().length !== 6 || !auth.currentUser) return;

    try {
      const roomRef = doc(db, `rooms/${roomCode}`);
      const snap = await getDoc(roomRef);
      
      if (!snap.exists()) {
        // Create Room
        await setDoc(roomRef, {
          hostId: auth.currentUser?.uid,
          createdAt: serverTimestamp(),
          expiresAt: Timestamp.fromDate(new Date(Date.now() + SESSION_DURATION * 1000))
        });
        
        // Create initial music state
        await setDoc(doc(db, `rooms/${roomCode}/music/current`), {
          currentTrackIndex: 0,
          isPlaying: false,
          progress: 0,
          updatedAt: serverTimestamp()
        });

        // Create effects trigger doc
        await setDoc(doc(db, `rooms/${roomCode}/music/effects`), {
          activeEffect: null,
          triggerId: null
        });

        addSystemMessage("Ruangan dibuat ✨");
      }
      
      setAppState('chat');
    } catch (err: any) {
      console.error("Room Join Error:", err);
      if (err.message && err.message.includes('Database')) {
        alert("Gagal terhubung ke Database. Pastikan konfigurasi Database ID sudah benar.");
      } else {
        alert("Gagal masuk ke ruangan. Periksa koneksi internet atau ID Ruangan.");
      }
      handleFirestoreError(err, OperationType.GET, `rooms/${roomCode}`);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !auth.currentUser) return;
    
    const text = inputMessage;
    setInputMessage('');

    try {
      await addDoc(collection(db, `rooms/${roomCode}/messages`), {
        senderId: auth.currentUser.uid,
        nickname,
        text,
        timestamp: serverTimestamp(),
        type: 'chat'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `rooms/${roomCode}/messages`);
    }
  };

  const syncMusic = async (updates: any) => {
    try {
      await updateDoc(doc(db, `rooms/${roomCode}/music/current`), {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Music sync failed:", err);
    }
  };

  const handleSignOut = async () => {
    try {
      if (roomCode && auth.currentUser) {
        const presenceRef = doc(db, `rooms/${roomCode}/presence/${auth.currentUser.uid}`);
        await deleteDoc(presenceRef);
      }
      await auth.signOut();
      setAppState('end');
    } catch (err) {
      console.error("Sign out fail:", err);
      setAppState('end');
    }
  };

  if (appState === 'end') {
    return (
      <div className="min-h-screen bg-surface-page flex items-center justify-center p-6 text-center">
        <div className="max-w-md">
          <h1 className="font-headline font-extrabold text-4xl mb-4 text-snow tracking-tight uppercase">
            SESI TELAH BERAKHIR
          </h1>
          <p className="text-fog text-lg mb-8">
            Semua pesan telah dihapus. Tidak ada jejak yang tertinggal. 🌙
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-blurple hover:bg-dark-blurple text-snow font-bold py-4 rounded-xl transition-colors cursor-pointer"
          >
            Mulai Sesi Baru
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans bg-surface-page overflow-hidden">
      <audio ref={audioRef} />
    <audio ref={introAudioRef} src="/audio/opening.mp3" />
    <audio ref={outroAudioRef} src="/audio/closing.mp3" />
      <AnimatePresence mode="wait">
        {appState === 'join' ? (
          <JoinScreen 
            nickname={nickname} 
            setNickname={setNickname}
            roomCode={roomCode}
            setRoomCode={setRoomCode}
            onJoin={handleJoin}
          />
        ) : (
          <div className="h-screen flex flex-col relative bg-surface-page">
            {/* Top Bar */}
            <div className="bg-not-quite-black border-b border-dim-grey px-4 py-3 flex items-center justify-between z-10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blurple to-dark-blurple flex items-center justify-center text-snow font-bold">
                  {(partnerPresence?.nickname?.[0] || 'P').toUpperCase()}💜
                </div>
                <div>
                  <h3 className="text-snow font-medium leading-tight">
                    {partnerPresence?.nickname || 'Menunggu pasangan...'}
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${partnerPresence ? 'bg-spring-green' : 'bg-dim-grey'}`}></span>
                    <span className="text-fog text-xs">{partnerPresence ? 'Online' : 'Offline'}</span>
                  </div>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-4">
                <span className="px-3 py-1 bg-dark-charcoal rounded-full text-fog text-xs font-medium tracking-widest uppercase">
                  {roomCode}
                </span>
                <span className="text-snow font-mono text-sm tabular-nums">
                  {formatTimer(timeLeft)}
                </span>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => setIsMusicPanelOpen(true)}
                  className="w-9 h-9 flex items-center justify-center bg-dark-charcoal rounded-xl text-snow hover:bg-dim-grey transition-colors cursor-pointer"
                >
                  <Music className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setIsSecurityModalOpen(true)}
                  className="w-9 h-9 flex items-center justify-center bg-dark-charcoal rounded-xl text-snow hover:bg-dim-grey transition-colors cursor-pointer"
                >
                  <Lock className="w-5 h-5" />
                </button>
                <button 
                  onClick={handleSignOut}
                  className="w-9 h-9 flex items-center justify-center bg-dark-charcoal rounded-xl text-snow hover:bg-dim-grey transition-colors cursor-pointer"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Message Area */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 scrollbar-hide bg-surface-page pb-24"
            >
              {messages.map((msg) => (
                msg.sender === 'system' ? (
                  <div key={msg.id} className="flex justify-center my-2">
                    <span className="bg-blurple/15 text-fog text-xs px-4 py-1.5 rounded-full border border-blurple/10">
                      {msg.text}
                    </span>
                  </div>
                ) : (
                  <div 
                    key={msg.id} 
                    className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'} max-w-[85%] ${msg.sender === 'me' ? 'ml-auto' : ''}`}
                  >
                    <span className="text-fog text-[11px] mb-1 px-1">{msg.nickname}</span>
                    <div className={`px-4 py-2.5 ${
                      msg.sender === 'me' 
                        ? 'bg-blurple text-snow rounded-[18px_18px_4px_18px]' 
                        : 'bg-dark-charcoal text-fog rounded-[18px_18px_18px_4px]'
                    }`}>
                      {msg.text}
                    </div>
                    <span className="text-fog text-[10px] mt-1 px-1">{msg.timestamp}</span>
                  </div>
                )
              ))}

              {partnerPresence?.isTyping && (
                <div className="flex flex-col items-start">
                  <span className="text-fog text-[11px] mb-1 px-1">{partnerPresence.nickname}</span>
                  <div className="bg-dark-charcoal px-4 py-3 rounded-[18px_18px_18px_4px] flex gap-1">
                    <div className="w-1.5 h-1.5 bg-dim-grey rounded-full animate-bounce-dots text-transparent">.</div>
                    <div className="w-1.5 h-1.5 bg-dim-grey rounded-full animate-bounce-dots delay-150 text-transparent">.</div>
                    <div className="w-1.5 h-1.5 bg-dim-grey rounded-full animate-bounce-dots delay-300 text-transparent">.</div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Input */}
            <div className="bg-not-quite-black border-t border-dim-grey p-3 shrink-0">
              <div className="max-w-4xl mx-auto flex items-end gap-3">
                <button className="p-2 text-fog hover:text-snow cursor-pointer">
                  <Smile className="w-6 h-6" />
                </button>
                <div className="flex-1 relative">
                  <textarea 
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Tulis sesuatu yang jujur..."
                    className="w-full bg-dark-charcoal text-snow rounded-xl p-3 pr-12 focus:outline-none resize-none max-h-32 text-sm placeholder:text-fog/50"
                    rows={1}
                  />
                </div>
                <button 
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim()}
                  className="w-10 h-10 shrink-0 bg-blurple hover:bg-dark-blurple disabled:opacity-50 text-snow rounded-xl flex items-center justify-center transition-colors cursor-pointer"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Music Overlay */}
            <AnimatePresence>
              {isMusicPanelOpen && (
                <MusicPanel 
                  onClose={() => setIsMusicPanelOpen(false)}
                  currentTrackIndex={currentTrackIndex}
                  onTrackChange={(idx: number) => syncMusic({ currentTrackIndex: idx, progress: 0 })}
                  isPlaying={isPlaying}
                  onTogglePlay={() => syncMusic({ isPlaying: !isPlaying, progress: musicProgress })}
                  progress={musicProgress}
                  volume={volume}
                  setVolume={setVolume}
                  roomCode={roomCode}
                  isHost={auth.currentUser?.uid === roomHostId}
                />
              )}
            </AnimatePresence>

            {/* Security Modal */}
            <AnimatePresence>
              {isSecurityModalOpen && (
                <SecurityModal onClose={() => setIsSecurityModalOpen(false)} />
              )}
            </AnimatePresence>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Subcomponents ---

function JoinScreen({ nickname, setNickname, roomCode, setRoomCode, onJoin }: any) {
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-surface-page flex flex-col items-center justify-center p-6 relative overflow-hidden"
    >
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blurple/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="z-10 text-center mb-10">
        <h1 className="font-headline font-extrabold text-[56px] leading-tight text-snow tracking-[-0.56px] uppercase mb-2">
          DEEPTALK
        </h1>
        <p className="font-sans text-fog text-base tracking-[0.013em]">
          ruang jujur, hanya untuk kalian berdua
        </p>
      </div>

      <div className="w-full max-w-[400px] bg-not-quite-black p-10 rounded-[24px] shadow-2xl z-10">
        <div className="space-y-6">
          {auth.currentUser ? (
            <div className="bg-blurple/10 border border-blurple/20 p-3 rounded-xl flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blurple flex items-center justify-center text-snow text-[10px] font-bold">
                {(auth.currentUser.displayName?.[0] || 'U').toUpperCase()}
              </div>
              <div className="text-left overflow-hidden">
                <p className="text-snow text-[10px] font-bold truncate">TERHUBUNG</p>
                <p className="text-fog text-[11px] truncate">{auth.currentUser.displayName || auth.currentUser.email}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
                <p className="text-red-400 text-xs text-center">
                  Sesi anonim dibatasi. Silakan masuk untuk memulai.
                </p>
              </div>
              <button 
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="w-full bg-snow text-not-quite-black hover:bg-snow/90 font-bold py-3 rounded-xl flex items-center justify-center gap-3 transition-all cursor-pointer"
              >
                {isLoggingIn ? "Menghubungkan..." : "Masuk dengan Google"}
              </button>
              <div className="flex items-center gap-3 my-2">
                <div className="h-px flex-1 bg-dim-grey"></div>
                <span className="text-fog text-[10px] font-bold uppercase tracking-widest">Atau</span>
                <div className="h-px flex-1 bg-dim-grey"></div>
              </div>
            </div>
          )}

          <div className="space-y-6">
            <div className="relative">
              <label className="block text-[10px] font-bold text-fog uppercase tracking-[0.1em] mb-2 px-1">
                Nickname
              </label>
              <div className="relative">
                <input 
                  type="text" 
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Panggilanku..."
                  className="w-full bg-dark-charcoal text-snow rounded-xl p-4 focus:outline-none focus:ring-1 focus:ring-blurple/50 transition-shadow transition-colors"
                />
                {auth.currentUser && nickname === "" && (
                  <button 
                    onClick={() => setNickname(auth.currentUser?.displayName?.split(' ')[0] || '')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] bg-blurple/20 text-blurple font-bold px-2 py-1 rounded-md hover:bg-blurple/30 cursor-pointer"
                  >
                    Gunakan Nama Google
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-fog uppercase tracking-[0.1em] mb-2 px-1 text-center">
              Kode Ruangan
            </label>
            <input 
              type="text" 
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 6))}
              className="w-full bg-dark-charcoal text-snow rounded-xl p-4 text-center text-2xl font-bold tracking-[0.4em] uppercase focus:outline-none focus:ring-1 focus:ring-blurple/50 transition-shadow"
              maxLength={6}
            />
          </div>

          <div className="space-y-3 pt-2">
            <button 
              onClick={onJoin}
              disabled={!auth.currentUser}
              className="w-full bg-blurple hover:bg-dark-blurple disabled:opacity-50 font-headline font-bold text-snow py-4 rounded-xl transition-colors tracking-wide cursor-pointer"
            >
              Masuk Ruangan
            </button>
            <button 
              onClick={() => setRoomCode(generateCode())}
              className="w-full bg-transparent border border-snow/20 hover:border-snow/50 font-headline font-bold text-snow py-4 rounded-xl transition-all cursor-pointer"
            >
              Buat Kode Baru
            </button>
          </div>

          <div className="bg-blurple/15 p-3 rounded-xl flex items-center justify-center gap-2 border border-blurple/10">
            <span className="text-fog text-xs leading-relaxed text-center">
              💬 <span className="opacity-80">Pesan otomatis terhapus dalam 2 jam</span>
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function MusicPanel({ 
  onClose, 
  currentTrackIndex, 
  onTrackChange,
  isPlaying, 
  onTogglePlay,
  progress, 
  volume, 
  setVolume,
  roomCode,
  isHost
}: any) {
  const [playlist, setPlaylist] = useState<Track[]>(PLAYLIST);
  const [isEffectPlaying, setIsEffectPlaying] = useState(false);

  // Sync with Firestore Playlist
  useEffect(() => {
    const unsub = onSnapshot(doc(db, `rooms/${roomCode}/music/playlist`), (snap) => {
      if (snap.exists()) {
        const tracks = snap.data().tracks;
        setPlaylist(tracks);
        (window as any)._activePlaylist = tracks;
      } else {
        setPlaylist(PLAYLIST);
        (window as any)._activePlaylist = PLAYLIST;
      }
    });
    return unsub;
  }, [roomCode]);

  const handleReorder = async (fromIndex: number, direction: 'up' | 'down') => {
    if (!isHost) return;
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= playlist.length) return;

    const newPlaylist = [...playlist];
    const [movedItem] = newPlaylist.splice(fromIndex, 1);
    newPlaylist.splice(toIndex, 0, movedItem);

    try {
      await setDoc(doc(db, `rooms/${roomCode}/music/playlist`), {
        tracks: newPlaylist,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid
      });
      
      // If we moved the currently playing track, update the index
      if (fromIndex === currentTrackIndex) {
        await updateDoc(doc(db, `rooms/${roomCode}/music/current`), {
          currentTrackIndex: toIndex,
          updatedAt: serverTimestamp()
        });
      } else if (toIndex === currentTrackIndex) {
        // If something was moved into the current track's position
        await updateDoc(doc(db, `rooms/${roomCode}/music/current`), {
          currentTrackIndex: fromIndex,
          updatedAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error("Reorder failed:", err);
    }
  };

  const handleTriggerEffect = async (type: 'opening' | 'closing') => {
    if (!isHost || isEffectPlaying) return;
    
    setIsEffectPlaying(true);
    try {
      await setDoc(doc(db, `rooms/${roomCode}/music/effects`), {
        activeEffect: type,
        triggerId: Date.now().toString()
      });
      // Small cooldown
      setTimeout(() => setIsEffectPlaying(false), 3000);
    } catch (err) {
      console.error("Effect trigger failed:", err);
      setIsEffectPlaying(false);
    }
  };

  const currentTrack = playlist[currentTrackIndex] || playlist[0];

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div 
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="absolute bottom-0 left-0 right-0 h-[92vh] bg-not-quite-black rounded-t-[24px] border-t border-dim-grey shadow-2xl z-20 flex flex-col"
    >
      <div className="p-6 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex flex-col">
            <h2 className="font-headline font-extrabold text-xl text-snow tracking-wide flex items-center gap-2">
              RADIO MALAM 🌙
            </h2>
            <span className="text-[10px] text-fog font-medium uppercase tracking-[0.2em] mt-1">Sesuaikan Urutan Playlist</span>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-fog hover:text-snow cursor-pointer"
          >
            <ChevronDown className="w-6 h-6" />
          </button>
        </div>

        {/* Now Playing Section */}
        <div className="bg-dark-charcoal p-6 rounded-2xl mb-6">
          {/* Announcer Controls */}
          {isHost && (
            <div className="flex items-center gap-2 mb-6 border-b border-dim-grey/30 pb-4">
              <div className="flex-1">
                <p className="text-[10px] font-bold text-blurple uppercase tracking-widest mb-2">Panel Penyiar 🎙️</p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleTriggerEffect('opening')}
                    disabled={isEffectPlaying}
                    className="flex-1 bg-blurple/10 hover:bg-blurple/20 text-blurple text-[10px] font-bold py-2 px-3 rounded-lg border border-blurple/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Radio className="w-3 h-3" /> OPENING
                  </button>
                  <button 
                    onClick={() => handleTriggerEffect('closing')}
                    disabled={isEffectPlaying}
                    className="flex-1 bg-spring-green/10 hover:bg-spring-green/20 text-spring-green text-[10px] font-bold py-2 px-3 rounded-lg border border-spring-green/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Radio className="w-3 h-3" /> CLOSING
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-2">
            <div className="pr-4 overflow-hidden text-left">
              <h3 className="text-snow font-medium text-lg truncate">{currentTrack.title}</h3>
              <p className="text-fog text-sm truncate">{currentTrack.artist}</p>
            </div>
            {/* Equalizer */}
            <div className="flex items-end gap-1 h-6 shrink-0">
              {[0, 1, 2, 3].map((i) => (
                <div 
                  key={i} 
                  className={`w-1.5 bg-blurple rounded-full transition-all ${isPlaying ? 'animate-eq' : ''}`}
                  style={{ 
                    animationDelay: `${i * 0.1}s`,
                    height: isPlaying ? undefined : '4px'
                  }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <div className="relative h-1 bg-dim-grey rounded-full overflow-hidden">
              <div 
                className="absolute left-0 top-0 h-full bg-blurple transition-all duration-300" 
                style={{ width: `${(progress / (currentTrack.totalSeconds || 1)) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono text-fog">
              <span>{formatTime(progress)}</span>
              <span>{currentTrack.duration}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-8 mt-6">
            <button 
              onClick={() => onTrackChange((currentTrackIndex - 1 + playlist.length) % playlist.length)}
              className="p-2 text-snow hover:text-blurple transition-colors cursor-pointer"
            >
              <SkipBack className="w-8 h-8" />
            </button>
            <button 
              onClick={onTogglePlay}
              className="w-16 h-16 bg-blurple rounded-full flex items-center justify-center text-snow hover:bg-dark-blurple hover:scale-105 transition-all shadow-lg cursor-pointer"
            >
              {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current translate-x-0.5" />}
            </button>
            <button 
              onClick={() => onTrackChange((currentTrackIndex + 1) % playlist.length)}
              className="p-2 text-snow hover:text-blurple transition-colors cursor-pointer"
            >
              <SkipForward className="w-8 h-8" />
            </button>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-4 mt-8 px-4">
            <Volume2 className="w-5 h-5 text-fog " />
            <input 
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-full accent-blurple"
            />
          </div>
        </div>

        {/* Playlist */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <h4 className="text-[10px] font-bold text-fog uppercase tracking-widest mb-4 px-2">Antrian Lagu</h4>
          <div className="space-y-1 pb-10">
            {playlist.map((track, index) => (
              <div 
                key={index}
                className={`flex items-center justify-between p-3 rounded-xl transition-colors group ${
                  index === currentTrackIndex 
                    ? 'bg-blurple/10 border-l-[3px] border-blurple' 
                    : 'hover:bg-dark-charcoal active:bg-dark-charcoal/80'
                }`}
              >
                <div 
                  className="flex items-center gap-4 overflow-hidden flex-1 cursor-pointer"
                  onClick={() => onTrackChange(index)}
                >
                  <span className={`text-xs font-mono w-4 shrink-0 ${index === currentTrackIndex ? 'text-blurple' : 'text-fog group-hover:text-snow'}`}>
                    {index + 1}
                  </span>
                  <div className="overflow-hidden text-left">
                    <p className={`text-sm font-medium truncate ${index === currentTrackIndex ? 'text-snow' : 'text-snow/80 group-hover:text-snow'}`}>
                      {track.title}
                    </p>
                    <p className="text-xs text-fog truncate">{track.artist}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <div className="flex flex-col gap-0.5">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleReorder(index, 'up'); }}
                      disabled={index === 0}
                      className="p-1 text-fog hover:text-snow disabled:opacity-0 transition-opacity cursor-pointer"
                    >
                      <ChevronDown className="w-4 h-4 rotate-180" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleReorder(index, 'down'); }}
                      disabled={index === playlist.length - 1}
                      className="p-1 text-fog hover:text-snow disabled:opacity-0 transition-opacity cursor-pointer"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="text-xs text-fog font-mono ml-1">{track.duration}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function SecurityModal({ onClose }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-[360px] bg-not-quite-black rounded-[24px] p-8 shadow-2xl relative z-10 border border-dim-grey"
      >
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-fog hover:text-snow cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
        
        <h2 className="font-headline font-extrabold text-2xl text-snow tracking-tight uppercase mb-8 pr-8">
          KEAMANAN SESI
        </h2>

        <div className="space-y-8 mb-10">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 shrink-0 bg-blurple/10 rounded-xl flex items-center justify-center text-blurple">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-snow text-sm font-medium mb-1">Pesan Terproteksi</p>
              <p className="text-fog text-xs leading-relaxed">Pesan tidak tersimpan di server manapun & hanyalah sementara.</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 shrink-0 bg-blurple/10 rounded-xl flex items-center justify-center text-blurple">
              <Info className="w-6 h-6" />
            </div>
            <div>
              <p className="text-snow text-sm font-medium mb-1">Auto-Penghapusan</p>
              <p className="text-fog text-xs leading-relaxed">Semua data terhapus otomatis setelah 2 jam atau saat sesi ditutup.</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 shrink-0 bg-blurple/10 rounded-xl flex items-center justify-center text-blurple">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-snow text-sm font-medium mb-1">Akses Terbatas</p>
              <p className="text-fog text-xs leading-relaxed">Kode ruangan adalah satu-satunya akses. Pastikan kodenya hanya untuk kalian.</p>
            </div>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-full bg-blurple hover:bg-dark-blurple font-headline font-bold text-snow py-4 rounded-xl transition-colors cursor-pointer"
        >
          Selesai
        </button>
      </motion.div>
    </div>
  );
}
