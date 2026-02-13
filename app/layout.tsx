import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { SharedMobileNav } from '@/components/shared/SharedMobileNav';
import { SharedMobileMenu } from '@/components/shared/SharedMobileMenu';

const inter = Inter({ subsets: ['latin'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',  // Safe area対応（iPhoneノッチ）
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
      <body className={inter.className}>
        <SharedMobileNav />
        <SharedMobileMenu />
        {children}
      </body>
    </html>
  );
}
