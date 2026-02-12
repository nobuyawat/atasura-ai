/**
 * Stripe Checkout Session 作成 API
 * POST /api/stripe/create-checkout-session
 *
 * 環境変数（STRIPE_PRICE_ID_*）から Price ID を取得し、Checkout Session を作成。
 * 既存の stripe_customer_id がある場合はそれを再利用し、
 * 重複 Customer の作成を防止する。
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getPriceIdForPlan } from '@/lib/plans';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { planId, userId, email } = body;

    // バリデーション
    if (!planId || !userId || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: planId, userId, email' },
        { status: 400 }
      );
    }

    // 環境変数から Price ID を取得
    let priceId: string;
    try {
      priceId = await getPriceIdForPlan(planId);
    } catch (err: any) {
      console.error(`[Checkout] Failed to resolve price for plan=${planId}:`, err.message);
      return NextResponse.json(
        { error: `Invalid plan: ${planId}` },
        { status: 400 }
      );
    }

    console.log('[Checkout]', { planId, priceId, userId });

    // 既存の stripe_customer_id を確認（Customer 再利用）
    const supabase = createClient();
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();

    // ベースURL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Checkout Session パラメータ
    const sessionParams: Record<string, any> = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      client_reference_id: userId,
      metadata: {
        userId,
        planId,
      },
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/checkout/cancel`,
      locale: 'ja',
      subscription_data: {
        metadata: {
          userId,
          planId,
        },
      },
    };

    // 既存 Customer がいれば再利用、なければ email で新規作成
    if (subscription?.stripe_customer_id) {
      sessionParams.customer = subscription.stripe_customer_id;
    } else {
      sessionParams.customer_email = email;
    }

    // Checkout Session 作成
    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('[Stripe] Checkout session error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
