import { useState } from 'react';
import { TextInput, PasswordInput, Button, Title, Paper, Text, Container } from '@mantine/core';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { notifications } from '@mantine/notifications';

export function Login() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      notifications.show({
        title: 'Başarılı',
        message: 'Giriş yapıldı!',
        color: 'green',
      });
      
      navigate('/');
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

  return (
    <Container size={420} my={40}>
      <Title ta="center" color="navy.5">
        Study-Verse&apos;e Hoş Geldiniz
      </Title>
      <Text c="dimmed" size="sm" ta="center" mt={5}>
        Hesabınız yok mu?{' '}
        <Link to="/signup" style={{ color: 'var(--mantine-color-orange-6)' }}>
          Kayıt Ol
        </Link>
      </Text>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <form onSubmit={handleSubmit}>
          <TextInput
            label="E-posta"
            name="email"
            placeholder="ornek@email.com"
            required
          />
          <PasswordInput
            label="Şifre"
            name="password"
            placeholder="Şifreniz"
            required
            mt="md"
          />
          <Button 
            type="submit" 
            fullWidth 
            mt="xl" 
            loading={loading}
            color="navy.5"
          >
            Giriş Yap
          </Button>
        </form>
      </Paper>
    </Container>
  );
} 