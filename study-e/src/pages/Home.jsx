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
  Select
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconBell, IconLogout, IconUsers, IconMicrophone, IconMicrophoneOff, IconPlus } from '@tabler/icons-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';

export function Home() {
  const [opened, { toggle }] = useDisclosure();
  const [createRoomOpened, { open: openCreateRoom, close: closeCreateRoom }] = useDisclosure(false);
  const [user, setUser] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
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
            <ActionIcon variant="subtle" color="gray" size="lg">
              <IconBell size={20} />
            </ActionIcon>
            
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <Group gap="xs" style={{ cursor: 'pointer' }}>
                  <Avatar color="orange.5" radius="xl">
                    {user?.user_metadata?.name?.charAt(0) || 'U'}
                  </Avatar>
                  <Text size="sm">{user?.user_metadata?.name || 'Kullanıcı'}</Text>
                </Group>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Item color="red" leftSection={<IconLogout size={14} />} onClick={handleLogout}>
                  Çıkış Yap
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Text fw={700} mb="md">Online Arkadaşlar</Text>
        <Text c="dimmed" size="sm">Henüz online arkadaş yok</Text>
      </AppShell.Navbar>

      <AppShell.Main>
        <Group justify="space-between" mb="lg">
          <Text size="xl" fw={700}>Çalışma Odaları</Text>
          <Button 
            leftSection={<IconPlus size={20} />} 
            color="navy.5"
            onClick={openCreateRoom}
          >
            Yeni Oda Oluştur
          </Button>
        </Group>

        <Grid>
          {rooms.length === 0 ? (
            <Grid.Col span={12}>
              <Card withBorder p="xl" ta="center">
                <Text size="lg" fw={500} c="dimmed">
                  Henüz aktif çalışma odası bulunmuyor
                </Text>
                <Button 
                  color="navy.5" 
                  mt="md"
                  leftSection={<IconPlus size={20} />}
                  onClick={openCreateRoom}
                >
                  İlk Odayı Oluştur
                </Button>
              </Card>
            </Grid.Col>
          ) : (
            rooms.map((room) => (
              <Grid.Col key={room.id} span={{ base: 12, sm: 6, lg: 4 }}>
                <Card withBorder>
                  <Group justify="space-between" mb="xs">
                    <Text fw={500}>{room.name}</Text>
                    <Badge 
                      color={room.has_audio ? 'navy.5' : 'gray'}
                      leftSection={room.has_audio ? <IconMicrophone size={14} /> : <IconMicrophoneOff size={14} />}
                    >
                      {room.has_audio ? 'Sesli' : 'Sessiz'}
                    </Badge>
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
              <Button type="submit" color="navy.5" loading={loading}>Oluştur</Button>
            </Group>
          </form>
        </Modal>
      </AppShell.Main>
    </AppShell>
  );
} 