/**
 * Stripe Customer Portal セッション作成 API
 * POST /api/stripe/portal
 *
 * 請求書/領収書のダウンロード用
 * Portal 内のプラン変更・解約ボタンは Stripe Dashboard で OFF にする想定
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    // 1. 認証
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. stripe_customer_id を取得
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    if (!sub?.stripe_customer_id) {
      return NextResponse.json(
        { error: '請求情報が見つかりません。有料プランにご加入ください。' },
        { status: 400 }
      );
    }

    // 3. Portal セッション作成
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${baseUrl}/app`,
    });

    console.log(`[Portal] Session created for user: ${user.id}`);

    return NextResponse.json({
      url: session.url,
    });
  } catch (error) {
    console.error('[Portal] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'ポータルの作成に失敗しました' },
      { status: 500 }
    );
  }
}
