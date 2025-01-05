import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppShell, Grid, Stack, Group, Text, Button, Avatar, Paper, ActionIcon } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconMicrophone, IconMicrophoneOff, IconVideo, IconVideoOff, IconDoorExit } from '@tabler/icons-react';
import Peer from 'simple-peer';
import { supabase } from '../lib/supabase';

export function Room() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [user, setUser] = useState(null);
  const [peers, setPeers] = useState([]);
  const [stream, setStream] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const userVideo = useRef();
  const peersRef = useRef([]);
  const [participants, setParticipants] = useState(new Set());

  // Yeni bir peer bağlantısı oluştur
  const createPeer = useCallback((targetUserId, stream) => {
    console.log('Creating peer for:', targetUserId);
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    peer.on('signal', async signal => {
      console.log('Sending offer signal to:', targetUserId);
      try {
        const { error } = await supabase.from('signals').insert({
          room_id: id,
          from_user_id: user.id,
          to_user_id: targetUserId,
          type: 'offer',
          signal,
        });
        if (error) throw error;
      } catch (err) {
        console.error('Signal error:', err);
        notifications.show({
          title: 'Sinyal Hatası',
          message: 'Bağlantı sinyali gönderilemedi',
          color: 'red',
        });
      }
    });

    peer.on('connect', () => {
      console.log('Peer connected with:', targetUserId);
    });

    peer.on('stream', remoteStream => {
      console.log('Received stream from:', targetUserId);
      const peerObj = peersRef.current.find(p => p.userId === targetUserId);
      if (peerObj && peerObj.ref.current) {
        peerObj.ref.current.srcObject = remoteStream;
      }
    });

    peer.on('error', err => {
      console.error('Peer error:', err);
      notifications.show({
        title: 'Bağlantı Hatası',
        message: 'Kullanıcı ile bağlantı kurulamadı',
        color: 'red',
      });
    });

    peer.on('close', () => {
      console.log('Peer connection closed with:', targetUserId);
    });

    return peer;
  }, [id, user]);

  // Gelen peer bağlantısını kabul et
  const addPeer = useCallback((incomingSignal, senderId, stream) => {
    console.log('Adding peer for:', senderId);
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    peer.on('signal', async signal => {
      console.log('Sending answer signal to:', senderId);
      try {
        const { error } = await supabase.from('signals').insert({
          room_id: id,
          from_user_id: user.id,
          to_user_id: senderId,
          type: 'answer',
          signal,
        });
        if (error) throw error;
      } catch (err) {
        console.error('Signal error:', err);
        notifications.show({
          title: 'Sinyal Hatası',
          message: 'Bağlantı sinyali gönderilemedi',
          color: 'red',
        });
      }
    });

    peer.on('connect', () => {
      console.log('Peer connected with:', senderId);
    });

    peer.on('stream', remoteStream => {
      console.log('Received stream from:', senderId);
      const peerObj = peersRef.current.find(p => p.userId === senderId);
      if (peerObj && peerObj.ref.current) {
        peerObj.ref.current.srcObject = remoteStream;
      }
    });

    peer.on('error', err => {
      console.error('Peer error:', err);
      notifications.show({
        title: 'Bağlantı Hatası',
        message: 'Kullanıcı ile bağlantı kurulamadı',
        color: 'red',
      });
    });

    peer.on('close', () => {
      console.log('Peer connection closed with:', senderId);
    });

    try {
      peer.signal(incomingSignal);
    } catch (err) {
      console.error('Signal error:', err);
    }

    return peer;
  }, [id, user]);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }
      setUser(user);
    };
    getUser();
  }, [navigate]);

  useEffect(() => {
    const fetchRoom = async () => {
      const { data: room, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !room) {
        notifications.show({
          title: 'Hata',
          message: 'Oda bulunamadı',
          color: 'red',
        });
        navigate('/');
        return;
      }

      setRoom(room);

      // Odaya katılım sayısını güncelle
      await supabase
        .from('rooms')
        .update({ participants: room.participants + 1 })
        .eq('id', id);

      // Odadan ayrılma durumunda
      window.addEventListener('beforeunload', leaveRoom);
      return () => {
        window.removeEventListener('beforeunload', leaveRoom);
        leaveRoom();
      };
    };

    fetchRoom();
  }, [id, navigate]);

  useEffect(() => {
    if (!room?.has_audio || !user) return;

    let localStream = null;

    const initializeMedia = async () => {
      try {
        console.log('Requesting media access...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        console.log('Media access granted');
        localStream = stream;
        setStream(stream);
        if (userVideo.current) {
          userVideo.current.srcObject = stream;
        }

        // Realtime presence için subscription
        const roomChannel = supabase.channel('room:' + id);
        
        // Sinyal mesajlarını dinle
        const signalSubscription = supabase
          .channel('signals')
          .on('postgres_changes', 
            { 
              event: 'INSERT', 
              schema: 'public', 
              table: 'signals',
              filter: `to_user_id=eq.${user.id}` 
            }, 
            async (payload) => {
              console.log('Received signal:', payload.new);
              const { from_user_id, type, signal } = payload.new;

              if (type === 'offer') {
                console.log('Processing offer from:', from_user_id);
                const peer = addPeer(signal, from_user_id, stream);
                const peerRef = React.createRef();
                const peerObj = {
                  userId: from_user_id,
                  peer,
                  ref: peerRef,
                };
                peersRef.current.push(peerObj);
                setPeers(peers => [...peers.filter(p => p.userId !== from_user_id), peerObj]);
              } else if (type === 'answer') {
                console.log('Processing answer from:', from_user_id);
                const peerObj = peersRef.current.find(p => p.userId === from_user_id);
                if (peerObj) {
                  try {
                    peerObj.peer.signal(signal);
                  } catch (err) {
                    console.error('Error processing answer:', err);
                  }
                }
              }
            }
          )
          .subscribe();

        roomChannel
          .on('presence', { event: 'sync' }, () => {
            const presenceState = roomChannel.presenceState();
            const users = Object.values(presenceState).flat();
            
            console.log('Presence sync:', users);
            const uniqueParticipants = new Set(users.map(u => u.user_id));
            setParticipants(uniqueParticipants);
            
            users.forEach(u => {
              if (u.user_id !== user.id && !peersRef.current.some(p => p.userId === u.user_id)) {
                console.log('Creating new peer connection for:', u.user_id);
                const peer = createPeer(u.user_id, stream);
                const peerRef = React.createRef();
                const peerObj = {
                  userId: u.user_id,
                  userName: u.user_name,
                  peer,
                  ref: peerRef,
                };
                peersRef.current.push(peerObj);
                setPeers(peers => [...peers.filter(p => p.userId !== u.user_id), peerObj]);
              }
            });
          })
          .on('presence', { event: 'join' }, ({ newPresences }) => {
            console.log('New presences:', newPresences);
            newPresences.forEach(u => {
              if (u.user_id !== user.id && !peersRef.current.some(p => p.userId === u.user_id)) {
                console.log('Creating new peer connection for joined user:', u.user_id);
                const peer = createPeer(u.user_id, stream);
                const peerRef = React.createRef();
                const peerObj = {
                  userId: u.user_id,
                  userName: u.user_name,
                  peer,
                  ref: peerRef,
                };
                peersRef.current.push(peerObj);
                setPeers(peers => [...peers.filter(p => p.userId !== u.user_id), peerObj]);
              }
            });
          })
          .on('presence', { event: 'leave' }, ({ leftPresences }) => {
            console.log('Left presences:', leftPresences);
            leftPresences.forEach(u => {
              const peerObj = peersRef.current.find(p => p.userId === u.user_id);
              if (peerObj) {
                console.log('Cleaning up peer connection for:', u.user_id);
                peerObj.peer.destroy();
                peersRef.current = peersRef.current.filter(p => p.userId !== u.user_id);
                setPeers(peers => peers.filter(p => p.userId !== u.user_id));
                setParticipants(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(u.user_id);
                  return newSet;
                });
              }
            });
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              console.log('Room channel subscribed');
              await roomChannel.track({
                user_id: user.id,
                user_name: user.user_metadata.name,
                online_at: new Date().toISOString(),
              });
            }
          });

        return () => {
          console.log('Cleaning up media and connections');
          if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
          }
          roomChannel.unsubscribe();
          signalSubscription.unsubscribe();
          peersRef.current.forEach(({ peer }) => peer.destroy());
        };
      } catch (error) {
        console.error('Media error:', error);
        notifications.show({
          title: 'Hata',
          message: 'Kamera veya mikrofon erişimi sağlanamadı',
          color: 'red',
        });
      }
    };

    initializeMedia();
  }, [room, id, user, createPeer, addPeer]);

  const leaveRoom = async () => {
    if (!room) return;

    // Katılımcı sayısını azalt
    await supabase
      .from('rooms')
      .update({ participants: Math.max(0, room.participants - 1) })
      .eq('id', id);

    navigate('/');
  };

  const toggleAudio = () => {
    if (stream) {
      stream.getAudioTracks()[0].enabled = !audioEnabled;
      setAudioEnabled(!audioEnabled);
    }
  };

  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks()[0].enabled = !videoEnabled;
      setVideoEnabled(!videoEnabled);
    }
  };

  if (!room || !user) return null;

  return (
    <AppShell padding="md">
      <Stack gap="md">
        <Group justify="space-between">
          <div>
            <Text size="xl" fw={700}>{room.name}</Text>
            <Text size="sm" c="dimmed">{room.subject}</Text>
          </div>
          <Button 
            color="red" 
            variant="light"
            leftSection={<IconDoorExit size={20} />}
            onClick={leaveRoom}
          >
            Odadan Ayrıl
          </Button>
        </Group>

        <Grid gutter="md" style={{ margin: 0 }}>
          {/* Sol taraf - Videolar */}
          <Grid.Col span={{ base: 12, md: 9 }}>
            <Grid gutter="md">
              {/* Kullanıcının kendi videosu */}
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Paper shadow="sm" p="md" style={{ height: '100%' }}>
                  <Stack gap="md" style={{ height: '100%' }}>
                    <div style={{ flex: 1, minHeight: 0 }}>
                      <video
                        ref={userVideo}
                        autoPlay
                        playsInline
                        muted
                        style={{ 
                          width: '100%', 
                          height: '100%',
                          objectFit: 'cover',
                          borderRadius: '8px',
                          backgroundColor: '#f1f1f1'
                        }}
                      />
                    </div>
                    <Group justify="space-between">
                      <Group>
                        <Avatar color="orange.5" radius="xl">
                          {user?.user_metadata?.name?.charAt(0)}
                        </Avatar>
                        <Text size="sm">{user?.user_metadata?.name} (Sen)</Text>
                      </Group>
                      <Group>
                        <ActionIcon 
                          variant="light" 
                          color={audioEnabled ? 'orange.5' : 'red'}
                          onClick={toggleAudio}
                        >
                          {audioEnabled ? <IconMicrophone size={20} /> : <IconMicrophoneOff size={20} />}
                        </ActionIcon>
                        <ActionIcon 
                          variant="light" 
                          color={videoEnabled ? 'orange.5' : 'red'}
                          onClick={toggleVideo}
                        >
                          {videoEnabled ? <IconVideo size={20} /> : <IconVideoOff size={20} />}
                        </ActionIcon>
                      </Group>
                    </Group>
                  </Stack>
                </Paper>
              </Grid.Col>

              {/* Diğer katılımcıların videoları */}
              {peers.map((peer, index) => (
                <Grid.Col span={{ base: 12, sm: 6 }} key={index}>
                  <Paper shadow="sm" p="md" style={{ height: '100%' }}>
                    <Stack gap="md" style={{ height: '100%' }}>
                      <div style={{ flex: 1, minHeight: 0 }}>
                        <video
                          ref={peer.ref}
                          autoPlay
                          playsInline
                          style={{ 
                            width: '100%', 
                            height: '100%',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            backgroundColor: '#f1f1f1'
                          }}
                        />
                      </div>
                      <Group justify="space-between">
                        <Group>
                          <Avatar color="orange.5" radius="xl">
                            {peer.userName?.charAt(0)}
                          </Avatar>
                          <Text size="sm">{peer.userName}</Text>
                        </Group>
                      </Group>
                    </Stack>
                  </Paper>
                </Grid.Col>
              ))}
            </Grid>
          </Grid.Col>

          {/* Sağ taraf - Katılımcı listesi */}
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Paper shadow="sm" p="md" style={{ height: '100%' }}>
              <Stack>
                <Text fw={700}>Katılımcılar ({participants.size})</Text>
                
                {/* Kendisi */}
                <Group>
                  <Avatar color="orange.5" radius="xl">
                    {user?.user_metadata?.name?.charAt(0)}
                  </Avatar>
                  <Text size="sm">{user?.user_metadata?.name} (Sen)</Text>
                </Group>
                
                {/* Diğer katılımcılar */}
                {peers.filter((peer, index, self) => 
                  index === self.findIndex(p => p.userId === peer.userId)
                ).map(peer => (
                  <Group key={peer.userId}>
                    <Avatar color="orange.5" radius="xl">
                      {peer.userName?.charAt(0)}
                    </Avatar>
                    <Text size="sm">{peer.userName}</Text>
                  </Group>
                ))}
              </Stack>
            </Paper>
          </Grid.Col>
        </Grid>
      </Stack>
    </AppShell>
  );
} 