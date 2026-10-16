import { Suspense } from 'react';
import Login from '@/components/Login';
import '../landing.css';

export const metadata = { title: 'Velvet · Log in' };

export default function LoginPage() {
  return <Suspense><Login /></Suspense>;
}
