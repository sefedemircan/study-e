import { useState, useEffect } from 'react';
import {
  AppShell,
  Burger,
  Group,
  Avatar,
  Text,
  Button,
  Menu,
  ActionIcon,
  Grid,
  Card,
  Badge,
  Modal,
  TextInput,
  NumberInput,
  Switch,
  Select,
  Tooltip,
  Tabs,
  Paper,
  RingProgress,
  ThemeIcon,
  Divider,
  Stack
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { 
  IconBell, 
  IconLogout, 
  IconUsers, 
  IconMicrophone, 
  IconMicrophoneOff, 
  IconPlus,
  IconClock,
  IconBook,
  IconTrophy,
  IconChartBar,
  IconSearch,
  IconFilter,
  IconStar,
  IconStarFilled
} from '@tabler/icons-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';

export function Home() {
  const [opened, { toggle }] = useDisclosure();
  const [createRoomOpened, { open: openCreateRoom, close: closeCreateRoom }] = useDisclosure(false);
  const [user, setUser] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [favoriteRooms, setFavoriteRooms] = useState(new Set());
  const [stats, setStats] = useState({
    total_study_time: 0,
    daily_study_time: 0,
    daily_goal: 300,
    total_sessions: 0,
    xp_points: 0
  });
  const navigate = useNavigate();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        // Kullanıcı istatistiklerini al
        const { data: statsData, error: statsError } = await supabase
          .from('user_stats')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (statsError) {
          console.error('Stats error:', statsError);
        } else if (statsData) {
          // Eğer son çalışma tarihi bugün değilse, günlük çalışma süresini sıfırla
          if (new Date(statsData.last_study_date).toDateString() !== new Date().toDateString()) {
            const { error: updateError } = await supabase
              .from('user_stats')
              .update({ 
                daily_study_time: 0,
                last_study_date: new Date().toISOString()
              })
              .eq('user_id', user.id);

            if (updateError) {
              console.error('Update error:', updateError);
            }

            setStats({
              ...statsData,
              daily_study_time: 0
            });
          } else {
            setStats(statsData);
          }
        }

        // Realtime stats subscription
        const statsSubscription = supabase
          .channel('user_stats_changes')
          .on('postgres_changes', 
            { 
              event: '*', 
              schema: 'public', 
              table: 'user_stats',
              filter: `user_id=eq.${user.id}`
            }, 
            (payload) => {
              console.log('Stats updated:', payload);
              if (payload.new) {
                setStats(payload.new);
              }
            }
          )
          .subscribe();

        return () => {
          statsSubscription.unsubscribe();
        };
      }
    };
    getUser();
    fetchRooms();

    // Realtime subscription
    const roomSubscription = supabase
      .channel('rooms')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'rooms' }, 
        () => {
          fetchRooms();
        }
      )
      .subscribe();

    return () => {
      roomSubscription.unsubscribe();
    };
  }, []);

  const fetchRooms = async () => {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      notifications.show({
        title: 'Hata',
        message: 'Odalar yüklenirken bir hata oluştu',
        color: 'red',
      });
      return;
    }

    setRooms(data || []);
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.target);
    const roomData = {
      name: formData.get('name'),
      subject: formData.get('subject'),
      max_participants: parseInt(formData.get('maxParticipants')),
      has_audio: formData.get('hasAudio') === 'on',
      owner_id: user.id,
      participants: 0,
    };

    try {
      const { error } = await supabase
        .from('rooms')
        .insert(roomData);

      if (error) throw error;

      notifications.show({
        title: 'Başarılı',
        message: 'Çalışma odası oluşturuldu!',
        color: 'green',
      });

      closeCreateRoom();
    } catch (error) {
      notifications.show({
        title: 'Hata',
        message: error.message,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handleJoinRoom = (roomId) => {
    navigate(`/room/${roomId}`);
  };

  const toggleFavorite = (roomId) => {
    setFavoriteRooms(prev => {
      const newSet = new Set(prev);
      if (newSet.has(roomId)) {
        newSet.delete(roomId);
      } else {
        newSet.add(roomId);
      }
      return newSet;
    });
  };

  const filteredRooms = rooms.filter(room => {
    const matchesSearch = room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         room.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubject = !selectedSubject || room.subject === selectedSubject;
    return matchesSearch && matchesSubject;
  });

  const subjects = [...new Set(rooms.map(room => room.subject))];

  // Dakikayı saat:dakika formatına çevir
  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}s ${mins}dk`;
  };

  // Günlük hedef yüzdesini hesapla
  const getDailyProgress = () => {
    return Math.min(100, Math.round((stats.daily_study_time / stats.daily_goal) * 100));
  };

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 300, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Text size="lg" fw={700} c="orange.5">study-e</Text>
          </Group>
          
          <Group>
            <Tooltip label="Bildirimler">
              <ActionIcon variant="subtle" color="gray" size="lg">
                <IconBell size={20} />
              </ActionIcon>
            </Tooltip>
            
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <Group gap="xs" style={{ cursor: 'pointer' }}>
                  <Avatar color="orange.5" radius="xl">
                    {user?.user_metadata?.name?.charAt(0) || 'U'}
                  </Avatar>
                  <div>
                    <Text size="sm">{user?.user_metadata?.name || 'Kullanıcı'}</Text>
                    <Text size="xs" c="dimmed">Çevrimiçi</Text>
                  </div>
                </Group>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label>Profil</Menu.Label>
                <Menu.Item leftSection={<IconChartBar size={14} />}>
                  İstatistikler
                </Menu.Item>
                <Menu.Item leftSection={<IconStar size={14} />}>
                  Favoriler
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item color="red" leftSection={<IconLogout size={14} />} onClick={handleLogout}>
                  Çıkış Yap
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Stack h="100%">
          <Paper withBorder p="md">
            <Text fw={700} mb="md">Çalışma İstatistikleri</Text>
            <Stack gap="xs">
              <Group>
                <RingProgress
                  size={80}
                  thickness={8}
                  sections={[{ value: getDailyProgress(), color: 'orange' }]}
                  label={
                    <Text ta="center" size="xs">{getDailyProgress()}%</Text>
                  }
                />
                <div>
                  <Text size="sm">Günlük Hedef</Text>
                  <Text size="xs" c="dimmed">
                    {formatTime(stats.daily_study_time)} / {formatTime(stats.daily_goal)}
                  </Text>
                </div>
              </Group>
              <Divider />
              <Group>
                <ThemeIcon color="orange" variant="light" size="lg">
                  <IconClock size={20} />
                </ThemeIcon>
                <div>
                  <Text size="sm">Toplam Süre</Text>
                  <Text size="xs" c="dimmed">{formatTime(stats.total_study_time)}</Text>
                </div>
              </Group>
              <Group>
                <ThemeIcon color="orange" variant="light" size="lg">
                  <IconBook size={20} />
                </ThemeIcon>
                <div>
                  <Text size="sm">Katılınan Ders</Text>
                  <Text size="xs" c="dimmed">{stats.total_sessions} ders</Text>
                </div>
              </Group>
              <Group>
                <ThemeIcon color="orange" variant="light" size="lg">
                  <IconTrophy size={20} />
                </ThemeIcon>
                <div>
                  <Text size="sm">Başarı Puanı</Text>
                  <Text size="xs" c="dimmed">{stats.xp_points} XP</Text>
                </div>
              </Group>
            </Stack>
          </Paper>

          <Paper withBorder p="md">
            <Text fw={700} mb="md">Online Arkadaşlar</Text>
            <Text c="dimmed" size="sm">Henüz online arkadaş yok</Text>
          </Paper>

          <Paper withBorder p="md" style={{ marginTop: 'auto' }}>
            <Text size="sm" c="dimmed" ta="center">
              study-e v1.0.0
            </Text>
          </Paper>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Stack gap="lg">
          <Group justify="space-between">
            <Text size="xl" fw={700}>Çalışma Odaları</Text>
            <Button 
              leftSection={<IconPlus size={20} />} 
              color="orange.5"
              onClick={openCreateRoom}
            >
              Yeni Oda Oluştur
            </Button>
          </Group>

          <Group>
            <TextInput
              placeholder="Oda veya konu ara..."
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Select
              placeholder="Konuya göre filtrele"
              leftSection={<IconFilter size={16} />}
              data={subjects}
              value={selectedSubject}
              onChange={setSelectedSubject}
              clearable
              style={{ width: 200 }}
            />
          </Group>

          <Tabs defaultValue="all">
            <Tabs.List>
              <Tabs.Tab value="all">Tüm Odalar</Tabs.Tab>
              <Tabs.Tab value="favorites">Favoriler</Tabs.Tab>
              <Tabs.Tab value="my">Odalarım</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="all">
              <Grid mt="md">
                {filteredRooms.length === 0 ? (
                  <Grid.Col span={12}>
                    <Card withBorder p="xl" ta="center">
                      <Text size="lg" fw={500} c="dimmed">
                        Henüz aktif çalışma odası bulunmuyor
                      </Text>
                      <Button 
                        color="orange.5" 
                        mt="md"
                        leftSection={<IconPlus size={20} />}
                        onClick={openCreateRoom}
                      >
                        İlk Odayı Oluştur
                      </Button>
                    </Card>
                  </Grid.Col>
                ) : (
                  filteredRooms.map((room) => (
                    <Grid.Col key={room.id} span={{ base: 12, sm: 6, lg: 4 }}>
                      <Card withBorder>
                        <Group justify="space-between" mb="xs">
                          <Text fw={500}>{room.name}</Text>
                          <Group gap={8}>
                            <Badge 
                              color={room.has_audio ? 'orange.5' : 'gray'}
                              leftSection={room.has_audio ? <IconMicrophone size={14} /> : <IconMicrophoneOff size={14} />}
                            >
                              {room.has_audio ? 'Sesli' : 'Sessiz'}
                            </Badge>
                            <ActionIcon
                              variant="subtle"
                              color="orange"
                              onClick={() => toggleFavorite(room.id)}
                            >
                              {favoriteRooms.has(room.id) ? <IconStarFilled size={20} /> : <IconStar size={20} />}
                            </ActionIcon>
                          </Group>
                        </Group>
                        
                        <Text size="sm" c="dimmed" mb="md">
                          {room.subject}
                        </Text>
                        
                        <Group justify="space-between">
                          <Group gap="xs">
                            <IconUsers size={16} />
                            <Text size="sm">{room.participants}/{room.max_participants}</Text>
                          </Group>
                          <Button 
                            variant="light" 
                            color="orange.5"
                            onClick={() => handleJoinRoom(room.id)}
                          >
                            Katıl
                          </Button>
                        </Group>
                      </Card>
                    </Grid.Col>
                  ))
                )}
              </Grid>
            </Tabs.Panel>

            <Tabs.Panel value="favorites">
              <Grid mt="md">
                {filteredRooms.filter(room => favoriteRooms.has(room.id)).map((room) => (
                  <Grid.Col key={room.id} span={{ base: 12, sm: 6, lg: 4 }}>
                    {/* Aynı kart yapısı */}
                  </Grid.Col>
                ))}
              </Grid>
            </Tabs.Panel>

            <Tabs.Panel value="my">
              <Grid mt="md">
                {filteredRooms.filter(room => room.owner_id === user?.id).map((room) => (
                  <Grid.Col key={room.id} span={{ base: 12, sm: 6, lg: 4 }}>
                    {/* Aynı kart yapısı */}
                  </Grid.Col>
                ))}
              </Grid>
            </Tabs.Panel>
          </Tabs>
        </Stack>

        <Modal 
          opened={createRoomOpened} 
          onClose={closeCreateRoom}
          title="Yeni Çalışma Odası Oluştur"
        >
          <form onSubmit={handleCreateRoom}>
            <TextInput
              label="Oda Adı"
              name="name"
              placeholder="Örn: Matematik Çalışma Grubu"
              required
              mb="md"
            />
            
            <Select
              label="Çalışma Konusu"
              name="subject"
              placeholder="Konu seçin"
              data={[
                'Matematik',
                'Fizik',
                'Kimya',
                'Biyoloji',
                'Tarih',
                'Edebiyat',
                'İngilizce',
                'Programlama',
                'Diğer'
              ]}
              required
              mb="md"
            />
            
            <NumberInput
              label="Maksimum Katılımcı"
              name="maxParticipants"
              placeholder="Örn: 5"
              min={2}
              max={10}
              required
              mb="md"
            />
            
            <Switch
              label="Sesli Çalışma"
              name="hasAudio"
              description="Odada sesli iletişime izin ver"
              mb="xl"
            />
            
            <Group justify="flex-end">
              <Button variant="light" color="gray" onClick={closeCreateRoom}>İptal</Button>
              <Button type="submit" color="orange.5" loading={loading}>Oluştur</Button>
            </Group>
          </form>
        </Modal>
      </AppShell.Main>
    </AppShell>
  );
} 