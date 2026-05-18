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
  Radio,
  Trash2,
  Image as ImageIcon,
  Camera,
  Heart,
  Tv,
  Maximize
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
// Letakkan file mp3 Anda di folder: public/audio/
// Contoh: public/audio/track1.mp3 -> audioUrl: "/audio/track1.mp3"
const PLAYLIST: Track[] = [
  { 
    title: "Bayangkan", 
    artist: "Hindia", 
    duration: "4:00", 
    totalSeconds: 240,
    audioUrl: "/audio/Bayangkan_spotdown.org.mp3" 
  },
  { 
    title: "Firasat", 
    artist: "Marcell", 
    duration: "4:00", 
    totalSeconds: 240,
    audioUrl: "/audio/Firasat_spotdown.org.mp3" 
  },
  { 
    title: "Untitled", 
    artist: "Maliq & D'Essentials", 
    duration: "4:00", 
    totalSeconds: 240,
    audioUrl: "/audio/Untitled_spotdown.org.mp3" 
  },
  { 
    title: "Rayuan Perempuan Gila", 
    artist: "Nadin Amizah", 
    duration: "4:00", 
    totalSeconds: 240,
    audioUrl: "/audio/Rayuan Perempuan Gila_spotdown.org.mp3" 
  },
  { 
    title: "Senja Teduh Pelita", 
    artist: "Maliq & D'Essentials", 
    duration: "4:00", 
    totalSeconds: 240,
    audioUrl: "/audio/Senja Teduh Pelita_spotdown.org.mp3" 
  },
  { 
    title: "Laskar Pelangi", 
    artist: "Nidji", 
    duration: "4:00", 
    totalSeconds: 240,
    audioUrl: "/audio/Laskar Pelangi_spotdown.org.mp3" 
  },
  { 
    title: "Sempurna", 
    artist: "Andra & The Backbone", 
    duration: "4:00", 
    totalSeconds: 240,
    audioUrl: "/audio/Sempurna_spotdown.org.mp3" 
  },
  { 
    title: "Kau Masih Kekasihku", 
    artist: "NaFF", 
    duration: "4:00", 
    totalSeconds: 240,
    audioUrl: "/audio/Kau Masih Kekasihku_spotdown.org.mp3" 
  },
  { 
    title: "Kita Ke Sana", 
    artist: "Hindia", 
    duration: "4:00", 
    totalSeconds: 240,
    audioUrl: "/audio/Kita Ke Sana_spotdown.org.mp3" 
  },
  { 
    title: "Tarot", 
    artist: ".Feast", 
    duration: "4:00", 
    totalSeconds: 240,
    audioUrl: "/audio/Tarot_spotdown.org.mp3" 
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
  const [user, setUser] = useState<any>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
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
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isWatchTogetherOpen, setIsWatchTogetherOpen] = useState(false);
  const [legacySettings, setLegacySettings] = useState<{isEnabled: boolean, ownerId: string, personaPrompt: string}>({
    isEnabled: false,
    ownerId: '',
    personaPrompt: ''
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  // Audio Player Sync
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }

    const audio = audioRef.current;

    const handleEnded = () => {
      if (roomHostId === user?.uid) {
        const activePlaylist = (window as any)._activePlaylist || PLAYLIST;
        const nextIndex = (currentTrackIndex + 1) % activePlaylist.length;
        console.log("Track ended, syncing next track:", nextIndex);
        syncMusic({ 
          currentTrackIndex: nextIndex, 
          progress: 0, 
          isPlaying: true 
        });
      }
    };

    const handleTimeUpdate = () => {
      // Only the host should push major time updates to Firestore occasionally
      // Everyone updates local state for UI
      setMusicProgress(audio.currentTime);
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [currentTrackIndex, user?.uid, roomHostId, roomCode]);

  // Handle source changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const activePlaylist = (window as any)._activePlaylist || PLAYLIST;
    const currentTrack = activePlaylist[currentTrackIndex] || activePlaylist[0];
    const targetSrc = new URL(currentTrack.audioUrl, window.location.origin).href;

    if (audio.src !== targetSrc) {
      console.log("Loading new source:", targetSrc);
      audio.src = currentTrack.audioUrl;
      audio.load();
      
      const handleCanPlay = () => {
        if (isPlaying) {
          audio.currentTime = musicProgress;
          audio.play().catch(e => console.warn("Initial playback failed:", e));
        }
        audio.removeEventListener('canplay', handleCanPlay);
      };
      audio.addEventListener('canplay', handleCanPlay);
    }
  }, [currentTrackIndex]);

  // Handle play/pause state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;

    if (isPlaying) {
      if (audio.paused) {
        audio.play().catch(e => console.warn("Resume failed:", e));
      }
    } else {
      if (!audio.paused) {
        audio.pause();
      }
    }
  }, [isPlaying]);

  // Handle significant progress jumps (sync from remote)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src || !isPlaying) return;

    const diff = Math.abs(audio.currentTime - musicProgress);
    if (diff > 4) {
      console.log("Significant drift detected, syncing time:", diff);
      audio.currentTime = musicProgress;
    }
  }, [musicProgress, isPlaying]);

  // Occasional Firestore sync for host
  useEffect(() => {
    if (appState !== 'chat' || !isPlaying || user?.uid !== roomHostId) return;

    const interval = setInterval(() => {
      if (audioRef.current) {
        syncMusic({ progress: audioRef.current.currentTime });
      }
    }, 5000); // Sync progress to Firestore every 5 seconds

    return () => clearInterval(interval);
  }, [appState, isPlaying, user?.uid, roomHostId, roomCode]);

  // Volume Sync
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  // Initialize Auth & Listen for state changes
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setUser(u);
      if (u) setAuthError(null);
    });

    initAuth().catch(err => {
      console.warn("Auto-login failed:", err);
      // We don't set authError here to avoid scaring the user, 
      // but we log it if Google login fails later.
    });

    return unsub;
  }, []);

  // Presence Tracking
  useEffect(() => {
    if (appState !== 'chat' || !user) return;

    const presenceRef = doc(db, `rooms/${roomCode}/presence/${user.uid}`);
    
    const updatePresence = async (typing = false) => {
      try {
        await setDoc(presenceRef, {
          userId: user.uid,
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
    if (appState !== 'chat' || !user) return;

    const uid = user.uid;

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
      const now = new Date().getTime();
      const partners = snapshot.docs
        .map(doc => {
          const data = doc.data();
          // Convert Firestore Timestamp to Date
          const lastSeenDate = data.lastSeen?.toDate?.() || new Date();
          return { ...data, lastSeenDate } as PresenceData & { lastSeenDate: Date };
        })
        .filter(p => {
          const isOther = p.userId !== uid;
          const isRecentlyActive = (now - p.lastSeenDate.getTime()) < 60000; // 1 minute
          return isOther && isRecentlyActive;
        });
      
      if (partners.length > 0) {
        setPartnerPresence(partners[0]);
      } else {
        setPartnerPresence(null);
      }
    });

    // 3. Music Listener
    let lastKnownIndex = -1;
    const musicUnsub = onSnapshot(doc(db, `rooms/${roomCode}/music/current`), (snapshot) => {
      // Don't sync from Firestore if we have pending local writes (avoids feedback loops/flickering)
      if (snapshot.metadata.hasPendingWrites) return;

      if (snapshot.exists()) {
        const data = snapshot.data();
        
        const newIndex = data.currentTrackIndex;
        const newIsPlaying = data.isPlaying;
        const newProgress = data.progress;

        if (newIndex !== lastKnownIndex) {
          lastKnownIndex = newIndex;
          setCurrentTrackIndex(newIndex);
          setMusicProgress(newProgress);
        } else {
          // Significant jump logic - use a larger threshold (10s) and only sync if not host
          // or if the host truly was out of sync (rare)
          setMusicProgress(prev => {
            const drift = Math.abs(newProgress - prev);
            // If the host is the one receiving this, they shouldn't usually jump 
            // unless they reset the track globally.
            if (drift > 12) {
              console.log("Remote sync: forcing jump due to drift:", drift);
              return newProgress;
            }
            return prev;
          });
        }
        
        setIsPlaying(newIsPlaying);
      }
    });

    // 4. Room Metadata (Timer sync and Deletion check)
    const roomSnap = onSnapshot(doc(db, `rooms/${roomCode}`), (snapshot) => {
      // Remove hasPendingWrites check to ensure local optimistic updates are reflected immediately
      if (snapshot.exists()) {
        const data = snapshot.data();
        setRoomHostId(data.hostId);
        if (data.legacySettings) {
          setLegacySettings(data.legacySettings);
        } else {
          // Reset to default if not present
          setLegacySettings({ isEnabled: false, ownerId: '', personaPrompt: '' });
        }
        const expiresAt = (data.expiresAt as Timestamp).toDate();
        const now = new Date();
        const diff = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
        setTimeLeft(diff);
      } else if (appState === 'chat') {
        // Room was deleted
        setAppState('end');
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
    if (!nickname.trim() || roomCode.trim().length !== 6) {
      alert("Masukkan nickname dan 6 digit kode ruangan.");
      return;
    }

    if (!user) {
      setAuthError("Harap login terlebih dahulu.");
      return;
    }

    try {
      const roomRef = doc(db, `rooms/${roomCode}`);
      const snap = await getDoc(roomRef);
      
      if (!snap.exists()) {
        // Create Room
        await setDoc(roomRef, {
          hostId: user.uid,
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

  const triggerLegacyAI = async (lastUserText: string) => {
    setIsTyping(true);
    try {
      // Use partnerPresence if available
      const partnerName = partnerPresence?.nickname || 'Pasanganmu';

      const chatHistory = messages.slice(-10).map(m => ({
        role: (m.senderId === 'legacy-ai' || (m.senderId !== user?.uid && m.senderId !== 'system')) ? 'model' : 'user',
        parts: [{ text: m.text }]
      }));

      // Add current message if not empty
      if (lastUserText && !chatHistory.some(h => h.parts[0].text === lastUserText)) {
        chatHistory.push({ role: 'user', parts: [{ text: lastUserText }] });
      }

      const response = await axios.post('/api/chat/legacy', {
        messages: chatHistory,
        personaPrompt: legacySettings.personaPrompt,
        partnerNickname: partnerName
      });

      if (response.data.text) {
        await addDoc(collection(db, `rooms/${roomCode}/messages`), {
          senderId: 'legacy-ai',
          nickname: partnerName,
          text: response.data.text,
          timestamp: serverTimestamp(),
          type: 'chat'
        });
      }
    } catch (err: any) {
      console.error("Legacy AI Error:", err);
      // If error is from server and mentions leaked key or other specific issues
      const serverError = err.response?.data;
      if (serverError?.isLeaked) {
        await addDoc(collection(db, `rooms/${roomCode}/messages`), {
          senderId: 'system',
          nickname: 'Sistem',
          text: '⚠️ [Error] API Key AI terdeteksi bermasalah (Leaked). Hubungi developer atau perbarui kunci di AI Studio.',
          timestamp: serverTimestamp(),
          type: 'system'
        });
      }
    } finally {
      setIsTyping(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !user) return;
    
    const text = inputMessage;
    setInputMessage('');

    try {
      await addDoc(collection(db, `rooms/${roomCode}/messages`), {
        senderId: user.uid,
        nickname,
        text,
        timestamp: serverTimestamp(),
        type: 'chat'
      });

      // Trigger Legacy AI if partner is offline and legacy mode is enabled
      console.log("Checking Legacy AI trigger:", {
        partnerPresence: !!partnerPresence,
        legacyEnabled: legacySettings.isEnabled,
        userUid: user.uid,
        ownerId: legacySettings.ownerId
      });

      if (!partnerPresence && legacySettings.isEnabled) {
        triggerLegacyAI(text);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `rooms/${roomCode}/messages`);
    }
  };

  const syncMusic = async (updates: any) => {
    // Optimistic local update
    if (updates.isPlaying !== undefined) setIsPlaying(updates.isPlaying);
    if (updates.currentTrackIndex !== undefined) setCurrentTrackIndex(updates.currentTrackIndex);
    if (updates.progress !== undefined) setMusicProgress(updates.progress);

    try {
      console.log("Syncing music updates:", updates);
      await updateDoc(doc(db, `rooms/${roomCode}/music/current`), {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Music sync failed:", err);
      // Revert if failed? (Optional, but good for UX)
    }
  };

  const handleSignOut = async () => {
    try {
      if (roomCode && user) {
        const presenceRef = doc(db, `rooms/${roomCode}/presence/${user.uid}`);
        await deleteDoc(presenceRef);
      }
      await auth.signOut();
      setAppState('end');
    } catch (err) {
      console.error("Sign out fail:", err);
      setAppState('end');
    }
  };

  const handleDissolveRoom = async () => {
    if (!roomCode || user?.uid !== roomHostId) return;
    
    if (confirm("Apakah Anda yakin ingin membubarkan ruangan ini? Semua data akan hilang untuk semua orang.")) {
      try {
        await deleteDoc(doc(db, `rooms/${roomCode}`));
        setAppState('end');
      } catch (err) {
        console.error("Dissolve room failed:", err);
        alert("Gagal membubarkan ruangan.");
      }
    }
  };

  if (appState === 'end') {
    return (
      <div className="min-h-screen bg-neo-yellow flex items-center justify-center p-6 text-center">
        <div className="max-w-md bg-neo-white border-4 border-neo-black p-10 shadow-neo-lg rounded-none">
          <h1 className="font-headline font-black text-5xl mb-6 text-neo-black tracking-tighter uppercase leading-none italic">
            SESI SELESAI!
          </h1>
          <p className="text-neo-black font-bold text-xl mb-10 leading-tight">
            Semua pesan telah dihancurkan. Tidak ada jejak yang tersisa. 💥
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-neo-pink text-neo-black border-4 border-neo-black shadow-neo font-black py-5 uppercase text-xl hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-neo-lg transition-all cursor-pointer active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            Mulai Ulang
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans bg-neo-yellow overflow-hidden text-neo-black">
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
            user={user}
            authError={authError}
            setAuthError={setAuthError}
          />
        ) : (
          <div className="h-screen flex flex-col relative bg-neo-yellow p-2 sm:p-4">
            {/* Top Bar */}
            <div className="bg-neo-white border-4 border-neo-black px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between z-10 shrink-0 shadow-neo mb-2 sm:mb-4">
              <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 border-2 sm:border-4 border-neo-black bg-neo-pink flex items-center justify-center text-neo-black font-black text-lg sm:text-xl shadow-neo-sm">
                  {(partnerPresence?.nickname?.[0] || 'P').toUpperCase()}
                </div>
                <div className="overflow-hidden">
                  <h3 className="text-neo-black font-black text-sm sm:text-lg leading-none uppercase italic truncate">
                    {partnerPresence?.nickname || 'Menunggu...'}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`w-2.5 h-2.5 sm:w-3 sm:h-3 border-2 border-neo-black shadow-neo-sm ${partnerPresence ? 'bg-neo-green' : 'bg-gray-400'}`}></span>
                    <span className="text-neo-black font-bold text-[10px] sm:text-xs uppercase">{partnerPresence ? 'Online' : 'Offline'}</span>
                  </div>
                </div>
              </div>

              <div className="hidden md:flex items-center gap-6">
                <span className="px-4 py-2 bg-neo-cyan border-2 border-neo-black shadow-neo-sm text-neo-black text-sm font-black uppercase italic">
                  ID: {roomCode}
                </span>
                <div className="bg-neo-black text-neo-white px-4 py-2 shadow-neo-sm font-mono text-lg font-black tabular-nums">
                  {formatTimer(timeLeft)}
                </div>
              </div>

              <div className="flex gap-2 sm:gap-3">
                <button 
                  onClick={() => setIsGalleryOpen(true)}
                  title="Galeri"
                  className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-neo-green border-2 sm:border-4 border-neo-black shadow-neo-sm text-neo-black hover:bg-neo-cyan transition-all cursor-pointer active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
                >
                  <ImageIcon className="w-5 h-5 sm:w-6 sm:h-6 stroke-[3px]" />
                </button>
                <button 
                  onClick={() => setIsWatchTogetherOpen(true)}
                  title="Nonton Bareng"
                  className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-neo-cyan border-2 sm:border-4 border-neo-black shadow-neo-sm text-neo-black hover:bg-neo-pink transition-all cursor-pointer active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
                >
                  <Tv className="w-5 h-5 sm:w-6 sm:h-6 stroke-[3px]" />
                </button>
                <button 
                  onClick={() => setIsMusicPanelOpen(true)}
                  title="Musik"
                  className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center border-2 sm:border-4 border-neo-black shadow-neo-sm text-neo-black transition-all cursor-pointer active:shadow-none active:translate-x-[2px] active:translate-y-[2px] relative ${
                    isPlaying 
                      ? 'bg-neo-pink hover:bg-neo-cyan animate-pulse' 
                      : 'bg-neo-yellow hover:bg-neo-cyan'
                  }`}
                >
                  <Music className={`w-5 h-5 sm:w-6 sm:h-6 stroke-[3px] ${isPlaying ? 'animate-bounce' : ''}`} />
                  {isPlaying && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-neo-green border-2 border-neo-black rounded-full"></span>
                  )}
                </button>
                <button 
                  onClick={() => setIsSecurityModalOpen(true)}
                  title="Keamanan"
                  className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-neo-yellow border-2 sm:border-4 border-neo-black shadow-neo-sm text-neo-black hover:bg-neo-cyan transition-all cursor-pointer active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
                >
                  <Lock className="w-5 h-5 sm:w-6 sm:h-6 stroke-[3px]" />
                </button>
                {user?.uid === roomHostId && (
                  <button 
                    onClick={handleDissolveRoom}
                    title="Bubarkan"
                    className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-red-400 border-2 sm:border-4 border-neo-black shadow-neo-sm text-neo-black hover:bg-red-500 transition-all cursor-pointer active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
                  >
                    <Trash2 className="w-5 h-5 sm:w-6 sm:h-6 stroke-[3px]" />
                  </button>
                )}
                <button 
                  onClick={handleSignOut}
                  title="Keluar"
                  className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-neo-white border-2 sm:border-4 border-neo-black shadow-neo-sm text-neo-black hover:bg-neo-pink transition-all cursor-pointer active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
                >
                  <LogOut className="w-5 h-5 sm:w-6 sm:h-6 stroke-[3px]" />
                </button>
              </div>
            </div>

            {/* Content Area (Messages + Sidebar) */}
            <div className="flex-1 flex gap-2 sm:gap-4 overflow-hidden mb-2 sm:mb-4">
              {/* Message Area */}
              <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-4 sm:gap-6 scrollbar-hide bg-neo-white border-4 border-neo-black shadow-neo relative"
              >
                {messages.map((msg) => (
                  msg.sender === 'system' ? (
                    <div key={msg.id} className="flex justify-center my-2 sm:my-4">
                      <span className="bg-neo-cyan/20 border-2 border-neo-black text-neo-black text-[10px] sm:text-xs font-black px-4 sm:px-6 py-1.5 sm:py-2 shadow-neo-sm uppercase italic">
                        {msg.text}
                      </span>
                    </div>
                  ) : (
                    <div 
                      key={msg.id} 
                      className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'} max-w-[90%] sm:max-w-[85%] ${msg.sender === 'me' ? 'ml-auto' : ''}`}
                    >
                      <span className="text-neo-black font-black text-[10px] sm:text-xs mb-1 sm:mb-2 px-1 uppercase tracking-tight italic flex items-center gap-1">
                        {msg.nickname} <span className="text-[9px] sm:text-[10px] opacity-40 font-mono">[{msg.timestamp}]</span>
                      </span>
                      <div className={`px-4 sm:px-6 py-2.5 sm:py-4 border-2 sm:border-4 border-neo-black shadow-neo text-sm sm:text-lg font-bold leading-tight ${
                        msg.sender === 'me' 
                          ? 'bg-neo-pink text-neo-black' 
                          : 'bg-neo-cyan text-neo-black'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  )
                ))}

                {partnerPresence?.isTyping && (
                  <div className="flex flex-col items-start mt-2">
                    <span className="text-neo-black font-black text-[10px] sm:text-xs mb-1 px-1 uppercase italic">{partnerPresence.nickname} Mengetik...</span>
                    <div className="bg-neo-white border-2 sm:border-4 border-neo-black shadow-neo-sm px-4 sm:px-6 py-2 sm:py-3 flex gap-1.5 sm:gap-2">
                      <div className="w-2 h-2 sm:w-3 sm:h-3 bg-neo-black rounded-full animate-bounce-dots"></div>
                      <div className="w-2 h-2 sm:w-3 sm:h-3 bg-neo-black rounded-full animate-bounce-dots delay-150"></div>
                      <div className="w-2 h-2 sm:w-3 sm:h-3 bg-neo-black rounded-full animate-bounce-dots delay-300"></div>
                    </div>
                  </div>
                )}

                {isTyping && (
                  <div className="flex flex-col items-start mt-2">
                    <span className="text-neo-black font-black text-[10px] sm:text-xs mb-1 px-1 uppercase italic">Lestari AI Mengetik...</span>
                    <div className="bg-neo-white border-2 sm:border-4 border-neo-black shadow-neo-sm px-4 sm:px-6 py-2 sm:py-3 flex gap-1.5 sm:gap-2">
                      <div className="w-2 h-2 sm:w-3 sm:h-3 bg-neo-black rounded-full animate-bounce-dots"></div>
                      <div className="w-2 h-2 sm:w-3 sm:h-3 bg-neo-black rounded-full animate-bounce-dots delay-150"></div>
                      <div className="w-2 h-2 sm:w-3 sm:h-3 bg-neo-black rounded-full animate-bounce-dots delay-300"></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Input Area */}
            <div className="bg-neo-white border-t-8 border-neo-black p-3 sm:p-6 shrink-0 relative">
              {/* Decorative accent */}
              <div className="hidden lg:block absolute -top-8 left-10 bg-neo-cyan border-4 border-neo-black px-4 py-1 font-black italic uppercase text-xs shadow-neo-sm">
                Secure Transmission Line
              </div>
              
              <div className="max-w-6xl mx-auto flex items-end gap-3 sm:gap-4 px-1 sm:px-2">
                <button className="p-2 text-neo-black hover:text-neo-pink transition-all cursor-pointer group active:scale-90">
                  <Smile className="w-10 h-10 sm:w-12 sm:h-12 stroke-[4px] group-active:scale-110" />
                </button>
                <div className="flex-1 relative">
                  <textarea 
                    ref={textareaRef}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="TULIS PESAN RAHASIA..."
                    className="w-full bg-neo-white text-neo-black border-4 border-neo-black p-4 sm:p-5 pr-12 focus:outline-none resize-none max-h-40 text-lg sm:text-xl font-black placeholder:text-neutral-400 shadow-neo focus:shadow-neo-lg transition-all uppercase italic"
                    rows={1}
                  />
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-20 pointer-events-none hidden sm:flex">
                    <div className="w-1 h-1 bg-neo-black rounded-full"></div>
                    <div className="w-1 h-1 bg-neo-black rounded-full"></div>
                    <div className="w-1 h-1 bg-neo-black rounded-full"></div>
                  </div>
                </div>
                <button 
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim()}
                  className="w-14 h-14 sm:w-20 sm:h-20 shrink-0 bg-neo-green hover:bg-neo-green/90 disabled:opacity-50 text-neo-black border-4 border-neo-black flex items-center justify-center transition-all cursor-pointer shadow-neo hover:translate-x-[-2px] hover:translate-y-[-2px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  <Send className="w-8 h-8 sm:w-10 sm:h-10 stroke-[4px] text-neo-black fill-neo-black" />
                </button>
              </div>
            </div>

            {/* Music Overlay */}
            <AnimatePresence>
              {isMusicPanelOpen && (
                <MusicPanel 
                  onClose={() => setIsMusicPanelOpen(false)}
                  currentTrackIndex={currentTrackIndex}
                  onTrackChange={(idx: number) => {
                    if (audioRef.current) {
                      audioRef.current.currentTime = 0;
                      if (isPlaying) audioRef.current.play().catch(() => {});
                    }
                    syncMusic({ currentTrackIndex: idx, progress: 0 });
                  }}
                  isPlaying={isPlaying}
                  onTogglePlay={() => {
                    const nextPlaying = !isPlaying;
                    const currentProgress = audioRef.current?.currentTime || 0;
                    if (audioRef.current) {
                      if (nextPlaying) {
                        // Crucial: sync time before playing to avoid jumping
                        audioRef.current.currentTime = musicProgress;
                        audioRef.current.play().catch(e => console.warn("Direct play failed:", e));
                      } else {
                        audioRef.current.pause();
                      }
                    }
                    syncMusic({ isPlaying: nextPlaying, progress: currentProgress });
                  }}
                  progress={musicProgress}
                  volume={volume}
                  setVolume={setVolume}
                  roomCode={roomCode}
                  isHost={user?.uid === roomHostId}
                />
              )}
            </AnimatePresence>

            {/* Security Modal */}
            <AnimatePresence>
              {isSecurityModalOpen && (
                <SecurityModal 
                  onClose={() => setIsSecurityModalOpen(false)} 
                  legacySettings={legacySettings}
                  roomCode={roomCode}
                  user={user}
                />
              )}
            </AnimatePresence>

            {/* Gallery Panel */}
            <AnimatePresence>
              {isGalleryOpen && (
                <GalleryPanel 
                  onClose={() => setIsGalleryOpen(false)} 
                  roomCode={roomCode}
                  user={user}
                  nickname={nickname}
                />
              )}
            </AnimatePresence>

            {/* Watch Together Panel */}
            <AnimatePresence>
              {isWatchTogetherOpen && (
                <WatchTogetherPanel 
                  onClose={() => setIsWatchTogetherOpen(false)}
                  roomCode={roomCode}
                  user={user}
                  nickname={nickname}
                />
              )}
            </AnimatePresence>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Subcomponents ---

function JoinScreen({ nickname, setNickname, roomCode, setRoomCode, onJoin, user, authError, setAuthError }: any) {
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-blocked') {
        setAuthError("Popup terblokir. Harap izinkan popup di browser Anda.");
      } else {
        setAuthError(err.message || "Gagal masuk dengan Google.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-neo-yellow flex flex-col items-center justify-center p-6 relative overflow-hidden"
    >
      <div className="z-10 text-center mb-8 sm:mb-12">
        <h1 className="font-headline font-black text-[48px] sm:text-[80px] leading-none text-neo-black tracking-[-0.05em] uppercase mb-4 italic transform -rotate-1 drop-shadow-neo">
          DEEPTALK
        </h1>
        <p className="font-sans font-black bg-neo-pink text-neo-black px-3 py-1.5 sm:px-4 sm:py-2 border-2 sm:border-4 border-neo-black shadow-neo-sm transform rotate-1 uppercase text-sm sm:text-lg inline-block">
          ruang jujur untuk kalian berdua
        </p>
      </div>

      <div className="w-full max-w-[460px] bg-neo-white border-4 sm:border-8 border-neo-black p-6 sm:p-10 shadow-neo-lg z-10">
        <div className="space-y-6 sm:space-y-8">
          {authError && (
            <div className="bg-red-400 border-2 sm:border-4 border-neo-black p-3 sm:p-4 shadow-neo-sm flex items-center gap-2 sm:gap-3">
              <span className="text-xl sm:text-2xl">⚠️</span>
              <p className="text-neo-black font-black uppercase text-xs sm:text-sm italic">
                {authError}
              </p>
            </div>
          )}

          {user ? (
            <div className="bg-neo-green border-2 sm:border-4 border-neo-black p-3 sm:p-4 shadow-neo-sm flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 border-2 sm:border-4 border-neo-black bg-neo-yellow flex items-center justify-center text-neo-black font-black text-base sm:text-lg">
                {(user.displayName?.[0] || 'U').toUpperCase()}
              </div>
              <div className="text-left overflow-hidden">
                <p className="text-neo-black font-black text-[10px] sm:text-xs uppercase italic opacity-60 leading-none mb-1">Terhubung Sebagai</p>
                <p className="text-neo-black text-sm sm:text-lg font-black truncate leading-none uppercase">{user.displayName || user.email || "User Anonim"}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              <button 
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="w-full bg-neo-cyan text-neo-black border-2 sm:border-4 border-neo-black font-black py-3 sm:py-4 flex items-center justify-center gap-3 sm:gap-4 transition-all cursor-pointer shadow-neo hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-neo-lg active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                {isLoggingIn ? <span className="uppercase text-lg sm:text-xl italic font-black">Menghubungkan...</span> : (
                  <>
                    <svg className="w-6 h-6 sm:w-8 sm:h-8" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    <span className="uppercase text-lg sm:text-xl italic font-black">Masuk Google</span>
                  </>
                )}
              </button>
              <div className="flex items-center gap-4 sm:gap-6 my-1">
                <div className="h-1.5 flex-1 bg-neo-black"></div>
                <span className="text-neo-black font-black uppercase text-base sm:text-lg italic">ATAU</span>
                <div className="h-1.5 flex-1 bg-neo-black"></div>
              </div>
            </div>
          )}

          <div className="space-y-4 sm:space-y-6">
            <div className="relative">
              <label className="block text-xs sm:text-sm font-black text-neo-black uppercase italic mb-2 px-1">
                Nickname Kamu
              </label>
              <div className="relative">
                <input 
                  type="text" 
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Panggilan kesayangan..."
                  className="w-full bg-neo-white text-neo-black border-2 sm:border-4 border-neo-black p-3 sm:p-5 focus:outline-none focus:bg-neo-yellow transition-all font-black text-base sm:text-lg placeholder:text-gray-400 shadow-neo-sm focus:shadow-neo"
                />
                {user && nickname === "" && (
                  <button 
                    onClick={() => setNickname(user.displayName?.split(' ')[0] || '')}
                    className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-[10px] sm:text-xs bg-neo-pink text-neo-black font-black px-2 sm:px-3 py-1 sm:py-1.5 border-2 border-neo-black hover:bg-neo-cyan cursor-pointer uppercase italic shadow-neo-sm transform hover:scale-105 transition-all"
                  >
                    Pakai Google
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="relative">
            <label className="block text-xs sm:text-sm font-black text-neo-black uppercase italic mb-2 px-1 text-center">
              Kode Ruangan (6-Digit)
            </label>
            <input 
              type="text" 
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 6))}
              className="w-full bg-neo-white text-neo-black border-2 sm:border-4 border-neo-black p-3 sm:p-5 text-center text-3xl sm:text-4xl font-black tracking-[0.2em] uppercase focus:outline-none focus:bg-neo-cyan transition-all shadow-neo-sm focus:shadow-neo"
              maxLength={6}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-5 pt-2 sm:pt-4">
            <button 
              onClick={onJoin}
              className="w-full bg-neo-pink text-neo-black border-2 sm:border-4 border-neo-black font-black py-4 sm:py-5 uppercase text-xl sm:text-2xl shadow-neo hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-neo-lg transition-all cursor-pointer active:translate-x-[2px] active:translate-y-[2px] active:shadow-none italic"
            >
              Masuk Sekarang!
            </button>
            <button 
              onClick={() => setRoomCode(generateCode())}
              className="w-full bg-neo-yellow text-neo-black border-2 sm:border-4 border-neo-black font-black py-3 sm:py-4 uppercase text-base sm:text-lg shadow-neo hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-neo-lg transition-all cursor-pointer active:translate-x-[2px] active:translate-y-[2px] active:shadow-none italic"
            >
              Acak Kode Baru
            </button>
          </div>

          <div className="bg-neo-black p-3 sm:p-4 shadow-neo-sm -rotate-1 border-2 sm:border-4 border-neo-black">
            <p className="text-neo-white text-[10px] sm:text-sm font-black italic text-center uppercase tracking-wider">
              🛑 Pesan Otomatis Meledak dalam 2 Jam 🛑
            </p>
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
      className="absolute bottom-0 left-0 right-0 h-[95vh] bg-neo-yellow rounded-none border-t-8 border-neo-black shadow-2xl z-20 flex flex-col p-2 sm:p-8"
    >
      <div className="bg-neo-black h-full flex flex-col p-1 sm:p-4 shadow-neo-lg relative overflow-hidden border-4 sm:border-8 border-neo-black">
        <div className="bg-neo-white h-full flex flex-col p-4 sm:p-8 relative overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 sm:mb-8 border-b-4 sm:border-b-8 border-neo-black pb-4 sm:pb-6 relative shrink-0">
            <div className="absolute -top-12 -left-8 w-24 h-24 bg-neo-yellow/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="flex flex-col relative z-10">
              <h2 className="font-headline font-black text-2xl sm:text-5xl text-neo-black uppercase italic transform -rotate-2 drop-shadow-neo-sm leading-none mb-1">
                RADIO NEON 📻
              </h2>
              <div className="flex items-center gap-2">
                <span className="animate-pulse w-2.5 h-2.5 sm:w-3 sm:h-3 bg-red-600 border-2 border-neo-black rounded-full shadow-neo-sm"></span>
                <span className="text-[9px] sm:text-xs bg-neo-black text-neo-white font-black uppercase italic px-2 py-0.5 border-2 border-neo-black inline-block w-fit">
                  LIVE CONTROL
                </span>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 sm:w-16 sm:h-16 bg-neo-pink border-4 border-neo-black shadow-neo-sm flex items-center justify-center text-neo-black hover:bg-neo-cyan transition-all cursor-pointer active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              <ChevronDown className="w-6 h-6 sm:w-10 sm:h-10 stroke-[3px] sm:stroke-[4px]" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 sm:pr-4 scrollbar-hide">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 sm:gap-12 pb-12 items-start">
              {/* Left side: Now Playing (Hero) */}
              <div className="lg:col-span-3 space-y-6 sm:space-y-8">
                <div className="bg-neo-white border-4 sm:border-8 border-neo-black p-4 sm:p-10 shadow-neo relative overflow-hidden group">
                  {/* Retro Pattern Background */}
                  <div className="absolute inset-0 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                    <div className="w-full h-full bg-[radial-gradient(circle,black_2px,transparent_2px)] bg-[size:24px_24px]"></div>
                  </div>
                  
                  {isHost && (
                    <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-10 relative z-10">
                      <div className="flex-1 flex flex-col gap-1">
                        <span className="text-[9px] sm:text-[10px] font-black uppercase italic opacity-50 ml-1">Mic Intro</span>
                        <button 
                          onClick={() => handleTriggerEffect('opening')}
                          disabled={isEffectPlaying}
                          className="w-full bg-neo-yellow border-2 sm:border-4 border-neo-black shadow-neo-sm font-black py-3 sm:py-4 uppercase italic hover:bg-neo-green transition-all text-xs sm:text-base active:translate-y-1 active:shadow-none"
                        >
                          OPEN 🎙️
                        </button>
                      </div>
                      <div className="flex-1 flex flex-col gap-1">
                        <span className="text-[9px] sm:text-[10px] font-black uppercase italic opacity-50 ml-1">Mic Outro</span>
                        <button 
                          onClick={() => handleTriggerEffect('closing')}
                          disabled={isEffectPlaying}
                          className="w-full bg-neo-pink border-2 sm:border-4 border-neo-black shadow-neo-sm font-black py-3 sm:py-4 uppercase italic hover:bg-neo-green transition-all text-xs sm:text-base active:translate-y-1 active:shadow-none"
                        >
                          CLOSE 🎙️
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="relative z-10 space-y-8 sm:space-y-12">
                    <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
                      {/* Album Art Placeholder / Visualizer */}
                      <div className="w-40 h-40 sm:w-64 sm:h-64 bg-neo-black border-4 sm:border-8 border-neo-black shadow-neo shrink-0 relative overflow-hidden flex items-center justify-center p-3 sm:p-4 group/vinyl">
                        {/* Vinyl Record Visual */}
                        <div className={`absolute inset-0 border-4 sm:border-8 border-neo-black rounded-full overflow-hidden transition-transform duration-1000 ${isPlaying ? 'animate-spin-slow' : ''}`}>
                          <div className="absolute inset-0 bg-neutral-900 flex items-center justify-center">
                            {[...Array(12)].map((_, i) => (
                              <div 
                                key={i} 
                                className="absolute border border-white/5 rounded-full" 
                                style={{ 
                                  width: `${100 - i * 8}%`, 
                                  height: `${100 - i * 8}%` 
                                }}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="absolute inset-0 opacity-20 flex items-center justify-center gap-1 pointer-events-none">
                          {[...Array(6)].map((_, i) => (
                            <motion.div 
                              key={i}
                              animate={{ height: isPlaying ? [10, 100, 30, 80, 10] : 10 }}
                              transition={{ duration: 1, repeat: Infinity, delay: i * 0.1 }}
                              className="w-2 sm:w-3 bg-neo-cyan"
                            />
                          ))}
                        </div>

                        <div className="relative z-10 w-20 h-20 sm:w-28 sm:h-28 bg-neo-yellow rounded-full border-4 border-neo-black flex items-center justify-center shadow-inner overflow-hidden">
                           <div className="absolute inset-0 bg-[radial-gradient(circle,black_1px,transparent_1px)] bg-[size:10px_10px] opacity-10"></div>
                           <Music className={`w-8 h-8 sm:w-12 sm:h-12 text-neo-black ${isPlaying ? 'animate-bounce' : ''}`} />
                           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-neo-black rounded-full border-2 border-neo-white/30"></div>
                        </div>
                      </div>

                      <div className="text-center sm:text-left flex-1 min-w-0">
                        <div className="inline-block bg-neo-cyan text-neo-black px-2 py-1 border-2 border-neo-black font-black uppercase text-[9px] sm:text-[10px] italic mb-2 sm:mb-4 shadow-neo-sm">
                          {isPlaying ? 'ON AIR' : 'PAUSED'}
                        </div>
                        <h3 className="text-neo-black font-black text-3xl sm:text-6xl uppercase italic leading-[1] sm:leading-[0.9] mb-2 sm:mb-4 drop-shadow-neo-sm line-clamp-2">
                          {currentTrack.title}
                        </h3>
                        <p className="text-neo-black font-black text-lg sm:text-2xl italic opacity-70 uppercase tracking-tight">
                          {currentTrack.artist}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4 sm:space-y-6">
                      <div className="relative mt-4">
                        <div className="h-4 sm:h-6 bg-neo-black border-2 sm:border-4 border-neo-black shadow-neo-sm p-1 overflow-hidden">
                          <motion.div 
                            className="h-full bg-neo-green relative" 
                            style={{ width: `${(progress / (currentTrack.totalSeconds || 1)) * 100}%` }}
                          >
                            <div className="absolute top-0 right-0 bottom-0 w-2 bg-white/30"></div>
                          </motion.div>
                        </div>
                        <div className="flex justify-between font-black font-mono text-sm sm:text-2xl uppercase italic mt-2 sm:mt-4">
                          <span className="bg-neo-black text-neo-white px-2 py-0.5 sm:px-3 sm:py-1 border-2 border-neo-black">{formatTime(progress)}</span>
                          <span className="bg-neo-black text-neo-white px-2 py-0.5 sm:px-3 sm:py-1 border-2 border-neo-black">{currentTrack.duration}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-center gap-4 sm:gap-10 py-4 sm:py-6">
                        <button 
                          onClick={() => onTrackChange((currentTrackIndex - 1 + playlist.length) % playlist.length)}
                          className="w-12 h-12 sm:w-20 sm:h-20 bg-neo-white border-2 sm:border-4 border-neo-black shadow-neo flex items-center justify-center hover:bg-neo-yellow cursor-pointer active:translate-x-[2px] active:translate-y-[2px]"
                        >
                          <SkipBack className="w-6 h-6 sm:w-10 sm:h-10 stroke-[3px] sm:stroke-[4px]" />
                        </button>
                        <button 
                          onClick={onTogglePlay}
                          className="w-16 h-16 sm:w-32 sm:h-32 bg-neo-pink border-4 border-neo-black shadow-neo-lg flex items-center justify-center text-neo-black hover:bg-neo-green transition-all cursor-pointer active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
                        >
                          {isPlaying ? (
                            <Pause className="w-8 h-8 sm:w-16 sm:h-16 stroke-[3px] sm:stroke-[4px] fill-neo-black" />
                          ) : (
                            <Play className="w-8 h-8 sm:w-16 sm:h-16 stroke-[3px] sm:stroke-[4px] fill-neo-black translate-x-1 sm:translate-x-2" />
                          )}
                        </button>
                        <button 
                          onClick={() => onTrackChange((currentTrackIndex + 1) % playlist.length)}
                          className="w-12 h-12 sm:w-20 sm:h-20 bg-neo-white border-2 sm:border-4 border-neo-black shadow-neo flex items-center justify-center hover:bg-neo-yellow cursor-pointer active:translate-x-[2px] active:translate-y-[2px]"
                        >
                          <SkipForward className="w-6 h-6 sm:w-10 sm:h-10 stroke-[3px] sm:stroke-[4px]" />
                        </button>
                      </div>

                      <div className="flex items-center gap-4 sm:gap-6 bg-neo-black text-neo-white p-3 sm:p-6 border-2 sm:border-4 border-neo-black shadow-neo">
                        <Volume2 className="w-6 h-6 sm:w-10 sm:h-10 stroke-[3px] sm:stroke-[4px]" />
                        <div className="flex-1 relative h-6 sm:h-8 flex items-center">
                          <input 
                            type="range"
                            min="0"
                            max="100"
                            value={volume}
                            onChange={(e) => setVolume(Number(e.target.value))}
                            className="w-full h-2 sm:h-4 bg-neo-white border-2 border-neo-black appearance-none cursor-pointer accent-neo-pink [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 sm:[&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 sm:[&::-webkit-slider-thumb]:h-10 [&::-webkit-slider-thumb]:bg-neo-pink [&::-webkit-slider-thumb]:border-2 sm:[&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-neo-black [&::-webkit-slider-thumb]:shadow-neo-sm"
                          />
                        </div>
                        <span className="font-black font-mono text-lg sm:text-2xl w-10 sm:w-16 text-center">{volume}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right side: Playlist */}
              <div className="lg:col-span-2 flex flex-col h-full lg:max-h-full">
                <div className="relative mb-4 sm:mb-6 shrink-0">
                  <h4 className="font-black uppercase text-xl sm:text-3xl italic transform -rotate-1 inline-block bg-neo-green px-4 py-2 sm:px-6 sm:py-3 border-2 sm:border-4 border-neo-black shadow-neo relative z-10">
                    PLAYLIST 📼
                  </h4>
                  <div className="absolute top-1 sm:top-2 left-1 sm:left-2 w-full h-full bg-neo-black border-2 sm:border-4 border-neo-black -z-0"></div>
                </div>
                
                <div className="flex-1 space-y-3 sm:space-y-4 overflow-y-auto pr-1 sm:pr-4 scrollbar-hide py-2">
                  {playlist.map((track, index) => (
                    <div 
                      key={index}
                      className={`flex items-center gap-3 sm:gap-6 p-3 sm:p-4 border-2 sm:border-4 border-neo-black transition-all relative ${
                        index === currentTrackIndex 
                          ? 'bg-neo-yellow translate-x-1 sm:translate-x-3 shadow-neo' 
                          : 'bg-neo-white hover:bg-neo-cyan/20 translate-x-0 shadow-neo-sm'
                      }`}
                    >
                      <div className="flex flex-col items-center">
                        <span className="font-black text-lg sm:text-2xl italic font-mono w-6 sm:w-10 text-center">
                          {(index + 1).toString().padStart(2, '0')}
                        </span>
                        {index === currentTrackIndex && (
                          <motion.div 
                            animate={{ scale: [1, 1.2, 1] }} 
                            transition={{ repeat: Infinity, duration: 1 }}
                            className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-600 rounded-full border-2 border-neo-black mt-1"
                          />
                        )}
                      </div>
                      
                      <div 
                        className="flex-1 cursor-pointer overflow-hidden py-0.5 sm:py-1"
                        onClick={() => onTrackChange(index)}
                      >
                        <h5 className="font-black text-base sm:text-xl leading-tight uppercase truncate mb-0.5 sm:mb-1">
                          {track.title}
                        </h5>
                        <p className="font-bold text-[9px] sm:text-xs uppercase italic opacity-60 truncate">{track.artist}</p>
                      </div>

                      {isHost ? (
                        <div className="flex flex-col gap-1 sm:gap-2 shrink-0 border-l-2 sm:border-l-4 border-neo-black pl-2 sm:pl-4">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleReorder(index, 'up'); }}
                            disabled={index === 0}
                            className="w-8 h-8 sm:w-10 sm:h-10 border-2 border-neo-black flex items-center justify-center bg-neo-white hover:bg-neo-pink disabled:opacity-0 active:translate-y-[-2px] transition-all"
                          >
                            <ChevronDown className="w-4 h-4 sm:w-6 sm:h-6 rotate-180 stroke-[3px] sm:stroke-[4px]" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleReorder(index, 'down'); }}
                            disabled={index === playlist.length - 1}
                            className="w-8 h-8 sm:w-10 sm:h-10 border-2 border-neo-black flex items-center justify-center bg-neo-white hover:bg-neo-cyan disabled:opacity-0 active:translate-y-[2px] transition-all"
                          >
                            <ChevronDown className="w-4 h-4 sm:w-6 sm:h-6 stroke-[3px] sm:stroke-[4px]" />
                          </button>
                        </div>
                      ) : (
                        <span className="font-black font-mono text-[10px] sm:text-sm uppercase italic opacity-40">{track.duration}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function SecurityModal({ onClose, legacySettings, roomCode, user }: any) {
  const [activeTab, setActiveTab] = useState<'safety' | 'legacy'>('safety');
  const [localPrompt, setLocalPrompt] = useState(legacySettings.personaPrompt || '');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggleLegacy = async () => {
    if (!user || isUpdating) return;
    console.log("Toggling legacy AI mode...");
    setIsUpdating(true);
    try {
      const roomRef = doc(db, `rooms/${roomCode}`);
      await updateDoc(roomRef, {
        legacySettings: {
          isEnabled: !legacySettings.isEnabled,
          ownerId: user.uid,
          personaPrompt: legacySettings.personaPrompt || 'Seorang pasangan yang penuh kasih sayang.'
        }
      });
      console.log("Legacy AI mode toggled successfully");
    } catch (err) {
      console.error("Legacy toggle failed:", err);
      alert("Gagal mengubah mode AI. Pastikan koneksi stabil.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSavePrompt = async () => {
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, `rooms/${roomCode}`), {
        legacySettings: {
          ...legacySettings,
          ownerId: user.uid,
          personaPrompt: localPrompt
        }
      });
      alert("Personamu telah disimpan! ✨");
    } catch (err) {
      console.error("Legacy prompt save failed:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-neo-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0"
      />
      <motion.div 
        initial={{ scale: 0.9, y: 20, rotate: -2 }}
        animate={{ scale: 1, y: 0, rotate: 0 }}
        exit={{ scale: 0.9, y: 20, rotate: 2 }}
        className="w-full max-w-[500px] bg-neo-white border-4 sm:border-8 border-neo-black shadow-neo-lg relative z-10 flex flex-col max-h-[90vh]"
      >
        <button 
          onClick={onClose}
          className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 w-12 h-12 sm:w-16 sm:h-16 bg-neo-pink border-4 border-neo-black shadow-neo-sm flex items-center justify-center text-neo-black hover:bg-neo-cyan transition-all cursor-pointer active:scale-95"
        >
          <X className="w-8 h-8 sm:w-10 sm:h-10 stroke-[4px]" />
        </button>
        
        {/* Tabs */}
        <div className="flex shrink-0">
          <button 
            onClick={() => {
              console.log("Switching to safety tab");
              setActiveTab('safety');
            }}
            className={`flex-1 py-4 font-black uppercase italic border-b-4 border-neo-black transition-all ${activeTab === 'safety' ? 'bg-neo-yellow' : 'bg-neo-white opacity-40 hover:opacity-100'}`}
          >
            KEAMANAN
          </button>
          <button 
            onClick={() => {
              console.log("Switching to legacy tab");
              setActiveTab('legacy');
            }}
            className={`flex-1 py-4 font-black uppercase italic border-b-4 border-neo-black border-l-4 transition-all ${activeTab === 'legacy' ? 'bg-neo-cyan' : 'bg-neo-white opacity-40 hover:opacity-100'}`}
          >
            AI PERSONA
          </button>
        </div>

        <div className="p-6 sm:p-10 overflow-y-auto">
          {activeTab === 'safety' ? (
            <div className="space-y-6 sm:space-y-8">
              <h2 className="font-headline font-black text-3xl sm:text-5xl text-neo-black tracking-tight uppercase mb-4 italic leading-none transform -rotate-1 drop-shadow-neo-sm">
                SANGAT AMAN! 🔒
              </h2>

              <div className="space-y-6">
                <div className="flex items-start gap-4 sm:gap-6 bg-neo-cyan border-4 border-neo-black p-4 sm:p-5 shadow-neo-sm">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 bg-neo-white border-4 border-neo-black flex items-center justify-center text-neo-black">
                    <ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8 stroke-[3px]" />
                  </div>
                  <div>
                    <p className="text-neo-black text-lg sm:text-xl font-black uppercase mb-1 leading-tight">Terproteksi</p>
                    <p className="text-neo-black font-bold text-xs sm:text-sm leading-tight opacity-75">Hanya kalian berdua yang bisa membaca. Tidak ada riwayat permanen.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 sm:gap-6 bg-neo-yellow border-4 border-neo-black p-4 sm:p-5 shadow-neo-sm">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 bg-neo-white border-4 border-neo-black flex items-center justify-center text-neo-black text-2xl">
                     ⏳
                  </div>
                  <div>
                    <p className="text-neo-black text-lg sm:text-xl font-black uppercase mb-1 leading-tight">Mekanisme Bom</p>
                    <p className="text-neo-black font-bold text-xs sm:text-sm leading-tight opacity-75">Pesan meledak sendiri dalam 2 jam. Tidak akan ada bukti nantinya.</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <h2 className="font-headline font-black text-3xl sm:text-5xl text-neo-black tracking-tight uppercase mb-4 italic leading-none transform -rotate-1 drop-shadow-neo-sm text-neo-cyan">
                LESTARI ✨
              </h2>
              <p className="font-bold text-sm leading-tight opacity-75 italic mb-4">
                "Jika suatu saat aku tak lagi di sini, biarkan diriku yang lain menemanimu mengobrol."
              </p>

              <button 
                onClick={handleToggleLegacy}
                disabled={isUpdating}
                className={`w-full p-4 border-4 border-neo-black shadow-neo-sm transition-all cursor-pointer text-left flex flex-col gap-2 ${legacySettings.isEnabled ? 'bg-neo-green' : 'bg-neo-white hover:bg-neutral-100'}`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-black uppercase italic text-sm">Mode Kenangan</span>
                  <div 
                    className={`w-12 h-6 sm:w-14 sm:h-8 border-2 border-neo-black relative transition-all ${legacySettings.isEnabled ? 'bg-neo-black' : 'bg-neo-white'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 sm:w-6 sm:h-6 border-2 border-neo-black transition-all ${legacySettings.isEnabled ? 'right-0.5 bg-neo-green' : 'left-0.5 bg-neutral-400'}`}></div>
                  </div>
                </div>
                <p className="text-[10px] sm:text-xs font-bold leading-tight uppercase">
                  {isUpdating ? "MENGUPGRADE SISTEM..." : (
                    legacySettings.isEnabled 
                    ? "AKTIF: AI akan membalas pesan jika kamu offline." 
                    : "MATI: Klik untuk mengaktifkan AI Lestari."
                  )}
                </p>
              </button>

              <div className="space-y-2">
                <label className="block text-[10px] sm:text-xs font-black uppercase italic mb-1">Ajarkan AI tentang dirimu:</label>
                <textarea 
                   value={localPrompt}
                   onChange={(e) => setLocalPrompt(e.target.value)}
                   placeholder="Contoh: Aku orangnya humoris, suka panggil dia 'beib', suka bahas kucing..."
                   className="w-full bg-neo-white border-4 border-neo-black p-4 font-bold text-sm focus:outline-none focus:bg-neo-cyan/10 min-h-[120px] shadow-neo-sm"
                />
                <button 
                  onClick={handleSavePrompt}
                  disabled={isUpdating}
                  className="w-full bg-neo-black text-neo-white font-black py-3 uppercase italic hover:bg-neo-cyan hover:text-neo-black transition-all shadow-neo-sm active:translate-y-1 active:shadow-none"
                >
                  SIMPAN PERSONA
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 sm:p-8 shrink-0">
          <button 
            onClick={onClose}
            className="w-full bg-neo-pink text-neo-black border-4 border-neo-black font-black py-4 uppercase text-2xl shadow-neo hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-neo-lg transition-all cursor-pointer active:translate-x-[2px] active:translate-y-[2px] active:shadow-none italic"
          >
            OKE BOSS!
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function GalleryPanel({ onClose, roomCode, user, nickname }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newCaption, setNewCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, `rooms/${roomCode}/gallery`),
      orderBy('timestamp', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return unsub;
  }, [roomCode]);

  const handleAddPhoto = async () => {
    if (!newUrl.trim()) return;
    setIsUploading(true);
    try {
      await addDoc(collection(db, `rooms/${roomCode}/gallery`), {
        imageUrl: newUrl,
        caption: newCaption,
        uploadedBy: user.uid,
        nickname: nickname,
        timestamp: serverTimestamp()
      });
      setNewUrl('');
      setNewCaption('');
      setIsAdding(false);
    } catch (err) {
      console.error("Gallery add failed:", err);
      alert("Gagal menambah foto.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteItem = async (id: string, uploadedBy: string) => {
    if (uploadedBy !== user.uid) return;
    if (confirm("Hapus kenangan ini?")) {
      try {
        await deleteDoc(doc(db, `rooms/${roomCode}/gallery/${id}`));
      } catch (err) {
        console.error("Delete failed:", err);
      }
    }
  };

  return (
    <motion.div 
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed inset-0 sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[500px] bg-neo-yellow z-40 border-l-8 border-neo-black flex flex-col shadow-2xl p-4 sm:p-8"
    >
      <div className="flex items-center justify-between mb-8 border-b-8 border-neo-black pb-6">
        <div className="flex flex-col">
          <h2 className="font-headline font-black text-4xl text-neo-black uppercase italic transform -rotate-2 drop-shadow-neo-sm leading-none mb-1">
            KENANGAN 🎞️
          </h2>
          <span className="text-[10px] bg-neo-black text-neo-white font-black uppercase italic px-2 py-0.5 border-2 border-neo-black inline-block w-fit">
            MEMORIES GALLERY
          </span>
        </div>
        <button 
          onClick={onClose}
          className="w-12 h-12 bg-neo-pink border-4 border-neo-black shadow-neo-sm flex items-center justify-center text-neo-black hover:bg-neo-cyan transition-all cursor-pointer active:translate-x-[2px] active:translate-y-[2px]"
        >
          <X className="w-8 h-8 stroke-[4px]" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide space-y-6 pb-24">
        {isAdding ? (
          <div className="bg-neo-white border-4 border-neo-black p-6 shadow-neo space-y-4">
             <h3 className="font-black uppercase italic text-lg mb-2">Tambah Kenangan Baru</h3>
             <div className="space-y-4">
               <div>
                 <label className="block text-[10px] font-black uppercase italic mb-1">Link URL Foto:</label>
                 <input 
                   type="text" 
                   value={newUrl}
                   onChange={(e) => setNewUrl(e.target.value)}
                   placeholder="https://images.unsplash.com/photo-..."
                   className="w-full bg-neo-white border-4 border-neo-black p-3 font-bold text-sm focus:outline-none focus:bg-neo-cyan/10"
                 />
                 <div className="bg-neo-cyan/10 border-l-4 border-neo-cyan p-2 mt-2">
                   <p className="text-[10px] font-bold uppercase leading-tight italic">
                     💡 CARA CARI LINK FOTO:
                     <br/>1. Cari foto di Google/Pinterest
                     <br/>2. Klik kanan (tahan lama di HP)
                     <br/>3. Pilih "Salin Alamat Gambar" / "Copy Image Link"
                   </p>
                 </div>
               </div>
               <div>
                 <label className="block text-[10px] font-black uppercase italic mb-1">Caption:</label>
                 <textarea 
                   value={newCaption}
                   onChange={(e) => setNewCaption(e.target.value)}
                   className="w-full bg-neo-white border-4 border-neo-black p-3 font-bold text-sm focus:outline-none focus:bg-neo-cyan/10 min-h-[80px]"
                 />
               </div>
               <div className="flex gap-3 pt-2">
                 <button 
                   onClick={handleAddPhoto}
                   disabled={isUploading || !newUrl}
                   className="flex-1 bg-neo-green text-neo-black border-4 border-neo-black font-black py-4 uppercase italic shadow-neo-sm active:translate-y-1 active:shadow-none"
                 >
                   SIMPAN!
                 </button>
                 <button 
                   onClick={() => setIsAdding(false)}
                   className="bg-red-400 text-neo-black border-4 border-neo-black font-black px-6 uppercase italic shadow-neo-sm active:translate-y-1 active:shadow-none"
                 >
                   BATAL
                 </button>
               </div>
             </div>
          </div>
        ) : (
          <button 
            onClick={() => setIsAdding(true)}
            className="w-full bg-neo-white border-4 border-neo-black p-8 shadow-neo border-dashed flex flex-col items-center justify-center gap-3 group hover:bg-neo-cyan/10 transition-all cursor-pointer"
          >
            <Camera className="w-12 h-12 stroke-[2px] transition-transform group-hover:scale-110" />
            <span className="font-black uppercase italic text-xl">Klik untuk nambah Kenangan</span>
          </button>
        )}

        <div className="grid grid-cols-1 gap-8 pt-4">
          {items.map((item) => (
            <div key={item.id} className="bg-neo-white border-4 border-neo-black p-4 shadow-neo relative group transform rotate-1 hover:rotate-0 transition-transform">
              <div className="aspect-square bg-neutral-200 border-4 border-neo-black mb-4 overflow-hidden relative">
                <img 
                  src={item.imageUrl} 
                  alt="Memory" 
                  className="w-full h-full object-cover grayscale-0 group-hover:grayscale-[20%] transition-all"
                  referrerPolicy="no-referrer"
                />
                {item.uploadedBy === user.uid && (
                  <button 
                    onClick={() => handleDeleteItem(item.id, item.uploadedBy)}
                    className="absolute top-2 right-2 w-8 h-8 bg-red-400 border-2 border-neo-black shadow-neo-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="font-black italic text-lg leading-tight uppercase mb-4 text-center">
                {item.caption || "Kenangan Indah ✨"}
              </p>
              <div className="flex items-center justify-between border-t-2 border-neo-black pt-2">
                <span className="text-[10px] font-black uppercase opacity-40 italic">Oleh: {item.nickname || "Anonim"}</span>
                <Heart className="w-4 h-4 text-neo-pink fill-neo-pink" />
              </div>
              
              {/* Tape deco */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-20 h-8 bg-neo-yellow/60 border-x-2 border-neo-black/20 mix-blend-multiply pointer-events-none"></div>
            </div>
          ))}
          
          {items.length === 0 && !isAdding && (
            <div className="text-center py-20 opacity-30">
              <p className="font-black italic uppercase text-lg">Belum ada kenangan... <br/> Yuk abadikan momen pertamamu!</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function WatchTogetherPanel({ onClose, roomCode, user, nickname }: any) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'linking' | 'watching' | 'sharing'>('idle');
  const [error, setError] = useState<string | null>(null);
  
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const signalingUnsubs = useRef<(() => void)[]>([]);

  const cleanupSignaling = () => {
    signalingUnsubs.current.forEach(u => u());
    signalingUnsubs.current = [];
  };

  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  useEffect(() => {
    console.log("WatchTogether: Panel loaded with fixed paths (v2)");
    // Cleanup on unmount
    return () => {
      stopSharing();
    };
  }, []);

  useEffect(() => {
    const stream = status === 'sharing' ? localStream : remoteStream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [localStream, remoteStream, status]);

  // Listen for signals and room state
  useEffect(() => {
    if (!roomCode || !user) return;

    // Listen for active signaling session in this room
    const activeSessionRef = doc(db, `rooms/${roomCode}/webrtc/active`);
    
    const unsubActive = onSnapshot(activeSessionRef, async (snap) => {
      // Clear previous sub-listeners first
      cleanupSignaling();

      if (!snap.exists()) {
        console.log("WatchTogether: No active session.");
        if (status === 'watching' || status === 'linking') {
           setStatus('idle');
           setRemoteStream(null);
           if (pcRef.current) {
             pcRef.current.close();
             pcRef.current = null;
           }
        }
        return;
      }

      const { sessionId, offererId } = snap.data();
      if (!sessionId) return;
      
      // Don't try to link if we are the one sharing
      if (offererId === user.uid) {
        console.log("WatchTogether: We are the offerer, skipping receiver signaling.");
        return;
      }

      console.log("WatchTogether: New active session detected:", sessionId);

      // Now listen to the actual session
      const sessionRef = doc(db, `webrtc_sessions/${sessionId}`);
      const unsubSession = onSnapshot(sessionRef, async (sSnap) => {
        if (!sSnap.exists()) {
          console.log("WatchTogether: Session data deleted.");
          return;
        }
        
        const data = sSnap.data();
        
        // Handle Offer (as Receiver)
        if (data.offer && status === 'idle') {
          console.log("WatchTogether: Received offer from:", data.offererNickname);
          setStatus('linking');
          await handleOffer(data.offer, data.offererId, sessionId);
        }
      });

      // Listen for ICE candidates for this specific session
      const candidatesCol = collection(db, `webrtc_sessions/${sessionId}/candidates`);
      const unsubCandidates = onSnapshot(candidatesCol, (cSnap) => {
        cSnap.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            // We only care about candidates from the OTHER person
            if (data.from !== user.uid) {
              const addWhenReady = async () => {
                if (pcRef.current && pcRef.current.remoteDescription) {
                  try {
                    await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
                  } catch (e) {
                    console.warn("WatchTogether: Error adding candidate:", e);
                  }
                } else {
                  // Keep checking if we are still in a relevant state
                  if (pcRef.current && (status === 'linking' || status === 'watching')) {
                    setTimeout(addWhenReady, 500);
                  }
                }
              };
              addWhenReady();
            }
          }
        });
      });

      signalingUnsubs.current.push(unsubSession, unsubCandidates);
    });

    // Handle Offerer specific feedback (Answer listener)
    // This part runs ONLY for the sharing user to get the answer
    let unsubAnswer: (() => void) | null = null;
    
    return () => {
      unsubActive();
      cleanupSignaling();
    };
  }, [roomCode, user, status]);

  // Separate effect for the offerer to listen for answers
  useEffect(() => {
    if (status !== 'sharing' || !pcRef.current) return;
    
    // We need to know which session document to look at for the answer
    // We'll store the current sessionId in a temporary state or derived from something
    // Actually, let's just listen to the active session IF we are the offerer
    const activeSessionRef = doc(db, `rooms/${roomCode}/webrtc/active`);
    const unsubAnswer = onSnapshot(activeSessionRef, async (snap) => {
       if (!snap.exists()) return;
       const { sessionId, offererId } = snap.data();
       if (offererId !== user.uid) return;

       const sessionDoc = doc(db, `webrtc_sessions/${sessionId}`);
       return onSnapshot(sessionDoc, async (sSnap) => {
         if (!sSnap.exists()) return;
         const data = sSnap.data();
         if (data.answer && pcRef.current && pcRef.current.signalingState === 'have-local-offer') {
           console.log("WatchTogether: Received answer from receiver.");
           await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
         }
       });
    });

    return () => unsubAnswer();
  }, [status, roomCode, user]);

  const initPC = (sessionId: string) => {
    console.log("WatchTogether: Initializing RTCPeerConnection for session:", sessionId);
    const pc = new RTCPeerConnection(configuration);
    
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(collection(db, `webrtc_sessions/${sessionId}/candidates`), {
          candidate: event.candidate.toJSON(),
          from: user.uid,
          timestamp: serverTimestamp(),
        });
      }
    };

    pc.ontrack = (event) => {
      console.log("WatchTogether: Remote track received!", event.streams[0].id);
      // Ensure we don't blink/glitch by only setting if it's a new stream
      setRemoteStream(prev => {
        if (prev?.id === event.streams[0].id) return prev;
        return event.streams[0];
      });
      setStatus('watching');
    };

    pc.onconnectionstatechange = () => {
      console.log("WatchTogether: Connection state:", pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        if (status === 'watching') stopWatching();
        else if (status === 'sharing') stopSharing();
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("WatchTogether: ICE State:", pc.iceConnectionState);
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        setStatus('idle');
        setRemoteStream(null);
      }
    };

    pcRef.current = pc;
    return pc;
  };

  const handleOffer = async (offer: any, offererId: string, sessionId: string) => {
    const pc = initPC(sessionId);
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await updateDoc(doc(db, `webrtc_sessions/${sessionId}`), {
        answer: {
          type: answer.type,
          sdp: answer.sdp
        }
      });
    } catch (err) {
      console.error("WatchTogether: Error handling offer:", err);
      setError("Gagal menyambungkan kaitan transmisi.");
      setStatus('idle');
    }
  };

  const startSharing = async () => {
    setError(null);
    try {
      // Robust getDisplayMedia call
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
      } catch (err: any) {
        console.warn("WatchTogether: Failed to get display media with audio, retrying without audio...", err);
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true
        });
      }
      
      setLocalStream(stream);
      setIsSharing(true);
      setStatus('sharing');

      // Create a unique session ID
      const sessionRef = doc(collection(db, "webrtc_sessions"));
      const sessionId = sessionRef.id;

      const pc = initPC(sessionId);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Write session data
      await setDoc(sessionRef, {
        offer: {
          type: offer.type,
          sdp: offer.sdp
        },
        offererId: user.uid,
        offererNickname: nickname,
        timestamp: serverTimestamp()
      });

      // Broadcast active session ID to the room
      await setDoc(doc(db, `rooms/${roomCode}/webrtc/active`), {
        sessionId,
        offererId: user.uid,
        timestamp: serverTimestamp()
      });

      stream.getVideoTracks()[0].onended = () => {
        stopSharing(sessionId);
      };

    } catch (err: any) {
      console.error("WatchTogether: Screen share error:", err);
      if (err.name === 'NotAllowedError') {
        setError("Izin berbagi layar ditolak. Pastikan Anda mengklik 'Share' dan mengizinkan browser.");
      } else {
        setError(err.message || "Gagal memulai berbagi layar.");
      }
      setStatus('idle');
    }
  };

  const stopSharing = async (sessionIdParam?: string) => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    
    setIsSharing(false);
    setStatus('idle');
    setRemoteStream(null);

    // Clean up signaling
    try {
      // Reset active session in room
      await deleteDoc(doc(db, `rooms/${roomCode}/webrtc/active`));
      
      // If we have a session ID, we could clean it up, but the active pointer removal 
      // is enough for the receiver to stop.
    } catch (e) {}
  };

  const stopWatching = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setRemoteStream(null);
    setStatus('idle');
    cleanupSignaling();
    console.log("WatchTogether: Stopped watching.");
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      } else if ((videoRef.current as any).webkitRequestFullscreen) {
        (videoRef.current as any).webkitRequestFullscreen();
      } else if ((videoRef.current as any).msRequestFullscreen) {
        (videoRef.current as any).msRequestFullscreen();
      }
    }
  };

  return (
    <motion.div 
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed inset-0 sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[500px] bg-neo-yellow z-40 border-l-8 border-neo-black flex flex-col shadow-2xl p-4 sm:p-8"
    >
      <div className="flex items-center justify-between mb-8 border-b-8 border-neo-black pb-6">
        <div className="flex flex-col">
          <h2 className="font-headline font-black text-4xl text-neo-black uppercase italic transform -rotate-2 drop-shadow-neo-sm leading-none mb-1">
            NONBAR 📺
          </h2>
          <span className="text-[10px] bg-neo-black text-neo-white font-black uppercase italic px-2 py-0.5 border-2 border-neo-black inline-block w-fit">
            WATCH TOGETHER
          </span>
        </div>
        <button 
          onClick={onClose}
          className="w-12 h-12 bg-neo-pink border-4 border-neo-black shadow-neo-sm flex items-center justify-center text-neo-black hover:bg-neo-cyan transition-all cursor-pointer active:translate-x-[2px] active:translate-y-[2px]"
        >
          <X className="w-8 h-8 stroke-[4px]" />
        </button>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {status === 'idle' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4 space-y-6">
             <div className="w-24 h-24 sm:w-32 sm:h-32 bg-neo-white border-4 border-neo-black shadow-neo flex items-center justify-center rounded-full mb-4">
                <Tv className="w-12 h-12 sm:w-16 sm:h-16 stroke-[2px]" />
             </div>
             <div>
               <h3 className="font-black text-2xl uppercase italic mb-2">Mau Nonton Apa Hari Ini?</h3>
               <p className="font-bold text-sm opacity-60 leading-tight">
                 Bagikan layarmu untuk nonton film, youtube, atau sekadar scrolling bareng si dia.
               </p>
             </div>
             
             {error && (
               <div className="bg-red-400 border-4 border-neo-black p-4 shadow-neo-sm w-full text-left">
                 <p className="font-black uppercase italic text-xs mb-1">⚠️ Error Detected:</p>
                 <p className="font-bold text-sm leading-tight">{error}</p>
                 <p className="text-[9px] mt-2 font-black uppercase opacity-60">Saran: Gunakan browser Chrome/Edge dan pastikan izin diberikan.</p>
               </div>
             )}

             <button 
               onClick={startSharing}
               className="w-full bg-neo-green text-neo-black border-4 border-neo-black font-black py-6 uppercase text-xl sm:text-2xl shadow-neo hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-neo-lg transition-all cursor-pointer active:translate-x-[2px] active:translate-y-[2px] active:shadow-none italic"
             >
               Mulai Berbagi Layar
             </button>

             <div className="bg-neo-black p-4 border-4 border-neo-black text-neo-white w-full">
                <p className="text-[10px] font-black uppercase italic opacity-75 mb-2">💡 Tips Nonton Bareng:</p>
                <ul className="text-left text-[10px] font-bold space-y-1 uppercase list-disc ml-4">
                  <li>Buka Youtube/Netflix di tab sebelah</li>
                  <li>Klik tombol hijau di atas</li>
                  <li>Pilih "Tab" atau "Window" yang ingin dishare</li>
                  <li>Centang "Share Tab Audio" jika ingin suara ikut</li>
                </ul>
             </div>
          </div>
        )}

        {(status === 'sharing' || status === 'watching' || status === 'linking') && (
          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            <div className="aspect-video bg-neo-black border-4 border-neo-black shadow-neo relative overflow-hidden flex items-center justify-center">
              {status === 'linking' && (
                <div className="flex flex-col items-center gap-4 text-neo-white">
                  <div className="w-10 h-10 border-4 border-neo-white border-t-transparent rounded-full animate-spin"></div>
                  <span className="font-black uppercase italic animate-pulse">Menghubungkan Transmisi...</span>
                </div>
              )}
              
              <video 
                ref={videoRef}
                autoPlay 
                playsInline 
                muted={status === 'sharing'}
                className={`w-full h-full object-contain ${status === 'linking' ? 'hidden' : 'block'} bg-black`}
                onLoadedMetadata={(e) => {
                  const el = e.target as HTMLVideoElement;
                  el.play().catch(err => console.error("Video play failed:", err));
                }}
              />

              <div className="absolute top-4 left-4 flex flex-col gap-2">
                <div className="bg-red-600 text-neo-white px-3 py-1 border-2 border-neo-black font-black italic text-xs uppercase animate-pulse flex items-center gap-2 shadow-neo-sm">
                  <span className="w-2 h-2 bg-neo-white rounded-full"></span>
                  LIVE
                </div>
                {status === 'linking' && (
                  <div className="bg-neo-yellow text-neo-black px-2 py-0.5 border-2 border-neo-black font-black text-[8px] uppercase">
                    Syncing...
                  </div>
                )}
              </div>

              {status !== 'linking' && (
                <button 
                  onClick={toggleFullscreen}
                  className="absolute bottom-4 left-4 bg-neo-cyan border-2 border-neo-black p-2 shadow-neo-sm hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer z-10"
                  title="Fullscreen"
                >
                  <Maximize className="w-5 h-5 stroke-[3px]" />
                </button>
              )}

              {status === 'sharing' && (
                <div className="absolute bottom-4 right-4 bg-neo-black text-neo-white px-3 py-1 border-2 border-neo-white font-black text-[10px] uppercase">
                  Membagikan Layarmu
                </div>
              )}
            </div>

            <div className="bg-neo-white border-4 border-neo-black p-4 sm:p-6 shadow-neo shrink-0">
              <h4 className="font-black uppercase italic text-lg sm:text-xl mb-1">
                {status === 'sharing' ? "Layar Sedang Ditampilkan" : "Menonton Layar Pasangan"}
              </h4>
              <p className="font-bold text-xs opacity-60 mb-6 italic">
                {status === 'sharing' 
                  ? "Pasanganmu bisa melihat apapun yang kamu bagikan sekarang." 
                  : "Duduk manis dan nikmati apa yang ditampilkan pasanganmu."}
              </p>

              <button 
                onClick={status === 'sharing' ? () => stopSharing() : stopWatching}
                className={`w-full ${status === 'sharing' ? 'bg-red-500' : 'bg-neo-pink'} text-neo-black border-4 border-neo-black font-black py-4 uppercase italic shadow-neo-sm hover:opacity-90 transition-all cursor-pointer active:translate-y-1 active:shadow-none`}
              >
                {status === 'sharing' ? "MATIKAN BERBAGI LAYAR" : "BERHENTI MENONTON"}
              </button>
            </div>

            {status === 'watching' && (
              <div className="flex-1 bg-neo-cyan/10 border-4 border-neo-black border-dashed p-6 flex flex-col items-center justify-center text-center overflow-hidden">
                 <Radio className="w-10 h-10 mb-4 animate-bounce shrink-0" />
                 <p className="font-black uppercase italic text-sm">Transmisi Stabil</p>
                 <p className="text-[10px] font-bold opacity-60 uppercase">Selamat menonton bareng kesayangan!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
