/**
 * 返金申請 API
 * POST /api/stripe/refund-request
 *
 * 返金申請をDBに保存する（実際のRefundは運営がStripe管理画面で手動実行）
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // 1. 認証
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. リクエスト解析
    const { email, purchaseDate, reason } = await request.json();

    if (!email || !purchaseDate || !reason) {
      return NextResponse.json(
        { error: 'すべての項目を入力してください（email, purchaseDate, reason）' },
        { status: 400 }
      );
    }

    // 3. 返金申請を保存（RLS: 自分のuser_idでINSERT可能）
    const { error } = await supabase
      .from('refund_requests')
      .insert({
        user_id: user.id,
        email,
        purchase_date: purchaseDate,
        reason,
      });

    if (error) {
      console.error('[Refund] Insert error:', error);
      return NextResponse.json(
        { error: '返金申請の送信に失敗しました' },
        { status: 500 }
      );
    }

    console.log(`[Refund] Request submitted by user: ${user.id}`);

    return NextResponse.json({
      success: true,
      message: '返金リクエストを受け付けました。確認後、メールでご連絡いたします。',
    });
  } catch (error) {
    console.error('[Refund] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '返金申請に失敗しました' },
      { status: 500 }
    );
  }
}
