/**
 * 返金申請 API
 * POST /api/stripe/refund-request
 *
 * 返金申請をDBに保存し、運営通知メール＋ユーザー確認メールを送信する
 * （実際のRefundは運営がStripe管理画面で手動実行）
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendRefundAdminNotification, sendRefundUserConfirmation } from '@/lib/email/resend';

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

    console.log(`[Refund] Request submitted by user: ${user.id}, email: ${email}`);

    // 4. メール送信（非同期・エラーでも申請自体は成功とする）
    try {
      // 4a. 運営通知メール
      const adminResult = await sendRefundAdminNotification({
        userEmail: email,
        purchaseDate,
        reason,
        userId: user.id,
      });
      const adminError = (adminResult as any)?.error;
      if (adminError) {
        console.error('[Refund] Admin notification email error:', adminError);
      } else {
        console.log(`[Refund] Admin notification sent, id: ${(adminResult as any)?.data?.id}`);
      }

      // 4b. ユーザー確認メール
      const userResult = await sendRefundUserConfirmation({ to: email });
      const userError = (userResult as any)?.error;
      if (userError) {
        console.error('[Refund] User confirmation email error:', userError);
      } else {
        console.log(`[Refund] User confirmation sent to ${email}, id: ${(userResult as any)?.data?.id}`);
      }
    } catch (emailErr) {
      // メール送信失敗でも返金申請自体は成功
      console.error('[Refund] Email sending failed (non-fatal):', emailErr);
    }

    return NextResponse.json({
      success: true,
      message: '返金リクエストを受け付けました。確認メールをお送りしましたので、ご確認ください。通常1〜3営業日以内にご連絡いたします。',
    });
  } catch (error) {
    console.error('[Refund] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '返金申請に失敗しました' },
      { status: 500 }
    );
  }
}
