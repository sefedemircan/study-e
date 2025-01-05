import { useState } from 'react';
import { TextInput, PasswordInput, Button, Title, Paper, Text, Container } from '@mantine/core';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { notifications } from '@mantine/notifications';

export function SignUp() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');
    const name = formData.get('name');

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
          },
        },
      });

      if (error) throw error;
      
      notifications.show({
        title: 'Başarılı',
        message: 'Hesabınız oluşturuldu! Lütfen e-posta adresinizi doğrulayın.',
        color: 'green',
      });
      
      navigate('/login');
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
      <Title ta="center" color="navy">
        Yeni Hesap Oluştur
      </Title>
      <Text c="dimmed" size="sm" ta="center" mt={5}>
        Zaten hesabınız var mı?{" "}
        <Link to="/login" style={{ color: 'var(--mantine-color-orange-6)' }}>
          Giriş Yap
        </Link>
      </Text>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <form onSubmit={handleSubmit}>
          <TextInput
            label="Ad Soyad"
            name="name"
            placeholder="Ad Soyad"
            required
          />
          <TextInput
            label="E-posta"
            name="email"
            placeholder="ornek@email.com"
            mt="md"
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
            Kayıt Ol
          </Button>
        </form>
      </Paper>
    </Container>
  );
} 