import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'アタスラAI - AIプレゼン資料作成',
  description: 'AIが台本とスライドを同時生成。テーマを入力するだけで、プロ品質のプレゼン資料が完成。',
  keywords: ['AI', 'プレゼン', 'スライド', '台本', '講座', '資料作成'],
  openGraph: {
    title: 'アタスラAI - AIプレゼン資料作成',
    description: 'AIが台本とスライドを同時生成。テーマを入力するだけで、プロ品質のプレゼン資料が完成。',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
